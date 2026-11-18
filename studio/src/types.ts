// mirrors tools/reel/props.py build_render_props()
export type Effect = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
export type Transition = 'cut' | 'fade' | 'slide';
export type CaptionChunk = {text: string; start: number; end: number};
export type MediaItem = {src: string; type: 'video' | 'image'; from: number; start: number; duration: number; effect: Effect};
export type MotionItem = {component: string; props: Record<string, unknown>; start: number; duration: number};
export type Overlay = {text: string; position: 'top' | 'center' | 'bottom'};
export type Scene = {
  id: string; start: number; duration: number;
  voice: {src: string; duration: number} | null;
  captions: CaptionChunk[]; highlight: string[]; overlay: Overlay | null;
  media: MediaItem[]; motion: MotionItem[]; transition: Transition;
};
export type Brand = {name: string; logo: string | null; colors: {primary: string; accent: string; text: string; background: string}};
export type CaptionStyle = {font: string; size: number; color: string; highlightColor: string};
export type Music = {src: string; volume: number; duckTo: number; fadeOut: number};
export type Cta = {title: string; phone?: string; fanpage?: string; address?: string; duration: number};
export type RenderProps = {
  template: string; fps: number; width: number; height: number;
  brand: Brand; captions: CaptionStyle; music: Music | null;
  scenes: Scene[]; cta: Cta | null; totalSeconds: number;
};
