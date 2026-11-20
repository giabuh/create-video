import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded, widthOf} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {FxText} from './fx/FxText';
import {choice, lines, numDefault, optText, textFx, z, type MotionProps} from './schema';
import {RADIUS, backOut, inOut} from './style';

export const ChecklistSchema = z.object({
  items: lines('Các mục (mỗi dòng một mục)'),
  title: optText('Tiêu đề'),
  variant: choice('Kiểu', ['steps', 'grid'], 'steps', {steps: 'Bậc thang', grid: 'Lưới 2×2'}),
  size: numDefault('Cỡ chữ tối đa (px) — tự thu nhỏ cho vừa khung', 64, {min: 28, max: 140, step: 2}),
  interval: numDefault('Mục sau hiện cách (giây)', 0.5, {min: 0, max: 3, step: 0.05}),
  itemsAt: z.array(z.string()).optional().describe('Từ trong lời đọc để hiện từng mục (mỗi mục một từ; prepare.py tự tính giờ)'),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ hiện từng mục (giây, tự tính từ itemsAt)'),
  fx: textFx('Hiệu ứng chữ', 'none'),
});

const pad2 = (i: number) => String(i + 1).padStart(2, '0');

export const Checklist: React.FC<MotionProps<typeof ChecklistSchema>> = ({items, title, variant, size: maxSize, interval, itemTimes, fx, brand, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const {background, accent, text} = brand.colors;
  const padX = Math.min(90, area.width * 0.08);
  const innerW = area.width - 2 * padX;
  const t0 = title ? 0.25 : 0.05; // items start after the title wipe
  // voice-synced times win (itemTimes from itemsAt); otherwise a fixed stagger after the title
  const at = (i: number) => itemTimes?.[i] ?? t0 + i * interval;
  const prog = (startSec: number, durSec: number, ease: (n: number) => number) =>
    interpolate(frame / fps - startSec, [0, durSec], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const wipe = title ? prog(0.05, 0.35, inOut) : 1;
  const renderText = (item: string, i: number) => fx === 'none' ? item : <FxText text={item} fx={fx} start={Math.round(at(i) * fps) / fps} />;
  // title block: Barlow 900 uppercase on a yellow block, wipes in from the left
  const titleBlock = (ts: number) => title && (
    <div style={{alignSelf: 'flex-start', background: accent, color: background, fontFamily: headingFamily, fontWeight: 900, fontSize: ts, lineHeight: 1.1,
      padding: `${ts * 0.08}px ${ts * 0.46}px`, borderRadius: RADIUS, letterSpacing: ts * 0.04, textTransform: 'uppercase',
      clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}}>{title}</div>
  );

  if (variant === 'grid') {
    const gap = 36, cols = 2, rows = Math.ceil(items.length / cols);
    const tileW = (innerW - gap) / cols;
    const ts = title ? Math.min(maxSize * 1.2, 90) : 0;
    const availH = area.height * 0.94 - (title ? ts * 1.3 + gap : 0);
    const tileH = Math.min(380, (availH - (rows - 1) * gap) / rows);
    const numSize = Math.min(tileH * 0.42, 140), tp = Math.min(tileW * 0.09, 40);
    const textSize = loaded ? Math.min(maxSize, ...items.map((t) => fitFontSize({text: t, width: tileW - 2 * tp, height: tileH - numSize - 2 * tp, maxSize, weight: 700, minSize: 12}))) : maxSize;
    return (
      <AbsoluteFill style={{justifyContent: 'center', padding: `0 ${padX}px`, gap, fontFamily}}>
        {titleBlock(loaded ? Math.min(ts, ts * (innerW / Math.max(innerW, widthOf(title ?? '', ts, 900, headingFamily)))) : ts)}
        <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap}}>
          {items.map((item, i) => {
            const s = prog(at(i), 0.4, backOut);
            return (
              <div key={i} style={{height: tileH, boxSizing: 'border-box', padding: tp, background: background, borderRadius: RADIUS, boxShadow: `12px 12px 0 ${accent}`,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: Math.min(1, s * 3), transform: `scale(${0.4 + 0.6 * s})`}}>
                <div style={{fontFamily: headingFamily, fontWeight: 900, fontSize: numSize, lineHeight: 1, color: accent}}>{pad2(i)}</div>
                <div style={{fontWeight: 700, fontSize: textSize, lineHeight: 1.12, color: text}}>{renderText(item, i)}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // steps: u = mockup px (45px text) scaled to the chosen size; shrink until widest row (with staircase indent) and the list fit
  const rowW = (t: string, i: number, sz: number) => { const u = sz / 45; return 72 * u + 60 * u + 30 * u + widthOf(t, sz, 700) + 12 * u + i * 36 * u; };
  const stepH = (sz: number) => { const u = sz / 45; return 45 * u * 1.15 + 48 * u; };
  const titleH = (sz: number) => (title ? 78 * (sz / 45) * 1.1 + 12 * (sz / 45) * 1.1 : 0);
  const k = loaded ? Math.min(1,
    innerW / Math.max(1, ...items.map((t, i) => rowW(t, i, maxSize)), title ? widthOf(title, maxSize * 78 / 45 * 0.8, 900, headingFamily) + 72 * maxSize / 45 : 0),
    (area.height * 0.94) / (titleH(maxSize) + items.length * stepH(maxSize) + items.length * 24 * (maxSize / 45))) : 1;
  const size = Math.floor(maxSize * k), u = size / 45;
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: `0 ${padX}px`, gap: 24 * u, fontFamily}}>
      {titleBlock(78 * u)}
      {items.map((item, i) => {
        const s = prog(at(i), 0.4, backOut);
        return (
          <div key={i} style={{alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 30 * u, boxSizing: 'border-box', maxWidth: innerW - i * 36 * u - 12 * u,
            marginLeft: i * 36 * u, background, color: text, padding: `${24 * u}px ${36 * u}px`, borderRadius: RADIUS, boxShadow: `${12 * u}px ${12 * u}px 0 ${accent}`,
            opacity: Math.min(1, s * 4), transform: `translateX(${(1 - s) * -144 * u}px)`}}>
            <span style={{fontFamily: headingFamily, fontWeight: 900, fontSize: 60 * u, lineHeight: 1, color: accent}}>{pad2(i)}</span>
            <span style={{fontWeight: 700, fontSize: size, lineHeight: 1.15}}>{renderText(item, i)}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
