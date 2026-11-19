import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {fitFontSize, useFontsLoaded, widthOf} from '../fit';
import {fontFamily} from '../fonts';
import {eraseOut, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, optText, pace, text, textFx, z, type MotionProps} from './schema';

export const GiantTextSchema = z.object({
  giant: text('Chữ khổng lồ (lướt ngang)'),
  caption: optText('Dòng chốt (đọng lại sau khi lướt)'),
  size: numDefault('Cỡ chữ khổng lồ (px)', 367, {min: 150, max: 600, step: 5}),
  captionSize: numDefault('Cỡ dòng chốt (px)', 91, {min: 40, max: 180, step: 2}),
  fx: textFx('Hiệu ứng dòng chốt', 'none'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const GiantText: React.FC<MotionProps<typeof GiantTextSchema>> = (p) => {
  const k = PACE[p.pace];
  const {t, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  const {width: W} = p.area;
  const giant = p.giant.toLocaleUpperCase('vi');
  const gw = loaded ? widthOf(giant, p.size, 800) : p.size * giant.length * 0.6;
  const tg = t / k;
  const gx = interpolate(tg, [0, 1.3], [W, -(gw + W * 0.1)], {...clamp, easing: Easing.bezier(0.3, 0.1, 0.7, 0.9)});
  const gOp = interpolate(tg, [1.15, 1.3], [1, 0], clamp);
  const sx = interpolate(tg, [0.15, 0.95], [1.7 * W, -1.2 * W], clamp);
  const sp = interpolate(tg, [0.15, 0.95], [0, 1], clamp);
  const sOp = sp <= 0 || sp >= 1 ? 0 : sp < 0.2 ? sp / 0.2 : 1 - (sp - 0.2) / 0.8;
  const cap = p.caption?.trim();
  const capSize = cap && loaded ? fitFontSize({text: cap, maxSize: p.captionSize, width: W * 0.9, height: p.area.height * 0.3, weight: 800, padX: 0.035}) : p.captionSize;
  const land = interpolate(tg, [1.1, 1.1 + 0.38], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const capEnd = 1.1 + 0.38 + (cap ? fxDuration(p.fx, cap, 1) : 0);
  return (
    <AbsoluteFill style={{fontFamily, overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: '42%', left: 0, whiteSpace: 'nowrap', fontSize: p.size, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em',
        color: c.accent, WebkitTextStroke: `0.04em ${c.primary}`, paintOrder: 'stroke fill', transform: `translateX(${gx}px)`, opacity: gOp}}>{giant}</div>
      <div style={{position: 'absolute', top: '52%', left: 0, width: W * 0.6, height: W * 0.03, borderRadius: W * 0.03,
        background: `linear-gradient(90deg, transparent, #fff7c2, ${c.accent} 70%, transparent)`, boxShadow: `0 0 ${W * 0.04}px ${c.accent}`,
        transform: `translateX(${sx}px)`, opacity: sOp}} />
      {cap && <div style={{position: 'absolute', top: '68%', left: 0, right: 0, display: 'flex', justifyContent: 'center', clipPath: eraseOut(outP)}}>
        <div style={{position: 'relative', textAlign: 'center', fontSize: capSize, fontWeight: 800, lineHeight: 1.12, color: c.text, maxWidth: W * 0.9,
          WebkitTextStroke: `0.07em ${c.primary}`, paintOrder: 'stroke fill', opacity: land,
          transform: `translateY(-50%) scale(${2.4 - 1.4 * land})`, filter: `blur(${6 * (1 - land)}px)`}}>
          <FxText text={cap} fx={p.fx} start={1.1 * k} k={k} />
          <Decor kind={p.decor} emoji={p.emoji} at={capEnd} k={k} size={capSize * 0.5} color={c.accent} />
        </div>
      </div>}
    </AbsoluteFill>
  );
};
