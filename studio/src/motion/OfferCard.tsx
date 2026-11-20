import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {StampMark} from './Stamp';
import {choice, optText, text, z, type MotionProps} from './schema';
import {CARD_RADIUS, HARD_SHADOW, RADIUS, SOFT_SHADOW, inOut, stampImpact} from './style';

export const OfferCardSchema = z.object({
  label: optText('Nhãn nhỏ (VD: ƯU ĐÃI HỌC PHÍ)'),
  title: text('Chữ chính'),
  highlight: optText('Cụm được tô vàng (nằm trong chữ chính)'),
  stampTop: optText('Chữ nhỏ phía trên dấu (VD: GIẢM)'),
  stampMain: text('Chữ to trên dấu (VD: 35%)'),
  stampBottom: optText('Chữ nhỏ phía dưới dấu (VD: ĐĂNG KÝ NGAY)'),
  variant: choice('Kiểu thẻ', ['card', 'giant'], 'card', {card: 'Thẻ trắng + dấu tròn', giant: 'Số khổng lồ'}),
});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const EXIT = 0.27; // mockup 88% -> 94% of 4.5s

export const OfferCard: React.FC<MotionProps<typeof OfferCardSchema>> = ({label, title, highlight, stampTop, stampMain, stampBottom, variant, brand, layerSeconds, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const {primary, accent, background, accent2} = brand.colors;
  const exit = interpolate(t, [layerSeconds - EXIT, layerSeconds], [0, 1], clamp);
  const shake = stampImpact(frame, fps, 0.45).shake;
  const lay: React.CSSProperties = {justifyContent: 'center', alignItems: 'center', fontFamily, opacity: 1 - exit, transform: `translate(${shake.x}px, ${shake.y}px)`};
  const u = Math.min(1, area.width / 1080); // everything is designed at 1080 wide

  if (variant === 'giant') {
    const w = area.width - 192 * u;
    const inner = w - 120 * u;
    const big = loaded ? fitFontSize({text: stampMain, maxSize: 520 * u, width: inner, height: area.height * 0.4, weight: 900, wrap: false, lineHeight: 0.9, family: headingFamily}) : 520 * u;
    const ttl = loaded ? fitFontSize({text: title, maxSize: 78 * u, width: inner, height: area.height * 0.18, weight: 900}) : 78 * u;
    const s = interpolate(t, [0, 0.225, 0.315, 0.405], [1.7, 0.92, 1.04, 1], {...clamp, easing: Easing.out(Easing.quad)});
    const o = interpolate(t, [0, 0.225], [0, 1], clamp);
    return (
      <AbsoluteFill style={lay}>
        <div style={{position: 'relative', width: w}}>
          <div style={{background: accent, borderRadius: RADIUS, boxShadow: HARD_SHADOW(background), padding: `${54 * u}px ${60 * u}px`, textAlign: 'center',
            opacity: o, transform: `scale(${s * (1 - exit * 0.2)})`}}>
            <div style={{fontFamily: headingFamily, fontWeight: 900, fontSize: big, lineHeight: 0.9, color: background, whiteSpace: 'nowrap'}}>{stampMain}</div>
            {label && <div style={{fontWeight: 800, fontSize: 42 * u, letterSpacing: 3 * u, color: primary, marginTop: 24 * u}}>{label}</div>}
            <div style={{fontWeight: 900, fontSize: ttl, lineHeight: 1.15, color: background, marginTop: 6 * u}}>{title}</div>
          </div>
          {stampTop && (
            <div style={{position: 'absolute', top: -90 * u, right: -60 * u}}>
              <StampMark shape="round" lines={['', stampTop, stampBottom ?? '']} color={accent2} size={230 * u} start={0.45} />
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // card: white card, label, title with yellow highlighter sweep, red round stamp on its top-right corner
  const cardW = area.width - 264 * u;
  const inner = cardW - 120 * u;
  const size = loaded ? fitFontSize({text: title, maxSize: 90 * u, width: inner, height: area.height * 0.5, weight: 900, lineHeight: 1.15}) : 90 * u;
  const up = interpolate(t, [0, 0.405], [84 * u, 0], {...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const cardOp = interpolate(t, [0, 0.405], [0, 1], clamp);
  const hl = interpolate(t, [0.5, 0.86], [0, 1], {...clamp, easing: inOut}) * (1 - exit);
  const at = highlight ? title.indexOf(highlight) : -1;
  const parts = at < 0 ? [title, '', ''] : [title.slice(0, at), highlight!, title.slice(at + highlight!.length)];
  const hlStyle: React.CSSProperties = {backgroundImage: 'linear-gradient(' + accent + ',' + accent + ')', backgroundRepeat: 'no-repeat', backgroundPosition: '0 88%',
    backgroundSize: `${hl * 100}% 45%`, padding: `0 ${6 * u}px`, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone'};
  return (
    <AbsoluteFill style={lay}>
      <div style={{position: 'relative', width: area.width, paddingLeft: 96 * u, paddingRight: 168 * u, boxSizing: 'border-box'}}>
        <div style={{background: '#FFFFFF', borderRadius: CARD_RADIUS * u, boxShadow: SOFT_SHADOW, padding: `${54 * u}px ${60 * u}px`,
          opacity: cardOp * (1 - exit), transform: `translateY(${up - exit * 30 * u}px)`}}>
          <div style={{float: 'right', width: 150 * u, height: 150 * u}} />{/* room for the stamp that overlaps the corner; text wraps around it */}
          {label && <div style={{fontWeight: 700, fontSize: 39 * u, letterSpacing: 3 * u, color: primary, marginBottom: 12 * u}}>{label}</div>}
          <div style={{fontWeight: 900, fontSize: size, lineHeight: 1.15, color: background}}>
            {parts[0]}{parts[1] && <span style={hlStyle}>{parts[1]}</span>}{parts[2]}
          </div>
        </div>
        <div style={{position: 'absolute', top: -120 * u, right: 42 * u}}>
          <StampMark shape="round" lines={[stampTop ?? '', stampMain, stampBottom ?? '']} color={accent2} size={330 * u} start={0.45} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
