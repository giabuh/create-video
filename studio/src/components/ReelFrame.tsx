// shared reel skeleton: scenes with transitions, media, motion, overlay, voice, CTA, video-wide track, sfx, music
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {CtaCard} from '../components/CtaCard';
import {CardBackdrop, MediaShot} from '../components/MediaShot';
import {MotionLayer} from '../components/MotionLayer';
import {MusicTrack} from '../components/MusicTrack';
import {Overlay} from '../components/Overlay';
import {SceneTransition} from '../components/SceneTransition';
import {SfxTrack} from '../components/SfxTrack';
import {isCard, collageSlots} from './storyLayout';
import type {RenderProps, Scene} from '../types';

export const ReelFrame: React.FC<{
  p: RenderProps;
  captions: (sc: Scene) => React.ReactNode;
  empty: (sc: Scene) => React.ReactNode;
  logo: boolean;
  ctaCenter?: boolean;
  children?: React.ReactNode;
}> = ({p, captions, empty, logo, ctaCenter, children}) => {
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
        return (
          <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration) + tail}>
            {/* the first scene has nothing to blend from: show it at once */}
            <SceneTransition type={si === 0 ? 'cut' : sc.transition} seconds={ts}>
              {sc.media.length === 0 && empty(sc)}
              {sc.layout === 'collage' && <>
                <AbsoluteFill style={{backgroundColor: sc.bg === 'light' ? '#F3EFE6' : '#0B0B0F'}}><CardBackdrop light={sc.bg === 'light'} /></AbsoluteFill>
                {sc.media.map((m, i) => (
                  <Sequence key={`media-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(sc.duration - m.start) + tail}>
                    <MediaShot item={m} light={sc.bg === 'light'} collage={{slot: collageSlots(sc.media.length)[i], index: i, sceneSec: sc.duration}} />
                  </Sequence>
                ))}
              </>}
              {sc.layout !== 'collage' && sc.media.map((m, i) => (
                <Sequence key={`media-${i}`} from={Math.round(m.start * fps)}
                  durationInFrames={f(m.duration) + (i === sc.media.length - 1 ? tail : mt !== 'cut' ? tf : 0)}>
                  <SceneTransition type={i === 0 ? 'cut' : mt} seconds={ts}><MediaShot item={m} card={isCard(m, p.look)} light={sc.bg === 'light'} /></SceneTransition>
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
          </Sequence>
        );
      })}
      {logo && p.brand.logo && (
        <AbsoluteFill><Img src={staticFile(p.brand.logo)} style={{position: 'absolute', top: 80, left: 60, width: 160}} /></AbsoluteFill>
      )}
      {p.cta && (
        <Sequence name="cta" from={Math.round(ctaStart * fps)} durationInFrames={f(p.cta.duration)}>
          <CtaCard cta={p.cta} brand={p.brand} bg={p.scenes[p.scenes.length - 1]?.media[0]} centerY={ctaCenter ? 0.45 : undefined} />
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
