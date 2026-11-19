// Sequencing for cards that assemble in parts and animate their own exit (registered with ownsExit).
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export const BACK = Easing.out(Easing.back(1.7));
const OUT = Easing.out(Easing.cubic);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** t = seconds since the layer start; step(at, dur) = 0..1 progress of a part, times given at pace 1 and scaled by k;
 *  outP = 0..1 progress of the exit over the last 0.4·k s (at most a third of the layer). */
export const useChoreo = (layerSeconds: number, k: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const step = (at: number, dur: number, easing: (x: number) => number = OUT) =>
    interpolate(t, [at * k, (at + Math.max(dur, 1 / fps)) * k], [0, 1], {...clamp, easing});
  const outLen = Math.min(0.4 * k, layerSeconds / 3);
  const outP = interpolate(t, [layerSeconds - outLen, layerSeconds], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  return {t, step, outP};
};

/** clipPath that erases the content left to right as p goes 0 → 1 (undefined = no clip). */
export const eraseOut = (p: number): string | undefined => (p <= 0 ? undefined : `inset(-20% -20% -20% ${-5 + 110 * p}%)`);
