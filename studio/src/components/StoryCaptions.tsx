import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {widthOf, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle, MotionItem} from '../types';
import {captionUnits} from './Captions';
import {cardSlot} from './storyLayout';

const LH = 1.15;
const FADE = 0.18;

// `words` are the unbreakable units (a highlighted phrase is one nowrap span), so a phrase wider than a line shrinks the size.
const lineCount = (words: string[], size: number, avail: number): number => {
  let n = 1, line = '';
  for (const w of words) {
    if (widthOf(w, size, 800) > avail) return Infinity;
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
  const slot = cardSlot(motion, t);
  const avail = width * 0.84, slotH = slot ? (slot.bottom - slot.top) * height : 0, maxH = Math.min(height * 0.48, slotH);
  const c = chunks.find((x) => t >= x.start && t < x.end);
  // largest size at which this chunk fits 3 lines in the free slot, capped: 200 px on a text card, 130 px over footage
  const fit = useMemo(() => {
    const words = captionUnits(c?.text ?? '', highlight).map((u) => u.text);
    const cap = footage ? 130 : 200;
    let s = loaded ? cap : Math.round(style.size * (footage ? 1.2 : 1.6));
    while (loaded && s > 24 && (lineCount(words, s, avail) > 3 || lineCount(words, s, avail) * s * LH > maxH)) s -= 2;
    return {size: s};
  }, [c?.text, highlight, footage, style.size, loaded, avail, maxH]);
  const size = fit.size;
  if (!c || !slot || size < 40) return null; // no free slot, or text too small to read
  const units = captionUnits(c.text, highlight);
  const nTok = c.text.split(' ').filter(Boolean).length;
  let tok = 0;
  const mid = ((slot.top + slot.bottom) / 2) * 100;
  const color = dark || footage ? '#F7F7F5' : '#111114';
  return (
    <AbsoluteFill>
      {footage && <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 32% at 50% ${mid}%, rgba(0,0,0,.55), rgba(0,0,0,0) 100%)`}} />}
      <div style={{position: 'absolute', left: '8%', right: '8%', top: `${slot.top * 100}%`, height: `${(slot.bottom - slot.top) * 100}%`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
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
