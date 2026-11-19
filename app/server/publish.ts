import {readdir, rm} from 'node:fs/promises';
import type {JobCtx} from './jobs.ts';
import {driveDelete, DriveError, driveList, driveUpload, freeName} from './drive.ts';
import {SLUG_RE, safeJoin} from './paths.ts';
import {withSlugLock} from './slugLock.ts';
import {readMeta, setPublished, writeMeta} from './versions.ts';

export const PUBLISHED_MSG = 'Bản này đã lên Drive';
export const UPLOADING_MSG = 'Đang tải lên Drive';

/** Uploads a render to Drive and records the outcome in project.json. Returns the final Drive file name. */
export async function uploadVersion(slug: string, version: string, name: string, ctx: JobCtx, opts: {unique: boolean}): Promise<string> {
  const at = () => new Date().toISOString();
  if ((await readMeta(slug)).data.published?.[version]?.state === 'done') throw new DriveError(PUBLISHED_MSG); // never clobber a done record
  let final = name;
  try {
    const taken = await driveList();
    if (opts.unique) final = freeName(name, taken);
    else if (taken.includes(name)) throw new DriveError('Tên đã có trên Drive');
    await setPublished(slug, version, {name: final, state: 'uploading', at: at()});
    ctx.progress(null, 'Đẩy lên Drive');
    await driveUpload(safeJoin('projects', slug, `${version}.mp4`), final, p => ctx.progress(p, 'Đẩy lên Drive'), ctx.signal);
    await setPublished(slug, version, {name: final, state: 'done', at: at()});
    return final;
  } catch (e) {
    await setPublished(slug, version, {name: final, state: 'failed', error: (e as Error).message, at: at()});
    throw e;
  }
}

/** Removes a render locally (keeps the approved storyboard snapshot); optionally its Drive copy too. */
export async function deleteRender(slug: string, version: string, opts: {drive: boolean}): Promise<{driveError?: string}> {
  const driveName = await withSlugLock(slug, async () => {
    const meta = (await readMeta(slug)).data;
    const pub = meta.published?.[version];
    await rm(safeJoin('projects', slug, `${version}.mp4`), {force: true});
    if (meta.approved !== version) await rm(safeJoin('projects', slug, `${version}.storyboard.json`), {force: true});
    const renders = {...meta.renders};
    delete renders[version];
    await writeMeta(slug, {...meta, renders});
    return opts.drive && pub?.state === 'done' ? pub.name : null;
  });
  if (!driveName) return {};
  try { await driveDelete(driveName); } catch (e) { return {driveError: (e as Error).message}; }
  await setPublished(slug, version, null);
  return {};
}

const INTERRUPTED = 'Bị gián đoạn — hãy thử lại';

/** On server start: an 'uploading' record can only be left by a crash, so flip it to 'failed' to unblock the user. */
export async function resetInterruptedUploads(): Promise<void> {
  for (const d of await readdir(safeJoin('projects'), {withFileTypes: true}).catch(() => [])) {
    if (!d.isDirectory() || !SLUG_RE.test(d.name)) continue;
    await withSlugLock(d.name, async () => {
      const meta = (await readMeta(d.name)).data;
      const at = new Date().toISOString();
      const published = Object.fromEntries(Object.entries(meta.published ?? {}).map(([v, p]) => [v, p.state === 'uploading' ? {...p, state: 'failed' as const, error: INTERRUPTED, at} : p]));
      const deleting = meta.deleting?.state === 'uploading' ? {...meta.deleting, state: 'failed' as const, error: INTERRUPTED} : meta.deleting;
      if (JSON.stringify([published, deleting]) === JSON.stringify([meta.published ?? {}, meta.deleting])) return;
      await writeMeta(d.name, {...meta, ...(meta.published && {published}), ...(deleting && {deleting})});
    }).catch(e => console.warn(`reset uploads ${d.name}: ${(e as Error).message}`));
  }
}
