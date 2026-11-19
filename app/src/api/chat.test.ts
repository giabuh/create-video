import {QueryClient} from '@tanstack/react-query';
import {describe, expect, it} from 'vitest';
import {getChatDraft, onChatEvent, resetChatDrafts} from './chat.ts';

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
