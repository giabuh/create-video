import {describe, expect, it} from 'vitest';
import type {DriveStatus, Job, PublishInfo} from '../../../shared/types.ts';
import {deleteMessage, driveRow} from './driveRow.ts';

const done: PublishInfo = {name: 'x', state: 'done', at: ''};
const drive = (versions: DriveStatus['versions'], error: string | null = null): DriveStatus => ({checkedAt: 1, error, versions, orphans: []});
const job = (p: Partial<Job>): Job => ({id: 'a', kind: 'publish', lane: 'io', project: 'p', label: '', ref: 'v', state: 'running', progress: 0.5, step: '', startedAt: 1, endedAt: null, etaSeconds: null, log: [], result: null, error: null, cancellable: true, ...p});

describe('driveRow', () => {
  it('maps every card state', () => {
    expect(driveRow('v', null, undefined, undefined)).toEqual({kind: 'local'});
    expect(driveRow('v', null, job({}), undefined).kind).toBe('uploading');
    expect(driveRow('v', done, job({kind: 'drive-delete'}), undefined).kind).toBe('deleting');
    expect(driveRow('v', done, undefined, undefined).kind).toBe('checking');
    expect(driveRow('v', done, undefined, drive({v: 'ok'}))).toEqual({kind: 'ok', name: 'x', verified: true});
    expect(driveRow('v', done, undefined, drive({v: 'mismatch'})).kind).toBe('bad');
    expect(driveRow('v', done, undefined, drive({v: 'missing'})).kind).toBe('bad');
    expect(driveRow('v', done, undefined, drive({}, 'lỗi'))).toEqual({kind: 'ok', name: 'x', verified: false});
    expect(driveRow('v', {...done, state: 'failed', error: 'e'}, undefined, undefined)).toEqual({kind: 'failed', error: 'e', retry: 'publish'});
    expect(driveRow('v', done, job({kind: 'drive-delete', state: 'failed', error: 'z'}), undefined)).toEqual({kind: 'failed', error: 'z', retry: 'delete'});
  });
  it('words the local-delete toast', () => {
    expect(deleteMessage('v2', false, false)).toBe('Đã xoá v2 trên máy');
    expect(deleteMessage('v2', false, true)).toBe('Đã xoá v2 trên máy · bản trên Drive vẫn giữ');
    expect(deleteMessage('v2', true, true)).toBe('Đã xoá v2 trên máy · đang xoá trên Drive');
  });
});
