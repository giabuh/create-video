import {Hono} from 'hono';
import {SLUG_RE} from '../paths.ts';
import {UUID_RE} from '../chat/service.ts';
import {bodyOf, HttpError} from './util.ts';
import type {Deps} from './util.ts';

const MAX_TEXT = 20_000;
const SCREEN_RE = /^\/[\w\-./]{0,199}$/;
const slugOf = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v !== 'string' || !SLUG_RE.test(v)) throw new HttpError(400, 'bad slug');
  return v;
};
const idOf = (id: string): string => { if (!UUID_RE.test(id)) throw new HttpError(404, 'chat not found'); return id; };

export function chatRoutes({chat}: Deps): Hono {
  const app = new Hono();
  app.get('/chat/accounts', async c => c.json(await chat.accounts()));
  app.get('/chats', async c => c.json(await chat.list()));
  app.post('/chats', async c => {
    const b = await bodyOf(c);
    const engine = b.engine ?? 'claude';
    if (engine !== 'claude' && engine !== 'codex') throw new HttpError(400, 'engine must be claude or codex');
    return c.json(await chat.create(slugOf(b.slug), engine), 201);
  });
  app.get('/chats/:id', async c => {
    const d = await chat.get(idOf(c.req.param('id')));
    if (!d) throw new HttpError(404, 'chat not found');
    return c.json(d);
  });
  app.post('/chats/:id/messages', async c => {
    const id = idOf(c.req.param('id'));
    const b = await bodyOf(c);
    if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > MAX_TEXT) throw new HttpError(400, 'text must be 1–20000 characters');
    if (typeof b.account !== 'string') throw new HttpError(400, 'account must be a string');
    const screen = typeof b.screen === 'string' && SCREEN_RE.test(b.screen) ? b.screen : '/'; // path-like only: it goes into the system prompt
    await chat.send(id, {text: b.text, account: b.account, screen, slug: slugOf(b.slug)});
    return c.body(null, 202);
  });
  app.post('/chats/:id/stop', c => {
    if (!chat.stop(idOf(c.req.param('id')))) throw new HttpError(409, 'chat is not running');
    return c.body(null, 204);
  });
  return app;
}
