import {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowUp, Copy, ImagePlus, MessageSquare, X} from 'lucide-react';
import {matchPath, useLocation} from 'react-router';
import type {Engine} from '../../shared/types.ts';
import {Button, DropdownMenu, EmptyState, IconButton, Select, Spinner, Textarea, toast} from '../ui/index.ts';
import {chatImageUrl, takeChatInsert, useChat, useChatAccounts, useChatBusy, useChatDraft, useChatInsert, useChatModels, useChats, useCreateChat, useSendChat, useStopChat, uploadChatImage} from '../api/chat.ts';
import {acceptImages, CHAT_IMAGE_ACCEPT, MAX_CHAT_IMAGES, uploadName} from './chatImages.ts';
import {copyText} from './clipboard.ts';
import {isInterrupted, limitText} from './chatView.ts';
import {mdToHtml} from './markdown.ts';
import s from './ChatPanel.module.css';

/** The whole chat column (header, log, input). `active` = the panel is visible; `autoFocus` = focus the input when shown. */
export function ChatBody({active, autoFocus = true}: {active: boolean; autoFocus?: boolean}): React.JSX.Element {
  const {pathname} = useLocation();
  const slug = matchPath('/p/:slug/*', pathname)?.params.slug ?? matchPath('/p/:slug', pathname)?.params.slug ?? null;
  const chats = useChats();
  const accounts = useChatAccounts();
  const models = useChatModels();
  const [picked, setPicked] = useState<string | null>(null);
  // newest chat of this project on project routes (newest of any project elsewhere)
  const own = slug ? chats.data?.find((c) => c.slug === slug) : chats.data?.[0];
  const chatId = picked ?? own?.id ?? null;
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
  const [model, setModel] = useState('default'); // 'default' = the CLI's own model/effort (Radix Select forbids '')
  const [effort, setEffort] = useState('default');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const addFiles = (list: File[]) => {
    const {ok, error} = acceptImages(files.length, list);
    if (ok.length) setFiles((cur) => [...cur, ...ok]);
    if (error) toast({title: error, tone: 'error'});
  };
  const copyMsg = async (el: HTMLElement) => {
    const body = el.closest<HTMLElement>('[data-msg]')?.querySelector<HTMLElement>('[data-body]');
    try { await copyText(body?.innerText ?? ''); toast({title: 'Đã sao chép'}); } catch { toast({title: 'Không sao chép được', tone: 'error'}); }
  };
  const copyBtn = <IconButton label="Sao chép" size="sm" className={s.copy} icon={<Copy size={14} />} onClick={(e) => void copyMsg(e.currentTarget)} />;
  const pending = useChatInsert();
  useEffect(() => {
    if (!pending) return;
    const t = takeChatInsert();
    if (!t) return; // StrictMode re-run after the first one took the text
    setText((cur) => (cur === '' || cur.endsWith(' ') || cur.endsWith('\n') ? cur + t : `${cur} ${t}`));
    inputRef.current?.querySelector('textarea')?.focus();
  }, [pending]);
  const inputRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const chatAccount = detail.data?.chat.account;
  useEffect(() => { if (chatAccount) setAccount(chatAccount); }, [chatAccount]);
  const chatModel = detail.data?.chat.model ?? 'default';
  useEffect(() => { setModel(chatModel); }, [chatId, chatModel]);
  const chatEffort = detail.data?.chat.effort ?? 'default';
  useEffect(() => { setEffort(chatEffort); }, [chatId, chatEffort]);
  const modelOpts = models.data?.[engine] ?? [];
  const mdl = modelOpts.some((o) => o.value === model) ? model : 'default';
  // default model: offer only efforts every listed model supports
  const effortOpts = modelOpts.find((o) => o.value === mdl)?.efforts ?? (modelOpts.length ? modelOpts.map((o) => o.efforts).reduce((a, b) => a.filter((e) => b.includes(e))) : []);
  const eff = effortOpts.includes(effort) ? effort : 'default';
  const cap = (v: string) => engine === 'claude' ? v[0].toUpperCase() + v.slice(1) : v;
  const engAccounts = (accounts.data ?? []).filter((a) => a.engine === engine);
  const hasCodex = (accounts.data ?? []).some((a) => a.engine === 'codex');
  const accountNames = engAccounts.map((a) => a.name);
  const acct = accountNames.includes(account) ? account : accountNames[0] ?? '';

  const events = detail.data?.events ?? [];
  // Follow the newest message unless the user scrolled up to read. On open the drawer is still sliding in and
  // markdown is laying out, so scroll again on the next frames instead of once.
  const follow = useRef(true);
  useEffect(() => { follow.current = true; }, [active, chatId]);
  useEffect(() => {
    const box = logRef.current;
    if (!box) return;
    const onScroll = () => { follow.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; };
    box.addEventListener('scroll', onScroll, {passive: true});
    return () => box.removeEventListener('scroll', onScroll);
  }, [active, detail.isSuccess]);
  useEffect(() => {
    if (!active || !follow.current) return;
    const go = () => {
      const log = logRef.current;
      if (log) log.scrollTop = log.scrollHeight;
    };
    const f = requestAnimationFrame(go);
    const t1 = setTimeout(go, 150), t2 = setTimeout(go, 450); // after the slide-in animation and late layout
    return () => { cancelAnimationFrame(f); clearTimeout(t1); clearTimeout(t2); };
  }, [events.length, draft, active, chatId, detail.isSuccess, busy]);

  // Docked chat (autoFocus off) refocuses only after a turn ends, and not on a phone: focus there opens the keyboard over the player.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (busy !== null) { wasBusy.current = true; return; }
    if (autoFocus || (wasBusy.current && !window.matchMedia('(max-width: 850px)').matches)) inputRef.current?.querySelector('textarea')?.focus();
    wasBusy.current = false;
  }, [busy, active, autoFocus]);
  const last = events.at(-1)?.kind;
  useEffect(() => { if (waiting && waiting.id === chatId && events.length > waiting.n && (last === 'done' || last === 'error')) setWaiting(null); }, [waiting, chatId, events.length, last]);
  const running = (busy !== null && busy === chatId) || waiting?.id === chatId;
  const newChat = (e: Engine) => create.mutate({slug, engine: e}, {onSuccess: (c) => setPicked(c.id)});
  const [sending, setSending] = useState(false);
  const sendingNow = useRef(false); // guard against duplicate submits before React updates
  const locked = busy !== null || running || sending;
  const canSend = !locked && !!acct && (!!text.trim() || files.length > 0);
  const submit = async () => {
    if (!canSend || sendingNow.current) return;
    const t = text.trim();
    sendingNow.current = true; setSending(true);
    try {
      let id = chatId;
      if (id === null) { id = (await create.mutateAsync({slug})).id; setPicked(id); }
      const n = id === chatId ? events.length : 0;
      const images: string[] = [];
      for (const f of files) images.push(await uploadChatImage(id, f, uploadName(f)));
      await send.mutateAsync({id, text: t, images: images.length ? images : undefined, account: acct, model: mdl === 'default' ? undefined : mdl, effort: eff === 'default' ? undefined : eff, screen: pathname, slug});
      setWaiting({id, n});
      setText('');
      setFiles([]);
    } catch (e) {
      toast({title: 'Không gửi được', description: e instanceof Error ? e.message : String(e), tone: 'error'});
    } finally { sendingNow.current = false; setSending(false); }
  };

  return (
    <div className={s.wrap}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={(e) => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); if (!locked) addFiles([...e.dataTransfer.files]); }}>
      <div className={s.head}>
        <div className={s.row}>
          <Select key={chatId === null ? 'none' : 'set'} aria-label="Phiên chat" value={chatId} placeholder="Chưa có phiên" onChange={setPicked}
            options={(chats.data ?? []).map((c) => ({value: c.id, label: c.title, hint: [c.engine === 'codex' ? 'Codex' : 'Claude', c.slug].filter(Boolean).join(' · ')}))} />
          <DropdownMenu align="end" trigger={<Button loading={create.isPending}>Phiên mới</Button>} items={[
            {label: 'Phiên Claude', onSelect: () => newChat('claude')},
            {label: 'Phiên Codex', onSelect: () => newChat('codex'), disabled: !hasCodex},
          ]} />
        </div>
        <div className={s.pair}>
          <Select key={acct ? 'set' : 'none'} aria-label="Tài khoản Claude" value={acct || null} onChange={setAccount}
            options={engAccounts.map((a) => ({value: a.name, label: a.name, hint: a.limit?.utilization != null ? `${Math.round(a.limit.utilization * 100)}%` : ''}))} />
          <Select aria-label="Model" value={mdl} onChange={setModel}
            options={[{value: 'default', label: 'Model mặc định'}, ...modelOpts.map((o) => ({value: o.value, label: cap(o.value)}))]} />
          <Select aria-label="Effort" value={eff} onChange={setEffort}
            options={[{value: 'default', label: 'Effort mặc định'}, ...effortOpts.map((e) => ({value: e, label: e[0].toUpperCase() + e.slice(1)}))]} />
        </div>
      </div>
      <div className={s.log} ref={logRef} role="log" aria-live="polite">
        {events.length === 0 && !running && <div className={s.empty}><EmptyState icon={<MessageSquare size={28} />} title={`Hỏi ${engineName} bất cứ điều gì về video`} /></div>}
        {events.map((e, i) => {
          switch (e.kind) {
            case 'user': return (
              <div key={i} className={`${s.msg} ${s.mine}`} data-msg>
                <span className={s.cap}>{e.account}</span>
                <div className={s.me} data-body>
                  {e.images?.length ? <div className={s.imgs}>{e.images.map((n) => chatId && (
                    <a key={n} href={chatImageUrl(chatId, n)} target="_blank" rel="noreferrer"><img src={chatImageUrl(chatId, n)} alt="Ảnh đính kèm" loading="lazy" /></a>
                  ))}</div> : null}
                  {e.text}
                </div>
                {copyBtn}
              </div>
            );
            case 'text': return (
              <div key={i} className={s.msg} data-msg>
                <div className={`${s.bot} ${s.md}`} data-body dangerouslySetInnerHTML={{__html: mdToHtml(e.text)}} />
                {copyBtn}
              </div>
            );
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
      </div>
      <div className={s.foot} ref={inputRef}>
        {files.length > 0 && (
          <div className={s.atts}>
            {previews.map((u, i) => (
              <div key={u} className={s.att}>
                <img src={u} alt="Ảnh đính kèm" />
                <IconButton label="Bỏ ảnh" size="sm" variant="secondary" icon={<X size={12} />} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        )}
        <div className={s.inputRow}>
          <IconButton label="Thêm ảnh" icon={<ImagePlus size={18} />} disabled={locked || files.length >= MAX_CHAT_IMAGES} onClick={() => fileRef.current?.click()} />
          <Textarea
            autosize rows={1} value={text} aria-label={`Tin nhắn cho ${engineName}`} disabled={locked}
            placeholder={`Nhắn ${engineName}…`}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
              if (imgs.length) { e.preventDefault(); addFiles(imgs); }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
          />
          <IconButton className={s.send} label="Gửi tin nhắn" variant="secondary" icon={<ArrowUp size={19} aria-hidden />}
            disabled={!canSend} onClick={() => void submit()} />
        </div>
        <input ref={fileRef} type="file" accept={CHAT_IMAGE_ACCEPT} multiple hidden
          onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
        {(busy !== null || running) && (
          <div className={s.note}>
            {running ? <><span>{engineName} đang trả lời…</span><Button size="sm" onClick={() => stop.mutate(chatId!)}>Dừng</Button></> : <span>Đang chạy ở phiên khác</span>}
          </div>
        )}
      </div>
    </div>
  );
}
