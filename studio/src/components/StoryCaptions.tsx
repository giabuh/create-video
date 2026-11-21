import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {widthOf, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle, MotionItem} from '../types';
import {captionUnits} from './Captions';

const LH = 1.15;
const FADE = 0.18;

// a layer that sits in the middle of the frame takes the card's place
const centered = (m: MotionItem) =>
  m.position === 'center' || m.position === 'full' ||
  (m.position === 'free' && !!m.box && m.box.y + m.box.h / 2 >= 100 / 3 && m.box.y + m.box.h / 2 <= 200 / 3);

const lineCount = (text: string, size: number, avail: number): number => {
  let n = 1, line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (!line || widthOf(next, size, 800) <= avail) line = next; else { n += 1; line = w; }
  }
  return n;
};

export const StoryCaptions: React.FC<{
  chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle; dark: boolean;
  footage?: boolean; motion?: MotionItem[];
}> = ({chunks, highlight, style, dark, footage = false, motion = []}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const loaded = useFontsLoaded();
  const avail = width * 0.84, maxH = height * 0.48;
  // one size for the whole scene: the longest chunk fits in 3 lines inside the safe area
  const size = useMemo(() => {
    const max = Math.round(style.size * 1.6);
    if (!loaded) return max;
    const longest = chunks.reduce((a, c) => (c.text.length > a.length ? c.text : a), '');
    let s = max;
    while (s > 24 && (lineCount(longest, s, avail) > 3 || lineCount(longest, s, avail) * s * LH > maxH)) s -= 2;
    return s;
  }, [chunks, style.size, loaded, avail, maxH]);
  const c = chunks.find((x) => t >= x.start && t < x.end);
  if (!c || motion.some((m) => centered(m) && t >= m.start && t < m.start + m.duration)) return null;
  const units = captionUnits(c.text, highlight);
  const nTok = c.text.split(' ').filter(Boolean).length;
  let tok = 0;
  const color = dark || footage ? '#F7F7F5' : '#111114';
  return (
    <AbsoluteFill>
      {footage && <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 32% at 50% 46%, rgba(0,0,0,.55), rgba(0,0,0,0) 100%)'}} />}
      <div style={{position: 'absolute', left: '8%', right: '8%', top: '22%', height: '48%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{
          fontFamily, fontWeight: 800, fontSize: size, lineHeight: LH, color, textAlign: 'center', textWrap: 'balance',
          ...(footage ? {textShadow: '0 4px 24px rgba(0,0,0,.85)'} : {}),
        }}>
          {units.map((u, i) => {
            // each word starts at its own token time; with no times the chunk is spread evenly over 80% of its length
            const at = c.times?.[tok] ?? c.start + ((c.end - c.start) * 0.8 * tok) / Math.max(1, nTok);
            tok += u.text.split(' ').length;
            const a = Math.min(1, Math.max(0, (t - at) / FADE));
            return (
              <React.Fragment key={i}>
                <span style={{display: 'inline-block', whiteSpace: 'nowrap', opacity: a, transform: `translateY(${6 * (1 - a)}px)`, ...(u.mark ? {color: style.highlightColor} : {})}}>{u.text}</span>{' '}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
