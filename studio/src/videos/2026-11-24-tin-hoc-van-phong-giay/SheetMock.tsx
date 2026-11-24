// SheetMock: an illustrative spreadsheet on paper. A labelled cursor types a formula, references are colour-matched to cells,
// a breakdown appears, an edit recomputes the sheet, a condition colours negative cells. Designed at a fixed internal size and scaled to the area.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {z, numDefault, bool, type MotionProps} from '../../motion/schema';
import {fontFamily} from '../../fonts';
import {Chip, PAPER, PaperCard, paperDims} from '../../paper/paper';

const numOpt = (title: string) => z.number().optional().meta({title});
const strDef = (title: string, v: string) => z.string().default(v).meta({title});
const linesDef = (title: string, v: string[]) => z.array(z.string()).min(1).default(v).meta({title, ui: 'lines'});
const beat = (title: string, v: number) => numDefault(title + ' (giây, -1 = không, 0 = có sẵn)', v, {min: -1, max: 120, step: 0.1});

export const SheetMockSchema = z.object({
  columns: linesDef('Tên cột', ['Tháng', 'Thu', 'Chi', 'Còn lại']),
  rows: linesDef('Dòng dữ liệu (nhãn|thu|chi)', ['1|40|31', '2|42|30', '3|38|41', '4|45|32', '5|44|35', '6|46|34']),
  rowStart: numDefault('Số dòng đầu của dữ liệu', 4, {min: 2, max: 900, step: 1}),
  unit: strDef('Đơn vị (thanh công thức)', 'triệu đ'),
  tag: strDef('Nhãn cạnh bảng', 'Minh họa'),
  totalRow: bool('Có dòng Tổng', true),
  formulaRow: numOpt('Dòng viết công thức (0 = đầu; trống = dòng cuối)'),
  editRow: numOpt('Dòng được sửa số thu (0 = đầu)'),
  editTo: numOpt('Số thu mới'),
  breakdown: bool('Hiện thẻ tách phép tính', true),
  cursorAt: beat('Con trỏ', 0.3), typeAt: beat('Gõ công thức', 1), circleAt: beat('Vòng tròn', 2.2), refsAt: beat('Tô màu tham chiếu', 3),
  breakdownAt: beat('Thẻ tách phép tính', 4), editAt: beat('Sửa số', 7), condAt: beat('Tô đỏ ô âm', -1),
});

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** seconds since a beat: -Infinity = never, +Infinity = already done at layer start */
const since = (at: number, t: number) => (at < 0 ? -Infinity : at === 0 ? Infinity : t - at);
const fmt = (n: number) => { const r = Math.round(n * 100) / 100; return (r < 0 ? '−' : '') + String(Math.abs(r)).replace('.', ','); };
const flash = (e: number, t0: number) => (e >= t0 && e < t0 + 0.6 ? 1 - (e - t0) / 0.6 : 0);
const count = (from: number, to: number, e: number, t0: number, dur = 0.5) => {
  const v = lerp(from, to, clamp((e - t0) / dur));
  return Number.isInteger(from) && Number.isInteger(to) ? Math.round(v) : v;
};
const LETTERS = 'ABCDEFGH';
const RED = '#B3261E', RED_BG = '#F7D3CC', HEAD_BG = '#EFE8D8', GRID = 'rgba(30,36,51,.2)';

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
const Circle: React.FC<{d: string; p: number}> = ({d, p}) => p <= 0 ? null : (
  <svg style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none'}}>
    <path d={d} pathLength={1} fill="none" stroke={PAPER.terra} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1.01" strokeDashoffset={1 - p} />
  </svg>
);

type Row = {label: string; inc: number; cost: number};
const parseRows = (rows: string[]): Row[] => rows.flatMap((l) => {
  const [label, a, b, ...rest] = l.split('|').map((s) => s.trim());
  const inc = a === undefined || a === '' ? NaN : Number(a.replace(',', '.'));
  const cost = b === undefined || b === '' ? NaN : Number(b.replace(',', '.'));
  return label && !rest.length && Number.isFinite(inc) && Number.isFinite(cost) ? [{label, inc, cost}] : [];
});
const inRange = (i: number | undefined, n: number): i is number => i !== undefined && Number.isInteger(i) && i >= 0 && i < n;

// internal layout (px at scale 1)
const G = 56, CW = [220, 200, 200, 204], FB = 72, LET = 40, RH = 56, TAB = 50, TOP = 56, GAP = 60, BW = 360;
const colX = (c: number) => G + CW.slice(0, c).reduce((a, b) => a + b, 0);
const SW = G + CW.reduce((a, b) => a + b, 0);

export const SheetMock: React.FC<MotionProps<typeof SheetMockSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const rows = parseRows(p.rows);
  const n = rows.length;
  if (!n) return null;
  const rs = Math.round(p.rowStart);
  const cols = [0, 1, 2, 3].map((i) => p.columns[i] ?? '');
  const fRow = p.formulaRow === undefined ? n - 1 : inRange(p.formulaRow, n) ? p.formulaRow : -1;
  const eRow = inRange(p.editRow, n) && p.editTo !== undefined && Number.isFinite(p.editTo) ? p.editRow : -1;
  const showTotal = p.totalRow;
  const formula = fRow >= 0 ? `=B${rs + fRow}-C${rs + fRow}` : '';
  const segs = fRow >= 0 ? [{s: '='}, {s: `B${rs + fRow}`, k: 0}, {s: '-'}, {s: `C${rs + fRow}`, k: 1}] : [];

  // ---- state at time t
  const eT = eRow >= 0 ? since(p.editAt, t) : -Infinity;
  const typeS = fRow >= 0 ? since(p.typeAt, t) : -Infinity;
  const typed = typeS === Infinity ? formula.length : typeS < 0 ? 0 : Math.min(formula.length, Math.floor(typeS / 0.06) + 1);
  const typeEnd = p.typeAt * 1 + formula.length * 0.06 + 0.2;
  const dVis = fRow < 0 || p.typeAt < 0 || p.typeAt === 0 || t >= typeEnd; // a never-typed formula leaves the sheet complete
  const typeFlash = p.typeAt > 0 && fRow >= 0 ? flash(t - typeEnd, 0) : 0;
  const refS = fRow >= 0 ? since(p.refsAt, t) : -Infinity;
  const ref = (k: number) => clamp((refS - k * 0.15) / 0.25);

  const baseD = rows.map((r) => r.inc - r.cost);
  const incAt = (i: number) => (i === eRow && eT >= 0.7 ? p.editTo! : rows[i].inc);
  const dAt = (i: number) => (i === eRow ? count(baseD[i], p.editTo! - rows[i].cost, eT, 1.0) : baseD[i]);
  const dVals = rows.map((_, i) => dAt(i));
  const baseTotal = baseD.reduce((a, b) => a + b, 0);
  const newTotal = eRow >= 0 ? baseTotal - baseD[eRow] + (p.editTo! - rows[eRow].cost) : baseTotal;
  const total = eRow >= 0 ? count(baseTotal, newTotal, eT, 1.7) : baseTotal;

  // ---- geometry
  const {line} = paperDims(Math.min(SW, 700));
  const SH = FB + LET + RH * (n + 1 + (showTotal ? 1 : 0)) + TAB;
  const rowY = (i: number) => FB + LET + RH * (i + 1);
  const cellC = (r: number, c: number) => ({x: colX(c) + CW[c] / 2, y: rowY(r) + RH / 2});
  const showB = p.breakdown && fRow >= 0;
  const IW = SW + 2 * line + 14 + (showB ? GAP + BW : 0), IH = TOP + SH + 2 * line + 14;
  const full = p.area.width >= 1500 && p.area.height >= 900; // full frame: keep the title band (top 15%) and caption band (bottom 14%) free
  const bandTop = full ? p.area.height * 0.15 : p.area.height * 0.02, bandH = full ? p.area.height * 0.71 : p.area.height * 0.96;
  const sc = Math.min((p.area.width * (full ? 0.9 : 0.96)) / IW, bandH / IH);

  // ---- cursor
  const wps = [
    ...(fRow >= 0 ? [{at: p.cursorAt, ...cellC(fRow, 3)}] : []),
    ...(eRow >= 0 ? [{at: p.editAt, ...cellC(eRow, 1)}] : []),
  ].filter((w) => w.at >= 0).sort((a, b) => a.at - b.at);
  let cur = {x: SW - 60, y: SH - 30}, curVis = 0;
  for (const w of wps) {
    const s = since(w.at, t);
    cur = {x: lerp(cur.x, w.x, ease(s / 0.7)), y: lerp(cur.y, w.y, ease(s / 0.7))};
    if (s > 0 && p.cursorAt >= 0) curVis = clamp(s / 0.2);
  }

  // ---- condition
  const cS = since(p.condAt, t);
  const neg: {r: number; v: number}[] = [...dVals.map((v, r) => ({r, v})), ...(showTotal ? [{r: n, v: total}] : [])].filter(({r, v}) => v < 0 && (r === n ? dVis : r !== fRow || dVis));
  const negIdx = (r: number) => neg.findIndex((x) => x.r === r);
  const negP = (r: number) => (negIdx(r) < 0 ? 0 : clamp((cS - negIdx(r) * 0.2) / 0.3));

  // ---- timing of enter / exit
  const enter = p.typeAt === 0 ? 1 : ease(t / 0.4);
  const out = clamp((t - (p.layerSeconds - 0.25)) / 0.25);
  const bTime = since(p.breakdownAt, t);

  const gridCell = (x: number, y: number, w: number, h: number, content: React.ReactNode, o: {bg?: string; align?: 'left' | 'right' | 'center'; color?: string; mono?: boolean; bold?: boolean; size?: number; fl?: number} = {}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRight: `1px solid ${GRID}`, borderBottom: `1px solid ${GRID}`,
      background: o.bg, display: 'flex', alignItems: 'center', justifyContent: o.align === 'right' ? 'flex-end' : o.align === 'center' ? 'center' : 'flex-start',
      padding: '0 16px', fontFamily: o.mono ? PAPER.mono : fontFamily, fontWeight: o.mono || o.bold ? 700 : 400, fontSize: o.size ?? 26, color: o.color ?? PAPER.ink, lineHeight: 1.25, whiteSpace: 'nowrap'}}>
      {(o.fl ?? 0) > 0 && <div style={{position: 'absolute', inset: 0, background: PAPER.terra, opacity: 0.4 * o.fl!}} />}
      <span style={{position: 'relative'}}>{content}</span>
    </div>
  );
  const outline = (r: number, c: number, color: string, k: number) => k <= 0 ? null : (
    <div style={{position: 'absolute', left: colX(c) + 2, top: rowY(r) + 2, width: CW[c] - 4, height: RH - 4, boxSizing: 'border-box', border: `5px solid ${color}`, borderRadius: 5, opacity: k}} />
  );

  const formulaX = 262, fsz = 34, cw = fsz * 0.6;
  const fcx = formulaX + (formula.length * cw) / 2;
  const circleD = handCircle(fcx, FB / 2, formula.length * cw / 2 + 42, 38, 1.3);
  const cond0 = neg.find((x) => x.r < n) ?? neg[0];
  const c0 = cond0 ? cellC(cond0.r, 3) : {x: 0, y: 0};
  const condCircle = handCircle(c0.x, c0.y, CW[3] / 2 + 6, RH / 2 + 8, 4.1);
  const resultVal = dVals[fRow] ?? 0;

  const card = (key: string, at: number, color: string, label: string, value: string, fl: number) => {
    const k = ease((bTime - at) / 0.35);
    return k <= 0 ? null : (
      <div key={key} style={{position: 'relative', opacity: k, transform: `translateY(${(1 - k) * -26}px) rotate(${(1 - k) * -3}deg)`, marginBottom: 22}}>
        <PaperCard u={700} tape={false} pad={0} style={{width: BW}}>
          <div style={{position: 'relative', height: 96, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px'}}>
            <div style={{position: 'absolute', inset: 0, background: PAPER.terra, opacity: 0.35 * fl}} />
            <span style={{position: 'relative', fontFamily: PAPER.mono, fontWeight: 700, fontSize: 30, color: PAPER.muted}}>{label}</span>
            <span style={{position: 'relative', fontFamily: PAPER.serif, fontWeight: 700, fontSize: 58, color: PAPER.ink}}>{value}</span>
          </div>
          <div style={{position: 'absolute', inset: -line, border: `5px solid ${color}`, borderRadius: 6}} />
        </PaperCard>
      </div>
    );
  };
  const rk = ease((bTime - 0.7) / 0.3), resK = ease((bTime - 0.95) / 0.35);
  const bLeft = SW + 2 * line + 14 + GAP;
  const bStackH = 96 * 3 + 22 * 3 + 20;

  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: (p.area.width - IW * sc) / 2, top: bandTop + (bandH - IH * sc) / 2, width: IW, height: IH, transformOrigin: '0 0', transform: `scale(${sc})`,
        opacity: enter * (1 - out), translate: `0 ${(1 - enter) * -18 + out * 14}px`}}>
        {/* chips above the sheet */}
        <div style={{position: 'absolute', left: 0, top: 0, width: SW + 2 * line, height: TOP - 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>{neg.length > 0 && cS > 0 && <Chip u={700} size={26} style={{opacity: ease(cS / 0.3), display: 'inline-block', transform: `translateY(${(1 - ease(cS / 0.3)) * -10}px)`}}>Còn lại &lt; 0 → tô đỏ</Chip>}</div>
          <div style={{paddingRight: 14}}>{p.tag && <Chip u={700} size={24} style={{transform: 'rotate(2deg)'}}>{p.tag}</Chip>}</div>
        </div>
        <div style={{position: 'absolute', left: 0, top: TOP}}>
          <PaperCard u={700} tape={false} pad={0} style={{width: SW + 2 * line}}>
            <div style={{position: 'relative', width: SW, height: SH, overflow: 'visible'}}>
              {/* formula bar */}
              <div style={{position: 'absolute', left: 0, top: 0, width: SW, height: FB, borderBottom: `1px solid ${GRID}`, boxSizing: 'border-box'}}>
                <span style={{position: 'absolute', left: 16, top: 0, lineHeight: `${FB}px`, fontFamily: PAPER.mono, fontWeight: 700, fontSize: 28, color: PAPER.muted, fontStyle: 'italic'}}>fx</span>
                {p.unit && <span style={{position: 'absolute', left: 74, top: 17}}><Chip u={700} color={PAPER.ink} size={22}>{p.unit}</Chip></span>}
                <span style={{position: 'absolute', left: formulaX, top: 0, lineHeight: `${FB}px`, fontFamily: PAPER.mono, fontWeight: 700, fontSize: fsz, whiteSpace: 'pre', color: PAPER.ink}}>
                  {(() => {
                    let left = typed;
                    return segs.map((sg, i) => {
                      const part = sg.s.slice(0, Math.max(0, left)); left -= sg.s.length;
                      const done = part.length === sg.s.length;
                      const col = sg.k === undefined ? PAPER.ink : done && ref(sg.k) > 0 ? (sg.k === 0 ? PAPER.blue : PAPER.purple) : PAPER.ink;
                      return <span key={i} style={{color: col}}>{part}</span>;
                    });
                  })()}
                  {typed < formula.length && typeS > -Infinity && typeS >= 0 && Math.floor(t * 2) % 2 === 0 ? <span style={{color: PAPER.terra}}>|</span> : null}
                </span>
              </div>
              {/* column letters */}
              <div style={{position: 'absolute', left: 0, top: FB, width: SW, height: LET, background: HEAD_BG, borderBottom: `1px solid ${GRID}`, boxSizing: 'border-box'}} />
              {[0, 1, 2, 3].map((c) => gridCell(colX(c), FB, CW[c], LET, LETTERS[c], {bg: HEAD_BG, align: 'center', color: PAPER.muted, mono: true, size: 22}))}
              {/* header row + data rows + total */}
              {gridCell(0, FB + LET, G, RH, rs - 1, {bg: HEAD_BG, align: 'center', color: PAPER.muted, mono: true, size: 22})}
              {[0, 1, 2, 3].map((c) => gridCell(colX(c), FB + LET, CW[c], RH, cols[c], {bg: HEAD_BG, bold: true, align: c ? 'right' : 'left'}))}
              {rows.map((r, i) => {
                const dShow = i !== fRow || dVis;
                const neg0 = negP(i);
                return (
                  <React.Fragment key={i}>
                    {gridCell(0, rowY(i), G, RH, rs + i, {bg: HEAD_BG, align: 'center', color: PAPER.muted, mono: true, size: 22})}
                    {gridCell(colX(0), rowY(i), CW[0], RH, r.label, {})}
                    {gridCell(colX(1), rowY(i), CW[1], RH, fmt(incAt(i)), {align: 'right', mono: true, fl: i === eRow ? flash(eT, 0.7) : 0})}
                    {gridCell(colX(2), rowY(i), CW[2], RH, fmt(r.cost), {align: 'right', mono: true})}
                    {gridCell(colX(3), rowY(i), CW[3], RH, dShow ? fmt(dVals[i]) : '', {align: 'right', mono: true,
                      bg: neg0 > 0 ? `color-mix(in srgb, ${RED_BG} ${neg0 * 100}%, transparent)` : undefined, color: neg0 > 0.4 ? RED : PAPER.ink,
                      fl: i === eRow ? flash(eT, 1.0) : i === fRow ? typeFlash : 0})}
                  </React.Fragment>
                );
              })}
              {showTotal && (() => {
                const neg0 = negP(n);
                return (
                  <>
                    {gridCell(0, rowY(n), G, RH, rs + n, {bg: HEAD_BG, align: 'center', color: PAPER.muted, mono: true, size: 22})}
                    {gridCell(colX(0), rowY(n), CW[0], RH, 'Tổng', {bold: true})}
                    {gridCell(colX(1), rowY(n), CW[1], RH, '', {})}
                    {gridCell(colX(2), rowY(n), CW[2], RH, '', {})}
                    {gridCell(colX(3), rowY(n), CW[3], RH, dVis ? fmt(total) : '', {align: 'right', mono: true,
                      bg: neg0 > 0 ? `color-mix(in srgb, ${RED_BG} ${neg0 * 100}%, transparent)` : undefined, color: neg0 > 0.4 ? RED : PAPER.ink, fl: eRow >= 0 ? flash(eT, 1.7) : 0})}
                    <div style={{position: 'absolute', left: G, top: rowY(n), width: SW - G, borderTop: `3px solid ${PAPER.ink}`}} />
                  </>
                );
              })()}
              {/* sheet tab */}
              <div style={{position: 'absolute', left: 0, top: SH - TAB, width: SW, height: TAB, background: HEAD_BG, borderTop: `1px solid ${GRID}`, boxSizing: 'border-box'}}>
                <span style={{position: 'absolute', left: 20, top: 6, padding: '0 20px', lineHeight: '36px', background: PAPER.card, border: `1px solid ${PAPER.ink}`, borderTop: 'none', fontFamily, fontWeight: 700, fontSize: 22, color: PAPER.ink}}>Bảng thu chi</span>
              </div>
              {/* outlines, circles, cursor */}
              {fRow >= 0 && p.typeAt >= 0 && typed > 0 && outline(fRow, 3, PAPER.sage, 1)}
              {fRow >= 0 && outline(fRow, 1, PAPER.blue, ref(0))}
              {fRow >= 0 && outline(fRow, 2, PAPER.purple, ref(1))}
              {fRow >= 0 && formula && <Circle d={circleD} p={since(p.circleAt, t) === Infinity ? 1 : clamp(since(p.circleAt, t) / 0.5)} />}
              {cond0 && <Circle d={condCircle} p={clamp((cS - 0.2 * neg.length - 0.1) / 0.5)} />}
              {curVis > 0 && (
                <div style={{position: 'absolute', left: cur.x, top: cur.y, opacity: curVis, pointerEvents: 'none'}}>
                  <svg width={30} height={36} viewBox="0 0 30 36" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
                    <path d="M2 2 L2 29 L9 22.5 L14 34 L19 31.5 L14 20.5 L24 20.5 Z" fill={PAPER.ink} stroke={PAPER.card} strokeWidth={2.5} strokeLinejoin="round" />
                  </svg>
                  <span style={{position: 'absolute', left: -64, top: 30}}><Chip u={700} color={PAPER.ink} size={24}>Bạn</Chip></span>
                </div>
              )}
            </div>
          </PaperCard>
        </div>
        {/* breakdown cards */}
        {showB && (
          <div style={{position: 'absolute', left: bLeft, top: TOP + (SH - bStackH) / 2, width: BW + 14}}>
            {card('a', 0, PAPER.blue, 'thu', fmt(incAt(fRow)), fRow === eRow ? flash(eT, 0.7) : 0)}
            {card('b', 0.35, PAPER.purple, 'chi', `− ${fmt(rows[fRow].cost)}`, 0)}
            <div style={{width: BW * rk, height: 4, background: PAPER.ink, margin: '0 0 22px', opacity: rk > 0 ? 1 : 0}} />
            {resK > 0 && (
              <div style={{position: 'relative', opacity: resK, transform: `translateY(${(1 - resK) * -26}px) rotate(${(1 - resK) * 3}deg)`}}>
                <PaperCard u={700} tape={false} pad={0} style={{width: BW}}>
                  <div style={{position: 'relative', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAPER.terra, color: PAPER.card, fontFamily: PAPER.serif, fontWeight: 700, fontSize: 58,
                    boxShadow: fRow === eRow ? `inset 0 0 0 999px rgba(255,255,255,${0.3 * flash(eT, 1.0)})` : undefined}}>
                    <span style={{fontFamily: PAPER.mono, fontSize: 44, marginRight: 14}}>{LETTERS[3]}{rs + fRow} =</span>{fmt(resultVal)}
                  </div>
                </PaperCard>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
