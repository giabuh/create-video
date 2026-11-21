import type {MotionItem} from '../types';
import {BANDS} from './bands';

type Layer = Pick<MotionItem, 'position' | 'box' | 'start' | 'duration'>;

/** Vertical span of a layer as fractions of the frame height, placed like MotionLayer (keyframe offsets ignored). */
export const layerSpan = (m: Layer): [number, number] => {
  if (m.position === 'free' && m.box) return [m.box.y / 100, (m.box.y + m.box.h) / 100];
  if (m.position === 'top' || m.position === 'center' || m.position === 'bottom') return BANDS[m.position];
  return [0, 1];
};

/** Largest vertical gap inside `safe` (fractions of frame height) free of layers active at scene time t, or null. */
export const cardSlot = (layers: Layer[], t: number, safe: [number, number] = [0.22, 0.7]): {top: number; bottom: number} | null => {
  const M = 0.015;
  const busy = layers
    .filter((m) => t >= m.start && t < m.start + m.duration)
    .map((m) => layerSpan(m))
    .sort((p, q) => p[0] - q[0]);
  let best: {top: number; bottom: number} | null = null, cur = safe[0];
  const take = (top: number, bottom: number) => {
    if (bottom - top > 1e-9 && (!best || bottom - top > best.bottom - best.top)) best = {top, bottom};
  };
  for (const [a, b] of busy) {
    take(cur, Math.min(safe[1], a - M));
    cur = Math.max(cur, b + M);
  }
  take(cur, safe[1]);
  return best;
};
