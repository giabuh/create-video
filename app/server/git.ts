import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import {repoRoot, safeJoin, SLUG_RE} from './paths.ts';

const run = promisify(execFile);
const git = (args: string[]) => run('git', args, {cwd: repoRoot()});
const readOrNull = (f: string) => readFile(f).catch(() => null);

export async function approveCommit(slug: string, version: string): Promise<string | null> {
  if (!SLUG_RE.test(slug) || !/^reel-v\d+$/.test(version)) throw new Error('bad slug or version');
  const dir = `projects/${slug}`;
  const paths = [`${dir}/project.json`];
  const snap = await readOrNull(safeJoin('projects', slug, `${version}.storyboard.json`));
  if (snap) {
    paths.push(`${dir}/${version}.storyboard.json`);
    const sb = await readOrNull(safeJoin('projects', slug, 'storyboard.json'));
    if (sb && sb.equals(snap)) paths.push(`${dir}/storyboard.json`);
  }
  await git(['add', '--', ...paths]);
  try {
    await git(['commit', '-m', `Approve ${slug} ${version}`, '--', ...paths]);
  } catch (e) {
    const out = `${(e as {stdout?: string}).stdout ?? ''}${(e as {stderr?: string}).stderr ?? ''}`;
    if (/nothing (added )?to commit|no changes added/i.test(out)) return null;
    throw e;
  }
  return (await git(['rev-parse', '--short', 'HEAD'])).stdout.trim();
}

/** Commits the removal of every tracked file under projects/<slug>; null when nothing was tracked. */
export async function deleteProjectCommit(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) throw new Error('bad slug');
  const dir = `projects/${slug}`;
  // Not --cached: `commit -- <path>` re-reads the work tree and would undo a cache-only removal. The caller deletes the folder next anyway.
  await git(['rm', '-r', '-q', '--ignore-unmatch', '--', dir]);
  const staged = await git(['diff', '--cached', '--quiet', '--', dir]).then(() => false, (e: {code?: number}) => { if (e.code === 1) return true; throw e; });
  if (!staged) return null;
  try { await git(['commit', '-m', `Delete project ${slug}`, '--', dir]); } catch (e) {
    await git(['reset', '-q', 'HEAD', '--', dir]); await git(['checkout', '--', dir]); // put the tracked files back
    throw e;
  }
  return (await git(['rev-parse', '--short', 'HEAD'])).stdout.trim();
}
