import React from 'react';
import {AbsoluteFill} from 'remotion';
import {fitFontSize, useFontsLoaded, widthOf} from '../fit';
import {fontFamily} from '../fonts';
import {BACK, eraseOut, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, optText, pace, text, textFx, z, type MotionProps} from './schema';

export const CalloutSchema = z.object({
  title: text('Chữ chính (VD: Đăng Ký)'),
  sub1: optText('Dòng phụ 1 (băng màu)'),
  sub2: optText('Dòng phụ 2 (ô sáng)'),
  targetX: numDefault('Điểm chỉ: ngang (% khung)', 72, {min: 0, max: 100, step: 1}),
  targetY: numDefault('Điểm chỉ: dọc (% khung)', 46, {min: 0, max: 100, step: 1}),
  labelX: numDefault('Ô chữ: ngang (% khung)', 12, {min: 0, max: 100, step: 1}),
  labelY: numDefault('Ô chữ: dọc (% khung)', 18, {min: 0, max: 100, step: 1}),
  size: numDefault('Cỡ chữ tối đa (px)', 97, {min: 40, max: 200, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'typewriter'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

const PAD = 0.45;
const LH = 1.12;

export const Callout: React.FC<MotionProps<typeof CalloutSchema>> = (p) => {
  const k = PACE[p.pace];
  const {t, step, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  const {width: W, height: H} = p.area;
  const left = (p.labelX / 100) * W, top = (p.labelY / 100) * H;
  const size = loaded
    ? fitFontSize({text: p.title, maxSize: p.size, width: W - left - W * 0.04 - 0.8 * p.size, height: H, weight: 800, wrap: false, padX: PAD, lineHeight: LH})
    : p.size;
  const subFit = (s: string | undefined, max: number, indent: number) => (s && loaded
    ? fitFontSize({text: s, maxSize: max, width: W - left - indent - W * 0.04, height: H, weight: 800, wrap: false, padX: PAD, lineHeight: LH}) : max);
  const f1 = subFit(p.sub1, size * 0.62, 0), f2 = subFit(p.sub2, size * 0.69, size * 0.6);
  const boxW = (loaded ? widthOf(p.title, size, 800) : size * p.title.length * 0.55) + 2 * PAD * size;
  const boxH = size * (LH + 0.3);
  const tx = (p.targetX / 100) * W, ty = (p.targetY / 100) * H;
  const lx = left + boxW, ly = top + boxH / 2;
  const rowW = (s: string | undefined, f: number, indent: number) => (!s ? 0 : indent + 0.9 * f + (loaded ? widthOf(s, f, 800) : f * s.length * 0.55));
  // elbow past the widest row so the diagonal never crosses a sub band
  const ex = Math.min(W * 0.98, left + Math.max(boxW, rowW(p.sub1, f1, 0), rowW(p.sub2, f2, size * 0.6)) + size * 0.8);
  const titleEnd = 0.82 + fxDuration(p.fx, p.title, 1);
  const sub2End = titleEnd + 0.25 + 0.35;

  const ringStep = step(0, 0.38, BACK);
  const q = (((t - 0.4 * k) / (1.1 * k)) % 1 + 1) % 1;
  const pulse = t >= 0.4 * k ? `0 0 0 ${size * 0.4 * q}px rgba(255,255,255,${0.7 * (1 - q)})` : 'none';
  const fade = 1 - outP;
  const box = (bg: string, fg: string, fs: number): React.CSSProperties => ({
    background: bg, color: fg, fontSize: fs, fontWeight: 800, lineHeight: LH, padding: '0.15em 0.45em', whiteSpace: 'nowrap',
    width: 'fit-content', boxShadow: '0 .1em .4em rgba(0,0,0,.35)',
  });
  const s1 = step(titleEnd, 0.35), s2 = step(titleEnd + 0.25, 0.35);
  return (
    <AbsoluteFill style={{fontFamily}}>
      <div style={{position: 'absolute', left: tx - size / 2, top: ty - size / 2, width: size, height: size, borderRadius: '50%',
        border: `${size * 0.09}px solid #fff`, boxSizing: 'border-box', transform: `scale(${ringStep})`, boxShadow: pulse,
        opacity: fade, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: size * 0.33, height: size * 0.33, borderRadius: '50%', background: '#fff'}} />
      </div>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: fade}}>
        <polyline points={`${lx},${ly} ${ex},${ly} ${tx},${ty}`} fill="none" stroke="#fff" strokeWidth={4}
          strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - step(0.3, 0.3)} />
      </svg>
      <div style={{position: 'absolute', left, top, clipPath: eraseOut(outP)}}>
        <div style={{position: 'relative', width: boxW}}>
          <div style={{...box(c.accent2, c.text, size), width: boxW, boxSizing: 'border-box', transform: `scaleX(${step(0.56, 0.28)})`, transformOrigin: 'right'}}>
            <FxText text={p.title} fx={p.fx} start={0.82 * k} k={k} />
          </div>
          <Decor kind={p.decor} emoji={p.emoji} at={sub2End} k={k} size={size * 0.5} color={c.accent} />
        </div>
        {p.sub1 && <div style={{...box(c.accent2, c.text, f1), marginTop: size * 0.12, clipPath: `inset(0 ${(1 - s1) * 100}% 0 0)`}}>
          <FxText text={p.sub1} fx="none" start={(titleEnd + 0.1) * k} k={k} />
        </div>}
        {p.sub2 && <div style={{...box(c.surface, c.primary, f2), marginTop: size * 0.12, marginLeft: size * 0.6, clipPath: `inset(0 0 0 ${(1 - s2) * 100}%)`}}>
          <FxText text={p.sub2} fx="pop" start={(titleEnd + 0.4) * k} k={k} />
        </div>}
      </div>
    </AbsoluteFill>
  );
};
