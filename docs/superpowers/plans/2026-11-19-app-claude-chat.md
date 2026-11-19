# In-app Claude Chat (3A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chat panel in the reel app that drives the local `claude` CLI headless, with a per-chat account picker (`claude`, `claude2`, `claude3`).

**Architecture:** One `claude -p --output-format stream-json` process per turn, spawned by the Hono server with `CLAUDE_CONFIG_DIR` set for the picked account; its stdout is parsed into normalized `ChatEvent`s, persisted as JSONL under `app/.data/chats/`, and pushed to the browser over the existing SSE bus. The React app shows it in a global right-hand `Drawer`.

**Tech Stack:** Node 24 (TS run directly, `node server/index.ts`), Hono 4, React 19, TanStack Query 5, radix-ui, vitest 5 (node env), Playwright 1.65.

Spec: `docs/superpowers/specs/2026-11-19-app-claude-chat-design.md`.

## Global Constraints

- Spawn flags, exactly: `-p --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions`, then `--session-id <id>` (first turn) or `--resume <id>`, then `--append-system-prompt <text>`. cwd = `repoRoot()`. Prompt goes to **stdin**, never argv.
- Account `claude` = child env **without** `CLAUDE_CONFIG_DIR`; `claude<N>` = `CLAUDE_CONFIG_DIR=<home>/.claude-acc<N>`. Strip the parent's Claude session vars from the child env (list in Task 2).
- Usage limit: the turn ends with an `error` carrying `limit`. No auto failover, no switch button. The user changes the picker and sends again; the next turn `--resume`s the same session.
- One running turn app-wide; a second send → HTTP 409.
- Chat storage dir: `process.env.REEL_CHAT_DIR ?? <repoRoot>/app/.data/chats` (gitignored). Chat `id` is the Claude session id (uuid v4 from `crypto.randomUUID()`).
- Env overrides for tests: `REEL_CLAUDE_BIN` (binary path, default `claude`), `REEL_CLAUDE_HOME` (home dir, default `os.homedir()`), `REEL_CHAT_DIR`.
- No test spends real Claude quota: unit/route/E2E tests use `app/server/chat/fake-claude.mjs`.
- No new npm dependencies.
- UI copy is Vietnamese; code, comments, commit messages English. Commit messages: one line, no body, no Co-Authored-By.
- Testing cadence: per task run only the touched tests + `cd app && npx tsc --noEmit`. Full suite once at final review.
- Workers sharing the tree stage only their own files by explicit path (`git add <paths>`), never `git add -A`.

## File map

| File | Task | Responsibility |
|---|---|---|
| `app/shared/types.ts` (modify) | 1 | `ChatEvent`, `LimitInfo`, `ChatAccount`, `ChatMeta`, `ChatDetail`, new `ServerEvent` variants |
| `app/src/api/events.ts` (modify) | 1, 5 | T1: narrow the `worker` branch; T5: route chat events |
| `app/server/chat/stream.ts` (+test, fixture) | 1 | Pure parser: one stream-json line → `Parsed` |
| `app/server/chat/accounts.ts` (+test) | 2 | Detect accounts, build child env |
| `app/server/chat/testHome.ts` | 2 | Test helper: temp home with fake accounts |
| `app/server/chat/fake-claude.mjs` | 3 | Executable test double of the CLI |
| `app/server/chat/runner.ts` (+test) | 3 | `runTurn`: spawn, parse, abort, exactly one terminal event |
| `app/server/chat/store.ts` | 4 | Index + JSONL persistence |
| `app/server/chat/service.ts` | 4 | `ChatService`: lock, send/stop, limits, bus events |
| `app/server/routes/chats.ts` (+test) | 4 | HTTP routes + validation |
| `app/server/routes/util.ts`, `testApp.ts`, `app.ts`, `index.ts`, `/.gitignore` (modify) | 4 | Wiring |
| `app/src/api/chat.ts` | 5 | Query hooks, live busy/draft store |
| `app/src/shell/chatView.ts` (+test) | 5 | Pure view helpers |
| `app/src/shell/ChatPanel.tsx`, `ChatPanel.module.css` | 5 | Drawer UI |
| `app/src/shell/Layout.tsx`, `Sidebar.tsx`, `Rail.tsx` (modify) | 5 | Chat button + panel mount |
| `app/e2e-chat/serve.mjs`, `app/e2e-chat/chat.spec.ts`, `app/playwright.chat.config.ts`, `app/package.json` | 6 | E2E against the fake CLI |

## Dependencies / parallelism

- Wave 1: Task 1 ‖ Task 2
- Wave 2: Task 3 (needs 1, 2) ‖ Task 5 (needs 1 only: it codes against the HTTP contract in Task 4)
- Wave 3: Task 4 (needs 3)
- Wave 4: Task 6 (needs 4, 5)

## HTTP contract (Task 4 implements, Task 5 consumes)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/chat/accounts` | – | `ChatAccount[]` |
| GET | `/api/chats` | – | `ChatMeta[]` newest `updatedAt` first |
| POST | `/api/chats` | `{slug: string \| null}` | 201 `ChatMeta` |
| GET | `/api/chats/:id` | – | `ChatDetail` or 404 |
| POST | `/api/chats/:id/messages` | `{text, account, screen, slug}` | 202 empty; 400 validation/unknown account; 404 chat; 409 busy |
| POST | `/api/chats/:id/stop` | – | 204; 409 if that chat is not running |

SSE (`/api/events`): `{type:'chat', chatId, event: ChatEvent}` (persisted events are emitted **after** they are written; `delta` immediately) and `{type:'chatBusy', chatId: string | null}`; the connect snapshot includes the current `chatBusy`.

---

### Task 1: Shared types + stream-json parser

**Agent:** worker-sonnet (pure function, fully specified).

**Files:**
- Modify: `app/shared/types.ts` (near `ServerEvent`, ~line 75)
- Modify: `app/src/api/events.ts` (the final `else` in `onEvent`, ~line 79)
- Create: `app/server/chat/stream.ts`
- Create: `app/server/chat/fixtures/turn.jsonl`
- Test: `app/server/chat/stream.test.ts`

**Interfaces:**
- Produces (types, in `app/shared/types.ts`):

```ts
export type LimitInfo = {status: string; resetsAt: number | null; utilization: number | null; type: string | null}; // resetsAt = epoch seconds
export type ChatEvent =
  | {kind: 'user'; text: string; account: string; at: number}
  | {kind: 'delta'; text: string}
  | {kind: 'text'; text: string}
  | {kind: 'tool'; name: string; summary: string}
  | {kind: 'done'; costUsd: number | null; durationMs: number | null}
  | {kind: 'error'; message: string; limit?: {account: string; resetsAt: number | null}};
export type ChatAccount = {name: string; limit: LimitInfo | null};
export type ChatMeta = {id: string; title: string; account: string; slug: string | null; started: boolean; createdAt: number; updatedAt: number};
export type ChatDetail = {chat: ChatMeta; events: ChatEvent[]};
```

and `ServerEvent` gains `| {type: 'chat'; chatId: string; event: ChatEvent} | {type: 'chatBusy'; chatId: string | null}`.
- Produces (`app/server/chat/stream.ts`):

```ts
export type Parsed = {
  events: ChatEvent[];
  init?: true;
  limit?: LimitInfo;
  result?: {isError: boolean; message: string | null; costUsd: number | null; durationMs: number | null; http429: boolean};
};
export function parseLine(line: string): Parsed | null; // null = not a JSON object
export function toolSummary(input: unknown): string;
```

- [ ] **Step 1: Add the types** to `app/shared/types.ts` exactly as above, and extend `ServerEvent`.

- [ ] **Step 2: Keep the client compiling.** In `app/src/api/events.ts` `onEvent`, the last branch is a bare `else { worker = ev.status; emit(); }`. Change it to `else if (ev.type === 'worker') { worker = ev.status; emit(); }` (chat events are wired in Task 5).

- [ ] **Step 3: Write the fixture** `app/server/chat/fixtures/turn.jsonl` (shapes copied from a real Claude Code 2.1.328 capture, trimmed):

```jsonl
{"type":"system","subtype":"hook_started","hook_id":"h1","hook_name":"SessionStart:startup","session_id":"s"}
{"type":"system","subtype":"init","cwd":"/x","session_id":"s","model":"m"}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Xin "}},"parent_tool_use_id":null,"session_id":"s"}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"chào"}},"parent_tool_use_id":null,"session_id":"s"}
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"sub"}},"parent_tool_use_id":"toolu_9","session_id":"s"}
{"type":"assistant","message":{"content":[{"type":"text","text":"Xin chào"}]},"parent_tool_use_id":null,"session_id":"s"}
{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"..."},{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"python3 tools/prepare.py projects/a   --json","description":"Prepare"}}]},"parent_tool_use_id":null,"session_id":"s"}
{"type":"assistant","message":{"content":[{"type":"text","text":"from a subagent"}]},"parent_tool_use_id":"toolu_9","session_id":"s"}
{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]},"session_id":"s"}
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed_warning","resetsAt":1795514400,"rateLimitType":"seven_day","utilization":0.56},"session_id":"s"}
{"type":"result","subtype":"success","is_error":false,"result":"Xin chào","total_cost_usd":0.0077,"duration_ms":1234,"session_id":"s"}
```

- [ ] **Step 4: Write the failing tests** `app/server/chat/stream.test.ts`:

```ts
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseLine, toolSummary} from './stream.ts';

const lines = readFileSync(path.join(import.meta.dirname, 'fixtures/turn.jsonl'), 'utf8').split('\n').filter(Boolean);
const all = lines.map(parseLine);

describe('parseLine', () => {
  it('maps a full turn', () => {
    expect(all.flatMap(p => p!.events)).toEqual([
      {kind: 'delta', text: 'Xin '},
      {kind: 'delta', text: 'chào'},
      {kind: 'text', text: 'Xin chào'},
      {kind: 'tool', name: 'Bash', summary: 'python3 tools/prepare.py projects/a --json'},
    ]); // subagent delta/text (parent_tool_use_id set), thinking, hooks and tool results are dropped
    expect(all.filter(p => p!.init)).toHaveLength(1);
    expect(all.find(p => p!.limit)!.limit).toEqual({status: 'allowed_warning', resetsAt: 1795514400, utilization: 0.56, type: 'seven_day'});
    expect(all.at(-1)!.result).toEqual({isError: false, message: 'Xin chào', costUsd: 0.0077, durationMs: 1234, http429: false});
  });
  it('error results', () => {
    expect(parseLine('{"type":"result","subtype":"error_during_execution","is_error":true,"errors":["No conversation found with session ID: x"]}')!.result)
      .toEqual({isError: true, message: 'No conversation found with session ID: x', costUsd: null, durationMs: null, http429: false});
    expect(parseLine('{"type":"result","subtype":"success","is_error":true,"result":"You\'ve hit your limit","api_error_status":429}')!.result!.http429).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(parseLine('not json')).toBeNull();
    expect(parseLine('[1]')).toBeNull();
    expect(parseLine('{"type":"weird"}')).toEqual({events: []});
  });
  it('toolSummary picks the first useful field and truncates', () => {
    expect(toolSummary({file_path: 'projects/x/storyboard.json', old_string: 'a'})).toBe('projects/x/storyboard.json');
    expect(toolSummary({foo: 1})).toBe('');
    expect(toolSummary({command: 'x'.repeat(100)})).toBe('x'.repeat(79) + '…');
  });
});
```

- [ ] **Step 5: Run** `cd app && npx vitest run server/chat/stream.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 6: Implement** `app/server/chat/stream.ts`:

```ts
import type {ChatEvent, LimitInfo} from '../../shared/types.ts';

export type Parsed = {
  events: ChatEvent[];
  init?: true;
  limit?: LimitInfo;
  result?: {isError: boolean; message: string | null; costUsd: number | null; durationMs: number | null; http429: boolean};
};
type R = Record<string, unknown>;
const obj = (v: unknown): R | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt'];
export function toolSummary(input: unknown): string {
  const o = obj(input);
  const v = o && SUMMARY_KEYS.map(k => str(o[k])).find(Boolean);
  if (!v) return '';
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > 80 ? s.slice(0, 79) + '…' : s;
}

export function parseLine(line: string): Parsed | null {
  let e: R | null;
  try { e = obj(JSON.parse(line)); } catch { return null; }
  if (!e) return null;
  const out: Parsed = {events: []};
  const top = e.parent_tool_use_id == null; // subagent traffic is not shown
  switch (e.type) {
    case 'system':
      if (e.subtype === 'init') out.init = true;
      break;
    case 'stream_event': {
      const ev = obj(e.event), d = obj(ev?.delta);
      if (top && ev?.type === 'content_block_delta' && d?.type === 'text_delta' && str(d.text)) out.events.push({kind: 'delta', text: d.text as string});
      break;
    }
    case 'assistant': {
      const content = obj(e.message)?.content;
      if (!top || !Array.isArray(content)) break;
      for (const b of content.map(obj)) {
        if (b?.type === 'text' && str(b.text)) out.events.push({kind: 'text', text: b.text as string});
        else if (b?.type === 'tool_use') out.events.push({kind: 'tool', name: str(b.name) ?? '?', summary: toolSummary(b.input)});
      }
      break;
    }
    case 'rate_limit_event': {
      const i = obj(e.rate_limit_info) ?? {};
      out.limit = {status: str(i.status) ?? 'unknown', resetsAt: num(i.resetsAt), utilization: num(i.utilization), type: str(i.rateLimitType)};
      break;
    }
    case 'result': {
      const errors = Array.isArray(e.errors) ? e.errors.map(String) : [];
      out.result = {
        isError: e.is_error === true || e.subtype !== 'success',
        message: str(e.result) || (errors.length ? errors.join('\n') : null),
        costUsd: num(e.total_cost_usd), durationMs: num(e.duration_ms), http429: e.api_error_status === 429,
      };
      break;
    }
  }
  return out;
}
```

- [ ] **Step 7: Run** `cd app && npx vitest run server/chat/stream.test.ts && npx tsc --noEmit`. Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add app/shared/types.ts app/src/api/events.ts app/server/chat/stream.ts app/server/chat/stream.test.ts app/server/chat/fixtures/turn.jsonl
git commit -m "Chat: shared types and stream-json parser"
```

---

### Task 2: Account detection + child env

**Agent:** worker-sonnet (small, fully specified).

**Files:**
- Create: `app/server/chat/accounts.ts`
- Create: `app/server/chat/testHome.ts`
- Test: `app/server/chat/accounts.test.ts`

**Interfaces:**
- Produces:

```ts
export type Account = {name: string; configDir: string | null};
export const claudeHome: () => string;                       // REEL_CLAUDE_HOME ?? os.homedir()
export function listAccounts(home?: string): Promise<Account[]>; // 'claude' first, then claude<N> by N ascending
export function childEnv(acc: Account, base?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
// testHome.ts
export function makeClaudeHome(): Promise<string>; // temp home: valid .claude, valid .claude-acc2, .claude-acc3 (no credentials), .claude-acc4 (projects not a symlink), .claude-acc10 (valid)
```

Rules (from the spec): `claude` is listed when `<home>/.claude/.credentials.json` exists (configDir `null`). `claude<N>` is listed for each `<home>/.claude-acc<N>` (`/^\.claude-acc(\d+)$/`) that has `.credentials.json` **and** whose `projects` is a symlink whose realpath equals the realpath of `<home>/.claude/projects`.

- [ ] **Step 1: Write the test helper** `app/server/chat/testHome.ts`:

```ts
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
  return home;
}
```

- [ ] **Step 2: Write the failing test** `app/server/chat/accounts.test.ts`:

```ts
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
      {name: 'claude', configDir: null},
      {name: 'claude2', configDir: path.join(home, '.claude-acc2')},
      {name: 'claude10', configDir: path.join(home, '.claude-acc10')},
    ]);
  });
  it('empty home → no accounts', async () => {
    expect(await listAccounts(await mkdtemp(path.join(os.tmpdir(), 'reel-empty-')))).toEqual([]);
  });
});

describe('childEnv', () => {
  const base = {PATH: '/bin', HOME: '/h', CLAUDE_CONFIG_DIR: '/h/.claude-acc3', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'x', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_EFFORT: 'high'};
  it('default account drops CLAUDE_CONFIG_DIR and parent session vars', () => {
    expect(childEnv({name: 'claude', configDir: null}, base)).toEqual({PATH: '/bin', HOME: '/h', CLAUDE_EFFORT: 'high'});
  });
  it('numbered account sets CLAUDE_CONFIG_DIR', () => {
    expect(childEnv({name: 'claude2', configDir: '/h/.claude-acc2'}, base).CLAUDE_CONFIG_DIR).toBe('/h/.claude-acc2');
  });
});
```

- [ ] **Step 3: Run** `cd app && npx vitest run server/chat/accounts.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement** `app/server/chat/accounts.ts`:

```ts
import {lstat, readdir, realpath, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type Account = {name: string; configDir: string | null};
export const claudeHome = (): string => process.env.REEL_CLAUDE_HOME ?? os.homedir();

const exists = (p: string) => stat(p).then(() => true, () => false);
const real = (p: string) => realpath(p).catch(() => null);

export async function listAccounts(home: string = claudeHome()): Promise<Account[]> {
  const out: Account[] = [];
  if (await exists(path.join(home, '.claude', '.credentials.json'))) out.push({name: 'claude', configDir: null});
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
    out.push({name: `claude${m[1]}`, configDir: dir});
  }
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
```

- [ ] **Step 5: Run** `cd app && npx vitest run server/chat/accounts.test.ts && npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/server/chat/accounts.ts app/server/chat/testHome.ts app/server/chat/accounts.test.ts
git commit -m "Chat: detect Claude accounts and build child env"
```

---

### Task 3: Fake CLI + turn runner

**Agent:** worker-sonnet (process handling, but every rule is settled here).

**Files:**
- Create: `app/server/chat/fake-claude.mjs` (must be executable: `chmod +x`, committed with the exec bit)
- Create: `app/server/chat/runner.ts`
- Test: `app/server/chat/runner.test.ts`

**Interfaces:**
- Consumes: `parseLine` (Task 1), `Account`, `childEnv` (Task 2), `repoRoot()` from `app/server/paths.ts`.
- Produces:

```ts
export const claudeBin: () => string; // REEL_CLAUDE_BIN ?? 'claude'
export type TurnOpts = {
  sessionId: string; resume: boolean; account: Account; prompt: string; systemAppend: string; signal: AbortSignal;
  onEvent(e: ChatEvent): void; onInit?(): void; onLimit?(l: LimitInfo): void;
};
export function turnArgs(o: Pick<TurnOpts, 'sessionId' | 'resume' | 'systemAppend'>): string[];
export function runTurn(o: TurnOpts): Promise<void>; // never rejects; emits exactly one terminal event (done | error) as the last event
```

- Fake CLI behaviour (Task 4 tests and Task 6 E2E rely on it). It reads the prompt from stdin, then:
  - prompt contains `NOSESSION` and `--resume` given → prints a `result` error `No conversation found with session ID: <id>`, exit 1 (no init).
  - always otherwise prints `system/init` first.
  - prompt contains `LIMIT` → `rate_limit_event` `status:"rejected"`, `resetsAt:1795514400`, then `result` `is_error:true`, `api_error_status:429`, `result:"You've hit your limit"`, exit 0.
  - prompt contains `SLOW` → one delta every 200 ms for 60 s (to test Stop), no result.
  - prompt contains `CRASH` → writes `boom: fake crash` to stderr, exit 3, no result.
  - otherwise → deltas of the reply word by word, an `assistant` text block with the full reply, an `assistant` `tool_use` `Bash` with `{command: 'ls projects'}`, `result` success with `total_cost_usd: 0.01`, `duration_ms: 1234`.
  - reply text = `acc=<basename of CLAUDE_CONFIG_DIR, or "default"> mode=<new|resume> sys=<yes|no> prompt=<trimmed prompt>`; `sys=yes` when `--append-system-prompt` has a non-empty value.

- [ ] **Step 1: Write the fake** `app/server/chat/fake-claude.mjs`:

```js
#!/usr/bin/env node
// Test double for the `claude` CLI in stream-json mode. Behaviour is picked by words in the prompt (see plan Task 3).
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => { void run(); });

async function run() {
  const resume = flag('--resume');
  const sid = resume ?? flag('--session-id');
  const mode = resume ? 'resume' : 'new';
  if (prompt.includes('NOSESSION') && resume) {
    out({type: 'result', subtype: 'error_during_execution', is_error: true, errors: [`No conversation found with session ID: ${sid}`]});
    process.exit(1);
  }
  out({type: 'system', subtype: 'init', session_id: sid});
  if (prompt.includes('CRASH')) { process.stderr.write('boom: fake crash\n'); process.exit(3); }
  if (prompt.includes('LIMIT')) {
    out({type: 'rate_limit_event', rate_limit_info: {status: 'rejected', resetsAt: 1795514400, rateLimitType: 'five_hour', utilization: 1}});
    out({type: 'result', subtype: 'success', is_error: true, result: "You've hit your limit", api_error_status: 429});
    return;
  }
  if (prompt.includes('SLOW')) {
    for (let i = 0; i < 300; i++) { out({type: 'stream_event', parent_tool_use_id: null, event: {type: 'content_block_delta', delta: {type: 'text_delta', text: `${i} `}}}); await sleep(200); }
    return;
  }
  const acc = process.env.CLAUDE_CONFIG_DIR ? path.basename(process.env.CLAUDE_CONFIG_DIR) : 'default';
  const reply = `acc=${acc} mode=${mode} sys=${flag('--append-system-prompt') ? 'yes' : 'no'} prompt=${prompt.trim()}`;
  for (const w of reply.split(/(?<= )/)) { out({type: 'stream_event', parent_tool_use_id: null, event: {type: 'content_block_delta', delta: {type: 'text_delta', text: w}}}); await sleep(5); }
  out({type: 'assistant', parent_tool_use_id: null, message: {content: [{type: 'text', text: reply}]}});
  out({type: 'assistant', parent_tool_use_id: null, message: {content: [{type: 'tool_use', id: 't1', name: 'Bash', input: {command: 'ls projects'}}]}});
  out({type: 'result', subtype: 'success', is_error: false, result: reply, total_cost_usd: 0.01, duration_ms: 1234});
}
```

Then `chmod +x app/server/chat/fake-claude.mjs`.

- [ ] **Step 2: Write the failing tests** `app/server/chat/runner.test.ts`:

```ts
import path from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';
import type {ChatEvent, LimitInfo} from '../../shared/types.ts';
import {runTurn, turnArgs} from './runner.ts';
import {makeTestRoot} from '../testRoot.ts';

const FAKE = path.join(import.meta.dirname, 'fake-claude.mjs');
const def = {name: 'claude', configDir: null};
const acc2 = {name: 'claude2', configDir: '/tmp/h/.claude-acc2'};

async function turn(prompt: string, o: {resume?: boolean; account?: typeof def; signal?: AbortSignal} = {}) {
  const events: ChatEvent[] = []; const limits: LimitInfo[] = []; let init = 0;
  await runTurn({sessionId: '11111111-1111-4111-8111-111111111111', resume: o.resume ?? false, account: o.account ?? def, prompt,
    systemAppend: 'ctx', signal: o.signal ?? new AbortController().signal, onEvent: e => events.push(e), onInit: () => init++, onLimit: l => limits.push(l)});
  return {events, limits, init, text: events.filter(e => e.kind === 'text').map(e => (e as {text: string}).text).join('')};
}

beforeAll(async () => { await makeTestRoot(); process.env.REEL_CLAUDE_BIN = FAKE; });

describe('turnArgs', () => {
  it('new vs resume', () => {
    expect(turnArgs({sessionId: 'S', resume: false, systemAppend: 'X'})).toEqual(['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--dangerously-skip-permissions', '--session-id', 'S', '--append-system-prompt', 'X']);
    expect(turnArgs({sessionId: 'S', resume: true, systemAppend: 'X'})).toContain('--resume');
  });
});

describe('runTurn (fake CLI)', () => {
  it('streams a normal turn, prompt via stdin, default account', async () => {
    const r = await turn('-n xin chào');
    expect(r.init).toBe(1);
    expect(r.text).toBe('acc=default mode=new sys=yes prompt=-n xin chào');
    expect(r.events.some(e => e.kind === 'delta')).toBe(true);
    expect(r.events).toContainEqual({kind: 'tool', name: 'Bash', summary: 'ls projects'});
    expect(r.events.at(-1)).toEqual({kind: 'done', costUsd: 0.01, durationMs: 1234});
  });
  it('resume on another account', async () => {
    expect((await turn('hi', {resume: true, account: acc2})).text).toBe('acc=.claude-acc2 mode=resume sys=yes prompt=hi');
  });
  it('limit → error with limit, reports limit info', async () => {
    const r = await turn('LIMIT');
    expect(r.limits[0].status).toBe('rejected');
    expect(r.events.at(-1)).toEqual({kind: 'error', message: "You've hit your limit", limit: {account: 'claude', resetsAt: 1795514400}});
  });
  it('missing session → error with CLI message', async () => {
    const r = await turn('NOSESSION', {resume: true});
    expect(r.events).toEqual([{kind: 'error', message: expect.stringContaining('No conversation found')}]);
  });
  it('crash without result → last stderr line', async () => {
    expect((await turn('CRASH')).events.at(-1)).toEqual({kind: 'error', message: 'boom: fake crash'});
  });
  it('abort kills the child → Đã dừng', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 500);
    const r = await turn('SLOW', {signal: ac.signal});
    expect(r.events.at(-1)).toEqual({kind: 'error', message: 'Đã dừng'});
    expect(r.events.filter(e => e.kind === 'done' || e.kind === 'error')).toHaveLength(1);
  });
  it('missing binary → error, no throw', async () => {
    process.env.REEL_CLAUDE_BIN = '/nope/claude';
    try { expect((await turn('x')).events.at(-1)).toMatchObject({kind: 'error'}); } finally { process.env.REEL_CLAUDE_BIN = FAKE; }
  });
});
```

- [ ] **Step 3: Run** `cd app && npx vitest run server/chat/runner.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement** `app/server/chat/runner.ts`:

```ts
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import type {ChatEvent, LimitInfo} from '../../shared/types.ts';
import {repoRoot} from '../paths.ts';
import {childEnv, type Account} from './accounts.ts';
import {parseLine} from './stream.ts';

export const claudeBin = (): string => process.env.REEL_CLAUDE_BIN ?? 'claude';

export type TurnOpts = {
  sessionId: string; resume: boolean; account: Account; prompt: string; systemAppend: string; signal: AbortSignal;
  onEvent(e: ChatEvent): void; onInit?(): void; onLimit?(l: LimitInfo): void;
};

export function turnArgs(o: Pick<TurnOpts, 'sessionId' | 'resume' | 'systemAppend'>): string[] {
  return ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--dangerously-skip-permissions',
    o.resume ? '--resume' : '--session-id', o.sessionId, '--append-system-prompt', o.systemAppend];
}

const STOPPED = 'Đã dừng';

export function runTurn(o: TurnOpts): Promise<void> {
  return new Promise(resolve => {
    let ended = false, lastErr = '';
    let limit: LimitInfo | null = null;
    const end = (e: ChatEvent) => { if (!ended) { ended = true; o.onEvent(e); } };
    if (o.signal.aborted) { end({kind: 'error', message: STOPPED}); resolve(); return; }

    const p = spawn(claudeBin(), turnArgs(o), {cwd: repoRoot(), env: childEnv(o.account), stdio: ['pipe', 'pipe', 'pipe']});
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => { p.kill('SIGTERM'); killTimer = setTimeout(() => p.kill('SIGKILL'), 3000); };
    o.signal.addEventListener('abort', onAbort, {once: true});

    p.stdin.on('error', () => { /* child exited before reading stdin; close/error handlers report it */ });
    p.stdin.end(o.prompt);

    readline.createInterface({input: p.stdout}).on('line', line => {
      const r = parseLine(line);
      if (!r) return;
      if (r.init) o.onInit?.();
      if (r.limit) { o.onLimit?.(r.limit); if (r.limit.status === 'rejected') limit = r.limit; }
      for (const ev of r.events) if (!ended) o.onEvent(ev);
      if (r.result) {
        const res = r.result;
        if (o.signal.aborted) end({kind: 'error', message: STOPPED});
        else if (!res.isError && !limit) end({kind: 'done', costUsd: res.costUsd, durationMs: res.durationMs});
        else end({kind: 'error', message: res.message ?? 'Claude báo lỗi',
          ...((limit || res.http429) && {limit: {account: o.account.name, resetsAt: limit?.resetsAt ?? null}})});
      }
    });
    readline.createInterface({input: p.stderr}).on('line', l => { if (l.trim()) lastErr = l.trim(); });

    p.on('error', err => { end({kind: 'error', message: `Không chạy được claude: ${err.message}`}); resolve(); });
    p.on('close', code => {
      clearTimeout(killTimer);
      o.signal.removeEventListener('abort', onAbort);
      end(o.signal.aborted ? {kind: 'error', message: STOPPED} : {kind: 'error', message: lastErr || `claude thoát với mã ${code}`});
      resolve();
    });
  });
}
```

Note: if the `close` handler can fire before readline delivers the last stdout line on this Node version (a test where `result` is the last line would then flake into an error), wait for the stdout readline `close` event as well before calling the final `end`. Keep exactly-one-terminal-event semantics.

- [ ] **Step 5: Run** `cd app && npx vitest run server/chat/runner.test.ts && npx tsc --noEmit`. Expected: PASS. Run it 3 times to check it does not flake.

- [ ] **Step 6: Real-CLI smoke (one cheap call, run once, not a committed test).** Write `/tmp/claude-1000/smoke.ts`:

```ts
import {runTurn} from '/home/giabao/dev/create-video/app/server/chat/runner.ts';
import {randomUUID} from 'node:crypto';
await runTurn({sessionId: randomUUID(), resume: false, account: {name: 'claude', configDir: null}, prompt: 'reply with just: pong',
  systemAppend: 'Smoke test.', signal: new AbortController().signal, onEvent: e => { if (e.kind !== 'delta') console.log(JSON.stringify(e)); }, onInit: () => console.log('init')});
```

Run: `cd app && node /tmp/claude-1000/smoke.ts`. Expected: `init`, a `text` event `pong` (exactly once — if the text is duplicated, the assistant events repeat earlier blocks; report it), `done`. Report the output. Delete the smoke file.

- [ ] **Step 7: Commit**

```bash
git add app/server/chat/fake-claude.mjs app/server/chat/runner.ts app/server/chat/runner.test.ts
git commit -m "Chat: turn runner over the claude CLI, with a fake CLI for tests"
```

---

### Task 4: Store, ChatService, routes, wiring

**Agent:** worker-sonnet (contract fixed above). Review by **worker-opus**: this is the trust boundary for a skip-permissions process.

**Files:**
- Create: `app/server/chat/store.ts`
- Create: `app/server/chat/service.ts`
- Create: `app/server/routes/chats.ts`
- Test: `app/server/routes/chats.test.ts`
- Modify: `app/server/routes/util.ts:12` (`Deps`), `app/server/routes/testApp.ts` (`setup`), `app/server/app.ts` (route list + `/events` snapshot), `app/server/index.ts` (create service, stop on SIGINT/SIGTERM), `/.gitignore` (add `app/.data/`)

**Interfaces:**
- Consumes: `runTurn` (Task 3), `listAccounts`/`Account` (Task 2), types (Task 1), `EventBus` (`app/server/events.ts`), `readJsonOr`, `writeJsonAtomic` (`app/server/store.ts`), `HttpError`, `bodyOf`, `isObj` (`app/server/routes/util.ts`), `SLUG_RE`, `repoRoot` (`app/server/paths.ts`).
- Produces:

```ts
// store.ts
export const chatDir: () => string; // REEL_CHAT_DIR ?? path.join(repoRoot(), 'app/.data/chats')
export function readIndex(): Promise<ChatMeta[]>;
export function updateIndex(fn: (list: ChatMeta[]) => ChatMeta[]): Promise<ChatMeta[]>; // serialized read-modify-write
export function appendEvent(id: string, e: ChatEvent): Promise<void>;
export function readEvents(id: string): Promise<ChatEvent[]>; // missing file → [], bad lines skipped
// service.ts
export const UUID_RE: RegExp; // /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const NEW_TITLE = 'Phiên mới';
export class ChatService {
  constructor(bus: EventBus);
  busy(): string | null;
  accounts(): Promise<ChatAccount[]>;
  list(): Promise<ChatMeta[]>;
  create(slug: string | null): Promise<ChatMeta>;
  get(id: string): Promise<ChatDetail | null>;
  send(id: string, m: {text: string; account: string; screen: string; slug: string | null}): Promise<void>; // resolves once the turn has STARTED
  stop(id: string): boolean;
  stopAll(): void;
  idle(): Promise<void>; // resolves when no turn is running (tests)
}
// Deps gains: chat: ChatService
```

- [ ] **Step 1: Store** `app/server/chat/store.ts`:

```ts
import {appendFile, mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import type {ChatEvent, ChatMeta} from '../../shared/types.ts';
import {repoRoot} from '../paths.ts';
import {readJsonOr, writeJsonAtomic} from '../store.ts';

export const chatDir = (): string => process.env.REEL_CHAT_DIR ?? path.join(repoRoot(), 'app/.data/chats');
const indexFile = () => path.join(chatDir(), 'index.json');

export async function readIndex(): Promise<ChatMeta[]> {
  const {data} = await readJsonOr<ChatMeta[]>(indexFile(), []);
  return Array.isArray(data) ? data : [];
}

let chain: Promise<unknown> = Promise.resolve();
export function updateIndex(fn: (list: ChatMeta[]) => ChatMeta[]): Promise<ChatMeta[]> {
  const run = chain.then(async () => { const next = fn(await readIndex()); await writeJsonAtomic(indexFile(), next); return next; });
  chain = run.catch(() => undefined);
  return run;
}

export async function appendEvent(id: string, e: ChatEvent): Promise<void> {
  await mkdir(chatDir(), {recursive: true});
  await appendFile(path.join(chatDir(), `${id}.jsonl`), JSON.stringify(e) + '\n', 'utf8');
}

export async function readEvents(id: string): Promise<ChatEvent[]> {
  let text: string;
  try { text = await readFile(path.join(chatDir(), `${id}.jsonl`), 'utf8'); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const out: ChatEvent[] = [];
  for (const l of text.split('\n')) { if (!l) continue; try { out.push(JSON.parse(l) as ChatEvent); } catch { /* torn last line after a crash */ } }
  return out;
}
```

- [ ] **Step 2: Service** `app/server/chat/service.ts`:

```ts
import {randomUUID} from 'node:crypto';
import type {ChatAccount, ChatDetail, ChatEvent, ChatMeta, LimitInfo} from '../../shared/types.ts';
import type {EventBus} from '../events.ts';
import {HttpError} from '../routes/util.ts';
import {listAccounts} from './accounts.ts';
import {runTurn} from './runner.ts';
import {appendEvent, readEvents, readIndex, updateIndex} from './store.ts';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const NEW_TITLE = 'Phiên mới';
const titleOf = (t: string) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > 60 ? s.slice(0, 59) + '…' : s; };
const systemAppend = (screen: string, slug: string | null) =>
  `The user is chatting with you from the reel app's chat panel; the app is running (CLAUDE.md rule 10: point them to the app instead of describing frames). ` +
  `They are on app screen "${screen}"${slug ? `, working on projects/${slug}` : ''}.`;

export class ChatService {
  #bus: EventBus;
  #active: {chatId: string; ac: AbortController; done: Promise<void>} | null = null;
  #limits = new Map<string, LimitInfo>();
  constructor(bus: EventBus) { this.#bus = bus; }

  busy(): string | null { return this.#active?.chatId ?? null; }
  idle(): Promise<void> { return this.#active?.done ?? Promise.resolve(); }

  async accounts(): Promise<ChatAccount[]> {
    return (await listAccounts()).map(a => ({name: a.name, limit: this.#limits.get(a.name) ?? null}));
  }
  async list(): Promise<ChatMeta[]> { return (await readIndex()).sort((a, b) => b.updatedAt - a.updatedAt); }

  async create(slug: string | null): Promise<ChatMeta> {
    const now = Date.now();
    const chat: ChatMeta = {id: randomUUID(), title: NEW_TITLE, account: (await listAccounts())[0]?.name ?? 'claude', slug, started: false, createdAt: now, updatedAt: now};
    await updateIndex(l => [...l, chat]);
    return chat;
  }

  async get(id: string): Promise<ChatDetail | null> {
    const chat = (await readIndex()).find(c => c.id === id);
    return chat ? {chat, events: await readEvents(id)} : null;
  }

  async send(id: string, m: {text: string; account: string; screen: string; slug: string | null}): Promise<void> {
    if (this.#active) throw new HttpError(409, 'Claude đang trả lời ở một phiên khác');
    let release!: () => void;
    const ac = new AbortController();
    this.#active = {chatId: id, ac, done: new Promise<void>(r => { release = r; })}; // claimed before any await: no double start
    try {
      const chat = (await readIndex()).find(c => c.id === id);
      if (!chat) throw new HttpError(404, 'chat not found');
      const account = (await listAccounts()).find(a => a.name === m.account);
      if (!account) throw new HttpError(400, 'unknown account');

      let w: Promise<void> = Promise.resolve();
      const persist = (e: ChatEvent) => { // write, then emit: a client refetch after the event sees it
        w = w.then(() => appendEvent(id, e)).then(() => this.#bus.emit({type: 'chat', chatId: id, event: e}), err => console.error('chat append', err));
      };
      persist({kind: 'user', text: m.text, account: account.name, at: Date.now()});
      await updateIndex(l => l.map(c => c.id === id ? {...c, account: account.name, title: c.title === NEW_TITLE ? titleOf(m.text) : c.title, updatedAt: Date.now()} : c));
      this.#bus.emit({type: 'chatBusy', chatId: id});

      void runTurn({
        sessionId: id, resume: chat.started, account, prompt: m.text, systemAppend: systemAppend(m.screen, m.slug), signal: ac.signal,
        onEvent: e => { if (e.kind === 'delta') this.#bus.emit({type: 'chat', chatId: id, event: e}); else persist(e); },
        onInit: () => { if (!chat.started) { chat.started = true; void updateIndex(l => l.map(c => c.id === id ? {...c, started: true} : c)); } },
        onLimit: l => { this.#limits.set(account.name, l); },
      }).then(async () => {
        await w;
        await updateIndex(l => l.map(c => c.id === id ? {...c, updatedAt: Date.now()} : c)).catch(() => undefined);
      }).finally(() => {
        this.#active = null;
        this.#bus.emit({type: 'chatBusy', chatId: null});
        release();
      });
    } catch (e) {
      this.#active = null;
      release();
      throw e;
    }
  }

  stop(id: string): boolean {
    if (this.#active?.chatId !== id) return false;
    this.#active.ac.abort();
    return true;
  }
  stopAll(): void { this.#active?.ac.abort(); }
}
```

- [ ] **Step 3: Routes** `app/server/routes/chats.ts`:

```ts
import {Hono} from 'hono';
import {SLUG_RE} from '../paths.ts';
import {UUID_RE} from '../chat/service.ts';
import {bodyOf, HttpError} from './util.ts';
import type {Deps} from './util.ts';

const MAX_TEXT = 20_000;
const slugOf = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v !== 'string' || !SLUG_RE.test(v)) throw new HttpError(400, 'bad slug');
  return v;
};
const idOf = (id: string): string => { if (!UUID_RE.test(id)) throw new HttpError(404, 'chat not found'); return id; };

export function chatRoutes({chat}: Deps): Hono {
  const app = new Hono();
  app.get('/chat/accounts', async c => c.json(await chat.accounts()));
  app.get('/chats', async c => c.json(await chat.list()));
  app.post('/chats', async c => c.json(await chat.create(slugOf((await bodyOf(c)).slug)), 201));
  app.get('/chats/:id', async c => {
    const d = await chat.get(idOf(c.req.param('id')));
    if (!d) throw new HttpError(404, 'chat not found');
    return c.json(d);
  });
  app.post('/chats/:id/messages', async c => {
    const id = idOf(c.req.param('id'));
    const b = await bodyOf(c);
    if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > MAX_TEXT) throw new HttpError(400, 'text must be 1–20000 characters');
    if (typeof b.account !== 'string') throw new HttpError(400, 'account must be a string');
    const screen = typeof b.screen === 'string' ? b.screen.slice(0, 200) : '/';
    await chat.send(id, {text: b.text, account: b.account, screen, slug: slugOf(b.slug)});
    return c.body(null, 202);
  });
  app.post('/chats/:id/stop', c => {
    if (!chat.stop(idOf(c.req.param('id')))) throw new HttpError(409, 'chat is not running');
    return c.body(null, 204);
  });
  return app;
}
```

- [ ] **Step 4: Wiring.**
  - `app/server/routes/util.ts`: `export type Deps = {bus: EventBus; jobs: JobQueue; worker: WorkerLike; ports: number[]; chat: ChatService};` (type-only import of `ChatService` from `../chat/service.ts`).
  - `app/server/routes/testApp.ts` `setup()`: `const chat = new ChatService(bus);`, pass `chat` into `createApp`, return it.
  - `app/server/app.ts`: import `chatRoutes`, add it to the route loop; append `{type: 'chatBusy', chatId: deps.chat.busy()}` to the `/events` snapshot array.
  - `app/server/index.ts`: `const chat = new ChatService(bus);`, pass to `createApp`; in the signal handler call `chat.stopAll()` before `process.exit(0)`.
  - `/.gitignore`: add a line `app/.data/`.

- [ ] **Step 5: Route tests** `app/server/routes/chats.test.ts`:

```ts
import path from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import type {ChatDetail, ChatMeta, ServerEvent} from '../../shared/types.ts';
import {makeTestRoot} from '../testRoot.ts';
import {makeClaudeHome} from '../chat/testHome.ts';
import {setup} from './testApp.ts';

const FAKE = path.join(import.meta.dirname, '../chat/fake-claude.mjs');

beforeEach(async () => {
  await makeTestRoot(); // chat dir = <temp root>/app/.data/chats
  delete process.env.REEL_CHAT_DIR;
  process.env.REEL_CLAUDE_BIN = FAKE;
  process.env.REEL_CLAUDE_HOME = await makeClaudeHome();
});

async function newChat(req: ReturnType<typeof setup>['req']): Promise<ChatMeta> {
  const r = await req('/api/chats', {method: 'POST', json: {slug: 'p1'}});
  expect(r.status).toBe(201);
  return r.json();
}
const send = (req: ReturnType<typeof setup>['req'], id: string, text: string, account = 'claude') =>
  req(`/api/chats/${id}/messages`, {method: 'POST', json: {text, account, screen: '/p/p1', slug: 'p1'}});

describe('chat routes', () => {
  it('accounts come from the claude home', async () => {
    const {req} = setup();
    expect((await (await req('/api/chat/accounts')).json()).map((a: {name: string}) => a.name)).toEqual(['claude', 'claude2', 'claude10']);
  });

  it('two turns: new then resume, persisted without deltas, title set, busy events', async () => {
    const {req, chat, bus} = setup();
    const seen: ServerEvent[] = [];
    bus.subscribe(e => seen.push(e));
    const c = await newChat(req);
    expect((await send(req, c.id, 'Làm video IELTS')).status).toBe(202);
    await chat.idle();
    expect((await send(req, c.id, 'tiếp', 'claude2')).status).toBe(202);
    await chat.idle();
    const d: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    const texts = d.events.filter(e => e.kind === 'text').map(e => (e as {text: string}).text);
    expect(texts[0]).toMatch(/^acc=default mode=new sys=yes/);
    expect(texts[1]).toMatch(/^acc=\.claude-acc2 mode=resume/);
    expect(d.events.some(e => e.kind === 'delta')).toBe(false);
    expect(d.events.filter(e => e.kind === 'done')).toHaveLength(2);
    expect(d.chat).toMatchObject({title: 'Làm video IELTS', account: 'claude2', started: true, slug: 'p1'});
    expect(seen.some(e => e.type === 'chat' && e.event.kind === 'delta')).toBe(true);
    expect(seen.filter(e => e.type === 'chatBusy').map(e => (e as {chatId: string | null}).chatId)).toEqual([c.id, null, c.id, null]);
  });

  it('409 while busy, stop → Đã dừng', async () => {
    const {req, chat} = setup();
    const a = await newChat(req), b = await newChat(req);
    expect((await send(req, a.id, 'SLOW')).status).toBe(202);
    expect((await send(req, b.id, 'hi')).status).toBe(409);
    expect((await req(`/api/chats/${b.id}/stop`, {method: 'POST'})).status).toBe(409);
    expect((await req(`/api/chats/${a.id}/stop`, {method: 'POST'})).status).toBe(204);
    await chat.idle();
    const d: ChatDetail = await (await req(`/api/chats/${a.id}`)).json();
    expect(d.events.at(-1)).toEqual({kind: 'error', message: 'Đã dừng'});
    expect(chat.busy()).toBeNull();
  });

  it('limit error is persisted with the account, accounts report the limit', async () => {
    const {req, chat} = setup();
    const c = await newChat(req);
    await send(req, c.id, 'LIMIT');
    await chat.idle();
    const d: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    expect(d.events.at(-1)).toMatchObject({kind: 'error', limit: {account: 'claude', resetsAt: 1795514400}});
    const accs = await (await req('/api/chat/accounts')).json();
    expect(accs[0].limit.status).toBe('rejected');
  });

  it('validation', async () => {
    const {req} = setup();
    const c = await newChat(req);
    expect((await send(req, c.id, '   ')).status).toBe(400);
    expect((await send(req, c.id, 'x'.repeat(20_001))).status).toBe(400);
    expect((await send(req, c.id, 'hi', 'claude3')).status).toBe(400); // no credentials → not an account
    expect((await req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'claude', slug: '../x'}})).status).toBe(400);
    expect((await req('/api/chats', {method: 'POST', json: {slug: '../x'}})).status).toBe(400);
    expect((await req('/api/chats/not-a-uuid')).status).toBe(404);
    expect((await req('/api/chats/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await send(req, '00000000-0000-4000-8000-000000000000', 'hi')).status).toBe(404);
  });
});
```

- [ ] **Step 6: Run** `cd app && npx vitest run server/routes/chats.test.ts server/chat && npx tsc --noEmit`. Expected: PASS. Then, because `Deps`/`createApp` changed (shared core), run all server tests: `cd app && npx vitest run server`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/server/chat/store.ts app/server/chat/service.ts app/server/routes/chats.ts app/server/routes/chats.test.ts app/server/routes/util.ts app/server/routes/testApp.ts app/server/app.ts app/server/index.ts .gitignore
git commit -m "Chat: chat service, persistence and API routes"
```

---

### Task 5: Client — hooks, live store, chat panel

**Agent:** worker-sonnet (UI on existing components; contract fixed above).

**Files:**
- Create: `app/src/api/chat.ts`
- Create: `app/src/shell/chatView.ts`, Test: `app/src/shell/chatView.test.ts`
- Create: `app/src/shell/ChatPanel.tsx`, `app/src/shell/ChatPanel.module.css`
- Modify: `app/src/api/events.ts` (`es.onmessage`), `app/src/shell/Layout.tsx`, `app/src/shell/Sidebar.tsx`, `app/src/shell/Rail.tsx`

**Interfaces:**
- Consumes: HTTP contract + SSE events (top of plan), types from Task 1, `api()` from `app/src/api/client.ts`, ui kit from `app/src/ui/index.ts` (`Drawer`, `Select`, `Button`, `IconButton`, `Textarea`, `Spinner`, `EmptyState`, `toast`).
- Produces:

```ts
// app/src/api/chat.ts
export const chatKeys: {accounts: readonly ['chat-accounts']; list: readonly ['chats']; one(id: string): readonly ['chat', string]};
export const useChatAccounts: () => UseQueryResult<ChatAccount[]>;
export const useChats: () => UseQueryResult<ChatMeta[]>;
export const useChat: (id: string | null) => UseQueryResult<ChatDetail>; // enabled only with an id
export function useCreateChat(): UseMutationResult<ChatMeta, Error, {slug: string | null}>;
export function useSendChat(): UseMutationResult<void, Error, {id: string; text: string; account: string; screen: string; slug: string | null}>;
export function useStopChat(): UseMutationResult<void, Error, string>;
export function onChatEvent(ev: Extract<ServerEvent, {type: 'chat' | 'chatBusy'}>, qc: QueryClient): void;
export const useChatBusy: () => string | null;
export const useChatDraft: (id: string | null) => string;
// app/src/shell/chatView.ts
export function draftAfter(draft: string, e: ChatEvent): string;       // delta → draft + text; anything else → ''
export function isInterrupted(events: ChatEvent[], running: boolean): boolean; // last event is user/text/tool and not running
export function limitText(l: {account: string; resetsAt: number | null}): string; // "claude2 hết limit (reset 15:00)" / "claude2 hết limit"
```

- [ ] **Step 1: Pure helpers + failing test.** `app/src/shell/chatView.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {draftAfter, isInterrupted, limitText} from './chatView.ts';

describe('chatView', () => {
  it('draftAfter', () => {
    expect(draftAfter('Xin ', {kind: 'delta', text: 'chào'})).toBe('Xin chào');
    expect(draftAfter('Xin chào', {kind: 'text', text: 'Xin chào'})).toBe('');
    expect(draftAfter('x', {kind: 'done', costUsd: null, durationMs: null})).toBe('');
  });
  it('isInterrupted', () => {
    expect(isInterrupted([], false)).toBe(false);
    expect(isInterrupted([{kind: 'user', text: 'a', account: 'claude', at: 1}], false)).toBe(true);
    expect(isInterrupted([{kind: 'user', text: 'a', account: 'claude', at: 1}], true)).toBe(false);
    expect(isInterrupted([{kind: 'done', costUsd: null, durationMs: null}], false)).toBe(false);
  });
  it('limitText', () => {
    const at = new Date(2026, 10, 19, 15, 0).getTime() / 1000;
    expect(limitText({account: 'claude2', resetsAt: at})).toBe('claude2 hết limit (reset 15:00)');
    expect(limitText({account: 'claude2', resetsAt: null})).toBe('claude2 hết limit');
  });
});
```

Run `cd app && npx vitest run src/shell/chatView.test.ts` → FAIL. Then `app/src/shell/chatView.ts`:

```ts
import type {ChatEvent} from '../../shared/types.ts';

export const draftAfter = (draft: string, e: ChatEvent): string => (e.kind === 'delta' ? draft + e.text : '');
export function isInterrupted(events: ChatEvent[], running: boolean): boolean {
  const k = events.at(-1)?.kind;
  return !running && (k === 'user' || k === 'text' || k === 'tool');
}
export function limitText(l: {account: string; resetsAt: number | null}): string {
  if (l.resetsAt == null) return `${l.account} hết limit`;
  const t = new Date(l.resetsAt * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false});
  return `${l.account} hết limit (reset ${t})`;
}
```

Run again → PASS. (If `toLocaleTimeString('vi-VN')` renders `15:00` differently in Node's ICU, format with `getHours()`/`getMinutes()` padded instead.)

- [ ] **Step 2: API hooks + live store** `app/src/api/chat.ts`:

```ts
import {useMutation, useQuery, useQueryClient, type QueryClient} from '@tanstack/react-query';
import {useSyncExternalStore} from 'react';
import type {ChatAccount, ChatDetail, ChatMeta, ServerEvent} from '../../shared/types.ts';
import {draftAfter} from '../shell/chatView.ts';
import {api} from './client.ts';

export const chatKeys = {accounts: ['chat-accounts'] as const, list: ['chats'] as const, one: (id: string) => ['chat', id] as const};

export const useChatAccounts = () => useQuery({queryKey: chatKeys.accounts, queryFn: ({signal}) => api<ChatAccount[]>('/chat/accounts', {signal})});
export const useChats = () => useQuery({queryKey: chatKeys.list, queryFn: ({signal}) => api<ChatMeta[]>('/chats', {signal})});
export const useChat = (id: string | null) => useQuery({
  queryKey: chatKeys.one(id ?? ''), enabled: id !== null, queryFn: ({signal}) => api<ChatDetail>(`/chats/${id}`, {signal}),
});
export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({mutationFn: (v: {slug: string | null}) => api<ChatMeta>('/chats', {body: v}), onSuccess: () => qc.invalidateQueries({queryKey: chatKeys.list})});
}
export const useSendChat = () => useMutation({
  mutationFn: ({id, ...body}: {id: string; text: string; account: string; screen: string; slug: string | null}) => api<void>(`/chats/${id}/messages`, {body}),
});
export const useStopChat = () => useMutation({mutationFn: (id: string) => api<void>(`/chats/${id}/stop`, {method: 'POST'})});

// Live state from SSE; module-level because the panel can close and reopen.
let busy: string | null = null;
let drafts = new Map<string, string>();
const subs = new Set<() => void>();
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const emit = () => subs.forEach(f => f());

export function onChatEvent(ev: Extract<ServerEvent, {type: 'chat' | 'chatBusy'}>, qc: QueryClient): void {
  if (ev.type === 'chatBusy') {
    busy = ev.chatId;
    if (busy === null) { drafts = new Map(); void qc.invalidateQueries({queryKey: chatKeys.accounts}); }
    emit();
    return;
  }
  drafts = new Map(drafts).set(ev.chatId, draftAfter(drafts.get(ev.chatId) ?? '', ev.event));
  emit();
  if (ev.event.kind === 'delta') return;
  void qc.invalidateQueries({queryKey: chatKeys.one(ev.chatId)});
  if (ev.event.kind !== 'text' && ev.event.kind !== 'tool') void qc.invalidateQueries({queryKey: chatKeys.list});
}
export const useChatBusy = (): string | null => useSyncExternalStore(subscribe, () => busy);
export const useChatDraft = (id: string | null): string => useSyncExternalStore(subscribe, () => (id ? drafts.get(id) ?? '' : ''));
```

- [ ] **Step 3: Route chat SSE frames.** In `app/src/api/events.ts` `es.onmessage`, replace the body with:

```ts
try {
  const ev = JSON.parse(m.data) as ServerEvent;
  if (ev.type === 'chat' || ev.type === 'chatBusy') onChatEvent(ev, qc);
  else onEvent(ev, onChanged);
} catch { /* ignore malformed frame */ }
```

and `import {onChatEvent} from './chat.ts';`. The connect snapshot already re-sends `chatBusy`; the existing reconnect `qc.invalidateQueries()` refetches open chats.

- [ ] **Step 4: Panel** `app/src/shell/ChatPanel.tsx` — `export function ChatPanel({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element`. Behaviour:
  - Uses `Drawer` (`title="Chat với Claude"`, `width={420}`). On phones the drawer must be full width: if `app/src/ui/Overlay.module.css` `.drawer` does not already cap width, set `width: min(var(--w), 100vw)` there (only that property).
  - State: `chatId: string | null` (defaults to the newest chat from `useChats()` once loaded), `account: string` (reset to `chat.account` whenever the selected chat's data changes; falls back to the first account), `text: string`.
  - Context from `useLocation()`: `screen = pathname`; `slug = matchPath('/p/:slug/*', pathname)?.params.slug ?? null` (also match `/p/:slug`).
  - Header row: `Select` of chats (`label` = title, `hint` = `chat.slug ?? ''`) + `Button` "Phiên mới" (`useCreateChat({slug})` → select it); `Select` of accounts with `aria-label="Tài khoản Claude"` (`label` = name, `hint` = `limit ? Math.round(limit.utilization * 100) + '%' : ''`, treat null utilization as no hint).
  - Message list (`role="log"`, `aria-live="polite"`, scrolls to bottom when events/draft change):
    - `user` → right-aligned bubble, small caption with `account`.
    - `text` → left bubble, `white-space: pre-wrap`.
    - `tool` → one dim line `{name}: {summary}` (class `tool`).
    - `done` → nothing.
    - `error` → error line; with `limit` show `limitText(limit)` plus hint "Chọn tài khoản khác ở trên rồi gửi tiếp nếu muốn."; else the message.
    - When `busy === chatId`: a left bubble with `useChatDraft(chatId)` and a `Spinner`.
    - When `isInterrupted(events, busy === chatId)`: a dim line "Lượt này bị ngắt (server dừng giữa chừng)."
    - No chat yet / empty: `EmptyState` "Hỏi Claude bất cứ điều gì về video".
  - Composer (footer): `Textarea autosize` with `aria-label="Tin nhắn cho Claude"`, placeholder "Nhắn Claude… (Enter để gửi, Shift+Enter xuống dòng)". Enter sends unless `e.shiftKey || e.nativeEvent.isComposing` (Vietnamese IME). Disabled while `busy !== null`. When `busy === chatId` show `Button` "Dừng" (`useStopChat`); when busy on another chat show "Claude đang chạy ở phiên khác".
  - Send: if `chatId === null`, create a chat first (`{slug}`) and select it; then `useSendChat({id, text: text.trim(), account, screen, slug})`; clear `text` on success; on `HttpError` call `toast({title: 'Không gửi được', description: e.message, tone: 'error'})` and keep the text.
  - Styles in `ChatPanel.module.css` use only the existing CSS variables from `app/src/ui/tokens.css` (check the token names there; do not invent colors).

- [ ] **Step 5: Mount + buttons.**
  - `Layout.tsx`: `const [chatOpen, setChatOpen] = useState(false);` render `<ChatPanel open={chatOpen} onOpenChange={setChatOpen} />` once inside `.app`; pass `onChat={() => setChatOpen(true)}` to `Sidebar`, `Rail` and `MobileNav`.
  - `Sidebar.tsx`: accept `{onChat}`; a `Button` (variant matching the sidebar's other actions) with lucide `MessageSquare` icon and text "Chat với Claude" above `JobsPanel`.
  - `Rail.tsx`: accept `{onChat}`; an `IconButton label="Chat với Claude" icon={<MessageSquare size={22} />}` first in `.bottom`.
  - `MobileNav` (in `Layout.tsx`): an `IconButton label="Chat với Claude"` left of the menu button.
  - Show a small dot on these buttons while `useChatBusy() !== null` (reuse the Rail badge styling pattern; optional for Sidebar).

- [ ] **Step 6: Verify.** `cd app && npx vitest run src && npx tsc --noEmit` → PASS. Then manual check with the fake CLI: `cd app && REEL_CLAUDE_BIN=$PWD/server/chat/fake-claude.mjs REEL_CHAT_DIR=/tmp/claude-1000/chats REEL_API_PORT=5346 REEL_UI_PORT=5347 NO_OPEN=1 npm start` (background), open http://127.0.0.1:5347 with Playwright MCP or the webapp-testing skill, send a message, screenshot desktop (1280×800) and phone (390×844) with the panel open, then stop the server. Report the screenshots' paths.

- [ ] **Step 7: Commit**

```bash
git add app/src/api/chat.ts app/src/api/events.ts app/src/shell/chatView.ts app/src/shell/chatView.test.ts app/src/shell/ChatPanel.tsx app/src/shell/ChatPanel.module.css app/src/shell/Layout.tsx app/src/shell/Sidebar.tsx app/src/shell/Rail.tsx
git commit -m "Chat: chat panel with account picker"
```

(Add `app/src/ui/Overlay.module.css` to the `git add` only if you changed it.)

---

### Task 6: E2E against the fake CLI

**Agent:** worker-sonnet.

**Files:**
- Create: `app/e2e-chat/serve.mjs`, `app/e2e-chat/chat.spec.ts`, `app/playwright.chat.config.ts`
- Modify: `app/package.json` (script `"e2e:chat": "playwright test -c playwright.chat.config.ts"`), `/CLAUDE.md` (Tests line: add `cd app && npm run e2e:chat`)

**Interfaces:**
- Consumes: the running app, `app/server/chat/fake-claude.mjs`, `makeClaudeHome` layout (re-created in `serve.mjs` in plain JS, since `.mjs` cannot import the TS helper without a loader — keep it 15 lines).

- [ ] **Step 1: `app/e2e-chat/serve.mjs`** — creates a temp home (`.claude/{.credentials.json, projects/}`, `.claude-acc2/{.credentials.json, projects → ../.claude/projects}`) and a temp chat dir, then `spawn('npm', ['start'], {stdio: 'inherit', env: {...process.env, NO_OPEN: '1', REEL_API_PORT: '5336', REEL_UI_PORT: '5337', REEL_CLAUDE_BIN: <abs path of fake-claude.mjs>, REEL_CLAUDE_HOME: home, REEL_CHAT_DIR: chats}})`; forwards SIGINT/SIGTERM to the child and removes both temp dirs on exit.

- [ ] **Step 2: `app/playwright.chat.config.ts`**:

```ts
import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: 'e2e-chat',
  timeout: 60_000,
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:5337', actionTimeout: 10_000},
  webServer: {command: 'node e2e-chat/serve.mjs', url: 'http://127.0.0.1:5337/api/health', reuseExistingServer: false, timeout: 120_000},
});
```

- [ ] **Step 3: `app/e2e-chat/chat.spec.ts`** — one serial test file:
  1. `goto('/')`, click button `Chat với Claude` (use `getByRole('button', {name: 'Chat với Claude'}).first()`), dialog visible.
  2. Fill `Tin nhắn cho Claude` with `Xin chào`, press Enter → expect text `acc=default mode=new sys=yes prompt=Xin chào` and a line containing `Bash: ls projects`.
  3. Send `lần hai` → `acc=default mode=resume`.
  4. Send `LIMIT` → `claude hết limit (reset` visible, plus the hint "Chọn tài khoản khác".
  5. Pick `claude2` in `Tài khoản Claude`, send `tiếp` → `acc=.claude-acc2 mode=resume`.
  6. Send `SLOW` → `Dừng` button visible → click → `Đã dừng` visible, composer enabled again.
  7. `page.reload()`, reopen the panel → `prompt=Xin chào` still shown (persisted history).

- [ ] **Step 4: Run** `cd app && npm run e2e:chat`. Expected: 1 passed. Also confirm the main E2E config does not pick up `e2e-chat/` (its `testDir` is `e2e`).

- [ ] **Step 5: Commit**

```bash
git add app/e2e-chat/serve.mjs app/e2e-chat/chat.spec.ts app/playwright.chat.config.ts app/package.json CLAUDE.md
git commit -m "Chat: E2E with a fake claude CLI"
```

---

## Final review (main session)

- Read the full branch diff; run `uv run --with pytest python -m pytest tools/tests -q`, `cd studio && npx tsc --noEmit`, `cd app && npm test && npx tsc --noEmit && npm run e2e:chat`.
- One real end-to-end check by the user in the app: send a short message on `claude`, switch to `claude2`, send again, confirm the reply knows the earlier turn (resume across accounts works on real accounts).
