import {spawn} from 'node:child_process';
import path from 'node:path';
import type {Config} from '../shared/types.ts';
import {repoRoot, slugify} from './paths.ts';
import {readJson} from './store.ts';

export type Runner = (args: string[], onLine?: (line: string) => void, signal?: AbortSignal) => Promise<{code: number; out: string; err: string}>;

export class DriveError extends Error {}

const defaultRunner: Runner = (args, onLine, signal) => new Promise((resolve, reject) => {
  const p = spawn('rclone', args, {signal});
  let out = '', err = '', buf = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => {
    err += d; buf += d;
    const lines = buf.split('\n'); buf = lines.pop() ?? '';
    if (onLine) lines.forEach(onLine);
  });
  p.on('error', (e) => reject((e as NodeJS.ErrnoException).code === 'ENOENT' ? new DriveError('Chưa cài rclone') : e));
  p.on('close', (code) => { if (onLine && buf) onLine(buf); resolve({code: code ?? 1, out, err}); });
});

let run: Runner = defaultRunner;
export function setRunner(r: Runner): void { run = r; }
/** Runs rclone through the swappable runner (tests use setRunner). */
export const rclone: Runner = (args, onLine, signal) => run(args, onLine, signal);
/** Read-only checks (lsf/check) get a deadline: Drive sometimes stalls for minutes and the UI would spin forever. */
export async function rcloneCheck(args: string[], ms = 60_000): Promise<{code: number; out: string; err: string}> {
  try { return await run(args, undefined, AbortSignal.timeout(ms)); } catch (e) {
    if ((e as Error).name === 'AbortError' || (e as Error).name === 'TimeoutError') throw new DriveError(`Drive không phản hồi sau ${ms / 1000} giây — thử lại sau`);
    throw e;
  }
}

export type Stats = {bytes: number; totalBytes: number; speed: number; eta: number | null; transfers: number; totalTransfers: number};
/** Parses one `--use-json-log --stats-one-line` stderr line; null when it is not a stats line. */
export function parseStats(line: string): Stats | null {
  try {
    const s = (JSON.parse(line) as {stats?: Record<string, unknown>}).stats;
    if (!s) return null;
    const n = (k: string) => (typeof s[k] === 'number' ? s[k] as number : 0);
    return {bytes: n('bytes'), totalBytes: n('totalBytes'), speed: n('speed'), eta: typeof s.eta === 'number' ? s.eta : null, transfers: n('transfers'), totalTransfers: n('totalTransfers')};
  } catch { return null; }
}
const mb = (b: number) => (b / 1e6).toLocaleString('vi-VN', {maximumFractionDigits: 1});
/** "12,3/22,1 MB · 4,2 MB/s" — the step text shown under every Drive job. */
export const statsText = (s: Stats): string => [s.totalBytes ? `${mb(s.bytes)}/${mb(s.totalBytes)} MB` : null, s.speed ? `${mb(s.speed)} MB/s` : null].filter(Boolean).join(' · ');
/** Flags that make rclone print a JSON stats line every second on stderr. */
export const STATS_FLAGS = ['--stats=1s', '--stats-one-line', '--use-json-log', '-v'];

export function driveName(input: string): string {
  // slugify falls back to 'media' for empty input; treat that as a bad name unless the user typed it
  const slug = slugify(input.replace(/\.mp4$/i, ''));
  if (slug === 'media' && !/media/i.test(input)) throw new Error('bad name');
  return slug + '.mp4';
}

export async function publishDir(): Promise<string> {
  const cfg = await readJson<Config>(path.join(repoRoot(), 'config.json'));
  return `${cfg.data.sync.remote}/xuat-ban`;
}

export function fail(r: {err: string}): DriveError {
  if (r.err.includes("didn't find section in config file")) return new DriveError('Chưa cấu hình rclone — chạy: rclone config');
  // --use-json-log: stderr lines are {"level","msg",...}; show only the msg
  const msgs = r.err.trim().split('\n').filter(Boolean).map((l) => { try { return (JSON.parse(l) as {level?: string; msg?: string}); } catch { return {msg: l}; } });
  const last = (msgs.filter((m) => m.level === 'error').pop() ?? msgs.pop())?.msg?.trim();
  return new DriveError(last ?? 'rclone thất bại');
}

export async function driveList(): Promise<string[]> {
  const r = await run(['lsf', await publishDir(), '--files-only']);
  if (r.code === 3) return [];
  if (r.code !== 0) throw fail(r);
  return r.out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** name -> size in bytes for every file in xuat-ban/ (empty when the folder does not exist yet). */
export async function driveSizes(): Promise<Map<string, number>> {
  const r = await rcloneCheck(['lsf', await publishDir(), '--files-only', '--format', 'sp', '--separator', ';']);
  if (r.code === 3) return new Map();
  if (r.code !== 0) throw fail(r);
  return new Map(r.out.split('\n').filter(Boolean).map((l) => { const i = l.indexOf(';'); return [l.slice(i + 1).trim(), Number(l.slice(0, i))] as [string, number]; }));
}

export async function driveUpload(local: string, name: string, onProgress: (p: number | null, s?: Stats) => void, signal?: AbortSignal): Promise<void> {
  const onLine = (line: string) => {
    const s = parseStats(line);
    if (s?.totalBytes) onProgress(Math.min(1, s.bytes / s.totalBytes), s);
  };
  const r = await run(['copyto', local, `${await publishDir()}/${name}`, ...STATS_FLAGS], onLine, signal);
  if (r.code !== 0) throw fail(r);
}

export async function driveDelete(name: string): Promise<void> {
  const r = await run(['deletefile', `${await publishDir()}/${name}`]);
  if (r.code !== 0) throw fail(r);
}

export function freeName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  const stem = base.replace(/\.mp4$/i, '');
  for (let i = 2; ; i++) if (!taken.includes(`${stem}-${i}.mp4`)) return `${stem}-${i}.mp4`;
}

export async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[], sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)), signal?: AbortSignal, onRetry?: (e: Error, attempt: number, waitMs: number) => void): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= delaysMs.length || signal?.aborted) throw e;
      onRetry?.(e as Error, i + 1, delaysMs[i]);
      await sleep(delaysMs[i]);
    }
  }
}
