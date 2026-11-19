// Starts the app on test ports with a fake claude CLI, a temp home and a temp chat dir.
import {spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = mkdtempSync(path.join(os.tmpdir(), 'reel-e2e-home-'));
const chats = mkdtempSync(path.join(os.tmpdir(), 'reel-e2e-chats-'));
mkdirSync(path.join(home, '.claude', 'projects'), {recursive: true});
writeFileSync(path.join(home, '.claude', '.credentials.json'), '{}');
mkdirSync(path.join(home, '.claude-acc2'));
writeFileSync(path.join(home, '.claude-acc2', '.credentials.json'), '{}');
symlinkSync(path.join(home, '.claude', 'projects'), path.join(home, '.claude-acc2', 'projects'));
mkdirSync(path.join(home, '.codex'));
writeFileSync(path.join(home, '.codex', 'auth.json'), '{}');

const child = spawn('npm', ['start'], {cwd: root, stdio: 'inherit', env: {
  ...process.env, NO_OPEN: '1', REEL_API_PORT: '5336', REEL_UI_PORT: '5337',
  REEL_CLAUDE_BIN: path.join(root, 'server/chat/fake-claude.mjs'), REEL_CODEX_BIN: path.join(root, 'server/chat/fake-codex.mjs'), REEL_CLAUDE_HOME: home, REEL_CHAT_DIR: chats,
}});
// Playwright signals our whole process group, so npm's grandchildren (api, vite) get the signal too
const stop = (sig) => () => child.kill(sig);
process.on('SIGINT', stop('SIGINT'));
process.on('SIGTERM', stop('SIGTERM'));
child.on('exit', (code) => {
  rmSync(home, {recursive: true, force: true});
  rmSync(chats, {recursive: true, force: true});
  process.exit(code ?? 0);
});
