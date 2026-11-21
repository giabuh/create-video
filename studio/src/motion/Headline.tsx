import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily, serifFamily} from '../fonts';
import {fitFontSize, useFontsLoaded} from '../fit';
import {choice, lines, optText, text, z, type MotionProps} from './schema';

export const HeadlineSchema = z.object({
  kicker: optText('Dòng trên (chuyên mục)'),
  headline: text('Tiêu đề'),
  mark: lines('Cụm từ tô nổi (mỗi dòng một cụm, nằm trong tiêu đề)').optional(),
  bg: choice('Nền', ['dark', 'light'], 'dark', {dark: 'Tối', light: 'Sáng'}),
  source: text('Nguồn'),
});

const SWEEP = 0.35; // seconds for one marker to grow left -> right
const STAGGER = 0.25; // seconds between markers
const APPEAR = 0.5; // headline fades/slides in, markers start after

/** Split the headline into plain / marked pieces; a phrase is marked at its first free occurrence, unknown phrases are ignored. */
export const splitMarks = (headline: string, marks: string[] = []): Array<{t: string; m: number | null}> => {
  const hits: Array<{s: number; e: number; m: number}> = [];
  marks.forEach((phrase, m) => {
    const s = phrase ? headline.indexOf(phrase) : -1;
    if (s >= 0 && !hits.some((h) => s < h.e && s + phrase.length > h.s)) hits.push({s, e: s + phrase.length, m});
  });
  hits.sort((a, b) => a.s - b.s);
  const out: Array<{t: string; m: number | null}> = [];
  let at = 0;
  for (const h of hits) {
    if (h.s > at) out.push({t: headline.slice(at, h.s), m: null});
    out.push({t: headline.slice(h.s, h.e), m: h.m});
    at = h.e;
  }
  if (at < headline.length) out.push({t: headline.slice(at), m: null});
  return out;
};

/** Drawing component: own newspaper-style headline card (serif italic, marker sweeps). */
export const Headline: React.FC<MotionProps<typeof HeadlineSchema>> = ({kicker, headline, mark, bg, source, brand, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ready = useFontsLoaded();
  const dark = bg === 'dark';
  const ink = dark ? '#FFFFFF' : '#14110F';
  const cardW = Math.min(area.width - 80, 960);
  const innerW = cardW - 2 * 56;
  const size = ready ? fitFontSize({text: headline, width: innerW * 0.95, height: Math.max(200, area.height * 0.5), maxSize: 96, weight: 800, lineHeight: 1.18, minSize: 36, family: serifFamily}) : 80;
  const appear = interpolate(frame, [0, APPEAR * fps], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const pieces = splitMarks(headline, mark);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width: cardW, boxSizing: 'border-box', padding: '48px 56px 36px', borderRadius: 12, background: dark ? '#14110F' : '#F6F1E7',
        color: ink, boxShadow: '0 20px 60px rgba(0,0,0,.45)', opacity: appear, transform: `translateY(${(1 - appear) * 30}px)`}}>
        {kicker && <div style={{fontWeight: 800, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: brand.colors.accent2, marginBottom: 20}}>{kicker}</div>}
        <div style={{fontFamily: serifFamily, fontStyle: 'italic', fontWeight: 800, fontSize: size, lineHeight: 1.18}}>
          {pieces.map((p, i) => {
            if (p.m === null) return <span key={i}>{p.t}</span>;
            const w = interpolate(frame, [(APPEAR + p.m * STAGGER) * fps, (APPEAR + p.m * STAGGER + SWEEP) * fps], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
            return (
              <span key={i} style={{backgroundImage: `linear-gradient(${brand.colors.accent2}, ${brand.colors.accent2})`, backgroundRepeat: 'no-repeat', backgroundSize: `${w}% 100%`,
                color: w >= 50 ? '#FFFFFF' : ink, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '0 0.12em'}}>{p.t}</span>
            );
          })}
        </div>
        <div style={{marginTop: 28, fontSize: 26, opacity: 0.7}}>Nguồn: {source}</div>
      </div>
    </AbsoluteFill>
  );
};
