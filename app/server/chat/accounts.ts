import {lstat, readdir, readFile, realpath, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {ChatModelOption, ChatModels, Engine} from '../../shared/types.ts';
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

const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const CLAUDE_MODELS: ChatModelOption[] = ['opus', 'sonnet', 'haiku'].map(value => ({value, efforts: CLAUDE_EFFORTS})); // claude --model aliases

/** Codex keeps its model list in ~/.codex/models_cache.json and refreshes it itself; only models it shows in its picker. */
async function codexModels(home: string): Promise<ChatModelOption[]> {
  try {
    const d = JSON.parse(await readFile(path.join(home, '.codex', 'models_cache.json'), 'utf8'));
    const list: unknown[] = Array.isArray(d?.models) ? d.models : [];
    return list.flatMap((m: any) => m?.visibility === 'list' && typeof m.slug === 'string'
      ? [{value: m.slug, efforts: (m.supported_reasoning_levels ?? []).map((e: any) => e?.effort).filter((e: unknown) => typeof e === 'string')}] : []);
  } catch { return []; } // no cache yet: only the default model is offered
}

export async function chatModels(home: string = claudeHome()): Promise<ChatModels> {
  return {claude: CLAUDE_MODELS, codex: await codexModels(home)};
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
