import {cp, mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setRepoRoot} from './paths.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');

export async function makeTestRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reel-test-'));
  await cp(path.join(REPO, 'config.json'), path.join(dir, 'config.json'));
  await mkdir(path.join(dir, 'brands/demo'), {recursive: true});
  await cp(path.join(REPO, 'brands/demo/brand.json'), path.join(dir, 'brands/demo/brand.json'));
  await mkdir(path.join(dir, 'projects/p1'), {recursive: true});
  await writeFile(path.join(dir, 'projects/p1/storyboard.json'), '{"scenes":[{"id":"s1","duration":2}]}');
  await mkdir(path.join(dir, 'library'), {recursive: true});
  await writeFile(path.join(dir, 'library/media-index.json'), '{}');
  for (const d of ['music', 'voices', 'inbox']) await mkdir(path.join(dir, d), {recursive: true});
  setRepoRoot(dir);
  return dir;
}
