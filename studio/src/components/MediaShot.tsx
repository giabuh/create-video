// contain-fit media over a blurred cover copy (never crops students)
import React, {useCallback, useRef} from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useRemotionEnvironment, useVideoConfig, type OnVideoFrame} from 'remotion';
import {effectTransform} from '../effects';
import type {MediaItem} from '../types';
import {ReelVideo} from './ReelVideo';

// library/<name>.<ext> -> library/thumbs/<name>.jpg (written by tools/ingest.py)
const thumbOf = (src: string) => src.replace(/^library\/(.+)\.[^./]+$/, 'library/thumbs/$1.jpg');

export const MediaShot: React.FC<{item: MediaItem}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const env = useRemotionEnvironment();
  const p = Math.min(1, frame / Math.max(1, Math.round(item.duration * fps)));
  const src = staticFile(item.src);
  const full: React.CSSProperties = {width: '100%', height: '100%'};
  const bgRef = useRef<HTMLCanvasElement>(null);
  // Render: paint the blurred cover copy from the foreground's decoded frame (cover-fit into a 1/8-size canvas), so
  // each clip is decoded once; a second <Video> of the same file cost ~17% of render time. 40px blur hides the downscale.
  const drawBg = useCallback<OnVideoFrame>((f) => {
    const c = bgRef.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const {width: w, height: h} = f as ImageBitmap; // render path hands an ImageBitmap
    const k = Math.max(c.width / w, c.height / h);
    ctx.drawImage(f, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
  }, []);
  const layer = (fit: 'contain' | 'cover', style: React.CSSProperties, onVideoFrame?: OnVideoFrame) =>
    item.type === 'image'
      ? <Img src={src} style={{...full, objectFit: fit, ...style}} />
      : <ReelVideo src={src} trimBefore={Math.round(item.from * fps)} objectFit={fit} style={{...full, ...style}} onVideoFrame={onVideoFrame} />;
  // Preview: a still thumbnail under the blur instead of a second <video> of the same file. Two decoders per
  // shot (four during a crossfade) made the in-app player stall at every cut.
  const bg = item.type !== 'video' ? layer('cover', {})
    : env.isRendering ? <canvas ref={bgRef} width={Math.round(width / 8)} height={Math.round(height / 8)} style={full} />
    : <img src={staticFile(thumbOf(item.src))} style={{...full, objectFit: 'cover'}} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: 'blur(40px) brightness(0.7)', transform: 'scale(1.2)'}}>{bg}</AbsoluteFill>
      <AbsoluteFill>{layer('contain', {transform: effectTransform(item.effect, p)}, env.isRendering ? drawBg : undefined)}</AbsoluteFill>
    </AbsoluteFill>
  );
};
