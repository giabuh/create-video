import type {RenderProps} from '@studio/types';

/** Scene id (or 'cta') shown at `frame`: the last scene starting at or before it; after the scenes, the CTA. */
export function sceneAtFrame(props: RenderProps | null, frame: number): string | null {
  if (!props || props.scenes.length === 0) return null;
  const t = frame / props.fps;
  const last = props.scenes[props.scenes.length - 1];
  if (props.cta && t >= last.start + last.duration) return 'cta';
  let id = props.scenes[0].id;
  for (const sc of props.scenes) if (sc.start <= t) id = sc.id;
  return id;
}

/** Chat tag for a moment of the preview, e.g. "[cảnh kem-1-1 · 0:12.4 · khung 372] " (time rounded down to 0.1 s). */
export function momentTag(scene: string, frame: number, fps: number): string {
  const tenths = Math.floor((frame * 10) / fps); // integer numerator avoids 0.1 float drift
  const m = Math.floor(tenths / 600), sec = Math.floor((tenths % 600) / 10), d = tenths % 10;
  const label = scene === 'cta' ? 'CTA' : `cảnh ${scene}`;
  return `[${label} · ${m}:${String(sec).padStart(2, '0')}.${d} · khung ${frame}] `;
}
