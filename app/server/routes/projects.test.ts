import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup, settle} from './testApp.ts';
import {readMeta, recordRender} from '../versions.ts';

vi.mock('../git.ts', () => ({approveCommit: vi.fn(async () => 'abc123')}));

describe('projects routes', () => {
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

  it('storyboard PUT with baseMtime, stale, mixTarget, traversal', async () => {
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
    const d2 = await (await req('/api/projects/p1')).json();
    expect(d2.stale).toEqual(['s1']);
    expect(d2.mixTarget).toEqual({real: 0.6, motion: 0.3, other: 0.1});
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
    expect((await req('/api/projects/p1/render', {method: 'POST', json: {kind: 'x'}})).status).toBe(400);
    const gl = await (await req('/api/jobs')).json();
    expect(gl[0].kind).toBe('voice');
    const dir = path.join(root, 'projects/p1');
    expect((await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}})).status).toBe(404);
    expect((await req('/api/projects/p1/approve', {method: 'POST', json: {version: '../x'}})).status).toBe(400);
    await writeFile(path.join(dir, 'reel-v1.mp4'), 'x');
    const ap = await req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}});
    expect(await ap.json()).toEqual({meta: {approved: 'reel-v1', renders: {}}, commit: 'abc123'});
    expect(JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8')).approved).toBe('reel-v1');
  });

  it('render completion and approve interleave without losing either field', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    await writeFile(path.join(root, 'projects/p1/reel-v1.mp4'), 'x');
    await Promise.all([
      recordRender('p1', 'reel-v2', 'draft'),
      req('/api/projects/p1/approve', {method: 'POST', json: {version: 'reel-v1'}}),
      recordRender('p1', 'reel-v3', 'final'),
    ]);
    const meta = (await readMeta('p1')).data;
    expect(meta.approved).toBe('reel-v1');
    expect(Object.keys(meta.renders).sort()).toEqual(['reel-v2', 'reel-v3']);
  });
});
