import type {Effect} from './types';

/** CSS transform for a media effect at progress p in [0,1]. */
export const effectTransform = (e: Effect, p: number): string => {
  switch (e) {
    case 'zoom-in': return `scale(${1 + 0.12 * p})`;
    case 'zoom-out': return `scale(${1.12 - 0.12 * p})`;
    case 'pan-left': return `scale(1.15) translateX(${4 - 8 * p}%)`;
    case 'pan-right': return `scale(1.15) translateX(${-4 + 8 * p}%)`;
    default: return 'none'; // includes glitch (see glitchAt)
  }
};

const hash = (n: number) => {
  let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** RGB-split burst for the glitch effect: 3 active frames per ~0.9s plus the first 4 frames; quiet frames are all zero. */
export const glitchAt = (frame: number, fps: number, seed = 0): {dx: number; dy: number; split: number} => {
  const period = Math.max(4, Math.round(fps * 0.9));
  const active = frame < 4 || (((frame + seed) % period) + period) % period < 3;
  if (!active) return {dx: 0, dy: 0, split: 0};
  const h = hash(frame * 31 + seed);
  return {split: 6 + (h % 9), dx: ((h >>> 4) % 21) - 10, dy: ((h >>> 9) % 7) - 3};
};
