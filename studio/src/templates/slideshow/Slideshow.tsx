// style: calm editorial slideshow — media in the top 70% with a slow Ken Burns and long crossfades,
// a brand-surface panel below with thin elegant captions, an accent line and a "02 / 05" scene counter
import React from 'react';
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {captionUnits} from '../../components/Captions';
import {MediaShot} from '../../components/MediaShot';
import {MotionLayer} from '../../components/MotionLayer';
import {ReelTail} from '../../components/ReelTail';
import {Overlay} from '../../components/Overlay';
import {SceneTransition} from '../../components/SceneTransition';
import {fitFontSize, useFontsLoaded} from '../../fit';
import {fontFamily} from '../../fonts';
import type {CaptionChunk, MediaItem, RenderProps} from '../../types';

const MEDIA_H = 0.65; // share of the frame height taken by the picture (keeps bottom panel captions above TikTok's 22% UI bar)

// gentler than the shared effects: ~5% zoom or a 2% drift over the clip
const kenBurns = (e: MediaItem['effect'], p: number): string => {
  switch (e) {
    case 'zoom-out': return `scale(${1.05 - 0.05 * p})`;
    case 'pan-left': return `scale(1.06) translateX(${1.5 - 3 * p}%)`;
    case 'pan-right': return `scale(1.06) translateX(${-1.5 + 3 * p}%)`;
    default: return `scale(${1 + 0.05 * p})`; // zoom-in and none: a calm slow push
  }
};

const Shot: React.FC<{item: MediaItem}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, Math.round(item.duration * fps)));
  return <AbsoluteFill style={{transform: kenBurns(item.effect, p)}}><MediaShot item={{...item, effect: 'none'}} /></AbsoluteFill>;
};

const SlowCaption: React.FC<{chunks: CaptionChunk[]; highlight: string[]; size: number; color: string; accent: string}> = ({chunks, highlight, size, color, accent}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const c = chunks.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const fs = loaded ? fitFontSize({text: c.text, maxSize: size, width: width * 0.78, height: size * 1.4 * 2 + 1, weight: 400, lineHeight: 1.4}) : size;
  const a = interpolate(t - c.start, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{
      fontFamily, fontWeight: 400, fontSize: fs, lineHeight: 1.4, letterSpacing: '0.02em', color, textAlign: 'center',
      maxWidth: '78%', textWrap: 'balance', opacity: a, transform: `translateY(${(1 - a) * 12}px)`,
    }}>
      {captionUnits(c.text, highlight).map((u, i) => (
        <React.Fragment key={i}><span style={{whiteSpace: 'nowrap', ...(u.mark ? {color: accent, fontWeight: 700} : {})}}>{u.text}</span>{' '}</React.Fragment>
      ))}
    </div>
  );
};

export const Slideshow: React.FC<RenderProps> = (p) => {
  const {fps, height} = useVideoConfig();
  const f = (s: number) => Math.max(1, Math.round(s * fps));
  const {colors} = p.brand;
  const surface = colors.surface ?? colors.background;
  // no brand surface: the panel is the dark background, so ink flips to the text colour and the highlight to the accent
  const ink = colors.surface ? colors.primary : colors.text;
  const hi = colors.surface ? colors.accent2 ?? colors.primary : colors.accent;
  const ts = p.transitionSeconds ?? 1; // long crossfades
  const tf = Math.round(ts * fps);
  const mediaH = Math.round(height * MEDIA_H);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <AbsoluteFill style={{backgroundColor: surface}}>
      {/* the pictures sit in a clipped box, so the panel underneath stays still while clips crossfade */}
      {p.scenes.map((sc, si) => {
        const next = p.scenes[si + 1];
        const tail = next ? tf : 0;
        return (
          <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration) + tail}>
            <SceneTransition type={si === 0 ? 'cut' : 'fade'} seconds={ts}>
              <AbsoluteFill style={{height: mediaH, overflow: 'hidden', backgroundColor: colors.background}}>
                {sc.media.length === 0 && <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.primary}, ${colors.background})`}} />}
                {sc.media.map((m, i) => (
                  <Sequence key={`media-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration) + (i === sc.media.length - 1 ? tail : tf)}>
                    <SceneTransition type={i === 0 ? 'cut' : 'fade'} seconds={ts}><Shot item={m} /></SceneTransition>
                  </Sequence>
                ))}
              </AbsoluteFill>
              <Sequence name={`${sc.id} content`} durationInFrames={f(sc.duration)}>
                {sc.motion.map((m, i) => (
                  <Sequence key={`motion-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                    <MotionLayer item={m} brand={p.brand} />
                  </Sequence>
                ))}
                {sc.overlay && <Overlay overlay={sc.overlay} brand={p.brand} />}
                {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
              </Sequence>
            </SceneTransition>
          </Sequence>
        );
      })}
      {/* panel text per scene: sits above the picture layers but below the logo and CTA */}
      {p.scenes.map((sc, si) => (
        <Sequence key={`panel-${sc.id}`} name={`${sc.id} panel`} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration)}>
          <AbsoluteFill style={{top: mediaH, height: height - mediaH, backgroundColor: surface, alignItems: 'center'}}>
            <div style={{marginTop: 22, width: 96, height: 3, borderRadius: 2, backgroundColor: colors.accent}} />
            <div style={{marginTop: 14, fontFamily, fontWeight: 400, fontSize: 24, letterSpacing: '0.3em', color: ink, opacity: 0.7}}>
              {pad(si + 1)} / {pad(p.scenes.length)}
            </div>
            <div style={{position: 'absolute', top: 84, left: 0, right: 0, height: 152, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <SlowCaption chunks={sc.captions} highlight={sc.highlight} size={Math.round(p.captions.size * 0.72)} color={ink} accent={hi} />
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
      <ReelTail p={p} ctaCenter />
    </AbsoluteFill>
  );
};
