// TikTok-style captions: the whole chunk stays on screen, the spoken word pops and turns into an accent block.
// Word times: real token times (chunk.times) when present, else spread over the chunk by letter count.
import React from 'react';
import {AbsoluteFill, spring, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk} from '../types';
import {captionUnits} from './Captions';
import {useActiveChunk} from './useActiveChunk';

export const PopCaptions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; accent: string; ink: string; text: string}> = ({chunks, highlight, accent, ink, text}) => {
  const {fps, width, height} = useVideoConfig();
  const loaded = useFontsLoaded();
  const {c, t, pop: chunkIn} = useActiveChunk(chunks);
  if (!c) return null;
  const units = captionUnits(c.text, highlight);
  const weights = units.map((u) => u.text.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0, tok = 0;
  const starts = units.map((u, i) => {
    const real = c.times?.[tok];
    tok += u.text.split(/\s+/).filter(Boolean).length; // a unit can hold several words; times are per word
    const s = real ?? c.start + (acc / total) * (c.end - c.start);
    acc += weights[i];
    return s;
  });
  const active = starts.reduce((a, s, i) => (t >= s ? i : a), 0);
  const vertical = height > width;
  // On 9:16 vertical video, reserve TikTok's left (5%) and right (14%) UI columns so no active word lands under icons.
  const padL = vertical ? width * 0.06 : width * 0.06;
  const padR = vertical ? width * 0.15 : width * 0.06;
  const availW = width - padL - padR;
  const size = loaded ? fitFontSize({text: c.text, maxSize: 80, width: availW * 0.94, height: 80 * 1.3 * 2 + 1, weight: 800, lineHeight: 1.3}) : 70;
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.27, paddingLeft: padL, paddingRight: padR, boxSizing: 'border-box'}}>
      <div style={{fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.3, textAlign: 'center', maxWidth: '100%', textWrap: 'balance', opacity: Math.min(1, chunkIn * 3), transform: `translateY(${(1 - chunkIn) * 30}px)`}}>
        {units.map((u, i) => {
          const hit = spring({frame: Math.round((t - starts[i]) * fps), fps, config: {damping: 9, stiffness: 220}});
          const on = i === active;
          return (
            <React.Fragment key={i}>
              <span style={{
                display: 'inline-block', whiteSpace: 'nowrap', padding: '0 10px', borderRadius: 18, margin: '0 4px',
                background: on ? accent : 'transparent', color: on ? ink : u.mark ? accent : text,
                opacity: t >= starts[i] ? 1 : 0.45, transform: `scale(${on ? 1 + 0.08 * Math.min(1, hit) : 1}) rotate(${on ? -2 * (1 - Math.min(1, hit)) : 0}deg)`,
                textShadow: on ? 'none' : `0 5px 0 ${ink}d9, 0 0 22px rgba(0,0,0,.7)`, WebkitTextStroke: on ? undefined : `0.5px ${ink}99`,
              }}>{u.text}</span>{' '}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
