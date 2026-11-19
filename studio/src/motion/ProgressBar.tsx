// Fills over the layer's own length. Put it on the video-wide track to show progress through the reel.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {choice, color, numDefault, z, type MotionProps} from './schema';

export const ProgressBarSchema = z.object({
  thickness: numDefault('Độ dày (px)', 14, {min: 2, max: 80, step: 1}),
  edge: choice('Bám cạnh', ['top', 'bottom'], 'top', {top: 'Trên', bottom: 'Dưới'}),
  color: color('Màu thanh (trống = màu nhấn)'),
  track: color('Màu nền thanh (trống = trong mờ)'),
  radius: numDefault('Bo góc (px)', 0, {min: 0, max: 40, step: 1}),
});

export const ProgressBar: React.FC<MotionProps<typeof ProgressBarSchema>> = ({thickness, edge, color: c, track, radius, brand, layerSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [0, Math.max(1, layerSeconds * fps - 1)], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: edge === 'top' ? 'flex-start' : 'flex-end'}}>
      <div style={{height: thickness, background: track ?? 'rgba(255,255,255,0.25)', borderRadius: radius, overflow: 'hidden'}}>
        <div style={{height: '100%', width: `${p * 100}%`, background: c ?? brand.colors.accent, borderRadius: radius}} />
      </div>
    </AbsoluteFill>
  );
};
