import {QueryClient} from '@tanstack/react-query';
import {describe, expect, it} from 'vitest';
import {getChatDraft, insertChatText, onChatEvent, resetChatDrafts, takeChatInsert} from './chat.ts';

describe('chat draft lifecycle', () => {
  it('delta -> reset -> text', () => {
    const qc = new QueryClient();
    onChatEvent({type: 'chat', chatId: 'c', event: {kind: 'delta', text: 'Xin '}}, qc);
    expect(getChatDraft('c')).toBe('Xin ');
    resetChatDrafts();
    expect(getChatDraft('c')).toBe('');
    onChatEvent({type: 'chat', chatId: 'c', event: {kind: 'delta', text: 'chào'}}, qc);
    expect(getChatDraft('c')).toBe('chào');
    onChatEvent({type: 'chat', chatId: 'c', event: {kind: 'text', text: 'Xin chào'}}, qc);
    expect(getChatDraft('c')).toBe('');
  });
});

describe('chat insert store', () => {
  it('appends inserts in order and empties on take', () => {
    insertChatText('[cảnh a · 0:01.0 · khung 30] ');
    insertChatText('[cảnh b · 0:05.0 · khung 150] ');
    expect(takeChatInsert()).toBe('[cảnh a · 0:01.0 · khung 30] [cảnh b · 0:05.0 · khung 150] ');
    expect(takeChatInsert()).toBe('');
  });
});
