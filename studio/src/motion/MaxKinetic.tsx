import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {useFontsLoaded, widthOf} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {choice, numDefault, text, z, type MotionProps} from './schema';

export const MaxKineticSchema = z.object({
  text: text('Chữ (mỗi từ vào lần lượt)'),
  variant: choice('Kiểu', ['tag', 'slam'], 'slam', {tag: 'Thẻ kính, trượt từng từ', slam: 'Đóng chữ khổng lồ'}),
  size: numDefault('Cỡ chữ tối đa (px)', 190, {min: 40, max: 400, step: 5}),
});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Words: React.FC<MotionProps<typeof MaxKineticSchema>> = ({text: s, variant, size, area, brand, layerSeconds}) => {
  const frame = useCurrentFrame(); // read here: CameraMotionBlur re-renders children at sub-frame times
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const loaded = useFontsLoaded();
  const words = s.split(' ');
  const slam = variant === 'slam';
  const family = slam ? headingFamily : fontFamily;
  const fit = loaded ? Math.min(size, (area.width * (slam ? 0.9 : 0.78) / widthOf(s, 100, slam ? 900 : 800, family)) * 100) : size;
  const out = interpolate(t, [layerSeconds - 0.25, layerSeconds], [1, 0], clamp);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: out}}>
      <div style={slam ? {} : {background: `color-mix(in srgb, ${brand.colors.background} 62%, transparent)`, border: '3px solid rgba(255,255,255,.2)', borderLeft: `18px solid ${brand.colors.accent}`, borderRadius: 40, padding: `${fit * 0.28}px ${fit * 0.5}px`, backdropFilter: 'blur(30px)', boxShadow: '0 30px 80px rgba(0,0,0,.35)'}}>
        <div style={{display: 'flex', gap: fit * (slam ? 0.18 : 0.28), whiteSpace: 'nowrap'}}>
          {words.map((w, i) => {
            const p = spring({frame: frame - i * 5, fps, config: slam ? {damping: 9, stiffness: 180} : {damping: 18, stiffness: 140}});
            return (
              <span key={i} style={{
                display: 'inline-block', fontFamily: family, fontWeight: slam ? 900 : 800, fontSize: fit, lineHeight: 1.05, textTransform: slam ? 'uppercase' : undefined,
                color: slam ? (i === words.length - 1 ? brand.colors.accent : brand.colors.text) : brand.colors.text,
                opacity: Math.min(1, p * 3),
                transform: slam ? `translateY(${(1 - p) * -260}px) scale(${1 + (1 - p) * 1.8}) rotate(${(1 - p) * -7 - 2}deg)` : `translateX(${(1 - p) * 140}px)`,
                textShadow: slam ? `0 ${fit * 0.05}px 0 ${brand.colors.background}, 0 ${fit * 0.1}px ${fit * 0.2}px rgba(0,0,0,.45)` : '0 4px 16px rgba(0,0,0,.4)',
              }}>{w}</span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Kinetic words with camera motion blur on the slam/slide. */
export const MaxKinetic: React.FC<MotionProps<typeof MaxKineticSchema>> = (p) => (
  <CameraMotionBlur shutterAngle={200} samples={6}><Words {...p} /></CameraMotionBlur>
);
