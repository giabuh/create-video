// Ribbon: an accent2 bar with a slanted end and a folded white tail; the title types in; an optional sub line with a dot.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {BACK, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, optText, pace, text, textFx, z, type MotionProps} from './schema';

export const RibbonSchema = z.object({
  title: text('Chữ chính'),
  sub: optText('Dòng phụ (có chấm vàng)'),
  size: numDefault('Cỡ chữ tối đa (px)', 72, {min: 30, max: 160, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'typewriter'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

export const Ribbon: React.FC<MotionProps<typeof RibbonSchema>> = (p) => {
  const k = PACE[p.pace];
  const {step, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  const w = p.area.width * 0.88;
  const size = loaded ? fitFontSize({text: p.title, maxSize: p.size, width: w, height: p.area.height * 0.55, weight: 800, padX: 1.2, padY: 0.32}) : p.size;
  const textAt = 0.52;
  const subAt = textAt + fxDuration(p.fx, p.title, 1);
  const subEnd = subAt + 0.15 + (p.sub ? fxDuration('words', p.sub, 1) : 0);
  const out = (a: number, b: number) => Math.min(1, Math.max(0, (outP - a) / (b - a))); // sub leaves first, then the bar
  return (
    <AbsoluteFill style={{fontFamily, fontWeight: 800, justifyContent: 'center'}}>
      <div style={{position: 'relative', marginLeft: p.area.width * 0.06, width: 'fit-content', maxWidth: w}}>
        <div style={{position: 'relative', background: c.accent2, color: c.text, fontSize: size, lineHeight: 1.2,
          padding: `${size * 0.32}px ${size * 0.7}px ${size * 0.32}px ${size * 0.5}px`,
          clipPath: `polygon(0 0, 100% 0, calc(100% - ${size * 0.8}px) 100%, 0 100%)`,
          transformOrigin: 'left', transform: `scaleX(${step(0, 0.32) * (1 - out(0.4, 1))})`}}>
          <FxText text={p.title} fx={p.fx} start={textAt * k} k={k} />
        </div>
        <div style={{position: 'absolute', right: size * 1.4, top: '100%', width: 0, height: 0,
          borderLeft: `${size * 0.55}px solid transparent`, borderRight: `${size * 0.55}px solid transparent`, borderTop: `${size * 0.6}px solid ${c.surface}`,
          opacity: step(0.32, 0.3) * (1 - out(0.3, 0.6)), transform: `translateY(${(1 - BACK(step(0.32, 0.3, (x) => x))) * -120}%)`}} />
        {p.sub && (
          <div style={{margin: `${size * 0.55}px 0 0 ${size * 0.9}px`, color: c.text, fontSize: size * 0.82, textShadow: '0 2px 6px rgba(0,0,0,.8)',
            opacity: 1 - out(0, 0.5), transform: `translateY(${out(0, 0.5) * 30}%)`}}>
            <span style={{display: 'inline-block', width: '0.6em', height: '0.6em', borderRadius: '50%', background: c.accent, marginRight: '0.4em',
              boxShadow: `0 0 0.5em ${c.accent}`, transform: `scale(${BACK(step(subAt, 0.3, (x) => x))})`}} />
            <FxText text={p.sub} fx="words" start={(subAt + 0.15) * k} k={k} />
          </div>
        )}
        <Decor kind={p.decor} emoji={p.emoji} at={subEnd} k={k} size={size * 0.6} color={c.accent} />
      </div>
    </AbsoluteFill>
  );
};
