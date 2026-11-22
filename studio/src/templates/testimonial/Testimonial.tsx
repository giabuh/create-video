// style: calm "student testimonial": footage in a framed card on a brand background, the spoken text as a big quote above, name bar below
import React from 'react';
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {MediaShot} from '../../components/MediaShot';
import {MotionLayer} from '../../components/MotionLayer';
import {ReelTail} from '../../components/ReelTail';
import {SceneTransition} from '../../components/SceneTransition';
import {captionUnits} from '../../components/Captions';
import {fitFontSize, useFontsLoaded} from '../../fit';
import {fontFamily} from '../../fonts';
import type {Brand, Scene, RenderProps} from '../../types';

const CARD = {x: 90, y: 800, w: 900, h: 640};

// the scene's captions joined into one quote: chunks already spoken stay white, the current one is accent, upcoming ones dim
const Quote: React.FC<{scene: Scene; brand: Brand}> = ({scene, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {colors} = brand;
  const full = scene.captions.map((c) => c.text).join(' ');
  const size = loaded ? fitFontSize({text: full, maxSize: 76, minSize: 36, width: 860, height: 380, weight: 800, lineHeight: 1.25}) : 60;
  const hl = scene.highlight.map((h) => h.toLowerCase());
  return (
    <div style={{position: 'absolute', left: 90, width: 860, top: 270, height: 500, fontFamily}}>
      <div style={{fontSize: 190, lineHeight: '120px', height: 100, fontWeight: 900, color: colors.accent}}>❝</div>
      <div style={{fontSize: size, fontWeight: 800, lineHeight: 1.25, color: colors.text}}>
        {scene.captions.map((c, ci) => {
          const state = t >= c.end ? 'done' : t >= c.start ? 'now' : 'next';
          return (
            <span key={ci} style={{opacity: state === 'next' ? 0.28 : 1, color: state === 'now' ? colors.accent : colors.text}}>
              {captionUnits(c.text, scene.highlight).map((u, i) => (
                <span key={i} style={{whiteSpace: 'nowrap', textDecoration: u.mark || hl.includes(u.text.toLowerCase()) ? `underline ${colors.accent} 6px` : undefined, textUnderlineOffset: 8}}>{u.text}</span>
              )).reduce<React.ReactNode[]>((a, e, i) => (i ? [...a, ' ', e] : [e]), [])}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const NameBar: React.FC<{text: string; brand: Brand}> = ({text, brand}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [6, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: CARD.x, width: CARD.w, top: CARD.y + CARD.h + 28, display: 'flex', alignItems: 'center', gap: 20, opacity: o, fontFamily}}>
      <div style={{width: 10, alignSelf: 'stretch', borderRadius: 5, background: brand.colors.accent}} />
      <div style={{fontSize: 44, fontWeight: 800, color: brand.colors.text, lineHeight: 1.2}}>{text}</div>
    </div>
  );
};

export const Testimonial: React.FC<RenderProps> = (p) => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.max(1, Math.round(s * fps));
  const {colors} = p.brand;
  const ts = p.transitionSeconds ?? 0.6; // calmer than fast-cut
  const tf = Math.round(ts * fps);
  return (
    <AbsoluteFill style={{background: `linear-gradient(170deg, ${colors.primary}, ${colors.background})`}}>
      {p.scenes.map((sc, si) => {
        const next = p.scenes[si + 1];
        const tail = next && next.transition !== 'cut' ? tf : 0;
        const mt = sc.mediaTransition ?? 'fade';
        return (
          <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration) + tail}>
            <SceneTransition type={si === 0 ? 'cut' : 'fade'} seconds={ts}>
              <div style={{position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 40, overflow: 'hidden',
                border: `8px solid ${colors.accent}`, boxShadow: `0 24px 70px rgba(0,0,0,.55), 0 0 0 14px ${colors.primary}`, background: colors.background}}>
                {sc.media.map((m, i) => (
                  <Sequence key={`media-${i}`} from={Math.round(m.start * fps)}
                    durationInFrames={f(m.duration) + (i === sc.media.length - 1 ? tail : mt !== 'cut' ? tf : 0)}>
                    <SceneTransition type={i === 0 ? 'cut' : mt} seconds={ts}><MediaShot item={m} /></SceneTransition>
                  </Sequence>
                ))}
                {/* scene motion is drawn inside the card so it never covers the quote */}
                <Sequence name={`${sc.id} motion`} durationInFrames={f(sc.duration)} style={{zIndex: 1}}>
                  {sc.motion.map((m, i) => (
                  <Sequence key={`motion-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                    <MotionLayer item={m} brand={p.brand} />
                  </Sequence>
                ))}
                </Sequence>
              </div>
              <Sequence name={`${sc.id} content`} durationInFrames={f(sc.duration)}>
                <Quote scene={sc} brand={p.brand} />
                <NameBar text={sc.overlay?.text ?? p.brand.name} brand={p.brand} />
                {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
              </Sequence>
            </SceneTransition>
          </Sequence>
        );
      })}
      <ReelTail p={p} />
    </AbsoluteFill>
  );
};
