import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Star} from '@remotion/shapes';
import {noise2D} from '@remotion/noise';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {choice, numDefault, optText, text, z, type MotionProps} from './schema';

export const MaxOfferSchema = z.object({
  part: choice('Phần', ['card', 'number'], 'card', {card: 'Nhãn + tiêu đề', number: 'Số đếm trong tia sáng'}),
  label: optText('Nhãn (VD: ƯU ĐÃI HỌC PHÍ)'),
  title: optText('Tiêu đề (VD: Giảm ngay khi đăng ký)'),
  highlight: optText('Cụm chữ vàng trong tiêu đề'),
  number: numDefault('Số đếm đến', 35, {min: 0, max: 100000, step: 1}),
  suffix: text('Hậu tố số').default('%'),
  stampTop: optText('Chữ phía trên số (VD: GIẢM)'),
  stampBottom: optText('Nút phía dưới số (VD: ĐĂNG KÝ NGAY)'),
});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const MaxOffer: React.FC<MotionProps<typeof MaxOfferSchema>> = ({part, label, title, highlight, number, suffix, stampTop, stampBottom, brand, area, layerSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {accent, background, accent2, text: txt} = brand.colors;
  const out = interpolate(t, [layerSeconds - 0.25, layerSeconds], [1, 0], clamp);
  const pop = (d: number) => spring({frame: frame - Math.round(d * fps), fps, config: {damping: 11, stiffness: 140}});

  if (part === 'card') {
    const fs = loaded && title ? fitFontSize({text: title, width: area.width * 0.9, height: 200, maxSize: 110, weight: 800, lineHeight: 1.1, minSize: 30, wrap: false}) : 80;
    const parts = title && highlight && title.includes(highlight) ? title.split(highlight) : [title ?? '', '', ''];
    return (
      <AbsoluteFill style={{opacity: out, alignItems: 'center', justifyContent: 'flex-start', gap: 22}}>
        {label && (
          <div style={{background: accent2, color: txt, fontFamily: headingFamily, fontWeight: 900, fontSize: 76, letterSpacing: 8, padding: '6px 52px', borderRadius: 20, transform: `scale(${pop(0)}) rotate(-2deg)`, boxShadow: `14px 14px 0 ${background}`}}>{label}</div>
        )}
        {title && (
          <div style={{fontFamily, fontWeight: 800, fontSize: fs, color: txt, textAlign: 'center', lineHeight: 1.1, padding: '0 40px', opacity: Math.min(1, pop(0.2) * 2), transform: `translateY(${(1 - pop(0.2)) * 80}px)`, textShadow: '0 6px 30px rgba(0,0,0,.6)'}}>
            {parts[0]}{parts[1] !== undefined && highlight && <span style={{color: accent}}>{highlight}</span>}{parts[1]}
          </div>
        )}
      </AbsoluteFill>
    );
  }

  const R = Math.min(area.width * 0.46, area.height * 0.4);
  const burst = spring({frame, fps, config: {damping: 12, stiffness: 90}});
  const val = Math.round(interpolate(t, [0.1, 1.0], [0, number], {...clamp, easing: Easing.out(Easing.cubic)}));
  const landed = spring({frame: frame - Math.round(1.0 * fps), fps, config: {damping: 6, stiffness: 200}});
  const numSize = Math.min(R * 1.25, (R * 1.4) / (0.57 * `${number}${suffix}`.length)); // keep the number inside the star
  return (
    <AbsoluteFill style={{opacity: out, alignItems: 'center', justifyContent: 'center'}}>
      {[...Array(18)].map((_, i) => {
        const a = (i / 18) * Math.PI * 2 + noise2D('a', i, 0) * 0.4;
        const life = ((t * 0.9 + i * 0.137) % 1);
        const d = R * (0.9 + life * 0.8);
        return <div key={i} style={{position: 'absolute', left: '50%', top: '50%', width: 16 + (i % 3) * 8, height: 16 + (i % 3) * 8, borderRadius: 99, background: i % 2 ? txt : accent,
          transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d * 0.85}px)`, opacity: (1 - life) * Math.min(1, burst)}} />;
      })}
      <div style={{position: 'absolute', transform: `scale(${burst}) rotate(${t * 22}deg)`, filter: 'drop-shadow(0 30px 60px rgba(0,0,0,.45))'}}>
        <Star points={14} innerRadius={R * 0.78} outerRadius={R} cornerRadius={14} fill={accent2} />
      </div>
      <div style={{position: 'absolute', transform: `scale(${burst * 0.86}) rotate(${-t * 14}deg)`}}>
        <Star points={14} innerRadius={R * 0.7} outerRadius={R * 0.86} cornerRadius={14} fill={accent} />
      </div>
      <div style={{position: 'absolute', textAlign: 'center', transform: `scale(${0.85 + 0.15 * landed})`}}>
        {stampTop && <div style={{fontFamily: headingFamily, fontWeight: 900, fontSize: numSize * 0.28, letterSpacing: 12, color: background, lineHeight: 1}}>{stampTop}</div>}
        <div style={{fontFamily: headingFamily, fontWeight: 900, fontSize: numSize, lineHeight: 0.9, color: background, fontVariantNumeric: 'tabular-nums'}}>{val}{suffix}</div>
      </div>
      {stampBottom && (
        <div style={{position: 'absolute', bottom: 24, background: txt, color: background, fontFamily: headingFamily, fontWeight: 900, fontSize: 70, letterSpacing: 6, padding: '8px 54px', borderRadius: 999, boxShadow: `0 14px 0 ${accent}`, transform: `scale(${pop(1.0)})`}}>{stampBottom}</div>
      )}
    </AbsoluteFill>
  );
};
