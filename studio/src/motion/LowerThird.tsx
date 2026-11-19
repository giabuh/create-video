import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {choice, numDefault, optText, text, z, type MotionProps} from './schema';

export const LowerThirdSchema = z.object({
  title: text('Tiêu đề'),
  subtitle: optText('Phụ đề'),
  side: choice('Bên', ['left', 'right'], 'left', {left: 'Trái', right: 'Phải'}),
  bottom: numDefault('Cách đáy khung (px)', 640, {min: 0, max: 1800, step: 10}),
  size: numDefault('Cỡ chữ (px)', 64, {min: 28, max: 140, step: 2}),
});

export const LowerThird: React.FC<MotionProps<typeof LowerThirdSchema>> = ({title, subtitle, side, bottom, size, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 16}});
  const left = side === 'left';
  return (
    <AbsoluteFill style={{fontFamily}}>
      <div style={{position: 'absolute', [left ? 'left' : 'right']: 0, bottom, transform: `translateX(${(left ? s - 1 : 1 - s) * 100}%)`,
        background: brand.colors.primary, [left ? 'borderLeft' : 'borderRight']: `16px solid ${brand.colors.accent}`,
        padding: left ? '24px 48px 24px 40px' : '24px 40px 24px 48px', borderRadius: left ? '0 24px 24px 0' : '24px 0 0 24px', maxWidth: '88%',
        textAlign: left ? 'left' : 'right'}}>
        <div style={{fontWeight: 800, fontSize: size, color: brand.colors.text}}>{title}</div>
        {subtitle && <div style={{fontWeight: 400, fontSize: size * 0.69, color: brand.colors.accent}}>{subtitle}</div>}
      </div>
    </AbsoluteFill>
  );
};
