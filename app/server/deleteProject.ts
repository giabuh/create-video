import {rm, stat} from 'node:fs/promises';
import {driveName, driveSizes, DriveError, withRetry} from './drive.ts';
import {deleteProjectCommit} from './git.ts';
import type {JobCtx} from './jobs.ts';
import {SLUG_RE, safeJoin} from './paths.ts';
import {uploadVersion} from './publish.ts';
import {withSlugLock} from './slugLock.ts';
import {readMeta, writeMeta} from './versions.ts';

const delay = [10_000, 30_000, 90_000];

/** Uploads the ticked renders to Drive (with retries), then removes projects/<slug>.
 *  Nothing is removed unless one final Drive listing shows every needed render present with the local size. */
export async function runDeleteProject(slug: string, ctx: JobCtx, sleep?: (ms: number) => Promise<void>): Promise<void> {
  if (!SLUG_RE.test(slug)) throw new Error('bad slug');
  const uploads = (await readMeta(slug)).data.deleting?.uploads ?? [];
  const onRetry = (e: Error, k: number, ms: number) => ctx.progress(null, `Lỗi: ${e.message} — thử lại sau ${Math.round(ms / 1000)} giây (lần ${k}/${delay.length})`);
  const upload = (v: string, i: number, n: number, repush: boolean) => withRetry(async () => {
    const rec = (await readMeta(slug)).data.published?.[v];
    await uploadVersion(slug, v, repush && rec ? rec.name : driveName(`${slug}-${v}`), ctx, {unique: !repush, repush, part: {i, n}});
  }, delay, sleep, ctx.signal, onRetry);
  try {
    for (const [i, v] of uploads.entries()) {
      if ((await readMeta(slug)).data.published?.[v]?.state === 'done') continue;
      await upload(v, i, uploads.length, false);
    }
    // versions that must be on Drive: ticked ones + done records whose local mp4 still exists
    const sizeOf = (v: string) => stat(safeJoin('projects', slug, `${v}.mp4`)).then(s => s.size, () => null);
    const bad = async (): Promise<string[]> => {
      ctx.progress(null, 'Kiểm tra trên Drive');
      const sizes = await driveSizes();
      const published = (await readMeta(slug)).data.published ?? {};
      const need = new Set([...uploads, ...Object.keys(published).filter(v => published[v].state === 'done')]);
      const out: string[] = [];
      for (const v of need) {
        const local = await sizeOf(v);
        if (local === null && !uploads.includes(v)) continue; // done record, no local file: nothing to lose
        const rec = published[v];
        if (rec?.state !== 'done' || sizes.get(rec.name) !== local) out.push(v);
      }
      return out;
    };
    let missing = await bad();
    if (missing.length) {
      for (const v of missing) {
        const rec = (await readMeta(slug)).data.published?.[v];
        if (rec?.state === 'done') await upload(v, missing.indexOf(v), missing.length, true);
        else await upload(v, missing.indexOf(v), missing.length, false);
      }
      missing = await bad();
    }
    if (missing.length) throw new DriveError(`Không thấy đúng file trên Drive: ${missing.join(', ')}`);
    ctx.progress(null, 'Xoá thư mục dự án');
    await deleteProjectCommit(slug);
    await rm(safeJoin('projects', slug), {recursive: true, force: true});
  } catch (e) {
    await withSlugLock(slug, async () => {
      const meta = (await readMeta(slug)).data;
      if (meta.deleting) await writeMeta(slug, {...meta, deleting: {...meta.deleting, state: 'failed', error: (e as Error).message}});
    });
    throw e;
  }
}
