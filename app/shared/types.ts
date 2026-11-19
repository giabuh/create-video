import type {RenderProps} from '../../studio/src/types.ts';
export type {RenderProps};

export type Json = Record<string, unknown>;
export type Effect = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
export type TransitionName = 'cut' | 'fade' | 'slide';
export type MediaSpec = {src: string; from?: number; duration?: number; effect?: Effect};
export type MotionPosition = 'full' | 'top' | 'center' | 'bottom' | 'free';
export type MotionBackdrop = 'auto' | 'scrim' | 'none';
export type AnimName = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'pop' | 'zoom' | 'wipe' | 'blur';
export type AnimSpec = AnimName | {type: AnimName; duration?: number};
export type BoxSpec = {x: number; y: number; w: number; h: number};
export type KeyframeSpec = {t: number; x?: number; y?: number; scale?: number; rotate?: number; opacity?: number};
export type WordRef = string | {word: string; occurrence?: number; offset?: number};
/** Video-track time: seconds, a scene (optionally a spoken word in it), or "video" (end only). */
export type TrackTime = number | 'video' | {scene: string; at?: WordRef; offset?: number; edge?: 'start' | 'end'};
export type MotionSpec = {
  component: string; props?: Json;
  start?: number | TrackTime; duration?: number; end?: TrackTime;   // end: video track only
  at?: WordRef; until?: WordRef;                                     // scene layers: start/end on a spoken word
  position?: MotionPosition; box?: BoxSpec; backdrop?: MotionBackdrop; scale?: number; rotate?: number; opacity?: number;
  enter?: AnimSpec; exit?: AnimSpec; keyframes?: KeyframeSpec[]; colors?: Partial<Record<'primary' | 'accent' | 'text' | 'background', string>>;
};
export type SceneSpec = {
  id: string; say?: string; caption?: string; duration?: number; voice?: string; tts?: Json;
  highlight?: string[]; overlay?: {text: string; position: 'top' | 'center' | 'bottom'} | null;
  media?: MediaSpec[]; motion?: MotionSpec[]; transition?: TransitionName; pauseAfter?: number;
};
export type CtaSpec = {title: string; phone?: string; fanpage?: string; address?: string; duration?: number};
export type Storyboard = {
  template?: string; brand?: string; voice?: string; tts?: Json;
  music?: {file: string; volume?: number} | null; targetSeconds?: number;
  captions?: Json; video?: Json; scenes: SceneSpec[]; cta?: CtaSpec | null;
  motion?: MotionSpec[];   // video-wide motion track
};
export type Versioned<T> = {data: T; mtime: number};           // mtime = Math.floor(stat.mtimeMs)
export type Mix = {real: number; motion: number; other: number};
export type Timings = {
  scenes: Record<string, {duration: number; pauseAfter?: number; voice?: string; ref?: string; tts?: Json; cacheKey?: string}>;
  totalSeconds: number; mix: Mix;
};
export type ProjectStatus = 'rendering' | 'approved' | 'draft' | 'new';
export type VersionInfo = {
  name: string;            // "reel-v3"
  n: number;               // 3
  file: string;            // "projects/<slug>/reel-v3.mp4" (URL path without leading slash)
  bytes: number; mtime: number;
  kind: 'draft' | 'final' | null;   // from project.json renders; null = rendered outside the app
  hasSnapshot: boolean; approved: boolean;
};
export type ProjectMeta = {approved: string | null; renders: Record<string, {kind: 'draft' | 'final'; at: string}>};
export type ProjectSummary = {
  slug: string; status: ProjectStatus; approved: string | null; latest: VersionInfo | null;
  sceneCount: number; totalSeconds: number | null; mix: Mix | null; mtime: number;
  firstCaption: string; voice: string | null;
};
export type ProjectDetail = {
  slug: string; storyboard: Versioned<Storyboard>; timings: Timings | null;
  renderProps: RenderProps | null; stale: string[]; versions: VersionInfo[];
  meta: ProjectMeta; status: ProjectStatus; mixTarget: Mix;
};
export type PreviewResult = {ok: boolean; errors: string[]; stale: string[]; renderProps: RenderProps | null};
export type LibraryEntry = {
  type: 'video' | 'image'; duration: number | null; width: number; height: number;
  orientation: 'portrait' | 'landscape' | 'square'; description: string; tags: string[];
  goodRanges: [number, number | null][];
};
export type LibraryIndex = Record<string, LibraryEntry>;
export type LibraryResponse = Versioned<LibraryIndex> & {usage: Record<string, string[]>}; // name -> ["<slug> · <sceneId>"]
export type MusicFile = {name: string; bytes: number};
export type TryVariant = {file: string; ref: string; tts: Json; seconds: number};
export type Tries = {voice: string; text: string; variants: Record<string, TryVariant>};
export type VoiceInfo = {name: string; ref: string; refs: string[]; isDefault: boolean; seconds: number | null};
export type BrandFile = {name: string; logo: string | null; colors: {primary: string; accent: string; text: string; background: string}; cta?: {phone?: string; fanpage?: string; address?: string}; captions?: Json};
export type BrandSummary = {id: string; brand: BrandFile; isDefault: boolean; mtime: number}; // mtime of brands/<id>/brand.json, used as baseMtime
export type Config = Json & {
  defaults: {voice: string; template: string; brand: string};
  tts: Json & {speed: number; pauseAfter: number}; voices: Record<string, Json & {ref: string}>;
  mix: Mix; video: {fps: number; width: number; height: number; draftScale: number};
  music: {volume: number; duckTo: number; fadeOut: number};
  captions: {font: string; size: number; color: string; highlightColor: string; maxWords: number};
};
export type JobKind = 'voice' | 'render' | 'ingest' | 'try' | 'approve' | 'voice-add';
export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
export type Job = {
  id: string; kind: JobKind; lane: 'gpu' | 'render' | 'io'; project: string | null; label: string;
  state: JobState; progress: number | null; step: string; startedAt: number | null; endedAt: number | null;
  etaSeconds: number | null; log: string[]; result: Json | null; error: string | null; cancellable: boolean;
};
export type WorkerStatus = {state: 'starting' | 'idle' | 'loading' | 'ready' | 'error'; device: 'cuda' | 'cpu' | null; error: string | null};
export type ServerEvent =
  | {type: 'changed'; path: string}             // posix path relative to repo root, e.g. "projects/_smoke/storyboard.json"
  | {type: 'job'; job: Job}
  | {type: 'worker'; status: WorkerStatus};
export type ApiError = {error: string; details?: unknown};
