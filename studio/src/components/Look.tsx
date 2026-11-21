import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

// film look over the whole frame: scan lines + animated grain; nothing when both are 0
export const Look: React.FC<{grain: number; scanlines: number}> = ({grain, scanlines}) => {
  const frame = useCurrentFrame();
  if (grain <= 0 && scanlines <= 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
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
