import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {bool, num, numDefault, optText, z, type MotionProps} from './schema';

export const CountUpSchema = z.object({
  from: num('Từ'),
  to: num('Đến'),
  decimals: numDefault('Số lẻ', 1, {min: 0, max: 3, step: 1}),
  label: optText('Nhãn'),
  suffix: z.string().default('').meta({title: 'Hậu tố (VD: %, +)'}),
  size: numDefault('Cỡ số (px)', 220, {min: 60, max: 400, step: 5}),
  seconds: numDefault('Đếm trong (giây)', 1.2, {min: 0.2, max: 10, step: 0.1}),
  vi: bool('Số kiểu Việt (77,6 · 650.000)', false),
});

export const CountUp: React.FC<MotionProps<typeof CountUpSchema>> = ({from, to, decimals, label, suffix, size, seconds, vi, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [0, seconds * fps], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const pop = spring({frame, fps, config: {damping: 10}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{background: brand.colors.primary, borderRadius: 48, padding: '40px 72px', textAlign: 'center',
        transform: `scale(${pop})`, boxShadow: '0 20px 60px rgba(0,0,0,.45)', fontFamily}}>
        {label && <div style={{fontWeight: 700, fontSize: size * 0.25, color: brand.colors.text}}>{label}</div>}
        <div style={{fontWeight: 800, fontSize: size, lineHeight: 1, color: brand.colors.accent}}>
          {vi ? (from + (to - from) * p).toLocaleString('vi-VN', {minimumFractionDigits: decimals, maximumFractionDigits: decimals}) : (from + (to - from) * p).toFixed(decimals)}{suffix}
        </div>
      </div>
    </AbsoluteFill>
  );
};
