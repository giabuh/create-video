import {readdir, readFile, utimes} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {Conflict, readJson, readJsonOr, writeJsonAtomic} from './store.ts';
import {makeTestRoot} from './testRoot.ts';

describe('store', () => {
  it('round-trips Vietnamese unescaped, 2-space, trailing newline', async () => {
    const dir = await makeTestRoot(); const f = path.join(dir, 'a/b.json');
    const m = await writeJsonAtomic(f, {t: 'Đăng ký'});
    const text = await readFile(f, 'utf8');
    expect(text).toBe('{\n  "t": "Đăng ký"\n}\n');
    expect(await readJson(f)).toEqual({data: {t: 'Đăng ký'}, mtime: m});
  });
  it('readJsonOr missing', async () => {
    const dir = await makeTestRoot();
    expect(await readJsonOr(path.join(dir, 'nope.json'), {x: 1})).toEqual({data: {x: 1}, mtime: 0});
  });
  it('Conflict on stale mtime carries current data', async () => {
    const dir = await makeTestRoot(); const f = path.join(dir, 'c.json');
    await writeJsonAtomic(f, {v: 1});
    await utimes(f, new Date(), new Date(Date.now() + 5000));
    const err = await writeJsonAtomic(f, {v: 2}, 1).catch(e => e);
    expect(err).toBeInstanceOf(Conflict);
    expect(err.current).toEqual({v: 1});
    const cur = await readJson(f);
    await expect(writeJsonAtomic(f, {v: 3}, cur.mtime)).resolves.toBeTypeOf('number');
  });
  it('concurrent writes stay valid, no tmp left', async () => {
    const dir = await makeTestRoot(); const f = path.join(dir, 'd.json');
    await Promise.all(Array.from({length: 20}, (_, i) => writeJsonAtomic(f, {i})));
    expect(JSON.parse(await readFile(f, 'utf8'))).toHaveProperty('i');
    expect((await readdir(dir)).filter(n => n.endsWith('.tmp'))).toEqual([]);
  });
});
