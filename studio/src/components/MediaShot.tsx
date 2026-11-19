// contain-fit media over a blurred cover copy (never crops students)
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useRemotionEnvironment, useVideoConfig} from 'remotion';
import {effectTransform} from '../effects';
import type {MediaItem} from '../types';
import {ReelVideo} from './ReelVideo';

// library/<name>.<ext> -> library/thumbs/<name>.jpg (written by tools/ingest.py)
const thumbOf = (src: string) => src.replace(/^library\/(.+)\.[^./]+$/, 'library/thumbs/$1.jpg');

export const MediaShot: React.FC<{item: MediaItem}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const env = useRemotionEnvironment();
  const p = Math.min(1, frame / Math.max(1, Math.round(item.duration * fps)));
  const src = staticFile(item.src);
  const full: React.CSSProperties = {width: '100%', height: '100%'};
  const layer = (fit: 'contain' | 'cover', style: React.CSSProperties) =>
    item.type === 'image'
      ? <Img src={src} style={{...full, objectFit: fit, ...style}} />
      : <ReelVideo src={src} trimBefore={Math.round(item.from * fps)} objectFit={fit} style={{...full, ...style}} />;
  // Preview only: a still thumbnail under the blur instead of a second <video> of the same file. Two decoders per
  // shot (four during a crossfade) made the in-app player stall at every cut; the final render keeps the live copy.
  const bg = item.type === 'video' && !env.isRendering
    ? <img src={staticFile(thumbOf(item.src))} style={{...full, objectFit: 'cover'}} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    : layer('cover', {});
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: 'blur(40px) brightness(0.7)', transform: 'scale(1.2)'}}>{bg}</AbsoluteFill>
      <AbsoluteFill>{layer('contain', {transform: effectTransform(item.effect, p)})}</AbsoluteFill>
    </AbsoluteFill>
  );
};
