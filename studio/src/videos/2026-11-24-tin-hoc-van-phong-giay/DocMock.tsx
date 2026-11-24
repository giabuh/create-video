// DocMock: a paper document page placed beside footage. toc = messy headings snap to uniform ones, then a table of contents
// builds itself; merge = a letter with a «Tên» field, copies fan out behind it, a counter counts up. See components.md.
import React from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../../fonts';
import {Chip, PAPER, PaperCard} from '../../paper/paper';
import {choice, numDefault, optText, z, type MotionProps} from '../../motion/schema';

const beat = (title: string, value: number) => numDefault(title, value, {min: -1, max: 60, step: 0.1});
const list = (title: string, value: string[]) => z.array(z.string()).default(value).meta({title, ui: 'lines'});

export const DocMockSchema = z.object({
  variant: choice('Kiểu trang', ['toc', 'merge'], 'toc', {toc: 'Mục lục tự dựng', merge: 'Trộn thư hàng loạt'}),
  headings: list('Các đề mục (tối đa 5)', ['Giới thiệu', 'Số liệu quý', 'Kết luận']),
  names: list('Tên người nhận (để trống: hiện «Tên»)', ['Chị Lan', 'Anh Minh', 'Cô Hạnh', 'Anh Tuấn']),
  count: numDefault('Số thư (bộ đếm)', 50, {min: 1, max: 9999, step: 1}),
  tag: optText('Nhãn nhỏ (VD: Minh họa)'),
  styleAt: beat('Đề mục đều nhau lúc (giây, -1 = không)', 1),
  tocAt: beat('Mục lục hiện lúc (giây, -1 = không)', 2.5),
  fieldAt: beat('Vòng tròn quanh «Tên» lúc (giây, -1 = không)', 0.8),
  fanAt: beat('Thư xoè ra lúc (giây, -1 = không)', 1.8),
  countAt: beat('Bộ đếm lúc (giây, -1 = không)', 2.6),
});

// Fixed internal canvas (px at 1080p), scaled to fit the area.
const U = 1080, CW = 516, CH = 800, PW = 440, PH = 620, PAD = 20;
const PEEK = 42, DX = 16, MAX_COPIES = 4;
const GREY = 'rgba(30,36,51,.13)';
const LINE_W = [100, 94, 98, 72, 96, 88, 100, 64];
const ease = Easing.out(Easing.cubic);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const Bar: React.FC<{w?: number; h?: number; style?: React.CSSProperties}> = ({w = 100, h = 12, style}) => (
  <div style={{width: `${w}%`, height: h, borderRadius: h / 2, background: GREY, ...style}} />
);
const Lines: React.FC<{n: number; seed?: number; last?: number}> = ({n, seed = 0, last = 56}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
    {Array.from({length: n}, (_, k) => <Bar key={k} w={k === n - 1 ? last : LINE_W[(k * 3 + seed) % 8]} />)}
  </div>
);

const MESSY = {size: [20, 30, 23, 26, 21], indent: [0, 26, 10, 18, 4], rot: [0.8, -0.6, 0.5, -0.8, 0.6]};
const CLEAN_SIZE = 28;

export const DocMock: React.FC<MotionProps<typeof DocMockSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  // beat -1 = never, 0 = already done; otherwise eased 0..1 over `dur` s after the beat (+ stagger delay)
  const prog = (at: number, dur: number, delay = 0) =>
    at < 0 ? 0 : at === 0 ? 1 : ease(Math.min(1, Math.max(0, (t - at - delay) / dur)));

  const s = Math.min(p.area.width / CW, p.area.height / CH) * 0.96;
  const enter = ease(Math.min(1, t / 0.4));
  const out = Math.min(1, Math.max(0, (t - (p.layerSeconds - 0.25)) / 0.25));
  const group: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, width: CW, height: CH,
    opacity: 1 - out, transform: `translateY(${(enter - 1) * 20 + out * 24}px) rotate(${-1 - 2 * (1 - enter)}deg)`, transformOrigin: '50% 50%',
  };
  const isToc = p.variant === 'toc';
  const heads = p.headings.filter((h) => h.trim()).slice(0, 5);
  const names = p.names.filter((n) => n.trim());
  const copies = Math.min(MAX_COPIES, names.length || 3);
  const fan = prog(p.fanAt, 0.5);
  const cardY = isToc ? (CH - PH) / 2 : lerp((CH - PH) / 2, CH - PH - 8, fan);
  const cardX = isToc ? (CW - PW) / 2 : lerp((CW - PW) / 2, 0, fan);

  // ---- toc page ----
  const n = heads.length;
  const bodyLines = n <= 3 ? 3 : n === 4 ? 1 : 0;
  const tocP = (i: number) => prog(p.tocAt, 0.35, 0.2 + i * 0.22);
  const tocEnd = p.tocAt > 0 ? p.tocAt + 0.2 + n * 0.22 + 0.2 : p.tocAt;
  const tocPage = (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, height: '100%', overflow: 'hidden'}}>
      <Bar w={46} h={14} />
      {p.tocAt !== -1 && (
        <div style={{border: `2px dashed ${p.tocAt > 0 ? `rgba(30,36,51,${lerp(0.22, 0, prog(p.tocAt, 0.3))})` : 'transparent'}`, borderRadius: 8, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 4, minHeight: 34 + n * 30 + 20}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: prog(p.tocAt, 0.3)}}>
            <span style={{fontFamily: PAPER.serif, fontWeight: 700, fontSize: 26, lineHeight: 1.3, color: PAPER.ink}}>Mục lục</span>
            <span style={{opacity: prog(tocEnd, 0.3), transform: `scale(${lerp(0.8, 1, prog(tocEnd, 0.3))})`}}>
              <Chip u={U} color={PAPER.sage} size={20}>tự cập nhật</Chip>
            </span>
          </div>
          {heads.map((h, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'baseline', gap: 8, height: 30, opacity: tocP(i), transform: `translateX(${(tocP(i) - 1) * 14}px)`}}>
              <span style={{fontFamily, fontSize: 22, lineHeight: 1.3, color: PAPER.ink, whiteSpace: 'nowrap'}}>{h}</span>
              <span style={{flex: 1, borderBottom: `3px dotted ${PAPER.muted}`, transform: `translateY(-4px) scaleX(${tocP(i)})`, transformOrigin: 'left'}} />
              <span style={{fontFamily: PAPER.mono, fontWeight: 700, fontSize: 22, lineHeight: 1.3, color: PAPER.ink}}>{1 + Math.floor(i * 1.5)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        {heads.map((h, i) => {
          const q = prog(p.styleAt, 0.35, i * 0.15);
          const done = q > 0.5;
          return (
            <div key={i} style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <div style={{display: 'flex', alignItems: 'center', paddingLeft: lerp(MESSY.indent[i], 0, q), transform: `rotate(${lerp(MESSY.rot[i], 0, q)}deg)`, transformOrigin: 'left'}}>
                <span style={{display: 'inline-flex', width: 38 * q, overflow: 'visible', flex: 'none', opacity: q}}>
                  <Chip u={U} size={20} style={{transform: `scale(${q})`}}>{i + 1}</Chip>
                </span>
                <span style={{fontFamily: done ? PAPER.serif : fontFamily, fontWeight: done || i % 2 ? 700 : 400, fontSize: lerp(MESSY.size[i], CLEAN_SIZE, q),
                  lineHeight: 1.3, color: PAPER.ink, letterSpacing: done ? '-0.01em' : 0}}>{h}</span>
              </div>
              {bodyLines > 0 && <Lines n={bodyLines} seed={i} />}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---- merge page ----
  const greet = (name: string | null, key?: React.Key) => (
    <div key={key} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 28, whiteSpace: 'nowrap'}}>
      <span style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily, fontWeight: 700, fontSize: 22, lineHeight: 1.3, color: PAPER.ink, minWidth: 0}}>
        Kính gửi
        {name === null ? (
          <span style={{position: 'relative', display: 'inline-block'}}>
            <Chip u={U} size={22} color="rgba(210,101,63,.18)" text={PAPER.terra}>«Tên»</Chip>
            <svg viewBox="0 0 100 46" preserveAspectRatio="none" style={{position: 'absolute', left: -14, top: -12, width: 'calc(100% + 28px)', height: 'calc(100% + 24px)', overflow: 'visible'}}>
              <path d="M 10 24 C 4 8, 40 0, 64 3 C 92 6, 99 18, 92 31 C 84 44, 40 46, 14 40 C 1 35, 1 22, 16 12" pathLength={1} fill="none" stroke={PAPER.terra}
                strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="1 1" strokeDashoffset={1 - prog(p.fieldAt, 0.5)} />
            </svg>
          </span>
        ) : <span style={{color: PAPER.terra, overflow: 'hidden', textOverflow: 'ellipsis'}}>{name},</span>}
        {name === null && ','}
      </span>
      <Chip u={U} color={PAPER.ink} size={20}>THƯ MỜI</Chip>
    </div>
  );
  const letterBody = (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20}}>
      <Bar w={58} h={16} />
      <Lines n={5} seed={1} />
      <Lines n={4} seed={4} />
      <Lines n={3} seed={2} last={40} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end', marginTop: 10}}>
        <Bar w={30} /><Bar w={22} />
      </div>
    </div>
  );
  const COPY_ROT = [1, -0.7, 1.2, -1];
  const copyEls = Array.from({length: copies}, (_, k) => k + 1).reverse().map((i) => {
    const q = prog(p.fanAt, 0.45, 0.1 + (i - 1) * 0.15);
    return (
      <div key={i} style={{position: 'absolute', left: 0, top: 0, width: PW, height: PH, opacity: q > 0 ? 1 : 0,
        transform: `translate(${cardX + i * DX * q}px, ${cardY - i * PEEK * q}px) rotate(${COPY_ROT[i - 1] * q}deg)`, transformOrigin: 'top left'}}>
        <PaperCard u={U} tape={false} pad={PAD - 6} style={{width: PW, height: PH}}>
          {greet(names.length ? names[(i - 1) % names.length] : '«Tên»')}
          {letterBody}
        </PaperCard>
      </div>
    );
  });
  const cp = prog(p.countAt, 1.2, 0.25);
  const num = p.countAt === 0 ? p.count : 1 + Math.round((p.count - 1) * cp);
  const pop = prog(p.countAt, 0.3);
  const pulse = p.countAt > 0 && t > p.countAt + 1.45 && t < p.countAt + 1.75 ? 1 + 0.15 * Math.sin(((t - p.countAt - 1.45) / 0.3) * Math.PI) : 1;
  const mergePage = (
    <>
      {greet(null)}
      {letterBody}
    </>
  );

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: '50%', top: '50%', width: CW, height: CH, transform: `translate(-50%, -50%) scale(${s})`, transformOrigin: '50% 50%'}}>
        <div style={group}>
          {!isToc && copyEls}
          <div style={{position: 'absolute', left: cardX, top: cardY, width: PW, height: PH}}>
            <PaperCard u={U} pad={PAD - 6} style={{width: PW, height: PH}}>{isToc ? tocPage : mergePage}</PaperCard>
            {p.tag && <Chip u={U} size={20} style={{position: 'absolute', left: 18, bottom: -14, transform: 'rotate(-3deg)'}}>{p.tag}</Chip>}
            {!isToc && p.countAt !== -1 && (
              <Chip u={U} size={32} style={{position: 'absolute', right: 26, bottom: 34, opacity: pop, transform: `rotate(-3deg) scale(${lerp(0.7, 1, pop) * pulse})`, padding: '6px 16px'}}>
                × {num}
              </Chip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
