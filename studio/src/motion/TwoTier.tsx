// TwoTier: a light box on top, a slanted accent2 banner below, between two thin rules.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {BACK, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, pace, text, textFx, z, type MotionProps} from './schema';

export const TwoTierSchema = z.object({
  top: text('Dòng trên (ô sáng)'),
  bottom: text('Dòng dưới (băng xéo)'),
  size: numDefault('Cỡ chữ tối đa (px)', 69, {min: 30, max: 160, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'pop'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

export const TwoTier: React.FC<MotionProps<typeof TwoTierSchema>> = (p) => {
  const k = PACE[p.pace];
  const {step, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  const longer = p.top.length >= p.bottom.length ? p.top : p.bottom;
  const size = loaded ? fitFontSize({text: longer, maxSize: p.size, width: p.area.width * 0.85, height: p.area.height * 0.3, weight: 800, padX: 1.8, padY: 0.6}) : p.size;
  const botAt = 0.9;
  const botEnd = botAt + fxDuration('words', p.bottom, 1);
  const rule = (): React.CSSProperties => ({width: '46%', height: 2, background: c.surface, margin: '0 auto', transform: `scaleX(${step(0, 0.3)})`});
  return (
    <AbsoluteFill style={{fontFamily, fontWeight: 800, justifyContent: 'center'}}>
      <div style={{position: 'relative', textAlign: 'center', transform: `scale(${1 - 0.15 * outP})`, opacity: 1 - outP}}>
        <div style={rule()} />
        <div style={{margin: `${size * 0.3}px 0 0`}}>
          <div style={{position: 'relative', display: 'inline-block', background: c.surface, color: c.background, fontSize: size, lineHeight: 1.2, padding: '0.18em 0.9em',
            transform: `scaleY(${BACK(step(0.2, 0.28))})`}}>
            <FxText text={p.top} fx={p.fx} start={0.42 * k} k={k} />
            <Decor kind={p.decor} emoji={p.emoji} at={botEnd} k={k} size={size * 0.6} color={c.accent} />
          </div>
        </div>
        <div style={{display: 'block', background: c.accent2, color: c.text, fontSize: size * 0.87, lineHeight: 1.2, padding: '0.3em 1.1em',
          margin: `${size * 0.2}px ${p.area.width * 0.03}px ${size * 0.3}px`, transform: `translateX(${(step(0.65, 0.38) - 1) * 130}%) skewX(-14deg)`}}>
          <div style={{transform: 'skewX(14deg)'}}>
            <FxText text={p.bottom} fx="words" start={botAt * k} k={k} />
          </div>
        </div>
        <div style={rule()} />
      </div>
    </AbsoluteFill>
  );
};
