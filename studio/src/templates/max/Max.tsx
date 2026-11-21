// style: "max" — mixed scene transitions, light leaks, graded footage, grain + vignette + progress bar, pop captions, 3D logo CTA
import React from 'react';
import {Sequence, useVideoConfig} from 'remotion';
import {CtaCard3D} from '../../components/CtaCard3D';
import {Look} from '../../components/Look';
import {PopCaptions} from '../../components/PopCaptions';
import {Leak, ReelFrame} from '../../components/ReelFrame';
import type {RenderProps} from '../../types';

export const Max: React.FC<RenderProps> = (p) => {
  const {fps} = useVideoConfig();
  const {colors} = p.brand;
  const ctaStart = p.scenes.reduce((s, sc) => s + sc.duration, 0);
  return (
    <ReelFrame p={p} logo={p.look?.logo ?? true}
      captions={(sc) => <PopCaptions chunks={sc.captions} highlight={sc.highlight} accent={colors.accent} ink={colors.background} text={colors.text} />}
      empty={() => null}
      renderCta={(a) => <CtaCard3D {...a} />}>
      {p.cta && (
        <Sequence name="light-leak cta" from={Math.max(0, Math.round(ctaStart * fps) - 10)} durationInFrames={34}>
          <Leak seed={7} hueShift={40} />
        </Sequence>
      )}
      <Look grain={p.look?.grain ?? 0} scanlines={p.look?.scanlines ?? 0} vignette={p.look?.vignette} progress={p.look?.progress} accent={colors.accent} ctaStart={ctaStart} />
    </ReelFrame>
  );
};
