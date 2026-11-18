import type {Context} from 'hono';
import type {EventBus} from '../events.ts';
import type {JobQueue} from '../jobs.ts';
import type {VoiceWorker} from '../voiceWorker.ts';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {PathError, SLUG_RE, repoRoot, safeJoin} from '../paths.ts';
import {readJson} from '../store.ts';
import type {Config} from '../../shared/types.ts';

export type WorkerLike = Pick<VoiceWorker, 'request' | 'status' | 'start' | 'stop'>;
export type Deps = {bus: EventBus; jobs: JobQueue; worker: WorkerLike; ports: number[]};

export class HttpError extends Error {
  status: number; details?: unknown;
  constructor(status: number, message: string, details?: unknown) { super(message); this.status = status; this.details = details; }
}

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export async function bodyOf(c: Context): Promise<Record<string, unknown>> {
  const b: unknown = await c.req.json().catch(() => { throw new HttpError(400, 'malformed JSON'); });
  if (!isObj(b)) throw new HttpError(400, 'body must be a JSON object');
  return b;
}
export function mtimeField(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new HttpError(400, 'baseMtime must be a number');
  return v;
}

export function slugParam(s: string, what = 'slug'): string {
  if (!SLUG_RE.test(s)) throw new HttpError(400, `bad ${what}`);
  return s;
}
export async function needProject(slug: string): Promise<void> {
  slugParam(slug, 'project');
  await stat(safeJoin('projects', slug, 'storyboard.json')).catch(() => { throw new HttpError(404, 'project not found'); });
}
/** A single path segment that is not hidden: used for library file names. */
export function plainName(s: string): string {
  if (!s || /[\\/\0]/.test(s) || s.startsWith('.')) throw new PathError(`bad name: ${JSON.stringify(s)}`);
  return s;
}
export const ingestBusy = (jobs: JobQueue): boolean => jobs.list().some(j => j.kind === 'ingest' && (j.state === 'queued' || j.state === 'running'));
export const readConfigV = () => readJson<Config>(path.join(repoRoot(), 'config.json'));
export const readConfig = async (): Promise<Config> => (await readConfigV()).data;
