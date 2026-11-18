import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const PriceTag: React.FC<{price: string; old?: string; note?: string; brand: Brand}> = ({price, old, note, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 9}});
  const strike = spring({frame: frame - 12, fps, config: {damping: 20}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{background: brand.colors.accent, borderRadius: 40, padding: '48px 80px', textAlign: 'center',
        transform: `rotate(-4deg) scale(${s})`, boxShadow: '0 24px 70px rgba(0,0,0,.5)'}}>
        {old && (
          <div style={{position: 'relative', display: 'inline-block', fontWeight: 700, fontSize: 72, color: brand.colors.background, opacity: 0.7}}>
            {old}
            <div style={{position: 'absolute', left: 0, top: '52%', height: 8, width: `${strike * 100}%`, background: '#E11D48'}} />
          </div>
        )}
        <div style={{fontWeight: 800, fontSize: 180, lineHeight: 1, color: brand.colors.background}}>{price}</div>
        {note && <div style={{fontWeight: 700, fontSize: 52, color: brand.colors.background, marginTop: 12}}>{note}</div>}
      </div>
    </AbsoluteFill>
  );
};
