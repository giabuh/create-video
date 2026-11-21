import type {MotionPosition} from '../types';

// Bands as fractions of the frame height. 'bottom' ends above the captions and the Reels/TikTok UI.
export const BANDS: Record<Exclude<MotionPosition, 'full' | 'free'>, [number, number]> = {
  top: [0.09, 0.42],
  center: [0.3, 0.7],
  bottom: [0.46, 0.72],
};
