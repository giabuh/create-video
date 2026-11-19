// Free text: the most flexible primitive. Place it anywhere with the layer box, style it here.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {FxText} from './fx/FxText';
import {fxDuration} from './fx/textFx';
import {bool, choice, color, longText, numDefault, textFx, z, type MotionProps} from './schema';

export const TextSchema = z.object({
  text: longText('Chữ'),
  size: numDefault('Cỡ chữ tối đa (px) — tự thu nhỏ cho vừa khung', 80, {min: 20, max: 300, step: 2}),
  weight: choice('Độ đậm', ['400', '700', '800'], '800', {400: 'Thường', 700: 'Đậm', 800: 'Rất đậm'}),
  color: color('Màu chữ (trống = màu chữ thương hiệu)'),
  align: choice('Canh lề', ['center', 'left', 'right'], 'center', {center: 'Giữa', left: 'Trái', right: 'Phải'}),
  vertical: choice('Canh dọc', ['center', 'top', 'bottom'], 'center', {center: 'Giữa', top: 'Trên', bottom: 'Dưới'}),
  background: color('Nền khối chữ (trống = không)'),
  radius: numDefault('Bo góc nền (px)', 24, {min: 0, max: 200, step: 2}),
  uppercase: bool('IN HOA'),
  shadow: bool('Đổ bóng', true),
  reveal: textFx('Hiện chữ', 'none'),
  revealSeconds: numDefault('Thời gian hiện chữ (giây)', 1, {min: 0.1, max: 10, step: 0.1}),
});

export const Text: React.FC<MotionProps<typeof TextSchema>> = (p) => {
  const loaded = useFontsLoaded();
  const text = p.uppercase ? p.text.toLocaleUpperCase('vi') : p.text;
  // largest size <= p.size at which the whole text fits the layer area (16 px safety margin each side)
  const size = loaded ? fitFontSize({text, maxSize: p.size, width: p.area.width - 32, height: p.area.height - 32, weight: p.weight,
    lineHeight: 1.12, padX: p.background ? 0.45 : 0, padY: p.background ? 0.25 : 0}) : p.size;
  const k = p.reveal === 'none' ? 1 : p.revealSeconds / Math.max(1e-3, fxDuration(p.reveal, text, 1));
  const content = p.reveal === 'none' ? text : <FxText text={text} fx={p.reveal} k={k} strokeColor={p.brand.colors.primary} />;
  return (
    <AbsoluteFill style={{
      justifyContent: p.vertical === 'top' ? 'flex-start' : p.vertical === 'bottom' ? 'flex-end' : 'center',
      alignItems: p.align === 'left' ? 'flex-start' : p.align === 'right' ? 'flex-end' : 'center',
    }}>
      <div style={{
        fontFamily, fontWeight: Number(p.weight), fontSize: size, lineHeight: 1.12, textAlign: p.align, whiteSpace: 'pre-wrap',
        color: p.color ?? p.brand.colors.text,
        background: p.background, borderRadius: p.radius, padding: p.background ? `${size * 0.25}px ${size * 0.45}px` : 0,
        textShadow: p.shadow && !p.background ? '0 4px 18px rgba(0,0,0,.75)' : undefined, maxWidth: '100%',
      }}>{content}</div>
    </AbsoluteFill>
  );
};
