import {describe, expect, it} from 'vitest';
import {cardCovered} from '../../../../studio/src/components/storyLayout.ts';

const H = 1920, block = 150; // card block 150 px: centred at 46% = y 0.42..0.50
const L = (position: 'top' | 'center' | 'bottom' | 'free' | 'full', extra = {}) =>
  ({position, box: null, start: 0, duration: 2, ...extra}) as Parameters<typeof cardCovered>[0][number];

describe('story card collision', () => {
  it('bottom band overlaps the text block', () => expect(cardCovered([L('bottom')], 1, block, H)).toBe(true));
  it('top band does not', () => expect(cardCovered([L('top')], 1, block, H)).toBe(false));
  it('free box overlapping hides it, one below does not', () => {
    expect(cardCovered([L('free', {box: {x: 10, y: 40, w: 30, h: 20}})], 1, block, H)).toBe(true);
    expect(cardCovered([L('free', {box: {x: 10, y: 75, w: 30, h: 15}})], 1, block, H)).toBe(false);
  });
  it('inactive layer is ignored', () => {
    expect(cardCovered([L('center')], 2.5, block, H)).toBe(false);
    expect(cardCovered([L('center')], -0.1, block, H)).toBe(false);
  });
  it('video-wide track layer (shifted to scene time) counts', () => {
    const track = {...L('full'), start: 10 - 8};  // absolute 10 s in a scene starting at 8 s
    expect(cardCovered([track], 2.5, block, H)).toBe(true);
    expect(cardCovered([track], 1, block, H)).toBe(false);
  });
});
