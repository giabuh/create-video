import type {Job} from '../../shared/types.ts';

export type DriveToast = {title: string; description?: string; tone: 'info' | 'success' | 'error'; to: string};

const DRIVE_KINDS = new Set<Job['kind']>(['publish', 'drive-delete', 'delete-project', 'sync']);
export const isDriveJob = (j: Job): boolean => DRIVE_KINDS.has(j.kind);

/** Toast for a finished publish / drive-delete / delete-project / sync job; null for other kinds or live jobs. */
export function driveToast(job: Job): DriveToast | null {
  if (!isDriveJob(job) || (job.state !== 'done' && job.state !== 'failed' && job.state !== 'cancelled')) return null;
  const slug = job.project ?? '';
  const to = job.kind === 'sync' ? '/library' : job.kind === 'delete-project' || !slug ? '/' : `/p/${encodeURIComponent(slug)}/renders`;
  if (job.state === 'failed') return {title: `${job.label} — thất bại`, description: job.error ?? undefined, tone: 'error', to};
  if (job.state === 'cancelled') return {title: `${job.label} — đã huỷ`, tone: 'info', to};
  const v = job.ref ?? '';
  const title = job.kind === 'publish' ? `Đã đẩy ${v} lên Drive (đã kiểm tra)`
    : job.kind === 'drive-delete' ? `Đã xoá ${v} trên Drive`
    : job.kind === 'delete-project' ? `Đã xoá dự án ${slug}`
    : job.ref === 'pull' ? 'Đã kéo thư viện về máy' : 'Đã đẩy thư viện lên Drive';
  return {title, tone: 'success', to};
}
