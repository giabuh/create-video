import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const KineticText: React.FC<{lines: string[]; brand: Brand}> = ({lines, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24, padding: 80}}>
      {lines.map((line, i) => {
        const s = spring({frame: frame - i * 8, fps, config: {damping: 12}});
        return (
          <div key={i} style={{
            fontFamily, fontWeight: 800, fontSize: 110, lineHeight: 1.05, textAlign: 'center',
            color: i % 2 ? brand.colors.accent : brand.colors.text, opacity: s,
            transform: `translateY(${(1 - s) * 80}px) scale(${0.8 + 0.2 * s})`, textShadow: '0 6px 24px rgba(0,0,0,.6)',
          }}>{line}</div>
        );
      })}
    </AbsoluteFill>
  );
};
