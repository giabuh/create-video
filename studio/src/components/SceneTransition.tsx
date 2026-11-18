import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Transition} from '../types';

// shortcut: scenes don't overlap, so 'slide' reveals the template background briefly; add TransitionSeries if that looks off.
export const SceneTransition: React.FC<{type: Transition; children: React.ReactNode}> = ({type, children}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const p = Math.min(1, frame / Math.round(0.3 * fps));
  const style: React.CSSProperties =
    type === 'fade' ? {opacity: p}
    : type === 'slide' ? {transform: `translateX(${(1 - Easing.out(Easing.cubic)(p)) * width}px)`}
    : {};
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
