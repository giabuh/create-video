// One motion layer: places any registered component (full frame, preset band or free box), animates it in/out,
// moves it along keyframes, and recolors it — the same for every component, so components only draw content.
import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {MOTION} from '../motion/registry';
import {VIDEO_MOTION} from '../videos';
import {BANDS} from './bands';
import {parseMotionProps} from '../motion/schema';
import {BRAND_COLOR_DEFAULTS, type Anim, type Brand, type FullBrand, type Keyframe, type MotionItem} from '../types';

export {BANDS} from './bands';
const SCRIM = 'rgba(0,0,0,0.62)';
const SCRIM_IN = 0.4; // seconds
const NONE: Anim = {type: 'none', duration: 0};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Style for an enter/exit animation at visibility p (0 = hidden, 1 = fully shown). */
export const animStyle = (a: Anim, p: number): {opacity: number; transform: string; filter?: string; clipPath?: string} => {
  const e = Easing.out(Easing.cubic)(p);
  switch (a.type) {
    case 'fade': return {opacity: e, transform: ''};
    case 'slide-up': return {opacity: e, transform: `translateY(${(1 - e) * 30}%)`};
    case 'slide-down': return {opacity: e, transform: `translateY(${(e - 1) * 30}%)`};
    case 'slide-left': return {opacity: e, transform: `translateX(${(1 - e) * 40}%)`};
    case 'slide-right': return {opacity: e, transform: `translateX(${(e - 1) * 40}%)`};
    case 'pop': return {opacity: Math.min(1, p * 3), transform: `scale(${interpolate(p, [0, 1], [0.4, 1], {...clamp, easing: Easing.out(Easing.back(2))})})`};
    case 'zoom': return {opacity: e, transform: `scale(${1.35 - 0.35 * e})`};
    case 'wipe': return {opacity: 1, transform: '', clipPath: `inset(0 ${(1 - e) * 100}% 0 0)`};
    case 'blur': return {opacity: e, transform: '', filter: `blur(${(1 - e) * 24}px)`};
    default: return {opacity: 1, transform: ''};
  }
};

/** Keyframe values at time t (seconds from the layer start), eased between keys, held before/after. */
export const keyframeAt = (keys: Keyframe[], t: number): Required<Omit<Keyframe, 't'>> => {
  const out = {x: 0, y: 0, scale: 1, rotate: 0, opacity: 1};
  for (const k of ['x', 'y', 'scale', 'rotate', 'opacity'] as const) {
    const pts = keys.filter((kf) => kf[k] !== undefined).sort((a, b) => a.t - b.t);
    if (pts.length === 1) out[k] = pts[0][k] as number;
    if (pts.length > 1) {
      out[k] = interpolate(t, pts.map((p) => p.t), pts.map((p) => p[k] as number), {...clamp, easing: Easing.inOut(Easing.cubic)});
    }
  }
  return out;
};

const container = (it: MotionItem): React.CSSProperties => {
  if (it.position === 'free' && it.box) {
    return {position: 'absolute', left: `${it.box.x}%`, top: `${it.box.y}%`, width: `${it.box.w}%`, height: `${it.box.h}%`};
  }
  if (it.position === 'top' || it.position === 'center' || it.position === 'bottom') {
    const [a, b] = BANDS[it.position];
    return {position: 'absolute', left: 0, right: 0, top: `${a * 100}%`, height: `${(b - a) * 100}%`};
  }
  return {position: 'absolute', inset: 0};
};

/** Pixel size of the layer's area (before the layer's own scale). */
export const areaOf = (it: MotionItem, width: number, height: number): {width: number; height: number} => {
  if (it.position === 'free' && it.box) return {width: (it.box.w / 100) * width, height: (it.box.h / 100) * height};
  if (it.position === 'top' || it.position === 'center' || it.position === 'bottom') {
    const [a, b] = BANDS[it.position];
    return {width, height: (b - a) * height};
  }
  return {width, height};
};

const Scrim: React.FC<{it: MotionItem; opacity: number}> = ({it, opacity}) => {
  if (it.position === 'full' || it.position === 'free' && !it.box) return <AbsoluteFill style={{background: 'rgba(0,0,0,0.5)', opacity}} />;
  if (it.position === 'free' && it.box) {
    const pad = 2; // percent of the frame around the box
    return <div style={{position: 'absolute', left: `${it.box.x - pad}%`, top: `${it.box.y - pad}%`, width: `${it.box.w + 2 * pad}%`,
      height: `${it.box.h + 2 * pad}%`, background: SCRIM, borderRadius: 32, opacity}} />;
  }
  if (it.position === 'free') return null;
  const [a, b] = BANDS[it.position];
  const pad = (b - a) * 0.3; // reaches a bit past the band and fades out softly
  return <div style={{position: 'absolute', left: 0, right: 0, top: `${(a - pad) * 100}%`, height: `${(b - a + 2 * pad) * 100}%`, opacity,
    background: `linear-gradient(to bottom, transparent 0%, ${SCRIM} 24%, ${SCRIM} 76%, transparent 100%)`}} />;
};

/** Fills in fields missing from render-props written before they existed: such files render exactly as before. */
export const withDefaults = (item: MotionItem): MotionItem => {
  const position = item.position ?? 'full';
  return {
    ...item, position, box: item.box ?? null, backdrop: item.backdrop ?? 'none', scale: item.scale ?? 1, rotate: item.rotate ?? 0,
    opacity: item.opacity ?? 1, enter: item.enter ?? NONE,
    exit: item.exit ?? (position === 'full' || (MOTION[item.component] ?? VIDEO_MOTION[item.component])?.ownsExit ? NONE : {type: 'fade', duration: 0.25}), keyframes: item.keyframes ?? [], colors: item.colors ?? null,
  };
};

export const MotionLayer: React.FC<{item: MotionItem; brand: Brand}> = ({item: raw, brand}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const it = useMemo(() => withDefaults(raw), [raw]);
  const def = MOTION[it.component] ?? VIDEO_MOTION[it.component];
  // parsed once per props, not per frame; sorted keyframes: filter+stable sort in keyframeAt then keeps the order, same result
  const props = useMemo(() => {
    if (!def) throw new Error(`Unknown motion component "${it.component}" — add it to studio/src/motion/registry.ts or studio/src/videos/<slug>/index.ts`);
    return parseMotionProps(it.component, def.schema, it.props);
  }, [def, it.component, it.props]);
  const keys = useMemo(() => [...it.keyframes].sort((x, y) => x.t - y.t), [it.keyframes]);
  const layerBrand: FullBrand = useMemo(() => ({...brand, colors: {...BRAND_COLOR_DEFAULTS, ...brand.colors, ...(it.colors ?? {})}}), [brand, it.colors]);
  const C = def.component;

  const len = Math.max(1, Math.round(it.duration * fps));
  const inP = it.enter.type === 'none' ? 1 : interpolate(frame, [0, Math.max(1, it.enter.duration * fps)], [0, 1], clamp);
  const outP = it.exit.type === 'none' ? 1 : interpolate(frame, [len - Math.max(1, it.exit.duration * fps), len], [1, 0], clamp);
  const a = animStyle(it.enter, inP), b = animStyle(it.exit, outP);
  // the scrim eases in with (never ahead of) the content: an empty dark panel must not flash before the text arrives
  const scrimIn = interpolate(frame, [0, Math.max(1, (it.enter.type === 'none' ? 0 : it.enter.duration) * fps, SCRIM_IN * fps)], [0, 1],
    {...clamp, easing: Easing.inOut(Easing.cubic)});
  const kf = keyframeAt(keys, frame / fps);

  const transform = [
    kf.x || kf.y ? `translate(${(kf.x / 100) * width}px, ${(kf.y / 100) * height}px)` : '',
    a.transform, b.transform,
    it.rotate + kf.rotate ? `rotate(${it.rotate + kf.rotate}deg)` : '',
    it.scale * kf.scale !== 1 ? `scale(${it.scale * kf.scale})` : '',
  ].filter(Boolean).join(' ');
  const style: React.CSSProperties = {
    ...container(it), transform: transform || undefined, transformOrigin: 'center',
    opacity: it.opacity * kf.opacity * a.opacity * b.opacity,
    filter: [a.filter, b.filter].filter(Boolean).join(' ') || undefined,
    clipPath: b.clipPath && b.clipPath !== 'inset(0 0% 0 0)' ? b.clipPath : a.clipPath,
  };
  return (
    <AbsoluteFill>
      {it.backdrop === 'scrim' && <Scrim it={it} opacity={Math.min(scrimIn, outP)} />}
      <div style={style}>
        <C {...props} brand={layerBrand} layerSeconds={it.duration} area={areaOf(it, width, height)} />
      </div>
    </AbsoluteFill>
  );
};
