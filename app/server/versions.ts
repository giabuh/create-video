import {readdir, rm, stat} from 'node:fs/promises';
import {withSlugLock} from './slugLock.ts';
import {readJsonOr, writeJsonAtomic} from './store.ts';
import {safeJoin} from './paths.ts';
import type {ProjectMeta, ProjectStatus, VersionInfo, Versioned} from '../shared/types.ts';

const dirOf = (slug: string) => safeJoin('projects', slug);
const metaFile = (slug: string) => safeJoin('projects', slug, 'project.json');
const ls = (dir: string) => readdir(dir).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return [] as string[]; throw e; });

export async function listVersions(slug: string, meta: ProjectMeta): Promise<VersionInfo[]> {
  const files = await ls(dirOf(slug));
  const set = new Set(files);
  const out: VersionInfo[] = [];
  for (const f of files) {
    const m = /^reel-v(\d+)\.mp4$/.exec(f);
    if (!m) continue;
    const name = `reel-v${m[1]}`;
    const st = await stat(safeJoin('projects', slug, f)).catch(() => null);
    if (!st) continue;
    out.push({
      name, n: Number(m[1]), file: `projects/${slug}/${f}`, bytes: st.size, mtime: Math.floor(st.mtimeMs),
      kind: meta.renders[name]?.kind ?? null, hasSnapshot: set.has(`${name}.storyboard.json`), approved: meta.approved === name,
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

export async function nextVersion(slug: string): Promise<{n: number; name: string}> {
  let max = 0;
  for (const f of await ls(dirOf(slug))) {
    const m = /^reel-v(\d+)\.(?:mp4|tmp\.mp4|storyboard\.json)$/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return {n: max + 1, name: `reel-v${max + 1}`};
}

export const readMeta = (slug: string): Promise<Versioned<ProjectMeta>> => readJsonOr<ProjectMeta>(metaFile(slug), {approved: null, renders: {}});
export const writeMeta = (slug: string, meta: ProjectMeta): Promise<number> => writeJsonAtomic(metaFile(slug), meta);

export function projectStatus(versions: VersionInfo[], meta: ProjectMeta, renderingNow: boolean): ProjectStatus {
  if (renderingNow) return 'rendering';
  if (meta.approved) return 'approved';
  return versions.length ? 'draft' : 'new';
}

/** Records a finished render in project.json under the slug lock so it cannot interleave with approve.
 *  A new draft replaces older drafts (mp4 + snapshot + meta); finals and the approved version are kept. */
export const recordRender = (slug: string, name: string, kind: 'draft' | 'final'): Promise<number> => withSlugLock(slug, async () => {
  const meta = (await readMeta(slug)).data;
  meta.renders[name] = {kind, at: new Date().toISOString()};
  if (kind === 'draft') {
    for (const [old, r] of Object.entries(meta.renders)) {
      if (old === name || r.kind !== 'draft' || meta.approved === old) continue;
      await Promise.all([`${old}.mp4`, `${old}.storyboard.json`].map(f => rm(safeJoin('projects', slug, f), {force: true})));
      delete meta.renders[old];
    }
  }
  return writeMeta(slug, meta);
});
