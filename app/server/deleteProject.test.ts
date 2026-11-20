import {access, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as drive from './drive.ts';
import {runDeleteProject} from './deleteProject.ts';
import * as git from './git.ts';
import {resetInterruptedUploads} from './publish.ts';
import {makeTestRoot} from './testRoot.ts';
import {readMeta, writeMeta} from './versions.ts';

vi.mock('./git.ts', () => ({deleteProjectCommit: vi.fn(async () => 'abc')}));
vi.mock('./drive.ts', async (orig) => ({
  ...(await orig<typeof import('./drive.ts')>()),
  driveList: vi.fn(async () => [] as string[]), driveSizes: vi.fn(async () => new Map<string, number>()), driveUpload: vi.fn(async () => {}),
}));

const ctx = {progress() {}, log() {}, signal: new AbortController().signal};
const exists = (p: string) => access(p).then(() => true, () => false);
const sleep = vi.fn(async (_ms: number) => {});

let root: string, dir: string, onDrive: Map<string, number>;
const setDeleting = async (uploads: string[]) => writeMeta('p1', {...(await readMeta('p1')).data, deleting: {uploads, state: 'uploading'}});
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(drive.driveList).mockResolvedValue([]);
  vi.mocked(drive.driveUpload).mockResolvedValue();
  onDrive = new Map(); // fake Drive: whatever was uploaded (test files are 1 byte)
  vi.mocked(drive.driveUpload).mockImplementation(async (_l, name) => { onDrive.set(name, 1); });
  vi.mocked(drive.driveSizes).mockImplementation(async () => new Map(onDrive));
  root = await makeTestRoot();
  dir = path.join(root, 'projects/p1');
  for (const v of ['reel-v1', 'reel-v2']) await writeFile(path.join(dir, `${v}.mp4`), 'x');
});

describe('runDeleteProject', () => {
  it('no uploads: commits and removes the folder, keeps library/music', async () => {
    await setDeleting([]);
    await runDeleteProject('p1', ctx, sleep);
    expect(git.deleteProjectCommit).toHaveBeenCalledWith('p1');
    expect(await exists(dir)).toBe(false);
    expect(await exists(path.join(root, 'library/media-index.json'))).toBe(true);
    expect(await exists(path.join(root, 'music'))).toBe(true);
  });
  it('one upload ok: records published then removes', async () => {
    await setDeleting(['reel-v1']);
    await runDeleteProject('p1', ctx, sleep);
    expect(drive.driveUpload).toHaveBeenCalledTimes(1);
    expect(await exists(dir)).toBe(false);
  });
  it('upload fails 4 times: keeps the project, marks failed, backs off', async () => {
    vi.mocked(drive.driveUpload).mockRejectedValue(new drive.DriveError('boom'));
    await setDeleting(['reel-v1']);
    await expect(runDeleteProject('p1', ctx, sleep)).rejects.toThrow('boom');
    expect(await exists(dir)).toBe(true);
    expect(git.deleteProjectCommit).not.toHaveBeenCalled();
    expect(sleep.mock.calls.map(c => c[0])).toEqual([10000, 30000, 90000]);
    expect((await readMeta('p1')).data.deleting).toMatchObject({state: 'failed', error: 'boom'});
  });
  it('commit failure marks failed and keeps the folder', async () => {
    vi.mocked(git.deleteProjectCommit).mockRejectedValueOnce(new Error('git boom'));
    await setDeleting([]);
    await expect(runDeleteProject('p1', ctx, sleep)).rejects.toThrow('git boom');
    expect(await exists(dir)).toBe(true);
    expect((await readMeta('p1')).data.deleting).toMatchObject({state: 'failed', error: 'git boom'});
  });
  it('retry skips versions already done', async () => {
    await setDeleting(['reel-v1', 'reel-v2']);
    const m = (await readMeta('p1')).data;
    await writeMeta('p1', {...m, published: {'reel-v1': {name: 'a.mp4', state: 'done', at: 'x'}}});
    onDrive.set('a.mp4', 1);
    await runDeleteProject('p1', ctx, sleep);
    expect(drive.driveUpload).toHaveBeenCalledTimes(1);
    expect((vi.mocked(drive.driveUpload).mock.calls[0] as unknown[])[0]).toContain('reel-v2.mp4');
  });
});

describe('runDeleteProject safety and progress', () => {
  it('retry shows the error and wait in the step text', async () => {
    vi.mocked(drive.driveUpload).mockRejectedValueOnce(new drive.DriveError('boom'));
    const steps: string[] = [];
    await setDeleting(['reel-v1']);
    await runDeleteProject('p1', {...ctx, progress: (_p, s) => { if (s) steps.push(s); }}, sleep);
    expect(steps).toContain('Lỗi: boom — thử lại sau 10 giây (lần 1/3)');
    expect(steps).toEqual(expect.arrayContaining(['Đẩy reel-v1 (1/1)', 'Kiểm tra trên Drive', 'Xoá thư mục dự án']));
    expect(await exists(dir)).toBe(false);
  });
  it('a done record missing on Drive is re-uploaded before removing', async () => {
    await setDeleting([]);
    const m = (await readMeta('p1')).data;
    await writeMeta('p1', {...m, published: {'reel-v1': {name: 'a.mp4', state: 'done', at: 'x'}}});
    await runDeleteProject('p1', ctx, sleep);
    expect(drive.driveUpload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(drive.driveUpload).mock.calls[0][1]).toBe('a.mp4');
    expect(await exists(dir)).toBe(false);
  });
  it('size mismatch that cannot be fixed: nothing is removed', async () => {
    vi.mocked(drive.driveUpload).mockImplementation(async (_l, name) => { onDrive.set(name, 99); });
    await setDeleting(['reel-v1']);
    await expect(runDeleteProject('p1', ctx, sleep)).rejects.toThrow('không thấy đúng file');
    expect(await exists(dir)).toBe(true);
    expect(await exists(path.join(dir, 'reel-v1.mp4'))).toBe(true);
    expect(git.deleteProjectCommit).not.toHaveBeenCalled();
    expect((await readMeta('p1')).data.deleting).toMatchObject({state: 'failed'});
  });
  it('a Drive listing failure removes nothing', async () => {
    await setDeleting([]);
    vi.mocked(drive.driveSizes).mockRejectedValue(new drive.DriveError('offline'));
    const m = (await readMeta('p1')).data;
    await writeMeta('p1', {...m, published: {'reel-v1': {name: 'a.mp4', state: 'done', at: 'x'}}});
    await expect(runDeleteProject('p1', ctx, sleep)).rejects.toThrow('offline');
    expect(await exists(dir)).toBe(true);
  });
});

describe('resetInterruptedUploads', () => {
  it('flips uploading records to failed, leaves done alone', async () => {
    const m = (await readMeta('p1')).data;
    await writeMeta('p1', {...m, published: {'reel-v1': {name: 'a', state: 'uploading', at: 'x'}, 'reel-v2': {name: 'b', state: 'done', at: 'x'}}, deleting: {uploads: ['reel-v1'], state: 'uploading'}});
    await resetInterruptedUploads();
    const n = (await readMeta('p1')).data;
    expect(n.published?.['reel-v1']).toMatchObject({state: 'failed', error: 'Bị gián đoạn — hãy thử lại'});
    expect(n.published?.['reel-v2'].state).toBe('done');
    expect(n.deleting).toMatchObject({state: 'failed', error: 'Bị gián đoạn — hãy thử lại'});
  });
});
