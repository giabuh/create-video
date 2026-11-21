import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useFontsLoaded, widthOf} from '../fit';
import {headingFamily} from '../fonts';
import {lines, z, type MotionProps} from './schema';

export const MaxPhoneSchema = z.object({
  groups: lines('Các nhóm số điện thoại (mỗi dòng một nhóm, VD: 0876)'),
  itemsAt: z.array(z.string()).optional().describe('Từ trong lời đọc để hiện từng nhóm (prepare.py tự tính giờ)'),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ hiện từng nhóm (giây, tự tính từ itemsAt)'),
});

const PHONE = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z';

/** Phone number on a glass plate: digits drop in group by group on the spoken digits, ringing handset with pulse rings. */
export const MaxPhone: React.FC<MotionProps<typeof MaxPhoneSchema>> = ({groups, itemTimes, brand, area, layerSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {accent, background, text} = brand.colors;
  const full = groups.join(' ');
  const size = loaded ? Math.min(300, (area.width * 0.94) / (widthOf(full, 100, 900, headingFamily) / 100 + 1.2)) : 200;
  const out = interpolate(t, [layerSeconds - 0.25, layerSeconds], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const plate = spring({frame, fps, config: {damping: 16}});
  const ring = Math.sin(t * 30) * Math.max(0, 1 - ((t * 1.6) % 1) * 1.6) * 14;
  return (
    <AbsoluteFill style={{opacity: out, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{background: `color-mix(in srgb, ${background} 72%, transparent)`, backdropFilter: 'blur(30px)', border: '3px solid rgba(255,255,255,.2)', borderRadius: 80, padding: `${size * 0.16}px ${size * 0.22}px`, boxShadow: '0 40px 100px rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', gap: size * 0.2, transform: `scale(${0.7 + 0.3 * plate})`, opacity: Math.min(1, plate * 2)}}>
        <div style={{position: 'relative', width: size * 0.52, height: size * 0.52, flex: 'none'}}>
          {[0, 1].map((k) => {
            const p = ((t * 1.1 + k * 0.5) % 1);
            return <div key={k} style={{position: 'absolute', inset: 0, borderRadius: 999, border: `6px solid ${accent}`, transform: `scale(${1 + p * 1.1})`, opacity: (1 - p) * 0.8}} />;
          })}
          <div style={{position: 'absolute', inset: 0, borderRadius: 999, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${ring}deg)`}}>
            <svg width="58%" height="58%" viewBox="0 0 24 24" fill="none" stroke={background} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d={PHONE} /></svg>
          </div>
        </div>
        <div style={{display: 'flex', gap: size * 0.22, fontFamily: headingFamily, fontWeight: 900, fontSize: size, lineHeight: 1, color: text}}>
          {groups.map((g, gi) => (
            <div key={gi} style={{display: 'flex'}}>
              {[...g].map((ch, ci) => {
                const p = spring({frame: frame - Math.round(((itemTimes?.[gi] ?? 0.2 + gi * 0.6) + ci * 0.06) * fps), fps, config: {damping: 10, stiffness: 190}});
                return <span key={ci} style={{display: 'inline-block', opacity: Math.min(1, p * 4), transform: `translateY(${(1 - p) * -140}px) scale(${0.6 + 0.4 * p})`, color: gi === groups.length - 1 ? accent : text}}>{ch}</span>;
              })}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
