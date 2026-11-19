import {rm} from 'node:fs/promises';
import type {JobCtx} from './jobs.ts';
import {driveDelete, DriveError, driveList, driveUpload, freeName, withRetry} from './drive.ts';
import {safeJoin} from './paths.ts';
import {withSlugLock} from './slugLock.ts';
import {readMeta, setPublished, writeMeta} from './versions.ts';

/** Uploads a render to Drive and records the outcome in project.json. Returns the final Drive file name. */
export async function uploadVersion(slug: string, version: string, name: string, ctx: JobCtx, opts: {unique: boolean}): Promise<string> {
  const at = () => new Date().toISOString();
  let final = name;
  try {
    const taken = await driveList();
    if (opts.unique) final = freeName(name, taken);
    else if (taken.includes(name)) throw new DriveError('Tên đã có trên Drive');
    await setPublished(slug, version, {name: final, state: 'uploading', at: at()});
    ctx.progress(null, 'Đẩy lên Drive');
    await withRetry(() => driveUpload(safeJoin('projects', slug, `${version}.mp4`), final, p => ctx.progress(p, 'Đẩy lên Drive'), ctx.signal), [2000, 5000], undefined, ctx.signal);
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
