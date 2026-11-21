// Forms for motion components come from their zod schemas in studio/src/motion (no per-component code here):
// a component Claude writes for one video gets a real form as soon as it is in the registry.
import {z} from 'zod';
import {MOTION as SHARED} from '@studio/motion/registry';
import {VIDEO_MOTION} from '@studio/videos';

z.config(z.locales.vi()); // Vietnamese validation messages (also used by the Player's own errors)

export type FieldKind = 'text' | 'textarea' | 'lines' | 'number' | 'color' | 'choice' | 'bool' | 'media' | 'json';
export type FieldSpec = {
  key: string; title: string; kind: FieldKind; required: boolean;
  min?: number; max?: number; step?: number; options?: {value: string; label: string}[]; default?: unknown;
};

type JS = {
  type?: string; title?: string; description?: string; ui?: string; enum?: string[]; labels?: Record<string, string>;
  minimum?: number; maximum?: number; step?: number; default?: unknown; items?: JS; anyOf?: JS[];
  properties?: Record<string, JS>; required?: string[];
};
const COLOR = '__remotion-color';

const MOTION = {...SHARED, ...VIDEO_MOTION}; // video keys are "<slug>/<Name>", so they never shadow shared names
/** Picker entries: shared components plus the ones that belong to this video's slug. */
export const motionNames = (slug?: string): string[] =>
  [...Object.keys(SHARED), ...Object.keys(VIDEO_MOTION).filter((k) => slug !== undefined && k.startsWith(`${slug}/`))];
export const motionTitle = (name: string): string => MOTION[name]?.title ?? name;
export const motionDescription = (name: string): string | undefined => MOTION[name]?.description;

function kindOf(p: JS): FieldKind {
  if (p.description === COLOR) return 'color';
  if (p.ui === 'media') return 'media';
  if (p.ui === 'textarea') return 'textarea';
  if (p.enum) return 'choice';
  if (p.type === 'boolean') return 'bool';
  if (p.type === 'number' || p.type === 'integer') return 'number';
  if (p.type === 'array' && p.items?.type === 'string') return 'lines';
  if (p.type === 'string') return 'text';
  return 'json';
}

/** Form fields for a registered component, in schema order; null if the component is not registered. */
export function motionFields(component: string): FieldSpec[] | null {
  const def = MOTION[component];
  if (!def) return null;
  const js = z.toJSONSchema(def.schema, {io: 'input', unrepresentable: 'any'}) as JS;
  const req = new Set(js.required ?? []);
  return Object.entries(js.properties ?? {}).map(([key, raw]) => {
    const p = raw.anyOf?.find((x) => x.type !== 'null') ? {...raw.anyOf.find((x) => x.type !== 'null'), ...raw} : raw;
    const kind = kindOf(p);
    return {
      key, kind, title: p.title ?? key, required: req.has(key) && p.default === undefined,
      ...(p.minimum !== undefined && {min: p.minimum}), ...(p.maximum !== undefined && {max: p.maximum}),
      ...(p.step !== undefined && {step: p.step}), ...(p.default !== undefined && {default: p.default}),
      ...(p.enum && {options: p.enum.map((v) => ({value: v, label: p.labels?.[v] ?? v}))}),
    };
  });
}

/** Validation messages by field key ('' = the whole object); {} when valid or not registered. */
export function motionErrors(component: string, props: Record<string, unknown> | undefined): Record<string, string> {
  const def = MOTION[component];
  if (!def) return {};
  const r = def.schema.safeParse(props ?? {});
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const i of r.error.issues) out[String(i.path[0] ?? '')] ??= i.message;
  return out;
}
