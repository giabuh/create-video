import {useMutation, useQuery, useQueryClient, type QueryClient} from '@tanstack/react-query';
import {useSyncExternalStore} from 'react';
import type {ChatAccount, ChatDetail, ChatMeta, Engine, ServerEvent} from '../../shared/types.ts';
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
  return useMutation({mutationFn: (v: {slug: string | null; engine?: Engine}) => api<ChatMeta>('/chats', {body: v}), onSuccess: (chat) => {
    // Seed the detail: an invalidation during a first fetch that has no data yet is swallowed (react-query), so the SSE events of the first turn would be lost.
    qc.setQueryData<ChatDetail>(chatKeys.one(chat.id), {chat, events: []});
    return qc.invalidateQueries({queryKey: chatKeys.list});
  }});
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
/** Drop partial text after an SSE reconnect: missed deltas would leave it stale or truncated; new deltas rebuild it. */
export function resetChatDrafts(): void { drafts = new Map(); emit(); }
export const getChatDraft = (id: string): string => drafts.get(id) ?? '';
// Panel open state: any screen (e.g. the editor top bar) can open it.
let panelOpen = false;
export function setChatOpen(o: boolean): void { panelOpen = o; emit(); }
export const useChatOpen = (): boolean => useSyncExternalStore(subscribe, () => panelOpen);
export const useChatBusy = (): string | null => useSyncExternalStore(subscribe, () => busy);
export const useChatDraft = (id: string | null): string => useSyncExternalStore(subscribe, () => (id ? drafts.get(id) ?? '' : ''));
