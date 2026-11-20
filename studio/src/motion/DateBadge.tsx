import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {FxText} from './fx/FxText';
import {backOut, HARD_SHADOW, inOut, RADIUS} from './style';
import {choice, numDefault, optText, text, textFx, z, type MotionProps} from './schema';

export const DateBadgeSchema = z.object({
  label: text('Nhãn (VD: Khai giảng)'),
  date: text('Ngày (VD: 07/12)'),
  sub: optText('Dòng phụ'),
  variant: choice('Kiểu', ['slab', 'calendar'], 'slab', {slab: 'Khối vàng', calendar: 'Tờ lịch'}),
  width: numDefault('Rộng (px)', 620, {min: 300, max: 1000, step: 10}),
  fx: textFx('Hiệu ứng chữ', 'none'),
});

const DATE = /^\s*(\d{1,2})\s*[/.]\s*(\d{1,2})(?:\s*[/.]\s*\d{2,4})?\s*$/;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
/** 0..1 progress of a mockup keyframe segment: starts at `delay` s, lasts `dur` s. */
const prog = (t: number, delay: number, dur: number, ease: (n: number) => number) =>
  interpolate(t, [delay, delay + dur], [0, 1], {...clamp, easing: ease});

export const DateBadge: React.FC<MotionProps<typeof DateBadgeSchema>> = ({label, date, sub, variant, width, fx, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ready = useFontsLoaded();
  const t = frame / fps;
  const c = brand.colors;
  const k = width / 620;
  const lab = label.toUpperCase();
  const m = DATE.exec(date);
  const hd: React.CSSProperties = {fontFamily: headingFamily, textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap'};
  const bigText = (s: string) => (fx === 'none' ? s : <FxText text={s} fx={fx} start={0.25} />);
  // enter pop with overshoot: translateY from -60 and fade (mockup `down`, 7% = 0.315s)
  const down = (delay: number) => {
    const p = prog(t, delay, 0.315, backOut);
    return {opacity: Math.min(1, p * 3), transform: `translateY(${(1 - p) * -60}px)`};
  };
  const wipe = (delay: number) => {
    const p = prog(t, delay, 0.315, inOut);
    return p >= 1 ? undefined : `inset(0 ${(1 - p) * 100}% 0 0)`;
  };
  const up = (delay: number) => {
    const p = prog(t, delay, 0.4, inOut);
    return {opacity: p, transform: `translateY(${(1 - p) * 60}px)`};
  };
  const pad = 36 * k;

  if (variant === 'calendar') {
    const day = m ? String(Number(m[1])).padStart(2, '0') : date;
    const tileW = Math.round(width * 0.46);
    const bandH = 72 * k;
    const dayFont = ready ? fitFontSize({text: day, maxSize: 210 * k, width: tileW - 40 * k, height: 400, weight: 900, wrap: false, family: headingFamily}) : 100;
    const monthText = m ? `THÁNG ${String(Number(m[2])).padStart(2, '0')}` : '';
    const monthFont = monthText && ready ? fitFontSize({text: monthText, maxSize: 48 * k, width: tileW - 40 * k, height: bandH, weight: 800, wrap: false, family: headingFamily}) : 40 * k;
    const sideW = width - tileW - 36 * k;
    const labFont = ready ? fitFontSize({text: lab, maxSize: 60 * k, width: sideW - 2 * 24 * k - lab.length * 3 * k, height: 200, weight: 800, wrap: false, family: headingFamily}) : 40 * k;
    const subFont = sub && ready ? fitFontSize({text: sub, maxSize: 40 * k, width: sideW - 2 * 20 * k, height: 200, weight: 700, wrap: false}) : 30 * k;
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
        <div style={{width, display: 'flex', alignItems: 'center', gap: 36 * k}}>
          <div style={{width: tileW, flex: 'none', background: '#FFFFFF', borderRadius: RADIUS, overflow: 'hidden', boxShadow: HARD_SHADOW(c.background), textAlign: 'center', ...down(0)}}>
            {m && <div style={{...hd, height: bandH, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.primary, color: c.text,
              fontSize: monthFont, fontWeight: 800, letterSpacing: 3 * k}}>{monthText}</div>}
            <div style={{...hd, color: c.primary, fontWeight: 900, fontSize: dayFont, padding: `${18 * k}px 0 ${24 * k}px`, clipPath: wipe(0.25)}}>{bigText(day)}</div>
          </div>
          <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 * k}}>
            <div style={{...hd, background: c.primary, color: c.accent, fontWeight: 800, fontSize: labFont, letterSpacing: 3 * k, padding: `${10 * k}px ${24 * k}px`,
              borderRadius: RADIUS, boxShadow: HARD_SHADOW(c.background), ...down(0.15)}}>{lab}</div>
            {sub && <div style={{background: c.background, color: c.text, fontWeight: 700, fontSize: subFont, padding: `${8 * k}px ${20 * k}px`, borderRadius: RADIUS * 0.67,
              whiteSpace: 'nowrap', ...up(0.3)}}>{sub}</div>}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // slab: navy tab drops, yellow slab with the big date wipes in (mockup frame 4)
  const tabFont = ready ? fitFontSize({text: lab, maxSize: 72 * k, width: width - 2 * 36 * k - lab.length * 6 * k, height: 400, weight: 800, wrap: false, family: headingFamily}) : 50 * k;
  const dateFont = ready ? fitFontSize({text: date, maxSize: 276 * k, width: width - 2 * 48 * k, height: 400, weight: 900, wrap: false, family: headingFamily}) : 100;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
        <div style={{...hd, background: c.primary, color: c.text, fontWeight: 800, fontSize: tabFont, letterSpacing: 6 * k, padding: `${6 * k}px ${pad}px`,
          borderRadius: `${RADIUS}px ${RADIUS}px 0 0`, ...down(0)}}>{lab}</div>
        <div style={{...hd, alignSelf: 'stretch', textAlign: 'center', background: c.accent, color: c.background, fontWeight: 900, fontSize: dateFont, padding: `0 ${48 * k}px`,
          borderRadius: `0 ${RADIUS}px ${RADIUS}px ${RADIUS}px`, boxShadow: HARD_SHADOW(c.background), clipPath: wipe(0.25)}}>{bigText(date)}</div>
        {sub && <div style={{marginTop: 30 * k, background: c.background, color: c.text, fontWeight: 700, fontSize: 40 * k, padding: `${8 * k}px ${20 * k}px`,
          borderRadius: RADIUS * 0.67, whiteSpace: 'nowrap', ...up(0.4)}}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};
