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
  const ctaStart = p.scenes.reduce((s, sc) => s + sc.duration, 0);
  return (
    <AbsoluteFill style={{backgroundColor: colors.background}}>
      {p.scenes.map((sc) => (
        <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration)}>
          <SceneTransition type={sc.transition}>
            {sc.media.length === 0 && (
              <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.primary}, ${colors.background})`}} />
            )}
            {sc.media.map((m, i) => (
              <Sequence key={`media-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                <MediaShot item={m} />
              </Sequence>
            ))}
            {sc.motion.map((m, i) => (
              <Sequence key={`motion-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                <MotionLayer item={m} brand={p.brand} />
              </Sequence>
            ))}
            {sc.overlay && <Overlay overlay={sc.overlay} brand={p.brand} />}
            <Captions chunks={sc.captions} highlight={sc.highlight} style={p.captions} />
          </SceneTransition>
          {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
        </Sequence>
      ))}
      {p.brand.logo && (
        <AbsoluteFill><Img src={staticFile(p.brand.logo)} style={{position: 'absolute', top: 80, left: 60, width: 160}} /></AbsoluteFill>
      )}
      {p.cta && (
        <Sequence name="cta" from={Math.round(ctaStart * fps)} durationInFrames={f(p.cta.duration)}>
          <CtaCard cta={p.cta} brand={p.brand} />
        </Sequence>
      )}
      {(p.overlays ?? []).map((m, i) => (
        <Sequence key={`overlay-${i}`} name={`track:${m.component}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
          <MotionLayer item={m} brand={p.brand} />
        </Sequence>
      ))}
      {p.music && <MusicTrack music={p.music} scenes={p.scenes} total={p.totalSeconds} />}
    </AbsoluteFill>
  );
};
