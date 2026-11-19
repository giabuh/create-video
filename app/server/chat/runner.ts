import {spawn} from 'node:child_process';
import readline from 'node:readline';
import type {ChatEvent, LimitInfo} from '../../shared/types.ts';
import {repoRoot} from '../paths.ts';
import {childEnv, type Account} from './accounts.ts';
import {parseLine} from './stream.ts';

export const claudeBin = (): string => process.env.REEL_CLAUDE_BIN ?? 'claude';

export type TurnOpts = {
  sessionId: string; resume: boolean; account: Account; prompt: string; systemAppend: string; signal: AbortSignal;
  onEvent(e: ChatEvent): void; onInit?(): void; onLimit?(l: LimitInfo): void;
};

export function turnArgs(o: Pick<TurnOpts, 'sessionId' | 'resume' | 'systemAppend'>): string[] {
  return ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--dangerously-skip-permissions',
    o.resume ? '--resume' : '--session-id', o.sessionId, '--append-system-prompt', o.systemAppend];
}

const STOPPED = 'Đã dừng';

export function runTurn(o: TurnOpts): Promise<void> {
  return new Promise(resolve => {
    let ended = false, lastErr = '';
    let limit: LimitInfo | null = null;
    const end = (e: ChatEvent) => { if (!ended) { ended = true; o.onEvent(e); } };
    if (o.signal.aborted) { end({kind: 'error', message: STOPPED}); resolve(); return; }

    let p: ReturnType<typeof spawn>;
    try { p = spawn(claudeBin(), turnArgs(o), {cwd: repoRoot(), env: childEnv(o.account), stdio: ['pipe', 'pipe', 'pipe']}); } catch (err) { // e.g. NUL in argv throws synchronously
      end({kind: 'error', message: String(err)}); resolve(); return;
    }
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => { p.kill('SIGTERM'); killTimer = setTimeout(() => p.kill('SIGKILL'), 3000); };
    o.signal.addEventListener('abort', onAbort, {once: true});

    p.stdin!.on('error', () => { /* child exited before reading stdin; close/error handlers report it */ });
    p.stdin!.end(o.prompt);

    const outRl = readline.createInterface({input: p.stdout!});
    const errRl = readline.createInterface({input: p.stderr!});
    outRl.on('line', line => {
      const r = parseLine(line);
      if (!r) return;
      if (r.init) o.onInit?.();
      if (r.limit) { o.onLimit?.(r.limit); if (r.limit.status === 'rejected') limit = r.limit; }
      for (const ev of r.events) if (!ended) o.onEvent(ev);
      if (r.result) {
        const res = r.result;
        if (o.signal.aborted) end({kind: 'error', message: STOPPED});
        else if (!res.isError && !limit) end({kind: 'done', costUsd: res.costUsd, durationMs: res.durationMs});
        else end({kind: 'error', message: res.message ?? 'Claude báo lỗi',
          ...((limit || res.http429) && {limit: {account: o.account.name, resetsAt: limit?.resetsAt ?? null}})});
      }
    });
    errRl.on('line', l => { if (l.trim()) lastErr = l.trim(); });

    p.on('error', err => { end({kind: 'error', message: `Không chạy được claude: ${err.message}`}); resolve(); });
    // Wait for both readers to drain so the last stdout line (the result) is never lost to the close event.
    const drained = Promise.all([outRl, errRl].map(rl => new Promise<void>(r => rl.once('close', () => r()))));
    p.on('close', code => {
      void drained.then(() => {
        clearTimeout(killTimer);
        o.signal.removeEventListener('abort', onAbort);
        end(o.signal.aborted ? {kind: 'error', message: STOPPED} : {kind: 'error', message: lastErr || `claude thoát với mã ${code}`});
        resolve();
      });
    });
  });
}
