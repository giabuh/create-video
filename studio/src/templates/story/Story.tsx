// style: narrated story/explainer — text-card captions revealed word by word, flat light/dark cards, grain + scan-line look
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Look} from '../../components/Look';
import {ReelFrame} from '../../components/ReelFrame';
import {StoryCaptions} from '../../components/StoryCaptions';
import {isCard} from '../../components/storyLayout';
import type {RenderProps} from '../../types';

export const Story: React.FC<RenderProps> = (p) => (
  <ReelFrame p={p} logo={p.look?.logo ?? false} ctaCenter
    captions={(sc) => <StoryCaptions chunks={sc.captions} highlight={sc.highlight} punch={sc.punch} style={p.captions}
      dark={(sc.bg ?? 'dark') === 'dark'} footage={sc.media.length > 0} media={sc.media.filter((m) => isCard(m, p.look))} motion={[...sc.motion, ...(p.overlays ?? []).map((m) => ({...m, start: m.start - sc.start}))]} />}
    empty={(sc) => <AbsoluteFill style={{backgroundColor: (sc.bg ?? 'dark') === 'dark' ? '#0B0B0F' : '#F3EFE6'}} />}>
    <Look grain={p.look?.grain ?? 0} scanlines={p.look?.scanlines ?? 0} />
  </ReelFrame>
);
