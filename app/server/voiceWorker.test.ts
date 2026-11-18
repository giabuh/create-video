import {mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';
import {EventBus} from './events.ts';
import {VoiceWorker} from './voiceWorker.ts';
import type {ServerEvent} from '../shared/types.ts';

const FAKE = `
import readline from 'node:readline';
const out = o => process.stdout.write(JSON.stringify(o) + '\\n');
out({event: 'ready'});
readline.createInterface({input: process.stdin}).on('line', l => {
  const r = JSON.parse(l);
  if (r.cmd === 'crash') { console.error('kaboom'); process.exit(3); }
  if (r.cmd === 'ping') return out({id: r.id, ok: true, t: Date.now()});
  if (r.cmd === 'prepare') {
    out({event: 'model', state: 'loading'});
    out({id: r.id, event: 'progress', done: 1, total: 2, label: 'a'});
    out({id: r.id, event: 'progress', done: 2, total: 2, label: 'b'});
    setTimeout(() => out({id: r.id, ok: true, t: Date.now()}), 50);
  }
});`;
let script = '';
beforeAll(async () => { script = path.join(await mkdtemp(path.join(os.tmpdir(), 'fakew-')), 'fake.mjs'); await writeFile(script, FAKE); });
const make = () => { const bus = new EventBus(); const ev: ServerEvent[] = []; bus.subscribe(e => ev.push(e)); return {w: new VoiceWorker(bus, {command: process.execPath, args: [script], cwd: os.tmpdir()}), ev}; };

describe('VoiceWorker', () => {
  it('matches replies, reports progress in order, serializes', async () => {
    const {w, ev} = make();
    const prog: string[] = [];
    const a = w.request('prepare', {project: 'x'}, (d, t, l) => prog.push(`${d}/${t}/${l}`));
    const b = w.request('ping', {});
    const [ra, rb] = await Promise.all([a, b]);
    expect(prog).toEqual(['1/2/a', '2/2/b']);
    expect(ra.ok && rb.ok).toBe(true);
    expect(rb.t as number).toBeGreaterThanOrEqual(ra.t as number); // ping answered only after prepare finished
    const states = ev.filter(e => e.type === 'worker').map(e => (e as {status: {state: string}}).status.state);
    expect(states).toContain('idle'); expect(states).toContain('loading');
    w.stop();
  });

  it('rejects in-flight on exit with stderr tail and restarts on the next request', async () => {
    const {w} = make();
    await w.request('ping', {});
    await expect(w.request('crash' as never, {})).rejects.toThrow(/worker exited.*kaboom/s);
    expect(w.status().state).toBe('starting');
    expect((await w.request('ping', {})).ok).toBe(true);
    w.stop();
  });
});
