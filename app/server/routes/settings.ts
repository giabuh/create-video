import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Hono} from 'hono';
import {repoRoot, safeJoin, slugify, SLUG_RE} from '../paths.ts';
import {readJson, writeJsonAtomic} from '../store.ts';
import type {BrandFile, BrandSummary} from '../../shared/types.ts';
import {DEFAULT_ACCENT2, DEFAULT_SURFACE} from '../../shared/brandDefaults.ts';
import {bodyOf, HttpError, isObj, mtimeField, readConfigV, slugParam} from './util.ts';
import type {Deps} from './util.ts';

const configFile = () => path.join(repoRoot(), 'config.json');
const brandFile = (id: string) => safeJoin('brands', id, 'brand.json');
const COLORS = ['primary', 'accent', 'text', 'background']; // required; accent2 and surface are optional but must be strings when present
const OPTIONAL_COLORS = ['accent2', 'surface'];

async function brandSummary(id: string, defaultId: string): Promise<BrandSummary> {
  const v = await readJson<BrandFile>(brandFile(id));
  return {id, brand: v.data, isDefault: id === defaultId, mtime: v.mtime};
}

export function settingsRoutes(_deps: Deps): Hono {
  const app = new Hono();
  app.get('/config', async c => c.json(await readConfigV()));
  app.put('/config', async c => {
    const b = await bodyOf(c);
    if (!isObj(b.config) || !isObj(b.config.defaults) || !isObj(b.config.voices)) throw new HttpError(400, 'config must have defaults and voices');
    return c.json({mtime: await writeJsonAtomic(configFile(), b.config, mtimeField(b.baseMtime))});
  });

  app.get('/brands', async c => {
    const defaultId = (await readConfigV()).data.defaults.brand;
    const out: BrandSummary[] = [];
    for (const d of await readdir(safeJoin('brands'), {withFileTypes: true}).catch(() => [])) {
      if (!d.isDirectory() || !SLUG_RE.test(d.name)) continue;
      try { out.push(await brandSummary(d.name, defaultId)); } catch { /* dir without a valid brand.json */ }
    }
    return c.json(out.sort((a, b) => a.id.localeCompare(b.id)));
  });

  app.put('/brands/:id', async c => {
    const id = slugParam(c.req.param('id'), 'brand id');
    const b = await bodyOf(c);
    const brand = b.brand;
    if (!isObj(brand) || typeof brand.name !== 'string' || !isObj(brand.colors) || !COLORS.every(k => typeof (brand.colors as Record<string, unknown>)[k] === 'string') || !OPTIONAL_COLORS.every(k => (brand.colors as Record<string, unknown>)[k] === undefined || typeof (brand.colors as Record<string, unknown>)[k] === 'string')) throw new HttpError(400, 'bad brand');
    const baseMtime = mtimeField(b.baseMtime);
    await readFile(brandFile(id)).catch(() => { throw new HttpError(404, 'brand not found'); });
    return c.json({mtime: await writeJsonAtomic(brandFile(id), brand, baseMtime)});
  });

  app.post('/brands', async c => {
    const b = await bodyOf(c);
    if (typeof b.name !== 'string' || !/[\p{L}\p{N}]/u.test(b.name)) throw new HttpError(400, 'bad name');
    const id = slugParam(slugify(b.name), 'name');
    const {data: config} = await readConfigV();
    const base = await readJson<BrandFile>(brandFile(config.defaults.brand)).then(v => v.data.colors, () => ({primary: '#1E3A8A', accent: '#FFD400', text: '#FFFFFF', background: '#0B1530', accent2: DEFAULT_ACCENT2, surface: DEFAULT_SURFACE}));
    await mkdir(safeJoin('brands'), {recursive: true});
    await mkdir(safeJoin('brands', id)).catch(e => { throw (e as NodeJS.ErrnoException).code === 'EEXIST' ? new HttpError(409, 'brand exists') : e; });
    const brand: BrandFile = {name: b.name.trim(), logo: null, colors: base, cta: {}};
    await writeFile(brandFile(id), JSON.stringify(brand, null, 2) + '\n', {flag: 'wx'});
    return c.json(await brandSummary(id, config.defaults.brand), 201);
  });

  app.delete('/brands/:id', async c => {
    const id = slugParam(c.req.param('id'), 'brand id');
    if ((await readConfigV()).data.defaults.brand === id) throw new HttpError(409, 'Không xoá được brand mặc định');
    for (const d of await readdir(safeJoin('projects'), {withFileTypes: true}).catch(() => [])) {
      const sb = await readJson<{brand?: string}>(safeJoin('projects', d.name, 'storyboard.json')).catch(() => null);
      if (sb?.data.brand === id) throw new HttpError(409, `Dự án "${d.name}" đang dùng brand này`);
    }
    await readFile(brandFile(id)).catch(() => { throw new HttpError(404, 'brand not found'); });
    await rm(safeJoin('brands', id), {recursive: true});
    return c.json({ok: true});
  });

  app.get('/templates', async c => {
    const dirs = await readdir(path.join(repoRoot(), 'studio/src/templates'), {withFileTypes: true}).catch(() => []);
    return c.json(dirs.filter(d => d.isDirectory()).map(d => d.name).sort());
  });

  app.get('/motion', async c => { // one component per studio/src/motion/<Name>.tsx (the app's forms read the registry itself)
    const files = await readdir(path.join(repoRoot(), 'studio/src/motion')).catch(() => [] as string[]);
    return c.json(files.filter(f => /^[A-Z][A-Za-z0-9]*\.tsx$/.test(f)).map(f => f.slice(0, -4)).sort());
  });
  return app;
}
