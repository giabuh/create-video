import {readFile, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {Hono} from 'hono';
import {SLUG_RE} from '../paths.ts';
import {UUID_RE} from '../chat/service.ts';
import {IMAGE_NAME_RE, IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, imageDir, imagePath, newImageName} from '../chat/images.ts';
import {saveUpload} from './uploads.ts';
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
  app.get('/chat/models', async c => c.json(await chat.models()));
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
  app.put('/chats/:id/images/:filename', async c => {
    const id = idOf(c.req.param('id'));
    if (!await chat.get(id)) throw new HttpError(404, 'chat not found');
    const ext = path.extname(c.req.param('filename')).toLowerCase();
    if (!IMAGE_TYPES[ext]) throw new HttpError(400, 'chỉ nhận ảnh png, jpg, webp, gif');
    if (Number(c.req.header('content-length')) > MAX_IMAGE_BYTES) throw new HttpError(413, 'ảnh quá 10 MB');
    const dir = imageDir(id);
    const name = await saveUpload(c, dir, newImageName(ext));
    if ((await stat(path.join(dir, name))).size > MAX_IMAGE_BYTES) { await rm(path.join(dir, name), {force: true}); throw new HttpError(413, 'ảnh quá 10 MB'); }
    return c.json({name}, 201);
  });
  app.get('/chats/:id/images/:name', async c => {
    const id = idOf(c.req.param('id')), name = c.req.param('name');
    if (!IMAGE_NAME_RE.test(name)) throw new HttpError(404, 'image not found');
    const buf = await readFile(imagePath(id, name)).catch(() => { throw new HttpError(404, 'image not found'); });
    c.header('Content-Type', IMAGE_TYPES[path.extname(name)]);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    return c.body(buf);
  });
  app.post('/chats/:id/messages', async c => {
    const id = idOf(c.req.param('id'));
    const b = await bodyOf(c);
    const images = b.images ?? [];
    if (!Array.isArray(images) || images.length > MAX_IMAGES || !images.every(n => typeof n === 'string' && IMAGE_NAME_RE.test(n))) throw new HttpError(400, 'images must be up to 4 uploaded image names');
    if (typeof b.text !== 'string' || b.text.length > MAX_TEXT || (!b.text.trim() && !images.length)) throw new HttpError(400, 'text must be 1–20000 characters');
    if (typeof b.account !== 'string') throw new HttpError(400, 'account must be a string');
    const opt = (v: unknown, k: string) => { if (v != null && typeof v !== 'string') throw new HttpError(400, `${k} must be a string`); return v ?? undefined; }; // checked against the engine's list in send
    const screen = typeof b.screen === 'string' && SCREEN_RE.test(b.screen) ? b.screen : '/'; // path-like only: it goes into the system prompt
    await chat.send(id, {text: b.text, account: b.account, model: opt(b.model, 'model'), effort: opt(b.effort, 'effort'), screen, slug: slugOf(b.slug), images});
    return c.body(null, 202);
  });
  app.post('/chats/:id/stop', c => {
    if (!chat.stop(idOf(c.req.param('id')))) throw new HttpError(409, 'chat is not running');
    return c.body(null, 204);
  });
  return app;
}
