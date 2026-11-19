import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useFontsLoaded, widthOf} from '../fit';
import {fontFamily} from '../fonts';
import {FxText} from './fx/FxText';
import {lines, numDefault, optText, textFx, z, type MotionProps} from './schema';

export const ChecklistSchema = z.object({
  items: lines('Các mục (mỗi dòng một mục)'),
  title: optText('Tiêu đề'),
  size: numDefault('Cỡ chữ tối đa (px) — tự thu nhỏ cho vừa khung', 64, {min: 28, max: 140, step: 2}),
  interval: numDefault('Mục sau hiện cách (giây)', 0.5, {min: 0, max: 3, step: 0.05}),
  fx: textFx('Hiệu ứng chữ', 'none'),
});

export const Checklist: React.FC<MotionProps<typeof ChecklistSchema>> = ({items, title, size: maxSize, interval, fx, brand, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const padX = Math.min(90, area.width * 0.08);
  // everything scales with the size: shrink until the widest row and the whole list fit the area
  const k = loaded ? Math.min(1,
    (area.width - 2 * padX) / Math.max(1, ...items.map((t) => 1.3 * maxSize + maxSize / 2 + widthOf(t, maxSize, 700)), title ? widthOf(title, maxSize * 1.3, 800) : 0),
    (area.height * 0.94) / ((title ? maxSize * 1.3 * 1.2 + 20 + maxSize * 0.56 : 0) + items.length * maxSize * 1.3 + (items.length - 1) * maxSize * 0.56)) : 1;
  const size = Math.floor(maxSize * k);
  const dot = size * 1.3;
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: `0 ${padX}px`, gap: size * 0.56, fontFamily}}>
      {title && <div style={{fontWeight: 800, fontSize: size * 1.3, color: brand.colors.accent, marginBottom: 20}}>{title}</div>}
      {items.map((item, i) => {
        const s = spring({frame: frame - Math.round((0.05 + i * interval) * fps), fps, config: {damping: 14}});
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: size / 2, opacity: s, transform: `translateX(${(1 - s) * -120}px)`}}>
            <div style={{width: dot, height: dot, borderRadius: dot / 2, background: brand.colors.accent, color: brand.colors.background,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.9, fontWeight: 800, flexShrink: 0}}>✓</div>
            <div style={{fontWeight: 700, fontSize: size, color: brand.colors.text, lineHeight: 1.15}}>{fx === 'none' ? item : <FxText text={item} fx={fx} start={Math.round((0.05 + i * interval) * fps) / fps} />}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
