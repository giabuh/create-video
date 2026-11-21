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
