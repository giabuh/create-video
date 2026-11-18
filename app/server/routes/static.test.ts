import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup} from './testApp.ts';

describe('static media + guard', () => {
  it('serves, ranges, decodes, blocks', async () => {
    const root = await makeTestRoot();
    await writeFile(path.join(root, 'library/a.jpg'), 'abcdefghij');
    await writeFile(path.join(root, 'music/Sôi động 1.mp3'), 'mp3');
    await mkdir(path.join(root, 'voices/_uploads'), {recursive: true});
    await writeFile(path.join(root, 'voices/_uploads/x.wav'), 'w');
    await writeFile(path.join(root, 'library/.hidden.jpg'), 'h');
    const {req} = setup();
    const r = await req('/library/a.jpg');
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('abcdefghij');
    const rg = await req('/library/a.jpg', {headers: {Range: 'bytes=0-3'}});
    expect(rg.status).toBe(206);
    expect(await rg.text()).toBe('abcd');
    expect((await req('/music/S%C3%B4i%20%C4%91%E1%BB%99ng%201.mp3')).status).toBe(200);
    expect((await req('/library/..%2Fconfig.json')).status).toBe(404);
    expect((await req('/library/media-index.json')).status).toBe(404);
    expect((await req('/library/.hidden.jpg')).status).toBe(404);
    expect((await req('/voices/_uploads/x.wav')).status).toBe(404);
    expect((await req('/library/missing.mp4')).status).toBe(404);
  });
  it('guard rejects foreign Host on api and media', async () => {
    await makeTestRoot();
    const {req} = setup();
    for (const p of ['/api/projects', '/library/a.jpg', '/voices/x.wav']) expect((await req(p, {headers: {Host: 'evil.com'}})).status).toBe(403);
  });
});
