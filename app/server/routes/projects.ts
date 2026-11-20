import {mkdir, readdir, stat, writeFile} from 'node:fs/promises';
import {Hono} from 'hono';
import {driveName, driveSizes} from '../drive.ts';
import {runDeleteProject} from '../deleteProject.ts';
import {approveCommit} from '../git.ts';
import type {JobCtx, JobQueue} from '../jobs.ts';
import {SLUG_RE, safeJoin, slugify} from '../paths.ts';
import {runPreview} from '../procs.ts';
import {deleteRender, PUBLISHED_MSG, runDriveDelete, UPLOADING_MSG, uploadVersion} from '../publish.ts';
import {withSlugLock} from '../slugLock.ts';
import {readJson, readJsonOr, writeJsonAtomic} from '../store.ts';
import {listVersions, projectStatus, readMeta, writeMeta} from '../versions.ts';
import type {Config, DriveStatus, Mix, ProjectDetail, ProjectSummary, RenderProps, Storyboard, Timings} from '../../shared/types.ts';
import {bodyOf, HttpError, isObj, mtimeField, needEditable, needProject, readConfig, slugParam} from './util.ts';
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
    slug, status: meta.deleting ? 'deleting' : projectStatus(versions, meta, isRendering(jobs, slug)), approved: meta.approved, latest: versions[0] ?? null,
    sceneCount: sb.data.scenes.length, totalSeconds: timings?.totalSeconds ?? props?.totalSeconds ?? null, mix: timings?.mix ?? null,
    mtime: sb.mtime, firstCaption: first?.caption ?? first?.say ?? '', voice: sb.data.voice ?? config.defaults.voice, deleting: meta.deleting ?? null,
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
    await needEditable(slug);
    const b = await bodyOf(c);
    if (!isObj(b.storyboard) || !Array.isArray(b.storyboard.scenes)) throw new HttpError(400, 'storyboard.scenes must be an array');
    return c.json({mtime: await writeJsonAtomic(safeJoin('projects', slug, 'storyboard.json'), b.storyboard, mtimeField(b.baseMtime))});
  });

  app.post('/projects/:slug/preview', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    await needEditable(slug);
    return c.json(await runPreview(slug));
  });

  app.post('/projects/:slug/voice', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    await needEditable(slug);
    return c.json(jobs.enqueue({
      kind: 'voice', lane: 'gpu', label: `Tạo giọng ${slug}`, project: slug, cancellable: false,
      run: ctx => withSlugLock(slug, () => prepare(worker, slug, ctx)),
    }), 202);
  });

  app.post('/projects/:slug/render', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    await needEditable(slug);
    return c.json(jobs.enqueue({
      kind: 'render', lane: 'render', label: `Render ${slug}`, project: slug, cancellable: true,
      run: async ctx => (await import('../render.ts')).renderVersion(slug, ctx, worker as never),
    }), 202);
  });

  const enqueuePublish = (slug: string, version: string, name: string, repush = false) => jobs.enqueue({
    kind: 'publish', lane: 'io', label: `Đẩy ${version} lên Drive`, project: slug, ref: version, cancellable: true,
    run: async ctx => { await uploadVersion(slug, version, name, ctx, {unique: false, repush}); },
  });
  const enqueueDriveDelete = (slug: string, version: string) => jobs.enqueue({
    kind: 'drive-delete', lane: 'io', label: `Xoá ${version} trên Drive`, project: slug, ref: version, cancellable: false,
    run: async ctx => { await runDriveDelete(slug, version, ctx); },
  });
  const driveBusy = (slug: string, version: string) => jobs.list().some(j => (j.kind === 'publish' || j.kind === 'drive-delete') && j.project === slug && j.ref === version && (j.state === 'queued' || j.state === 'running'));
  const needNotPublished = (meta: {published?: Record<string, {state: string}>}, version: string) => {
    const st = meta.published?.[version]?.state;
    if (st === 'done') throw new HttpError(409, PUBLISHED_MSG);
    if (st === 'uploading') throw new HttpError(409, UPLOADING_MSG);
  };
  const nameOf = (slug: string, version: string, raw: unknown): string => {
    if (raw !== undefined && typeof raw !== 'string') throw new HttpError(400, 'bad name');
    try { return driveName(raw ?? `${slug}-${version}`); } catch { throw new HttpError(400, 'bad name'); }
  };

  app.post('/projects/:slug/approve', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    await needEditable(slug);
    const b = await bodyOf(c);
    const version = b.version;
    if (typeof version !== 'string' || !/^reel-v\d+$/.test(version)) throw new HttpError(400, 'bad version');
    const name = nameOf(slug, version, b.name);
    const res = await withSlugLock(slug, async () => {
      if (!(await stat(safeJoin('projects', slug, `${version}.mp4`)).catch(() => null))) throw new HttpError(404, 'unknown version');
      const prev = (await readMeta(slug)).data;
      needNotPublished(prev, version);
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
    await needEditable(slug);
    const b = await bodyOf(c);
    if (typeof b.version !== 'string' || !/^reel-v\d+$/.test(b.version)) throw new HttpError(400, 'bad version');
    const name = nameOf(slug, b.version, b.name);
    const meta = (await readMeta(slug)).data;
    if (meta.approved !== b.version) throw new HttpError(409, 'not approved');
    if (driveBusy(slug, b.version)) throw new HttpError(409, UPLOADING_MSG);
    const rec = meta.published?.[b.version];
    if (rec?.state !== 'done') {
      needNotPublished(meta, b.version);
      return c.json(enqueuePublish(slug, b.version, name), 202);
    }
    // done record: only re-push when Drive no longer has the right file
    const local = await stat(safeJoin('projects', slug, `${b.version}.mp4`)).catch(() => null);
    if (!local) throw new HttpError(404, 'unknown version');
    const sizes = await driveSizes().catch(e => { throw new HttpError(502, (e as Error).message); });
    if (sizes.get(rec.name) === local.size) throw new HttpError(409, PUBLISHED_MSG);
    return c.json(enqueuePublish(slug, b.version, rec.name, true), 202);
  });

  app.delete('/projects/:slug/renders/:version', async c => {
    const slug = c.req.param('slug'), version = c.req.param('version');
    await needProject(slug);
    await needEditable(slug);
    if (!/^reel-v\d+$/.test(version)) throw new HttpError(400, 'bad version');
    if (!(await stat(safeJoin('projects', slug, `${version}.mp4`)).catch(() => null))) throw new HttpError(404, 'unknown version');
    const meta = (await readMeta(slug)).data;
    if (meta.approved === version && meta.published?.[version]?.state !== 'done') throw new HttpError(409, 'Bản đã duyệt chưa lên Drive');
    if (isBusy(jobs, slug)) throw new HttpError(409, 'Đang render hoặc đẩy lên Drive');
    const {driveName: onDrive} = await deleteRender(slug, version, {drive: c.req.query('drive') === '1'});
    return c.json(onDrive && !driveBusy(slug, version) ? {driveJob: enqueueDriveDelete(slug, version)} : {}); // a queued drive-delete already covers it
  });

  app.post('/projects/:slug/drive-delete', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    await needEditable(slug);
    const b = await bodyOf(c);
    if (typeof b.version !== 'string' || !/^reel-v\d+$/.test(b.version)) throw new HttpError(400, 'bad version');
    if ((await readMeta(slug)).data.published?.[b.version]?.state !== 'done') throw new HttpError(404, 'Không có bản đã lên Drive');
    if (driveBusy(slug, b.version)) throw new HttpError(409, UPLOADING_MSG);
    return c.json(enqueueDriveDelete(slug, b.version), 202);
  });

  app.get('/projects/:slug/drive', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    const published = (await readMeta(slug)).data.published ?? {};
    const out: DriveStatus = {checkedAt: Date.now(), error: null, versions: {}, orphans: []};
    let sizes: Map<string, number>;
    try { sizes = await driveSizes(); } catch (e) { return c.json({...out, error: (e as Error).message}); }
    for (const [v, rec] of Object.entries(published)) {
      if (rec.state !== 'done') continue;
      const local = await stat(safeJoin('projects', slug, `${v}.mp4`)).catch(() => null);
      const size = sizes.get(rec.name);
      out.versions[v] = size === undefined ? 'missing' : local && local.size !== size ? 'mismatch' : 'ok';
      if (!local) out.orphans.push({version: v, name: rec.name, at: rec.at, onDrive: size !== undefined});
    }
    return c.json(out);
  });

  const hasJob = (slug: string) => jobs.list().some(j => j.project === slug && (j.state === 'queued' || j.state === 'running'));

  app.delete('/projects/:slug', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    const b = await c.req.json().catch(() => ({}));
    if (hasJob(slug)) throw new HttpError(409, 'Dự án đang có tác vụ chạy');
    const meta = (await readMeta(slug)).data;
    let uploads: string[] = isObj(b) && b.upload !== undefined ? (b.upload as string[]) : meta.deleting?.uploads ?? [];
    if (!Array.isArray(uploads) || uploads.some(v => typeof v !== 'string' || !/^reel-v\d+$/.test(v))) throw new HttpError(400, 'bad upload');
    uploads = [...new Set(uploads)];
    for (const v of uploads) if (!(await stat(safeJoin('projects', slug, `${v}.mp4`)).catch(() => null))) throw new HttpError(400, 'bad upload');
    await withSlugLock(slug, async () => {
      const cur = (await readMeta(slug)).data;
      await writeMeta(slug, {...cur, deleting: {uploads, state: 'uploading'}});
    });
    return c.json(jobs.enqueue({
      kind: 'delete-project', lane: 'io', label: `Xoá dự án ${slug}`, project: slug, cancellable: false,
      run: async ctx => { await runDeleteProject(slug, ctx); },
    }), 202);
  });

  app.post('/projects/:slug/delete-cancel', async c => {
    const slug = c.req.param('slug');
    await needProject(slug);
    if (jobs.list().some(j => j.kind === 'delete-project' && j.project === slug && (j.state === 'queued' || j.state === 'running'))) throw new HttpError(409, 'Đang xoá dự án');
    await withSlugLock(slug, async () => {
      const {deleting: _d, ...rest} = (await readMeta(slug)).data;
      await writeMeta(slug, rest);
    });
    return c.json({ok: true});
  });
  return app;
}

async function prepare(worker: WorkerLike, slug: string, ctx: JobCtx) {
  ctx.progress(null, 'Tạo giọng');
  const r = await worker.request('prepare', {project: slug}, (d, t, l) => ctx.progress(t ? d / t : null, l ? `Tạo giọng ${l}` : 'Tạo giọng'));
  if (!r.ok) throw new Error((r.errors ?? []).join('\n') || 'prepare failed');
  return r;
}
