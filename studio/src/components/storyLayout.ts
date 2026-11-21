import type {MotionItem} from '../types';
import {BANDS} from './bands';

type Layer = Pick<MotionItem, 'position' | 'box' | 'start' | 'duration'>;

/** Vertical span of a layer as fractions of the frame height, placed like MotionLayer (keyframe offsets ignored). */
export const layerSpan = (m: Layer): [number, number] => {
  if (m.position === 'free' && m.box) return [m.box.y / 100, (m.box.y + m.box.h) / 100];
  if (m.position === 'top' || m.position === 'center' || m.position === 'bottom') return BANDS[m.position];
  return [0, 1];
};

/** Card text block: centre at 46% of the frame height (middle of the 22-70% safe area). */
export const CARD_CENTER = 0.46;

/** True when a layer active at scene time t overlaps the card's text block (blockH = block height in px) vertically. */
export const cardCovered = (layers: Layer[], t: number, blockH: number, frameH: number): boolean => {
  const lo = CARD_CENTER - blockH / frameH / 2, hi = CARD_CENTER + blockH / frameH / 2;
  return layers.some((m) => {
    if (t < m.start || t >= m.start + m.duration) return false;
    const [a, b] = layerSpan(m);
    return a < hi && b > lo;
  });
};
