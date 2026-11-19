import {readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {repoRoot} from './paths.ts';
import {renderVersion} from './render.ts';
import {makeTestRoot} from './testRoot.ts';
import {EventBus} from './events.ts';
import {JobQueue} from './jobs.ts';
import type {JobSpec} from './jobs.ts';
import type {ServerEvent} from '../shared/types.ts';

const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
const spec = (over: Partial<JobSpec> & {run: JobSpec['run']}): JobSpec => ({kind: 'render', lane: 'render', label: 'x', cancellable: true, ...over});
const gate = () => { let open!: () => void; const p = new Promise<void>(r => { open = r; }); return {p, open}; };

describe('JobQueue', () => {
  it('runs a lane sequentially and lanes in parallel', async () => {
    const q = new JobQueue(new EventBus());
    const order: string[] = [];
    const g = gate();
    q.enqueue(spec({run: async () => { order.push('a1'); await g.p; order.push('a2'); }}));
    q.enqueue(spec({run: async () => { order.push('b'); }}));
    q.enqueue(spec({lane: 'gpu', run: async () => { order.push('gpu'); }}));
    await tick();
    expect(order).toEqual(['a1', 'gpu']);
    g.open(); await tick();
    expect(order).toEqual(['a1', 'gpu', 'a2', 'b']);
  });

  it('emits progress throttled, final state always, and computes eta', async () => {
    const bus = new EventBus(); const events: ServerEvent[] = [];
    bus.subscribe(e => events.push(e));
    const q = new JobQueue(bus);
    const g = gate();
    q.enqueue(spec({run: async ctx => {
      ctx.progress(0.01, 'a');
      expect(q.get(q.list()[0].id)!.etaSeconds).toBeNull();
      await tick(1100);
      ctx.progress(0.5, 'x');
      expect(q.get(q.list()[0].id)).toMatchObject({progress: 0.5, step: 'x', etaSeconds: 1});
      for (let i = 0; i < 20; i++) ctx.progress(0.5 + i / 100);
      await g.p;
      return {k: 1};
    }}));
    await tick(1300);
    const n = events.length;
    g.open(); await tick();
    expect(events.length).toBeGreaterThan(n);
    const last = events.at(-1) as Extract<ServerEvent, {type: 'job'}>;
    expect(last.job).toMatchObject({state: 'done', result: {k: 1}});
    expect(events.filter(e => e.type === 'job').length).toBeLessThan(10);
  });

  it('fails with message and log', async () => {
    const q = new JobQueue(new EventBus());
    const j = q.enqueue(spec({run: async ctx => { ctx.log('l1'); throw new Error('boom'); }}));
    await tick();
    expect(q.get(j.id)).toMatchObject({state: 'failed', error: 'boom', log: ['l1']});
  });

  it('cancels queued, running cancellable, rejects non-cancellable', async () => {
    const q = new JobQueue(new EventBus());
    const g = gate(); let ran = false; let sig!: AbortSignal;
    const a = q.enqueue(spec({run: async ctx => { sig = ctx.signal; await g.p; }}));
    const b = q.enqueue(spec({run: async () => { ran = true; }}));
    await tick();
    expect(q.cancel(b.id).state).toBe('cancelled');
    q.cancel(a.id);
    expect(sig.aborted).toBe(true);
    g.open(); await tick();
    expect(q.get(a.id)!.state).toBe('cancelled');
    expect(ran).toBe(false);
    const g2 = gate();
    const c = q.enqueue(spec({cancellable: false, run: async () => { await g2.p; }}));
    await tick();
    expect(() => q.cancel(c.id)).toThrow('not cancellable');
    g2.open(); await tick();
  });
});

describe('renderVersion cleanup', () => {
  const stub = (fn: () => Promise<void> | void) => ({request: async () => { await fn(); return {ok: true}; }}) as never;
  const files = async () => (await readdir(path.join(repoRoot(), 'projects/p1'))).sort();

  it('abort during voice generation leaves no mp4 and no snapshot', async () => {
    await makeTestRoot();
    const ac = new AbortController();
    const ctx = {progress() {}, log() {}, signal: ac.signal};
    await expect(renderVersion('p1', ctx, stub(() => ac.abort()))).rejects.toThrow();
    expect(await files()).toEqual(['storyboard.json']);
  });

  it('storyboard edited twice during voice generation fails without a snapshot', async () => {
    await makeTestRoot();
    const ctx = {progress() {}, log() {}, signal: new AbortController().signal};
    let i = 0;
    await expect(renderVersion('p1', ctx, stub(() => writeFile(path.join(repoRoot(), 'projects/p1/storyboard.json'), `{"scenes":[],"n":${i++}}`)))).rejects.toThrow(/Storyboard thay đổi/);
    expect(await files()).toEqual(['storyboard.json']);
  });
});
