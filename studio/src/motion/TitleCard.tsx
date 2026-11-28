// TitleCard: yellow kicker tag over a navy card with a big title (same family as the Checklist rows).
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {numDefault, text, z, type MotionProps} from './schema';
import {RADIUS} from './style';

export const TitleCardSchema = z.object({
  kicker: text('Nhãn nhỏ phía trên'),
  title: text('Tiêu đề'),
  size: numDefault('Cỡ chữ tối đa (px)', 76, {min: 28, max: 160, step: 2}),
});

export const TitleCard: React.FC<MotionProps<typeof TitleCardSchema>> = ({kicker, title, size: maxSize, brand, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const {background, accent, text: ink} = brand.colors;
  const s = spring({frame, fps, config: {damping: 15}, durationInFrames: Math.round(fps * 0.4)});
  const width = area.width * 0.92;
  const size = loaded ? fitFontSize({text: title, maxSize, minSize: 24, width: width - 80, height: area.height * 0.6, weight: 800}) : maxSize;
  return (
    <AbsoluteFill style={{fontFamily, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{width, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + 0.15 * s})`, opacity: Math.min(1, s * 2)}}>
        <div style={{position: 'relative', background: accent, color: background, fontFamily: headingFamily, fontWeight: 900, fontSize: size * 0.7, lineHeight: 1.15,
          padding: '6px 28px', borderRadius: RADIUS, textTransform: 'uppercase'}}>{kicker}</div>
        <div style={{width: '100%', boxSizing: 'border-box', marginTop: -6, padding: '30px 40px', background, color: ink, borderRadius: RADIUS,
          boxShadow: `12px 12px 0 ${accent}`, fontWeight: 800, fontSize: size, lineHeight: 1.2, textAlign: 'center', textWrap: 'balance', whiteSpace: 'pre-line'}}>{title}</div>
      </div>
    </AbsoluteFill>
  );
};
