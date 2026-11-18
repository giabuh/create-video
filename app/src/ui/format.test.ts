import {describe, expect, it} from 'vitest';
import {fmtBytes, fmtClock, fmtNum, fmtPct, fmtRelTime, fmtSec, normalizeNum, parseNum} from './format.ts';

describe('format', () => {
  it('fmtNum', () => {
    expect(fmtNum(1.5, 1)).toBe('1,5');
    expect(fmtNum(1000.5, 1)).toBe('1.000,5');
  });
  it('fmtSec', () => expect(fmtSec(3.25)).toBe('3,3 s'));
  it('fmtClock', () => {
    expect(fmtClock(13.04)).toBe('00:13,0');
    expect(fmtClock(0)).toBe('00:00,0');
    expect(fmtClock(125.5)).toBe('02:05,5');
  });
  it('fmtBytes', () => {
    expect(fmtBytes(3250585)).toBe('3,1 MB');
    expect(fmtBytes(512)).toBe('512 B');
  });
  it('fmtPct', () => expect(fmtPct(0.623)).toBe('62%'));
  it('fmtRelTime', () => {
    const now = 1_800_000_000_000;
    expect(fmtRelTime(now - 30_000, now)).toBe('vừa xong');
    expect(fmtRelTime(now - 3 * 60_000, now)).toBe('3 phút trước');
    expect(fmtRelTime(now - 2 * 3600_000, now)).toBe('2 giờ trước');
    expect(fmtRelTime(now - 30 * 3600_000, now)).toBe('hôm qua');
    expect(fmtRelTime(now - 2 * 86400_000, now)).toBe('2 ngày trước');
    expect(fmtRelTime(now - 3599_000, now)).toBe('59 phút trước');
    expect(fmtRelTime(now - 86399_000, now)).toBe('23 giờ trước');
  });
  it('parseNum', () => {
    expect(parseNum('1,5')).toBe(1.5);
    expect(parseNum('1.5')).toBe(1.5);
    expect(parseNum('-2')).toBe(-2);
    expect(parseNum('abc')).toBeNull();
    expect(parseNum('')).toBeNull();
  });
  it('normalizeNum', () => {
    expect(normalizeNum(1.05, {decimals: 1})).toBe(1.1);
    expect(normalizeNum(9, {max: 5, decimals: 0})).toBe(5);
    expect(normalizeNum(-1, {min: 0, decimals: 1})).toBe(0);
  });
});
