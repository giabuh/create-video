import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {FxText} from './fx/FxText';
import {numDefault, optText, text, textFx, z, type MotionProps} from './schema';

export const PriceTagSchema = z.object({
  price: text('Giá'),
  old: optText('Giá cũ (gạch ngang)'),
  note: optText('Ghi chú'),
  size: numDefault('Cỡ giá (px)', 180, {min: 60, max: 320, step: 5}),
  tilt: numDefault('Nghiêng (độ)', -4, {min: -30, max: 30, step: 1}),
  fx: textFx('Hiệu ứng chữ', 'none'),
});

export const PriceTag: React.FC<MotionProps<typeof PriceTagSchema>> = ({price, old, note, size, tilt, fx, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 9}});
  const strike = spring({frame: frame - 12, fps, config: {damping: 20}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{background: brand.colors.accent, borderRadius: 40, padding: '48px 80px', textAlign: 'center',
        transform: `rotate(${tilt}deg) scale(${s})`, boxShadow: '0 24px 70px rgba(0,0,0,.5)'}}>
        {old && (
          <div style={{position: 'relative', display: 'inline-block', fontWeight: 700, fontSize: size * 0.4, color: brand.colors.background, opacity: 0.7}}>
            {old}
            <div style={{position: 'absolute', left: 0, top: '52%', height: 8, width: `${strike * 100}%`, background: '#E11D48'}} />
          </div>
        )}
        <div style={{fontWeight: 800, fontSize: size, lineHeight: 1, color: brand.colors.background}}>{fx === 'none' ? price : <FxText text={price} fx={fx} start={0.2} />}</div>
        {note && <div style={{fontWeight: 700, fontSize: size * 0.29, color: brand.colors.background, marginTop: 12}}>{note}</div>}
      </div>
    </AbsoluteFill>
  );
};
