import {describe, expect, it} from 'vitest';
import type {Job} from '../../shared/types.ts';
import {driveToast} from './driveToasts.ts';

const job = (p: Partial<Job>): Job => ({id: 'a', kind: 'publish', lane: 'io', project: 'p1', label: 'Đẩy reel-v3', ref: 'reel-v3', state: 'done', progress: null, step: '', startedAt: 1, endedAt: 2, etaSeconds: null, log: [], result: null, error: null, cancellable: false, ...p});

describe('driveToast', () => {
  it('builds success messages per kind', () => {
    expect(driveToast(job({}))).toMatchObject({title: 'Đã đẩy reel-v3 lên Drive (đã kiểm tra)', tone: 'success', to: '/p/p1/renders'});
    expect(driveToast(job({kind: 'drive-delete', ref: 'reel-v2'}))?.title).toBe('Đã xoá reel-v2 trên Drive');
    expect(driveToast(job({kind: 'delete-project'}))).toMatchObject({title: 'Đã xoá dự án p1', to: '/'});
    expect(driveToast(job({kind: 'sync', project: null, ref: 'push'}))).toMatchObject({title: 'Đã đẩy thư viện lên Drive', to: '/library'});
  });
  it('reports failures with the job error and ignores live or unrelated jobs', () => {
    expect(driveToast(job({state: 'failed', error: 'rclone lỗi'}))).toMatchObject({tone: 'error', description: 'rclone lỗi'});
    expect(driveToast(job({state: 'running'}))).toBeNull();
    expect(driveToast(job({kind: 'render'}))).toBeNull();
  });
});
