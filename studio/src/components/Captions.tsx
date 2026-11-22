import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle} from '../types';
import {useActiveChunk} from './useActiveChunk';

const norm = (w: string) => w.replace(/[.,!?;:"“”()]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Words to draw, each unbreakable: a highlight phrase ("0876 929 145", "khai giảng") or a digit run stays on one line.
const SPLIT_RE = new Map<string, RegExp>(); // split() ignores lastIndex, so a shared RegExp is safe
export const captionUnits = (text: string, highlight: string[]): {text: string; mark: boolean}[] => {
  const phrases = highlight.filter((h) => h.trim()).sort((a, b) => b.length - a.length).map(esc);
  const src = `((?:${[...phrases, '\\d+(?: \\d+)+'].join('|')})\\S*)`;
  let re = SPLIT_RE.get(src);
  if (!re) { if (SPLIT_RE.size > 200) SPLIT_RE.clear(); SPLIT_RE.set(src, re = new RegExp(src, 'giu')); }
  const marks = new Set(highlight.map(norm));
  return text.split(re).flatMap((part, i) =>
    i % 2 ? [{text: part, mark: marks.has(norm(part))}] : part.split(' ').filter(Boolean).map((w) => ({text: w, mark: marks.has(norm(w))})),
  );
};

export const Captions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle; boxColor?: string}> = ({chunks, highlight, style, boxColor}) => {
  const {width, height} = useVideoConfig();
  const loaded = useFontsLoaded();
  const boxed = !!style.box && !!boxColor;
  const {c, pop} = useActiveChunk(chunks);
  if (!c) return null;
  // measured with the real font: at most two lines at the configured size, shrunk if a chunk is longer
  const size = loaded ? fitFontSize({text: c.text, maxSize: style.size, width: width * 0.86 - (boxed ? 60 : 0), height: style.size * 1.15 * 2 + 1, weight: 800, lineHeight: 1.15}) : style.size;
  return (
    // paddingBottom keeps captions above the Reels/TikTok bottom UI (380px on a 1920-tall frame)
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.2}}>
      <div style={{
        fontFamily, fontWeight: 800, fontSize: size, color: style.color,
        textAlign: 'center', maxWidth: '86%', textWrap: 'balance', lineHeight: boxed ? 1.65 : 1.15, transform: `scale(${0.85 + 0.15 * pop})`,
        ...(boxed ? {} : {textShadow: '0 4px 18px rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.9)'}),
      }}>
        <span style={boxed ? {background: boxColor, padding: '18px 30px', borderRadius: 12, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'} : undefined}>
          {captionUnits(c.text, highlight).map((u, i) => (
            <React.Fragment key={i}>
              <span style={{whiteSpace: 'nowrap', ...(u.mark ? {color: style.highlightColor} : {})}}>{u.text}</span>{' '}
            </React.Fragment>
          ))}
        </span>
      </div>
    </AbsoluteFill>
  );
};
