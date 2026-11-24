// style: calm light brand canvas, footage first with motion explaining on top; size-aware captions, CTA and logo (9:16 and 16:9)
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useVideoConfig} from 'remotion';
import {PaperCanvas} from '../../paper/PaperCanvas';
import {PAPER, paperDims} from '../../paper/paper';
import {ReelFrame} from '../../components/ReelFrame';
import type {RenderProps} from '../../types';
import {ExplainerCaptions} from './ExplainerCaptions';
import {ExplainerCta} from './ExplainerCta';

export const Explainer: React.FC<RenderProps> = (p) => {
  const {width, height, fps} = useVideoConfig();
  const u = Math.min(width, height); // design unit: the shorter side
  const {colors} = p.brand;
  const paper = p.look?.style === 'paper';
  const showLogo = (p.look?.logo ?? true) && p.brand.logo;
  return (
    // logo drawn here (ReelFrame's own logo is fixed-px for a vertical frame)
    <ReelFrame p={p} logo={false}
      captions={(sc) => <ExplainerCaptions chunks={sc.captions} highlight={sc.highlight} style={p.captions} colors={colors} paper={paper} />}
      empty={() => paper ? <PaperCanvas width={width} height={height} /> : <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.background}, ${colors.surface ?? '#FFFFFF'})`}} />}
      renderCta={(a) => <ExplainerCta {...a} paper={paper} />}>
      {showLogo && (
        // paper CTA card carries its own logo, so the plate stops where the CTA starts
        <Sequence durationInFrames={paper && p.cta ? Math.max(1, Math.round((p.totalSeconds - p.cta.duration) * fps)) : Infinity} layout="none">
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          <div style={paper
            ? {position: 'absolute', top: u * 0.06, right: u * 0.06, padding: u * 0.012, borderRadius: paperDims(u).radius, background: PAPER.card, border: `${paperDims(u).line}px solid ${PAPER.ink}`, boxShadow: `${paperDims(u).shadow}px ${paperDims(u).shadow}px 0 ${PAPER.ink}`}
            : {position: 'absolute', top: u * 0.04, left: u * 0.04, padding: u * 0.015, borderRadius: u * 0.03, background: 'rgba(255,255,255,.88)', boxShadow: '0 8px 28px rgba(11,21,48,.16)'}}>
            <Img src={staticFile(p.brand.logo as string)} style={{display: 'block', height: u * 0.07, maxWidth: u * 0.3, objectFit: 'contain'}} />
          </div>
        </AbsoluteFill>
        </Sequence>
      )}
    </ReelFrame>
  );
};
