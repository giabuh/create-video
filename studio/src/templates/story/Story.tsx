// style: narrated story/explainer — text-card captions revealed word by word, flat light/dark cards, grain + scan-line look
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Look} from '../../components/Look';
import {ReelFrame} from '../../components/ReelFrame';
import {StoryCaptions} from '../../components/StoryCaptions';
import type {RenderProps} from '../../types';

export const Story: React.FC<RenderProps> = (p) => (
  <ReelFrame p={p} logo={p.look?.logo ?? false}
    captions={(sc) => <StoryCaptions chunks={sc.captions} highlight={sc.highlight} style={p.captions}
      dark={(sc.bg ?? 'dark') === 'dark'} footage={sc.media.length > 0} motion={sc.motion} />}
    empty={(sc) => <AbsoluteFill style={{backgroundColor: (sc.bg ?? 'dark') === 'dark' ? '#0B0B0F' : '#F3EFE6'}} />}>
    <Look grain={p.look?.grain ?? 0} scanlines={p.look?.scanlines ?? 0} />
  </ReelFrame>
);
