// TikTok-style captions: the whole chunk stays on screen, the spoken word pops and turns into an accent block.
// Word times: real token times (chunk.times) when present, else spread over the chunk by letter count.
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk} from '../types';
import {captionUnits} from './Captions';

export const PopCaptions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; accent: string; ink: string; text: string}> = ({chunks, highlight, accent, ink, text}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const c = chunks.find((x) => t >= x.start && t < x.end);
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
  const size = loaded ? fitFontSize({text: c.text, maxSize: 82, width: width * 0.84, height: 82 * 1.3 * 2 + 1, weight: 800, lineHeight: 1.3}) : 72;
  const chunkIn = spring({frame: Math.round((t - c.start) * fps), fps, config: {damping: 14}});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.2}}>
      <div style={{fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.3, textAlign: 'center', maxWidth: '88%', textWrap: 'balance', opacity: Math.min(1, chunkIn * 3), transform: `translateY(${(1 - chunkIn) * 30}px)`}}>
        {units.map((u, i) => {
          const hit = spring({frame: Math.round((t - starts[i]) * fps), fps, config: {damping: 9, stiffness: 220}});
          const on = i === active;
          return (
            <React.Fragment key={i}>
              <span style={{
                display: 'inline-block', whiteSpace: 'nowrap', padding: '0 10px', borderRadius: 18, margin: '0 -2px',
                background: on ? accent : 'transparent', color: on ? ink : u.mark ? accent : text,
                opacity: t >= starts[i] ? 1 : 0.45, transform: `scale(${on ? 1 + 0.16 * Math.min(1, hit) : 1}) rotate(${on ? -2 * (1 - Math.min(1, hit)) : 0}deg)`,
                textShadow: on ? 'none' : `0 5px 0 ${ink}d9, 0 0 22px rgba(0,0,0,.7)`, WebkitTextStroke: on ? undefined : `0.5px ${ink}99`,
              }}>{u.text}</span>{' '}
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
