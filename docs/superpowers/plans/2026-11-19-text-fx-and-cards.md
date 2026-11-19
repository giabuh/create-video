# Text Effects and New Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add a shared, frame-driven text-effect engine, six new choreographed motion cards with decorations, and two
optional brand colors, without changing how existing storyboards render.

**Architecture:**
- Pure timing functions (`studio/src/motion/fx/textFx.ts`) compute each letter or word's style at time t.
- `FxText` renders them.
- `useChoreo` sequences a card's parts and its built-in exit.
- Cards are ordinary registered motion components (zod schema, so the app generates their forms).
- `ownsExit` makes the layer's default exit `none` for cards that animate their own exit, both in studio and in
  `tools/reel/props.py`.

**Tech stack:** Remotion 4.0.544 (React, TS), zod 4 via `motion/schema.ts`, vitest in `app/` (imports studio code
through the `@studio` alias), pytest in `tools/tests`.

**Spec:** `docs/superpowers/specs/2026-11-19-text-fx-and-cards-design.md`.

**Approved mockup:** `docs/superpowers/mockups/text-fx-cards/preview.html`. Its JS (`textIn`, `CARDS`) is the
reference for every timing.

## Global constraints

- All user-facing strings (schema titles, labels, descriptions) are Vietnamese.
- Rendering must be deterministic.
  - No `Math.random`, `Date`, or CSS animations/transitions; everything comes from `useCurrentFrame()`.
  - Randomness only through `random(seed)` from `remotion`.
- Existing storyboards render pixel-identical for every layer whose effect is left at its default. Baseline stills are in
  `.superpowers/baseline/f45.png f255.png f345.png f555.png f660.png`, made from
  `projects/khoa-hoc-quang-cao-facebook/render-props.json` with
  `cd studio && npx remotion still Reel <out> --frame=<n> --props=../projects/khoa-hoc-quang-cao-facebook/render-props.json`.
- Brand colors: new optional keys `accent2` (default `#E11D2E`) and `surface` (default `#FFFFFF`).
- Text effect ids: `none, typewriter, words, pop, scramble, mask, wave`.
- Pace: `fast` 0.7, `normal` 1, `slow` 1.4.
- Decor values: `none, sparkle, dot, emoji`.
- New card names: `Ribbon, TwoTier, Callout, PinLabel, GlossyPill, GiantText`. All have `ownsExit: true`.
- Testing cadence:
  - Per task, run only the tests for the files you touched.
  - The full suite runs once, at the final review: `uv run --with pytest python -m pytest tools/tests -q`;
    `cd studio && npx tsc --noEmit`; `cd app && npm test && npx tsc --noEmit`.
- Shared working tree:
  - Stage only your own files, by explicit path. Never `git add -A` or `git add .`.
  - `studio/src/motion/registry.ts` is shared by Tasks 3, 4 and 5: re-read it right before editing, add only your
    lines, then stage it.
- Commit messages: one line, no body, no Co-Authored-By trailer.
- `VieNeu-TTS/` is upstream code: never edit it.

## Card pattern (reference for Tasks 3–5)

Every new card follows this shape. `Ribbon` in Task 3 is the full worked example.

```tsx
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {BACK, eraseOut, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, optText, pace, text, textFx, z, type MotionProps} from './schema';

export const XSchema = z.object({ /* content fields */ fx: textFx('Hiệu ứng chữ', 'typewriter'), pace: pace(), decor: decor(), emoji: emoji() });

export const X: React.FC<MotionProps<typeof XSchema>> = (p) => {
  const k = PACE[p.pace];
  const {step, outP} = useChoreo(p.layerSeconds, k);   // step(atSec, durSec, easing?) → 0..1, times at pace 1
  const loaded = useFontsLoaded();
  const c = p.brand.colors;                              // primary, accent, accent2, surface, text, background: all set
  const size = loaded ? fitFontSize({text: p.title, maxSize: p.size, width: p.area.width * 0.8, height: p.area.height * 0.4, weight: 800}) : p.size;
  const textAt = 0.52;                                   // when the main text starts (pace-1 seconds)
  const textEnd = textAt + fxDuration(p.fx, p.title, 1); // chain later parts from here
  // shape: e.g. transform scaleX(step(0, 0.32)); text: <FxText text={p.title} fx={p.fx} start={textAt * k} k={k} />
  // exit: clipPath eraseOut(outP), or scale/opacity driven by outP
  return <AbsoluteFill style={{fontFamily}}>{/* ... */}<Decor kind={p.decor} emoji={p.emoji} at={textEnd} k={k} size={size} color={c.accent} /></AbsoluteFill>;
};
```

Every card is registered like this:

```ts
X: defineMotion({component: X, schema: XSchema, title: '…', description: '…', ownsExit: true}),
```

Font sizes are in px for a 1080×1920 frame, and fonts shrink with `fitFontSize` to fit `area`. For a still that shows
a card at mid-hold, render a frame about 2.2 s into the layer.

---

### Task 1: Brand colors in the app, server and validator

**Agent:** `worker-sonnet`. Mechanical edits in five known places plus tests.

**Files:**
- Modify: `app/shared/types.ts:23` (`MotionSpec.colors` keys) and `:78` (`BrandFile.colors`)
- Modify: `app/server/routes/settings.ts:12` (`COLORS`) and `:53` (fallback colors)
- Modify: `app/src/screens/Settings/BrandSection.tsx:15` (`COLORS`, and `same()`, which iterates `COLORS`)
- Modify: `app/src/screens/Editor/MotionLayerEditor.tsx:22` (`COLOR_KEYS`)
- Modify: `tools/reel/validate.py:11` (`COLOR_KEYS`)
- Test: `tools/tests/test_validate.py`, `app/server/routes/settings.test.ts`

**Interfaces:**
- Produces: `BrandFile.colors = {primary; accent; text; background; accent2?: string; surface?: string}`. Layer
  `colors` may override any of the six keys.

- [ ] **Step 1: Write the failing tests.**
  - In `tools/tests/test_validate.py`, add a test that a motion item with `"colors": {"accent2": "#f00", "surface": "#fff"}`
    produces no `colors may override` error. Copy the shape of the existing storyboard in that file's colors test
    (around line 70).
  - In `app/server/routes/settings.test.ts`, add a case where saving a brand with `colors.accent2 = '#E11D2E'` and
    `colors.surface = '#FFFFFF'` round-trips. Follow the file's existing save/read pattern.
- [ ] **Step 2: Run the tests and see them fail.**
  `uv run --with pytest python -m pytest tools/tests/test_validate.py -q`, then
  `cd app && npx vitest run server/routes/settings.test.ts`.
- [ ] **Step 3: Implement.**
  - `validate.py`: `COLOR_KEYS = {"primary", "accent", "text", "background", "accent2", "surface"}`.
  - `types.ts`: add `accent2?: string; surface?: string` to `BrandFile.colors`, and add the two keys to the
    `MotionSpec.colors` record union.
  - `settings.ts`: `COLORS` gets `'accent2', 'surface'`, but read the file first: if `COLORS` is used to require
    keys, those two must stay optional. The fallback object gets `accent2: '#E11D2E', surface: '#FFFFFF'`.
  - `BrandSection.tsx`: append `['accent2', 'Nhấn 2 (băng đỏ, ruy băng)']` and `['surface', 'Nền sáng (ô trắng)']`.
    A brand file lacking them must show the defaults `#E11D2E` / `#FFFFFF` in the `ColorField`
    (`form.colors[k] ?? DEFAULT[k]`), so `same()` stays correct.
  - `MotionLayerEditor.tsx`: append `['accent2', 'Nhấn 2']` and `['surface', 'Nền sáng']`.
- [ ] **Step 4: Run the tests and see them pass.** Use the same two commands, plus `cd app && npx tsc --noEmit`.
- [ ] **Step 5: Commit.**
  `git add tools/reel/validate.py tools/tests/test_validate.py app/shared/types.ts app/server/routes/settings.ts app/server/routes/settings.test.ts app/src/screens/Settings/BrandSection.tsx app/src/screens/Editor/MotionLayerEditor.tsx && git commit -m "Brand colors accent2 and surface in app, server and validator"`

---

### Task 2: Text-effect engine, choreography, decor, schema helpers, ownsExit

**Agent:** `worker-sonnet`. The code is fully specified here; the timing logic only needs careful transcription and
tests.

**Files:**
- Create: `studio/src/motion/fx/textFx.ts`, `studio/src/motion/fx/FxText.tsx`, `studio/src/motion/fx/choreo.ts`,
  `studio/src/motion/fx/Decor.tsx`
- Modify: `studio/src/motion/schema.ts` (helpers `textFx`, `pace`, `decor`, `emoji`; `ownsExit` on `MotionDef` and
  `defineMotion`; `MotionProps.brand` gets full colors)
- Modify: `studio/src/types.ts:30` (`Brand.colors` gains `accent2?`, `surface?`; add `FullBrand`)
- Modify: `studio/src/components/MotionLayer.tsx` (fill brand color defaults; `ownsExit` default exit)
- Modify: `tools/reel/props.py:66` (`OWNS_EXIT`)
- Test: `app/src/screens/Editor/textFx.test.ts` (new), `tools/tests/test_props.py`

**Interfaces:**
- Produces, used by Tasks 3–6:
  - `TEXT_FX`, `TextFx`, `TEXT_FX_LABELS`, `PACE`, `Pace`, `splitUnits(text): string[][][]`
    (lines → words → graphemes), `fxDuration(fx, text, k): number`,
    `unitStyle(fx, i, n, t, k, seed): {opacity; transform; filter?}`, `scrambleSlots(n, seed): number[]`
  - `<FxText text fx start? k? seed? strokeColor? style? />`
  - `useChoreo(layerSeconds, k) → {t, step(at, dur, easing?), outP}`, `BACK`, `eraseOut(p): string | undefined`
  - `<Decor kind emoji? at k size color />`
  - Schema helpers: `textFx(title, value)`, `pace()`, `decor()`, `emoji()`
  - `defineMotion({..., ownsExit?: boolean})`
  - `MotionProps.brand.colors` has all six keys set.

- [ ] **Step 1: Write the failing test** `app/src/screens/Editor/textFx.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {TEXT_FX, fxDuration, fxUnit, scrambleSlots, splitUnits, unitStyle} from '@studio/motion/fx/textFx';

const TEXT = 'Khóa học Quảng cáo Facebook';

describe('text effects', () => {
  it('splits lines, words and Vietnamese graphemes without breaking words', () => {
    expect(splitUnits('Khóa học\nỨng dụng')).toEqual([[['K', 'h', 'ó', 'a'], ['h', 'ọ', 'c']], [['Ứ', 'n', 'g'], ['d', 'ụ', 'n', 'g']]]);
    expect(splitUnits('a   b')).toEqual([[['a'], ['b']]]);
  });
  it('shows every unit fully at fxDuration', () => {
    for (const fx of TEXT_FX) {
      const words = splitUnits(TEXT).flat();
      const n = fxUnit(fx) === 'word' ? words.length : words.reduce((a, w) => a + w.length, 0);
      const end = fxDuration(fx, TEXT, 1);
      for (let i = 0; i < n; i++) {
        const s = unitStyle(fx, i, n, end + 1e-6, 1, 7);
        expect(s.opacity, `${fx} unit ${i}`).toBeCloseTo(1, 5);
        if (fx !== 'wave') expect(s.transform, `${fx} unit ${i}`).toBe('none');
        expect(s.filter ?? 'none').toBe('none');
      }
    }
  });
  it('hides units before they start (except none, which only fades)', () => {
    for (const fx of TEXT_FX.filter((f) => f !== 'none' && f !== 'mask')) expect(unitStyle(fx, 3, 10, -0.01, 1, 1).opacity).toBe(0);
    expect(unitStyle('mask', 0, 4, 0, 1, 1).transform).toBe('translateY(110%)');
  });
  it('scales durations linearly with pace', () => {
    for (const fx of TEXT_FX) expect(fxDuration(fx, TEXT, 1.4)).toBeCloseTo(fxDuration(fx, TEXT, 1) * 1.4, 6);
  });
  it('scramble is a deterministic permutation per seed', () => {
    const a = scrambleSlots(12, 3);
    expect(scrambleSlots(12, 3)).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual([...Array(12).keys()]);
    expect(scrambleSlots(12, 4)).not.toEqual(a);
  });
});
```

- [ ] **Step 2: Run it and see it fail.** `cd app && npx vitest run src/screens/Editor/textFx.test.ts` should fail with
  "Failed to resolve import".

- [ ] **Step 3: Write `studio/src/motion/fx/textFx.ts`.**

```ts
// Pure timing of the text effects: the style of one unit (a grapheme or a word) at time t after the effect starts.
// Frame-driven and deterministic (scramble uses remotion's seeded random), so every render is identical.
import {Easing, random} from 'remotion';

export const TEXT_FX = ['none', 'typewriter', 'words', 'pop', 'scramble', 'mask', 'wave'] as const;
export type TextFx = (typeof TEXT_FX)[number];
export const TEXT_FX_LABELS: Record<TextFx, string> = {
  none: 'Hiện ngay', typewriter: 'Gõ phím', words: 'Từng từ trượt lên', pop: 'Bật từng chữ cái',
  scramble: 'Xáo chữ', mask: 'Trồi lên từ vạch che', wave: 'Sóng nghiêng',
};
export const PACE = {fast: 0.7, normal: 1, slow: 1.4} as const;
export type Pace = keyof typeof PACE;

// seconds at pace 1, from the approved mockup: gap = delay between consecutive units, dur = one unit's animation
const SPEC: Record<TextFx, {unit: 'char' | 'word'; gap: number; dur: number}> = {
  none: {unit: 'word', gap: 0, dur: 0.12},
  typewriter: {unit: 'char', gap: 0.055, dur: 0},
  words: {unit: 'word', gap: 0.09, dur: 0.42},
  pop: {unit: 'char', gap: 0.032, dur: 0.42},
  scramble: {unit: 'char', gap: 0.04, dur: 0.3},
  mask: {unit: 'word', gap: 0.08, dur: 0.52},
  wave: {unit: 'char', gap: 0.028, dur: 0.38},
};
export const fxUnit = (fx: TextFx) => SPEC[fx].unit;

const seg = new Intl.Segmenter('vi', {granularity: 'grapheme'});
/** Lines → words → graphemes (diacritics stay on their letter; runs of spaces collapse). */
export const splitUnits = (text: string): string[][][] =>
  text.split('\n').map((line) => line.split(/\s+/).filter(Boolean).map((w) => Array.from(seg.segment(w), (s) => s.segment)));

const countUnits = (fx: TextFx, text: string) => {
  const words = splitUnits(text).flat();
  return SPEC[fx].unit === 'word' ? words.length : words.reduce((n, w) => n + w.length, 0);
};

/** Seconds until the whole text is shown, at pace multiplier k. */
export const fxDuration = (fx: TextFx, text: string, k: number): number => {
  const s = SPEC[fx];
  return (s.gap * Math.max(0, countUnits(fx, text) - 1) + s.dur) * k;
};

const slotCache = new Map<string, number[]>();
/** slot[i] = the turn at which unit i appears: a permutation of 0..n-1, fixed per seed. */
export const scrambleSlots = (n: number, seed: number): number[] => {
  const key = `${n}:${seed}`;
  let slots = slotCache.get(key);
  if (!slots) {
    const order = [...Array(n).keys()].sort((a, b) => random(`fx-${seed}-${a}`) - random(`fx-${seed}-${b}`));
    slots = new Array<number>(n);
    order.forEach((unit, turn) => { slots![unit] = turn; });
    slotCache.set(key, slots);
  }
  return slots;
};

const ease = Easing.out(Easing.cubic);
const back = Easing.out(Easing.back(1.7));
export type UnitStyle = {opacity: number; transform: string; filter?: string};

/** Style of unit i (of n) at t seconds after the effect starts, at pace multiplier k. */
export const unitStyle = (fx: TextFx, i: number, n: number, t: number, k = 1, seed = 0): UnitStyle => {
  const s = SPEC[fx];
  const slot = fx === 'scramble' ? scrambleSlots(n, seed)[i] : i;
  const t0 = slot * s.gap * k;
  const dur = s.dur * k;
  const p = dur === 0 ? (t >= t0 ? 1 : 0) : Math.min(1, Math.max(0, (t - t0) / dur));
  const done = p >= 1;
  switch (fx) {
    case 'none': return {opacity: ease(p), transform: 'none'};
    case 'typewriter': return {opacity: p, transform: 'none'};
    case 'words': { const e = ease(p); return {opacity: e, transform: done ? 'none' : `translateY(${(1 - e) * 80}%)`}; }
    case 'pop': return {opacity: Math.min(1, p * 3), transform: done ? 'none' : `scale(${back(p)})`};
    case 'scramble': {
      const e = ease(p);
      return done ? {opacity: 1, transform: 'none'}
        : {opacity: e, transform: `translateY(${(e - 1) * 40}%) scale(${1.4 - 0.4 * e})`, filter: `blur(${(1 - e) * 4}px)`};
    }
    case 'mask': { const e = ease(p); return {opacity: 1, transform: done ? 'none' : `translateY(${(1 - e) * 110}%)`}; }
    case 'wave': {
      // pop in, then bob forever: 14% amplitude, 1.1 s period, phase 0.055 s per grapheme
      const bob = t <= t0 ? 0 : -14 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - t0 - i * 0.055 * k)) / (1.1 * k)));
      const e = back(p);
      return {opacity: Math.min(1, p * 3), transform: `translateY(${bob + (1 - Math.min(1, e)) * 60}%) scale(${0.3 + 0.7 * e})`};
    }
  }
};
```

- [ ] **Step 4: Run the test and see it pass.** If "shows every unit fully" fails for `wave` opacity, check the order
  of `p` clamping; do not loosen the test.

- [ ] **Step 5: Write `studio/src/motion/fx/FxText.tsx`.**

```tsx
// Renders text with one of the TEXT_FX effects. Words never break inside (nowrap inline-blocks); lines from '\n'.
// Hidden units keep their space (opacity 0), so the layout never jumps while the text appears.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {fxDuration, fxUnit, splitUnits, unitStyle, type TextFx} from './textFx';

export const FxText: React.FC<{
  text: string; fx: TextFx; start?: number; k?: number; seed?: number; strokeColor?: string; style?: React.CSSProperties;
}> = ({text, fx, start = 0, k = 1, seed = 0, strokeColor, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps - start;
  const lines = splitUnits(text);
  const words = lines.flat();
  const n = fxUnit(fx) === 'word' ? words.length : words.reduce((a, w) => a + w.length, 0);
  let unit = 0;
  const st = (i: number) => unitStyle(fx, i, n, t, k, seed);
  const caretOn = fx === 'typewriter' && t >= 0 && t < fxDuration(fx, text, k) + 0.7 * k && Math.floor(t / 0.25) % 2 === 0;
  const wave: React.CSSProperties = fx === 'wave'
    ? {display: 'inline-block', fontStyle: 'italic', transform: 'rotate(-5deg) skewX(-6deg)',
      ...(strokeColor && {WebkitTextStroke: `0.05em ${strokeColor}`, paintOrder: 'stroke fill'})}
    : {};
  return (
    <span style={{...wave, ...style}}>
      {lines.map((line, li) => (
        <span key={li} style={{display: lines.length > 1 ? 'block' : 'inline'}}>
          {line.map((word, wi) => {
            const sep = wi < line.length - 1 ? ' ' : '';
            if (fxUnit(fx) === 'word') {
              const s = st(unit++);
              return fx === 'mask'
                ? <React.Fragment key={wi}><span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0 0.02em'}}>
                    <span style={{display: 'inline-block', transform: s.transform}}>{word.join('')}</span></span>{sep}</React.Fragment>
                : <React.Fragment key={wi}><span style={{display: 'inline-block', whiteSpace: 'nowrap', ...s}}>{word.join('')}</span>{sep}</React.Fragment>;
            }
            return (
              <React.Fragment key={wi}>
                <span style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                  {word.map((g, gi) => <span key={gi} style={{display: 'inline-block', whiteSpace: 'pre', ...st(unit++)}}>{g}</span>)}
                </span>{sep}
              </React.Fragment>
            );
          })}
          {li === lines.length - 1 && fx === 'typewriter' &&
            <span style={{display: 'inline-block', width: '0.08em', height: '1em', marginLeft: '0.06em', verticalAlign: '-0.12em',
              background: 'currentColor', opacity: caretOn ? 1 : 0}} />}
        </span>
      ))}
    </span>
  );
};
```

- [ ] **Step 6: Write `studio/src/motion/fx/choreo.ts`.**

```ts
// Sequencing for cards that assemble in parts and animate their own exit (registered with ownsExit).
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export const BACK = Easing.out(Easing.back(1.7));
const OUT = Easing.out(Easing.cubic);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** t = seconds since the layer start; step(at, dur) = 0..1 progress of a part, times given at pace 1 and scaled by k;
 *  outP = 0..1 progress of the exit over the last 0.4·k s (at most a third of the layer). */
export const useChoreo = (layerSeconds: number, k: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const step = (at: number, dur: number, easing: (x: number) => number = OUT) =>
    interpolate(t, [at * k, (at + Math.max(dur, 1 / fps)) * k], [0, 1], {...clamp, easing});
  const outLen = Math.min(0.4 * k, layerSeconds / 3);
  const outP = interpolate(t, [layerSeconds - outLen, layerSeconds], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  return {t, step, outP};
};

/** clipPath that erases the content left to right as p goes 0 → 1 (undefined = no clip). */
export const eraseOut = (p: number): string | undefined => (p <= 0 ? undefined : `inset(-20% -20% -20% ${-5 + 110 * p}%)`);
```

- [ ] **Step 7: Write `studio/src/motion/fx/Decor.tsx`.** Place it inside the card's `position: relative` wrapper.
  Timings come from the mockup (`sparkle()`; glossy sticker; ribbon dot).

```tsx
// Optional decoration of a card, entering at `at` (pace-1 seconds) once the main text is shown.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {BACK} from './choreo';

export type DecorKind = 'none' | 'sparkle' | 'dot' | 'emoji';
const Burst: React.FC<{p: number; pulse: number; flip?: boolean; style: React.CSSProperties; size: number}> = ({p, pulse, flip, style, size}) => (
  <svg viewBox="0 0 40 40" style={{position: 'absolute', width: size, height: size, transform: `rotate(${flip ? 180 : 0}deg) scale(${BACK(p) * pulse})`,
    transformOrigin: '50% 100%', opacity: Math.min(1, p * 2), ...style}}>
    {[[20, 14, 20, 3], [26, 18, 35, 10], [14, 18, 5, 10]].map(([x1, y1, x2, y2], i) =>
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={3} strokeLinecap="round" />)}
  </svg>
);

export const Decor: React.FC<{kind: DecorKind; emoji?: string; at: number; k: number; size: number; color: string}> = ({kind, emoji, at, k, size, color}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps - at * k;
  if (kind === 'none' || t < 0) return null;
  const p = Math.min(1, t / (0.6 * k));
  if (kind === 'sparkle') {
    const pulse = t < 0.6 * k ? 1 : 1 + 0.25 * Math.sin(((t - 0.6 * k) / (0.7 * k)) * Math.PI) ** 2;
    return <>
      <Burst p={p} pulse={pulse} size={size * 1.4} style={{right: -size * 1.1, top: -size * 1.2}} />
      <Burst p={Math.min(1, Math.max(0, (t - 0.1 * k) / (0.6 * k)))} pulse={pulse} flip size={size * 1.4} style={{left: -size * 1.1, bottom: -size * 1.2}} />
    </>;
  }
  if (kind === 'dot') {
    const blink = 0.65 + 0.35 * Math.cos((2 * Math.PI * t) / (0.9 * k));
    return <span style={{position: 'absolute', right: -size * 0.9, top: -size * 0.3, width: size * 0.6, height: size * 0.6, borderRadius: '50%',
      background: color, boxShadow: `0 0 ${size * 0.5}px ${color}`, transform: `scale(${BACK(Math.min(1, t / (0.3 * k)))})`, opacity: blink}} />;
  }
  if (!emoji) return null;
  const pop = BACK(Math.min(1, t / (0.4 * k)));
  const wiggle = t < 0.4 * k ? 0 : 11 * Math.sin((2 * Math.PI * (t - 0.4 * k)) / (0.26 * k));
  return <span style={{position: 'absolute', right: -size * 1.6, top: -size * 0.9, fontSize: size * 1.7, lineHeight: 1,
    transform: `scale(${pop}) rotate(${(1 - pop) * -40 + wiggle}deg)`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.5))'}}>{emoji}</span>;
};
```

- [ ] **Step 8: Add the schema helpers and `ownsExit` to `studio/src/motion/schema.ts`.** Add after `media`:

```ts
import {TEXT_FX, TEXT_FX_LABELS, type TextFx} from './fx/textFx';
/** Which text effect a card uses for its main text. */
export const textFx = (title: string, value: TextFx) => choice(title, TEXT_FX, value, TEXT_FX_LABELS);
/** Speed of a card's whole choreography: fast 0.7×, normal 1×, slow 1.4× (see PACE). */
export const pace = () => choice('Nhịp', ['fast', 'normal', 'slow'], 'normal', {fast: 'Nhanh', normal: 'Vừa', slow: 'Chậm'});
export const decor = () => choice('Trang trí', ['none', 'sparkle', 'dot', 'emoji'], 'none',
  {none: 'Không', sparkle: 'Tia lấp lánh', dot: 'Chấm nháy', emoji: 'Sticker emoji'});
export const emoji = () => optText('Emoji (khi trang trí là sticker), VD: 📢 🔥 ⭐');
```

  Then:
  - In `MotionProps`, change `brand: Brand` to `brand: FullBrand`.
  - Add `ownsExit?: boolean // the card animates its own exit: the layer's default exit is none` to `MotionDef`, and
    to the `defineMotion` parameter type. It passes through as is.
  - `import type {FullBrand} from '../types'` replaces the `Brand` import if `Brand` becomes unused there.

- [ ] **Step 9: Update `studio/src/types.ts` and `MotionLayer.tsx`.**
  - `types.ts`: `colors: {primary: string; accent: string; text: string; background: string; accent2?: string; surface?: string}`
    and
    `export type FullBrand = Omit<Brand, 'colors'> & {colors: Required<Brand['colors']>};`
    `export const BRAND_COLOR_DEFAULTS = {accent2: '#E11D2E', surface: '#FFFFFF'};`
    (If `types.ts` must stay type-only, put the const in `MotionLayer.tsx`.)
  - `MotionLayer.tsx`:
    - `const layerBrand: FullBrand = {...brand, colors: {...BRAND_COLOR_DEFAULTS, ...brand.colors, ...(it.colors ?? {})}};`
      replaces the current `layerBrand` line.
    - `withDefaults`: `exit: item.exit ?? (position === 'full' || MOTION[item.component]?.ownsExit ? NONE : {type: 'fade', duration: 0.25})`.
- [ ] **Step 10: `tools/reel/props.py`, a test first.** In `tools/tests/test_props.py`, add a test: a storyboard motion
  `{"component": "Ribbon", "position": "bottom", ...}` with no `exit` yields `"exit": {"type": "none", "duration": 0.0}`,
  while `"Text"` in the same position still yields a 0.25 s fade. Build it from the existing motion test's storyboard
  (`test_free_box_animation_and_colors`, around line 69).
  Run `uv run --with pytest python -m pytest tools/tests/test_props.py -q` and see it fail. Then implement:

```python
# Cards that animate their own exit (registered with ownsExit: true in studio/src/motion/registry.ts): no default fade.
OWNS_EXIT = {"Ribbon", "TwoTier", "Callout", "PinLabel", "GlossyPill", "GiantText"}
...
        "exit": _anim(m.get("exit"), "none" if position == "full" or m["component"] in OWNS_EXIT else "fade",
                      0.25 if m.get("exit") is None else 0.35),
```

  Run it again and see it pass.
- [ ] **Step 11: Run the checks.**
  - `cd studio && npx tsc --noEmit`: existing components still compile, since they only read the four old keys.
  - `cd app && npx vitest run src/screens/Editor/textFx.test.ts src/screens/Editor/motionSchema.test.ts && npx tsc --noEmit`
  - Regression, 3 frames: render `.superpowers/check/f45.png`, `f345.png`, `f660.png` with the still command from Global
    constraints, then
    `python3 -c "from PIL import Image, ImageChops as C; import sys; a,b=Image.open(sys.argv[1]),Image.open(sys.argv[2]); print(C.difference(a.convert('RGB'),b.convert('RGB')).getbbox())" .superpowers/baseline/f45.png .superpowers/check/f45.png`.
    It must print `None` for each frame. If PIL is missing: `uv run --with pillow python3 -c ...`.
- [ ] **Step 12: Commit.**
  `git add studio/src/motion/fx studio/src/motion/schema.ts studio/src/types.ts studio/src/components/MotionLayer.tsx tools/reel/props.py tools/tests/test_props.py app/src/screens/Editor/textFx.test.ts && git commit -m "Text-effect engine, card choreography, decor, brand color defaults and ownsExit"`

**Report back:** test output lines, the regression `getbbox` results, and anything in the code above you had to change
and why.

---

### Task 3: Cards `Ribbon`, `TwoTier`, `PinLabel`

**Agent:** `worker-sonnet`. Visual components on a specified engine.

**Files:** create `studio/src/motion/Ribbon.tsx`, `TwoTier.tsx`, `PinLabel.tsx`; modify `studio/src/motion/registry.ts`.

**Interfaces:** consumes everything Task 2 produces. Produces the registered components `Ribbon`, `TwoTier`,
`PinLabel`.

All times are seconds at pace 1. Wrap them with `step(at, dur)` and pass `start = at * k` to `FxText`.

- [ ] **Step 1: Write `Ribbon.tsx`, the worked example of the card pattern.**

```tsx
// Ribbon: an accent2 bar with a slanted end and a folded white tail; the title types in; an optional sub line with a dot.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {fitFontSize, useFontsLoaded} from '../fit';
import {fontFamily} from '../fonts';
import {BACK, useChoreo} from './fx/choreo';
import {Decor} from './fx/Decor';
import {FxText} from './fx/FxText';
import {fxDuration, PACE} from './fx/textFx';
import {decor, emoji, numDefault, optText, pace, text, textFx, z, type MotionProps} from './schema';

export const RibbonSchema = z.object({
  title: text('Chữ chính'),
  sub: optText('Dòng phụ (có chấm vàng)'),
  size: numDefault('Cỡ chữ tối đa (px)', 72, {min: 30, max: 160, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'typewriter'),
  pace: pace(), decor: decor(), emoji: emoji(),
});

export const Ribbon: React.FC<MotionProps<typeof RibbonSchema>> = (p) => {
  const k = PACE[p.pace];
  const {step, outP} = useChoreo(p.layerSeconds, k);
  const loaded = useFontsLoaded();
  const c = p.brand.colors;
  const w = p.area.width * 0.88;
  const size = loaded ? fitFontSize({text: p.title, maxSize: p.size, width: w, height: p.area.height * 0.55, weight: 800, padX: 1.2, padY: 0.32}) : p.size;
  const textAt = 0.52;
  const subAt = textAt + fxDuration(p.fx, p.title, 1);
  const subEnd = subAt + 0.15 + (p.sub ? fxDuration('words', p.sub, 1) : 0);
  const out = (a: number, b: number) => Math.min(1, Math.max(0, (outP - a) / (b - a))); // sub leaves first, then the bar
  return (
    <AbsoluteFill style={{fontFamily, fontWeight: 800, justifyContent: 'center'}}>
      <div style={{position: 'relative', marginLeft: p.area.width * 0.06, width: 'fit-content', maxWidth: w}}>
        <div style={{position: 'relative', background: c.accent2, color: c.text, fontSize: size, lineHeight: 1.2,
          padding: `${size * 0.32}px ${size * 0.7}px ${size * 0.32}px ${size * 0.5}px`,
          clipPath: `polygon(0 0, 100% 0, calc(100% - ${size * 0.8}px) 100%, 0 100%)`,
          transformOrigin: 'left', transform: `scaleX(${step(0, 0.32) * (1 - out(0.4, 1))})`}}>
          <FxText text={p.title} fx={p.fx} start={textAt * k} k={k} />
        </div>
        <div style={{position: 'absolute', right: size * 1.4, top: '100%', width: 0, height: 0,
          borderLeft: `${size * 0.55}px solid transparent`, borderRight: `${size * 0.55}px solid transparent`, borderTop: `${size * 0.6}px solid ${c.surface}`,
          opacity: step(0.32, 0.3) * (1 - out(0.3, 0.6)), transform: `translateY(${(1 - BACK(step(0.32, 0.3, (x) => x))) * -120}%)`}} />
        {p.sub && (
          <div style={{margin: `${size * 0.55}px 0 0 ${size * 0.9}px`, color: c.text, fontSize: size * 0.82, textShadow: '0 2px 6px rgba(0,0,0,.8)',
            opacity: 1 - out(0, 0.5), transform: `translateY(${out(0, 0.5) * 30}%)`}}>
            <span style={{display: 'inline-block', width: '0.6em', height: '0.6em', borderRadius: '50%', background: c.accent, marginRight: '0.4em',
              boxShadow: `0 0 0.5em ${c.accent}`, transform: `scale(${BACK(step(subAt, 0.3, (x) => x))})`}} />
            <FxText text={p.sub} fx="words" start={(subAt + 0.15) * k} k={k} />
          </div>
        )}
        <Decor kind={p.decor} emoji={p.emoji} at={subEnd} k={k} size={size * 0.6} color={c.accent} />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Write `TwoTier.tsx`.** Schema:

```ts
export const TwoTierSchema = z.object({
  top: text('Dòng trên (ô sáng)'),
  bottom: text('Dòng dưới (băng xéo)'),
  size: numDefault('Cỡ chữ tối đa (px)', 69, {min: 30, max: 160, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'pop'),
  pace: pace(), decor: decor(), emoji: emoji(),
});
```

  Layout: one centered column (`textAlign: center`). Top to bottom:
  1. a 2 px `c.surface` rule, 46% of the area wide;
  2. an inline-block box: `c.surface` background, `c.background` text, `top` at `size`, padding `0.18em 0.9em`;
  3. a block banner: `c.accent2` background, `c.text` text, `bottom` at `size * 0.87`, padding `0.3em 1.1em`,
     `skewX(-14deg)`, with the inner text counter-skewed (`skewX(14deg)`);
  4. another 2 px rule.

  `fitFontSize` on the longer of `top` and `bottom`, width `area.width * 0.85`.

  | at | dur | part | animation |
  |---|---|---|---|
  | 0 | 0.30 | both rules | `scaleX(step)` from the center |
  | 0.20 | 0.28 | top box | `scaleY(BACK(step))` |
  | 0.42 | – | top text | `FxText fx={p.fx}` |
  | 0.65 | 0.38 | banner | `translateX((step - 1) * 130%)`, keeping `skewX(-14deg)` |
  | 0.90 | – | bottom text | `FxText fx="words"` |
  | end of bottom text | – | decor | `<Decor>` |
  | exit | – | whole card | `scale(1 - 0.15 * outP)`, `opacity: 1 - outP` |

- [ ] **Step 3: Write `PinLabel.tsx`.** Schema:

```ts
export const PinLabelSchema = z.object({
  text: text('Chữ (VD: tại Sao Việt)'),
  size: numDefault('Cỡ chữ tối đa (px)', 108, {min: 40, max: 220, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'pop'),
  pace: pace(), decor: decor(), emoji: emoji(),
});
```

  Layout: a centered row with the pin, then the text.
  - Pin: an inline SVG `viewBox="0 0 24 32"`, path
    `M12 0C5.4 0 0 5.3 0 11.8 0 20.6 12 32 12 32s12-11.4 12-20.2C24 5.3 18.6 0 12 0z`, fill `c.accent2`, stroke
    `#fff` width 1.6, plus an inner `circle cx=12 cy=11.5 r=4.2` filled `#fff`. Width `size * 1.1`.
  - Text: color `c.accent`, `WebkitTextStroke: 0.09em c.primary`, `paintOrder: 'stroke fill'`, `rotate(-7deg)`,
    `textShadow: '0 .1em .2em rgba(0,0,0,.4)'`.

  | at | dur | part | animation |
  |---|---|---|---|
  | 0 | 0.65 | pin | drop with bounce: let `q = step(0, 0.65, x => x)`. `translateY` = −400% at q=0 → 0% at 0.6 → −25% at 0.8 → 0% at 1 (piecewise `interpolate` over [0, 0.6, 0.8, 1]); opacity `min(1, q * 3)` |
  | 0.50 | – | text | `FxText fx={p.fx}` |
  | exit | – | pin and text | `translateY(-30% * outP)`, `opacity: 1 - outP` |

- [ ] **Step 4: Register all three** in `registry.ts` (re-read it first; add only these lines):

```ts
  Ribbon: defineMotion({component: Ribbon, schema: RibbonSchema, title: 'Ruy băng', description: 'Băng màu gấp góc, chữ gõ vào, dòng phụ có chấm', ownsExit: true}),
  TwoTier: defineMotion({component: TwoTier, schema: TwoTierSchema, title: 'Thẻ hai tầng', description: 'Ô sáng ở trên, băng xéo màu ở dưới', ownsExit: true}),
  PinLabel: defineMotion({component: PinLabel, schema: PinLabelSchema, title: 'Ghim vị trí', description: 'Ghim 📍 rơi xuống kèm chữ (địa điểm)', ownsExit: true}),
```

- [ ] **Step 5: Verify.**
  - `cd studio && npx tsc --noEmit`.
  - Make a test project to render stills over real footage, outside git: copy
    `projects/khoa-hoc-quang-cao-facebook/render-props.json` to `.superpowers/check/props-task3.json`. In the copy,
    set the first scene's `motion` to one layer of your card, `{"component": "Ribbon", "props": {"title": "Để cải thiện hiệu quả công việc", "sub": "trong lĩnh vực Marketing", "decor": "dot"}, "start": 0, "duration": 4, "position": "bottom", "box": null, "backdrop": "none", "scale": 1, "rotate": 0, "opacity": 1, "enter": {"type": "none", "duration": 0}, "exit": {"type": "none", "duration": 0}, "keyframes": [], "colors": null}`,
    and render frames 15, 45 and 66 with
    `npx remotion still Reel ../.superpowers/check/ribbon-<f>.png --frame=<f> --props=../.superpowers/check/props-task3.json`.
  - Look at each PNG. Check that the card is assembled at frame 66, has no overflow, is readable on footage, and that
    words do not break mid-word.
  - Repeat for `TwoTier` (`top: "Người đi làm"`, `bottom: "Trong lĩnh vực marketing"`, `decor: "sparkle"`) and
    `PinLabel` (`text: "tại Sao Việt"`).
  - Compare with the mockup cards `ribbon`, `twotier` and `pin`.
- [ ] **Step 6: Commit.**
  `git add studio/src/motion/Ribbon.tsx studio/src/motion/TwoTier.tsx studio/src/motion/PinLabel.tsx studio/src/motion/registry.ts && git commit -m "Motion cards Ribbon, TwoTier and PinLabel"`

**Report back:** tsc output, still paths, and one sentence per card on how it compares to the mockup.

---

### Task 4: Cards `Callout`, `GiantText`

**Agent:** `worker-sonnet`. Visual components on a specified engine; both are full-frame.

**Files:** create `studio/src/motion/Callout.tsx`, `GiantText.tsx`; modify `studio/src/motion/registry.ts`.

**Interfaces:** consumes Task 2 (follow the "Card pattern" section at the top of this plan). Produces `Callout` and
`GiantText`.

- [ ] **Step 1: Write `Callout.tsx`.** Schema:

```ts
export const CalloutSchema = z.object({
  title: text('Chữ chính (VD: Đăng Ký)'),
  sub1: optText('Dòng phụ 1 (băng màu)'),
  sub2: optText('Dòng phụ 2 (ô sáng)'),
  targetX: numDefault('Điểm chỉ: ngang (% khung)', 72, {min: 0, max: 100, step: 1}),
  targetY: numDefault('Điểm chỉ: dọc (% khung)', 46, {min: 0, max: 100, step: 1}),
  labelX: numDefault('Ô chữ: ngang (% khung)', 12, {min: 0, max: 100, step: 1}),
  labelY: numDefault('Ô chữ: dọc (% khung)', 38, {min: 0, max: 100, step: 1}),
  size: numDefault('Cỡ chữ tối đa (px)', 97, {min: 40, max: 200, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'typewriter'),
  pace: pace(), decor: decor(), emoji: emoji(),
});
```

  Coordinates are % of `area` (the card is meant for `position: full`).
  - Label: absolutely positioned with `left: labelX%` and `top: labelY%`. The `title` box uses `c.accent2` with
    `c.text` text at `size`, padding `0.15em 0.45em`, `boxShadow 0 .1em .4em rgba(0,0,0,.35)`.
  - Directly under it: `sub1` (`c.accent2` box, `c.text` text, `size * 0.62`), then `sub2` (`c.surface` box, `c.primary`
    text, `size * 0.69`), indented `size * 0.6`.
  - Ring at the target: diameter `size * 1`, border `size * 0.09` `#fff`, an inner dot `size * 0.33`, centered on
    (targetX%, targetY%).
  - Line: an SVG covering the area, polyline from the label box's right edge (vertical middle of the title box) going
    horizontally by `size * 0.8`, then to the ring center. Stroke `#fff`, width 4, `pathLength={1}`,
    `strokeDasharray={1}`, `strokeDashoffset={1 - progress}`. Measure the title box width with
    `widthOf(title, size, 800)` from `fit.ts`, plus the padding.

  | at | dur | part | animation |
  |---|---|---|---|
  | 0 | 0.38 | ring | `scale(BACK(step))`. Then a pulse: `boxShadow 0 0 0 (size*0.4*q)px rgba(255,255,255,(0.7*(1-q)))`, with `q = ((t - 0.4k) / (1.1k)) mod 1` |
  | 0.30 | 0.30 | line | draw |
  | 0.56 | 0.28 | title box | `scaleX(step)`, `transformOrigin: right` (it opens from the line side) |
  | 0.82 | – | title | `FxText fx={p.fx}` |
  | titleEnd | 0.35 | sub1 | `clipPath inset(0 (1-step)*100% 0 0)`; text `fx none` from titleEnd + 0.1 |
  | titleEnd + 0.25 | 0.35 | sub2 | `clipPath inset(0 0 0 (1-step)*100%)`; text `fx pop` from titleEnd + 0.4 |
  | after sub2 | – | decor | `<Decor>` next to the title box |
  | exit | – | label boxes | `clipPath: eraseOut(outP)` |
  | exit | – | ring and line | `opacity: 1 - outP` |

- [ ] **Step 2: Write `GiantText.tsx`.** Schema:

```ts
export const GiantTextSchema = z.object({
  giant: text('Chữ khổng lồ (lướt ngang)'),
  caption: optText('Dòng chốt (đọng lại sau khi lướt)'),
  size: numDefault('Cỡ chữ khổng lồ (px)', 367, {min: 150, max: 600, step: 5}),
  captionSize: numDefault('Cỡ dòng chốt (px)', 91, {min: 40, max: 180, step: 2}),
  fx: textFx('Hiệu ứng dòng chốt', 'none'),
  pace: pace(), decor: decor(), emoji: emoji(),
});
```

  - Giant: uppercase (`toLocaleUpperCase('vi')`), `whiteSpace: nowrap`, `c.accent` fill,
    `WebkitTextStroke: 0.04em c.primary`, `paintOrder: stroke fill`, `letterSpacing: -0.02em`, top at 42% of the area,
    `lineHeight: 1`.
  - `translateX` goes from `area.width` to `-(widthOf(giant, size, 800) + area.width * 0.1)` over 1.3 s with
    `Easing.bezier(.3,.1,.7,.9)`. Opacity fades 1→0 from 1.15 s to 1.30 s.
  - Streak: a pill `area.width * 0.6` wide and `area.width * 0.03` tall, at 52%,
    `linear-gradient(90deg, transparent, #fff7c2, ${c.accent} 70%, transparent)`, `boxShadow 0 0 (area.width*0.04)px ${c.accent}`.
    `translateX` goes from `1.7 * area.width` to `-1.2 * area.width` over 0.15–0.95 s (linear). Opacity is 0 → 1 in
    the first 20%, then → 0.
  - Caption: centered at 68%, `c.text` with `WebkitTextStroke 0.07em c.primary`, `paintOrder stroke fill`, at
    `captionSize` fitted to `area.width * 0.9`. From 1.1 s it lands over 0.38 s: `scale(2.4 → 1)`, `blur(6 → 0)px`,
    opacity 0 → 1. Its text is `FxText fx={p.fx} start={1.1 * k}`.
  - Decor after the caption lands. Exit: the caption gets `clipPath: eraseOut(outP)`.
  - If `caption` is empty, the card is only the sweep.

- [ ] **Step 3: Register both** (re-read `registry.ts` first):

```ts
  Callout: defineMotion({component: Callout, schema: CalloutSchema, title: 'Nhãn chỉ điểm', description: 'Ô chữ có đường kẻ chỉ vào người/vật', ownsExit: true}),
  GiantText: defineMotion({component: GiantText, schema: GiantTextSchema, title: 'Chữ khổng lồ', description: 'Chữ to lướt ngang màn hình rồi đọng lại một dòng', ownsExit: true}),
```

- [ ] **Step 4: Verify.**
  - `cd studio && npx tsc --noEmit`.
  - Render stills as in the Task 3 method, using `.superpowers/check/props-task4.json` and `position: "full"`:
    - `Callout` with `{"title": "Đăng Ký", "sub1": "Khóa học Quảng cáo Facebook", "sub2": "tại Sao Việt"}` at frames
      15, 40 and 75;
    - `GiantText` with `{"giant": "Nắm vững kiến thức", "caption": "Nắm vững kiến thức"}` at frames 10, 25 and 60.
  - Look at them against the mockup cards `callout` and `giant`.
- [ ] **Step 5: Commit.**
  `git add studio/src/motion/Callout.tsx studio/src/motion/GiantText.tsx studio/src/motion/registry.ts && git commit -m "Motion cards Callout and GiantText"`

**Report back:** as in Task 3.

---

### Task 5: Card `GlossyPill`

**Agent:** `worker-sonnet`. One visual component.

**Files:** create `studio/src/motion/GlossyPill.tsx`; modify `studio/src/motion/registry.ts`.

**Interfaces:** consumes Task 2 (follow the "Card pattern" section at the top of this plan). Produces `GlossyPill`.

- [ ] **Step 1: Write `GlossyPill.tsx`.** Schema:

```ts
export const GlossyPillSchema = z.object({
  title: text('Chữ chính'),
  sub: optText('Dòng phụ (ô sáng bên dưới)'),
  sticker: optText('Sticker emoji cạnh nhãn, VD: 📢'),
  size: numDefault('Cỡ chữ tối đa (px)', 78, {min: 30, max: 160, step: 2}),
  fx: textFx('Hiệu ứng chữ', 'words'),
  pace: pace(), decor: decor(), emoji: emoji(),
});
```

  Layout: a centered column.
  - Pill: inline-block, `overflow: hidden`, `background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 55%, ${c.primary} 100%)`,
    `color: c.text`, `fontSize: size`, padding `0.28em 0.8em`, `borderRadius: 0.35em`,
    `border: 0.12em solid rgba(255,255,255,.95)`,
    `boxShadow: 0 0 0.6em rgba(59,130,246,.8), inset 0 0.12em 0 rgba(255,255,255,.35)`.
  - Shine: an absolute child 30% wide, `linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent)`,
    `skewX(-20deg)`, with `left` animated from −40% to 130%.
  - Sub: below the pill, inline-block, `c.surface` background, `c.primary` text, `size * 0.72`, padding
    `0.25em 0.9em`, `borderRadius 0.3em`.
  - Sticker: `position: absolute`, to the right of the pill and slightly above it.
  - `fitFontSize` on `title`, width `area.width * 0.8`.

  | at | dur | part | animation |
  |---|---|---|---|
  | 0 | 0.38 | pill | `scale(0.2 + 0.8 * BACK(step))`, opacity `step` |
  | 0.25 | – | title | `FxText fx={p.fx}`. `titleEnd = 0.25 + fxDuration` |
  | titleEnd | 0.70 | shine | sweep, `Easing.inOut(Easing.ease)` |
  | titleEnd − 0.1 | 0.30 | sub box | `translateY((1-step) * -60%) scaleY(step)` |
  | titleEnd + 0.1 | – | sub text | `FxText fx="mask"` |
  | subEnd | 0.40 | sticker | `scale(BACK) rotate(-40°→0)`, then wiggle ±11° with a 0.26 s period (same math as `Decor` emoji) |
  | after sticker | – | decor | `<Decor>` |
  | exit | – | whole card | `scale(1 + 0.3 * outP)`, `opacity: 1 - outP` |

- [ ] **Step 2: Register it** (re-read `registry.ts` first):

```ts
  GlossyPill: defineMotion({component: GlossyPill, schema: GlossyPillSchema, title: 'Nhãn bóng', description: 'Viên gradient viền sáng, vệt bóng quét qua, dòng phụ, sticker', ownsExit: true}),
```

- [ ] **Step 3: Verify.**
  - `cd studio && npx tsc --noEmit`.
  - Render stills with `.superpowers/check/props-task5.json` and `position: "bottom"`, using
    `{"title": "Học viên được tặng", "sub": "bộ Prompt AI độc quyền", "sticker": "📢"}`, at frames 12, 40 and 75.
  - Check that the emoji renders in color (not tofu), and compare against the mockup card `glossy`.
- [ ] **Step 4: Commit.**
  `git add studio/src/motion/GlossyPill.tsx studio/src/motion/registry.ts && git commit -m "Motion card GlossyPill"`

**Report back:** as in Task 3, plus whether the emoji renders.

---

### Task 6: Old cards get text effects

**Agent:** `worker-sonnet`. Additive fields with defaults, plus regression checks.

**Files:**
- Modify: `studio/src/motion/Text.tsx`, `KineticText.tsx`, `LowerThird.tsx`, `PriceTag.tsx`, `DateBadge.tsx`,
  `Checklist.tsx`
- Test: `app/src/screens/Editor/motionSchema.test.ts`

**Interfaces:** consumes `FxText`, `textFx`, `fxDuration` from Task 2.

- [ ] **Step 1: Update the failing test.** In `motionSchema.test.ts`:
  - change `expect(f.reveal.options).toContainEqual({value: 'typewriter', label: 'Gõ từng ký tự'})` to
    `{value: 'typewriter', label: 'Gõ phím'}`;
  - add `expect(f.reveal.options).toHaveLength(7)`;
  - add `for (const name of ['KineticText', 'LowerThird', 'PriceTag', 'DateBadge', 'Checklist']) expect(Object.fromEntries((motionFields(name) ?? []).map((x) => [x.key, x])).fx).toMatchObject({kind: 'choice', default: 'none'});`.
    Use whatever `kind` value `motionFields` really returns for a `choice`; read `motionSchema.ts` first.

  Run `cd app && npx vitest run src/screens/Editor/motionSchema.test.ts` and see it fail.
- [ ] **Step 2: Update `Text.tsx`.**
  - `reveal: textFx('Hiện chữ', 'none')`.
  - Replace the `content` computation with:

```tsx
  const k = p.reveal === 'none' ? 1 : p.revealSeconds / Math.max(1e-3, fxDuration(p.reveal, text, 1));
  const content = p.reveal === 'none' ? text : <FxText text={text} fx={p.reveal} k={k} strokeColor={p.brand.colors.primary} />;
```

  - Remove the now-unused `k` interpolation, `words` and `interpolate` imports. `reveal: 'none'` must render exactly
    the same as before: the plain `text` string.
- [ ] **Step 3: Add `fx: textFx('Hiệu ứng chữ', 'none')` to the other five schemas.** Apply it only when
  `fx !== 'none'`, so the default path keeps today's JSX unchanged:

  | Card | Where `FxText` goes | `start` |
  |---|---|---|
  | KineticText | each line's text inside its existing spring div | `i * stagger` (the spring still runs) |
  | LowerThird | the `title` text | 0.15 s, after the slide |
  | PriceTag | the `price` text | 0.2 s |
  | DateBadge | the `date` text | 0.25 s |
  | Checklist | each item's text | that item's spring start, `0.05 + i * interval` |

  For example, in PriceTag:
  `{fx === 'none' ? price : <FxText text={price} fx={fx} start={0.2} />}`.
- [ ] **Step 4: Run the test and see it pass.** Then `cd studio && npx tsc --noEmit`.
- [ ] **Step 5: Regression.** Render all 5 baseline frames (45, 255, 345, 555, 660) to `.superpowers/check/` and diff
  each against `.superpowers/baseline/` with the PIL one-liner from Task 2 Step 11. Every result must be `None`.
- [ ] **Step 6: Visual check of the new paths.** Make `.superpowers/check/props-task6.json` with a Text layer
  (`reveal: "scramble"`) and a PriceTag layer (`fx: "pop"`). Render one still each, mid-effect, and look at them.
- [ ] **Step 7: Commit.**
  `git add studio/src/motion/Text.tsx studio/src/motion/KineticText.tsx studio/src/motion/LowerThird.tsx studio/src/motion/PriceTag.tsx studio/src/motion/DateBadge.tsx studio/src/motion/Checklist.tsx app/src/screens/Editor/motionSchema.test.ts && git commit -m "Text effects on existing motion cards (default unchanged)"`

**Report back:** test output, the five `getbbox` results, still paths.

---

### Task 7: Sound defaults, ownsExit parity test, docs and agent guidance

**Agent:** `worker-sonnet`. Config, one small test, and docs.

**Files:**
- Modify: `config.json` (`sfx.motion`)
- Modify: `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` (sfx example around line 165, "Remotion
  `studio/`" around lines 209–210, "Storyboard format")
- Modify: `.claude/skills/make-reel/SKILL.md`
- Test: `app/src/screens/Editor/motionSchema.test.ts`

**Interfaces:** consumes the registry entries from Tasks 3–5 and `OWNS_EXIT` from Task 2.

- [ ] **Step 1: Write the failing tests** in `motionSchema.test.ts`:

```ts
import {readFileSync} from 'node:fs';
import {MOTION} from '@studio/motion/registry';
// ...
  it('registers the new cards and keeps props.py OWNS_EXIT in sync with ownsExit', () => {
    expect(motionNames()).toEqual(expect.arrayContaining(['Ribbon', 'TwoTier', 'Callout', 'PinLabel', 'GlossyPill', 'GiantText']));
    const py = readFileSync(new URL('../../../../tools/reel/props.py', import.meta.url), 'utf8');
    const set = /OWNS_EXIT = \{([^}]*)\}/.exec(py)![1].match(/"(\w+)"/g)!.map((s) => s.slice(1, -1)).sort();
    expect(set).toEqual(Object.entries(MOTION).filter(([, d]) => d.ownsExit).map(([n]) => n).sort());
  });
```

  Run `cd app && npx vitest run src/screens/Editor/motionSchema.test.ts`. If Tasks 3–5 are in, it should pass straight
  away: it guards future drift. If the path to `props.py` is wrong, fix the path, not the assertion.
- [ ] **Step 2: Sound defaults.** In `config.json` `sfx.motion`, add
  `"Ribbon": "whoosh", "TwoTier": "whoosh", "Callout": "click", "PinLabel": "pop", "GlossyPill": "ting", "GiantText": "whoosh"`.
  Mirror this in the spec's sfx example.
- [ ] **Step 3: Update the pipeline spec.** In "Remotion `studio/`", line 210, "Built in":
  - add the six cards, each with one short clause;
  - add the shared fields `fx` (7 effects), `pace` and `decor`/`emoji`;
  - document `ownsExit`: the default exit is `none`, mirrored in `props.py` `OWNS_EXIT` and guarded by a test;
  - document the brand colors `accent2` and `surface`, with their defaults;
  - document that `Text.reveal` now takes all 7 effects;
  - link to `docs/superpowers/specs/2026-11-19-text-fx-and-cards-design.md`.
- [ ] **Step 4: Update the `make-reel` skill.** Add a "Thẻ và hiệu ứng chữ" section (in English, matching the
  skill's language) that says:
  - which card to use when:
    - `Ribbon`: a key benefit line;
    - `TwoTier`: who it is for (audience plus field);
    - `Callout`: pointing at a person or a screen; set `targetX`/`targetY` on the subject, verified on a still;
    - `PinLabel`: a place;
    - `GlossyPill`: an offer or gift;
    - `GiantText`: at most one big statement per video;
  - vary `fx` between consecutive cards, and never use one effect for the whole video;
  - brand colors are a starting point: per-layer `colors` (now including `accent2`/`surface`) and new components
    stay allowed;
  - choreographed cards need a layer of at least about 2.5 s at `pace: normal`, or they exit before they finish;
    use `pace: fast` for short layers.
- [ ] **Step 5: Commit.**
  `git add config.json docs/superpowers/specs/2026-11-18-reel-pipeline-design.md .claude/skills/make-reel/SKILL.md app/src/screens/Editor/motionSchema.test.ts && git commit -m "Sound defaults, ownsExit parity test and docs for new motion cards"`

---

## Execution order

| Wave | Tasks | Notes |
|---|---|---|
| 1 | 1 and 2 | in parallel; their files don't overlap |
| 2 | 3, 4, 5 and 6 | in parallel, after Task 2; Tasks 3–5 share `registry.ts` (re-read before editing) |
| 3 | 7 | after Tasks 3–6 |
| Final | review | by the main session: the full branch diff, the full suite, all baseline diffs, and one still per card |
