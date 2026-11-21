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

/** True when a media item renders as a floating card (item.frame wins over look.mediaFrame; default full-bleed). */
export const isCard = (item: {frame?: string}, look?: {mediaFrame?: string}): boolean => (item.frame ?? look?.mediaFrame) === 'card';

/** Framed-media card: width 88% of the frame (narrower when the 60% height cap bites), height from the aspect clamped to 28-60% of the frame height, centred at y 0.40. All fractions. */
export const mediaCardRect = (aspect: number, frameW: number, frameH: number): {top: number; bottom: number; width: number} => {
  const a = aspect > 0 ? aspect : 1;
  const h = Math.min(0.6, Math.max(0.28, (0.88 * frameW) / a / frameH));
  return {top: 0.4 - h / 2, bottom: 0.4 + h / 2, width: Math.min(0.88, (h * frameH * a) / frameW)};
};

export type CollageSlot = {x: number; y: number; w: number; rot: number};
const COLLAGE: Record<number, CollageSlot[]> = {
  2: [{x: 0.36, y: 0.38, w: 0.54, rot: -6}, {x: 0.64, y: 0.55, w: 0.54, rot: 5}],
  3: [{x: 0.31, y: 0.35, w: 0.48, rot: -7}, {x: 0.69, y: 0.41, w: 0.48, rot: 6}, {x: 0.5, y: 0.58, w: 0.52, rot: -3}],
  4: [{x: 0.3, y: 0.34, w: 0.46, rot: -6}, {x: 0.7, y: 0.36, w: 0.46, rot: 5}, {x: 0.32, y: 0.56, w: 0.46, rot: 4}, {x: 0.68, y: 0.58, w: 0.46, rot: -5}],
};
/** Slots for n collage items (2-4; other n is clamped). */
export const collageSlots = (n: number): CollageSlot[] => COLLAGE[Math.min(4, Math.max(2, n))];

/** Unrotated card rect as frame fractions: width from the slot, height from the aspect, capped at 36% of the frame height (width shrinks with it). */
export const collageRect = (s: CollageSlot, aspect: number, frameW: number, frameH: number): {cx: number; cy: number; w: number; h: number} => {
  const a = aspect > 0 ? aspect : 1;
  const h = Math.min(0.44, (s.w * frameW) / a / frameH);
  return {cx: s.x, cy: s.y, w: (h * frameH * a) / frameW, h};
};

/** Vertical extent (frame fractions) of the collage cards visible at scene time t: rotated box, 1.04 push-in and drift margin (12 px, 1.5 deg). Null before the first card. */
export const collageSpan = (items: {start: number; aspect?: number}[], t: number, frameW: number, frameH: number): {top: number; bottom: number} | null => {
  const slots = collageSlots(items.length);
  let top = Infinity, bottom = -Infinity;
  items.forEach((m, i) => {
    if (t < m.start) return;
    const r = collageRect(slots[i], m.aspect ?? 1, frameW, frameH);
    const rad = (Math.abs(slots[i].rot) + 1.5) * Math.PI / 180;
    const half = ((r.h * Math.cos(rad)) + (r.w * frameW / frameH * Math.sin(rad))) / 2 * 1.04 + 12 / frameH;
    top = Math.min(top, r.cy - half);
    bottom = Math.max(bottom, r.cy + half);
  });
  return top === Infinity ? null : {top, bottom};
};

const wordKey = (w: string) => w.normalize('NFC').toLowerCase().replace(/^[^\p{L}\p{N}%]+|[^\p{L}\p{N}%]+$/gu, '');

/** First scene `punch` phrase found in a chunk as consecutive words (case/edge-punctuation ignored): token index `from`, word count `len`. */
export const findPunch = (text: string, punch: string[]): {from: number; len: number} | null => {
  const toks = text.split(' ').filter(Boolean).map(wordKey);
  let best: {from: number; len: number} | null = null;
  for (const ph of punch) {
    const want = ph.split(' ').filter(Boolean).map(wordKey);
    if (!want.length) continue;
    for (let i = 0; i + want.length <= toks.length; i++) {
      if (want.every((w, j) => toks[i + j] === w)) { if (!best || i < best.from) best = {from: i, len: want.length}; break; }
    }
  }
  return best;
};
