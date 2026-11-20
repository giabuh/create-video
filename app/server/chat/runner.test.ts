import path from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';
import type {ChatEvent, LimitInfo} from '../../shared/types.ts';
import {codexArgs, runTurn, turnArgs} from './runner.ts';
import {makeTestRoot} from '../testRoot.ts';

const FAKE = path.join(import.meta.dirname, 'fake-claude.mjs');
import type {Account} from './accounts.ts';
const def: Account = {name: 'claude', engine: 'claude', configDir: null};
const acc2: Account = {name: 'claude2', engine: 'claude', configDir: '/tmp/h/.claude-acc2'};

async function turn(prompt: string, o: {resume?: boolean; account?: Account; signal?: AbortSignal} = {}) {
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
    expect(turnArgs({sessionId: 'S', resume: true, systemAppend: 'X', model: 'haiku', effort: 'max'}).slice(-4)).toEqual(['--model', 'haiku', '--effort', 'max']);
  });
});

describe('runTurn (fake CLI)', () => {
  it('never rejects: NUL in argv yields exactly one error event', async () => {
    const events: ChatEvent[] = [];
    await runTurn({sessionId: '11111111-1111-4111-8111-111111111111', resume: false, account: def, prompt: 'x', systemAppend: 'a\u0000b',
      signal: new AbortController().signal, onEvent: e => events.push(e)});
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('error');
  });

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
  it('limit then exit without result → error still carries limit', async () => {
    const r = await turn('HARDLIMIT');
    expect(r.events.at(-1)).toEqual({kind: 'error', message: 'usage limit reached', limit: {account: 'claude', resetsAt: 1795514400}});
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
