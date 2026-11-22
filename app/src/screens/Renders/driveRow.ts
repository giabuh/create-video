import type {DriveStatus, Job, PublishInfo} from '../../../shared/types.ts';
import {isLive} from '../../api/events.ts';

export type DriveRow =
  | {kind: 'local'}
  | {kind: 'uploading'; job?: Job}
  | {kind: 'deleting'; job: Job}
  | {kind: 'checking'; name: string}
  | {kind: 'ok'; name: string; verified: boolean}
  | {kind: 'bad'; name: string}
  | {kind: 'failed'; error: string; retry: 'publish' | 'delete'};

/** `job` = newest publish / drive-delete job of this version (matched by `job.ref`). */
export function driveRow(version: string, p: PublishInfo | null, job: Job | undefined, drive: DriveStatus | undefined): DriveRow {
  if (job && isLive(job)) return job.kind === 'drive-delete' ? {kind: 'deleting', job} : {kind: 'uploading', job};
  if (job?.kind === 'drive-delete' && job.state === 'failed') return {kind: 'failed', error: job.error ?? 'Lỗi không rõ', retry: 'delete'};
  if (!p) return {kind: 'local'};
  if (p.state === 'uploading') return {kind: 'uploading'};
  if (p.state === 'failed') return {kind: 'failed', error: p.error ?? 'Lỗi không rõ', retry: 'publish'};
  if (!drive) return {kind: 'checking', name: p.name};
  const st = drive.versions[version];
  if (st === 'missing' || st === 'mismatch') return {kind: 'bad', name: p.name};
  return {kind: 'ok', name: p.name, verified: st === 'ok'}; // no entry (e.g. Drive check failed) = unverified
}

/** Toast text after a local delete: says exactly what happened to the Drive copy. */
export const deleteMessage = (name: string, driveDeleting: boolean, onDrive: boolean): string =>
  `Đã xoá ${name} trên máy` + (driveDeleting ? ' · đang xoá trên Drive' : onDrive ? ' · bản trên Drive vẫn giữ' : '');
