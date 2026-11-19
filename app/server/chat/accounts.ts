import {lstat, readdir, realpath, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {Engine} from '../../shared/types.ts';
export type Account = {name: string; engine: Engine; configDir: string | null};
export const claudeHome = (): string => process.env.REEL_CLAUDE_HOME ?? os.homedir();

const exists = (p: string) => stat(p).then(() => true, () => false);
const real = (p: string) => realpath(p).catch(() => null);

export async function listAccounts(home: string = claudeHome()): Promise<Account[]> {
  const out: Account[] = [];
  if (await exists(path.join(home, '.claude', '.credentials.json'))) out.push({name: 'claude', engine: 'claude', configDir: null});
  const shared = await real(path.join(home, '.claude', 'projects'));
  const dirs = (await readdir(home).catch(() => [] as string[]))
    .map(n => /^\.claude-acc(\d+)$/.exec(n)).filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  for (const m of dirs) {
    const dir = path.join(home, m[0]);
    if (!(await exists(path.join(dir, '.credentials.json')))) continue;
    const link = await lstat(path.join(dir, 'projects')).catch(() => null);
    // transcripts must be shared, or --resume on another account fails
    if (!link?.isSymbolicLink() || !shared || (await real(path.join(dir, 'projects'))) !== shared) continue;
    out.push({name: `claude${m[1]}`, engine: 'claude', configDir: dir});
  }
  if (await exists(path.join(home, '.codex', 'auth.json'))) out.push({name: 'codex', engine: 'codex', configDir: null}); // codex uses ~/.codex, CODEX_HOME untouched
  return out;
}

// Set when the app is started from inside a Claude Code session; a child must not inherit them.
const STRIP = ['CLAUDE_CONFIG_DIR', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_SESSION_ATTENDED', 'CLAUDE_CODE_CHILD_NOTES_DIR',
  'CLAUDE_CODE_EXECPATH', 'CLAUDE_PID', 'AI_AGENT'];

export function childEnv(acc: Account, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = {...base};
  for (const k of STRIP) delete env[k];
  if (acc.configDir) env.CLAUDE_CONFIG_DIR = acc.configDir;
  return env;
}
