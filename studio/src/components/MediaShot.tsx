// contain-fit media over a blurred cover copy (never crops students)
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {effectTransform} from '../effects';
import type {MediaItem} from '../types';
import {ReelVideo} from './ReelVideo';

export const MediaShot: React.FC<{item: MediaItem}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, Math.round(item.duration * fps)));
  const src = staticFile(item.src);
  const full: React.CSSProperties = {width: '100%', height: '100%'};
  const layer = (fit: 'contain' | 'cover', style: React.CSSProperties) =>
    item.type === 'image'
      ? <Img src={src} style={{...full, objectFit: fit, ...style}} />
      : <ReelVideo src={src} trimBefore={Math.round(item.from * fps)} objectFit={fit} style={{...full, ...style}} />;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: 'blur(40px) brightness(0.7)', transform: 'scale(1.2)'}}>{layer('cover', {})}</AbsoluteFill>
      <AbsoluteFill>{layer('contain', {transform: effectTransform(item.effect, p)})}</AbsoluteFill>
    </AbsoluteFill>
  );
};
