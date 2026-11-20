import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {Config, SyncFolder, SyncStatus} from '../shared/types.ts';
import {fail, parseStats, rclone, rcloneCheck, STATS_FLAGS, statsText} from './drive.ts';
import {repoRoot} from './paths.ts';
import {readJson, readJsonOr} from './store.ts';
import type {JobCtx} from './jobs.ts';

export const SYNC_FOLDERS: SyncFolder[] = ['library', 'music', 'sfx', 'reference'];
type State = {lastPush: number | null; lastPull: number | null};
const stateFile = () => path.join(repoRoot(), 'app', '.data', 'sync-state.json');
const remote = async () => (await readJson<Config>(path.join(repoRoot(), 'config.json'))).data.sync.remote;
const localDir = async (f: SyncFolder) => { const d = path.join(repoRoot(), f); await mkdir(d, {recursive: true}); return d; };

/*
 * Observed against the real remote video-syn:create-video (rclone check <dir> <remote>/<dir> --size-only --combined -):
 *  - identical folder: exit 0, stdout `= name` lines, stderr "NOTICE: ... 0 differences found"
 *  - remote folder missing: exit 1, stdout `+ name` for every local file, stderr "... N differences found" then
 *    "Failed to check with N errors: last error was: N differences found"  (so exit 1 + "differences found" = diff, not failure)
 *  - unknown remote name: exit 1, stderr `Failed to create file system for "x:y": didn't find section in config file`
 *    (no "differences found" -> real error)
 *  - empty local dir vs missing remote dir: exit 0, "0 differences found".
 */
export async function folderStatus(f: SyncFolder): Promise<SyncStatus['folders'][number]> {
  const r = await rcloneCheck(['check', await localDir(f), `${await remote()}/${f}`, '--size-only', '--combined', '-']);
  // exit 1 is "differences" only if rclone's own summary says the last error was the differences; any other last error is real
  const last = /last error was: (.*)/.exec(r.err)?.[1];
  const onlyDiffs = r.code === 1 && /differences found/.test(r.err) && (!last || /differences found/.test(last));
  if (r.code !== 0 && !onlyDiffs) throw fail(r);
  const c = {'+': 0, '-': 0, '*': 0, '=': 0} as Record<string, number>;
  for (const l of r.out.split('\n')) if (l[1] === ' ' && l[0] in c) c[l[0]]++;
  return {name: f, localOnly: c['+'], driveOnly: c['-'], differ: c['*'], same: c['=']};
}

export async function readSyncState(): Promise<State> {
  return (await readJsonOr<State>(stateFile(), {lastPush: null, lastPull: null})).data;
}
async function saveSyncState(mode: 'push' | 'pull'): Promise<void> {
  const s = {...await readSyncState(), [mode === 'push' ? 'lastPush' : 'lastPull']: Date.now()};
  await mkdir(path.dirname(stateFile()), {recursive: true});
  await writeFile(stateFile(), JSON.stringify(s));
}

export async function syncStatus(): Promise<SyncStatus> {
  const res = await Promise.allSettled(SYNC_FOLDERS.map(folderStatus));
  const errs = res.flatMap(r => (r.status === 'rejected' ? [(r.reason as Error).message] : []));
  return {
    checkedAt: Date.now(), error: errs.length ? [...new Set(errs)].join('; ') : null, ...await readSyncState(),
    folders: res.map((r, i) => (r.status === 'fulfilled' ? r.value : {name: SYNC_FOLDERS[i], localOnly: 0, driveOnly: 0, differ: 0, same: 0})),
  };
}

/** Same semantics as tools/sync.sh: copy --update per folder, never deletes; pull exit 3 (remote dir missing) = skip. */
export async function runSync(mode: 'push' | 'pull', ctx: JobCtx): Promise<SyncStatus> {
  const base = await remote();
  const n = SYNC_FOLDERS.length;
  for (const [i, f] of SYNC_FOLDERS.entries()) {
    ctx.signal.throwIfAborted();
    const head = `${f} (${i + 1}/${n})`;
    ctx.progress(i / n, head);
    const [src, dst] = [await localDir(f), `${base}/${f}`];
    const onLine = (line: string) => {
      const s = parseStats(line);
      if (!s) return;
      const files = s.totalTransfers ? `${s.transfers}/${s.totalTransfers} file` : '';
      ctx.progress((i + (s.totalBytes ? Math.min(1, s.bytes / s.totalBytes) : 0)) / n, [head, files, statsText(s)].filter(Boolean).join(' · '));
    };
    const r = await rclone(['copy', ...(mode === 'push' ? [src, dst] : [dst, src]), '--update', ...STATS_FLAGS], onLine, ctx.signal);
    if (r.code === 3 && mode === 'pull') { ctx.log(`skip pull ${f} (chưa có trên Drive)`); continue; }
    if (r.code !== 0) throw fail(r);
  }
  ctx.signal.throwIfAborted(); // cancelled jobs never record a sync
  await saveSyncState(mode);
  ctx.progress(1, 'Kiểm tra lại');
  return syncStatus();
}
