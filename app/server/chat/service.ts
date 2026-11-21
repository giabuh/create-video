import {randomUUID} from 'node:crypto';
import type {ChatAccount, ChatDetail, ChatEvent, ChatMeta, ChatModels, Engine, LimitInfo} from '../../shared/types.ts';
import type {EventBus} from '../events.ts';
import {HttpError} from '../routes/util.ts';
import {chatModels, listAccounts} from './accounts.ts';
import {runTurn} from './runner.ts';
import {appendEvent, readEvents, readIndex, updateIndex} from './store.ts';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const NEW_TITLE = 'Phiên mới';
const titleOf = (t: string) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > 60 ? s.slice(0, 59) + '…' : s; };
const systemAppend = (screen: string, slug: string | null) =>
  `The user is chatting with you from the reel app's chat panel; the app is running (project rule 10 in CLAUDE.md/AGENTS.md: point them to the app instead of describing frames). ` +
  `They are on app screen "${screen}"${slug ? `, working on projects/${slug}` : ''}.` +
  ` The people using this app never edit by hand: make every change yourself (storyboard.json or code), and regenerate the voice after you change a scene's \`say\`.` +
  ` A tag like "[cảnh <id> · m:ss.s · khung N]" or "[CTA · m:ss.s · khung N]" points at that scene and frame of the current preview; you can render a still at frame N (CLAUDE.md "Still" command) to look at it.`;

export class ChatService {
  #bus: EventBus;
  #active: {chatId: string; ac: AbortController; done: Promise<void>} | null = null;
  #limits = new Map<string, LimitInfo>();
  constructor(bus: EventBus) { this.#bus = bus; }

  busy(): string | null { return this.#active?.chatId ?? null; }
  idle(): Promise<void> { return this.#active?.done ?? Promise.resolve(); }

  models(): Promise<ChatModels> { return chatModels(); }

  async accounts(): Promise<ChatAccount[]> {
    return (await listAccounts()).map(a => ({name: a.name, engine: a.engine, limit: this.#limits.get(a.name) ?? null}));
  }
  async list(): Promise<ChatMeta[]> { return (await readIndex()).sort((a, b) => b.updatedAt - a.updatedAt); }

  async create(slug: string | null, engine: Engine): Promise<ChatMeta> {
    const account = (await listAccounts()).find(a => a.engine === engine);
    if (!account) throw new HttpError(400, `no ${engine} account`);
    const now = Date.now();
    const chat: ChatMeta = {id: randomUUID(), title: NEW_TITLE, engine, account: account.name, slug, started: false, threadId: null, createdAt: now, updatedAt: now};
    await updateIndex(l => [...l, chat]);
    return chat;
  }

  async get(id: string): Promise<ChatDetail | null> {
    const chat = (await readIndex()).find(c => c.id === id);
    return chat ? {chat, events: await readEvents(id)} : null;
  }

  async send(id: string, m: {text: string; account: string; model?: string; effort?: string; screen: string; slug: string | null}): Promise<void> {
    if (this.#active) throw new HttpError(409, 'Claude đang trả lời ở một phiên khác');
    let release!: () => void;
    const ac = new AbortController();
    this.#active = {chatId: id, ac, done: new Promise<void>(r => { release = r; })}; // claimed before any await: no double start
    try {
      const chat = (await readIndex()).find(c => c.id === id);
      if (!chat) throw new HttpError(404, 'chat not found');
      const account = (await listAccounts()).find(a => a.name === m.account);
      if (!account) throw new HttpError(400, 'unknown account');
      if (account.engine !== chat.engine) throw new HttpError(400, 'account does not match the chat engine');
      // allow-list: model and effort become argv
      const options = (await chatModels())[chat.engine];
      const picked = m.model === undefined ? null : options.find(o => o.value === m.model);
      if (picked === undefined) throw new HttpError(400, 'unknown model');
      const efforts = picked ? picked.efforts : options.length ? options.map(o => o.efforts).reduce((a, b) => a.filter(e => b.includes(e))) : [];
      if (m.effort !== undefined && !efforts.includes(m.effort)) throw new HttpError(400, 'unknown effort');

      let w: Promise<void> = Promise.resolve();
      const persist = (e: ChatEvent) => { // write, then emit: a client refetch after the event sees it
        w = w.then(() => appendEvent(id, e)).then(() => this.#bus.emit({type: 'chat', chatId: id, event: e}), err => console.error('chat append', err));
      };
      persist({kind: 'user', text: m.text, account: account.name, at: Date.now()});
      await updateIndex(l => l.map(c => c.id === id ? {...c, account: account.name, model: m.model, effort: m.effort, title: c.title === NEW_TITLE ? titleOf(m.text) : c.title, updatedAt: Date.now()} : c));
      this.#bus.emit({type: 'chatBusy', chatId: id});

      const codex = chat.engine === 'codex';
      void runTurn({
        sessionId: codex ? chat.threadId ?? '' : id, resume: codex ? chat.threadId !== null : chat.started, account, model: m.model, effort: m.effort, prompt: m.text, systemAppend: systemAppend(m.screen, m.slug), signal: ac.signal,
        onEvent: e => { if (e.kind === 'delta') this.#bus.emit({type: 'chat', chatId: id, event: e}); else persist(e); },
        onInit: tid => {
          if (chat.started && (tid === null || tid === chat.threadId)) return;
          chat.started = true;
          if (tid !== null) chat.threadId = tid;
          void updateIndex(l => l.map(c => c.id === id ? {...c, started: true, threadId: chat.threadId} : c));
        },
        onLimit: l => { this.#limits.set(account.name, l); },
      }).then(async () => {
        await w;
        await updateIndex(l => l.map(c => c.id === id ? {...c, updatedAt: Date.now()} : c)).catch(() => undefined);
      }).catch(err => { persist({kind: 'error', message: String(err)}); }).finally(() => {
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
