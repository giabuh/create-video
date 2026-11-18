import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const LowerThird: React.FC<{title: string; subtitle?: string; brand: Brand}> = ({title, subtitle, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{fontFamily}}>
      <div style={{position: 'absolute', left: 0, bottom: 640, transform: `translateX(${(s - 1) * 100}%)`,
        background: brand.colors.primary, borderLeft: `16px solid ${brand.colors.accent}`, padding: '24px 48px 24px 40px',
        borderRadius: '0 24px 24px 0', maxWidth: '88%'}}>
        <div style={{fontWeight: 800, fontSize: 64, color: brand.colors.text}}>{title}</div>
        {subtitle && <div style={{fontWeight: 400, fontSize: 44, color: brand.colors.accent}}>{subtitle}</div>}
      </div>
    </AbsoluteFill>
  );
};
