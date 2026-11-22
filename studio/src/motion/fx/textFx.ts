// Pure timing of the text effects: the style of one unit (a grapheme or a word) at time t after the effect starts.
// Frame-driven and deterministic (scramble uses remotion's seeded random), so every render is identical.
import {Easing, random} from 'remotion';

export const TEXT_FX = ['none', 'typewriter', 'words', 'pop', 'scramble', 'mask', 'wave', 'blur-in', 'glitch'] as const;
export type TextFx = (typeof TEXT_FX)[number];
export const TEXT_FX_LABELS: Record<TextFx, string> = {
  none: 'Hiện ngay', typewriter: 'Gõ phím', words: 'Từng từ trượt lên', pop: 'Bật từng chữ cái',
  scramble: 'Xáo chữ', mask: 'Trồi lên từ vạch che', wave: 'Sóng nghiêng',
  'blur-in': 'Mờ → rõ', glitch: 'Nhiễu màu',
};
export const PACE = {fast: 0.7, normal: 1, slow: 1.4} as const;

// seconds at pace 1, from the approved mockup: gap = delay between consecutive units, dur = one unit's animation
const SPEC: Record<TextFx, {unit: 'char' | 'word'; gap: number; dur: number}> = {
  none: {unit: 'word', gap: 0, dur: 0.12},
  typewriter: {unit: 'char', gap: 0.055, dur: 0},
  words: {unit: 'word', gap: 0.09, dur: 0.42},
  pop: {unit: 'char', gap: 0.032, dur: 0.42},
  scramble: {unit: 'char', gap: 0.04, dur: 0.3},
  mask: {unit: 'word', gap: 0.08, dur: 0.52},
  wave: {unit: 'char', gap: 0.028, dur: 0.38},
  'blur-in': {unit: 'word', gap: 0.06, dur: 0.5},
  glitch: {unit: 'char', gap: 0.02, dur: 0.3},
};
export const fxUnit = (fx: TextFx) => SPEC[fx].unit;

const seg = new Intl.Segmenter('vi', {granularity: 'grapheme'});
/** Lines → words → graphemes (diacritics stay on their letter; runs of spaces collapse). */
export const splitUnits = (text: string): string[][][] =>
  text.split('\n').map((line) => line.split(/\s+/).filter(Boolean).map((w) => Array.from(seg.segment(w), (s) => s.segment)));

const countUnits = (fx: TextFx, text: string) => {
  const words = splitUnits(text).flat();
  return SPEC[fx].unit === 'word' ? words.length : words.reduce((n, w) => n + w.length, 0);
};

/** Seconds until the whole text is shown, at pace multiplier k. */
export const fxDuration = (fx: TextFx, text: string, k: number): number => {
  const s = SPEC[fx];
  return (s.gap * Math.max(0, countUnits(fx, text) - 1) + s.dur) * k;
};

const slotCache = new Map<string, number[]>();
/** slot[i] = the turn at which unit i appears: a permutation of 0..n-1, fixed per seed. */
export const scrambleSlots = (n: number, seed: number): number[] => {
  const key = `${n}:${seed}`;
  let slots = slotCache.get(key);
  if (!slots) {
    const order = [...Array(n).keys()].sort((a, b) => random(`fx-${seed}-${a}`) - random(`fx-${seed}-${b}`));
    slots = new Array<number>(n);
    order.forEach((unit, turn) => { slots![unit] = turn; });
    slotCache.set(key, slots);
  }
  return slots;
};

const ease = Easing.out(Easing.cubic);
const back = Easing.out(Easing.back(1.7));
export type UnitStyle = {opacity: number; transform: string; filter?: string; textShadow?: string};

/** Style of unit i (of n) at t seconds after the effect starts, at pace multiplier k. */
export const unitStyle = (fx: TextFx, i: number, n: number, t: number, k = 1, seed = 0): UnitStyle => {
  const s = SPEC[fx];
  const slot = fx === 'scramble' ? scrambleSlots(n, seed)[i] : i;
  const t0 = slot * s.gap * k;
  const dur = s.dur * k;
  const p = dur === 0 ? (t >= t0 ? 1 : 0) : Math.min(1, Math.max(0, (t - t0) / dur));
  const done = p >= 1;
  switch (fx) {
    case 'none': return {opacity: ease(p), transform: 'none'};
    case 'typewriter': return {opacity: p, transform: 'none'};
    case 'words': { const e = ease(p); return {opacity: e, transform: done ? 'none' : `translateY(${(1 - e) * 80}%)`}; }
    case 'pop': return {opacity: Math.min(1, p * 3), transform: done ? 'none' : `scale(${back(p)})`};
    case 'scramble': {
      const e = ease(p);
      return done ? {opacity: 1, transform: 'none'}
        : {opacity: e, transform: `translateY(${(e - 1) * 40}%) scale(${1.4 - 0.4 * e})`, filter: `blur(${(1 - e) * 4}px)`};
    }
    case 'mask': { const e = ease(p); return {opacity: 1, transform: done ? 'none' : `translateY(${(1 - e) * 110}%)`}; }
    case 'blur-in': {
      const e = ease(p);
      return {opacity: p, transform: done ? 'none' : `scale(${1.15 - 0.15 * e})`, filter: done ? 'none' : `blur(${(1 - e) * 16}px)`};
    }
    case 'glitch': {
      if (done) return {opacity: 1, transform: 'none'};
      const jitter = (random(`glitch-${seed}-${i}-${Math.floor(t * 30)}`) * 2 - 1) * 6;
      const dx = 4 * (1 - p);
      return {opacity: p > 0 ? 1 : 0, transform: `translateX(${jitter}px)`, textShadow: `${dx}px 0 #ff2a6d, ${-dx}px 0 #05d9e8`};
    }
    case 'wave': {
      // pop in, then bob forever: 14% amplitude, 1.1 s period, phase 0.055 s per grapheme
      const bob = t <= t0 ? 0 : -14 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - t0 - i * 0.055 * k)) / (1.1 * k)));
      const e = back(p);
      return {opacity: Math.min(1, p * 3), transform: `translateY(${bob + (1 - Math.min(1, e)) * 60}%) scale(${0.3 + 0.7 * e})`};
    }
  }
};
