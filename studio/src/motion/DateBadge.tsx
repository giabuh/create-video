import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const DateBadge: React.FC<{label: string; date: string; brand: Brand}> = ({label, date, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 12}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width: 620, borderRadius: 36, overflow: 'hidden', background: '#FFFFFF', transform: `translateY(${(1 - s) * 300}px)`,
        opacity: s, boxShadow: '0 24px 70px rgba(0,0,0,.5)', textAlign: 'center'}}>
        <div style={{background: brand.colors.primary, color: brand.colors.text, fontWeight: 800, fontSize: 60, padding: '28px 0'}}>{label}</div>
        <div style={{color: brand.colors.background, fontWeight: 800, fontSize: 120, padding: '40px 0'}}>{date}</div>
      </div>
    </AbsoluteFill>
  );
};
