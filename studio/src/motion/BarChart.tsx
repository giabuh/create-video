import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {bool, lines, numDefault, optText, text, z, type MotionProps} from './schema';

export const BarChartSchema = z.object({
  title: optText('Tiêu đề'),
  bars: lines('Cột (mỗi dòng: Nhãn | Giá trị | ảnh tuỳ chọn)').refine((a) => a.length <= 6, 'Tối đa 6 cột'),
  unit: optText('Đơn vị'),
  rankSwap: bool('Đổi hạng khi chạy', false),
  seconds: numDefault('Chạy trong (giây)', 1.2, {min: 0.2, max: 6, step: 0.1}),
  source: text('Nguồn'),
});

export type Bar = {label: string; value: number; img?: string};

/** "Nhãn | 12,5 | anh.png" -> bar; malformed rows (no label, no number) are skipped. */
export const parseBars = (rows: string[]): Bar[] => rows.flatMap((row) => {
  const [label = '', v = '', img = ''] = row.split('|').map((s) => s.trim());
  const value = Number(v.replace(',', '.'));
  return label && v !== '' && Number.isFinite(value) ? [{label, value, ...(img && {img})}] : [];
});

const ROW = 130;

export const BarChart: React.FC<MotionProps<typeof BarChartSchema>> = ({title, bars, unit, rankSwap, seconds, source, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rows = parseBars(bars).slice(0, 6);
  const p = interpolate(frame, [0, seconds * fps], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  // rankSwap: listed order -> value order over the last 40% of the run
  const swap = rankSwap ? interpolate(p, [0.6, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  const top = sorted[0];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width: 940, background: brand.colors.background + 'E6', borderRadius: 40, padding: '40px 48px', boxShadow: '0 20px 60px rgba(0,0,0,.45)'}}>
        {title && <div style={{fontWeight: 800, fontSize: 56, color: brand.colors.text, marginBottom: 24}}>{title}</div>}
        <div style={{position: 'relative', height: rows.length * ROW}}>
          {rows.map((r, i) => {
            const y = (i + (sorted.indexOf(r) - i) * swap) * ROW;
            const w = (r.value / max) * p * 100;
            return (
              <div key={i} style={{position: 'absolute', top: y, left: 0, right: 0, height: ROW - 20, display: 'flex', alignItems: 'center', gap: 20}}>
                <div style={{width: 210, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 36, color: brand.colors.text}}>
                  {r.img && <Img src={staticFile(`library/${r.img}`)} style={{width: 56, height: 56, borderRadius: 28, objectFit: 'cover'}} />}
                  <span>{r.label}</span>
                </div>
                <div style={{flex: 1, position: 'relative', height: 80}}>
                  <div style={{width: `${w}%`, height: '100%', borderRadius: 16, background: r === top ? brand.colors.accent : brand.colors.primary}} />
                </div>
                <div style={{width: 170, fontWeight: 800, fontSize: 44, color: brand.colors.text, textAlign: 'right'}}>
                  {+(r.value * p).toFixed(1)}{unit ? ` ${unit}` : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 16, fontSize: 28, color: brand.colors.text, opacity: 0.7}}>Nguồn: {source}</div>
      </div>
    </AbsoluteFill>
  );
};
