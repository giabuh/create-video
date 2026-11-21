import {describe, expect, it} from 'vitest';
import {glitchAt} from '../../../../studio/src/effects.ts';

describe('glitchAt', () => {
  const frames = Array.from({length: 270}, (_, i) => i);
  it('is deterministic', () => {
    for (const f of frames) expect(glitchAt(f, 30, 3)).toEqual(glitchAt(f, 30, 3));
  });
  it('bursts split 6..14px with bounded offsets; quiet frames are all zero', () => {
    for (const f of frames) {
      const g = glitchAt(f, 30);
      if (g.split > 0) {
        expect(g.split).toBeGreaterThanOrEqual(6);
        expect(g.split).toBeLessThanOrEqual(14);
        expect(Math.abs(g.dx)).toBeLessThanOrEqual(10);
        expect(Math.abs(g.dy)).toBeLessThanOrEqual(3);
      } else expect(g).toEqual({dx: 0, dy: 0, split: 0});
    }
  });
  it('about 3 burst frames per 27 at 30fps, and the shot opens with a burst', () => {
    for (let f = 0; f < 4; f++) expect(glitchAt(f, 30).split).toBeGreaterThan(0);
    const n = frames.filter((f) => f >= 30 && glitchAt(f, 30, 5).split > 0).length;
    expect(n).toBeGreaterThanOrEqual(24);
    expect(n).toBeLessThanOrEqual(30);
  });
});
