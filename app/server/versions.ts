import {readdir, stat} from 'node:fs/promises';
import {withSlugLock} from './slugLock.ts';
import {readJsonOr, writeJsonAtomic} from './store.ts';
import {safeJoin} from './paths.ts';
import type {ProjectMeta, ProjectStatus, PublishInfo, VersionInfo, Versioned} from '../shared/types.ts';

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
      kind: meta.renders[name]?.kind ?? null, hasSnapshot: set.has(`${name}.storyboard.json`), approved: meta.approved === name, published: meta.published?.[name] ?? null,
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

export async function nextVersion(slug: string): Promise<{n: number; name: string}> {
  let max = 0;
  const meta = (await readMeta(slug)).data;
  for (const f of await ls(dirOf(slug))) {
    const m = /^reel-v(\d+)\.(?:mp4|tmp\.mp4|storyboard\.json)$/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  for (const k of [...Object.keys(meta.published ?? {}), ...Object.keys(meta.renders)]) { // numbers kept on Drive/record after local delete
    const m = /^reel-v(\d+)$/.exec(k);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return {n: max + 1, name: `reel-v${max + 1}`};
}

// a partial project.json (e.g. `{}`) gets the defaults, so the project still lists
export const readMeta = async (slug: string): Promise<Versioned<ProjectMeta>> => {
  const v = await readJsonOr<Partial<ProjectMeta>>(metaFile(slug), {});
  return {...v, data: {approved: null, ...v.data, renders: v.data.renders ?? {}}};
};
export const writeMeta = (slug: string, meta: ProjectMeta): Promise<number> => writeJsonAtomic(metaFile(slug), meta);

export function projectStatus(versions: VersionInfo[], meta: ProjectMeta, renderingNow: boolean): ProjectStatus {
  if (renderingNow) return 'rendering';
  if (meta.approved) return 'approved';
  return versions.length ? 'draft' : 'new';
}

/** Records a finished render in project.json under the slug lock so it cannot interleave with approve.
 *  Every render is full quality ('final'); 'draft' only survives as a legacy kind on old renders. */
export const recordRender = (slug: string, name: string): Promise<number> => withSlugLock(slug, async () => {
  const meta = (await readMeta(slug)).data;
  meta.renders[name] = {kind: 'final', at: new Date().toISOString()};
  return writeMeta(slug, meta);
});

export const setPublished = (slug: string, version: string, info: PublishInfo | null): Promise<void> => withSlugLock(slug, async () => {
  const meta = (await readMeta(slug)).data;
  const published = {...meta.published};
  if (info) published[version] = info; else delete published[version];
  await writeMeta(slug, {...meta, published});
});
