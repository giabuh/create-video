import React from 'react';
import {AbsoluteFill, Easing, Freeze, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {GLASS, backOut} from '../motion/style';
import type {Brand, Cta, MediaItem} from '../types';
import {ReelVideo} from './ReelVideo';

const out = Easing.bezier(0.22, 1, 0.36, 1);
const PHONE_PATH = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z';

// Glass card at the bottom (mockup frame 5, px x3); a navy gradient sits behind it so it also works without footage.
export const CtaCard: React.FC<{cta: Cta; brand: Brand; bg?: MediaItem}> = ({cta, brand, bg}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.05], {extrapolateRight: 'clamp'});
  const p = (delay: number, dur = 0.4, ease: (n: number) => number = out) =>
    interpolate(t, [delay, delay + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const pulse = 1 + 0.05 * (0.5 - 0.5 * Math.cos((t / 1.1) * 2 * Math.PI)); // 1.1s ease-in-out loop, 1 -> 1.05
  const card = p(0);
  const logo = p(0.25, 0.36, backOut);
  const btn = p(0.45, 0.36, backOut);
  const phone = p(0.6);
  const rest = p(0.7);
  const {accent, background, text} = brand.colors;
  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${brand.colors.primary}, ${background})`, fontFamily}}>
      {bg && (
        <AbsoluteFill style={{transform: `scale(${zoom})`}}>
          {bg.type === 'image'
            ? <Img src={staticFile(bg.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            : <Freeze frame={0}><ReelVideo src={staticFile(bg.src)} trimBefore={Math.max(0, Math.round((bg.from + bg.duration) * fps) - 1)} objectFit="cover" style={{width: '100%', height: '100%'}} /></Freeze>}
        </AbsoluteFill>
      )}
      {bg && <AbsoluteFill style={{background: `linear-gradient(180deg, ${background}59 0%, ${background}00 25%, ${background}00 50%, ${background}99 100%)`}} />}
      <div style={{
        ...GLASS, position: 'absolute', left: 72, right: 72, bottom: 150, padding: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36,
        boxShadow: '0 54px 120px rgba(0,0,0,.35)',
        opacity: card, transform: `translateY(${(1 - card) * 84}px)`,
      }}>
        {brand.logo && <Img src={staticFile(brand.logo)} style={{width: cta.logoSize ?? 360, maxWidth: '100%', maxHeight: 420, objectFit: 'contain', opacity: Math.min(1, logo), transform: `scale(${0.4 + 0.6 * logo})`}} />}
        <div style={{width: '100%', opacity: Math.min(1, btn), transform: `scale(${0.4 + 0.6 * btn})`}}>
          <div style={{background: accent, color: background, fontSize: 54, fontWeight: 900, textAlign: 'center', padding: '36px 0', borderRadius: 999, letterSpacing: 1.5, transform: `scale(${pulse})`}}>
            {cta.title || 'ĐĂNG KÝ NGAY'}
          </div>
        </div>
        {cta.phone && (
          <div style={{display: 'flex', alignItems: 'center', gap: 24, fontSize: 66, fontWeight: 800, color: text, opacity: phone, transform: `translateY(${(1 - phone) * 84}px)`}}>
            <svg width={60} height={60} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d={PHONE_PATH} /></svg>
            {cta.phone}
          </div>
        )}
        {[cta.fanpage, cta.address].filter(Boolean).map((l, i) => (
          <div key={i} style={{fontSize: 39, fontWeight: 500, color: 'rgba(255,255,255,.75)', textAlign: 'center', opacity: rest, transform: `translateY(${(1 - rest) * 84}px)`}}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
