import path from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';
import type {ChatEvent, LimitInfo} from '../../shared/types.ts';
import {runTurn, turnArgs} from './runner.ts';
import {makeTestRoot} from '../testRoot.ts';

const FAKE = path.join(import.meta.dirname, 'fake-claude.mjs');
import type {Account} from './accounts.ts';
const def: Account = {name: 'claude', configDir: null};
const acc2: Account = {name: 'claude2', configDir: '/tmp/h/.claude-acc2'};

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
