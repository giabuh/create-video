// "Paper / zine" look primitives (trial from reference screencast 2026-11-24): cream paper, thin ink outline,
// hard offset halftone-dot shadow, washi tape, mono chips, upright serif titles. Sizes derive from u = shorter frame side.
import React from 'react';
import {paperMono, paperSerif} from '../fonts';

export const PAPER = {
  canvas: '#F1ECE1', // page background
  card: '#FBF8F1', // card fill
  ink: '#1E2433', // outlines, titles, dark chips
  muted: '#6B6A66', // secondary text, footer
  terra: '#D2653F', // main accent (chips, hand-drawn circle, result)
  sage: '#5E9A6C',
  blue: '#4A7BC0',
  purple: '#8A5BB3',
  tape: 'rgba(52,70,104,.82)',
  serif: paperSerif,
  mono: paperMono,
} as const;

/** Card outline width, radius and shadow offset for a frame whose shorter side is u. */
export const paperDims = (u: number) => ({line: Math.max(2, u * 0.0022), radius: u * 0.009, shadow: u * 0.009, dot: Math.max(3, u * 0.0042)});

/** Halftone dots in ink, used as the hard offset shadow behind a card. */
const dots = (u: number) => {
  const {dot} = paperDims(u);
  return {backgroundImage: `radial-gradient(${PAPER.ink} 32%, transparent 36%)`, backgroundSize: `${dot}px ${dot}px`};
};

/** Washi tape strip; place it with `style` (absolute). */
export const Tape: React.FC<{u: number; style?: React.CSSProperties}> = ({u, style}) => (
  <div style={{position: 'absolute', width: u * 0.07, height: u * 0.022, background: PAPER.tape, transform: 'rotate(4deg)',
    clipPath: 'polygon(3% 0, 100% 6%, 97% 100%, 0 94%)', ...style}} />
);

/** Mono label chip, e.g. "Việc 3 / 6" (terra) or a section tag (ink). */
export const Chip: React.FC<{u: number; children: React.ReactNode; color?: string; text?: string; size?: number; style?: React.CSSProperties}> = ({u, children, color = PAPER.terra, text = PAPER.card, size, style}) => (
  <span style={{display: 'inline-block', fontFamily: PAPER.mono, fontWeight: 700, fontSize: size ?? u * 0.022, lineHeight: 1.25, letterSpacing: '0.02em',
    color: text, background: color, padding: `${u * 0.004}px ${u * 0.01}px`, whiteSpace: 'nowrap', ...style}}>{children}</span>
);

/** Serif title in ink. */
export const Title: React.FC<{u: number; children: React.ReactNode; size?: number; style?: React.CSSProperties}> = ({u, children, size, style}) => (
  <div style={{fontFamily: PAPER.serif, fontWeight: 700, fontSize: size ?? u * 0.04, lineHeight: 1.25, color: PAPER.ink, letterSpacing: '-0.01em', ...style}}>{children}</div>
);

/**
 * Paper card: cream fill, thin ink outline, halftone shadow offset to the bottom-right, optional tape at the top-right.
 * Width/height come from `style` or the content; animate it from outside (opacity/transform on a wrapper).
 */
export const PaperCard: React.FC<{u: number; children: React.ReactNode; tape?: boolean; style?: React.CSSProperties; pad?: number}> = ({u, children, tape = true, style, pad}) => {
  const {line, radius, shadow} = paperDims(u);
  return (
    <div style={{position: 'relative', boxSizing: 'border-box', ...style}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${shadow}px, ${shadow}px)`, borderRadius: radius, ...dots(u)}} />
      <div style={{position: 'relative', boxSizing: 'border-box', height: '100%', background: PAPER.card, border: `${line}px solid ${PAPER.ink}`,
        borderRadius: radius, padding: pad ?? u * 0.02}}>{children}</div>
      {tape && <Tape u={u} style={{top: -u * 0.011, right: u * 0.03}} />}
    </div>
  );
};
