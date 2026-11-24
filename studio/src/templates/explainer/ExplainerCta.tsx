// white closing card on the brand canvas; every size derives from the shorter side
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../../fonts';
import {PaperCanvas} from '../../paper/PaperCanvas';
import {Chip, PAPER, PaperCard, Title} from '../../paper/paper';
import type {Brand, Cta, MediaItem} from '../../types';

const out = Easing.bezier(0.22, 1, 0.36, 1);

export const ExplainerCta: React.FC<{cta: Cta; brand: Brand; bg?: MediaItem; centerY?: number; paper?: boolean}> = ({cta, brand, paper}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const u = Math.min(width, height);
  const p = (d: number) => interpolate(t, [d, d + 0.45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: out});
  const {primary, accent, background} = brand.colors;
  const card = p(0), a = p(0.3), b = p(0.5);
  const lines = [cta.fanpage, cta.address].filter(Boolean);
  if (paper) {
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <PaperCanvas width={width} height={height} />
        <div style={{opacity: card, transform: `translateY(${(1 - card) * u * 0.04}px) rotate(-1deg)`}}>
          <PaperCard u={u} pad={u * 0.05} style={{width: Math.min(width * 0.7, u * 1.1)}}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 0.03, textAlign: 'center'}}>
              {brand.logo && <Img src={staticFile(brand.logo)} style={{height: u * 0.14, maxWidth: '60%', objectFit: 'contain', opacity: a}} />}
              <Title u={u} size={u * 0.06} style={{opacity: a}}>{cta.title || 'ĐĂNG KÝ NGAY'}</Title>
              {cta.phone && <div style={{fontFamily: PAPER.mono, fontWeight: 700, fontSize: u * 0.05, color: PAPER.ink, opacity: b}}>{cta.phone}</div>}
              {lines.map((l, i) => <div key={i} style={{fontFamily, fontSize: u * 0.03, color: PAPER.muted, opacity: b}}>{l}</div>)}
              {brand.name && <Chip u={u} size={u * 0.026} style={{opacity: b}}>{brand.name}</Chip>}
            </div>
          </PaperCard>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${background}, ${primary}22)`, fontFamily, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{
        width: Math.min(width * 0.86, u * 1.3), boxSizing: 'border-box', padding: u * 0.06, borderRadius: u * 0.05, background: '#FFFFFF',
        boxShadow: '0 24px 70px rgba(11,21,48,.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 0.035,
        opacity: card, transform: `translateY(${(1 - card) * u * 0.05}px)`,
      }}>
        {brand.logo && <Img src={staticFile(brand.logo)} style={{height: u * 0.16, maxWidth: '70%', objectFit: 'contain', opacity: a}} />}
        <div style={{background: accent, color: primary, fontSize: u * 0.05, fontWeight: 900, textAlign: 'center', padding: `${u * 0.025}px ${u * 0.05}px`, borderRadius: 999, boxSizing: 'border-box', maxWidth: '100%', opacity: a}}>
          {cta.title || 'ĐĂNG KÝ NGAY'}
        </div>
        {cta.phone && <div style={{fontSize: u * 0.06, fontWeight: 800, color: primary, opacity: b}}>{cta.phone}</div>}
        {lines.map((l, i) => <div key={i} style={{fontSize: u * 0.032, fontWeight: 500, color: primary, opacity: b * 0.8, textAlign: 'center'}}>{l}</div>)}
      </div>
    </AbsoluteFill>
  );
};
