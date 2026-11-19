import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {choice, lines, numDefault, bool, z, type MotionProps} from './schema';

export const KineticTextSchema = z.object({
  lines: lines('Các dòng chữ (mỗi dòng một ý)'),
  size: numDefault('Cỡ chữ tối đa (px) — tự thu nhỏ cho vừa khung', 110, {min: 30, max: 260, step: 2}),
  align: choice('Canh lề', ['center', 'left', 'right'], 'center', {center: 'Giữa', left: 'Trái', right: 'Phải'}),
  stagger: numDefault('Dòng sau trễ (giây)', 0.27, {min: 0, max: 2, step: 0.05}),
  alternate: bool('Dòng chẵn màu nhấn', true),
});

export const KineticText: React.FC<MotionProps<typeof KineticTextSchema>> = ({lines: ls, size: maxSize, align, stagger, alternate, brand, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const pad = Math.min(80, area.width * 0.06, area.height * 0.06);
  // one line per entry, never wrapped: shrink until the longest line and the whole stack fit
  const size = loaded ? fitFontSize({text: ls.join('\n'), maxSize, width: area.width - 2 * pad, height: area.height - 2 * pad,
    weight: 800, lineHeight: 1.05, wrap: false, gap: 0.22}) : maxSize;
  const items = align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end';
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: items, flexDirection: 'column', gap: size * 0.22, padding: pad}}>
      {ls.map((line, i) => {
        const s = spring({frame: frame - Math.round(i * stagger * fps), fps, config: {damping: 12}});
        return (
          <div key={i} style={{
            fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.05, textAlign: align,
            color: alternate && i % 2 ? brand.colors.accent : brand.colors.text, opacity: s,
            transform: `translateY(${(1 - s) * 80}px) scale(${0.8 + 0.2 * s})`, textShadow: '0 6px 24px rgba(0,0,0,.6)',
          }}>{line}</div>
        );
      })}
    </AbsoluteFill>
  );
};
