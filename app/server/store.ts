import {mkdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {Versioned} from '../shared/types.ts';

export class Conflict extends Error {
  current: unknown; mtime: number;
  constructor(current: unknown, mtime: number) { super('conflict'); this.current = current; this.mtime = mtime; }
}
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(file) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(file, next);
  next.finally(() => { if (locks.get(file) === next) locks.delete(file); }).catch(() => {});
  return next;
}
export const mtimeOf = async (file: string) => Math.floor((await stat(file)).mtimeMs);
export async function readJson<T>(file: string): Promise<Versioned<T>> {
  const [text, mtime] = await Promise.all([readFile(file, 'utf8'), mtimeOf(file)]);
  return {data: JSON.parse(text) as T, mtime};
}
export async function readJsonOr<T>(file: string, fallback: T): Promise<Versioned<T>> {
  try { return await readJson<T>(file); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {data: fallback, mtime: 0}; throw e; }
}
let seq = 0;
export function writeJsonAtomic(file: string, data: unknown, baseMtime?: number | null): Promise<number> {
  return withLock(file, async () => {
    if (baseMtime != null) {
      let cur: Versioned<unknown> | null = null;
      try { cur = await readJson(file); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
      if (cur && cur.mtime !== baseMtime) throw new Conflict(cur.data, cur.mtime);
    }
    await mkdir(path.dirname(file), {recursive: true});
    const tmp = `${file}.${process.pid}.${Date.now()}.${seq++}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await rename(tmp, file);
    return mtimeOf(file);
  });
}
