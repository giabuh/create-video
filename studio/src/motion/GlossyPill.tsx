import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {BACK, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, optText, pace, text, textFx, z, type MotionProps} from './schema';

export const GlossyPillSchema = z.object({
  title: text('Chữ chính'),
  sub: optText('Dòng phụ (ô sáng bên dưới)'),
  sticker: optText('Sticker emoji cạnh nhãn, VD: 📢'),
  size: numDefault('Cỡ chữ tối đa (px)', 78, {min: 30, max: 160, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'words'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

export const GlossyPill: React.FC<MotionProps<typeof GlossyPillSchema>> = (p) => {
  const k = PACE[p.pace];
  const {t, step, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  const size = loaded ? fitFontSize({text: p.title, maxSize: p.size, width: p.area.width * 0.8, height: p.area.height * 0.4, weight: 800, padX: 0.92}) : p.size;
  const titleAt = 0.25;
  const titleEnd = titleAt + fxDuration(p.fx, p.title, 1);
  const subAt = titleEnd + 0.1;
  const subEnd = p.sub ? subAt + fxDuration('mask', p.sub, 1) : titleEnd;
  const pill = step(0, 0.38, BACK);
  const sub = step(titleEnd - 0.1, 0.3);
  const st = step(subEnd, 0.4, BACK);
  const wiggle = t < (subEnd + 0.4) * k ? 0 : 11 * Math.sin((2 * Math.PI * (t - (subEnd + 0.4) * k)) / (0.26 * k));
  return (
    <AbsoluteFill style={{fontFamily, alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
      <div style={{transform: `scale(${1 + 0.3 * outP})`, opacity: 1 - outP}}>
        <div style={{position: 'relative', display: 'inline-block'}}>
          <div style={{position: 'relative', display: 'inline-block', overflow: 'hidden', fontSize: size, fontWeight: 800, color: c.text,
            padding: '0.28em 0.8em', borderRadius: '0.35em', border: '0.12em solid rgba(255,255,255,.95)',
            background: `linear-gradient(180deg, #3b82f6 0%, #1d4ed8 55%, ${c.primary} 100%)`,
            boxShadow: '0 0 0.6em rgba(59,130,246,.8), inset 0 0.12em 0 rgba(255,255,255,.35)',
            transform: `scale(${0.2 + 0.8 * pill})`, opacity: Math.min(1, Math.max(0, step(0, 0.38)))}}>
            <FxText text={p.title} fx={p.fx} start={titleAt * k} k={k} />
            <div style={{position: 'absolute', top: '-20%', bottom: '-20%', width: '30%', left: `${-40 + 170 * step(titleEnd, 0.7, Easing.inOut(Easing.ease))}%`,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent)', transform: 'skewX(-20deg)'}} />
          </div>
          {p.sticker && <span style={{position: 'absolute', right: -size * 0.9, top: -size * 0.8, fontSize: size * 1.5, lineHeight: 1,
            transform: `scale(${st}) rotate(${(1 - st) * -40 + wiggle}deg)`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.5))'}}>{p.sticker}</span>}
          <Decor kind={p.decor} emoji={p.emoji} at={subEnd + 0.4} k={k} size={size} color={c.accent} />
        </div>
        {p.sub && <div>
          <div style={{display: 'inline-block', marginTop: '-0.1em', fontSize: size * 0.72, fontWeight: 800, background: c.surface, color: c.primary,
            padding: '0.25em 0.9em', borderRadius: '0.3em', transformOrigin: '50% 0',
            transform: `translateY(${(1 - sub) * -60}%) scaleY(${sub})`}}>
            <FxText text={p.sub} fx="mask" start={subAt * k} k={k} />
          </div>
        </div>}
      </div>
    </AbsoluteFill>
  );
};
