// PaperNote: paper-style corner card over footage (step x/y, icon list, note). See projects/2026-11-24-tin-hoc-van-phong-giay/components.md.
// Laid out at a fixed internal size (u = 1080), measured with the real fonts, then scaled DOWN to fit the area (never overflows).
import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useFontsLoaded, widthOf} from '../../fit';
import {fontFamily} from '../../fonts';
import {choice, numDefault, optText, z, type MotionProps} from '../../motion/schema';
import {Chip, PAPER, PaperCard, paperDims, Tape, Title} from '../../paper/paper';

const ICONS = ['none', 'sheet', 'doc', 'letter', 'calc', 'warn', 'chat'] as const;
type Icon = (typeof ICONS)[number];

export const PaperNoteSchema = z.object({
  variant: choice('Kiểu thẻ', ['step', 'list', 'note'], 'step', {step: 'Bước x / y', list: 'Danh sách icon', note: 'Ghi chú'}),
  chip: optText('Nhãn mono (VD: Việc 1 / 3)'),
  chipColor: z.enum(['terra', 'ink']).optional().meta({title: 'Màu nhãn (mặc định: danh sách = mực, còn lại = đất nung)', labels: {terra: 'Đất nung', ink: 'Mực'}}),
  title: optText('Tiêu đề (serif)'),
  sub: optText('Dòng phụ (kiểu ghi chú)'),
  icon: choice('Icon', ICONS, 'none', {none: 'Không', sheet: 'Bảng tính', doc: 'Văn bản', letter: 'Thư', calc: 'Máy tính', warn: 'Cảnh báo', chat: 'Trò chuyện'}),
  step: numDefault('Bước hiện tại', 1, {min: 1, max: 12, step: 1}),
  total: numDefault('Tổng số bước', 3, {min: 1, max: 12, step: 1}),
  items: z.array(z.string()).default([]).meta({title: 'Mục "icon|Nhãn", mỗi dòng một mục', ui: 'lines'}),
  align: choice('Bám cạnh', ['left', 'right'], 'right', {left: 'Trái', right: 'Phải'}),
});

const U = 1080;
const ICON_COLOR: Record<Exclude<Icon, 'none'>, string> = {sheet: PAPER.sage, doc: PAPER.blue, letter: PAPER.purple, calc: PAPER.terra, warn: PAPER.terra, chat: PAPER.blue};
const ICON_PATH: Record<Exclude<Icon, 'none'>, React.ReactNode> = {
  sheet: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.2 4.5v15M14.8 4.5v15" /></>,
  doc: <><path d="M6 3.5h8.5L19 8v12.5H6z" /><path d="M14.5 3.5V8H19M9 12h7M9 15.5h7" /></>,
  letter: <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="M3.5 6.5l8.5 7 8.5-7" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="1.8" /><rect x="8" y="6" width="8" height="3.2" /><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" strokeWidth="2.6" /></>,
  warn: <><path d="M12 3.8L21.5 20h-19z" /><path d="M12 10v4.6M12 17.4h.01" strokeWidth="2.4" /></>,
  chat: <path d="M4 5.5h16v10.5H10.5L6.5 20v-4H4z" />,
};
const isIcon = (s: string): s is Exclude<Icon, 'none'> => s in ICON_PATH;

const IconDot: React.FC<{icon: Icon; d: number}> = ({icon, d}) => !isIcon(icon) ? null : (
  <div style={{flex: 'none', width: d, height: d, borderRadius: '50%', background: ICON_COLOR[icon], display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <svg width={d * 0.58} height={d * 0.58} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ICON_PATH[icon]}</svg>
  </div>
);

// "icon|Label"; a line without "|" is a label with no icon
const parseItem = (s: string): {icon: Icon; label: string} => {
  const i = s.indexOf('|');
  if (i < 0) return {icon: 'none', label: s.trim()};
  const k = s.slice(0, i).trim();
  return {icon: (ICONS as readonly string[]).includes(k) ? (k as Icon) : 'none', label: s.slice(i + 1).trim()};
};

export const PaperNote: React.FC<MotionProps<typeof PaperNoteSchema>> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {line} = paperDims(U);
  const pad = U * 0.02, m = U * 0.016; // m: room around the card for the shadow, tape and tilt
  const chipSize = U * 0.022, chipH = chipSize * 1.25 + 2 * U * 0.004;
  const chipText = p.chip?.trim() ?? '', title = p.title?.trim() ?? '', sub = p.sub?.trim() ?? '';
  const chipColor = (p.chipColor ?? (p.variant === 'list' ? 'ink' : 'terra')) === 'ink' ? PAPER.ink : PAPER.terra;
  const chipW = chipText ? widthOf(chipText, chipSize, 700, PAPER.mono) + 2 * U * 0.01 : 0;
  const total = Math.min(12, Math.max(1, Math.round(p.total))), cur = Math.min(total, Math.max(1, Math.round(p.step)));
  const dot = U * 0.014, dotGap = U * 0.007;
  const dotsW = total * dot + (total - 1) * dotGap;
  const circle = U * 0.078, gap = U * 0.016;

  const items = p.items.map(parseItem).filter((i) => i.label || i.icon !== 'none');
  const itemCircle = U * 0.07, labelSize = U * 0.024, itemGap = U * 0.026;
  const itemW = items.map((i) => Math.max(itemCircle, widthOf(i.label, labelSize, 700) + 2));

  const titleSize = p.variant === 'note' ? U * 0.036 : U * 0.04, subSize = U * 0.025;
  const titleW = title ? widthOf(title, titleSize, 700, PAPER.serif) + 4 : 0;
  const subW = sub ? widthOf(sub, subSize, 400) + 2 : 0;
  const titleH = titleSize * 1.25, subH = subSize * 1.3;

  // natural content size (px at U) per variant
  let cw: number, ch: number;
  if (p.variant === 'list') {
    const row = itemW.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * itemGap;
    cw = Math.max(chipW, row);
    ch = (chipText ? chipH + gap : 0) + (items.length ? itemCircle + U * 0.008 + labelSize * 1.3 : 0);
  } else if (p.variant === 'step') {
    const iconW = isIcon(p.icon) ? circle + gap : 0;
    const head = chipText ? chipW + gap + dotsW : dotsW;
    cw = iconW + Math.max(head, titleW);
    ch = Math.max(isIcon(p.icon) ? circle : 0, chipH + (title ? U * 0.008 + titleH : 0));
  } else {
    const iconW = isIcon(p.icon) ? circle + gap : 0;
    cw = iconW + Math.max(chipW, titleW, subW);
    ch = Math.max(isIcon(p.icon) ? circle : 0, (chipText ? chipH + U * 0.008 : 0) + (title ? titleH : 0) + (sub ? subH + U * 0.004 : 0));
  }
  const natW = cw + 2 * (pad + line) + 2 * m, natH = ch + 2 * (pad + line) + 2 * m;
  const scale = Math.min(1, p.area.width / natW, p.area.height / natH);

  // timing: card drops in over 0.4 s, tape lands 0.12 s later, own exit over the last 0.25 s
  const eo = Easing.out(Easing.cubic);
  const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  const enter = eo(interpolate(t, [0, 0.4], [0, 1], clamp));
  const tapeIn = eo(interpolate(t, [0.12, 0.4], [0, 1], clamp));
  const out = Easing.in(Easing.quad)(interpolate(t, [p.layerSeconds - 0.25, p.layerSeconds], [0, 1], clamp));
  const opacity = Math.min(enter * 2, 1) * (1 - out);
  const dy = (1 - enter) * -20 + out * 14, rot = -1 + (1 - enter) * -2;
  const pop = (i: number) => eo(interpolate(t, [0.4 + i * 0.15, 0.4 + i * 0.15 + 0.25], [0, 1], clamp));
  const right = p.align === 'right';

  const chipEl = chipText ? <Chip u={U} color={chipColor} size={chipSize}>{chipText}</Chip> : null;
  let body: React.ReactNode = null;
  if (p.variant === 'list') {
    body = (
      <div style={{display: 'flex', flexDirection: 'column', gap}}>
        {chipEl && <div>{chipEl}</div>}
        <div style={{display: 'flex', gap: itemGap, alignItems: 'flex-start'}}>
          {items.map((it, i) => (
            <div key={i} style={{width: itemW[i], display: 'flex', flexDirection: 'column', alignItems: 'center', gap: U * 0.008, opacity: pop(i), transform: `translateY(${(1 - pop(i)) * -10}px) scale(${0.85 + 0.15 * pop(i)})`}}>
              <IconDot icon={it.icon} d={itemCircle} />
              <div style={{fontFamily, fontWeight: 700, fontSize: labelSize, lineHeight: 1.3, color: PAPER.ink, whiteSpace: 'nowrap'}}>{it.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (p.variant === 'step') {
    body = (
      <div style={{display: 'flex', alignItems: 'center', gap}}>
        <IconDot icon={p.icon} d={circle} />
        <div style={{display: 'flex', flexDirection: 'column', gap: U * 0.008}}>
          <div style={{display: 'flex', alignItems: 'center', gap}}>
            {chipEl}
            <div style={{display: 'flex', gap: dotGap}}>
              {Array.from({length: total}, (_, i) => (
                <div key={i} style={{width: dot, height: dot, borderRadius: '50%', boxSizing: 'border-box', border: `${line}px solid ${i === cur - 1 ? PAPER.terra : PAPER.ink}`,
                  background: i < cur - 1 ? PAPER.ink : i === cur - 1 ? PAPER.terra : 'transparent'}} />
              ))}
            </div>
          </div>
          {title && <Title u={U} size={titleSize} style={{whiteSpace: 'nowrap'}}>{title}</Title>}
        </div>
      </div>
    );
  } else {
    body = (
      <div style={{display: 'flex', alignItems: 'center', gap}}>
        <IconDot icon={p.icon} d={circle} />
        <div style={{display: 'flex', flexDirection: 'column', gap: U * 0.008, alignItems: 'flex-start'}}>
          {chipEl}
          {title && <Title u={U} size={titleSize} style={{whiteSpace: 'nowrap'}}>{title}</Title>}
          {sub && <div style={{fontFamily, fontWeight: 400, fontSize: subSize, lineHeight: 1.3, color: PAPER.muted, whiteSpace: 'nowrap'}}>{sub}</div>}
        </div>
      </div>
    );
  }

  if (!loaded) return null;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: 0, [right ? 'right' : 'left']: 0, width: natW, height: natH, padding: m, boxSizing: 'border-box',
        transformOrigin: `top ${right ? 'right' : 'left'}`, transform: `scale(${scale})`}}>
        <div style={{opacity, transform: `translateY(${dy}px) rotate(${rot}deg)`, transformOrigin: 'center'}}>
          <PaperCard u={U} tape={false} style={{width: cw + 2 * (pad + line), height: ch + 2 * (pad + line)}}>
            <div style={{height: '100%', display: 'flex', alignItems: 'center'}}>{body}</div>
          </PaperCard>
          <Tape u={U} style={{top: -U * 0.011 - (1 - tapeIn) * 16, right: U * 0.03, opacity: tapeIn}} />
        </div>
      </div>
    </div>
  );
};
