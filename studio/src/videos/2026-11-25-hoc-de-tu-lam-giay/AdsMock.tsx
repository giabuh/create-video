// AdsMock: full-frame paper page with a portrait "ads manager" sketch. A labelled cursor "Bạn" walks the 4 steps on the voice:
// each section activates, its sketch animates, earlier ones get a sage check; a hand-drawn circle closes the last chart.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {z, optText, text, type MotionProps} from '../../motion/schema';
import {fontFamily} from '../../fonts';
import {PaperCanvas} from '../../paper/PaperCanvas';
import {Chip, PAPER, PaperCard, paperDims, Tape, Title} from '../../paper/paper';

export const AdsMockSchema = z.object({
  title: text('Tiêu đề').default('Chạy quảng cáo'),
  tag: optText('Nhãn cạnh tiêu đề'),
  steps: z.array(z.string()).min(1).default(['Tạo chiến dịch', 'Chọn khách hàng', 'Thiết lập ngân sách', 'Theo dõi & tối ưu']).meta({title: 'Các bước (tối đa 4)', ui: 'lines'}),
  itemsAt: z.array(z.string()).optional().describe('Từ trong lời đọc để mở từng bước (prepare.py tự tính giờ)'),
  itemTimes: z.array(z.number().nullable()).optional().describe('Giờ mở từng bước (giây, tự tính từ itemsAt)'),
  product: optText('Tên sản phẩm (nhãn xanh lá ở thanh trên)'),
});

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const GRID = 'rgba(30,36,51,.2)', HEAD_BG = '#EFE8D8';

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

// layout (px at 1080 wide)
const WIN_W = 900, HEAD_H = 92, SEC_H = 280, LABEL_H = 84, PAD_X = 48;
const U = 1500; // paper line / shadow scale
const INNER_W = WIN_W - 2 * paperDims(U).line;

const Person: React.FC<{blue: number}> = ({blue}) => (
  <svg width={56} height={67} viewBox="0 0 40 48" style={{display: 'block', overflow: 'visible'}}>
    <g fill={blue > 0 ? PAPER.blue : 'none'} stroke={blue > 0 ? PAPER.blue : 'rgba(30,36,51,.45)'} strokeWidth={2.2} style={{transform: `scale(${1 + 0.18 * Math.sin(Math.PI * clamp(blue))})`, transformOrigin: '20px 30px'}}>
      <circle cx={20} cy={14} r={9} />
      <path d="M4 46 C4 32 12 27 20 27 C28 27 36 32 36 46 Z" />
    </g>
  </svg>
);

const Check: React.FC<{k: number}> = ({k}) => k <= 0 ? null : (
  <svg width={52} height={52} viewBox="0 0 52 52" style={{opacity: clamp(k * 2), transform: `scale(${0.6 + 0.4 * ease(k)})`}}>
    <circle cx={26} cy={26} r={24} fill={PAPER.sage} />
    <path d="M14 27 L23 36 L39 17" fill="none" stroke={PAPER.card} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1.01" strokeDashoffset={1 - clamp(k * 1.6)} />
  </svg>
);

const SELECTED = new Set([1, 2, 5, 8, 10, 11, 13]);
const CHART = [0.2, 0.34, 0.28, 0.46, 0.4, 0.56, 0.5];
const CHART_W = 640, CHART_H = 130, CHART_TOP = 114; // CHART_TOP: chart offset inside its section

/** Sketch bodies, one per step; s = seconds since this step started. */
const Body: React.FC<{k: number; s: number}> = ({k, s}) => {
  if (k === 0) {
    const sel = ease((s - 0.35) / 0.3);
    return (
      <div style={{display: 'flex', gap: 20, padding: `0 ${PAD_X}px`}}>
        {['Nhắn tin', 'Truy cập', 'Mua hàng'].map((l, i) => {
          const on = i === 0;
          const pop = ease((s - 0.1 * i) / 0.3);
          return (
            <div key={l} style={{position: 'relative', flex: 1, height: 84, boxSizing: 'border-box', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2.5px solid ${PAPER.ink}`, background: PAPER.card, fontFamily, fontWeight: 700, fontSize: 30, color: PAPER.ink, opacity: pop, transform: `translateY(${(1 - pop) * 12}px)`}}>
              {l}
              {on && sel > 0 && <div style={{position: 'absolute', inset: -6, borderRadius: 18, border: `6px solid ${PAPER.terra}`, opacity: sel, transform: `scale(${1.08 - 0.08 * sel})`}} />}
            </div>
          );
        })}
      </div>
    );
  }
  if (k === 1) {
    let rank = 0;
    const ranks = Array.from({length: 16}, (_, i) => (SELECTED.has(i) ? rank++ : -1));
    return (
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(8, 56px)', columnGap: 54, rowGap: 14, padding: `0 ${PAD_X + 6}px`, justifyContent: 'center'}}>
        {ranks.map((r, i) => <Person key={i} blue={r < 0 ? 0 : (s - 0.25 - r * 0.07) / 0.25} />)}
      </div>
    );
  }
  if (k === 2) {
    const knob = lerp(0.08, 0.6, ease(s / 0.8));
    const TW = 520, field = ease((s - 0.2) / 0.3);
    return (
      <div style={{position: 'relative', height: 100, margin: `0 ${PAD_X}px`}}>
        <div style={{position: 'absolute', left: 0, top: 46, width: TW, height: 8, borderRadius: 4, background: GRID}} />
        <div style={{position: 'absolute', left: 0, top: 46, width: TW * knob, height: 8, borderRadius: 4, background: PAPER.ink}} />
        <div style={{position: 'absolute', left: TW * knob - 24, top: 26, width: 48, height: 48, borderRadius: 24, boxSizing: 'border-box', background: PAPER.terra, border: `4px solid ${PAPER.ink}`}} />
        <div style={{position: 'absolute', left: TW + 40, top: 14, right: 0, height: 72, boxSizing: 'border-box', border: `2.5px solid ${PAPER.ink}`, borderRadius: 12, background: PAPER.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: PAPER.mono, fontWeight: 700, fontSize: 32, color: PAPER.ink, opacity: field, transform: `translateY(${(1 - field) * 10}px)`}}>___ đ/ngày</div>
      </div>
    );
  }
  // k === 3: line chart that draws itself, then the last point is nudged up
  const draw = clamp(s / 0.6), nudge = ease((s - 0.65) / 0.3), fl = s >= 0.65 && s < 1.2 ? 1 - (s - 0.65) / 0.55 : 0;
  const px = (i: number) => (i / (CHART.length - 1)) * CHART_W;
  const py = (v: number) => CHART_H - 10 - v * (CHART_H - 20) * 1.1;
  const ys = CHART.map((v, i) => (i === CHART.length - 1 ? lerp(v, 0.84, nudge) : v));
  const dPath = ys.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  return (
    <div style={{position: 'relative', height: CHART_H, marginTop: CHART_TOP - LABEL_H - 10, marginLeft: (INNER_W - CHART_W) / 2}}>
      <svg width={CHART_W} height={CHART_H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {[0.25, 0.55, 0.85].map((g) => <line key={g} x1={0} x2={CHART_W} y1={py(g)} y2={py(g)} stroke={GRID} strokeWidth={2} strokeDasharray="6 8" />)}
        <path d={dPath} fill="none" stroke={PAPER.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1.01" strokeDashoffset={1 - draw} />
        {ys.map((v, i) => {
          const last = i === ys.length - 1;
          const shown = draw >= i / (ys.length - 1);
          return shown ? <circle key={i} cx={px(i)} cy={py(v)} r={last ? 11 : 7} fill={last ? PAPER.terra : PAPER.card} stroke={PAPER.ink} strokeWidth={3.5} /> : null;
        })}
        {fl > 0 && <circle cx={px(ys.length - 1)} cy={py(ys[ys.length - 1])} r={11 + 30 * (1 - fl)} fill="none" stroke={PAPER.terra} strokeWidth={5} opacity={fl} />}
      </svg>
    </div>
  );
};

export const AdsMock: React.FC<MotionProps<typeof AdsMockSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const {width, height} = p.area;
  const L = p.layerSeconds;
  const steps = p.steps.slice(0, 4);
  const n = steps.length;

  // step times: voice times when present, else an even stagger; kept ascending and early enough that the last step still lands before the exit
  const gap = n > 1 ? Math.min(0.9, Math.max(0.3, (L - 2.4) / n)) : 0;
  let prev = -Infinity;
  const at = steps.map((_, i) => {
    const raw = p.itemTimes?.[i];
    const v = Math.max(typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.2 + i * gap, prev + 0.2);
    prev = v;
    return v;
  }).map((v, i) => Math.max(0, Math.min(v, L - 0.25 - 1.5 - (n - 1 - i) * 0.2)));

  const active = at.reduce((a, v, i) => (t >= v ? i : a), -1);
  const circleStart = n >= 4 ? at[3] + 0.8 : Infinity;

  const enter = ease(t / 0.45), titleIn = ease(t / 0.4);
  const out = clamp((t - (L - 0.25)) / 0.25);
  const {line} = paperDims(U);
  const WIN_H = HEAD_H + n * SEC_H + 2 * line;
  const winTop = Math.min(330, height * 0.84 - 40 - WIN_H);
  const winLeft = (width - WIN_W) / 2;
  const secTop = (i: number) => HEAD_H + i * SEC_H;

  // cursor: glides between section anchors
  let cur = {x: WIN_W + 30, y: 30};
  let curVis = 0;
  steps.forEach((_, i) => {
    const s = t - at[i];
    if (s < 0) return;
    const to = {x: INNER_W - 250, y: secTop(i) + 22};
    const k = ease(s / 0.55);
    cur = {x: lerp(cur.x, to.x, k), y: lerp(cur.y, to.y, k)};
    curVis = clamp(s / 0.2);
  });

  const cc = {x: INNER_W / 2, y: secTop(3) + CHART_TOP + CHART_H / 2};
  const circleD = handCircle(cc.x, cc.y, CHART_W / 2 + 55, CHART_H / 2 + 18, 2.1);
  const cp = clamp((t - circleStart) / 0.5);

  return (
    <AbsoluteFill>
      <PaperCanvas width={width} height={height} />
      <AbsoluteFill style={{opacity: 1 - out, transform: `translateY(${out * 14}px)`}}>
        {/* title block (logo plate sits top-right) */}
        <div style={{position: 'absolute', left: 76, top: 118, display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start', opacity: titleIn, transform: `translateX(${(1 - titleIn) * -90}px)`}}>
          <Title u={1080} size={76}>{p.title}</Title>
          <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
            {p.tag && (
              <div style={{position: 'relative'}}>
                <Chip u={1080} color={PAPER.ink} size={30}>{p.tag}</Chip>
                <Tape u={1080} style={{top: -14, right: -26, width: 48, height: 18}} />
              </div>
            )}
            <Chip u={1080} size={28} style={{transform: 'rotate(2deg)'}}>Minh họa</Chip>
          </div>
        </div>

        {/* the window */}
        <div style={{position: 'absolute', left: winLeft, top: winTop, width: WIN_W, height: WIN_H, opacity: enter, transform: `translateY(${(1 - enter) * -70}px) rotate(${(1 - enter) * -2.5}deg)`, transformOrigin: '50% 0'}}>
          <PaperCard u={U} tape={false} pad={0} style={{width: WIN_W, height: WIN_H}}>
            <div style={{position: 'relative', width: INNER_W, height: WIN_H - 2 * line}}>
              {/* header bar */}
              <div style={{position: 'absolute', left: 0, top: 0, width: INNER_W, height: HEAD_H, boxSizing: 'border-box', background: HEAD_BG, borderBottom: `2px solid ${PAPER.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${PAD_X}px`}}>
                {p.product ? <Chip u={1080} color={PAPER.sage} size={30} style={{borderRadius: 30, padding: '8px 26px'}}>{p.product}</Chip> : <span />}
                <div style={{display: 'flex', gap: 12}}>{[0, 1, 2].map((i) => <div key={i} style={{width: 18, height: 18, borderRadius: 9, border: `2.5px solid ${PAPER.ink}`, boxSizing: 'border-box'}} />)}</div>
              </div>
              {/* sections */}
              {steps.map((label, i) => {
                const s = t - at[i];
                const started = s >= 0;
                const isActive = i === active;
                const k = ease(s / 0.35);
                const done = active > i ? clamp((t - at[i + 1] - 0.15) / 0.4) : 0;
                return (
                  <div key={i} style={{position: 'absolute', left: 0, top: secTop(i), width: INNER_W, height: SEC_H, boxSizing: 'border-box', borderBottom: i < n - 1 ? `1.5px solid ${GRID}` : undefined}}>
                    {isActive && <div style={{position: 'absolute', inset: 8, border: `${5}px solid ${PAPER.ink}`, borderRadius: 14, opacity: k}} />}
                    <div style={{position: 'relative', height: LABEL_H, display: 'flex', alignItems: 'center', gap: 22, padding: `0 ${PAD_X}px`, opacity: started ? lerp(0.6, 1, k) : 0.42}}>
                      <Chip u={1080} color={started ? PAPER.ink : PAPER.muted} size={30}>{String(i + 1).padStart(2, '0')}</Chip>
                      <span style={{fontFamily: PAPER.serif, fontWeight: 700, fontSize: 44, color: started ? PAPER.ink : PAPER.muted, whiteSpace: 'nowrap', lineHeight: 1.2}}>{label}</span>
                      <div style={{marginLeft: 'auto'}}><Check k={done} /></div>
                    </div>
                    {started && <div style={{opacity: ease(s / 0.25), paddingTop: 10}}><Body k={i} s={s} /></div>}
                  </div>
                );
              })}
              {cp > 0 && (
                <svg style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none'}}>
                  <path d={circleD} pathLength={1} fill="none" stroke={PAPER.terra} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1.01" strokeDashoffset={1 - cp} />
                </svg>
              )}
              {/* cursor */}
              {curVis > 0 && (
                <div style={{position: 'absolute', left: cur.x, top: cur.y, opacity: curVis, pointerEvents: 'none'}}>
                  <svg width={40} height={48} viewBox="0 0 30 36" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
                    <path d="M2 2 L2 29 L9 22.5 L14 34 L19 31.5 L14 20.5 L24 20.5 Z" fill={PAPER.ink} stroke={PAPER.card} strokeWidth={2.5} strokeLinejoin="round" />
                  </svg>
                  <span style={{position: 'absolute', left: 46, top: 0}}><Chip u={1080} color={PAPER.ink} size={28}>Bạn</Chip></span>
                </div>
              )}
            </div>
          </PaperCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
