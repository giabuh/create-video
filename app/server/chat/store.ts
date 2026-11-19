import {appendFile, mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import type {ChatEvent, ChatMeta} from '../../shared/types.ts';
import {repoRoot} from '../paths.ts';
import {readJsonOr, writeJsonAtomic} from '../store.ts';

export const chatDir = (): string => process.env.REEL_CHAT_DIR ?? path.join(repoRoot(), 'app/.data/chats');
const indexFile = () => path.join(chatDir(), 'index.json');

export async function readIndex(): Promise<ChatMeta[]> {
  const {data} = await readJsonOr<ChatMeta[]>(indexFile(), []);
  // part-A entries predate engine/threadId
  return Array.isArray(data) ? data.map(c => ({...c, engine: c.engine ?? 'claude', threadId: c.threadId ?? null})) : [];
}

let chain: Promise<unknown> = Promise.resolve();
export function updateIndex(fn: (list: ChatMeta[]) => ChatMeta[]): Promise<ChatMeta[]> {
  const run = chain.then(async () => { const next = fn(await readIndex()); await writeJsonAtomic(indexFile(), next); return next; });
  chain = run.catch(() => undefined);
  return run;
}

export async function appendEvent(id: string, e: ChatEvent): Promise<void> {
  await mkdir(chatDir(), {recursive: true});
  await appendFile(path.join(chatDir(), `${id}.jsonl`), JSON.stringify(e) + '\n', 'utf8');
}

export async function readEvents(id: string): Promise<ChatEvent[]> {
  let text: string;
  try { text = await readFile(path.join(chatDir(), `${id}.jsonl`), 'utf8'); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const out: ChatEvent[] = [];
  for (const l of text.split('\n')) { if (!l) continue; try { out.push(JSON.parse(l) as ChatEvent); } catch { /* torn last line after a crash */ } }
  return out;
}
