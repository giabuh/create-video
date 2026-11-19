import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {numDefault, text, z, type MotionProps} from './schema';

export const DateBadgeSchema = z.object({
  label: text('Nhãn (VD: Khai giảng)'),
  date: text('Ngày'),
  width: numDefault('Rộng (px)', 620, {min: 300, max: 1000, step: 10}),
});

export const DateBadge: React.FC<MotionProps<typeof DateBadgeSchema>> = ({label, date, width, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 12}});
  const k = width / 620;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width, borderRadius: 36 * k, overflow: 'hidden', background: '#FFFFFF', transform: `translateY(${(1 - s) * 300}px)`,
        opacity: s, boxShadow: '0 24px 70px rgba(0,0,0,.5)', textAlign: 'center'}}>
        <div style={{background: brand.colors.primary, color: brand.colors.text, fontWeight: 800, fontSize: 60 * k, padding: `${28 * k}px 0`}}>{label}</div>
        <div style={{color: brand.colors.background, fontWeight: 800, fontSize: 120 * k, padding: `${40 * k}px 0`}}>{date}</div>
      </div>
    </AbsoluteFill>
  );
};
