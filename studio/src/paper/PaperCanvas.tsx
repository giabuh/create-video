// Paper canvas: cream page, faint grain, L-shaped crop marks in the corners, 4 palette squares bottom-right. No text.
import React from 'react';
import {PAPER} from './paper';

export const PaperCanvas: React.FC<{width: number; height: number}> = ({width, height}) => {
  const u = Math.min(width, height);
  const m = u * 0.035, len = u * 0.028, w = Math.max(2, u * 0.002);
  const mark = (x: number, y: number, sx: number, sy: number) => `M${x + sx * len},${y} L${x},${y} L${x},${y + sy * len}`;
  const sq = u * 0.018;
  return (
    <div style={{position: 'absolute', inset: 0, background: PAPER.canvas, overflow: 'hidden'}}>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <filter id="paper-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" /><feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.14  0 0 0 0 0.2  0 0 0 0.9 0" /></filter>
        <rect width={width} height={height} filter="url(#paper-grain)" opacity={0.06} />
        <path d={[mark(m, m, 1, 1), mark(width - m, m, -1, 1), mark(m, height - m, 1, -1), mark(width - m, height - m, -1, -1)].join(' ')}
          fill="none" stroke={PAPER.ink} strokeWidth={w} opacity={0.55} />
      </svg>
      <div style={{position: 'absolute', right: m + len * 1.4, bottom: m + len * 0.2, display: 'flex', gap: sq * 0.5}}>
        {[PAPER.terra, PAPER.ink, PAPER.blue, PAPER.sage].map((c) => <div key={c} style={{width: sq, height: sq, background: c}} />)}
      </div>
    </div>
  );
};
