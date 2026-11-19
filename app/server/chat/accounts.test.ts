import path from 'node:path';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import {describe, expect, it} from 'vitest';
import {childEnv, listAccounts} from './accounts.ts';
import {makeClaudeHome} from './testHome.ts';

describe('listAccounts', () => {
  it('keeps only usable accounts, numeric order', async () => {
    const home = await makeClaudeHome();
    expect(await listAccounts(home)).toEqual([
      {name: 'claude', engine: 'claude', configDir: null},
      {name: 'claude2', engine: 'claude', configDir: path.join(home, '.claude-acc2')},
      {name: 'claude10', engine: 'claude', configDir: path.join(home, '.claude-acc10')},
      {name: 'codex', engine: 'codex', configDir: null},
    ]);
  });
  it('empty home → no accounts', async () => {
    expect(await listAccounts(await mkdtemp(path.join(os.tmpdir(), 'reel-empty-')))).toEqual([]);
  });
});

describe('childEnv', () => {
  const base = {PATH: '/bin', HOME: '/h', CLAUDE_CONFIG_DIR: '/h/.claude-acc3', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'x', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_EFFORT: 'high'};
  it('default account drops CLAUDE_CONFIG_DIR and parent session vars', () => {
    expect(childEnv({name: 'claude', engine: 'claude', configDir: null}, base)).toEqual({PATH: '/bin', HOME: '/h', CLAUDE_EFFORT: 'high'});
  });
  it('numbered account sets CLAUDE_CONFIG_DIR', () => {
    expect(childEnv({name: 'claude2', engine: 'claude', configDir: '/h/.claude-acc2'}, base).CLAUDE_CONFIG_DIR).toBe('/h/.claude-acc2');
  });
});
