import {rm} from 'node:fs/promises';
import {driveName, withRetry} from './drive.ts';
import {deleteProjectCommit} from './git.ts';
import type {JobCtx} from './jobs.ts';
import {SLUG_RE, safeJoin} from './paths.ts';
import {uploadVersion} from './publish.ts';
import {withSlugLock} from './slugLock.ts';
import {readMeta, writeMeta} from './versions.ts';

const delay = [10_000, 30_000, 90_000];

/** Uploads the ticked renders to Drive (with retries), then removes projects/<slug>. Nothing is removed unless every upload is done. */
export async function runDeleteProject(slug: string, ctx: JobCtx, sleep?: (ms: number) => Promise<void>): Promise<void> {
  if (!SLUG_RE.test(slug)) throw new Error('bad slug');
  const uploads = (await readMeta(slug)).data.deleting?.uploads ?? [];
  try {
    for (const v of uploads) {
      if ((await readMeta(slug)).data.published?.[v]?.state === 'done') continue;
      await withRetry(() => uploadVersion(slug, v, driveName(`${slug}-${v}`), ctx, {unique: true}), delay, sleep, ctx.signal);
    }
    const published = (await readMeta(slug)).data.published;
    if (uploads.some(v => published?.[v]?.state !== 'done')) throw new Error('Chưa tải lên xong');
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
