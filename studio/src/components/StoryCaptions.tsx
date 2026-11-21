import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {widthOf, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle, MotionItem} from '../types';
import {captionUnits} from './Captions';
import {cardCovered} from './storyLayout';

const LH = 1.15;
const FADE = 0.18;

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
  const c = chunks.find((x) => t >= x.start && t < x.end);
  // largest size at which this chunk fits 3 lines in the safe area, capped: 200 px on a text card, 130 px over footage
  const fit = useMemo(() => {
    const text = c?.text ?? '';
    const cap = footage ? 130 : 200;
    let s = loaded ? cap : Math.round(style.size * (footage ? 1.2 : 1.6));
    while (loaded && s > 24 && (lineCount(text, s, avail) > 3 || lineCount(text, s, avail) * s * LH > maxH)) s -= 2;
    return {size: s, h: loaded ? lineCount(text, s, avail) * s * LH : maxH};
  }, [c?.text, footage, style.size, loaded, avail, maxH]);
  const size = fit.size;
  if (!c || cardCovered(motion, t, fit.h, height)) return null;
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
