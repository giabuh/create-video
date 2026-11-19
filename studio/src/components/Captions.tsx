import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle} from '../types';

const norm = (w: string) => w.replace(/[.,!?;:"“”()]/g, '').toLowerCase();

export const Captions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle}> = ({chunks, highlight, style}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const t = frame / fps;
  const loaded = useFontsLoaded();
  const c = chunks.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  // measured with the real font: at most two lines at the configured size, shrunk if a chunk is longer
  const size = loaded ? fitFontSize({text: c.text, maxSize: style.size, width: width * 0.86, height: style.size * 1.15 * 2 + 1, weight: 800, lineHeight: 1.15}) : style.size;
  const pop = spring({frame: Math.round((t - c.start) * fps), fps, config: {damping: 14}});
  const marks = new Set(highlight.map(norm));
  return (
    // paddingBottom keeps captions above the Reels/TikTok bottom UI
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 380}}>
      <div style={{
        fontFamily, fontWeight: 800, fontSize: size, color: style.color,
        textAlign: 'center', maxWidth: '86%', lineHeight: 1.15, transform: `scale(${0.85 + 0.15 * pop})`,
        textShadow: '0 4px 18px rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.9)',
      }}>
        {c.text.split(' ').map((w, i) => (
          <span key={i} style={marks.has(norm(w)) ? {color: style.highlightColor} : undefined}>{w} </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
