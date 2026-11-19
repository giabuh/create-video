import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {approveCommit, deleteProjectCommit} from './git.ts';
import {setRepoRoot} from './paths.ts';

let dir = '';
const git = (...a: string[]) => execFileSync('git', a, {cwd: dir, encoding: 'utf8'});
const put = (f: string, s: string) => writeFile(path.join(dir, f), s);
const lastFiles = () => git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort();

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'reel-git-'));
  git('init', '-q'); git('config', 'user.name', 't'); git('config', 'user.email', 't@t');
  await mkdir(path.join(dir, 'projects/p1'), {recursive: true});
  await put('projects/p1/storyboard.json', '{"a":1}');
  git('add', '-A'); git('commit', '-qm', 'init');
  setRepoRoot(dir);
});

describe('approveCommit', () => {
  it('commits project.json, snapshot and identical storyboard', async () => {
    await put('projects/p1/reel-v1.storyboard.json', '{"a":1}');
    await put('projects/p1/project.json', '{"approved":"reel-v1"}');
    const sha = await approveCommit('p1', 'reel-v1');
    expect(sha).toMatch(/^[0-9a-f]{7,}$/);
    expect(lastFiles()).toEqual(['projects/p1/project.json', 'projects/p1/reel-v1.storyboard.json']);
    // storyboard identical => included only if it has changes; here unchanged so absent
  });

  it('includes storyboard when it changed and equals the snapshot', async () => {
    await put('projects/p1/storyboard.json', '{"a":2}');
    await put('projects/p1/reel-v1.storyboard.json', '{"a":2}');
    await put('projects/p1/project.json', '{}');
    await approveCommit('p1', 'reel-v1');
    expect(lastFiles()).toHaveLength(3);
  });

  it('leaves a storyboard edited after the snapshot alone', async () => {
    await put('projects/p1/reel-v1.storyboard.json', '{"a":1}');
    await put('projects/p1/storyboard.json', '{"a":3}');
    await put('projects/p1/project.json', '{}');
    await approveCommit('p1', 'reel-v1');
    expect(lastFiles()).toEqual(['projects/p1/project.json', 'projects/p1/reel-v1.storyboard.json']);
    expect(git('status', '--porcelain')).toBe(' M projects/p1/storyboard.json\n');
  });

  it('returns null when nothing changed', async () => {
    await put('projects/p1/project.json', '{}');
    expect(await approveCommit('p1', 'reel-v1')).toMatch(/^[0-9a-f]+$/);
    expect(await approveCommit('p1', 'reel-v1')).toBeNull();
  });

  it('ignores unrelated staged files', async () => {
    await put('other.txt', 'x'); git('add', 'other.txt');
    await put('projects/p1/project.json', '{}');
    await approveCommit('p1', 'reel-v1');
    expect(lastFiles()).toEqual(['projects/p1/project.json']);
    expect(git('status', '--porcelain')).toBe('A  other.txt\n');
  });

  it('rejects bad slug or version before running git', async () => {
    await expect(approveCommit('../x', 'reel-v1')).rejects.toThrow();
    await expect(approveCommit('p1', 'v1; rm')).rejects.toThrow();
  });
});

describe('deleteProjectCommit', () => {
  it('commits removal of tracked files and returns sha', async () => {
    const sha = await deleteProjectCommit('p1');
    expect(sha).toMatch(/^[0-9a-f]{7,}$/);
    expect(git('log', '-1', '--format=%s').trim()).toBe('Delete project p1');
    expect(lastFiles()).toEqual(['projects/p1/storyboard.json']);
  });
  it('returns null for an untracked-only project', async () => {
    await mkdir(path.join(dir, 'projects/p2'), {recursive: true});
    await put('projects/p2/a.json', '{}');
    expect(await deleteProjectCommit('p2')).toBeNull();
  });
  it('succeeds with uncommitted project.json edits and commits only the project', async () => {
    await put('projects/p1/project.json', '{}');
    git('add', '-A'); git('commit', '-qm', 'pj');
    await put('projects/p1/project.json', '{"deleting":1}');
    await put('other.txt', 'o');
    git('add', 'other.txt');
    expect(await deleteProjectCommit('p1')).toMatch(/^[0-9a-f]{7,}$/);
    expect(lastFiles()).toEqual(['projects/p1/project.json', 'projects/p1/storyboard.json']);
    expect(git('diff', '--cached', '--name-only').trim()).toBe('other.txt');
  });
  it('failed commit keeps uncommitted edits and stages nothing', async () => {
    await put('projects/p1/project.json', '{}');
    git('add', '-A'); git('commit', '-qm', 'pj');
    await writeFile(path.join(dir, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n', {mode: 0o755});
    await put('projects/p1/project.json', '{"deleting":1}');
    await put('projects/p1/storyboard.json', '{"a":99}');
    await expect(deleteProjectCommit('p1')).rejects.toThrow();
    expect(await readFile(path.join(dir, 'projects/p1/project.json'), 'utf8')).toBe('{"deleting":1}');
    expect(await readFile(path.join(dir, 'projects/p1/storyboard.json'), 'utf8')).toBe('{"a":99}');
    expect(git('diff', '--cached', '--name-only').trim()).toBe('');
  });
});
