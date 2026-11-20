import {describe, expect, it} from 'vitest';
import {fmtWhen, syncTotals} from './syncFormat.ts';

describe('syncFormat', () => {
  it('fmtWhen', () => {
    const now = new Date(2026, 10, 20, 15, 0).getTime();
    expect(fmtWhen(null, now)).toBe('Chưa từng');
    expect(fmtWhen(new Date(2026, 10, 20, 9, 5).getTime(), now)).toBe('hôm nay 09:05');
    expect(fmtWhen(new Date(2026, 10, 18, 9, 5).getTime(), now)).toBe('18/11 09:05');
  });
  it('syncTotals', () => {
    const f = (localOnly: number, driveOnly: number, differ: number) => ({name: 'library' as const, localOnly, driveOnly, differ, same: 0});
    expect(syncTotals({checkedAt: 0, error: null, lastPush: null, lastPull: null, folders: [f(1, 2, 3), f(4, 5, 6)]})).toEqual({localOnly: 5, driveOnly: 7, differ: 9});
  });
});
