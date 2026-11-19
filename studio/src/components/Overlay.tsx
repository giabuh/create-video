import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand, Overlay as OverlayT} from '../types';

export const Overlay: React.FC<{overlay: OverlayT; brand: Brand}> = ({overlay, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 10}});
  const pos: React.CSSProperties = overlay.position === 'top' ? {top: '12.5%'} : overlay.position === 'bottom' ? {bottom: '33%'} : {top: '45%'};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', ...pos}}>
        <div style={{
          fontFamily, fontWeight: 800, fontSize: 96, color: brand.colors.background, background: brand.colors.accent,
          padding: '18px 44px', borderRadius: 20, transform: `rotate(-3deg) scale(${s})`, boxShadow: '0 12px 40px rgba(0,0,0,.4)',
        }}>{overlay.text}</div>
      </div>
    </AbsoluteFill>
  );
};
