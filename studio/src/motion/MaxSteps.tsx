import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {lines, numDefault, optText, z, type MotionProps} from './schema';

export const MaxStepsSchema = z.object({
  title: optText('Tiêu đề'),
  items: lines('Các bước (mỗi dòng một bước)'),
  itemsAt: z.array(z.string()).optional().describe('Từ trong lời đọc để hiện từng bước (prepare.py tự tính giờ)'),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ hiện từng bước (giây, tự tính từ itemsAt)'),
  size: numDefault('Cỡ chữ tối đa (px)', 60, {min: 28, max: 120, step: 2}),
});

const CHECK = 'M5 12.5 L10 17.5 L19 7';

/** Glass step rows that slide in on their voice word; the active row glows and a check is drawn when the next one starts. */
export const MaxSteps: React.FC<MotionProps<typeof MaxStepsSchema>> = ({title, items, itemTimes, size, brand, area, layerSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const {accent, background, primary, text} = brand.colors;
  const t = frame / fps;
  const at = (i: number) => itemTimes?.[i] ?? 0.3 + i * 0.6;
  const titleH = title ? 84 : 0;
  const rowH = Math.min(150, (area.height - titleH - 24 * items.length) / items.length);
  const textW = area.width - rowH * 1.4 - 190;
  const fs = loaded ? Math.min(size, ...items.map((s) => fitFontSize({text: s, width: textW, height: rowH * 0.8, maxSize: size, weight: 800, minSize: 20, wrap: false}))) : size;
  const out = interpolate(t, [layerSeconds - 0.3, layerSeconds], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const titleIn = spring({frame, fps, config: {damping: 18}});
  return (
    <div style={{width: area.width, height: area.height, display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'flex-start', opacity: out}}>
      {title && (
        <div style={{alignSelf: 'flex-start', height: 60, background: accent, color: background, fontFamily: headingFamily, fontWeight: 900, fontSize: 52, letterSpacing: 4, padding: '0 36px', borderRadius: 18, display: 'flex', alignItems: 'center', clipPath: `inset(0 ${(1 - titleIn) * 100}% 0 0)`}}>{title}</div>
      )}
      {items.map((s, i) => {
        const p = spring({frame: frame - Math.round(at(i) * fps), fps, config: {damping: 15, stiffness: 150}});
        const active = t >= at(i) && (i === items.length - 1 || t < at(i + 1));
        const done = interpolate(t, [at(i + 1) ?? 99, (at(i + 1) ?? 99) + 0.35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const check = evolvePath(i === items.length - 1 ? interpolate(t, [at(i) + 1.2, at(i) + 1.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : done, CHECK);
        return (
          <div key={i} style={{
            height: rowH, display: 'flex', alignItems: 'center', gap: 30, padding: '0 36px 0 24px', boxSizing: 'border-box',
            background: active ? `color-mix(in srgb, ${primary} 88%, transparent)` : `color-mix(in srgb, ${background} 70%, transparent)`, borderRadius: 999, border: `4px solid ${active ? accent : 'rgba(255,255,255,.2)'}`,
            boxShadow: active ? `0 0 60px color-mix(in srgb, ${accent} 45%, transparent), 0 24px 60px rgba(0,0,0,.35)` : '0 24px 60px rgba(0,0,0,.35)',
            opacity: Math.min(1, p * 3), transform: `translateX(${(1 - p) * 600}px) scale(${active ? 1.03 : 1})`,
          }}>
            <div style={{width: rowH * 0.7, height: rowH * 0.7, flex: 'none', borderRadius: 999, background: accent, color: background, fontFamily: headingFamily, fontWeight: 900, fontSize: rowH * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{i + 1}</div>
            <div style={{flex: 1, fontFamily, fontWeight: 800, fontSize: fs, color: text, lineHeight: 1.1}}>{s}</div>
            <svg width={rowH * 0.6} height={rowH * 0.6} viewBox="0 0 24 24" style={{flex: 'none'}}>
              <path d={CHECK} fill="none" stroke="#3DDC84" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={check.strokeDasharray} strokeDashoffset={check.strokeDashoffset} />
            </svg>
          </div>
        );
      })}
    </div>
  );
};
