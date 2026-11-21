// shared reel skeleton: scenes with transitions, media, motion, overlay, voice, CTA, video-wide track, sfx, music
import React from 'react';
import {AbsoluteFill, Img, Sequence, getRemotionEnvironment, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {LightLeak} from '@remotion/light-leaks';
import {Audio} from '@remotion/media';
import {CtaCard} from '../components/CtaCard';
import {CardBackdrop, MediaShot} from '../components/MediaShot';
import {MotionLayer} from '../components/MotionLayer';
import {MusicTrack} from '../components/MusicTrack';
import {Overlay} from '../components/Overlay';
import {SceneTransition} from '../components/SceneTransition';
import {ScenePresentation, isPresentation} from '../components/ScenePresentation';
import {SfxTrack} from '../components/SfxTrack';
import {isCard, collageSlots} from './storyLayout';
import type {RenderProps, Scene, Transition} from '../types';

// Drives one side of a ScenePresentation from the scene Sequence's own frame; `start` is the frame the transition begins.
const Pres: React.FC<{type: Transition; direction: 'entering' | 'exiting'; start: number; tf: number; accent: string; children: React.ReactNode}> = ({type, direction, start, tf, accent, children}) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, Math.max(0, (frame - start) / Math.max(1, tf)));
  return <ScenePresentation type={type} direction={direction} progress={progress} accent={accent} durationInFrames={tf}>{children}</ScenePresentation>;
};

// LightLeak needs a WebGL context and cancels the whole Player when it can't get one (no GPU, or Chrome's cap on
// live contexts). The app preview shows a CSS stand-in instead; renders keep the real effect.
const LeakStandIn: React.FC = () => {
  const frame = useCurrentFrame();
  const o = Math.sin(Math.min(1, frame / 34) * Math.PI) * 0.75;
  return <AbsoluteFill style={{opacity: o, mixBlendMode: 'screen', background: 'radial-gradient(circle at 30% 35%, #ffb36b, #ff5e3a 35%, transparent 70%)'}} />;
};
export const Leak: React.FC<{seed: number; hueShift?: number}> = ({seed, hueShift = 0}) =>
  getRemotionEnvironment().isPlayer ? <LeakStandIn /> : <LightLeak seed={seed} hueShift={hueShift} />;

export const ReelFrame: React.FC<{
  p: RenderProps;
  captions: (sc: Scene) => React.ReactNode;
  empty: (sc: Scene) => React.ReactNode;
  logo: boolean;
  ctaCenter?: boolean;
  renderCta?: (a: {cta: NonNullable<RenderProps['cta']>; brand: RenderProps['brand']; bg: RenderProps['scenes'][number]['media'][number] | undefined; centerY?: number}) => React.ReactNode;
  children?: React.ReactNode;
}> = ({p, captions, empty, logo, ctaCenter, renderCta = (a) => <CtaCard {...a} />, children}) => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.max(1, Math.round(s * fps));
  const {colors} = p.brand;
  const ts = p.transitionSeconds ?? 0.3;
  const tf = Math.round(ts * fps);
  const ctaStart =p.scenes.reduce((s, sc) => s + sc.duration, 0);
  return (
    <AbsoluteFill style={{backgroundColor: colors.background}}>
      {p.scenes.map((sc, si) => {
        // the outgoing picture keeps running under the incoming one for the transition length
        const next = p.scenes[si + 1];
        const tail = next && next.transition !== 'cut' ? tf : 0;
        const mt = sc.mediaTransition ?? 'cut';
        const enterPres = si > 0 && isPresentation(sc.transition);
        const exitPres = !!next && isPresentation(next.transition);
        const body = (
            // the first scene has nothing to blend from: show it at once; presentation scenes are animated by <Pres> instead
            <SceneTransition type={si === 0 || enterPres ? 'cut' : sc.transition} seconds={ts}>
              {sc.media.length === 0 && empty(sc)}
              {sc.layout === 'collage' && <>
                <AbsoluteFill style={{backgroundColor: sc.bg === 'light' ? '#F3EFE6' : '#0B0B0F'}}><CardBackdrop light={sc.bg === 'light'} /></AbsoluteFill>
                {sc.media.map((m, i) => (
                  <Sequence key={`media-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(sc.duration - m.start) + tail}>
                    <MediaShot item={m} grade={p.look?.grade} light={sc.bg === 'light'} collage={{slot: collageSlots(sc.media.length)[i], index: i, sceneSec: sc.duration}} />
                  </Sequence>
                ))}
              </>}
              {sc.layout !== 'collage' && sc.media.map((m, i) => (
                <Sequence key={`media-${i}`} from={Math.round(m.start * fps)}
                  durationInFrames={f(m.duration) + (i === sc.media.length - 1 ? tail : mt !== 'cut' ? tf : 0)}>
                  <SceneTransition type={i === 0 ? 'cut' : mt} seconds={ts}><MediaShot item={m} grade={p.look?.grade} card={isCard(m, p.look)} light={sc.bg === 'light'} /></SceneTransition>
                </Sequence>
              ))}
              {/* captions, motion and voice end with the scene; only the picture carries into the transition */}
              <Sequence name={`${sc.id} content`} durationInFrames={f(sc.duration)}>
                {sc.motion.map((m, i) => (
                  <Sequence key={`motion-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                    <MotionLayer item={m} brand={p.brand} />
                  </Sequence>
                ))}
                {sc.overlay && <Overlay overlay={sc.overlay} brand={p.brand} />}
                {captions(sc)}
                {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
              </Sequence>
            </SceneTransition>
        );
        return (
          <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration) + tail}>
            {/* new presentations animate both scenes: entering over the first tf frames, exiting over the tail */}
            {enterPres || exitPres ? (
              exitPres ? <Pres type={next.transition} direction="exiting" start={f(sc.duration)} tf={tf} accent={colors.accent}>
                {enterPres ? <Pres type={sc.transition} direction="entering" start={0} tf={tf} accent={colors.accent}>{body}</Pres> : body}
              </Pres> : <Pres type={sc.transition} direction="entering" start={0} tf={tf} accent={colors.accent}>{body}</Pres>
            ) : body}
          </Sequence>
        );
      })}
      {p.scenes.map((sc, si) => sc.leak && (
        <Sequence key={`leak-${sc.id}`} name={`leak ${sc.id}`} from={Math.round(sc.start * fps)} durationInFrames={34}>
          <Leak seed={si} />
        </Sequence>
      ))}
      {logo && p.brand.logo && (
        <AbsoluteFill><Img src={staticFile(p.brand.logo)} style={{position: 'absolute', top: 80, left: 60, width: 160}} /></AbsoluteFill>
      )}
      {p.cta && (
        <Sequence name="cta" from={Math.round(ctaStart * fps)} durationInFrames={f(p.cta.duration)}>
          {renderCta({cta: p.cta, brand: p.brand, bg: p.scenes[p.scenes.length - 1]?.media[0], centerY: ctaCenter ? 0.45 : undefined})}
        </Sequence>
      )}
      {(p.overlays ?? []).map((m, i) => (
        <Sequence key={`overlay-${i}`} name={`track:${m.component}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
          <MotionLayer item={m} brand={p.brand} />
        </Sequence>
      ))}
      <SfxTrack sfx={p.sfx ?? []} />
      {p.music && <MusicTrack music={p.music} scenes={p.scenes} total={p.totalSeconds} />}
      {children}
    </AbsoluteFill>
  );
};
