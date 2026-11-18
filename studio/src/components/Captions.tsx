import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle} from '../types';

const norm = (w: string) => w.replace(/[.,!?;:"“”()]/g, '').toLowerCase();

// shortcut: heuristic glyph width (0.55em); switch to @remotion/layout-utils measureText if stills show overflow.
export const fitSize = (text: string, base: number, maxWidth: number, maxLines = 2): number => {
  const lines = text.length / (maxWidth / (base * 0.55));
  return lines <= maxLines ? base : Math.floor(base * Math.sqrt(maxLines / lines));
};

export const Captions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle}> = ({chunks, highlight, style}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const t = frame / fps;
  const c = chunks.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const pop = spring({frame: Math.round((t - c.start) * fps), fps, config: {damping: 14}});
  const marks = new Set(highlight.map(norm));
  return (
    // paddingBottom keeps captions above the Reels/TikTok bottom UI
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 380}}>
      <div style={{
        fontFamily, fontWeight: 800, fontSize: fitSize(c.text, style.size, width * 0.86), color: style.color,
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
