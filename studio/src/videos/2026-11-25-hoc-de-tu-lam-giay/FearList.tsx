// FearList: a paper card with an ink chip and a list of fears; rows pop in with the voice (itemTimes), then one row gets a hand-drawn terra circle.
// Laid out at a fixed internal size (u = 1080), measured with the real fonts, then scaled DOWN to fit the area. See projects/2026-11-25-hoc-de-tu-lam-giay/components.md.
import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useFontsLoaded, widthOf} from '../../fit';
import {fontFamily} from '../../fonts';
import {numDefault, optText, z, type MotionProps} from '../../motion/schema';
import {Chip, PAPER, PaperCard, paperDims, Tape} from '../../paper/paper';

export const FearListSchema = z.object({
  chip: optText('Nhãn mono trên cùng (VD: Bạn đang sợ)'),
  items: z.array(z.string()).default([]).meta({title: 'Các nỗi sợ, mỗi dòng một mục', ui: 'lines'}),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ hiện từng dòng (giây, tự tính từ itemsAt)'),
  circle: numDefault('Dòng được khoanh (số thứ tự từ 0; -1 = không khoanh; mặc định dòng cuối)', 9999, {min: -1, max: 9999, step: 1}),
});

const U = 1080;
const BADGE = 60, TEXT = 40, ROW_H = 84, ROW_GAP = 16, PAD = 36, M = 28;

/** Slightly irregular ellipse that over-shoots its start, as one stroke (deterministic). */
const handCircle = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 72; i++) {
    const a = -2.6 + (i / 72) * (Math.PI * 2 + 0.7);
    const w = 1 + 0.035 * Math.sin(3 * a + seed) + 0.025 * Math.sin(5 * a + seed * 2) + 0.05 * (i / 72);
    pts.push(`${i ? 'L' : 'M'}${(cx + Math.cos(a) * rx * w).toFixed(1)} ${(cy + Math.sin(a) * ry * w).toFixed(1)}`);
  }
  return pts.join(' ');
};

export const FearList: React.FC<MotionProps<typeof FearListSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {line} = paperDims(U);
  const items = p.items.map((s) => s.trim()).filter(Boolean);
  const n = items.length;
  const chipText = p.chip?.trim() ?? '';
  if (!loaded || (n === 0 && !chipText)) return null;

  const chipSize = 30;
  const chipH = chipSize * 1.25 + 8;
  const textW = items.map((s) => widthOf(s, TEXT, 700));
  const rowW = Math.max(0, ...textW.map((w) => BADGE + 22 + w + 8));
  const chipW = chipText ? widthOf(chipText, chipSize, 700, PAPER.mono) + 22 : 0;
  const cw = Math.max(rowW + 40, chipW, 360);
  const ch = (chipText ? chipH + 22 : 0) + (n ? n * ROW_H + (n - 1) * ROW_GAP : 0);
  const cardW = cw + 2 * (PAD + line), cardH = ch + 2 * (PAD + line);
  const natW = cardW + 2 * M, natH = cardH + 2 * M;
  const scale = Math.min(1, p.area.width / natW, p.area.height / natH);

  // beats: voice times win, a missing one falls back to a stagger; everything is squeezed in so it lands before the exit
  const E = p.layerSeconds - 0.25;
  const raw = items.map((_, i) => p.itemTimes?.[i] ?? 0.4 + i * 0.6);
  const lastRaw = n ? Math.max(...raw) : 0;
  const budget = Math.max(0.05, E - 0.35 - 0.3 - 0.5 - 0.05); // last row lands (0.35) + 0.3 pause + circle (0.5)
  const k = lastRaw > budget ? budget / lastRaw : 1;
  const at = raw.map((x) => Math.max(0, x) * k);
  const ci = p.circle >= 9999 ? n - 1 : Math.round(p.circle);
  const hasCircle = ci >= 0 && ci < n;
  const circleAt = n ? Math.min(Math.max(...at) + 0.65, Math.max(0, E - 0.5)) : 0;

  const eo = Easing.out(Easing.cubic);
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  const enter = eo(interpolate(t, [0, 0.4], [0, 1], clamp));
  const tapeIn = eo(interpolate(t, [0.12, 0.4], [0, 1], clamp));
  const out = Easing.in(Easing.quad)(interpolate(t, [p.layerSeconds - 0.25, p.layerSeconds], [0, 1], clamp));
  const opacity = Math.min(enter * 2, 1) * (1 - out);
  const dy = (1 - enter) * -20 + out * 14, rot = -0.8 + (1 - enter) * -2;
  const pop = (i: number) => interpolate(t, [at[i], at[i] + 0.35], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const circleP = hasCircle ? eo(interpolate(t, [circleAt, circleAt + 0.5], [0, 1], clamp)) : 0;

  const rowsTop = PAD + (chipText ? chipH + 22 : 0);
  const circleD = hasCircle
    ? handCircle(PAD + BADGE + 22 + textW[ci] / 2 - 6, rowsTop + ci * (ROW_H + ROW_GAP) + ROW_H / 2, textW[ci] / 2 + 58, ROW_H * 0.62, 1.3)
    : '';

  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: (p.area.width - natW * scale) / 2, top: (p.area.height - natH * scale) / 2, width: natW, height: natH, padding: M, boxSizing: 'border-box',
        transformOrigin: '0 0', transform: `scale(${scale})`}}>
        <div style={{position: 'relative', opacity, transform: `translateY(${dy}px) rotate(${rot}deg)`, transformOrigin: 'center'}}>
          <PaperCard u={U} tape={false} style={{width: cardW, height: cardH}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
              {chipText && <div style={{height: chipH + 22}}><Chip u={U} color={PAPER.ink} size={chipSize}>{chipText}</Chip></div>}
              {items.map((s, i) => (
                <div key={i} style={{height: ROW_H, marginBottom: i < n - 1 ? ROW_GAP : 0, display: 'flex', alignItems: 'center', gap: 22,
                  opacity: Math.min(1, pop(i) * 2), transform: `translateY(${(1 - pop(i)) * -16}px) rotate(${(1 - pop(i)) * -2.5}deg)`, transformOrigin: 'left center'}}>
                  <div style={{flex: 'none', width: BADGE, height: BADGE, borderRadius: '50%', background: PAPER.terra, color: PAPER.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: PAPER.mono, fontWeight: 700, fontSize: 38, lineHeight: 1}}>?</div>
                  <div style={{fontFamily, fontWeight: 700, fontSize: TEXT, lineHeight: 1.3, color: PAPER.ink, whiteSpace: 'nowrap'}}>{s}</div>
                </div>
              ))}
            </div>
            {hasCircle && circleP > 0 && (
              <svg style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none'}}>
                <path d={circleD} pathLength={1} fill="none" stroke={PAPER.terra} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1.01" strokeDashoffset={1 - circleP} />
              </svg>
            )}
          </PaperCard>
          <Tape u={U} style={{top: -U * 0.011 - (1 - tapeIn) * 16, right: U * 0.03, opacity: tapeIn}} />
        </div>
      </div>
    </div>
  );
};
