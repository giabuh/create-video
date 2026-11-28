// LoopCard: full-frame paper page. "from" card is struck out, an arrow points to the terra "to" card, then a cycle of nodes
// (blue, purple, sage) pops with the voice, hand-drawn arcs link them and the closing arc draws the loop. See projects/2026-11-25-hoc-de-tu-lam-giay/components.md.
import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useFontsLoaded, widthOf} from '../../fit';
import {fontFamily} from '../../fonts';
import {PaperCanvas} from '../../paper/PaperCanvas';
import {numDefault, text, z, type MotionProps} from '../../motion/schema';
import {Chip, PAPER, PaperCard, paperDims} from '../../paper/paper';

const beat = (title: string, v: number) => numDefault(title + ' (giây, -1 = không, 0 = có sẵn)', v, {min: -1, max: 120, step: 0.1});

export const LoopCardSchema = z.object({
  from: text('Thẻ trên (điểm xuất phát, sẽ bị gạch)'),
  to: text('Thẻ kết quả (đất nung)'),
  nodes: z.array(z.string()).default([]).meta({title: 'Các nút của vòng, mỗi dòng một nút', ui: 'lines'}),
  fromAt: beat('Thẻ trên hiện', 0.3),
  toAt: beat('Gạch thẻ trên, mũi tên và thẻ kết quả', 1.6),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ hiện từng nút (giây, tự tính từ itemsAt)'),
});

const U = 1080;
const BADGE_COLORS = [PAPER.blue, PAPER.purple, PAPER.sage];
const ARC_R = 300, MAX_NODES = 5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const eo = Easing.out(Easing.cubic);
/** seconds since a beat: -Infinity = never, +Infinity = already done at layer start */
const since = (at: number, t: number) => (at < 0 ? -Infinity : at === 0 ? Infinity : t - at);
const prog = (s: number, dur: number) => (s === Infinity ? 1 : s === -Infinity ? 0 : eo(clamp01(s / dur)));

/** Slightly wobbly polyline along a circle arc (angles in rad, screen coords, clockwise = increasing). Deterministic. */
const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number, seed: number) => {
  const pts: string[] = [];
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const a = a0 + (a1 - a0) * (i / N);
    const rr = r * (1 + 0.007 * Math.sin(i * 0.3 + seed));
    pts.push(`${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
};
const wobbleLine = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
  const pts: string[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    pts.push(`${i ? 'L' : 'M'}${(x0 + (x1 - x0) * k).toFixed(1)} ${(y0 + (y1 - y0) * k + 4 * Math.sin(k * 11 + seed)).toFixed(1)}`);
  }
  return pts.join(' ');
};
const Stroke: React.FC<{d: string; p: number; w?: number; color?: string}> = ({d, p, w = 7, color = PAPER.terra}) => p <= 0 ? null : (
  <svg style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none'}}>
    <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1.01" strokeDashoffset={1 - p} />
  </svg>
);
const HALFTONE = {backgroundImage: `radial-gradient(${PAPER.ink} 32%, transparent 36%)`, backgroundSize: '5px 5px'};

export const LoopCard: React.FC<MotionProps<typeof LoopCardSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {line, radius} = paperDims(U);
  if (!loaded) return null;

  const W = p.area.width, H = p.area.height;
  const sc = Math.min(W / 1080, H / 1920); // designed at 1080x1920
  const ox = (W - 1080 * sc) / 2, oy = (H - 1920 * sc) / 2;
  const nodes = p.nodes.map((s) => s.trim()).filter(Boolean).slice(0, MAX_NODES);
  const n = nodes.length;

  // beats (-1 never, 0 already done are kept as they are); the rest are squeezed so the whole loop lands before the exit
  const E = p.layerSeconds - 0.25;
  const fallback = nodes.map((_, i) => 2.4 + i * 1.0);
  const nodeRaw = nodes.map((_, i) => p.itemTimes?.[i] ?? fallback[i]);
  const lastNode = n ? Math.max(...nodeRaw) : 0;
  const tail = n > 1 ? 0.3 + 0.5 + 0.1 + 0.4 : 0.4; // closing arc starts 0.3 after the last node, 0.5 long, chip pops 0.4
  const tmax = Math.max(p.fromAt, p.toAt, lastNode);
  const budget = Math.max(0.05, E - tail - 0.05);
  const k = tmax > budget ? budget / tmax : 1;
  const sq = (x: number) => (x > 0 ? x * k : x);
  const fromAt = sq(p.fromAt), toAt = sq(p.toAt);
  const nodeAt = nodeRaw.map((x) => Math.max(0.01, x) * k);

  const out = Easing.in(Easing.quad)(interpolate(t, [p.layerSeconds - 0.25, p.layerSeconds], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const enter = eo(clamp01(t / 0.25));
  const pageOpacity = enter * (1 - out);

  // from -> to
  const fromP = prog(since(fromAt, t), 0.4);
  const strikeP = prog(since(toAt, t), 0.45);
  const arrowP = prog(since(toAt, t) - 0.35, 0.4) * (strikeP > 0 ? 1 : 0);
  const toP = prog(since(toAt, t) - 0.7, 0.45) * (strikeP > 0 ? 1 : 0);
  const fromSize = 54, toSize = 66;
  const fromTextW = widthOf(p.from, fromSize, 700), toTextW = widthOf(p.to, toSize, 700, PAPER.serif);
  const fromW = Math.min(960, fromTextW + 120), toW = Math.min(960, toTextW + 140);
  const fromH = 128, toH = 168;
  const fromY = 250, arrowY0 = fromY + fromH + 24, arrowY1 = arrowY0 + 100, toY = arrowY1 + 24;

  // cycle
  const cx = 540, cy = 1150;
  const bd = n <= 3 ? 230 : 190;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
  const gap = (bd / 2 + 16) / ARC_R;
  const nodeP = (i: number) => interpolate(t, [nodeAt[i], nodeAt[i] + 0.35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.8))});
  const arcP = (i: number) => prog(t - (nodeAt[i] + 0.3), 0.5);
  const chipAt = n > 1 ? nodeAt[n - 1] + 0.3 + 0.5 + 0.1 : nodeAt[0] ?? 0;
  const chipP = n > 1 ? prog(t - chipAt, 0.35) : 0;

  const card = (key: string, x: number, y: number, w: number, h: number, pr: number, rot: number, body: React.ReactNode, fill?: string) => (
    <div key={key} style={{position: 'absolute', left: x - w / 2, top: y, width: w, height: h, opacity: Math.min(1, pr * 2), transform: `translateY(${(1 - pr) * -26}px) rotate(${rot + (1 - pr) * -2}deg)`}}>
      <PaperCard u={U} tape={false} pad={0} style={{width: w, height: h}}>
        <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: fill, borderRadius: radius}}>{body}</div>
      </PaperCard>
    </div>
  );

  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, opacity: pageOpacity}}>
        <PaperCanvas width={W} height={H} />
      </div>
      <div style={{position: 'absolute', left: ox, top: oy, width: 1080, height: 1920, transformOrigin: '0 0', transform: `scale(${sc})`, opacity: pageOpacity, translate: `0 ${out * 14}px`}}>
        {card('from', 540, fromY, fromW, fromH, fromP, -0.8,
          <span style={{fontFamily, fontWeight: 700, fontSize: fromSize, color: PAPER.ink, opacity: 1 - 0.4 * strikeP, whiteSpace: 'nowrap'}}>{p.from}</span>)}
        <Stroke d={wobbleLine(540 - fromTextW / 2 - 24, fromY + fromH / 2 + 2, 540 + fromTextW / 2 + 24, fromY + fromH / 2 - 4, 1.7)} p={fromP > 0.9 ? strikeP : 0} w={8} />
        <Stroke d={`M540 ${arrowY0} L540 ${arrowY1}`} p={arrowP} w={8} color={PAPER.ink} />
        <Stroke d={`M512 ${arrowY1 - 26} L540 ${arrowY1 + 2} L568 ${arrowY1 - 26}`} p={arrowP > 0.85 ? 1 : 0} w={8} color={PAPER.ink} />
        {card('to', 540, toY, toW, toH, toP, 0.8,
          <span style={{fontFamily: PAPER.serif, fontWeight: 700, fontSize: toSize, color: PAPER.card, whiteSpace: 'nowrap'}}>{p.to}</span>, PAPER.terra)}

        {n > 1 && nodes.map((_, i) => {
          const a0 = ang(i) + gap, a1 = ang(i + 1) - gap + (i === n - 1 ? 2 * Math.PI : 0);
          const endX = cx + Math.cos(a1) * ARC_R, endY = cy + Math.sin(a1) * ARC_R;
          const tx = -Math.sin(a1), ty = Math.cos(a1); // clockwise tangent at the end
          const head = (s: number) => { const c = Math.cos(s), sn = Math.sin(s); return [endX - 34 * (tx * c - ty * sn), endY - 34 * (tx * sn + ty * c)]; };
          const [h1x, h1y] = head(0.5), [h2x, h2y] = head(-0.5);
          return (
            <React.Fragment key={`arc${i}`}>
              <Stroke d={arcPath(cx, cy, ARC_R, a0, a1, i * 1.9 + 0.4)} p={arcP(i)} w={8} color={PAPER.ink} />
              <Stroke d={`M${h1x.toFixed(1)} ${h1y.toFixed(1)} L${endX.toFixed(1)} ${endY.toFixed(1)} L${h2x.toFixed(1)} ${h2y.toFixed(1)}`} p={arcP(i) > 0.9 ? 1 : 0} w={8} color={PAPER.ink} />
            </React.Fragment>
          );
        })}
        {nodes.map((label, i) => {
          const x = cx + Math.cos(ang(i)) * ARC_R, y = cy + Math.sin(ang(i)) * ARC_R, pr = nodeP(i);
          const col = BADGE_COLORS[i % BADGE_COLORS.length];
          return (
            <div key={i} style={{position: 'absolute', left: x - bd / 2, top: y - bd / 2, width: bd, height: bd, opacity: Math.min(1, pr * 2), transform: `scale(${0.6 + 0.4 * pr}) rotate(${(1 - pr) * -8}deg)`}}>
              <div style={{position: 'absolute', inset: 0, borderRadius: '50%', transform: 'translate(8px, 8px)', ...HALFTONE, WebkitMaskImage: 'radial-gradient(circle, #000 69%, transparent 70%)'}} />
              <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: col, border: `${line}px solid ${PAPER.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22}}>
                <span style={{fontFamily, fontWeight: 700, fontSize: n <= 3 ? 38 : 34, lineHeight: 1.2, color: '#fff', textAlign: 'center', textWrap: 'balance'}}>{label}</span>
              </div>
              <Chip u={U} color={PAPER.ink} size={30} style={{position: 'absolute', left: -6, top: 0}}>{i + 1}</Chip>
            </div>
          );
        })}
        {n > 1 && chipP > 0 && (
          <div style={{position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * chipP}) rotate(-3deg)`, opacity: chipP}}>
            <Chip u={U} color={PAPER.ink} size={44}>lặp lại</Chip>
          </div>
        )}
      </div>
    </div>
  );
};
