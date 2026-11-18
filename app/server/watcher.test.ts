import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {EventBus} from './events.ts';
import {makeTestRoot} from './testRoot.ts';
import {startWatcher} from './watcher.ts';

let stop: (() => void) | null = null;
afterEach(() => { stop?.(); stop = null; });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function setup() {
  const dir = await makeTestRoot();
  await mkdir(path.join(dir, 'studio/src/motion'), {recursive: true});
  const bus = new EventBus(); const paths: string[] = [];
  bus.subscribe(e => { if (e.type === 'changed') paths.push(e.path); });
  stop = startWatcher(bus);
  await sleep(100);
  return {dir, paths};
}

describe('watcher', () => {
  it('emits for studio, project and config files', async () => {
    const {dir, paths} = await setup();
    await writeFile(path.join(dir, 'studio/src/motion/X.tsx'), 'x');
    await writeFile(path.join(dir, 'projects/p1/storyboard.json'), '{}');
    await writeFile(path.join(dir, 'config.json'), '{}');
    await sleep(600);
    expect(paths).toContain('studio/src/motion/X.tsx');
    expect(paths).toContain('projects/p1/storyboard.json');
    expect(paths).toContain('config.json');
  });
  it('ignores tmp, preview and uploads', async () => {
    const {dir, paths} = await setup();
    await mkdir(path.join(dir, 'projects/p1/preview'), {recursive: true});
    await mkdir(path.join(dir, 'voices/_uploads'), {recursive: true});
    await sleep(300); paths.length = 0;
    await writeFile(path.join(dir, 'projects/p1/x.json.tmp'), '{}');
    await writeFile(path.join(dir, 'projects/p1/preview/a.png'), 'x');
    await writeFile(path.join(dir, 'voices/_uploads/a.wav'), 'x');
    await sleep(500);
    expect(paths).toEqual([]);
  });
  it('survives a removed watched dir', async () => {
    const {dir} = await setup();
    await rm(path.join(dir, 'brands'), {recursive: true});
    await sleep(300);
    expect(true).toBe(true); // an unhandled watcher error would fail the run
  });
});
