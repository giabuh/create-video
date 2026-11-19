import {useEffect, useRef, useState} from 'react';
import {MessageSquare} from 'lucide-react';
import {matchPath, useLocation} from 'react-router';
import {Button, Drawer, EmptyState, Select, Spinner, Textarea, toast} from '../ui/index.ts';
import {HttpError} from '../api/client.ts';
import {useChat, useChatAccounts, useChatBusy, useChatDraft, useChats, useCreateChat, useSendChat, useStopChat} from '../api/chat.ts';
import {isInterrupted, limitText} from './chatView.ts';
import s from './ChatPanel.module.css';

export function ChatPanel({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  const {pathname} = useLocation();
  const slug = matchPath('/p/:slug/*', pathname)?.params.slug ?? matchPath('/p/:slug', pathname)?.params.slug ?? null;
  const chats = useChats();
  const accounts = useChatAccounts();
  const [picked, setPicked] = useState<string | null>(null);
  const chatId = picked ?? chats.data?.[0]?.id ?? null; // newest by default
  const detail = useChat(chatId);
  const busy = useChatBusy();
  const draft = useChatDraft(chatId);
  const create = useCreateChat();
  const send = useSendChat();
  const stop = useStopChat();
  const [account, setAccount] = useState('');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const chatAccount = detail.data?.chat.account;
  useEffect(() => { if (chatAccount) setAccount(chatAccount); }, [chatAccount]);
  const accountNames = accounts.data?.map((a) => a.name) ?? [];
  const acct = accountNames.includes(account) ? account : accountNames[0] ?? '';

  const events = detail.data?.events ?? [];
  useEffect(() => { endRef.current?.scrollIntoView?.({block: 'end'}); }, [events.length, draft, open]);

  const running = busy !== null && busy === chatId;
  const submit = async () => {
    const t = text.trim();
    if (!t || busy !== null || !acct) return;
    try {
      let id = chatId;
      if (id === null) { id = (await create.mutateAsync({slug})).id; setPicked(id); }
      await send.mutateAsync({id, text: t, account: acct, screen: pathname, slug});
      setText('');
    } catch (e) {
      toast({title: 'Không gửi được', description: e instanceof Error ? e.message : String(e), tone: 'error'});
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Chat với Claude" width={420} footer={
      <div className={s.foot}>
        <Textarea
          autosize rows={2} value={text} aria-label="Tin nhắn cho Claude" disabled={busy !== null}
          placeholder="Nhắn Claude… (Enter để gửi, Shift+Enter xuống dòng)"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
        />
        {busy !== null && (
          <div className={s.note}>
            {running ? <><span>Claude đang trả lời…</span><Button size="sm" onClick={() => stop.mutate(busy)}>Dừng</Button></> : <span>Claude đang chạy ở phiên khác</span>}
          </div>
        )}
      </div>
    }>
      <div className={s.wrap}>
        <div className={s.head}>
          <div className={s.row}>
            <Select aria-label="Phiên chat" value={chatId} placeholder="Chưa có phiên" onChange={setPicked}
              options={(chats.data ?? []).map((c) => ({value: c.id, label: c.title, hint: c.slug ?? ''}))} />
            <Button size="sm" loading={create.isPending} onClick={() => create.mutate({slug}, {onSuccess: (c) => setPicked(c.id)})}>Phiên mới</Button>
          </div>
          <Select aria-label="Tài khoản Claude" value={acct || null} onChange={setAccount}
            options={(accounts.data ?? []).map((a) => ({value: a.name, label: a.name, hint: a.limit?.utilization != null ? `${Math.round(a.limit.utilization * 100)}%` : ''}))} />
        </div>
        <div className={s.log} role="log" aria-live="polite">
          {events.length === 0 && !running && <EmptyState icon={<MessageSquare size={28} />} title="Hỏi Claude bất cứ điều gì về video" />}
          {events.map((e, i) => {
            switch (e.kind) {
              case 'user': return <div key={i} style={{display: 'contents'}}><span className={s.cap}>{e.account}</span><div className={s.me}>{e.text}</div></div>;
              case 'text': return <div key={i} className={s.bot}>{e.text}</div>;
              case 'tool': return <div key={i} className={s.tool}>{e.name}: {e.summary}</div>;
              case 'error': return (
                <div key={i} className={s.err} role="alert">
                  {e.limit ? <>{limitText(e.limit)}<small>Chọn tài khoản khác ở trên rồi gửi tiếp nếu muốn.</small></> : e.message}
                </div>
              );
              default: return null;
            }
          })}
          {running && <div className={s.bot}>{draft}<Spinner size={16} label="Claude đang trả lời" /></div>}
          {isInterrupted(events, running) && <div className={s.note}>Lượt này bị ngắt (server dừng giữa chừng).</div>}
          <div ref={endRef} />
        </div>
      </div>
    </Drawer>
  );
}
