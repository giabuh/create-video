import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Transition} from '../types';

// Enter animation only: the template keeps the previous shot running underneath for `seconds`, so fade = crossfade
// and slide = the new shot slides over the old one (no background shows through).
export const SceneTransition: React.FC<{type: Transition; seconds?: number; children: React.ReactNode}> = ({type, seconds = 0.3, children}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, Math.round(seconds * fps)));
  const style: React.CSSProperties =
    type === 'fade' ? {opacity: Easing.inOut(Easing.ease)(p)}
    : type === 'slide' ? {transform: `translateX(${(1 - Easing.out(Easing.cubic)(p)) * width}px)`}
    : {};
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
