import {readdir, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {Hono} from 'hono';
import {MEDIA_EXTS, MUSIC_EXTS, PathError, safeJoin} from '../paths.ts';
import {Conflict, readJson, readJsonOr, writeJsonAtomic} from '../store.ts';
import type {LibraryIndex, LibraryResponse, MusicFile, Storyboard} from '../../shared/types.ts';
import {bodyOf, HttpError, ingestBusy, isObj, mtimeField, plainName} from './util.ts';
import type {Deps} from './util.ts';

const libName = (raw: string): string => {
  const n = plainName(raw);
  if (!MEDIA_EXTS.includes(path.extname(n).toLowerCase())) throw new PathError('not a media file');
  return n;
};
const indexFile = () => safeJoin('library', 'media-index.json');

/** media name -> ["<slug> · <sceneId>"] over every project storyboard */
async function usageMap(): Promise<Record<string, string[]>> {
  const usage: Record<string, string[]> = Object.create(null);
  for (const d of await readdir(safeJoin('projects'), {withFileTypes: true}).catch(() => [])) {
    if (!d.isDirectory()) continue;
    const sb = await readJson<Storyboard>(safeJoin('projects', d.name, 'storyboard.json')).catch(() => null);
    for (const scene of sb?.data.scenes ?? []) for (const m of scene.media ?? []) (usage[m.src] ??= []).push(`${d.name} · ${scene.id}`);
  }
  return {...usage};
}

export function libraryRoutes({jobs}: Deps): Hono {
  const app = new Hono();
  const busy = () => { if (ingestBusy(jobs)) throw new HttpError(423, 'ingest running'); };

  app.get('/music', async c => {
    const dir = safeJoin('music');
    const names = (await readdir(dir).catch(() => [] as string[]))
      .filter(n => !n.startsWith('.') && MUSIC_EXTS.includes(path.extname(n).toLowerCase())).sort();
    const files: MusicFile[] = await Promise.all(names.map(async name => ({name, bytes: (await stat(path.join(dir, name))).size})));
    return c.json(files);
  });

  app.delete('/music/:name', async c => {
    const name = plainName(c.req.param('name'));
    if (!MUSIC_EXTS.includes(path.extname(name).toLowerCase())) throw new HttpError(400, 'not a music file');
    for (const d of await readdir(safeJoin('projects'), {withFileTypes: true}).catch(() => [])) {
      const sb = await readJson<Storyboard>(safeJoin('projects', d.name, 'storyboard.json')).catch(() => null);
      if (sb?.data.music?.file === name) throw new HttpError(409, `Dự án "${d.name}" đang dùng bài nhạc này`);
    }
    await stat(safeJoin('music', name)).catch(() => { throw new HttpError(404, 'unknown music'); });
    await rm(safeJoin('music', name));
    return c.body(null, 204);
  });

  app.get('/sfx', async c => {
    const dir = safeJoin('sfx');
    const names = (await readdir(dir).catch(() => [] as string[]))
      .filter(n => !n.startsWith('.') && MUSIC_EXTS.includes(path.extname(n).toLowerCase())).sort();
    const files: MusicFile[] = await Promise.all(names.map(async name => ({name, bytes: (await stat(path.join(dir, name))).size})));
    return c.json(files);
  });

  app.delete('/sfx/:name', async c => {
    const name = plainName(c.req.param('name'));
    if (!MUSIC_EXTS.includes(path.extname(name).toLowerCase())) throw new HttpError(400, 'not a sound file');
    await stat(safeJoin('sfx', name)).catch(() => { throw new HttpError(404, 'unknown sfx'); });
    await rm(safeJoin('sfx', name));
    return c.body(null, 204);
  });

  app.get('/library', async c => {
    const idx = await readJsonOr<LibraryIndex>(indexFile(), {});
    return c.json({...idx, usage: await usageMap()} satisfies LibraryResponse);
  });

  app.put('/library/:name', async c => {
    busy();
    const name = libName(c.req.param('name'));
    const b = await bodyOf(c);
    if (!isObj(b.entry)) throw new HttpError(400, 'entry must be an object');
    const baseMtime = mtimeField(b.baseMtime);
    const cur = await readJsonOr<LibraryIndex>(indexFile(), {});
    if (cur.mtime !== baseMtime) throw new Conflict(cur.data, cur.mtime);
    if (!Object.hasOwn(cur.data, name)) throw new HttpError(404, 'unknown media');
    return c.json({mtime: await writeJsonAtomic(indexFile(), {...cur.data, [name]: b.entry}, cur.mtime)});
  });

  app.delete('/library/:name', async c => {
    busy();
    const name = libName(c.req.param('name'));
    const used = (await usageMap())[name];
    if (used) throw new HttpError(409, 'in-use', used);
    const idx = await readJsonOr<LibraryIndex>(indexFile(), {});
    const file = safeJoin('library', name);
    const onDisk = await readdir(safeJoin('library')).then(l => l.includes(name), () => false);
    if (!onDisk && !Object.hasOwn(idx.data, name)) throw new HttpError(404, 'unknown media');
    const stem = path.parse(name).name;
    await rm(file, {force: true});
    await rm(safeJoin('library', 'thumbs', `${stem}.jpg`), {force: true});
    if (Object.hasOwn(idx.data, name)) {
      const {[name]: _gone, ...rest} = idx.data;
      await writeJsonAtomic(indexFile(), rest, idx.mtime).catch(async e => { // index changed under us: retry once on fresh data
        if (!(e instanceof Conflict)) throw e;
        const {[name]: _g, ...rest2} = e.current as LibraryIndex;
        await writeJsonAtomic(indexFile(), rest2, e.mtime);
      });
    }
    return c.body(null, 204);
  });
  return app;
}
