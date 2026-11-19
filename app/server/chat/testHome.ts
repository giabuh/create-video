import {mkdir, mkdtemp, symlink, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Temp home dir shaped like the user's: ~/.claude plus ~/.claude-acc<N> dirs sharing projects/ via symlink. */
export async function makeClaudeHome(): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'reel-claude-home-'));
  const main = path.join(home, '.claude');
  await mkdir(path.join(main, 'projects'), {recursive: true});
  await writeFile(path.join(main, '.credentials.json'), '{}');
  const acc = async (n: number, {creds = true, link = true} = {}) => {
    const d = path.join(home, `.claude-acc${n}`);
    await mkdir(d, {recursive: true});
    if (creds) await writeFile(path.join(d, '.credentials.json'), '{}');
    if (link) await symlink(path.join(main, 'projects'), path.join(d, 'projects'));
    else await mkdir(path.join(d, 'projects'));
  };
  await acc(2);
  await acc(3, {creds: false});
  await acc(4, {link: false});
  await acc(10);
  await mkdir(path.join(home, '.codex'), {recursive: true});
  await writeFile(path.join(home, '.codex', 'auth.json'), '{}');
  return home;
}
