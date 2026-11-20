// mirrors tools/reel/props.py build_render_props()
export type Effect = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
export type Transition = 'cut' | 'fade' | 'slide';
export type CaptionChunk = {text: string; start: number; end: number};
export type MediaItem = {src: string; type: 'video' | 'image'; from: number; start: number; duration: number; effect: Effect};
// Placement: 'full' = the component lays itself out on the whole frame; top/center/bottom = preset bands;
// 'free' = `box` (percent of the frame: x/y = top-left corner, w/h = size).
export type MotionPosition = 'full' | 'top' | 'center' | 'bottom' | 'free';
export type MotionBackdrop = 'none' | 'scrim';
export type Box = {x: number; y: number; w: number; h: number};
export type AnimType = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'pop' | 'zoom' | 'wipe' | 'blur';
export type Anim = {type: AnimType; duration: number};
// Keyframes: t = seconds from the layer start; x/y = offset in percent of the frame; values are eased in between.
export type Keyframe = {t: number; x?: number; y?: number; scale?: number; rotate?: number; opacity?: number};
export type MotionItem = {
  component: string; props: Record<string, unknown>; start: number; duration: number;
  position: MotionPosition; box: Box | null; backdrop: MotionBackdrop;
  scale: number; rotate: number; opacity: number;
  enter: Anim; exit: Anim; keyframes: Keyframe[];
  colors: Partial<Brand['colors']> | null;
};
export type Overlay = {text: string; position: 'top' | 'center' | 'bottom'};
export type Scene = {
  id: string; start: number; duration: number;
  voice: {src: string; duration: number} | null;
  captions: CaptionChunk[]; highlight: string[]; overlay: Overlay | null;
  media: MediaItem[]; motion: MotionItem[]; transition: Transition;
  mediaTransition?: Transition; // between clips inside the scene
};
export type Brand = {name: string; logo: string | null; colors: {primary: string; accent: string; text: string; background: string; accent2?: string; surface?: string}};
export type FullBrand = Omit<Brand, 'colors'> & {colors: Required<Brand['colors']>};
export const BRAND_COLOR_DEFAULTS = {accent2: '#E11D2E', surface: '#FFFFFF'};
export type CaptionStyle = {font: string; size: number; color: string; highlightColor: string; box?: boolean};
export type Music = {src: string; volume: number; duckTo: number; fadeOut: number};
export type Cta = {title: string; logoSize?: number; phone?: string; fanpage?: string; address?: string; duration: number};
export type RenderProps = {
  template: string; fps: number; width: number; height: number;
  brand: Brand; captions: CaptionStyle; music: Music | null;
  scenes: Scene[]; cta: Cta | null; totalSeconds: number;
  transitionSeconds?: number; // crossfade/slide length for scene and clip transitions
  sfx?: {src: string; start: number; volume: number}[]; // sound effects; start is absolute seconds
  overlays?: MotionItem[]; // video-wide motion track; start is absolute (seconds from the beginning)
};
