# In-app Codex chat (3B) Implementation Plan

> **For agentic workers:** Execute the tasks in order (one worker does all of them). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a Codex engine to the existing in-app chat: a chat is Claude or Codex for life, Codex runs `codex exec --json --yolo`, resumes by the thread id Codex returns.

**Architecture:** Reuse part A end to end. `runTurn` picks binary/argv/line-parser from the account's `engine`; a new pure parser maps codex JSONL to the existing `Parsed` shape; `ChatMeta` gains `engine` + `threadId`; the panel gets a "Phiên Claude / Phiên Codex" menu and filters accounts by engine.

**Tech Stack:** as part A (Hono 4, React 19 + TanStack Query, vitest, Playwright). Spec: `docs/superpowers/specs/2026-11-19-app-codex-chat-design.md`.

## Global Constraints

- Codex argv, exactly: new `exec --json --yolo --skip-git-repo-check -c developer_instructions=<JSON.stringify(systemAppend)> -`; resume `exec resume --json --yolo --skip-git-repo-check -c developer_instructions=<…> <threadId> -`. Prompt on **stdin**. cwd = `repoRoot()`.
- Binary: `process.env.REEL_CODEX_BIN ?? 'codex'`. Codex account detected by `<claudeHome()>/.codex/auth.json`; name `codex`, `configDir: null`.
- threadId accepted from the stream only if it matches the uuid shape (it is later put on argv).
- Engine locked per chat; account must match the chat's engine (400 otherwise). One running turn app-wide across engines.
- Old index entries (no `engine`/`threadId`) read as `engine: 'claude'`, `threadId: null`.
- No test spends real quota (fake binaries only). No new npm deps.
- UI copy Vietnamese; code/comments/commits English; commit messages one line, no body, no Co-Authored-By.
- Testing cadence: per task run only touched tests + `cd app && npx tsc --noEmit`; the full suite (`npm test`, `npm run e2e:chat`) once at the end.
- Stage files by explicit path, never `git add -A`. Do not commit unrelated files in the tree (e.g. `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md`, `app/src/screens/Renders/Renders.module.css`, `brands/1/`, other untracked docs).
- Never kill the user's app on port 5317; never use broad `pkill`/`fuser`/`killall`. Kill only PIDs you started.

## File map

| File | Task | Change |
|---|---|---|
| `app/shared/types.ts` | 1 | `Engine`; `engine` on `ChatAccount`; `engine`, `threadId` on `ChatMeta` |
| `app/server/chat/stream.ts` | 1 | `Parsed` gains `threadId?`, `note?` |
| `app/server/chat/codexStream.ts` (+test, fixture) | 1 | codex line parser |
| `app/server/chat/accounts.ts` (+test), `testHome.ts` | 2 | `engine` on `Account`; codex detection |
| `app/server/chat/runner.ts` (+test), `fake-codex.mjs` | 2 | engine dispatch, `codexArgs`, fake CLI |
| `app/server/chat/store.ts`, `service.ts`, `routes/chats.ts` (+test) | 3 | engine/threadId persistence, validation |
| `app/src/api/chat.ts`, `app/src/shell/ChatPanel.tsx` | 4 | engine menu, filtered accounts, titles |
| `app/e2e-chat/serve.mjs`, `chat.spec.ts`, `AGENTS.md` | 5 | E2E codex flow; AGENTS.md symlink |

---

### Task 1: Types and codex parser

**Files:** modify `app/shared/types.ts`, `app/server/chat/stream.ts`; create `app/server/chat/codexStream.ts`, `app/server/chat/codexStream.test.ts`, `app/server/chat/fixtures/codex-turn.jsonl`.

- [ ] **Step 1: types.** In `app/shared/types.ts` replace the `ChatAccount` and `ChatMeta` lines with:

```ts
export type Engine = 'claude' | 'codex';
export type ChatAccount = {name: string; engine: Engine; limit: LimitInfo | null};
export type ChatMeta = {id: string; title: string; engine: Engine; account: string; slug: string | null; started: boolean; threadId: string | null; createdAt: number; updatedAt: number};
```

- [ ] **Step 2: `Parsed`.** In `app/server/chat/stream.ts` extend the `Parsed` type (keep everything else):

```ts
export type Parsed = {
  events: ChatEvent[];
  init?: true;
  threadId?: string;   // codex: the thread to resume later
  note?: string;       // non-terminal error text, used if the process dies without a result
  limit?: LimitInfo;
  result?: {isError: boolean; message: string | null; costUsd: number | null; durationMs: number | null; http429: boolean};
};
```

- [ ] **Step 3: fixture** `app/server/chat/fixtures/codex-turn.jsonl` (first 7 lines are a real capture, the rest synthetic):

```
{"type":"thread.started","thread_id":"01a1f20b-c273-7340-b1d8-e82e51082ee7"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Running the command."}}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"/bin/bash -lc 'ls tools | head -3'","aggregated_output":"","exit_code":null,"status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"/bin/bash -lc 'ls tools | head -3'","aggregated_output":"ingest.py\n","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"done"}}
{"type":"turn.completed","usage":{"input_tokens":68073,"cached_input_tokens":41216,"output_tokens":101}}
{"type":"item.completed","item":{"id":"item_3","type":"reasoning","text":"thinking"}}
{"type":"item.completed","item":{"id":"item_4","type":"file_change","changes":[{"path":"projects/x/storyboard.json","kind":"update"},{"path":"config.json","kind":"update"}],"status":"completed"}}
{"type":"item.completed","item":{"id":"item_5","type":"web_search","query":"remotion spring"}}
not json
```

- [ ] **Step 4: failing test** `app/server/chat/codexStream.test.ts`:

```ts
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseCodexLine, shellCommand} from './codexStream.ts';

const lines = readFileSync(path.join(import.meta.dirname, 'fixtures/codex-turn.jsonl'), 'utf8').split('\n').filter(Boolean);

describe('parseCodexLine', () => {
  it('maps the captured turn', () => {
    const all = lines.map(parseCodexLine);
    expect(all[0]).toEqual({events: [], init: true, threadId: '01a1f20b-c273-7340-b1d8-e82e51082ee7'});
    expect(all[1]).toEqual({events: []});
    expect(all[2]?.events).toEqual([{kind: 'text', text: 'Running the command.'}]);
    expect(all[3]?.events).toEqual([{kind: 'tool', name: 'Bash', summary: 'ls tools | head -3'}]);
    expect(all[4]?.events).toEqual([]); // completed command already shown on start
    expect(all[5]?.events).toEqual([{kind: 'text', text: 'done'}]);
    expect(all[6]?.result).toEqual({isError: false, message: null, costUsd: null, durationMs: null, http429: false});
    expect(all[7]?.events).toEqual([]);
    expect(all[8]?.events).toEqual([{kind: 'tool', name: 'Edit', summary: 'projects/x/storyboard.json, config.json'}]);
    expect(all[9]?.events).toEqual([{kind: 'tool', name: 'Search', summary: 'remotion spring'}]);
    expect(all[10]).toBeNull();
  });
  it('turn.failed → error result; limit text → rejected limit', () => {
    const r = parseCodexLine(JSON.stringify({type: 'turn.failed', error: {message: "You've hit your usage limit."}}));
    expect(r?.result).toEqual({isError: true, message: "You've hit your usage limit.", costUsd: null, durationMs: null, http429: false});
    expect(r?.limit).toEqual({status: 'rejected', resetsAt: null, utilization: null, type: null});
    expect(parseCodexLine(JSON.stringify({type: 'turn.failed', error: {message: 'boom'}}))?.limit).toBeUndefined();
  });
  it('error event is a non-terminal note', () => {
    const r = parseCodexLine(JSON.stringify({type: 'error', message: 'Reconnecting... 1/5'}));
    expect(r).toEqual({events: [], note: 'Reconnecting... 1/5'});
  });
  it('rejects a thread id that is not uuid-shaped', () => {
    expect(parseCodexLine(JSON.stringify({type: 'thread.started', thread_id: '--yolo'}))).toEqual({events: []});
  });
  it('shellCommand unwraps bash -lc', () => {
    expect(shellCommand("/bin/bash -lc 'echo '\\''hi'\\'''")).toBe("echo 'hi'");
    expect(shellCommand('ls')).toBe('ls');
  });
});
```

Run: `cd app && npx vitest run server/chat/codexStream.test.ts` → FAIL (module missing).

- [ ] **Step 5: implement** `app/server/chat/codexStream.ts`:

```ts
import type {Parsed} from './stream.ts';

type R = Record<string, unknown>;
const obj = (v: unknown): R | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const short = (s: string): string => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > 80 ? t.slice(0, 79) + '…' : t; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // goes to argv on resume
const LIMIT_RE = /usage limit|rate limit|429|quota/i;

/** `/bin/bash -lc '<cmd>'` → `<cmd>` */
export function shellCommand(cmd: string): string {
  const m = /^\S*bash -lc '([\s\S]*)'$/.exec(cmd);
  return m ? m[1].replace(/'\\''/g, "'") : cmd;
}

/** One `codex exec --json` line → the same shape the Claude parser returns. */
export function parseCodexLine(line: string): Parsed | null {
  let e: R | null;
  try { e = obj(JSON.parse(line)); } catch { return null; }
  if (!e) return null;
  const out: Parsed = {events: []};
  const item = obj(e.item);
  switch (e.type) {
    case 'thread.started': {
      const id = str(e.thread_id);
      if (id && UUID.test(id)) { out.init = true; out.threadId = id; }
      break;
    }
    case 'item.started':
      if (item?.type === 'command_execution' && str(item.command)) out.events.push({kind: 'tool', name: 'Bash', summary: short(shellCommand(item.command as string))});
      break;
    case 'item.completed':
      if (!item) break;
      if (item.type === 'agent_message' && str(item.text)) out.events.push({kind: 'text', text: item.text as string});
      else if (item.type === 'file_change' && Array.isArray(item.changes)) out.events.push({kind: 'tool', name: 'Edit', summary: short(item.changes.map(c => str(obj(c)?.path)).filter(Boolean).join(', '))});
      else if (item.type === 'mcp_tool_call') out.events.push({kind: 'tool', name: 'MCP', summary: short([str(item.server), str(item.tool)].filter(Boolean).join('.'))});
      else if (item.type === 'web_search') out.events.push({kind: 'tool', name: 'Search', summary: short(str(item.query) ?? '')});
      break;
    case 'turn.completed':
      out.result = {isError: false, message: null, costUsd: null, durationMs: null, http429: false};
      break;
    case 'turn.failed':
    case 'error': {
      const msg = str(obj(e.error)?.message) ?? str(e.message) ?? 'Codex báo lỗi';
      if (LIMIT_RE.test(msg)) out.limit = {status: 'rejected', resetsAt: null, utilization: null, type: null};
      if (e.type === 'turn.failed') out.result = {isError: true, message: msg, costUsd: null, durationMs: null, http429: false};
      else out.note = msg; // may be a retry notice; only shown if the process dies without a result
      break;
    }
  }
  return out;
}
```

Note the test for the limit-free `error` expects no `limit` key: `{events: [], note: …}`. Keep `out.limit` unset (not `undefined`-assigned) when there is no match, as above.

- [ ] **Step 6:** run the test → PASS. `npx tsc --noEmit` will now fail where `ChatMeta`/`ChatAccount` are built without `engine`/`threadId` (service.ts, ChatPanel/tests) — that is expected and fixed in Tasks 2–4; do not commit yet if you prefer, or commit now and continue (tsc must be clean by the end of Task 4).

- [ ] **Step 7: commit** `git add app/shared/types.ts app/server/chat/stream.ts app/server/chat/codexStream.ts app/server/chat/codexStream.test.ts app/server/chat/fixtures/codex-turn.jsonl && git commit -m "Chat: codex stream parser and engine types"`

---

### Task 2: Accounts, runner dispatch, fake codex

**Files:** modify `app/server/chat/accounts.ts`, `accounts.test.ts`, `testHome.ts`, `runner.ts`, `runner.test.ts`; create `app/server/chat/fake-codex.mjs` (executable).

- [ ] **Step 1: accounts.** In `accounts.ts`:

```ts
import type {Engine} from '../../shared/types.ts';
export type Account = {name: string; engine: Engine; configDir: string | null};
```
- the `claude` push becomes `{name: 'claude', engine: 'claude', configDir: null}`, numbered ones `{name: `claude${m[1]}`, engine: 'claude', configDir: dir}`;
- before `return out;` add:

```ts
  if (await exists(path.join(home, '.codex', 'auth.json'))) out.push({name: 'codex', engine: 'codex', configDir: null}); // codex uses ~/.codex, CODEX_HOME untouched
```

- [ ] **Step 2: test home.** In `testHome.ts`, before `return home;` add:

```ts
  await mkdir(path.join(home, '.codex'), {recursive: true});
  await writeFile(path.join(home, '.codex', 'auth.json'), '{}');
```

- [ ] **Step 3: accounts tests.** In `accounts.test.ts` add `engine: 'claude'` to every `Account` literal (expected list and `childEnv` arguments) and append `{name: 'codex', engine: 'codex', configDir: null}` as the last expected entry of the "keeps only usable accounts" test.

- [ ] **Step 4: fake codex** `app/server/chat/fake-codex.mjs` (then `chmod +x`):

```js
#!/usr/bin/env node
// Test double for `codex exec --json`. Behaviour is picked by words in the prompt: LIMIT, NOTHREAD.
import {randomUUID} from 'node:crypto';

const args = process.argv.slice(2);
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => { run(); });

function run() {
  const resume = args[0] === 'exec' && args[1] === 'resume';
  const thread = resume ? args[args.length - 2] : randomUUID();
  if (resume && prompt.includes('NOTHREAD')) {
    process.stderr.write(`Error: thread/resume: thread/resume failed: no rollout found for thread id ${thread} (code -32600)\n`);
    process.exit(1);
  }
  out({type: 'thread.started', thread_id: thread});
  out({type: 'turn.started'});
  if (prompt.includes('LIMIT')) {
    out({type: 'error', message: "You've hit your usage limit."});
    out({type: 'turn.failed', error: {message: "You've hit your usage limit."}});
    process.exit(1);
  }
  const c = args.indexOf('-c');
  const dev = c >= 0 && args[c + 1].startsWith('developer_instructions=') ? 'yes' : 'no';
  const reply = `engine=codex mode=${resume ? 'resume' : 'new'} thread=${thread} dev=${dev} prompt=${prompt.trim()}`;
  const cmd = "/bin/bash -lc 'ls projects'";
  out({type: 'item.started', item: {id: 'item_0', type: 'command_execution', command: cmd, aggregated_output: '', exit_code: null, status: 'in_progress'}});
  out({type: 'item.completed', item: {id: 'item_0', type: 'command_execution', command: cmd, aggregated_output: '_smoke\n', exit_code: 0, status: 'completed'}});
  out({type: 'item.completed', item: {id: 'item_1', type: 'agent_message', text: reply}});
  out({type: 'turn.completed', usage: {input_tokens: 10, cached_input_tokens: 0, output_tokens: 5}});
}
```

- [ ] **Step 5: runner.** In `runner.ts`:
  - import `parseCodexLine` from `./codexStream.ts`;
  - add `export const codexBin = (): string => process.env.REEL_CODEX_BIN ?? 'codex';`
  - change `onInit?(): void` in `TurnOpts` to `onInit?(threadId: string | null): void`;
  - add:

```ts
export function codexArgs(o: Pick<TurnOpts, 'sessionId' | 'resume' | 'systemAppend'>): string[] {
  // JSON string escapes are valid TOML basic-string escapes
  const common = ['--json', '--yolo', '--skip-git-repo-check', '-c', `developer_instructions=${JSON.stringify(o.systemAppend)}`];
  return o.resume ? ['exec', 'resume', ...common, o.sessionId, '-'] : ['exec', ...common, '-'];
}
```
  - in `runTurn`, right after `const end = …`, add `const t0 = Date.now(); const codex = o.account.engine === 'codex'; const parse = codex ? parseCodexLine : parseLine;`
  - spawn line: `spawn(codex ? codexBin() : claudeBin(), codex ? codexArgs(o) : turnArgs(o), {…same…})`
  - in the line handler: `const r = parse(line);`, `if (r.init) o.onInit?.(r.threadId ?? null);`, and after the limit line add `if (r.note) lastErr = r.note;`
  - the `done` event: `durationMs: res.durationMs ?? Date.now() - t0`.

- [ ] **Step 6: runner tests.** In `runner.test.ts`: add `engine: 'claude'` to `def` and `acc2`; then add:

```ts
const FAKE_CODEX = path.join(import.meta.dirname, 'fake-codex.mjs');
const cdx: Account = {name: 'codex', engine: 'codex', configDir: null};

describe('codexArgs', () => {
  it('new vs resume', () => {
    expect(codexArgs({sessionId: '', resume: false, systemAppend: 'a "b"'})).toEqual(['exec', '--json', '--yolo', '--skip-git-repo-check', '-c', 'developer_instructions="a \\"b\\""', '-']);
    expect(codexArgs({sessionId: 'T', resume: true, systemAppend: 'x'})).toEqual(['exec', 'resume', '--json', '--yolo', '--skip-git-repo-check', '-c', 'developer_instructions="x"', 'T', '-']);
  });
});

describe('runTurn codex (fake CLI)', () => {
  beforeAll(() => { process.env.REEL_CODEX_BIN = FAKE_CODEX; });
  async function cturn(prompt: string, thread: string | null) {
    const events: ChatEvent[] = []; const inits: (string | null)[] = [];
    await runTurn({sessionId: thread ?? '', resume: thread !== null, account: cdx, prompt, systemAppend: 'ctx',
      signal: new AbortController().signal, onEvent: e => events.push(e), onInit: t => inits.push(t)});
    return {events, inits};
  }
  it('new turn: thread id, tool, text, done with measured duration', async () => {
    const r = await cturn('hello', null);
    expect(r.inits).toHaveLength(1);
    expect(r.inits[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.events[0]).toEqual({kind: 'tool', name: 'Bash', summary: 'ls projects'});
    expect(r.events[1]).toEqual({kind: 'text', text: `engine=codex mode=new thread=${r.inits[0]} dev=yes prompt=hello`});
    expect(r.events[2]).toMatchObject({kind: 'done', costUsd: null});
    expect((r.events[2] as {durationMs: number}).durationMs).toBeGreaterThanOrEqual(0);
  });
  it('resume keeps the thread', async () => {
    const t = '01a1f20b-c273-7340-b1d8-e82e51082ee7';
    const r = await cturn('again', t);
    expect(r.inits).toEqual([t]);
    expect(r.events.find(e => e.kind === 'text')).toEqual({kind: 'text', text: `engine=codex mode=resume thread=${t} dev=yes prompt=again`});
  });
  it('limit → error with limit for account codex', async () => {
    const r = await cturn('LIMIT', null);
    expect(r.events.at(-1)).toEqual({kind: 'error', message: "You've hit your usage limit.", limit: {account: 'codex', resetsAt: null}});
  });
  it('unknown thread → error with the stderr line', async () => {
    const r = await cturn('NOTHREAD', '01a1f20b-c273-7340-b1d8-e82e51082ee7');
    expect(r.events).toEqual([{kind: 'error', message: expect.stringContaining('no rollout found')}]);
  });
});
```
(import `codexArgs` alongside `runTurn, turnArgs`; keep existing Claude tests passing.)

- [ ] **Step 7:** `chmod +x app/server/chat/fake-codex.mjs`; run `cd app && npx vitest run server/chat` → PASS.

- [ ] **Step 8: commit** the six files: `git commit -m "Chat: codex engine in the runner, with a fake codex CLI"` (make sure the exec bit is committed: `git ls-files -s app/server/chat/fake-codex.mjs` shows 100755).

---

### Task 3: Store, service, routes

**Files:** modify `app/server/chat/store.ts`, `app/server/chat/service.ts`, `app/server/routes/chats.ts`, `app/server/routes/chats.test.ts`.

- [ ] **Step 1: store.** `readIndex` normalizes part-A entries:

```ts
export async function readIndex(): Promise<ChatMeta[]> {
  const {data} = await readJsonOr<ChatMeta[]>(indexFile(), []);
  // part-A entries predate engine/threadId
  return Array.isArray(data) ? data.map(c => ({...c, engine: c.engine ?? 'claude', threadId: c.threadId ?? null})) : [];
}
```

- [ ] **Step 2: service.** In `service.ts` (import `Engine` from shared types):
  - `accounts()` → `(await listAccounts()).map(a => ({name: a.name, engine: a.engine, limit: this.#limits.get(a.name) ?? null}))`
  - `create`:

```ts
  async create(slug: string | null, engine: Engine): Promise<ChatMeta> {
    const account = (await listAccounts()).find(a => a.engine === engine);
    if (!account) throw new HttpError(400, `no ${engine} account`);
    const now = Date.now();
    const chat: ChatMeta = {id: randomUUID(), title: NEW_TITLE, engine, account: account.name, slug, started: false, threadId: null, createdAt: now, updatedAt: now};
    await updateIndex(l => [...l, chat]);
    return chat;
  }
```
  - in `send`, after the account lookup: `if (account.engine !== chat.engine) throw new HttpError(400, 'account does not match the chat engine');`
  - the `runTurn` call:

```ts
      const codex = chat.engine === 'codex';
      void runTurn({
        sessionId: codex ? chat.threadId ?? '' : id, resume: codex ? chat.threadId !== null : chat.started,
        account, prompt: m.text, systemAppend: systemAppend(m.screen, m.slug), signal: ac.signal,
        onEvent: …unchanged…,
        onInit: tid => {
          if (chat.started && (tid === null || tid === chat.threadId)) return;
          chat.started = true;
          if (tid !== null) chat.threadId = tid;
          void updateIndex(l => l.map(c => c.id === id ? {...c, started: true, threadId: chat.threadId} : c));
        },
        onLimit: …unchanged…,
      })…unchanged…
```
  - `systemAppend` text: replace `"The user is chatting with you from the reel app's chat panel; the app is running (CLAUDE.md rule 10: point them to the app instead of describing frames). "` with `"The user is chatting with you from the reel app's chat panel; the app is running (project rule 10 in CLAUDE.md/AGENTS.md: point them to the app instead of describing frames). "` (rest unchanged).

- [ ] **Step 3: route.** In `routes/chats.ts` the create route:

```ts
  app.post('/chats', async c => {
    const b = await bodyOf(c);
    const engine = b.engine ?? 'claude';
    if (engine !== 'claude' && engine !== 'codex') throw new HttpError(400, 'engine must be claude or codex');
    return c.json(await chat.create(slugOf(b.slug), engine), 201);
  });
```

- [ ] **Step 4: route tests.** In `chats.test.ts`:
  - `beforeEach` also sets `process.env.REEL_CODEX_BIN = path.join(import.meta.dirname, '../chat/fake-codex.mjs');`
  - the accounts test expects `['claude', 'claude2', 'claude10', 'codex']`;
  - add:

```ts
  it('codex chat: engine on create, account must match, second turn resumes the stored thread', async () => {
    const {req, chat} = setup();
    const r = await req('/api/chats', {method: 'POST', json: {slug: null, engine: 'codex'}});
    expect(r.status).toBe(201);
    const c: ChatMeta = await r.json();
    expect(c).toMatchObject({engine: 'codex', account: 'codex', threadId: null});
    expect((await send(req, c.id, 'hi', 'claude')).status).toBe(400);
    expect((await send(req, c.id, 'hi', 'codex')).status).toBe(202);
    await chat.idle();
    const d1: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    expect(d1.chat.threadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(d1.events.map(e => e.kind)).toEqual(['user', 'tool', 'text', 'done']);
    expect((await send(req, c.id, 'again', 'codex')).status).toBe(202);
    await chat.idle();
    const d2: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    expect(d2.events.filter(e => e.kind === 'text').at(-1)).toEqual({kind: 'text', text: `engine=codex mode=resume thread=${d1.chat.threadId} dev=yes prompt=again`});
  });

  it('claude account cannot be used on a codex chat and vice versa; bad engine → 400', async () => {
    const {req} = setup();
    expect((await req('/api/chats', {method: 'POST', json: {engine: 'gpt'}})).status).toBe(400);
    const c = await newChat(req); // claude chat
    expect(c.engine).toBe('claude');
    expect((await send(req, c.id, 'hi', 'codex')).status).toBe(400);
  });
```

- [ ] **Step 5:** run `cd app && npx vitest run server` → PASS (server tsc errors left only in `app/src`).

- [ ] **Step 6: commit** `git commit -m "Chat: codex chats in the service and routes"` (the four files).

---

### Task 4: UI

**Files:** modify `app/src/api/chat.ts`, `app/src/shell/ChatPanel.tsx` (and any `app/src` test/fixture that builds a `ChatMeta`/`ChatAccount` literal: add `engine: 'claude'`, `threadId: null`).

- [ ] **Step 1: `chat.ts`.** `useCreateChat`'s `mutationFn: (v: {slug: string | null; engine?: Engine}) => api<ChatMeta>('/chats', {body: v})` (import `Engine`).

- [ ] **Step 2: `ChatPanel.tsx`.**
  - import `DropdownMenu` from `../ui/index.ts` and `type {Engine}` from shared types;
  - after `const detail = useChat(chatId);`: `const engine: Engine = detail.data?.chat.engine ?? 'claude'; const engineName = engine === 'codex' ? 'Codex' : 'Claude';`
  - accounts of this engine only: `const engAccounts = (accounts.data ?? []).filter((a) => a.engine === engine);` and use `engAccounts` for `accountNames` and for the account `Select` options;
  - `const hasCodex = (accounts.data ?? []).some((a) => a.engine === 'codex');`
  - `const newChat = (e: Engine) => create.mutate({slug, engine: e}, {onSuccess: (c) => setPicked(c.id)});`
  - replace the "Phiên mới" `Button` with:

```tsx
            <DropdownMenu align="end" trigger={<Button size="sm" loading={create.isPending}>Phiên mới</Button>} items={[
              {label: 'Phiên Claude', onSelect: () => newChat('claude')},
              {label: 'Phiên Codex', onSelect: () => newChat('codex'), disabled: !hasCodex},
            ]} />
```
  - chat picker option hint: `hint: [c.engine === 'codex' ? 'Codex' : 'Claude', c.slug].filter(Boolean).join(' · ')`
  - Drawer `title={`Chat với ${engineName}`}`; running note `{engineName} đang trả lời…`; the other-chat note becomes `Đang chạy ở phiên khác`; the running bubble spinner `label={`${engineName} đang trả lời`}`.
  - Leave the account `Select` enabled; with one codex account it simply has one option.

- [ ] **Step 3:** `cd app && npx tsc --noEmit` → clean; `npx vitest run src` → PASS.

- [ ] **Step 4: commit** `git commit -m "Chat: Claude/Codex new-chat menu, accounts filtered by engine"`.

---

### Task 5: E2E, AGENTS.md, final checks

**Files:** modify `app/e2e-chat/serve.mjs`, `app/e2e-chat/chat.spec.ts`; create `AGENTS.md` (symlink).

- [ ] **Step 1: AGENTS.md.** From the repo root: `ln -s CLAUDE.md AGENTS.md` (codex reads AGENTS.md; one source of truth).

- [ ] **Step 2: serve.mjs.** In the temp home also create `.codex/auth.json` (`{}`), and add `REEL_CODEX_BIN: path.join(root, 'server/chat/fake-codex.mjs')` to the child env.

- [ ] **Step 3: spec.** Append a second test to `chat.spec.ts`:

```ts
test('codex chat with the fake codex CLI', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Chat với Claude'}).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: 'Phiên mới'}).click();
  await page.getByRole('menuitem', {name: 'Phiên Codex'}).click();
  await expect(dialog.getByRole('heading', {name: 'Chat với Codex'})).toBeVisible();
  const box = page.getByLabel('Tin nhắn cho Claude');
  await box.fill('xin chào codex'); await box.press('Enter');
  const first = dialog.getByText(/engine=codex mode=new thread=[0-9a-f-]{36} dev=yes prompt=xin chào codex/);
  await expect(first).toBeVisible();
  await expect(dialog.getByText('Bash: ls projects')).toBeVisible();
  const thread = /thread=([0-9a-f-]{36})/.exec(await first.innerText())![1];
  await expect(box).toBeEnabled();
  await box.fill('lần hai'); await box.press('Enter');
  await expect(dialog.getByText(`engine=codex mode=resume thread=${thread} dev=yes prompt=lần hai`)).toBeVisible();
});
```
If the Drawer title is not exposed as a heading, assert it with `dialog.getByText('Chat với Codex')` instead. Rename the composer's aria-label only if you also update the first test (keep `Tin nhắn cho Claude` otherwise).

- [ ] **Step 4: full checks.** `cd app && npx tsc --noEmit && npm test && npm run e2e:chat` — all green; run `e2e:chat` twice.

- [ ] **Step 5: commit** `git add AGENTS.md app/e2e-chat/serve.mjs app/e2e-chat/chat.spec.ts && git commit -m "Chat: codex E2E and AGENTS.md"`.
