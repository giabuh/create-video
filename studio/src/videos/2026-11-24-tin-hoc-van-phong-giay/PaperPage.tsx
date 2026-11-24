// PaperPage: full-frame paper canvas for pure-motion scenes: serif title + tape-look tag slide in, mono footer, crop marks.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {PaperCanvas} from '../../paper/PaperCanvas';
import {Chip, PAPER, Tape, Title} from '../../paper/paper';
import {optText, text, z, type MotionProps} from '../../motion/schema';

export {PaperCanvas};

export const PaperPageSchema = z.object({
  title: text('Tiêu đề').default('Excel'),
  tag: optText('Nhãn cạnh tiêu đề'),
  footer: optText('Chân trang'),
  chip: optText('Nhãn nhỏ dưới tiêu đề (VD: Minh họa)'),
});

export const PaperPage: React.FC<MotionProps<typeof PaperPageSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {width, height} = p.area;
  const u = Math.min(width, height);
  const t = frame / fps;
  const inP = interpolate(t, [0, 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const outP = interpolate(t, [p.layerSeconds - 0.25, p.layerSeconds], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const m = u * 0.035;
  return (
    <AbsoluteFill>
      <PaperCanvas width={width} height={height} />
      <AbsoluteFill style={{opacity: outP}}>
        <div style={{position: 'absolute', left: u * 0.07, top: u * 0.07, display: 'flex', flexDirection: 'column', gap: u * 0.015, alignItems: 'flex-start',
          opacity: inP, transform: `translateX(${(1 - inP) * -u * 0.08}px)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: u * 0.025}}>
            <Title u={u} size={u * 0.055}>{p.title}</Title>
            {p.tag && (
              <div style={{position: 'relative'}}>
                <Chip u={u} color={PAPER.ink} size={u * 0.022}>{p.tag}</Chip>
                <Tape u={u} style={{top: -u * 0.012, right: -u * 0.02, width: u * 0.04, height: u * 0.014}} />
              </div>
            )}
          </div>
          {p.chip && <Chip u={u} size={u * 0.02}>{p.chip}</Chip>}
        </div>
        {p.footer && (
          <div style={{position: 'absolute', left: m + u * 0.04, bottom: m + u * 0.006, fontFamily: PAPER.mono, fontWeight: 700, fontSize: u * 0.02,
            lineHeight: 1.25, letterSpacing: '0.06em', color: PAPER.muted, textTransform: 'uppercase'}}>{p.footer}</div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
