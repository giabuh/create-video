import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

// film look over the whole frame: scan lines + animated grain + vignette + progress bar; nothing when all are off
// progress: top bar in `accent` filling over 0 -> ctaStart (seconds), hidden from the CTA on
export const Look: React.FC<{grain: number; scanlines: number; vignette?: number; progress?: boolean; accent?: string; ctaStart?: number}> = ({grain, scanlines, vignette = 0, progress = false, accent = '#FFFFFF', ctaStart = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (grain <= 0 && scanlines <= 0 && vignette <= 0 && !progress) return null;
  const end = ctaStart * fps;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {vignette > 0 && (
        <AbsoluteFill style={{opacity: vignette, background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(5,10,30,.55) 100%)'}} />
      )}
      {progress && end > 0 && frame < end && (
        <div style={{position: 'absolute', left: 0, top: 0, height: 10, width: `${Math.min(1, frame / end) * 100}%`, background: `linear-gradient(90deg, ${accent}, #fff)`, boxShadow: `0 0 24px ${accent}`}} />
      )}
      {scanlines > 0 && (
        <AbsoluteFill style={{
          opacity: 0.12 * scanlines,
          background: 'repeating-linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)',
        }} />
      )}
      {grain > 0 && (
        <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: 0.1 * grain, mixBlendMode: 'overlay'}}>
          <filter id="story-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={Math.floor(frame / 2)} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#story-grain)" />
        </svg>
      )}
    </AbsoluteFill>
  );
};
