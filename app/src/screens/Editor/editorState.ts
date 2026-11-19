import type {Mix, RenderProps, SceneSpec, Storyboard} from '../../../shared/types.ts';

/** "s<N>" with N = max numeric suffix over existing ids + 1. */
export function newSceneId(scenes: SceneSpec[]): string {
  const max = scenes.reduce((m, s) => Math.max(m, Number(/(\d+)\D*$/.exec(s.id)?.[1] ?? 0)), 0);
  return `s${max + 1}`;
}

const insertAfter = (sb: Storyboard, afterIndex: number | null, scene: SceneSpec): Storyboard => {
  const at = afterIndex === null ? sb.scenes.length : afterIndex + 1;
  return {...sb, scenes: [...sb.scenes.slice(0, at), scene, ...sb.scenes.slice(at)]};
};

export function addScene(sb: Storyboard, afterIndex: number | null): {sb: Storyboard; id: string} {
  const id = newSceneId(sb.scenes);
  return {sb: insertAfter(sb, afterIndex, {id, say: '', caption: ''}), id};
}

export function duplicateScene(sb: Storyboard, id: string): {sb: Storyboard; id: string} {
  const i = sb.scenes.findIndex((s) => s.id === id);
  if (i < 0) return {sb, id};
  const nid = newSceneId(sb.scenes);
  return {sb: insertAfter(sb, i, {...structuredClone(sb.scenes[i]), id: nid}), id: nid};
}

export const removeScene = (sb: Storyboard, id: string): Storyboard => ({...sb, scenes: sb.scenes.filter((s) => s.id !== id)});

export function updateScene(sb: Storyboard, id: string, patch: Partial<SceneSpec>): Storyboard {
  return {...sb, scenes: sb.scenes.map((s) => {
    if (s.id !== id) return s;
    const next: Record<string, unknown> = {...s, ...patch};
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    return next as SceneSpec;
  })};
}

export const sceneKind = (s: SceneSpec): 'real' | 'motion' | 'other' => (s.media?.length ? 'real' : s.motion?.length ? 'motion' : 'other');

/** [start, end] seconds of a scene, or of the CTA ('cta') which follows the last scene. */
export function sceneRange(props: RenderProps | null, id: string): [number, number] | null {
  if (!props) return null;
  if (id === 'cta') {
    const last = props.scenes.at(-1);
    return props.cta && last ? [last.start + last.duration, last.start + last.duration + props.cta.duration] : null;
  }
  const s = props.scenes.find((x) => x.id === id);
  return s ? [s.start, s.start + s.duration] : null;
}
export const sceneStart = (props: RenderProps | null, id: string): number | null => sceneRange(props, id)?.[0] ?? null;

/** Share of screen time, as tools/reel/mix.py: media = real, motion-only = motion, CTA = other. */
export function mixOf(props: RenderProps): Mix {
  const real = props.scenes.reduce((a, s) => a + (s.media.length ? s.duration : 0), 0);
  const motion = props.scenes.reduce((a, s) => a + (s.media.length ? 0 : s.duration), 0);
  const other = props.cta?.duration ?? 0;
  const t = real + motion + other;
  return t > 0 ? {real: real / t, motion: motion / t, other: other / t} : {real: 0, motion: 0, other: 0};
}

/** Adopt a refetched server storyboard only if it is newer than our base and nothing local is pending. */
export const shouldAdopt = (o: {serverMtime: number; baseMtime: number; dirty: boolean; saving: boolean}): boolean =>
  o.serverMtime > o.baseMtime && !o.dirty && !o.saving;

/** Preview errors look like "s2: message"; returns the scene-id -> messages map. */
export function errorsByScene(errors: string[], ids: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of errors) {
    const id = /^([^:\s]+):/.exec(e)?.[1];
    if (id && ids.includes(id)) m.set(id, [...(m.get(id) ?? []), e]);
  }
  return m;
}
