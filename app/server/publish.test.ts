import {access, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as drive from './drive.ts';
import {deleteRender, uploadVersion} from './publish.ts';
import {makeTestRoot} from './testRoot.ts';
import {readMeta, writeMeta} from './versions.ts';

vi.mock('./drive.ts', async (orig) => ({
  ...(await orig<typeof import('./drive.ts')>()),
  driveList: vi.fn(async () => [] as string[]), driveUpload: vi.fn(async () => {}), driveDelete: vi.fn(async () => {}),
}));

const ctx = {progress() {}, log() {}, signal: new AbortController().signal};
const exists = (p: string) => access(p).then(() => true, () => false);

let dir: string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(drive.driveList).mockResolvedValue([]);
  vi.mocked(drive.driveDelete).mockResolvedValue();
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

describe('deleteRender', () => {
  const seed = (published = true) => writeMeta('p1', {
    approved: 'reel-v1', renders: {'reel-v1': {kind: 'final', at: 'x'}, 'reel-v2': {kind: 'final', at: 'x'}},
    ...(published && {published: {'reel-v1': {name: 'x.mp4', state: 'done' as const, at: 'x'}}}),
  });
  it('keeps approved snapshot, removes others', async () => {
    await seed();
    await deleteRender('p1', 'reel-v1', {drive: false});
    await deleteRender('p1', 'reel-v2', {drive: false});
    expect(await exists(path.join(dir, 'reel-v1.mp4'))).toBe(false);
    expect(await exists(path.join(dir, 'reel-v1.storyboard.json'))).toBe(true);
    expect(await exists(path.join(dir, 'reel-v2.storyboard.json'))).toBe(false);
    const m = (await readMeta('p1')).data;
    expect(m.approved).toBe('reel-v1');
    expect(Object.keys(m.renders)).toEqual([]);
    expect(drive.driveDelete).not.toHaveBeenCalled();
  });
  it('deletes from Drive and clears published', async () => {
    await seed();
    expect(await deleteRender('p1', 'reel-v1', {drive: true})).toEqual({});
    expect(drive.driveDelete).toHaveBeenCalledWith('x.mp4');
    expect((await readMeta('p1')).data.published?.['reel-v1']).toBeUndefined();
  });
  it('reports a Drive failure but still deletes locally', async () => {
    await seed();
    vi.mocked(drive.driveDelete).mockRejectedValue(new drive.DriveError('boom'));
    expect(await deleteRender('p1', 'reel-v1', {drive: true})).toEqual({driveError: 'boom'});
    expect(await exists(path.join(dir, 'reel-v1.mp4'))).toBe(false);
    expect((await readMeta('p1')).data.published?.['reel-v1']).toBeDefined();
  });
});
