// white rounded caption card; sized from the shorter side so it fits 9:16 and 16:9
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {captionUnits} from '../../components/Captions';
import {useActiveChunk} from '../../components/useActiveChunk';
import {fitFontSize, useFontsLoaded} from '../../fit';
import {fontFamily} from '../../fonts';
import type {Brand, CaptionChunk, CaptionStyle} from '../../types';

export const ExplainerCaptions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle; colors: Brand['colors']}> = ({chunks, highlight, style, colors}) => {
  const {width, height} = useVideoConfig();
  const loaded = useFontsLoaded();
  const {c, pop} = useActiveChunk(chunks);
  if (!c) return null;
  const u = Math.min(width, height);
  const cardW = Math.min(width * 0.88, u * 1.5), pad = u * 0.03;
  const max = u * 0.06;
  const size = loaded ? fitFontSize({text: c.text, maxSize: max, width: cardW - pad * 2, height: max * 1.3 * 2 + 1, weight: 800, lineHeight: 1.3}) : max * 0.8;
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (width > height ? 0.09 : 0.17)}}>
      <div style={{
        fontFamily, fontWeight: 800, fontSize: size, lineHeight: 1.3, textAlign: 'center', textWrap: 'balance', maxWidth: cardW, boxSizing: 'border-box',
        color: colors.primary, // the card is always white, so brand primary (dark) reads on it background: 'rgba(255,255,255,.94)', padding: `${pad * 0.6}px ${pad}px`, borderRadius: u * 0.035,
        boxShadow: '0 12px 40px rgba(11,21,48,.22)', opacity: Math.min(1, pop * 3), transform: `scale(${0.9 + 0.1 * pop})`,
      }}>
        {captionUnits(c.text, highlight).map((x, i) => (
          <React.Fragment key={i}>
            <span style={{whiteSpace: 'nowrap', ...(x.mark ? {color: colors.accent2 ?? colors.accent, background: `${colors.accent}55`, borderRadius: u * 0.01, padding: '0 0.15em'} : {})}}>{x.text}</span>{' '}
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};
