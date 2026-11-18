import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const CountUp: React.FC<{from: number; to: number; decimals?: number; label?: string; suffix?: string; brand: Brand}> = (
  {from, to, decimals = 1, label, suffix = '', brand},
) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [0, 1.2 * fps], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const pop = spring({frame, fps, config: {damping: 10}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{background: brand.colors.primary, borderRadius: 48, padding: '40px 72px', textAlign: 'center',
        transform: `scale(${pop})`, boxShadow: '0 20px 60px rgba(0,0,0,.45)', fontFamily}}>
        {label && <div style={{fontWeight: 700, fontSize: 56, color: brand.colors.text}}>{label}</div>}
        <div style={{fontWeight: 800, fontSize: 220, lineHeight: 1, color: brand.colors.accent}}>
          {(from + (to - from) * p).toFixed(decimals)}{suffix}
        </div>
      </div>
    </AbsoluteFill>
  );
};
