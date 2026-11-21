import React from 'react';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import {lines, numDefault, optText, text, z, type MotionProps} from './schema';

export const LineChartSchema = z.object({
  title: optText('Tiêu đề'),
  labels: lines('Nhãn trục X (mỗi dòng một nhãn)'),
  series: lines('Đường (mỗi dòng: Tên | v1, v2, v3… | ảnh tuỳ chọn)').refine((a) => a.length <= 3, 'Tối đa 3 đường'),
  unit: optText('Đơn vị'),
  seconds: numDefault('Vẽ trong (giây)', 1.5, {min: 0.2, max: 6, step: 0.1}),
  source: text('Nguồn'),
});

export type Series = {name: string; values: number[]; img?: string};

/** "Tên | 1, 2.5 3 | anh.png" -> series. shortcut: commas and spaces both separate values, so decimals need a dot;
 *  rows without a name or any number are skipped. */
export const parseSeries = (rows: string[]): Series[] => rows.flatMap((row) => {
  const [name = '', vs = '', img = ''] = row.split('|').map((s) => s.trim());
  const values = vs.split(/[,\s]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  return name && values.length ? [{name, values, ...(img && {img})}] : [];
});

const W = 940, H = 640, PAD = 70;

export const LineChart: React.FC<MotionProps<typeof LineChartSchema>> = ({title, labels, series, unit, seconds, source, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const data = parseSeries(series).slice(0, 3);
  const p = interpolate(frame, [0, seconds * fps], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const n = Math.max(labels.length, ...data.map((s) => s.values.length), 2);
  const all = data.flatMap((s) => s.values);
  const lo = Math.min(0, ...all), hi = Math.max(...all, lo + 1e-9);
  const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD - 150);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
  const colors = [brand.colors.primary, brand.colors.accent, brand.colors.accent2 ?? '#E11D2E'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width: 980, background: brand.colors.background + 'E6', borderRadius: 40, padding: '40px 20px 32px', boxShadow: '0 20px 60px rgba(0,0,0,.45)'}}>
        {title && <div style={{fontWeight: 800, fontSize: 56, color: brand.colors.text, margin: '0 28px 12px'}}>{title}</div>}
        <svg width={W} height={H} style={{overflow: 'visible', margin: '0 20px'}}>
          <line x1={PAD} x2={W - PAD - 150} y1={y(lo)} y2={y(lo)} stroke={brand.colors.text} strokeOpacity={0.5} strokeWidth={3} />
          {labels.map((l, i) => (
            <text key={i} x={x(i)} y={H - PAD + 44} textAnchor="middle" fontSize={30} fontWeight={700} fill={brand.colors.text}>{l}</text>
          ))}
          {data.map((s, k) => {
            const pts = s.values.map((v, i) => [x(i), y(v)]);
            const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
            const len = pts.slice(1).reduce((a, [px, py], i) => a + Math.hypot(px - pts[i][0], py - pts[i][1]), 0) || 1;
            const [ex, ey] = pts[pts.length - 1];
            const shown = interpolate(p, [0.8, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            return (
              <g key={k}>
                <path d={d} fill="none" stroke={colors[k]} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
                <g opacity={shown}>
                  <circle cx={ex} cy={ey} r={12} fill={colors[k]} />
                  {s.img && <image href={staticFile(`library/${s.img}`)} x={ex + 20} y={ey - 54} width={44} height={44} />}
                  <text x={ex + (s.img ? 72 : 22)} y={ey - 14} fontSize={30} fontWeight={800} fill={colors[k]}>{s.name}</text>
                  <text x={ex + 22} y={ey + 28} fontSize={28} fontWeight={700} fill={brand.colors.text}>{s.values[s.values.length - 1]}{unit ? ` ${unit}` : ''}</text>
                </g>
              </g>
            );
          })}
        </svg>
        <div style={{margin: '8px 28px 0', fontSize: 28, color: brand.colors.text, opacity: 0.7}}>Nguồn: {source}</div>
      </div>
    </AbsoluteFill>
  );
};
