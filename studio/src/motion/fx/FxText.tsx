// Renders text with one of the TEXT_FX effects. Words never break inside (nowrap inline-blocks); lines from '\n'.
// Hidden units keep their space (opacity 0), so the layout never jumps while the text appears.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {fxDuration, fxUnit, splitUnits, unitStyle, type TextFx} from './textFx';

export const FxText: React.FC<{
  text: string; fx: TextFx; start?: number; k?: number; seed?: number; strokeColor?: string; style?: React.CSSProperties;
}> = ({text, fx, start = 0, k = 1, seed = 0, strokeColor, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps - start;
  const lines = splitUnits(text);
  const words = lines.flat();
  const n = fxUnit(fx) === 'word' ? words.length : words.reduce((a, w) => a + w.length, 0);
  let unit = 0;
  const st = (i: number) => unitStyle(fx, i, n, t, k, seed);
  const caretOn = fx === 'typewriter' && t >= 0 && t < fxDuration(fx, text, k) + 0.7 * k && Math.floor(t / 0.25) % 2 === 0;
  const wave: React.CSSProperties = fx === 'wave'
    ? {display: 'inline-block', fontStyle: 'italic', transform: 'rotate(-5deg) skewX(-6deg)',
      ...(strokeColor && {WebkitTextStroke: `0.05em ${strokeColor}`, paintOrder: 'stroke fill'})}
    : {};
  return (
    <span style={{...wave, ...style}}>
      {lines.map((line, li) => (
        <span key={li} style={{display: lines.length > 1 ? 'block' : 'inline'}}>
          {line.map((word, wi) => {
            const sep = wi < line.length - 1 ? ' ' : '';
            if (fxUnit(fx) === 'word') {
              const s = st(unit++);
              return fx === 'mask'
                ? <React.Fragment key={wi}><span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0 0.02em'}}>
                    <span style={{display: 'inline-block', transform: s.transform}}>{word.join('')}</span></span>{sep}</React.Fragment>
                : <React.Fragment key={wi}><span style={{display: 'inline-block', whiteSpace: 'nowrap', ...s}}>{word.join('')}</span>{sep}</React.Fragment>;
            }
            return (
              <React.Fragment key={wi}>
                <span style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                  {word.map((g, gi) => <span key={gi} style={{display: 'inline-block', whiteSpace: 'pre', ...st(unit++)}}>{g}</span>)}
                </span>{sep}
              </React.Fragment>
            );
          })}
          {li === lines.length - 1 && fx === 'typewriter' &&
            <span style={{display: 'inline-block', width: '0.08em', height: '1em', marginLeft: '0.06em', verticalAlign: '-0.12em',
              background: 'currentColor', opacity: caretOn ? 1 : 0}} />}
        </span>
      ))}
    </span>
  );
};
