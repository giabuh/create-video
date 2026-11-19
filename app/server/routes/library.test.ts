import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup} from './testApp.ts';

const entry = {type: 'image', description: 'd', tags: []};
async function seed() {
  const root = await makeTestRoot();
  await writeFile(path.join(root, 'library/a.jpg'), 'AAA');
  await writeFile(path.join(root, 'library/b.jpg'), 'BBB');
  await mkdir(path.join(root, 'library/thumbs'));
  await writeFile(path.join(root, 'library/thumbs/b.jpg'), 'T');
  await writeFile(path.join(root, 'library/media-index.json'), JSON.stringify({'a.jpg': entry, 'b.jpg': entry}));
  return root;
}
const useP1 = (root: string) => writeFile(path.join(root, 'projects/p1/storyboard.json'), JSON.stringify({scenes: [{id: 's1', media: [{src: 'a.jpg'}]}]}));

describe('library routes', () => {
  it('GET /music lists audio files with sizes, sorted, skipping others', async () => {
    const root = await makeTestRoot();
    await mkdir(path.join(root, 'music'), {recursive: true});
    await writeFile(path.join(root, 'music/Sôi động 1.mp3'), 'xyz');
    await writeFile(path.join(root, 'music/a.wav'), 'ab');
    await writeFile(path.join(root, 'music/notes.txt'), 'n');
    await writeFile(path.join(root, 'music/.hidden.mp3'), 'h');
    expect(await (await setup().req('/api/music')).json()).toEqual([{name: 'Sôi động 1.mp3', bytes: 3}, {name: 'a.wav', bytes: 2}].sort((x, y) => x.name < y.name ? -1 : 1));
  });
  it('DELETE /music removes a file unless a project uses it', async () => {
    const root = await makeTestRoot();
    await mkdir(path.join(root, 'music'), {recursive: true});
    await writeFile(path.join(root, 'music/a.mp3'), 'a');
    await writeFile(path.join(root, 'music/b.mp3'), 'b');
    await mkdir(path.join(root, 'projects/p1'), {recursive: true});
    await writeFile(path.join(root, 'projects/p1/storyboard.json'), JSON.stringify({scenes: [], music: {file: 'b.mp3'}}));
    const {req} = setup();
    expect((await req('/api/music/a.mp3', {method: 'DELETE'})).status).toBe(204);
    expect((await req('/api/music/b.mp3', {method: 'DELETE'})).status).toBe(409);
    expect((await req('/api/music/a.mp3', {method: 'DELETE'})).status).toBe(404);
    expect((await req('/api/music/x.txt', {method: 'DELETE'})).status).toBe(400);
    expect(await (await req('/api/music')).json()).toEqual([{name: 'b.mp3', bytes: 1}]);
  });
  it('missing index -> empty', async () => {
    const root = await makeTestRoot();
    await import('node:fs/promises').then(f => f.rm(path.join(root, 'library/media-index.json')));
    expect(await (await setup().req('/api/library')).json()).toEqual({data: {}, mtime: 0, usage: {}});
  });
  it('index + usage; PUT conflict and ok; ingest lock', async () => {
    const root = await seed(); await useP1(root);
    const {req, jobs} = setup();
    const lib = await (await req('/api/library')).json();
    expect(lib.usage).toEqual({'a.jpg': ['p1 · s1']});
    const put = (baseMtime: number) => req('/api/library/a.jpg', {method: 'PUT', json: {entry: {...entry, description: 'new'}, baseMtime}});
    expect((await put(lib.mtime - 5000)).status).toBe(409);
    expect((await put(lib.mtime)).status).toBe(200);
    expect(JSON.parse(await readFile(path.join(root, 'library/media-index.json'), 'utf8'))['a.jpg'].description).toBe('new');
    expect((await req('/api/library/zzz.jpg', {method: 'PUT', json: {entry, baseMtime: (await (await req('/api/library')).json()).mtime}})).status).toBe(404);
    jobs.enqueue({kind: 'ingest', lane: 'io', label: 'i', cancellable: true, run: ctx => new Promise((_r, rej) => ctx.signal.addEventListener('abort', () => rej(new Error('x'))))});
    expect((await put(1)).status).toBe(423);
    expect((await req('/api/library/b.jpg', {method: 'DELETE'})).status).toBe(423);
  });
  it('delete: in-use 409, unused removes file, thumb, entry', async () => {
    const root = await seed(); await useP1(root);
    const {req} = setup();
    const r = await req('/api/library/a.jpg', {method: 'DELETE'});
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({error: 'in-use', details: ['p1 · s1']});
    expect((await req('/api/library/b.jpg', {method: 'DELETE'})).status).toBe(204);
    await expect(stat(path.join(root, 'library/b.jpg'))).rejects.toThrow();
    await expect(stat(path.join(root, 'library/thumbs/b.jpg'))).rejects.toThrow();
    expect(Object.keys(JSON.parse(await readFile(path.join(root, 'library/media-index.json'), 'utf8')))).toEqual(['a.jpg']);
    expect((await req('/api/library/media-index.json', {method: 'DELETE'})).status).toBe(400);
    expect((await req('/api/library/..%2Fconfig.json', {method: 'DELETE'})).status).toBe(400);
  });
});
