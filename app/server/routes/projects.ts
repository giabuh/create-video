import {mkdir, readdir, stat, writeFile} from 'node:fs/promises';
import {Hono} from 'hono';
import {driveName} from '../drive.ts';
import {approveCommit} from '../git.ts';
import type {JobCtx, JobQueue} from '../jobs.ts';
import {SLUG_RE, safeJoin, slugify} from '../paths.ts';
import {runPreview} from '../procs.ts';
import {deleteRender, uploadVersion} from '../publish.ts';
import {withSlugLock} from '../slugLock.ts';
import {readJson, readJsonOr, writeJsonAtomic} from '../store.ts';
import {listVersions, projectStatus, readMeta, writeMeta} from '../versions.ts';
import type {Config, Mix, ProjectDetail, ProjectSummary, RenderProps, Storyboard, Timings} from '../../shared/types.ts';
import {bodyOf, HttpError, isObj, mtimeField, needProject, readConfig, slugParam} from './util.ts';
import type {Deps, WorkerLike} from './util.ts';

const isRendering = (jobs: JobQueue, slug: string) => jobs.list().some(j => j.kind === 'render' && j.project === slug && (j.state === 'queued' || j.state === 'running'));

async function summarize(jobs: JobQueue, slug: string, config: Config): Promise<ProjectSummary> {
  const sb = await readJson<Storyboard>(safeJoin('projects', slug, 'storyboard.json'));
  const meta = (await readMeta(slug)).data;
  const versions = await listVersions(slug, meta);
  const timings = (await readJsonOr<Timings | null>(safeJoin('projects', slug, 'timings.json'), null)).data;
  const props = timings ? null : (await readJsonOr<RenderProps | null>(safeJoin('projects', slug, 'render-props.json'), null)).data;
  const first = sb.data.scenes[0];
  return {
    slug, status: projectStatus(versions, meta, isRendering(jobs, slug)), approved: meta.approved, latest: versions[0] ?? null,
    sceneCount: sb.data.scenes.length, totalSeconds: timings?.totalSeconds ?? props?.totalSeconds ?? null, mix: timings?.mix ?? null,
    mtime: sb.mtime, firstCaption: first?.caption ?? first?.say ?? '', voice: sb.data.voice ?? config.defaults.voice,
  };
}

const isBusy = (jobs: JobQueue, slug: string) => jobs.list().some(j => (j.kind === 'render' || j.kind === 'publish') && j.project === slug && (j.state === 'queued' || j.state === 'running'));

const optStr = (v: unknown, what: string): string | undefined => {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !SLUG_RE.test(v)) throw new HttpError(400, `bad ${what}`);
  return v;
};

export function projectRoutes({jobs, worker}: Deps): Hono {
  const app = new Hono();
  app.get('/projects', async c => {
    const config = await readConfig();
    const out: ProjectSummary[] = [];
    for (const d of await readdir(safeJoin('projects'), {withFileTypes: true}).catch(() => [])) {
      if (!d.isDirectory() || !SLUG_RE.test(d.name)) continue;
      try { out.push(await summarize(jobs, d.name, config)); } catch (e) { console.warn(`skip project ${d.name}: ${(e as Error).message}`); }
    }
    return c.json(out.sort((a, b) => b.mtime - a.mtime));
  });

  app.post('/projects', async c => {
    const b = await bodyOf(c);
    if (typeof b.name !== 'string' || !/[\p{L}\p{N}]/u.test(b.name)) throw new HttpError(400, 'bad name');
    const slug = slugify(b.name);
    slugParam(slug, 'name');
    const sb: Storyboard = {scenes: []};
    const template = optStr(b.template, 'template'), brand = optStr(b.brand, 'brand'), voice = optStr(b.voice, 'voice');
    if (template) sb.template = template;
    if (brand) sb.brand = brand;
    if (voice) sb.voice = voice;
    if (b.targetSeconds !== undefined) {
      if (typeof b.targetSeconds !== 'number' || !(b.targetSeconds > 0) || b.targetSeconds > 600) throw new HttpError(400, 'bad targetSeconds');
      sb.targetSeconds = b.targetSeconds;
    }
    const dir = safeJoin('projects', slug);
    await mkdir(safeJoin('projects'), {recursive: true});
    await mkdir(dir).catch(e => { throw (e as NodeJS.ErrnoException).code === 'EEXIST' ? new HttpError(409, 'project exists') : e; });
    await writeFile(safeJoin('projects', slug, 'storyboard.json'), JSON.stringify(sb, null, 2) + '\n', {flag: 'wx'});
    return c.json(await summarize(jobs, slug, await readConfig()), 201);
  });

  app.get('/projects/:slug', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    const f = (n: string) => safeJoin('projects', slug, n);
    const storyboard = await readJson<Storyboard>(f('storyboard.json'));
    const timings = (await readJsonOr<Timings | null>(f('timings.json'), null)).data;
    const renderProps = (await readJsonOr<RenderProps | null>(f('render-props.json'), null)).data;
    const meta = (await readMeta(slug)).data;
    const versions = await listVersions(slug, meta);
    const config = await readConfig();
    const stale = renderProps
      ? storyboard.data.scenes.filter(s => s.say?.trim() && !renderProps.scenes.find(r => r.id === s.id)?.voice).map(s => s.id)
      : [];
    const detail: ProjectDetail = {
      slug, storyboard, timings, renderProps, stale, versions, meta,
      status: projectStatus(versions, meta, isRendering(jobs, slug)), mixTarget: config.mix as Mix,
    };
    return c.json(detail);
  });

  app.put('/projects/:slug/storyboard', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    const b = await bodyOf(c);
    if (!isObj(b.storyboard) || !Array.isArray(b.storyboard.scenes)) throw new HttpError(400, 'storyboard.scenes must be an array');
    return c.json({mtime: await writeJsonAtomic(safeJoin('projects', slug, 'storyboard.json'), b.storyboard, mtimeField(b.baseMtime))});
  });

  app.post('/projects/:slug/preview', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    return c.json(await runPreview(slug));
  });

  app.post('/projects/:slug/voice', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    return c.json(jobs.enqueue({
      kind: 'voice', lane: 'gpu', label: `Tạo giọng ${slug}`, project: slug, cancellable: false,
      run: ctx => withSlugLock(slug, () => prepare(worker, slug, ctx)),
    }), 202);
  });

  app.post('/projects/:slug/render', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    return c.json(jobs.enqueue({
      kind: 'render', lane: 'render', label: `Render ${slug}`, project: slug, cancellable: true,
      run: async ctx => (await import('../render.ts')).renderVersion(slug, ctx, worker as never),
    }), 202);
  });

  const enqueuePublish = (slug: string, version: string, name: string) => jobs.enqueue({
    kind: 'publish', lane: 'io', label: `Đẩy ${version} lên Drive`, project: slug, cancellable: true,
    run: async ctx => { await uploadVersion(slug, version, name, ctx, {unique: false}); },
  });
  const nameOf = (slug: string, version: string, raw: unknown): string => {
    if (raw !== undefined && typeof raw !== 'string') throw new HttpError(400, 'bad name');
    try { return driveName(raw ?? `${slug}-${version}`); } catch { throw new HttpError(400, 'bad name'); }
  };

  app.post('/projects/:slug/approve', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    const b = await bodyOf(c);
    const version = b.version;
    if (typeof version !== 'string' || !/^reel-v\d+$/.test(version)) throw new HttpError(400, 'bad version');
    const name = nameOf(slug, version, b.name);
    const res = await withSlugLock(slug, async () => {
      if (!(await stat(safeJoin('projects', slug, `${version}.mp4`)).catch(() => null))) throw new HttpError(404, 'unknown version');
      const prev = (await readMeta(slug)).data;
      if (prev.renders[version]?.kind === 'draft') throw new HttpError(400, 'Bản nháp cũ không duyệt được');
      const meta = {...prev, approved: version};
      await writeMeta(slug, meta); // approveCommit needs project.json on disk
      try { return {meta, commit: await approveCommit(slug, version)}; } catch (e) { // restore only `approved`; renders may have changed
        const now = (await readMeta(slug)).data;
        await writeMeta(slug, {...now, approved: prev.approved});
        throw e;
      }
    });
    return c.json({...res, job: enqueuePublish(slug, version, name)});
  });

  app.post('/projects/:slug/publish', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    const b = await bodyOf(c);
    if (typeof b.version !== 'string' || !/^reel-v\d+$/.test(b.version)) throw new HttpError(400, 'bad version');
    const name = nameOf(slug, b.version, b.name);
    if ((await readMeta(slug)).data.approved !== b.version) throw new HttpError(409, 'not approved');
    return c.json(enqueuePublish(slug, b.version, name), 202);
  });

  app.delete('/projects/:slug/renders/:version', async c => {
    const slug = c.req.param('slug'), version = c.req.param('version');
    await needProject(slug);
    if (!/^reel-v\d+$/.test(version)) throw new HttpError(400, 'bad version');
    if (!(await stat(safeJoin('projects', slug, `${version}.mp4`)).catch(() => null))) throw new HttpError(404, 'unknown version');
    const meta = (await readMeta(slug)).data;
    if (meta.approved === version && meta.published?.[version]?.state !== 'done') throw new HttpError(409, 'Bản đã duyệt chưa lên Drive');
    if (isBusy(jobs, slug)) throw new HttpError(409, 'Đang render hoặc đẩy lên Drive');
    return c.json(await deleteRender(slug, version, {drive: c.req.query('drive') === '1'}));
  });
  return app;
}

async function prepare(worker: WorkerLike, slug: string, ctx: JobCtx) {
  ctx.progress(null, 'Tạo giọng');
  const r = await worker.request('prepare', {project: slug}, (d, t, l) => ctx.progress(t ? d / t : null, l ? `Tạo giọng ${l}` : 'Tạo giọng'));
  if (!r.ok) throw new Error((r.errors ?? []).join('\n') || 'prepare failed');
  return r;
}
