import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily, headingFamily} from '../fonts';
import {choice, numDefault, optText, text, z, type MotionProps} from './schema';
import {stampImpact} from './style';

/** Drawing component: red stamp slamming in (rotated -12deg) with a shockwave ring. Lines: round = [top, big, bottom], rect = [text].
 *  `size` = round diameter, or ~3.2x the font size for rect; `start` = seconds when the slam begins (impact at +0.225s). */
export const StampMark: React.FC<{shape: 'round' | 'rect'; lines: string[]; color: string; size: number; start?: number}> = ({shape, lines, color, size, start = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const m = stampImpact(frame, fps, start);
  const k = size / 330; // mockup stamp is 110px = 330px
  const [top, big, bottom] = shape === 'round' ? [lines[0], lines[1] ?? '', lines[2]] : [undefined, lines[0] ?? '', undefined];
  const face: React.CSSProperties = {color, background: 'rgba(255,255,255,.94)', boxShadow: '0 18px 54px rgba(11,21,48,.35)', boxSizing: 'border-box'};
  return (
    <div style={{position: 'relative', display: 'inline-block'}}>
      <div style={{position: 'absolute', inset: 0, border: `${9 * k}px solid ${color}`, borderRadius: 999, opacity: m.ring.opacity, transform: `scale(${m.ring.scale})`, pointerEvents: 'none'}} />
      {shape === 'round' ? (
        <div style={{...face, width: size, height: size, borderRadius: 999, border: `${12 * k}px solid ${color}`, padding: 15 * k, opacity: m.opacity, transform: `scale(${m.scale}) rotate(${m.rotate}deg)`}}>
          <div style={{width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: 999, border: `${6 * k}px dashed ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, textAlign: 'center'}}>
            {top && <div style={{fontFamily: headingFamily, fontSize: 42 * k, fontWeight: 800, letterSpacing: 6 * k}}>{top}</div>}
            <div style={{fontFamily: headingFamily, fontSize: 114 * k, fontWeight: 900}}>{big}</div>
            {bottom && <div style={{fontFamily, fontSize: 21 * k, fontWeight: 800, letterSpacing: 3 * k}}>{bottom}</div>}
          </div>
        </div>
      ) : (
        <div style={{...face, border: `${15 * k}px double ${color}`, borderRadius: 24 * k, padding: `${6 * k}px ${42 * k}px`, fontFamily: headingFamily, fontSize: 102 * k, fontWeight: 900,
          letterSpacing: 6 * k, lineHeight: 1.1, whiteSpace: 'nowrap', opacity: m.opacity, transform: `scale(${m.scale}) rotate(${m.rotate}deg)`}}>{big}</div>
      )}
    </div>
  );
};

export const StampSchema = z.object({
  shape: choice('Kiểu dấu', ['round', 'rect'], 'round', {round: 'Tròn', rect: 'Chữ nhật'}),
  top: optText('Chữ nhỏ phía trên (dấu tròn)'),
  main: text('Chữ chính (VD: 35%)'),
  bottom: optText('Chữ nhỏ phía dưới (dấu tròn)'),
  size: numDefault('Cỡ dấu (px)', 330, {min: 120, max: 700, step: 10}),
  delay: numDefault('Trễ (giây)', 0, {min: 0, max: 10, step: 0.05}),
});

export const Stamp: React.FC<MotionProps<typeof StampSchema>> = ({shape, top, main, bottom, size, delay, brand, layerSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const m = stampImpact(frame, fps, delay);
  const exit = interpolate(frame / fps, [layerSeconds - 0.25, layerSeconds], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: exit, transform: `translate(${m.shake.x}px, ${m.shake.y}px)`}}>
      <StampMark shape={shape} lines={shape === 'round' ? [top ?? '', main, bottom ?? ''] : [main]} color={brand.colors.accent2} size={size} start={delay} />
    </AbsoluteFill>
  );
};
