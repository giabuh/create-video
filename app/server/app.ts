import path from 'node:path';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {serveStatic} from '@hono/node-server/serve-static';
import {sseRoute} from './events.ts';
import {hostGuard} from './guard.ts';
import {AUDIO_REF_EXTS, IMAGE_EXTS, MEDIA_EXTS, MUSIC_EXTS, PathError, repoRoot} from './paths.ts';
import {Conflict} from './store.ts';
import type {ServerEvent} from '../shared/types.ts';
import {chatRoutes} from './routes/chats.ts';
import {jobRoutes} from './routes/jobs.ts';
import {libraryRoutes} from './routes/library.ts';
import {projectRoutes} from './routes/projects.ts';
import {settingsRoutes} from './routes/settings.ts';
import {uploadRoutes} from './routes/uploads.ts';
import {HttpError} from './routes/util.ts';
import type {Deps} from './routes/util.ts';
import {voiceRoutes} from './routes/voices.ts';

// Only the file types the UI/Remotion fetch; never dotfiles, JSON, or voices/_uploads.
const STATIC_EXTS: Record<string, readonly string[]> = {
  library: MEDIA_EXTS, music: MUSIC_EXTS, sfx: MUSIC_EXTS, brands: IMAGE_EXTS, projects: ['.mp4', '.png', '.jpg', '.wav'], voices: AUDIO_REF_EXTS,
};

export function createApp(deps: Deps): Hono {
  const app = new Hono();
  app.use('*', hostGuard(deps.ports));
  app.onError((e, c) => {
    if (e instanceof Conflict) return c.json({error: 'conflict', details: {data: e.current, mtime: e.mtime}}, 409);
    if (e instanceof HttpError) return c.json({error: e.message, ...(e.details !== undefined && {details: e.details})}, e.status as 400);
    if (e instanceof PathError) return c.json({error: e.message}, 400);
    if (e instanceof HTTPException) return c.json({error: e.message}, e.status);
    console.error(e.stack ?? e);
    return c.json({error: e.message}, 500);
  });

  const api = new Hono();
  api.get('/health', c => c.json({ok: true, worker: deps.worker.status()}));
  api.get('/events', sseRoute(deps.bus, () => [
    ...deps.jobs.list().filter(j => j.state === 'queued' || j.state === 'running').reverse().map((job): ServerEvent => ({type: 'job', job})),
    {type: 'worker', status: deps.worker.status()},
    {type: 'chatBusy', chatId: deps.chat.busy()},
  ]));
  for (const r of [projectRoutes, libraryRoutes, uploadRoutes, voiceRoutes, settingsRoutes, jobRoutes, chatRoutes]) api.route('/', r(deps));
  app.route('/api', api);

  for (const [dir, exts] of Object.entries(STATIC_EXTS)) {
    app.on(['GET', 'HEAD'], `/${dir}/*`, async (c, next) => {
      let segs: string[];
      try { segs = decodeURIComponent(c.req.path.slice(dir.length + 2)).split(/[\\/]/); } catch { return c.json({error: 'bad path'}, 400); }
      if (segs.some(s => s.startsWith('.') || s === '_uploads') || !exts.includes(path.extname(segs.at(-1)!).toLowerCase())) return c.json({error: 'not found'}, 404);
      await next();
      if (exts.length && path.extname(segs.at(-1)!).toLowerCase() === '.svg') { // inline-safe: <img> still renders, scripts cannot run if opened directly
        c.header('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
        c.header('X-Content-Type-Options', 'nosniff');
      }
    }, serveStatic({root: path.join(repoRoot(), dir), rewriteRequestPath: p => p.replace(new RegExp(`^/${dir}`), '')}));
  }
  return app;
}
