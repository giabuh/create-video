import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTestRoot} from '../testRoot.ts';
import {setup} from './testApp.ts';

describe('settings routes', () => {
  it('config get/put with conflict', async () => {
    await makeTestRoot();
    const {req} = setup();
    const cfg = await (await req('/api/config')).json();
    expect((await req('/api/config', {method: 'PUT', json: {config: cfg.data, baseMtime: cfg.mtime - 5000}})).status).toBe(409);
    expect((await req('/api/config', {method: 'PUT', json: {config: {x: 1}, baseMtime: cfg.mtime}})).status).toBe(400);
    const ok = await req('/api/config', {method: 'PUT', json: {config: {...cfg.data, music: {...cfg.data.music, volume: 0.3}}, baseMtime: cfg.mtime}});
    expect(ok.status).toBe(200);
  });
  it('brands', async () => {
    await makeTestRoot();
    const {req} = setup();
    const list = await (await req('/api/brands')).json();
    expect(list).toMatchObject([{id: 'demo', isDefault: true}]);
    const r = await req('/api/brands', {method: 'POST', json: {name: 'Trung tâm B'}});
    expect(r.status).toBe(201);
    const b = await r.json();
    expect(b).toMatchObject({id: 'trung-tam-b', isDefault: false, brand: {name: 'Trung tâm B', logo: null, colors: list[0].brand.colors}});
    expect((await req('/api/brands', {method: 'POST', json: {name: 'Trung tâm B'}})).status).toBe(409);
    const put = (id: string, baseMtime: number) => req(`/api/brands/${id}`, {method: 'PUT', json: {brand: b.brand, baseMtime}});
    expect((await put('trung-tam-b', b.mtime)).status).toBe(200);
    expect((await put('trung-tam-b', b.mtime - 5000)).status).toBe(409);
    expect((await put('missing', 1)).status).toBe(404);
    expect((await req('/api/brands/demo', {method: 'DELETE'})).status).toBe(409); // default brand
    expect((await req('/api/brands/missing', {method: 'DELETE'})).status).toBe(404);
    expect((await req('/api/brands/trung-tam-b', {method: 'DELETE'})).status).toBe(200);
    expect((await (await req('/api/brands')).json()).map((x: {id: string}) => x.id)).toEqual(['demo']);
  });
  it('brand optional colors round-trip', async () => {
    await makeTestRoot();
    const {req} = setup();
    const b = await (await req('/api/brands')).json().then((l: {brand: {colors: object}; mtime: number}[]) => l[0]);
    const brand = {...b.brand, colors: {...b.brand.colors, accent2: '#E11D2E', surface: '#FFFFFF'}};
    expect((await req('/api/brands/demo', {method: 'PUT', json: {brand, baseMtime: b.mtime}})).status).toBe(200);
    expect((await (await req('/api/brands')).json())[0].brand.colors).toMatchObject({accent2: '#E11D2E', surface: '#FFFFFF'});
  });
  it('templates and motion', async () => {
    const root = await makeTestRoot();
    await mkdir(path.join(root, 'studio/src/templates/fast-cut'), {recursive: true});
    await mkdir(path.join(root, 'studio/src/motion'), {recursive: true});
    for (const f of ['KineticText.tsx', 'CountUp.tsx', 'Checklist.tsx', 'registry.ts', 'schema.ts']) await writeFile(path.join(root, 'studio/src/motion', f), '');
    const {req} = setup();
    expect(await (await req('/api/templates')).json()).toEqual(['fast-cut']);
    expect(await (await req('/api/motion')).json()).toEqual(['Checklist', 'CountUp', 'KineticText']);
  });
});
