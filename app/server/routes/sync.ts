import {Hono} from 'hono';
import type {Json} from '../../shared/types.ts';
import {runSync, syncStatus} from '../sync.ts';
import {HttpError} from './util.ts';
import type {Deps} from './util.ts';

export function syncRoutes({jobs}: Deps): Hono {
  const app = new Hono();
  app.get('/sync/status', async c => c.json(await syncStatus()));
  for (const mode of ['push', 'pull'] as const) {
    app.post(`/sync/${mode}`, c => {
      if (jobs.list().some(j => j.kind === 'sync' && (j.state === 'queued' || j.state === 'running'))) throw new HttpError(409, 'Đang đồng bộ thư viện');
      return c.json(jobs.enqueue({
        kind: 'sync', lane: 'io', ref: mode, project: null, cancellable: true,
        label: mode === 'push' ? 'Đẩy thư viện lên Drive' : 'Kéo thư viện từ Drive',
        run: async ctx => (await runSync(mode, ctx)) as unknown as Json,
      }), 202);
    });
  }
  return app;
}
