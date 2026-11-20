import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {useFontsLoaded} from '../fit';
import {fontFamily, headingFamily} from '../fonts';
import {FxText} from './fx/FxText';
import {choice, numDefault, optText, text, textFx, z, type MotionProps} from './schema';
import {StampMark} from './Stamp';
import {HARD_SHADOW, RADIUS, inOut, stampImpact} from './style';

export const PriceTagSchema = z.object({
  price: text('Giá'),
  old: optText('Giá cũ (gạch ngang)'),
  note: optText('Ghi chú'),
  stamp: z.string().default('ƯU ĐÃI').meta({title: 'Chữ trên dấu (để trống = không có dấu)'}),
  variant: choice('Kiểu', ['slam', 'countdown'], 'slam', {slam: 'Đập xuống', countdown: 'Đếm giá'}),
  size: numDefault('Cỡ giá (px)', 180, {min: 60, max: 320, step: 5}),
  tilt: numDefault('Nghiêng (độ)', 0, {min: -30, max: 30, step: 1}),
  fx: textFx('Hiệu ứng chữ', 'none'),
});

// Mockup timings (seconds): old block drops at 0, strike draws at .35, slab slams at .6, stamp lands at 1.0.
const SLAB_AT = 0.6;
const COUNT_FROM = 0.95;
const COUNT_SECS = 0.9;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const css = Easing.bezier(0.25, 0.1, 0.25, 1);
const k = 0.045; // 1% of the mockup's 4.5s loop

/** "2.990.000đ" -> {pre, sep, post, n}; null when it has no digits. */
const parsePrice = (s: string) => {
  const m = s.match(/^(\D*?)(\d[\d.,\s]*\d|\d)(\D*)$/);
  return m ? {pre: m[1], sep: m[2].match(/[.,\s]/)?.[0] ?? '', post: m[3], n: Number(m[2].replace(/\D/g, ''))} : null;
};

export const PriceTag: React.FC<MotionProps<typeof PriceTagSchema>> = ({price, old, note, stamp, variant, size: maxSize, tilt, fx, brand, area}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loaded = useFontsLoaded();
  const t = frame / fps;
  const navy = brand.colors.background;
  const padX = 54;
  const pParsed = parsePrice(price);
  const oParsed = old ? parsePrice(old) : null;
  const count = variant === 'countdown' && pParsed && oParsed ? {p: pParsed, from: oParsed.n} : null;
  const fmt = (v: number) => (count ? count.p.pre + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, count.p.sep) + count.p.post : price).toUpperCase();
  const widest = count && count.from > count.p.n ? fmt(count.from) : price.toUpperCase();
  // 1.1: the slam overshoots to ~1.04x; the stamp hangs a little past the slab's right edge
  const avail = area.width / 1.1 - 2 * padX - 60;
  const size = loaded ? Math.floor(Math.min(maxSize, (maxSize * avail) / measureText({text: widest, fontFamily: headingFamily, fontSize: maxSize, fontWeight: '900'}).width)) : maxSize;
  const k3 = size / 180; // mockup is 60px = 180px

  const drop = interpolate(t, [0, 7 * k], [0, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)});
  const strike = interpolate(t, [0.35, 0.35 + 6 * k], [0, 1], {...clamp, easing: inOut});
  const ts = t - SLAB_AT;
  const slabScale = ts < 5 * k ? interpolate(ts, [0, 5 * k], [1.7, 0.92], clamp) : ts < 7 * k ? interpolate(ts, [5 * k, 7 * k], [0.92, 1.04], {...clamp, easing: css}) : interpolate(ts, [7 * k, 9 * k], [1.04, 1], {...clamp, easing: css});
  const slabRot = interpolate(ts, [5 * k, 7 * k, 9 * k], [0, -1, 0], clamp);
  const slabOpacity = interpolate(ts, [0, 0.01], [0, 1], clamp);
  const stampAt = count ? COUNT_FROM + COUNT_SECS + 0.1 : 1.0;
  const shake = stampImpact(frame, fps, stampAt).shake;
  const value = count ? interpolate(t, [COUNT_FROM, COUNT_FROM + COUNT_SECS], [count.from, count.p.n], {...clamp, easing: inOut}) : 0;
  const shown = count ? fmt(value) : price.toUpperCase();
  const slabText = fx !== 'none' && !count ? <FxText text={shown} fx={fx} start={SLAB_AT + 0.1} /> : shown;
  const noteIn = interpolate(t, [stampAt, stampAt + 0.3], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `rotate(${tilt}deg) translate(${shake.x}px, ${shake.y}px)`}}>
        {old && (
          <div style={{position: 'relative', background: '#FFFFFF', color: '#3B4660', fontWeight: 700, fontSize: size * 0.267, padding: `${size * 0.1}px ${size * 0.233}px`,
            borderRadius: `${RADIUS}px ${RADIUS}px 0 0`, opacity: drop, transform: `translateY(${(1 - drop) * -60}px)`}}>
            {old}
            <div style={{position: 'absolute', left: 30, right: 30, top: '50%', height: 6, background: '#3B4660', transformOrigin: 'left', transform: `scaleX(${strike})`}} />
          </div>
        )}
        <div style={{position: 'relative', zIndex: 2, background: brand.colors.accent, color: navy, fontFamily: headingFamily, fontWeight: 900, fontSize: size, lineHeight: 1.05,
          padding: `0 ${padX}px`, borderRadius: RADIUS, boxShadow: HARD_SHADOW(navy), whiteSpace: 'nowrap', textAlign: 'center', minWidth: count ? measureText({text: widest, fontFamily: headingFamily, fontSize: size, fontWeight: '900'}).width + 2 * padX : undefined,
          opacity: slabOpacity, transform: `scale(${slabScale}) rotate(${slabRot}deg)`}}>
          {slabText}
          {stamp && (
            <div style={{position: 'absolute', right: -size * 0.1, top: '100%', marginTop: -size * 0.04, zIndex: 2}}>
              <StampMark shape="rect" lines={[stamp]} color={brand.colors.accent2} size={330 * k3} start={stampAt} />
            </div>
          )}
        </div>
        {note && (
          <div style={{alignSelf: 'flex-start', maxWidth: stamp ? size * 2.4 : undefined, marginTop: size * 0.12, background: navy, color: '#FFFFFF', fontWeight: 800, fontSize: size * 0.3, padding: `${size * 0.1}px ${size * 0.17}px`,
            borderRadius: RADIUS / 1.5, opacity: noteIn, transform: `translateY(${(1 - noteIn) * 30}px)`}}>{note}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
