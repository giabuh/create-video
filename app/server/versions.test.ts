import {mkdir, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTestRoot} from './testRoot.ts';
import {listVersions, nextVersion, projectStatus, readMeta, recordRender, writeMeta} from './versions.ts';
import {withSlugLock} from './slugLock.ts';

describe('versions', () => {
  it('nextVersion, listVersions, meta', async () => {
    const root = await makeTestRoot();
    const d = path.join(root, 'projects/p1');
    for (const f of ['reel-v1.mp4', 'reel-v3.mp4', 'reel-v4.tmp.mp4', 'reel-v3.storyboard.json']) await writeFile(path.join(d, f), 'x');
    expect(await nextVersion('p1')).toEqual({n: 5, name: 'reel-v5'});
    expect((await readMeta('p1')).data).toEqual({approved: null, renders: {}});
    const meta = {approved: 'reel-v3', renders: {'reel-v3': {kind: 'final' as const, at: 'now'}}};
    await writeMeta('p1', meta);
    const v = await listVersions('p1', (await readMeta('p1')).data);
    expect(v.map(x => x.name)).toEqual(['reel-v3', 'reel-v1']);
    expect(v[0]).toMatchObject({n: 3, kind: 'final', approved: true, hasSnapshot: true, file: 'projects/p1/reel-v3.mp4', bytes: 1});
    expect(v[1]).toMatchObject({kind: null, approved: false, hasSnapshot: false});
    await mkdir(path.join(root, 'projects/empty'));
    expect(await nextVersion('empty')).toEqual({n: 1, name: 'reel-v1'});
  });

  it('recordRender: a new draft removes older drafts, keeps finals and approved', async () => {
    const root = await makeTestRoot();
    const d = path.join(root, 'projects/p2');
    await mkdir(d, {recursive: true});
    for (const n of [1, 2, 3, 4]) for (const e of ['mp4', 'storyboard.json']) await writeFile(path.join(d, `reel-v${n}.${e}`), 'x');
    const at = 'now';
    await writeMeta('p2', {approved: 'reel-v2', renders: {'reel-v1': {kind: 'draft', at}, 'reel-v2': {kind: 'draft', at}, 'reel-v3': {kind: 'final', at}}});
    await recordRender('p2', 'reel-v4', 'draft');
    expect(Object.keys((await readMeta('p2')).data.renders).sort()).toEqual(['reel-v2', 'reel-v3', 'reel-v4']);
    expect(await readdir(d)).toEqual(expect.not.arrayContaining(['reel-v1.mp4', 'reel-v1.storyboard.json']));
    expect(await readdir(d)).toEqual(expect.arrayContaining(['reel-v2.mp4', 'reel-v3.mp4', 'reel-v4.mp4']));
  });

  it('projectStatus', () => {
    const v = [{} as never];
    expect(projectStatus(v, {approved: 'reel-v1', renders: {}}, true)).toBe('rendering');
    expect(projectStatus(v, {approved: 'reel-v1', renders: {}}, false)).toBe('approved');
    expect(projectStatus(v, {approved: null, renders: {}}, false)).toBe('draft');
    expect(projectStatus([], {approved: null, renders: {}}, false)).toBe('new');
  });

  it('withSlugLock serializes per slug only', async () => {
    let active = 0, maxActive = 0;
    const job = (slug: string) => withSlugLock(slug, async () => { active++; maxActive = Math.max(maxActive, active); await new Promise(r => setTimeout(r, 30)); active--; });
    await Promise.all([job('a'), job('a'), job('a')]);
    expect(maxActive).toBe(1);
    await Promise.all([job('a'), job('b')]);
    expect(maxActive).toBe(2);
    await expect(withSlugLock('a', async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await withSlugLock('a', async () => 7)).toBe(7);
  });
});
