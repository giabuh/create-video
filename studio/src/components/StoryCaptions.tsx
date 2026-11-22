import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {widthOf, useFontsLoaded} from '../fit';
import {fontFamily, serifFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle, MediaItem, MotionItem} from '../types';
import {captionUnits} from './Captions';
import {cardSlot, collageSpan, findPunch, mediaCardRect} from './storyLayout';

const NO_PUNCH: string[] = []; // stable default so the memo on `punch` holds
const LH = 1.15;
const FADE = 0.18;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// `words` are the unbreakable units (a highlighted phrase is one nowrap span), so a phrase wider than a line shrinks the size.
const lineCount = (words: string[], size: number, avail: number, family: string): number => {
  let n = 1, line = '';
  for (const w of words) {
    if (widthOf(w, size, 800, family) > avail) return Infinity;
    const next = line ? `${line} ${w}` : w;
    if (!line || widthOf(next, size, 800, family) <= avail) line = next; else { n += 1; line = w; }
  }
  return n;
};

export const StoryCaptions: React.FC<{
  chunks: CaptionChunk[]; highlight: string[]; punch?: string[]; style: CaptionStyle; dark: boolean;
  footage?: boolean; motion?: MotionItem[]; media?: MediaItem[]; collage?: boolean; // media = the scene's framed (card) items
}> = ({chunks, highlight, punch = NO_PUNCH, style, dark, footage = false, motion = [], media = [], collage = false}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const loaded = useFontsLoaded();
  const serif = style.font === 'serif';
  const family = serif ? serifFamily : fontFamily;
  // the current framed picture is an obstacle like a full-width box layer, grown by its 1.06 push-in about y 0.40
  // collage: all items from their start to the scene end; obstacle = bounding box of the visible cards
  const m = collage ? undefined : media.find((x) => t >= x.start && t < x.start + x.duration);
  const r = collage ? collageSpan(media, t, width, height) : m && mediaCardRect(m.aspect ?? 1, width, height);
  const free = cardSlot(r ? [...motion, {position: 'free', box: {x: 0, y: (collage ? r.top : 0.4 - (0.4 - r.top) * 1.06) * 100, w: 100, h: (r.bottom - r.top) * (collage ? 1 : 1.06) * 100}, start: 0, duration: Infinity}] : motion, t);
  // no room beside a tall card (portrait clips): sit over the card's lower part, like the reference, shadowed as over footage
  const over = r && (!free || free.bottom - free.top < 0.12) ? cardSlot(motion, t, [Math.max(0.22, r.bottom - 0.22), Math.min(0.7, r.bottom - 0.02)]) : null;
  const slot = over ?? free;
  const avail = width * 0.77, slotH = slot ? (slot.bottom - slot.top) * height : 0, maxH = Math.min(height * 0.48, slotH); // 77% = safe area x 8-85%
  const c = chunks.find((x) => t >= x.start && t < x.end);
  // text splits depend on the active chunk only, not on the frame
  const {toks, pn, giantText, leadIdx, units} = useMemo(() => {
    const toks = c ? c.text.split(' ').filter(Boolean) : [];
    const pn = c ? findPunch(c.text, punch) : null;
    const giantText = pn ? toks.slice(pn.from, pn.from + pn.len).join(' ') : '';
    const leadIdx = toks.map((_, i) => i).filter((i) => !pn || i < pn.from || i >= pn.from + pn.len);
    const leadText = leadIdx.map((i) => toks[i]).join(' ');
    return {toks, pn, giantText, leadIdx, units: captionUnits(leadText, highlight)};
  }, [c, punch, highlight]);
  // lead: largest size fitting 3 lines in the free slot (2 lines, at most 40% of it, above a giant line), capped 96 px on a text card, 72 px over footage
  // giant: one line, up to 420 px, in what the lead leaves
  const fit = useMemo(() => {
    const words = units.map((u) => u.text);
    const cap = footage ? 72 : 96, lines = pn ? 2 : 3, hMax = pn ? maxH * 0.4 : maxH;
    let s = loaded ? cap : Math.round(style.size * (footage ? 1.1 : 1.5));
    while (loaded && words.length && s > 24 && (lineCount(words, s, avail, family) > lines || lineCount(words, s, avail, family) * s * LH > hMax)) s -= 2;
    const leadH = words.length ? lineCount(words, s, avail, family) * s * LH : 0;
    let g = 420;
    while (loaded && pn && g > 24 && (widthOf(giantText, g, 800, family) > avail || g * LH + leadH > maxH)) g -= 4;
    return {size: s, giant: pn ? g : 0};
  }, [units, giantText, footage, style.size, loaded, avail, maxH, family, pn]);
  if (!c || !slot || (pn ? fit.giant : fit.size) < 40) return null; // no free slot, or text too small to read
  const nTok = toks.length;
  const timeOf = (i: number) => c.times?.[i] ?? c.start + ((c.end - c.start) * 0.8 * i) / Math.max(1, nTok);
  let tok = 0;
  const mid = ((slot.top + slot.bottom) / 2) * 100;
  const color = dark || footage ? '#F7F7F5' : '#111114';
  const face = {fontFamily: family, fontWeight: serif ? 700 : 800, ...(serif ? {fontStyle: 'italic' as const} : {})};
  const p = pn ? clamp01((t - timeOf(pn.from)) / 0.2) : 0;
  return (
    <AbsoluteFill>
      {footage && <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 32% at 50% ${mid}%, rgba(0,0,0,.55), rgba(0,0,0,0) 100%)`}} />}
      <div style={{position: 'absolute', left: '8%', right: '15%', top: `${slot.top * 100}%`, height: `${(slot.bottom - slot.top) * 100}%`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color, textAlign: 'center', ...(footage ? {textShadow: '0 4px 24px rgba(0,0,0,.85)'} : {})}}>
        {units.length > 0 && <div style={{...face, fontSize: fit.size, lineHeight: LH, textWrap: 'balance'}}>
          {units.map((u, i) => {
            // each word starts at its own token time; with no times the chunk is spread evenly over 80% of its length
            const at = timeOf(leadIdx[tok]);
            tok += u.text.split(' ').length;
            const a = clamp01((t - at) / FADE);
            return (
              <React.Fragment key={i}>
                <span style={{display: 'inline-block', whiteSpace: 'nowrap', opacity: a, transform: `translateY(${6 * (1 - a)}px)`, ...(u.mark ? {color: style.highlightColor} : {})}}>{u.text}</span>{' '}
              </React.Fragment>
            );
          })}
        </div>}
        {pn && <div style={{...face, fontWeight: 800, fontSize: fit.giant, lineHeight: LH, whiteSpace: 'nowrap', opacity: p > 0 ? 1 : 0,
          transform: `scale(${1.15 - 0.15 * p})`, filter: `blur(${12 * (1 - p)}px)`}}>{giantText}</div>}
      </div>
    </AbsoluteFill>
  );
};
