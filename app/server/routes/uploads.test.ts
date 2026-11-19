import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup} from './testApp.ts';

describe('upload routes', () => {
  it('stores bytes, sanitizes, dedups, rejects bad names', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    const bytes = randomBytes(3 * 1024 * 1024);
    const r = await req('/api/upload/IMG%202041.MOV', {method: 'PUT', body: bytes});
    expect(await r.json()).toEqual({saved: 'img-2041.mov'});
    expect(Buffer.compare(await readFile(path.join(root, 'inbox/img-2041.mov')), bytes)).toBe(0);
    expect((await (await req('/api/upload/IMG%202041.MOV', {method: 'PUT', body: 'x'})).json()).saved).toBe('img-2041-2.mov');
    expect((await req('/api/upload/a.exe', {method: 'PUT', body: 'x'})).status).toBe(400);
    expect((await req('/api/upload/..%2Fx.mov', {method: 'PUT', body: 'x'})).status).toBe(400);
    expect((await req('/api/upload/empty.mov', {method: 'PUT'})).status).toBe(400);
    expect((await readdir(path.join(root, 'inbox'))).filter(f => f.endsWith('.part'))).toEqual([]);
  });
  it('music and logo', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    expect((await (await req('/api/upload-music/S%C3%B4i.mp3', {method: 'PUT', body: 'm'})).json()).saved).toBe('soi.mp3');
    expect((await readFile(path.join(root, 'music/soi.mp3'), 'utf8'))).toBe('m');
    const r = await (await req('/api/upload-logo/demo/Logo.PNG', {method: 'PUT', body: 'png'})).json();
    expect(r).toMatchObject({logo: 'logo.png'});
    expect(JSON.parse(await readFile(path.join(root, 'brands/demo/brand.json'), 'utf8')).logo).toBe('logo.png');
    expect((await req('/api/upload-logo/nope/x.png', {method: 'PUT', body: 'x'})).status).toBe(400);
    expect((await req('/api/upload-logo/demo/x.gif', {method: 'PUT', body: 'x'})).status).toBe(400);
  });
  it('logo cutout makes the flat background transparent', async () => {
    const root = await makeTestRoot();
    const {req} = setup();
    const src = path.join(root, 'brands/demo/logo.png');
    await promisify(execFile)('python3', ['-c', `from PIL import Image, ImageDraw
im = Image.new('RGB', (40, 20), 'white'); ImageDraw.Draw(im).rectangle((10, 5, 29, 14), fill='red'); im.save('${src}')`]);
    const brand = path.join(root, 'brands/demo/brand.json');
    await writeFile(brand, JSON.stringify({...JSON.parse(await readFile(brand, 'utf8')), logo: 'logo.png'}));
    const r = await req('/api/brands/demo/logo-cutout', {method: 'POST'});
    expect(await r.json()).toMatchObject({logo: 'logo-nobg.png'});
    const {stdout} = await promisify(execFile)('python3', ['-c', `from PIL import Image; im = Image.open('${path.join(root, 'brands/demo/logo-nobg.png')}'); print(im.size, im.mode)`]);
    expect(stdout.trim()).toBe('(24, 14) RGBA');
    expect((await req('/api/brands/demo/logo-cutout', {method: 'POST'})).status).toBe(422); // already transparent
  });
});
