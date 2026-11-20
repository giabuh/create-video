import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {setRunner, type Runner} from '../drive.ts';
import {makeTestRoot} from '../testRoot.ts';
import {setup, settle} from './testApp.ts';

let root: string;
const calls: string[][] = [];
const fake = (h: (args: string[]) => {code: number; out?: string; err?: string}, lines: string[] = []) => {
  const r: Runner = async (args, onLine) => { calls.push(args); lines.forEach(l => onLine?.(l)); const x = h(args); return {code: x.code, out: x.out ?? '', err: x.err ?? ''}; };
  setRunner(r);
};
beforeEach(async () => { calls.length = 0; root = await makeTestRoot(); });

describe('GET /sync/status', () => {
  it('counts --combined lines per folder', async () => {
    fake(a => (a[1].endsWith('/library') ? {code: 1, out: '+ a.mp4\n+ b.mp4\n- c.mp4\n* d.mp4\n= e.mp4\n= f.mp4\n', err: 'NOTICE: 3 differences found'} : {code: 0, out: '= x\n'}));
    const s = await (await setup().req('/api/sync/status')).json();
    expect(s.error).toBeNull();
    expect(s.folders).toHaveLength(4);
    expect(s.folders[0]).toEqual({name: 'library', localOnly: 2, driveOnly: 1, differ: 1, same: 2});
    expect(s.folders[1]).toEqual({name: 'music', localOnly: 0, driveOnly: 0, differ: 0, same: 1});
    expect(s.lastPush).toBeNull();
    expect(calls[0].slice(0, 1)).toEqual(['check']);
    expect(calls[0]).toContain('--combined');
  });
  it('missing remote dir (exit 1 + differences) = everything localOnly', async () => {
    fake(() => ({code: 1, out: '+ a.jpg\n+ b.jpg\n', err: 'Failed to check with 2 errors: last error was: 2 differences found'}));
    const s = await (await setup().req('/api/sync/status')).json();
    expect(s.error).toBeNull();
    expect(s.folders[0].localOnly).toBe(2);
  });
  it('other non-zero exit -> error', async () => {
    fake(() => ({code: 1, err: `Failed to create file system for "x:y": didn't find section in config file`}));
    const s = await (await setup().req('/api/sync/status')).json();
    expect(s.error).toMatch(/rclone/);
  });
});

describe('POST /sync/push|pull', () => {
  it('push: copies each folder with --update, stores lastPush, result is a fresh status', async () => {
    fake(a => (a[0] === 'check' ? {code: 0, out: '= x\n'} : {code: 0}), ['{"stats":{"bytes":5,"totalBytes":10,"transfers":1,"totalTransfers":2}}']);
    const t = setup();
    const res = await t.req('/api/sync/push', {method: 'POST'});
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job).toMatchObject({kind: 'sync', ref: 'push', lane: 'io', cancellable: true, label: 'Đẩy thư viện lên Drive'});
    const done = await settle(t.jobs, job.id);
    expect(done.state).toBe('done');
    const copies = calls.filter(a => a[0] === 'copy');
    expect(copies).toHaveLength(4);
    expect(copies[0][1]).toBe(path.join(root, 'library'));
    expect(copies[0][2]).toMatch(/\/library$/);
    expect(copies[0]).toContain('--update');
    expect((done.result as {lastPush: number}).lastPush).toBeGreaterThan(0);
    expect(JSON.parse(await readFile(path.join(root, 'app/.data/sync-state.json'), 'utf8')).lastPush).toBeGreaterThan(0);
  });
  it('step text shows folder, files and stats', async () => {
    const t = setup();
    let seen = '';
    setRunner(async (args, onLine) => {
      if (args[0] === 'copy' && !seen) { onLine?.('{"stats":{"bytes":5000000,"totalBytes":10000000,"transfers":1,"totalTransfers":2,"speed":1000000}}'); seen = t.jobs.running('sync')[0].step; }
      return {code: 0, out: '', err: ''};
    });
    const job = await (await t.req('/api/sync/push', {method: 'POST'})).json();
    await settle(t.jobs, job.id);
    expect(seen).toBe('library (1/4) · 1/2 file · 5/10 MB · 1 MB/s');
  });
  it('pull: exit 3 on a folder is skipped; other errors fail the job', async () => {
    fake(a => (a[0] === 'copy' && a[1].endsWith('/reference') ? {code: 3} : {code: 0}));
    const t = setup();
    const job = await (await t.req('/api/sync/pull', {method: 'POST'})).json();
    expect(job.ref).toBe('pull');
    const done = await settle(t.jobs, job.id);
    expect(done.state).toBe('done');
    expect(calls.find(a => a[0] === 'copy')![1]).toMatch(/\/library$/); // pull: remote is the source
    expect(JSON.parse(await readFile(path.join(root, 'app/.data/sync-state.json'), 'utf8')).lastPull).toBeGreaterThan(0);

    fake(a => (a[0] === 'copy' ? {code: 3} : {code: 0}));
    const j2 = await (await t.req('/api/sync/push', {method: 'POST'})).json();
    expect((await settle(t.jobs, j2.id)).state).toBe('failed'); // push exit 3 is a real error

    fake(a => (a[0] === 'copy' ? {code: 1, err: '{"level":"error","msg":"quota"}'} : {code: 0}));
    const j3 = await (await t.req('/api/sync/pull', {method: 'POST'})).json();
    const f = await settle(t.jobs, j3.id);
    expect(f).toMatchObject({state: 'failed', error: 'quota'});
  });
  it('409 while a sync job is active', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    setRunner(async a => { if (a[0] === 'copy') await gate; return {code: 0, out: '', err: ''}; });
    const t = setup();
    const job = await (await t.req('/api/sync/push', {method: 'POST'})).json();
    expect((await t.req('/api/sync/pull', {method: 'POST'})).status).toBe(409);
    release();
    await settle(t.jobs, job.id);
    expect((await t.req('/api/sync/pull', {method: 'POST'})).status).toBe(202);
  });
  it('cancel aborts rclone, job is cancelled, sync-state not written', async () => {
    let started!: () => void;
    const go = new Promise<void>(r => { started = r; });
    setRunner((a, _l, signal) => new Promise(res => {
      if (a[0] !== 'copy') return res({code: 0, out: '', err: ''});
      started();
      signal?.addEventListener('abort', () => res({code: 1, out: '', err: ''}));
    }));
    const t = setup();
    const job = await (await t.req('/api/sync/push', {method: 'POST'})).json();
    await go;
    t.jobs.cancel(job.id);
    expect((await settle(t.jobs, job.id)).state).toBe('cancelled');
    await expect(readFile(path.join(root, 'app/.data/sync-state.json'), 'utf8')).rejects.toThrow();
  });
  it('status: exit 1 with a real last error is not treated as differences', async () => {
    fake(() => ({code: 1, out: '+ a\n', err: 'NOTICE: 1 differences found\nFailed to check with 2 errors: last error was: directory not found'}));
    const s = await (await setup().req('/api/sync/status')).json();
    expect(s.error).toBeTruthy();
  });
});
