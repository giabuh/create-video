import {describe, expect, it} from 'vitest';
import {draftAfter, isInterrupted, limitText} from './chatView.ts';

describe('chatView', () => {
  it('draftAfter', () => {
    expect(draftAfter('Xin ', {kind: 'delta', text: 'chào'})).toBe('Xin chào');
    expect(draftAfter('Xin chào', {kind: 'text', text: 'Xin chào'})).toBe('');
    expect(draftAfter('x', {kind: 'done', costUsd: null, durationMs: null})).toBe('');
  });
  it('isInterrupted', () => {
    expect(isInterrupted([], false)).toBe(false);
    expect(isInterrupted([{kind: 'user', text: 'a', account: 'claude', at: 1}], false)).toBe(true);
    expect(isInterrupted([{kind: 'user', text: 'a', account: 'claude', at: 1}], true)).toBe(false);
    expect(isInterrupted([{kind: 'done', costUsd: null, durationMs: null}], false)).toBe(false);
  });
  it('limitText', () => {
    const at = new Date(2026, 10, 19, 15, 0).getTime() / 1000;
    expect(limitText({account: 'claude2', resetsAt: at})).toBe('claude2 hết limit (reset 15:00)');
    expect(limitText({account: 'claude2', resetsAt: null})).toBe('claude2 hết limit');
  });
});
