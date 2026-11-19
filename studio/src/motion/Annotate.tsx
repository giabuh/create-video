// Hand-drawn mark (circle, box, underline, highlight…) drawn over the layer box — point at something in the footage,
// or around a word if `text` is set. Uses @remotion/rough-notation.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Box, Bracket, Circle, CrossedOff, Highlight, Underline} from '@remotion/rough-notation';
import {fontFamily} from '../fonts';
import {choice, color, numDefault, optText, z, type MotionProps} from './schema';

const KINDS = {circle: Circle, box: Box, underline: Underline, highlight: Highlight, 'crossed-off': CrossedOff, bracket: Bracket};

export const AnnotateSchema = z.object({
  kind: choice('Kiểu nét', ['circle', 'box', 'underline', 'highlight', 'crossed-off', 'bracket'], 'circle',
    {circle: 'Khoanh tròn', box: 'Khung', underline: 'Gạch chân', highlight: 'Tô nền', 'crossed-off': 'Gạch chéo', bracket: 'Ngoặc'}),
  text: optText('Chữ được đánh dấu (trống = cả khung lớp)'),
  size: numDefault('Cỡ chữ (px)', 90, {min: 20, max: 300, step: 2}),
  color: color('Màu nét (trống = màu nhấn)'),
  strokeWidth: numDefault('Độ dày nét', 8, {min: 1, max: 30, step: 1}),
  drawSeconds: numDefault('Vẽ trong (giây)', 0.6, {min: 0.1, max: 5, step: 0.1}),
  iterations: numDefault('Số lần vẽ chồng', 2, {min: 1, max: 4, step: 1}),
});

export const Annotate: React.FC<MotionProps<typeof AnnotateSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame, [0, p.drawSeconds * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const C = KINDS[p.kind];
  const col = p.color ?? (p.kind === 'highlight' ? `${p.brand.colors.accent}99` : p.brand.colors.accent);
  const stroke = p.kind === 'highlight' ? {} : {strokeWidth: p.strokeWidth};
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {p.text
        ? <C progress={progress} color={col} iterations={p.iterations} {...stroke}>
          <span style={{fontFamily, fontWeight: 800, fontSize: p.size, color: p.brand.colors.text, textShadow: '0 4px 18px rgba(0,0,0,.6)'}}>{p.text}</span>
        </C>
        : <C progress={progress} color={col} iterations={p.iterations} {...stroke} style={{width: '100%', height: '100%', display: 'block'}}>
          <div style={{width: '100%', height: '100%'}} />
        </C>}
    </AbsoluteFill>
  );
};
