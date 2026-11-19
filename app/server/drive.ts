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

function fail(r: {err: string}): DriveError {
  if (r.err.includes("didn't find section in config file")) return new DriveError('Chưa cấu hình rclone — chạy: rclone config');
  const last = r.err.trim().split('\n').filter(Boolean).pop();
  return new DriveError(last ?? 'rclone thất bại');
}

export async function driveList(): Promise<string[]> {
  const r = await run(['lsf', await publishDir(), '--files-only']);
  if (r.code === 3) return [];
  if (r.code !== 0) throw fail(r);
  return r.out.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function driveUpload(local: string, name: string, onProgress: (p: number | null) => void, signal?: AbortSignal): Promise<void> {
  const onLine = (line: string) => {
    try {
      const s = (JSON.parse(line) as {stats?: {bytes?: number; totalBytes?: number}}).stats;
      if (s?.totalBytes) onProgress(Math.min(1, (s.bytes ?? 0) / s.totalBytes));
    } catch { /* not a JSON stats line */ }
  };
  const r = await run(['copyto', local, `${await publishDir()}/${name}`, '--stats=1s', '--stats-one-line', '--use-json-log', '-v'], onLine, signal);
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

export async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[], sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)), signal?: AbortSignal): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= delaysMs.length || signal?.aborted) throw e;
      await sleep(delaysMs[i]);
    }
  }
}
