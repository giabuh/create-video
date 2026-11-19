import React from 'react';
import {AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand, Cta} from '../types';

export const CtaCard: React.FC<{cta: Cta; brand: Brand}> = ({cta, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = (delay: number) => spring({frame: frame - delay, fps, config: {damping: 14}});
  const lines = [cta.phone && `☎ ${cta.phone}`, cta.fanpage, cta.address].filter(Boolean) as string[];
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(160deg, ${brand.colors.primary}, ${brand.colors.background})`,
      justifyContent: 'center', alignItems: 'center', gap: 40, padding: 80, fontFamily,
    }}>
      {brand.logo && <Img src={staticFile(brand.logo)} style={{width: cta.logoSize ?? 260, maxHeight: '40%', objectFit: 'contain', opacity: enter(0)}} />}
      <div style={{fontWeight: 800, fontSize: 120, color: brand.colors.accent, textAlign: 'center', transform: `scale(${enter(4)})`}}>{cta.title}</div>
      {lines.map((l, i) => (
        <div key={i} style={{fontWeight: 700, fontSize: 58, color: brand.colors.text, textAlign: 'center',
          opacity: enter(10 + i * 5), transform: `translateY(${(1 - enter(10 + i * 5)) * 40}px)`}}>{l}</div>
      ))}
    </AbsoluteFill>
  );
};
