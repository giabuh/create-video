// PinLabel: a pin drops with a bounce, then the place name appears beside it.
import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, pace, text, textFx, z, type MotionProps} from './schema';

export const PinLabelSchema = z.object({
  text: text('Chữ (VD: tại Sao Việt)'),
  size: numDefault('Cỡ chữ tối đa (px)', 108, {min: 40, max: 220, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'pop'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

export const PinLabel: React.FC<MotionProps<typeof PinLabelSchema>> = (p) => {
  const k = PACE[p.pace];
  const {step, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  // the pin (≈1.1 em) shares the row, so the text gets the rest of the width
  const size = loaded ? fitFontSize({text: p.text, maxSize: p.size, width: p.area.width * 0.88 - p.size * 1.4, height: p.area.height * 0.3, weight: 800, padX: 0.3, padY: 0.2}) : p.size;
  const textAt = 0.5;
  const q = step(0, 0.65, (x) => x);
  const dropY = interpolate(q, [0, 0.6, 0.8, 1], [-400, 0, -25, 0]);
  return (
    <AbsoluteFill style={{fontFamily, fontWeight: 800, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: size * 0.2, transform: `translateY(${-30 * outP}%)`, opacity: 1 - outP}}>
        <svg viewBox="0 0 24 32" style={{width: size * 1.1, height: size * 1.1 * (32 / 24), flex: 'none', overflow: 'visible',
          transform: `translateY(${dropY}%)`, opacity: Math.min(1, q * 3), filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.45))'}}>
          <path d="M12 0C5.4 0 0 5.3 0 11.8 0 20.6 12 32 12 32s12-11.4 12-20.2C24 5.3 18.6 0 12 0z" fill={c.accent2} stroke="#fff" strokeWidth={1.6} />
          <circle cx={12} cy={11.5} r={4.2} fill="#fff" />
        </svg>
        <div style={{position: 'relative', fontSize: size, lineHeight: 1.15, color: c.accent, WebkitTextStroke: `0.09em ${c.primary}`, paintOrder: 'stroke fill',
          transform: 'rotate(-7deg)', textShadow: '0 .1em .2em rgba(0,0,0,.4)'}}>
          <FxText text={p.text} fx={p.fx} start={textAt * k} k={k} />
          <Decor kind={p.decor} emoji={p.emoji} at={textAt + fxDuration(p.fx, p.text, 1)} k={k} size={size * 0.5} color={c.accent} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
