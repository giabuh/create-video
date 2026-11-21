// style: quick cuts, bold captions, accent overlays, logo top-left; the video-wide motion track draws on top
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Captions} from '../../components/Captions';
import {ReelFrame} from '../../components/ReelFrame';
import type {RenderProps} from '../../types';

export const FastCut: React.FC<RenderProps> = (p) => {
  const {colors} = p.brand;
  return (
    <ReelFrame p={p} logo
      captions={(sc) => <Captions chunks={sc.captions} highlight={sc.highlight} style={p.captions} boxColor={colors.background} />}
      empty={() => <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.primary}, ${colors.background})`}} />} />
  );
};
