import {spawn} from 'node:child_process';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import type {EventBus} from './events.ts';
import {repoRoot} from './paths.ts';
import type {Json, WorkerStatus} from '../shared/types.ts';

export type WorkerReply = Json & {ok: boolean; errors?: string[]};
type Progress = (done: number, total: number, label: string | null) => void;
type Pending = {id: string; resolve(r: WorkerReply): void; reject(e: Error): void; onProgress?: Progress};

export class VoiceWorker {
  #bus: EventBus;
  #opts: {command?: string; args?: string[]; cwd?: string};
  #proc: ChildProcessWithoutNullStreams | null = null;
  #pending: Pending | null = null;
  #chain: Promise<unknown> = Promise.resolve();
  #stderr: string[] = [];
  #seq = 0;
  #status: WorkerStatus = {state: 'starting', device: null, error: null};

  constructor(bus: EventBus, opts: {command?: string; args?: string[]; cwd?: string} = {}) { this.#bus = bus; this.#opts = opts; }

  status(): WorkerStatus { return {...this.#status}; }
  #setStatus(s: Partial<WorkerStatus> & {state: WorkerStatus['state']}): void {
    this.#status = {device: this.#status.device, error: null, ...s};
    this.#bus.emit({type: 'worker', status: this.status()});
  }

  start(): void {
    if (this.#proc) return;
    const cwd = this.#opts.cwd ?? repoRoot();
    const command = this.#opts.command ?? path.join(repoRoot(), 'VieNeu-TTS/.venv/bin/python');
    const args = this.#opts.args ?? ['tools/worker.py'];
    this.#stderr = [];
    this.#setStatus({state: 'starting'});
    const proc = spawn(command, args, {cwd, stdio: ['pipe', 'pipe', 'pipe']});
    this.#proc = proc;
    let gone = false;
    const gotGone = (why: string, asError: boolean) => {
      if (gone) return;
      gone = true;
      if (this.#proc === proc) this.#proc = null;
      const tail = this.#stderr.join('\n');
      const msg = `worker exited: ${why}${tail ? '\n' + tail : ''}`;
      if (asError) this.#setStatus({state: 'error', error: msg}); else this.#setStatus({state: 'starting'});
      const p = this.#pending; this.#pending = null;
      p?.reject(new Error(msg));
    };
    proc.on('error', e => gotGone(e.message, true));
    proc.on('close', (code, sig) => gotGone(`code ${code ?? sig}`, false));
    proc.stdin.on('error', () => {}); // EPIPE surfaces via 'close'
    readline.createInterface({input: proc.stderr}).on('line', l => { this.#stderr.push(l); if (this.#stderr.length > 40) this.#stderr.shift(); });
    readline.createInterface({input: proc.stdout}).on('line', l => this.#onLine(l));
  }

  #onLine(line: string): void {
    let m: Json;
    try { m = JSON.parse(line) as Json; } catch { this.#stderr.push(line); return; }
    if (m.event === 'ready') { this.#setStatus({state: 'idle'}); return; }
    if (m.event === 'model') {
      const state = m.state as string;
      if (state === 'loading') this.#setStatus({state: 'loading'});
      else if (state === 'ready') this.#setStatus({state: 'ready', device: (m.device as WorkerStatus['device']) ?? null});
      else if (state === 'error') this.#setStatus({state: 'error', error: String(m.error ?? 'model error')});
      return;
    }
    const p = this.#pending;
    if (!p || m.id !== p.id) return;
    if (m.event === 'progress') { p.onProgress?.(Number(m.done), Number(m.total), (m.label as string | null) ?? null); return; }
    this.#pending = null;
    p.resolve(m as WorkerReply);
  }

  request(cmd: 'prepare' | 'try' | 'ping', payload: Json, onProgress?: Progress): Promise<WorkerReply> {
    const run = () => new Promise<WorkerReply>((resolve, reject) => {
      this.start();
      const id = String(++this.#seq);
      this.#pending = {id, resolve, reject, onProgress};
      this.#proc!.stdin.write(JSON.stringify({...payload, id, cmd}) + '\n');
    });
    const result = this.#chain.then(run, run);
    this.#chain = result.catch(() => {});
    return result;
  }

  stop(): void { this.#proc?.kill(); }
}
