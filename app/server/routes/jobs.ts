import {stat} from 'node:fs/promises';
import {Hono} from 'hono';
import {PathError, safeJoin, type RootKey} from '../paths.ts';
import {openFolder, runIngest} from '../procs.ts';
import {bodyOf, HttpError} from './util.ts';
import type {Deps} from './util.ts';

const OPENABLE = new Set<string>(['projects', 'library', 'music', 'sfx', 'brands', 'voices']);

export function jobRoutes({jobs}: Deps): Hono {
  const app = new Hono();
  app.get('/jobs', c => c.json(jobs.list().slice(0, 50)));
  app.post('/jobs/:id/cancel', c => {
    const id = c.req.param('id');
    if (!jobs.get(id)) throw new HttpError(404, 'job not found');
    try { return c.json(jobs.cancel(id)); } catch (e) { throw new HttpError(409, (e as Error).message); }
  });
  app.post('/ingest', c => c.json(jobs.enqueue({
    kind: 'ingest', lane: 'io', label: 'Nhập media từ inbox', project: null, cancellable: true, run: ctx => runIngest(ctx),
  }), 202));
  app.post('/open', async c => {
    const p = (await bodyOf(c)).path;
    if (typeof p !== 'string') throw new HttpError(400, 'path must be a string');
    const [top, ...rest] = p.split('/').filter(Boolean);
    if (!OPENABLE.has(top)) throw new PathError('path not allowed');
    const abs = safeJoin(top as RootKey, ...rest);
    if (!(await stat(abs).catch(() => null))?.isDirectory()) throw new HttpError(400, 'not a directory');
    openFolder(abs);
    return c.body(null, 204);
  });
  return app;
}
