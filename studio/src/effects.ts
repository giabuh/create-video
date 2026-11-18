import type {Effect} from './types';

/** CSS transform for a media effect at progress p in [0,1]. */
export const effectTransform = (e: Effect, p: number): string => {
  switch (e) {
    case 'zoom-in': return `scale(${1 + 0.12 * p})`;
    case 'zoom-out': return `scale(${1.12 - 0.12 * p})`;
    case 'pan-left': return `scale(1.15) translateX(${4 - 8 * p}%)`;
    case 'pan-right': return `scale(1.15) translateX(${-4 + 8 * p}%)`;
    default: return 'none';
  }
};
