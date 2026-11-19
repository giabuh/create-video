import type {RenderProps} from '../../studio/src/types.ts';
export type {RenderProps};

export type Json = Record<string, unknown>;
export type Effect = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
export type TransitionName = 'cut' | 'fade' | 'slide';
export type MediaSpec = {src: string; from?: number; duration?: number; effect?: Effect};
export type MotionSpec = {component: string; props?: Json; start?: number; duration?: number};
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
};
export type Versioned<T> = {data: T; mtime: number};           // mtime = Math.floor(stat.mtimeMs)
export type Mix = {real: number; motion: number; other: number};
export type Timings = {
  scenes: Record<string, {duration: number; pauseAfter?: number; voice?: string; ref?: string; tts?: Json; cacheKey?: string}>;
  totalSeconds: number; mix: Mix;
};
export type ProjectStatus = 'rendering' | 'approved' | 'draft' | 'new' | 'deleting';
export type VersionInfo = {
  name: string;            // "reel-v3"
  n: number;               // 3
  file: string;            // "projects/<slug>/reel-v3.mp4" (URL path without leading slash)
  bytes: number; mtime: number;
  kind: 'draft' | 'final' | null;   // from project.json renders; null = rendered outside the app
  hasSnapshot: boolean; approved: boolean; published: PublishInfo | null;
};
export type PublishInfo = {name: string; state: 'uploading' | 'done' | 'failed'; error?: string; at: string};
export type ProjectMeta = {approved: string | null; renders: Record<string, {kind: 'draft' | 'final'; at: string}>;
  published?: Record<string, PublishInfo>; deleting?: {uploads: string[]; state: 'uploading' | 'failed'; error?: string}};
export type ProjectSummary = {
  slug: string; status: ProjectStatus; approved: string | null; latest: VersionInfo | null;
  sceneCount: number; totalSeconds: number | null; mix: Mix | null; mtime: number;
  firstCaption: string; voice: string | null; deleting: ProjectMeta['deleting'] | null;
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
  mix: Mix; video: {fps: number; width: number; height: number};
  music: {volume: number; duckTo: number; fadeOut: number};
  captions: {font: string; size: number; color: string; highlightColor: string; maxWords: number};
  sync: {remote: string};
};
export type JobKind = 'voice' | 'render' | 'ingest' | 'try' | 'approve' | 'voice-add' | 'publish' | 'delete-project';
export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
export type Job = {
  id: string; kind: JobKind; lane: 'gpu' | 'render' | 'io'; project: string | null; label: string;
  state: JobState; progress: number | null; step: string; startedAt: number | null; endedAt: number | null;
  etaSeconds: number | null; log: string[]; result: Json | null; error: string | null; cancellable: boolean;
};
export type WorkerStatus = {state: 'starting' | 'idle' | 'loading' | 'ready' | 'error'; device: 'cuda' | 'cpu' | null; error: string | null};
export type LimitInfo = {status: string; resetsAt: number | null; utilization: number | null; type: string | null}; // resetsAt = epoch seconds
export type ChatEvent =
  | {kind: 'user'; text: string; account: string; at: number}
  | {kind: 'delta'; text: string}
  | {kind: 'text'; text: string}
  | {kind: 'tool'; name: string; summary: string}
  | {kind: 'done'; costUsd: number | null; durationMs: number | null}
  | {kind: 'error'; message: string; limit?: {account: string; resetsAt: number | null}};
export type ChatAccount = {name: string; limit: LimitInfo | null};
export type ChatMeta = {id: string; title: string; account: string; slug: string | null; started: boolean; createdAt: number; updatedAt: number};
export type ChatDetail = {chat: ChatMeta; events: ChatEvent[]};
export type ServerEvent =
  | {type: 'changed'; path: string}             // posix path relative to repo root, e.g. "projects/_smoke/storyboard.json"
  | {type: 'job'; job: Job}
  | {type: 'worker'; status: WorkerStatus}
  | {type: 'chat'; chatId: string; event: ChatEvent}
  | {type: 'chatBusy'; chatId: string | null};
export type ApiError = {error: string; details?: unknown};
