import {access, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as drive from './drive.ts';
import {deleteRender, runDriveDelete, uploadVersion} from './publish.ts';
import {makeTestRoot} from './testRoot.ts';
import {readMeta, writeMeta} from './versions.ts';

vi.mock('./drive.ts', async (orig) => ({
  ...(await orig<typeof import('./drive.ts')>()),
  driveList: vi.fn(async () => [] as string[]), driveSizes: vi.fn(async () => new Map<string, number>()), driveUpload: vi.fn(async () => {}), driveDelete: vi.fn(async () => {}),
}));

const ctx = {progress() {}, log() {}, signal: new AbortController().signal};
const exists = (p: string) => access(p).then(() => true, () => false);

let dir: string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(drive.driveList).mockResolvedValue([]);
  vi.mocked(drive.driveDelete).mockResolvedValue();
  // the fake Drive holds whatever was uploaded, with the local size (the test files are 1 byte)
  vi.mocked(drive.driveSizes).mockImplementation(async () => new Map([...vi.mocked(drive.driveUpload).mock.calls.map(c => [c[1], 1] as [string, number])]));
  dir = path.join(await makeTestRoot(), 'projects/p1');
  for (const v of ['reel-v1', 'reel-v2']) {
    await writeFile(path.join(dir, `${v}.mp4`), 'x');
    await writeFile(path.join(dir, `${v}.storyboard.json`), '{}');
  }
});

describe('uploadVersion', () => {
  it('records done', async () => {
    expect(await uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false})).toBe('x.mp4');
    expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'done', name: 'x.mp4'});
  });
  it('fails when name taken and not unique', async () => {
    vi.mocked(drive.driveList).mockResolvedValue(['x.mp4']);
    await expect(uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false})).rejects.toThrow('Tên đã có trên Drive');
    expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'failed', error: 'Tên đã có trên Drive'});
    expect(drive.driveUpload).not.toHaveBeenCalled();
  });
  it('never overwrites a done record', async () => {
    await uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false});
    await expect(uploadVersion('p1', 'reel-v1', 'y.mp4', ctx, {unique: false})).rejects.toThrow('Bản này đã lên Drive');
    expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'done', name: 'x.mp4'});
  });
  it('picks a free name when unique', async () => {
    vi.mocked(drive.driveList).mockResolvedValue(['x.mp4']);
    expect(await uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: true})).toBe('x-2.mp4');
  });
});

describe('uploadVersion verify and repush', () => {
  it('fails when Drive does not show the file with the right size', async () => {
    vi.mocked(drive.driveSizes).mockResolvedValue(new Map([['x.mp4', 99]]));
    await expect(uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false})).rejects.toThrow('Đã tải lên nhưng không thấy đúng file trên Drive');
    expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'failed'});
    vi.mocked(drive.driveSizes).mockResolvedValue(new Map());
    await expect(uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false})).rejects.toThrow('không thấy đúng file');
  });
  it('shows the verify step', async () => {
    const steps: string[] = [];
    await uploadVersion('p1', 'reel-v1', 'x.mp4', {...ctx, progress: (_p, s) => { if (s) steps.push(s); }}, {unique: false});
    expect(steps).toContain('Kiểm tra trên Drive');
  });
  const seedDone = () => writeMeta('p1', {approved: 'reel-v1', renders: {}, published: {'reel-v1': {name: 'x.mp4', state: 'done', at: 'x'}}});
  it('repush overwrites the recorded name without the taken check', async () => {
    await seedDone();
    vi.mocked(drive.driveList).mockResolvedValue(['x.mp4']);
    expect(await uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false, repush: true})).toBe('x.mp4');
    expect(drive.driveUpload).toHaveBeenCalledTimes(1);
    expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'done', name: 'x.mp4'});
  });
  it('failed repush restores the done record', async () => {
    await seedDone();
    vi.mocked(drive.driveSizes).mockResolvedValue(new Map());
    await expect(uploadVersion('p1', 'reel-v1', 'x.mp4', ctx, {unique: false, repush: true})).rejects.toThrow();
    expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'done', name: 'x.mp4'});
  });
});

describe('runDriveDelete', () => {
  const seedDone = () => writeMeta('p1', {approved: null, renders: {}, published: {'reel-v1': {name: 'x.mp4', state: 'done', at: 'x'}}});
  it('deletes the file and clears the record', async () => {
    await seedDone();
    vi.mocked(drive.driveList).mockResolvedValue(['x.mp4']);
    await runDriveDelete('p1', 'reel-v1', ctx);
    expect(drive.driveDelete).toHaveBeenCalledWith('x.mp4');
    expect((await readMeta('p1')).data.published?.['reel-v1']).toBeUndefined();
  });
  it('already gone from Drive counts as success', async () => {
    await seedDone();
    await runDriveDelete('p1', 'reel-v1', ctx);
    expect(drive.driveDelete).not.toHaveBeenCalled();
    expect((await readMeta('p1')).data.published?.['reel-v1']).toBeUndefined();
  });
  it('keeps the record when the delete fails; refuses without a done record', async () => {
    await seedDone();
    vi.mocked(drive.driveList).mockResolvedValue(['x.mp4']);
    vi.mocked(drive.driveDelete).mockRejectedValue(new drive.DriveError('boom'));
    await expect(runDriveDelete('p1', 'reel-v1', ctx)).rejects.toThrow('boom');
    expect((await readMeta('p1')).data.published?.['reel-v1']?.state).toBe('done');
    await expect(runDriveDelete('p1', 'reel-v2', ctx)).rejects.toThrow();
  });
  it('a Drive listing failure fails the job and keeps the record', async () => {
    await seedDone();
    vi.mocked(drive.driveList).mockRejectedValue(new drive.DriveError('offline'));
    await expect(runDriveDelete('p1', 'reel-v1', ctx)).rejects.toThrow('offline');
    expect(drive.driveDelete).not.toHaveBeenCalled();
    expect((await readMeta('p1')).data.published?.['reel-v1']?.state).toBe('done');
  });
});

describe('deleteRender', () => {
  const seed = (published = true) => writeMeta('p1', {
    approved: 'reel-v1', renders: {'reel-v1': {kind: 'final', at: 'x'}, 'reel-v2': {kind: 'final', at: 'x'}},
    ...(published && {published: {'reel-v1': {name: 'x.mp4', state: 'done' as const, at: 'x'}}}),
  });
  it('keeps approved snapshot, removes others', async () => {
    await seed();
    expect(await deleteRender('p1', 'reel-v1', {drive: false})).toEqual({});
    await deleteRender('p1', 'reel-v2', {drive: false});
    expect(await exists(path.join(dir, 'reel-v1.mp4'))).toBe(false);
    expect(await exists(path.join(dir, 'reel-v1.storyboard.json'))).toBe(true);
    expect(await exists(path.join(dir, 'reel-v2.storyboard.json'))).toBe(false);
    const m = (await readMeta('p1')).data;
    expect(m.approved).toBe('reel-v1');
    expect(Object.keys(m.renders)).toEqual([]);
    expect(m.published?.['reel-v1']).toBeDefined();
    expect(drive.driveDelete).not.toHaveBeenCalled();
  });
  it('returns the Drive name to delete only when asked and done; never touches Drive itself', async () => {
    await seed();
    expect(await deleteRender('p1', 'reel-v1', {drive: true})).toEqual({driveName: 'x.mp4'});
    expect(await deleteRender('p1', 'reel-v2', {drive: true})).toEqual({});
    expect(drive.driveDelete).not.toHaveBeenCalled();
  });
});
