import {readdir, rm, stat} from 'node:fs/promises';
import type {JobCtx} from './jobs.ts';
import {driveDelete, DriveError, driveList, driveSizes, driveUpload, freeName, statsText, withRetry} from './drive.ts';
import {SLUG_RE, safeJoin} from './paths.ts';
import {withSlugLock} from './slugLock.ts';
import {readMeta, setPublished, writeMeta} from './versions.ts';

export const PUBLISHED_MSG = 'Bản này đã lên Drive';
export const UPLOADING_MSG = 'Đang tải lên Drive';

type UploadOpts = {unique: boolean; repush?: boolean; part?: {i: number; n: number}};

/** Uploads a render to Drive, verifies it by size and records the outcome in project.json. Returns the final Drive file name.
 *  `repush` overwrites the recorded name of a done record whose Drive copy is missing/wrong; if that fails the done record is restored. */
export async function uploadVersion(slug: string, version: string, name: string, ctx: JobCtx, opts: UploadOpts): Promise<string> {
  const at = () => new Date().toISOString();
  const prev = (await readMeta(slug)).data.published?.[version];
  if (prev?.state === 'done' && !opts.repush) throw new DriveError(PUBLISHED_MSG); // never clobber a done record
  const {part} = opts;
  const label = part ? `Đẩy ${version} (${part.i + 1}/${part.n})` : 'Đẩy lên Drive';
  const step = (p: number | null, text: string) => ctx.progress(p === null || !part ? p : (part.i + p) / part.n, text);
  let final = name;
  try {
    if (!opts.repush) {
      const taken = await driveList();
      if (opts.unique) final = freeName(name, taken);
      else if (taken.includes(name)) throw new DriveError('Tên đã có trên Drive');
    }
    const local = safeJoin('projects', slug, `${version}.mp4`);
    const size = (await stat(local)).size;
    await setPublished(slug, version, {name: final, state: 'uploading', at: at()});
    step(null, label);
    await driveUpload(local, final, (p, s) => step(p, s ? `${label} · ${statsText(s)}` : label), ctx.signal);
    step(null, 'Kiểm tra trên Drive');
    // the file is already up; a stalled/failed listing must not turn that into a 'failed' record, so retry it once
    if ((await withRetry(driveSizes, [5_000], undefined, ctx.signal)).get(final) !== size) throw new DriveError('Đã tải lên nhưng không thấy đúng file trên Drive');
    await setPublished(slug, version, {name: final, state: 'done', at: at()});
    return final;
  } catch (e) {
    await setPublished(slug, version, opts.repush && prev ? prev : {name: final, state: 'failed', error: (e as Error).message, at: at()});
    throw e;
  }
}

/** Removes a render locally (keeps the approved storyboard snapshot). Returns the Drive file name to delete when `drive` is asked and a done record exists. */
export async function deleteRender(slug: string, version: string, opts: {drive: boolean}): Promise<{driveName?: string}> {
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
  return driveName ? {driveName} : {};
}

/** drive-delete job body: removes the Drive copy of a done record (already gone = success) then clears the record. */
export async function runDriveDelete(slug: string, version: string, ctx: JobCtx): Promise<void> {
  const pub = (await readMeta(slug)).data.published?.[version];
  if (pub?.state !== 'done') throw new DriveError('Không có bản đã lên Drive');
  ctx.progress(null, `Xoá ${version} trên Drive`);
  if ((await driveList()).includes(pub.name)) await driveDelete(pub.name);
  await setPublished(slug, version, null);
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
