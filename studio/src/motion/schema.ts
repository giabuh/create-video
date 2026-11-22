// Every motion component exports `<Name>Schema` (zod). The schema is the single source of truth:
// - MotionLayer parses the storyboard props with it (defaults applied, clear error if invalid);
// - the app turns it into a form automatically (title = label, ui = widget hint), so a component
//   Claude writes for one video is editable in the app with no extra code.
import type React from 'react';
import {z} from 'zod';
import {zColor} from '@remotion/zod-types';
import type {FullBrand} from '../types';
import {TEXT_FX, TEXT_FX_LABELS, type TextFx} from './fx/textFx';

export {z};

type Num = {min?: number; max?: number; step?: number};
const numMeta = (title: string, o: Num) => ({title, ...(o.step !== undefined && {step: o.step})});
const bounded = (o: Num) => {
  let n = z.number();
  if (o.min !== undefined) n = n.min(o.min);
  if (o.max !== undefined) n = n.max(o.max);
  return n;
};

/** Required one-line text. */
export const text = (title: string) => z.string().min(1).meta({title});
/** Optional one-line text. */
export const optText = (title: string) => z.string().optional().meta({title});
/** Multi-line text (textarea). */
export const longText = (title: string) => z.string().min(1).meta({title, ui: 'textarea'});
/** List of strings, one per line in the app. */
export const lines = (title: string) => z.array(z.string()).min(1).meta({title, ui: 'lines'});
export const num = (title: string, o: Num = {}) => bounded(o).meta(numMeta(title, o));
/** Number with a default (shown pre-filled in the app). */
export const numDefault = (title: string, value: number, o: Num = {}) => bounded(o).default(value).meta(numMeta(title, o));
export const color = (title: string) => zColor().optional().meta({title});
export const bool = (title: string, value = false) => z.boolean().default(value).meta({title});
/** One of a few values; `labels` are what the app shows. */
export const choice = <const T extends readonly [string, ...string[]]>(title: string, values: T, value: T[number], labels?: Record<T[number], string>) =>
  z.enum(values).default(value).meta({title, ...(labels && {labels})});
/** A file in library/ (image or video), picked from the media library in the app. */
export const media = (title: string) => z.string().min(1).meta({title, ui: 'media'});
/** Which text effect a card uses for its main text. */
export const textFx = (title: string, value: TextFx) => choice(title, TEXT_FX, value, TEXT_FX_LABELS);
/** Speed of a card's whole choreography: fast 0.7×, normal 1×, slow 1.4× (see PACE). */
export const pace = () => choice('Nhịp', ['fast', 'normal', 'slow'], 'normal', {fast: 'Nhanh', normal: 'Vừa', slow: 'Chậm'});
export const decor = () => choice('Trang trí', ['none', 'sparkle', 'dot', 'emoji'], 'none',
  {none: 'Không', sparkle: 'Tia lấp lánh', dot: 'Chấm nháy', emoji: 'Sticker emoji'});
export const emoji = () => optText('Emoji (khi trang trí là sticker), VD: 📢 🔥 ⭐');

/** What every motion component receives: its parsed props, the (possibly overridden) brand, the layer length,
 *  and the size in px of the area it is placed in (full frame, band or box) — for fitting text (see fit.ts). */
export type MotionProps<S extends z.ZodType> = z.output<S> & {brand: FullBrand; layerSeconds: number; area: {width: number; height: number}};
export type MotionDef = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  schema: z.ZodObject;
  title: string;          // shown in the app's component picker
  description?: string;   // one line: what it is for
  ownsExit?: boolean;     // the card animates its own exit: the layer's default exit is none
};

export const defineMotion = <S extends z.ZodObject>(def: {
  component: React.ComponentType<MotionProps<S>>; schema: S; title: string; description?: string; ownsExit?: boolean;
}): MotionDef => def;

/** Props after defaults, or a readable error listing every problem. */
export const parseMotionProps = (name: string, schema: z.ZodObject, props: unknown): Record<string, unknown> => {
  const r = schema.safeParse(props ?? {});
  if (r.success) return r.data as Record<string, unknown>;
  const issues = r.error.issues.map((i) => `${i.path.join('.') || '(props)'}: ${i.message}`).join('; ');
  throw new Error(`Motion "${name}" props invalid — ${issues}`);
};
