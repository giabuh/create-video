import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as drive from '../drive.ts';
import {makeTestRoot} from '../testRoot.ts';
import {setup, settle} from './testApp.ts';
import {readMeta, recordRender} from '../versions.ts';

vi.mock('../git.ts', () => ({approveCommit: vi.fn(async () => 'abc123'), deleteProjectCommit: vi.fn(async () => null)}));
vi.mock('../drive.ts', async (orig) => ({
  ...(await orig<typeof import('../drive.ts')>()),
  driveList: vi.fn(async () => []), driveSizes: vi.fn(async () => new Map<string, number>()), driveUpload: vi.fn(async () => {}), driveDelete: vi.fn(async () => {}),
}));

describe('projects routes', () => {
  beforeEach(() => {
    // fake Drive: uploads are listed with their (1 byte) local size
    vi.mocked(drive.driveUpload).mockReset();
    vi.mocked(drive.driveSizes).mockReset();
    const files = new Map<string, number>();
    vi.mocked(drive.driveUpload).mockImplementation(async (_l, name) => { files.set(name, 1); });
    vi.mocked(drive.driveSizes).mockImplementation(async () => new Map(files));
  });

  it('lists, creates, conflicts', async () => {
    await makeTestRoot();
    const {req} = setup();
    const list = await (await req('/api/projects')).json();
    expect(list).toMatchObject([{slug: 'p1', status: 'new', sceneCount: 1}]);
    const r = await req('/api/projects', {method: 'POST', json: {name: 'Khai giảng lớp mới', template: 'fast-cut', brand: 'demo', voice: 'vy', targetSeconds: 20}});
    expect(r.status).toBe(201);
    expect((await r.json()).slug).toBe('khai-giang-lop-moi');
    const d = await (await req('/api/projects/khai-giang-lop-moi')).json();
    expect(d.storyboard.data).toEqual({scenes: [], template: 'fast-cut', brand: 'demo', voice: 'vy', targetSeconds: 20});
    expect((await req('/api/projects', {method: 'POST', json: {name: 'Khai giảng lớp mới'}})).status).toBe(409);
    expect((await req('/api/projects', {method: 'POST', json: {name: '!!!'}})).status).toBe(400);
    expect((await req('/api/projects', {method: 'POST', body: '{bad', headers: {'content-type': 'application/json'}})).status).toBe(400);
  });

  it('storyboard PUT with baseMtime, stale, legacy mix ignored, traversal', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    const d = await (await req('/api/projects/p1')).json();
    const sb = {scenes: [{id: 's1', say: 'xin chào', duration: 2}]};
    const ok = await req('/api/projects/p1/storyboard', {method: 'PUT', json: {storyboard: sb, baseMtime: d.storyboard.mtime}});
    expect(ok.status).toBe(200);
    const {mtime} = await ok.json();
    expect(JSON.parse(await readFile(path.join(root, 'projects/p1/storyboard.json'), 'utf8'))).toEqual(sb);
    const bad = await req('/api/projects/p1/storyboard', {method: 'PUT', json: {storyboard: {scenes: []}, baseMtime: mtime - 5000}});
    expect(bad.status).toBe(409);
    expect(await bad.json()).toMatchObject({error: 'conflict', details: {data: sb, mtime}});
    await writeFile(path.join(root, 'projects/p1/render-props.json'), JSON.stringify({scenes: [{id: 's1', voice: null}], totalSeconds: 2}));
    await writeFile(path.join(root, 'projects/p1/timings.json'), JSON.stringify({scenes: {}, totalSeconds: 2, mix: {real: 0.6, motion: 0.3, other: 0.1}}));
    const d2 = await (await req('/api/projects/p1')).json();
    expect(d2.stale).toEqual(['s1']);
    const listed = await (await req('/api/projects')).json();
    expect(listed[0]).not.toHaveProperty('mix');
    expect([400, 404]).toContain((await req('/api/projects/..%2Fetc')).status);
    expect((await req('/api/projects/nope')).status).toBe(404);
  });

  it('voice and render enqueue jobs; approve validates and commits', async () => {
    const root = await makeTestRoot();
    const {req, jobs, worker} = setup();
    const v = await req('/api/projects/p1/voice', {method: 'POST'});
    expect(v.status).toBe(202);
    const job = await settle(jobs, (await v.json()).id);
    expect(job.state).toBe('done');
    expect(worker.request).toHaveBeenCalledWith('prepare', {project: 'p1'}, expect.any(Function));
    expect((await req('/api/projects/p1/render', {method: 'POST', json: {}})).status).toBe(202);
    const gl = await (await req('/api/jobs')).json();
    expect(gl.map((j: {kind: string}) => j.kind)).toEqual(['render', 'voice']);
    const dir = path.join(root, 'projects/p1');
    expect((await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}})).status).toBe(404);
    expect((await req('/api/projects/p1/approve', {method: 'POST', json: {version: '../x'}})).status).toBe(400);
    await writeFile(path.join(dir, 'reel-v1.mp4'), 'x');
    const ap = await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}});
    expect(await ap.json()).toMatchObject({meta: {approved: 'reel-v1', renders: {}}, commit: 'abc123', job: {kind: 'publish'}});
    expect(JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8')).approved).toBe('reel-v1');
  });

  it('render completion and approve interleave without losing either field', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    await writeFile(path.join(root, 'projects/p1/reel-v1.mp4'), 'x');
    await Promise.all([
      recordRender('p1', 'reel-v2'),
      req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}}),
      recordRender('p1', 'reel-v3'),
    ]);
    const meta = (await readMeta('p1')).data;
    expect(meta.approved).toBe('reel-v1');
    expect(Object.keys(meta.renders).sort()).toEqual(['reel-v2', 'reel-v3']);
  });

  it('approve rejects legacy drafts and bad names; delete guards', async () => {
    const root = await makeTestRoot();
    const {req, jobs} = setup();
    const dir = path.join(root, 'projects/p1');
    await writeFile(path.join(dir, 'reel-v1.mp4'), 'x');
    await writeFile(path.join(dir, 'reel-v2.mp4'), 'x');
    await writeFile(path.join(dir, 'project.json'), JSON.stringify({approved: null, renders: {'reel-v1': {kind: 'draft', at: 'x'}, 'reel-v2': {kind: 'final', at: 'x'}}}));
    const bad = await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}});
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({error: 'Bản nháp cũ không duyệt được'});
    expect((await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v2', name: '!!!'}})).status).toBe(400);
    expect((await readMeta('p1')).data.approved).toBeNull();
    const ok = await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v2'}});
    expect(ok.status).toBe(200);
    const {job: pubJob} = await ok.json();
    await settle(jobs, pubJob.id);
    expect(pubJob.ref).toBe('reel-v2');
    expect((await readMeta('p1')).data.published?.['reel-v2']).toMatchObject({state: 'done', name: 'p1-reel-v2.mp4'});
    expect((await req('/api/projects/p1/renders/reel-v9', {method: 'DELETE'})).status).toBe(404);
    const del = await req('/api/projects/p1/renders/reel-v2?drive=1', {method: 'DELETE'});
    expect(del.status).toBe(200);
    const {driveJob} = await del.json();
    expect(driveJob).toMatchObject({kind: 'drive-delete', ref: 'reel-v2'});
    await settle(jobs, driveJob.id);
    expect((await readMeta('p1')).data.published?.['reel-v2']).toBeUndefined();
  });

  it('delete without drive returns {} and keeps the record; drive-delete route (orphan) and 404', async () => {
    const root = await makeTestRoot();
    const {req, jobs} = setup();
    const dir = path.join(root, 'projects/p1');
    await writeFile(path.join(dir, 'reel-v1.mp4'), 'x');
    await writeFile(path.join(dir, 'project.json'), JSON.stringify({approved: null, renders: {}, published: {'reel-v1': {name: 'a.mp4', state: 'done', at: 'x'}}}));
    const del = await req('/api/projects/p1/renders/reel-v1', {method: 'DELETE'});
    expect(await del.json()).toEqual({});
    expect((await readMeta('p1')).data.published?.['reel-v1']?.state).toBe('done');
    expect((await req('/api/projects/p1/drive-delete', {method: 'POST', json: {version: 'reel-v7'}})).status).toBe(404);
    const r = await req('/api/projects/p1/drive-delete', {method: 'POST', json: {version: 'reel-v1'}});
    expect(r.status).toBe(202);
    const job = await r.json();
    expect(job).toMatchObject({kind: 'drive-delete', label: 'Xoá reel-v1 trên Drive', ref: 'reel-v1', cancellable: false});
    await settle(jobs, job.id);
    expect((await readMeta('p1')).data.published?.['reel-v1']).toBeUndefined();
  });

  it('GET drive: ok / missing / mismatch / orphan / error', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    const dir = path.join(root, 'projects/p1');
    for (const v of ['reel-v1', 'reel-v2', 'reel-v3']) await writeFile(path.join(dir, `${v}.mp4`), 'x');
    const rec = (name: string) => ({name, state: 'done', at: 'x'});
    await writeFile(path.join(dir, 'project.json'), JSON.stringify({approved: null, renders: {}, published: {
      'reel-v1': rec('a.mp4'), 'reel-v2': rec('b.mp4'), 'reel-v3': rec('c.mp4'), 'reel-v4': rec('d.mp4'), 'reel-v5': rec('e.mp4'), 'reel-v6': {name: 'f.mp4', state: 'failed', at: 'x'},
    }}));
    vi.mocked(drive.driveSizes).mockResolvedValue(new Map([['a.mp4', 1], ['c.mp4', 5], ['d.mp4', 9]]));
    const s = await (await req('/api/projects/p1/drive')).json();
    expect(s).toMatchObject({error: null, versions: {'reel-v1': 'ok', 'reel-v2': 'missing', 'reel-v3': 'mismatch', 'reel-v4': 'ok', 'reel-v5': 'missing'}});
    expect(s.versions['reel-v6']).toBeUndefined();
    expect(s.orphans).toEqual([{version: 'reel-v4', name: 'd.mp4', at: 'x', onDrive: true}, {version: 'reel-v5', name: 'e.mp4', at: 'x', onDrive: false}]);
    vi.mocked(drive.driveSizes).mockRejectedValue(new drive.DriveError('offline'));
    const e = await (await req('/api/projects/p1/drive')).json();
    expect(e).toMatchObject({error: 'offline', versions: {}, orphans: []});
  });

  it('re-push: done+missing and done+mismatch enqueue an overwrite under the recorded name; done+ok is 409', async () => {
    const root = await makeTestRoot();
    const {req, jobs} = setup();
    const dir = path.join(root, 'projects/p1');
    await writeFile(path.join(dir, 'reel-v1.mp4'), 'x');
    await writeFile(path.join(dir, 'project.json'), JSON.stringify({approved: 'reel-v1', renders: {}, published: {'reel-v1': {name: 'a.mp4', state: 'done', at: 'x'}}}));
    vi.mocked(drive.driveSizes).mockResolvedValue(new Map([['a.mp4', 1]]));
    expect((await req('/api/projects/p1/publish', {method: 'POST', json: {version: 'reel-v1'}})).status).toBe(409);
    for (const sizes of [new Map<string, number>(), new Map([['a.mp4', 7]])]) {
      vi.mocked(drive.driveUpload).mockClear();
      vi.mocked(drive.driveSizes).mockResolvedValueOnce(sizes); // route check
      const r = await req('/api/projects/p1/publish', {method: 'POST', json: {version: 'reel-v1', name: 'ignored'}});
      expect(r.status).toBe(202);
      const job = await r.json();
      expect(job.ref).toBe('reel-v1');
      vi.mocked(drive.driveSizes).mockResolvedValue(new Map([['a.mp4', 1]])); // verify after upload
      await settle(jobs, job.id);
      expect(vi.mocked(drive.driveUpload).mock.calls[0][1]).toBe('a.mp4');
      expect((await readMeta('p1')).data.published?.['reel-v1']).toMatchObject({state: 'done', name: 'a.mp4'});
    }
  });

  it('delete of approved render not on Drive is 409', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    await writeFile(path.join(root, 'projects/p1/reel-v1.mp4'), 'x');
    await writeFile(path.join(root, 'projects/p1/project.json'), JSON.stringify({approved: 'reel-v1', renders: {}}));
    const r = await req('/api/projects/p1/renders/reel-v1', {method: 'DELETE'});
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({error: 'Bản đã duyệt chưa lên Drive'});
  });

  it('approve and publish are 409 when already uploaded or uploading', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    const dir = path.join(root, 'projects/p1');
    await writeFile(path.join(dir, 'reel-v1.mp4'), 'x');
    const seed = (state: string) => writeFile(path.join(dir, 'project.json'), JSON.stringify({approved: 'reel-v1', renders: {}, published: {'reel-v1': {name: 'a.mp4', state, at: 'x'}}}));
    vi.mocked(drive.driveSizes).mockResolvedValue(new Map([['a.mp4', 1]]));
    for (const [state, msg] of [['done', 'Bản này đã lên Drive'], ['uploading', 'Đang tải lên Drive']]) {
      await seed(state);
      for (const url of ['approve', 'publish']) {
        const r = await req(`/api/projects/p1/${url}`, {method: 'POST', json: {version: 'reel-v1', name: 'b'}});
        expect(r.status).toBe(409);
        expect(await r.json()).toMatchObject({error: msg});
      }
    }
    expect((await readMeta('p1')).data.published?.['reel-v1']?.state).toBe('uploading');
  });

  it('deleting project is read-only; cancel clears; delete validates and removes', async () => {
    const root = await makeTestRoot();
    const {req, jobs} = setup();
    const dir = path.join(root, 'projects/p1');
    await writeFile(path.join(dir, 'project.json'), JSON.stringify({approved: null, renders: {}, deleting: {uploads: [], state: 'failed', error: 'x'}}));
    expect((await (await req('/api/projects')).json())[0]).toMatchObject({status: 'deleting', deleting: {state: 'failed'}});
    expect((await req('/api/projects/p1/storyboard', {method: 'PUT', json: {storyboard: {scenes: []}, baseMtime: 0}})).status).toBe(423);
    expect((await req('/api/projects/p1/drive-delete', {method: 'POST', json: {version: 'reel-v1'}})).status).toBe(423);
    expect((await req('/api/projects/p1/delete-cancel', {method: 'POST'})).status).toBe(200);
    expect((await readMeta('p1')).data.deleting).toBeUndefined();
    expect((await req('/api/projects/p1', {method: 'DELETE', json: {upload: ['reel-v9']}})).status).toBe(400);
    const r = await req('/api/projects/p1', {method: 'DELETE', json: {upload: []}});
    expect(r.status).toBe(202);
    await settle(jobs, (await r.json()).id);
    expect((await req('/api/projects/p1')).status).toBe(404);
  });
});
