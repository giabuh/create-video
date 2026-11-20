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
  process.env.REEL_CODEX_BIN = path.join(import.meta.dirname, '../chat/fake-codex.mjs');
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
    expect((await (await req('/api/chat/accounts')).json()).map((a: {name: string}) => a.name)).toEqual(['claude', 'claude2', 'claude10', 'codex']);
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

  it('hostile screen (NUL, newline) is neutralised: 202 and the turn ends normally', async () => {
    const {req, chat} = setup();
    const c = await newChat(req);
    const r = await req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'claude', screen: '/a\u0000b\n"x', slug: null}});
    expect(r.status).toBe(202);
    await chat.idle();
    const d: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    expect(d.events.at(-1)?.kind).toBe('done');
  });

  it('model and effort are passed as flags and remembered on the chat', async () => {
    const {req, chat} = setup();
    const c = await newChat(req);
    expect((await req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'claude', model: 'haiku', effort: 'low', screen: '/', slug: null}})).status).toBe(202);
    await chat.idle();
    const d: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    expect(d.events.find(e => e.kind === 'text')).toMatchObject({text: expect.stringMatching(/ model=haiku effort=low /)});
    expect(d.chat).toMatchObject({model: 'haiku', effort: 'low'});
  });

  it('validation', async () => {
    const {req} = setup();
    const c = await newChat(req);
    expect((await send(req, c.id, '   ')).status).toBe(400);
    expect((await send(req, c.id, 'x'.repeat(20_001))).status).toBe(400);
    expect((await send(req, c.id, 'hi', 'claude3')).status).toBe(400); // no credentials → not an account
    expect((await req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'claude', slug: '../x'}})).status).toBe(400);
    expect((await req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'claude', model: 'gpt; rm'}})).status).toBe(400);
    expect((await req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'claude', effort: 'ultra'}})).status).toBe(400);
    expect((await req('/api/chats', {method: 'POST', json: {slug: '../x'}})).status).toBe(400);
    expect((await req('/api/chats/not-a-uuid')).status).toBe(404);
    expect((await req('/api/chats/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await send(req, '00000000-0000-4000-8000-000000000000', 'hi')).status).toBe(404);
  });

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

  it('codex: model list from models_cache.json, -m and reasoning effort passed, effort checked against the model', async () => {
    const {req, chat} = setup();
    const models = await (await req('/api/chat/models')).json();
    expect(models.codex).toEqual([{value: 'gpt-a', efforts: ['low', 'ultra']}, {value: 'gpt-b', efforts: ['low', 'max']}]);
    expect(models.claude.map((m: {value: string}) => m.value)).toEqual(['opus', 'sonnet', 'haiku']);
    const c: ChatMeta = await (await req('/api/chats', {method: 'POST', json: {engine: 'codex'}})).json();
    const post = (json: object) => req(`/api/chats/${c.id}/messages`, {method: 'POST', json: {text: 'hi', account: 'codex', ...json}});
    expect((await post({model: 'gpt-hidden'})).status).toBe(400);
    expect((await post({model: 'gpt-b', effort: 'ultra'})).status).toBe(400); // gpt-b has no ultra
    expect((await post({effort: 'ultra'})).status).toBe(400); // default model: only efforts every model has
    expect((await post({model: 'opus'})).status).toBe(400); // claude model on a codex chat
    expect((await post({model: 'gpt-a', effort: 'ultra'})).status).toBe(202);
    await chat.idle();
    const d: ChatDetail = await (await req(`/api/chats/${c.id}`)).json();
    expect(d.events.find(e => e.kind === 'text')).toMatchObject({text: expect.stringMatching(/ -m=gpt-a -c="ultra" /)});
    expect(d.chat).toMatchObject({model: 'gpt-a', effort: 'ultra'});
  });

  it('claude account cannot be used on a codex chat and vice versa; bad engine → 400', async () => {
    const {req} = setup();
    expect((await req('/api/chats', {method: 'POST', json: {engine: 'gpt'}})).status).toBe(400);
    const c = await newChat(req); // claude chat
    expect(c.engine).toBe('claude');
    expect((await send(req, c.id, 'hi', 'codex')).status).toBe(400);
  });
});
