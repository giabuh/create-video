// Optional decoration of a card, entering at `at` (pace-1 seconds) once the main text is shown.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {BACK} from './choreo';

export type DecorKind = 'none' | 'sparkle' | 'dot' | 'emoji';
const Burst: React.FC<{p: number; pulse: number; flip?: boolean; style: React.CSSProperties; size: number}> = ({p, pulse, flip, style, size}) => (
  <svg viewBox="0 0 40 40" style={{position: 'absolute', width: size, height: size, transform: `rotate(${flip ? 180 : 0}deg) scale(${BACK(p) * pulse})`,
    transformOrigin: '50% 100%', opacity: Math.min(1, p * 2), ...style}}>
    {[[20, 14, 20, 3], [26, 18, 35, 10], [14, 18, 5, 10]].map(([x1, y1, x2, y2], i) =>
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={3} strokeLinecap="round" />)}
  </svg>
);

export const Decor: React.FC<{kind: DecorKind; emoji?: string; at: number; k: number; size: number; color: string}> = ({kind, emoji, at, k, size, color}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps - at * k;
  if (kind === 'none' || t < 0) return null;
  const p = Math.min(1, t / (0.6 * k));
  if (kind === 'sparkle') {
    const pulse = t < 0.6 * k ? 1 : 1 + 0.25 * Math.sin(((t - 0.6 * k) / (0.7 * k)) * Math.PI) ** 2;
    return <>
      <Burst p={p} pulse={pulse} size={size * 1.4} style={{right: -size * 1.1, top: -size * 1.2}} />
      <Burst p={Math.min(1, Math.max(0, (t - 0.1 * k) / (0.6 * k)))} pulse={pulse} flip size={size * 1.4} style={{left: -size * 1.1, bottom: -size * 1.2}} />
    </>;
  }
  if (kind === 'dot') {
    const blink = 0.65 + 0.35 * Math.cos((2 * Math.PI * t) / (0.9 * k));
    return <span style={{position: 'absolute', right: -size * 0.9, top: -size * 0.3, width: size * 0.6, height: size * 0.6, borderRadius: '50%',
      background: color, boxShadow: `0 0 ${size * 0.5}px ${color}`, transform: `scale(${BACK(Math.min(1, t / (0.3 * k)))})`, opacity: blink}} />;
  }
  if (!emoji) return null;
  const pop = BACK(Math.min(1, t / (0.4 * k)));
  const wiggle = t < 0.4 * k ? 0 : 11 * Math.sin((2 * Math.PI * (t - 0.4 * k)) / (0.26 * k));
  return <span style={{position: 'absolute', right: -size * 1.6, top: -size * 0.9, fontSize: size * 1.7, lineHeight: 1,
    transform: `scale(${pop}) rotate(${(1 - pop) * -40 + wiggle}deg)`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.5))'}}>{emoji}</span>;
};
