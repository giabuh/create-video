import {describe, expect, it} from 'vitest';
import {chunkRanges} from './render.ts';

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
