import {useEffect, useRef, useState} from 'react';
import {MessageSquare} from 'lucide-react';
import {matchPath, useLocation} from 'react-router';
import type {Engine} from '../../shared/types.ts';
import {Button, Drawer, DropdownMenu, EmptyState, Select, Spinner, Textarea, toast} from '../ui/index.ts';
import {useChat, useChatAccounts, useChatBusy, useChatDraft, useChats, useCreateChat, useSendChat, useStopChat} from '../api/chat.ts';
import {isInterrupted, limitText} from './chatView.ts';
import {mdToHtml} from './markdown.ts';
import s from './ChatPanel.module.css';

export function ChatPanel({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  const {pathname} = useLocation();
  const slug = matchPath('/p/:slug/*', pathname)?.params.slug ?? matchPath('/p/:slug', pathname)?.params.slug ?? null;
  const chats = useChats();
  const accounts = useChatAccounts();
  const [picked, setPicked] = useState<string | null>(null);
  const chatId = picked ?? chats.data?.[0]?.id ?? null; // newest by default
  const [waiting, setWaiting] = useState<{id: string; n: number} | null>(null); // a turn we sent and have not seen finish
  const detail = useChat(chatId, waiting !== null && waiting.id === chatId);
  const engine: Engine = detail.data?.chat.engine ?? 'claude';
  const engineName = engine === 'codex' ? 'Codex' : 'Claude';
  const busy = useChatBusy();
  const draft = useChatDraft(chatId);
  const create = useCreateChat();
  const send = useSendChat();
  const stop = useStopChat();
  const [account, setAccount] = useState('');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const chatAccount = detail.data?.chat.account;
  useEffect(() => { if (chatAccount) setAccount(chatAccount); }, [chatAccount]);
  const engAccounts = (accounts.data ?? []).filter((a) => a.engine === engine);
  const hasCodex = (accounts.data ?? []).some((a) => a.engine === 'codex');
  const accountNames = engAccounts.map((a) => a.name);
  const acct = accountNames.includes(account) ? account : accountNames[0] ?? '';

  const events = detail.data?.events ?? [];
  // Follow the newest message unless the user scrolled up to read. On open the drawer is still sliding in and
  // markdown is laying out, so scroll again on the next frames instead of once.
  const follow = useRef(true);
  useEffect(() => { follow.current = true; }, [open, chatId]);
  useEffect(() => {
    const box = endRef.current?.closest<HTMLElement>('[role="dialog"] [class*="body"]');
    if (!box) return;
    const onScroll = () => { follow.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; };
    box.addEventListener('scroll', onScroll, {passive: true});
    return () => box.removeEventListener('scroll', onScroll);
  }, [open, detail.isSuccess]);
  useEffect(() => {
    if (!open || !follow.current) return;
    const go = () => endRef.current?.scrollIntoView?.({block: 'end'});
    const f = requestAnimationFrame(go);
    const t1 = setTimeout(go, 150), t2 = setTimeout(go, 450); // after the slide-in animation and late layout
    return () => { cancelAnimationFrame(f); clearTimeout(t1); clearTimeout(t2); };
  }, [events.length, draft, open, chatId, detail.isSuccess, busy]);

  useEffect(() => { if (busy === null && open) inputRef.current?.querySelector('textarea')?.focus(); }, [busy, open]);
  const last = events.at(-1)?.kind;
  useEffect(() => { if (waiting && waiting.id === chatId && events.length > waiting.n && (last === 'done' || last === 'error')) setWaiting(null); }, [waiting, chatId, events.length, last]);
  const running = (busy !== null && busy === chatId) || waiting?.id === chatId;
  const newChat = (e: Engine) => create.mutate({slug, engine: e}, {onSuccess: (c) => setPicked(c.id)});
  const submit = async () => {
    const t = text.trim();
    if (!t || busy !== null || running || !acct) return;
    try {
      let id = chatId;
      if (id === null) { id = (await create.mutateAsync({slug})).id; setPicked(id); }
      const n = id === chatId ? events.length : 0;
      await send.mutateAsync({id, text: t, account: acct, screen: pathname, slug});
      setWaiting({id, n});
      setText('');
    } catch (e) {
      toast({title: 'Không gửi được', description: e instanceof Error ? e.message : String(e), tone: 'error'});
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={`Chat với ${engineName}`} width={640} footer={
      <div className={s.foot} ref={inputRef}>
        <Textarea
          autosize rows={2} value={text} aria-label={`Tin nhắn cho ${engineName}`} disabled={busy !== null || running}
          placeholder={`Nhắn ${engineName}… (Enter để gửi, Shift+Enter xuống dòng)`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
        />
        {(busy !== null || running) && (
          <div className={s.note}>
            {running ? <><span>{engineName} đang trả lời…</span><Button size="sm" onClick={() => stop.mutate(chatId!)}>Dừng</Button></> : <span>Đang chạy ở phiên khác</span>}
          </div>
        )}
      </div>
    }>
      <div className={s.wrap}>
        <div className={s.head}>
          <div className={s.row}>
            <Select key={chatId === null ? 'none' : 'set'} aria-label="Phiên chat" value={chatId} placeholder="Chưa có phiên" onChange={setPicked}
              options={(chats.data ?? []).map((c) => ({value: c.id, label: c.title, hint: [c.engine === 'codex' ? 'Codex' : 'Claude', c.slug].filter(Boolean).join(' · ')}))} />
            <DropdownMenu align="end" trigger={<Button size="sm" loading={create.isPending}>Phiên mới</Button>} items={[
              {label: 'Phiên Claude', onSelect: () => newChat('claude')},
              {label: 'Phiên Codex', onSelect: () => newChat('codex'), disabled: !hasCodex},
            ]} />
          </div>
          <Select key={acct ? 'set' : 'none'} aria-label="Tài khoản Claude" value={acct || null} onChange={setAccount}
            options={engAccounts.map((a) => ({value: a.name, label: a.name, hint: a.limit?.utilization != null ? `${Math.round(a.limit.utilization * 100)}%` : ''}))} />
        </div>
        <div className={s.log} role="log" aria-live="polite">
          {events.length === 0 && !running && <EmptyState icon={<MessageSquare size={28} />} title={`Hỏi ${engineName} bất cứ điều gì về video`} />}
          {events.map((e, i) => {
            switch (e.kind) {
              case 'user': return <div key={i} style={{display: 'contents'}}><span className={s.cap}>{e.account}</span><div className={s.me}>{e.text}</div></div>;
              case 'text': return <div key={i} className={`${s.bot} ${s.md}`} dangerouslySetInnerHTML={{__html: mdToHtml(e.text)}} />;
              case 'tool': return <div key={i} className={s.tool} title={`${e.name}: ${e.summary}`}>{e.name}: {e.summary}</div>;
              case 'error': return (
                <div key={i} className={s.err} role="alert">
                  {e.limit ? <>{limitText(e.limit)}<small>Chọn tài khoản khác ở trên rồi gửi tiếp nếu muốn.</small></> : e.message}
                </div>
              );
              default: return null;
            }
          })}
          {running && <div className={s.bot}>{draft}<Spinner size={16} label={`${engineName} đang trả lời`} /></div>}
          {isInterrupted(events, running) && <div className={s.note}>Lượt này bị ngắt (server dừng giữa chừng).</div>}
          <div ref={endRef} />
        </div>
      </div>
    </Drawer>
  );
}
