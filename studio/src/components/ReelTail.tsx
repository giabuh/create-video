// shared composition tail: logo, CTA, video-wide motion track, sfx, music
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useVideoConfig} from 'remotion';
import {CtaCard} from './CtaCard';
import {MotionLayer} from './MotionLayer';
import {MusicTrack} from './MusicTrack';
import {SfxTrack} from './SfxTrack';
import type {RenderProps} from '../types';

export type RenderCta = (a: {cta: NonNullable<RenderProps['cta']>; brand: RenderProps['brand']; bg: RenderProps['scenes'][number]['media'][number] | undefined; centerY?: number}) => React.ReactNode;

export const ReelTail: React.FC<{
  p: RenderProps;
  logo?: boolean;
  ctaCenter?: boolean;
  renderCta?: RenderCta;
  holdSfx?: boolean; // honour sfx `until` (hold + fade); the slideshow/split/testimonial templates always played the full clip
}> = ({p, logo = true, ctaCenter, renderCta = (a) => <CtaCard {...a} />, holdSfx = false}) => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.max(1, Math.round(s * fps));
  const ctaStart = p.scenes.reduce((s, sc) => s + sc.duration, 0);
  return (
    <>
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
      <SfxTrack sfx={(p.sfx ?? []).map((x) => holdSfx ? x : {...x, until: undefined})} />
      {p.music && <MusicTrack music={p.music} scenes={p.scenes} total={p.totalSeconds} />}
    </>
  );
};
