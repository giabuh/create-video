// style: quick cuts, bold captions, accent overlays, logo top-left; the video-wide motion track draws on top
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Captions} from '../../components/Captions';
import {CtaCard} from '../../components/CtaCard';
import {MediaShot} from '../../components/MediaShot';
import {MotionLayer} from '../../components/MotionLayer';
import {MusicTrack} from '../../components/MusicTrack';
import {Overlay} from '../../components/Overlay';
import {SceneTransition} from '../../components/SceneTransition';
import type {RenderProps} from '../../types';

export const FastCut: React.FC<RenderProps> = (p) => {
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
              {sc.media.length === 0 && (
                <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.primary}, ${colors.background})`}} />
              )}
              {sc.media.map((m, i) => (
                <Sequence key={`media-${i}`} from={Math.round(m.start * fps)}
                  durationInFrames={f(m.duration) + (i === sc.media.length - 1 ? tail : mt !== 'cut' ? tf : 0)}>
                  <SceneTransition type={i === 0 ? 'cut' : mt} seconds={ts}><MediaShot item={m} /></SceneTransition>
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
                <Captions chunks={sc.captions} highlight={sc.highlight} style={p.captions} boxColor={p.brand.colors.background} />
                {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
              </Sequence>
            </SceneTransition>
          </Sequence>
        );
      })}
      {p.brand.logo && (
        <AbsoluteFill><Img src={staticFile(p.brand.logo)} style={{position: 'absolute', top: 80, left: 60, width: 160}} /></AbsoluteFill>
      )}
      {p.cta && (
        <Sequence name="cta" from={Math.round(ctaStart * fps)} durationInFrames={f(p.cta.duration)}>
          <CtaCard cta={p.cta} brand={p.brand} bg={p.scenes[p.scenes.length - 1]?.media[0]} />
        </Sequence>
      )}
      {(p.overlays ?? []).map((m, i) => (
        <Sequence key={`overlay-${i}`} name={`track:${m.component}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
          <MotionLayer item={m} brand={p.brand} />
        </Sequence>
      ))}
      {(p.sfx ?? []).map((x, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(x.start * fps)} name={`sfx:${x.src}`}>
          <Audio src={staticFile(x.src)} volume={x.volume} />
        </Sequence>
      ))}
      {p.music && <MusicTrack music={p.music} scenes={p.scenes} total={p.totalSeconds} />}
    </AbsoluteFill>
  );
};
