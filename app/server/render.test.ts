import {describe, expect, it} from 'vitest';
import {chunkRanges, limiterArgs} from './render.ts';

describe('chunkRanges', () => {
  it('covers every frame exactly once, in order, with no empty chunk', () => {
    for (const [total, n] of [[300, 3], [301, 3], [782, 3], [5293, 3], [4, 3], [9, 4], [1, 3]]) {
      const r = chunkRanges(total, n);
      expect(r[0][0]).toBe(0);
      expect(r.at(-1)![1]).toBe(total - 1);
      expect(r.length).toBeLessThanOrEqual(n);
      r.forEach(([a, b], i) => { expect(b).toBeGreaterThanOrEqual(a); if (i) expect(a).toBe(r[i - 1][1] + 1); });
    }
  });
});

describe('limiterArgs', () => {
  it('copies video and limits audio peaks to -1.5 dBFS', () => {
    const a = limiterArgs('in.tmp.mp4', 'out.lim.mp4');
    expect(a.slice(0, 4)).toEqual(['-v', 'error', '-y', '-i']);
    expect(a).toContain('in.tmp.mp4');
    expect(a.join(' ')).toContain('-c:v copy');
    expect(a.join(' ')).toMatch(/alimiter=limit=0\.84\d*:level=disabled/); // 10^(-1.5/20) = 0.841
    expect(a.join(' ')).toContain('-c:a aac');
    expect(a.at(-1)).toBe('out.lim.mp4');
  });
});
