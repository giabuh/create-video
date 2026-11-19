import {link, mkdir, rm, stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Hono} from 'hono';
import type {Context} from 'hono';
import {IMAGE_EXTS, MEDIA_EXTS, MUSIC_EXTS, safeJoin, sanitizeFilename} from '../paths.ts';
import {readJson, writeJsonAtomic} from '../store.ts';
import type {BrandFile} from '../../shared/types.ts';
import {HttpError, slugParam} from './util.ts';

const CUTOUT = new URL('../../../tools/logo_cutout.py', import.meta.url).pathname; // code dir, not the data root

/** Streams the request body into `dir/<name>` (suffix -2, -3... if taken); never overwrites, never leaves a .part. Returns the saved basename. */
export async function saveUpload(c: Context, dir: string, name: string): Promise<string> {
  const body = c.req.raw.body;
  if (!body) throw new HttpError(400, 'empty body');
  await mkdir(dir, {recursive: true});
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  const part = path.join(dir, `${stem}.${randomUUID().slice(0, 8)}.part`);
  try {
    await pipeline(Readable.fromWeb(body as never), createWriteStream(part, {flags: 'wx'}));
    if ((await stat(part)).size === 0) throw new HttpError(400, 'empty body');
    for (let n = 1; ; n++) {
      const final = n === 1 ? name : `${stem}-${n}${ext}`;
      try { await link(part, path.join(dir, final)); return final; } // link fails on EEXIST atomically, so no overwrite race
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    }
  } finally { await rm(part, {force: true}); }
}

export function uploadRoutes(): Hono {
  const app = new Hono();
  app.put('/upload/:filename', async c => {
    const saved = await saveUpload(c, safeJoin('inbox'), sanitizeFilename(c.req.param('filename'), MEDIA_EXTS));
    return c.json({saved});
  });
  app.put('/upload-music/:filename', async c => {
    const saved = await saveUpload(c, safeJoin('music'), sanitizeFilename(c.req.param('filename'), MUSIC_EXTS));
    return c.json({saved});
  });
  app.put('/upload-sfx/:filename', async c => {
    const saved = await saveUpload(c, safeJoin('sfx'), sanitizeFilename(c.req.param('filename'), MUSIC_EXTS));
    return c.json({saved});
  });
  app.put('/upload-logo/:id/:filename', async c => {
    const id = slugParam(c.req.param('id'), 'brand id');
    const file = safeJoin('brands', id, 'brand.json');
    const name = sanitizeFilename(c.req.param('filename'), IMAGE_EXTS);
    await stat(file).catch(() => { throw new HttpError(400, 'unknown brand'); });
    const saved = await saveUpload(c, safeJoin('brands', id), name);
    const logo = saved; // brand.json stores the bare file name; tools/reel/props.py prefixes brands/<id>/
    const cur = await readJson<BrandFile>(file);
    const mtime = await writeJsonAtomic(file, {...cur.data, logo}, cur.mtime);
    return c.json({logo, mtime});
  });
  app.post('/brands/:id/logo-cutout', async c => {
    const id = slugParam(c.req.param('id'), 'brand id');
    const file = safeJoin('brands', id, 'brand.json');
    const cur = await readJson<BrandFile>(file).catch(() => { throw new HttpError(400, 'unknown brand'); });
    if (!cur.data.logo) throw new HttpError(400, 'Brand chưa có logo');
    const out = cur.data.logo.replace(/(-nobg)?\.[^.]+$/, '') + '-nobg.png';
    try { await promisify(execFile)('python3', [CUTOUT, safeJoin('brands', id, cur.data.logo), safeJoin('brands', id, out)]); }
    catch (e) { throw new HttpError(422, (e as {code?: number}).code === 3 ? 'Logo đã có nền trong suốt' : 'Không tách được nền'); }
    return c.json({logo: out, mtime: await writeJsonAtomic(file, {...cur.data, logo: out}, cur.mtime)});
  });
  return app;
}
