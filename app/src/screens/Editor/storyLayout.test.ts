import {describe, expect, it} from 'vitest';
import {cardSlot} from '../../../../studio/src/components/storyLayout.ts';

const L = (position: 'top' | 'center' | 'bottom' | 'free' | 'full', extra = {}) =>
  ({position, box: null, start: 0, duration: 2, ...extra}) as Parameters<typeof cardSlot>[0][number];
const near = (s: {top: number; bottom: number} | null, top: number, bottom: number) => {
  expect(s).not.toBeNull();
  expect(s!.top).toBeCloseTo(top, 6);
  expect(s!.bottom).toBeCloseTo(bottom, 6);
};

describe('story card slot', () => {
  it('no layers: whole safe range', () => near(cardSlot([], 1), 0.22, 0.7));
  it('bottom band', () => near(cardSlot([L('bottom', {})], 1), 0.22, 0.445));
  it('top band', () => near(cardSlot([L('top')], 1), 0.435, 0.7));
  it('centre band', () => near(cardSlot([L('center')], 1), 0.22, 0.285));
  it('full layer: null', () => expect(cardSlot([L('full')], 1)).toBeNull());
  it('inactive layer ignored', () => {
    near(cardSlot([L('center')], 2.5), 0.22, 0.7);
    near(cardSlot([L('center')], -0.1), 0.22, 0.7);
  });
  it('video-wide track layer (shifted to scene time) counts', () => {
    const track = {...L('full'), start: 10 - 8};
    expect(cardSlot([track], 2.5)).toBeNull();
    near(cardSlot([track], 1), 0.22, 0.7);
  });
  it('two gaps: the larger one', () => {
    const box = (y: number, h: number) => L('free', {box: {x: 0, y, w: 50, h}});
    near(cardSlot([box(30, 10), box(60, 20)], 1), 0.415, 0.585);
  });
});
