import {describe, expect, it} from 'vitest';
import {fmtSec, pxPerSecond, rulerTicks, timeFromX} from './timelineLayout.ts';

describe('timelineLayout', () => {
  it('fits wide containers and scrolls narrow ones', () => {
    expect(pxPerSecond(1300, 13)).toBe(100);
    expect(pxPerSecond(300, 13)).toBe(48);
    expect(pxPerSecond(300, 0)).toBe(48);
  });
  it('ticks each second, labels even ones', () => {
    const t = rulerTicks(3.5);
    expect(t.map((x) => x.t)).toEqual([0, 1, 2, 3]);
    expect(t.map((x) => x.label)).toEqual([true, false, true, false]);
  });
  it('formats seconds with a comma and clamps seek time', () => {
    expect(fmtSec(3.64)).toBe('3,6');
    expect(timeFromX(-5, 100, 10)).toBe(0);
    expect(timeFromX(5000, 100, 10)).toBe(10);
    expect(timeFromX(250, 100, 10)).toBe(2.5);
  });
});
