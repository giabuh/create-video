// "Bold block" card style tokens (spec 2026-11-20-card-style-design). Scale: 360px mockup px x 3 = 1080 reel px.
import {Easing, interpolate} from 'remotion';
import type React from 'react';

/** Block corner radius (6 x 3). */
export const RADIUS = 18;
/** Hard offset shadow, no blur (6 x 3), in navy or yellow. */
export const HARD_SHADOW = (color: string): string => `18px 18px 0 ${color}`;
/** White card corner radius (20 x 3). */
export const CARD_RADIUS = 60;
/** Soft deep shadow for white cards. */
export const SOFT_SHADOW = '0 42px 102px rgba(11,21,48,.32)';
/** Frosted navy glass panel (blur 14 x 3, 1px white 18% border x 3, radius 22 x 3). */
export const GLASS: React.CSSProperties = {
  background: 'rgba(11,21,48,.58)', backdropFilter: 'blur(42px)', WebkitBackdropFilter: 'blur(42px)',
  border: '3px solid rgba(255,255,255,.18)', borderRadius: 66,
};

/** Overshoot ease-out for bold pops, t in 0..1 (output overshoots 1 by ~10%). */
export const backOut = Easing.out(Easing.back(1.7));
/** Symmetric ease for wipes, like cubic-bezier(.65,0,.35,1). */
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

const css = Easing.bezier(0.25, 0.1, 0.25, 1); // CSS default "ease", used between mockup keyframes
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const seg = (t: number, a: number, b: number, from: number, to: number, ease: (n: number) => number = css) =>
  interpolate(t, [a, b], [from, to], {...clamp, easing: ease});

/**
 * Mockup `stamp`/`ring`/`shake` keyframes (4.5s loop, 1% = 45ms) as a function of time.
 * Impact at startSec + 0.225s. Stamp scale 2.8 / -24deg -> .9 -> 1.04 -> 1 at -12deg; ring scale .8 -> 2 fading;
 * shake is a translate in 1080px space for the card layer.
 */
export const stampImpact = (frame: number, fps: number, startSec: number) => {
  const t = frame / fps - startSec;
  const k = 0.045; // 1% of the loop
  const scale = t < 5 * k ? seg(t, 0, 5 * k, 2.8, 0.9, Easing.bezier(0.55, 0, 1, 0.45))
    : t < 6.5 * k ? seg(t, 5 * k, 6.5 * k, 0.9, 1.04) : seg(t, 6.5 * k, 8 * k, 1.04, 1);
  const shk = (a: number, ax: number, ay: number, b: number, bx: number, by: number, f: number) =>
    interpolate(t, [a * k, b * k], [f ? ay : ax, f ? by : bx], {...clamp, easing: css});
  const x = t < 5 * k || t >= 8 * k ? 0 : t < 5.6 * k ? shk(5, 0, 0, 5.6, -15, 0, 0) : t < 6.4 * k ? shk(5.6, -15, 0, 6.4, 12, 0, 0) : t < 7.2 * k ? shk(6.4, 12, 0, 7.2, -6, 0, 0) : shk(7.2, -6, 0, 8, 0, 0, 0);
  const y = t < 5 * k || t >= 8 * k ? 0 : t < 5.6 * k ? shk(5, 0, 0, 5.6, 0, 12, 1) : t < 6.4 * k ? shk(5.6, 0, 12, 6.4, 0, -9, 1) : t < 7.2 * k ? shk(6.4, 0, -9, 7.2, 0, 6, 1) : shk(7.2, 0, 6, 8, 0, 0, 1);
  return {
    scale,
    rotate: seg(t, 0, 5 * k, -24, -12, Easing.bezier(0.55, 0, 1, 0.45)),
    opacity: seg(t, 0, 5 * k, 0, 1, Easing.bezier(0.55, 0, 1, 0.45)),
    ring: {scale: t < 5 * k ? 0.7 : seg(t, 5 * k, 15 * k, 0.8, 2), opacity: t < 5 * k ? 0 : seg(t, 5 * k, 15 * k, 0.9, 0)},
    shake: {x, y},
  };
};
