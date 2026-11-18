import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const Checklist: React.FC<{items: string[]; title?: string; brand: Brand}> = ({items, title, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: '0 90px', gap: 36, fontFamily}}>
      {title && <div style={{fontWeight: 800, fontSize: 84, color: brand.colors.accent, marginBottom: 20}}>{title}</div>}
      {items.map((item, i) => {
        const s = spring({frame: frame - Math.round((0.3 + i * 0.5) * fps), fps, config: {damping: 14}});
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 32, opacity: s, transform: `translateX(${(1 - s) * -120}px)`}}>
            <div style={{width: 84, height: 84, borderRadius: 42, background: brand.colors.accent, color: brand.colors.background,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800, flexShrink: 0}}>✓</div>
            <div style={{fontWeight: 700, fontSize: 64, color: brand.colors.text, lineHeight: 1.15}}>{item}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
