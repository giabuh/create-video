// contain-fit media over a blurred cover copy (never crops students)
import React, {useCallback, useId, useRef} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, spring, useRemotionEnvironment, useVideoConfig, type OnVideoFrame} from 'remotion';
import {effectTransform, glitchAt} from '../effects';
import type {MediaItem} from '../types';
import {ReelVideo} from './ReelVideo';
import {collageRect, mediaCardRect, type CollageSlot} from './storyLayout';

// library/<name>.<ext> -> library/thumbs/<name>.jpg (written by tools/ingest.py)
const thumbOf = (src: string) => src.replace(/^library\/(.+)\.[^./]+$/, 'library/thumbs/$1.jpg');

// card: story template's floating picture on a lit backdrop (light = light text-card scenes)
export const CardBackdrop: React.FC<{light: boolean}> = ({light}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const streak = (top: number, speed: number, a: number): React.CSSProperties => ({
    position: 'absolute', filter: 'blur(36px)', top: `${top}%`, left: '-30%', width: '160%', height: '14%', transform: `rotate(-22deg) translateX(${(frame / fps) * speed}px)`,
    background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,${a}), rgba(255,255,255,0))`,
  });
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={streak(22, 14, light ? 0.25 : 0.1)} />
      <div style={streak(64, -10, light ? 0.18 : 0.06)} />
    </AbsoluteFill>
  );
};

// collage: item i is a tilted card at slot i of n; `sceneSec` = scene length, for the push-in. Backdrop comes from the scene (ReelFrame).
export const MediaShot: React.FC<{item: MediaItem; card?: boolean; light?: boolean; collage?: {slot: CollageSlot; index: number; sceneSec: number}; grade?: boolean}> = ({item, card = false, light = false, collage, grade = false}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const env = useRemotionEnvironment();
  const p = Math.min(1, frame / Math.max(1, Math.round(item.duration * fps)));
  const src = staticFile(item.src);
  const full: React.CSSProperties = {width: '100%', height: '100%'};
  const fid = 'glitch' + useId().replace(/\W/g, '');
  const g = item.effect === 'glitch' ? glitchAt(frame, fps, item.src.length) : {dx: 0, dy: 0, split: 0};
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
  const gradeCss = grade ? 'contrast(1.07) saturate(1.15) brightness(1.02)' : '';
  const picture = (
    <>
      <AbsoluteFill style={g.split > 0 ? {filter: `url(#${fid})`, transform: `translate(${g.dx}px, ${g.dy}px)`} : undefined}>
        {layer('contain', {transform: effectTransform(item.effect, p), filter: gradeCss || undefined}, env.isRendering && !card ? drawBg : undefined)}
      </AbsoluteFill>
      {g.split > 0 && (
        // R shifted +split, G+B shifted -split, summed: split 0 would equal the original picture
        <svg width={0} height={0} style={{position: 'absolute'}}>
          <filter id={fid} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={g.split} result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feOffset in="gb" dx={-g.split} result="gbo" />
            <feComposite in="ro" in2="gbo" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
          </filter>
        </svg>
      )}
    </>
  );
  if (collage) {
    const {slot, index, sceneSec} = collage;
    const r = collageRect(slot, item.aspect ?? 1, width, height);
    const t = frame / fps + item.start;
    const e = spring({frame, fps, durationInFrames: Math.round(0.35 * fps), config: {damping: 12}});
    const dir = slot.x < 0.5 ? -1 : 1, tilt = slot.rot < 0 ? -1 : 1, ph = index * 1.7, per = 4 + (index % 3);
    const w = (2 * Math.PI * t) / per + ph;
    const dx = 12 * Math.sin(w) + dir * 140 * (1 - e), dy = 12 * Math.sin(w * 0.87 + 1);
    const rot = slot.rot + tilt * 8 * (1 - e) + 1.5 * Math.sin(w * 1.13 + 2);
    return (
      <AbsoluteFill>
        <div style={{
          position: 'absolute', left: `${(r.cx - r.w / 2) * 100}%`, top: `${(r.cy - r.h / 2) * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`,
          borderRadius: 28, border: `4px solid ${light ? '#111114' : '#FFFFFF'}`, overflow: 'hidden', boxSizing: 'border-box', backgroundColor: light ? '#E7E2D6' : '#15151B',
          boxShadow: light ? '0 30px 80px rgba(0,0,0,.25)' : '0 30px 80px rgba(0,0,0,.6)',
          transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${(0.85 + 0.15 * Math.min(1, e)) * (1 + 0.04 * Math.min(1, t / sceneSec))})`,
          filter: e < 1 ? `blur(${10 * (1 - e)}px)` : undefined,
        }}>{picture}</div>
      </AbsoluteFill>
    );
  }
  if (card) {
    const r = mediaCardRect(item.aspect ?? 1, width, height);
    const enter = interpolate(frame / fps, [0, 0.25], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
    return (
      <AbsoluteFill style={{backgroundColor: light ? '#F3EFE6' : '#0B0B0F'}}>
        <CardBackdrop light={light} />
        <div style={{
          position: 'absolute', left: `${((1 - r.width) / 2) * 100}%`, width: `${r.width * 100}%`, top: `${r.top * 100}%`, height: `${(r.bottom - r.top) * 100}%`,
          borderRadius: 28, border: `4px solid ${light ? '#111114' : '#FFFFFF'}`, overflow: 'hidden', boxSizing: 'border-box', backgroundColor: light ? '#E7E2D6' : '#15151B',
          boxShadow: light ? '0 30px 80px rgba(0,0,0,.25)' : '0 30px 80px rgba(0,0,0,.6)',
          transform: `scale(${(0.92 + 0.08 * enter) * (1 + 0.06 * p)})`, filter: enter < 1 ? `blur(${10 * (1 - enter)}px)` : undefined,
        }}>{picture}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: 'blur(40px) brightness(0.7)', transform: 'scale(1.2)'}}>{bg}</AbsoluteFill>
      {picture}
    </AbsoluteFill>
  );
};
