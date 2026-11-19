# Text effects and new cards (motion upgrade A + B)

Date: 2026-11-19. Status: approved design.

## Goal

Make the motion graphics look finished and "wow", like the reference reel the user supplied (a 40 s Facebook reel for
an AI Marketing course). We analyzed it frame by frame. What it does that we don't do yet:

1. Text is never shown all at once. It types in, pops letter by letter, scrambles in, or waves.
2. Cards have real shapes: a ribbon with a folded tail, a two-tier label, a callout with a line pointing at a person,
   a location pin, and a glossy pill with a sticker.
3. Cards assemble in order: the shape comes first, then the main text, then the sub line, then the decoration. The exit
   is choreographed too: the text is erased from the left, or the shape retracts.
4. Decorations go with the cards: sparkle bursts, a blinking dot, emoji stickers.

This spec covers sub-projects **A (text effects)** and **B (new cards)**. Out of scope, and planned as later
sub-projects in this order:
- C: scene transitions (light flash, glitch, ink wipe, iris, stripes, zoom/whip), plus the fix for the muddy crossfade
  frames seen in `reel-v3`.
- D: kinetic captions.
- E: full-screen motion pages and the animated CTA end card.
- F: particles.

The user approved the look in a browser mockup: `docs/superpowers/mockups/text-fx-cards/preview.html`.
- Its JS holds the timings and choreography to reproduce.
- It loads its fonts and backgrounds from the brainstorm server's `/files/` path. Opened standalone, it renders with
  the system font and no background. Its timings still apply.

## Decisions

- **Brand colors:** brands get two optional colors, `accent2` ("Nhấn 2", default `#E11D2E`) and `surface`
  ("Nền sáng", default `#FFFFFF`). Cards alternate navy, yellow, red and white, as in the reference.
  - Brand colors are only the default. Per-layer `colors` overrides still cover every key, and Claude/Codex may still
    write new components (CLAUDE.md rule 6). The `/make-reel` skill must say this explicitly.
- **Old cards** get the new text effects. Their default stays `none`, so existing storyboards render the same, pixel
  for pixel. The one exception is `Text` with `reveal` typewriter/words; see "Old cards". Their look is unchanged; the
  new looks come from the new cards.
- **Choreography is automatic.** A card exposes only "Hiệu ứng chữ" and "Nhịp" (fast / normal / slow); no per-part
  timing fields.
  - The card's start/end is still anchored to the voice with the layer's existing `at` / `until`.
  - Per-word karaoke sync belongs to sub-project D.
- **All 7 text effects and all 7 card/decoration demos in the mockup are in scope.**

## Brand colors (`accent2`, `surface`)

Optional keys. Studio fills the defaults when a brand file lacks them, so old brand files keep working. The key list
is hard-coded in six places, and all of them change:

- `studio/src/types.ts`: the `Brand['colors']` type. Add a `resolveColors` (or similar) default fill where the brand
  enters the composition.
- `app/shared/types.ts`: `BrandFile.colors` and `MotionSpec.colors`.
- `app/server/routes/settings.ts`: `COLORS` and the fallback defaults.
- `app/src/screens/Settings/BrandSection.tsx`: `COLORS`. Labels: "Nhấn 2 (băng đỏ, ruy băng)", "Nền sáng (ô trắng)".
- `app/src/screens/Editor/MotionLayerEditor.tsx`: `COLOR_KEYS`. Labels: "Nhấn 2", "Nền sáng".
- `tools/reel/validate.py`: `COLOR_KEYS`.

Existing tests that pin the key list must be updated, not deleted.

## Text effect engine

Location: `studio/src/motion/fx/`. Files:

**`textFx.ts`**: pure functions, no React.
- `TEXT_FX = ['none','typewriter','words','pop','scramble','mask','wave']`. The ids `typewriter` and `words` keep the
  names `Text.reveal` already uses.
- `PACE = {fast: 0.7, normal: 1, slow: 1.4}`: a multiplier on every duration and delay.
- `splitUnits(text)` splits text into words, and words into graphemes (`Intl.Segmenter`, so Vietnamese diacritics stay
  on their letter).
- `fxDuration(fx, text, pace)` returns the seconds until the text is fully shown, so a card can chain its next part.
- `unitStyle(fx, unitIndex, unitCount, tSec, pace, seed)` returns the `{opacity, transform, filter}` of one unit at
  time `t` after the effect starts.
  - It must reach the fully shown state at `t >= fxDuration`.
  - `wave` keeps bobbing after that.
  - `scramble` takes its order from Remotion `random(seed + i)`. No `Math.random`: a render must be repeatable.

**`FxText.tsx`**: `<FxText text fx start pace seed style />`.
- Renders each word as a `nowrap` inline-block, so lines break only between words (the mockup showed a mid-word break
  until this was fixed).
- Units are `inline-block` spans styled by `unitStyle`, driven by `useCurrentFrame`.
- `typewriter` adds a blinking caret that disappears 0.7 s after the text completes.

**`choreo.ts`**:
- `useChoreo(layerSeconds, pace)` returns
  - `t`: seconds since the layer start;
  - `step(at, dur, easing?)`: 0..1 progress of one part;
  - `outP`: 0..1 progress of the exit, over the last `0.4 × pace` s of the layer.
- `eraseOut(p)` returns a `clipPath` that erases the content left to right.

**Timings at pace 1** (taken from the mockup; per unit, unless stated otherwise):

| fx | delay between units | unit duration | motion |
|---|---|---|---|
| none | – | 0.12 s | fade |
| typewriter | 0.055 s per grapheme | instant | caret blinks with a 0.5 s period |
| words | 0.09 s per word | 0.42 s | up 80% plus fade, ease-out |
| pop | 0.032 s per grapheme | 0.42 s | scale 0→1, back easing (overshoot) |
| scramble | 0.04 s per random slot | 0.30 s | from 40% higher, scale 1.4, blur 4px |
| mask | 0.08 s per word | 0.52 s | up from 110% inside a word-sized `overflow:hidden` wrapper |
| wave | 0.028 s per grapheme | 0.38 s | pop-in, then a continuous bob: 14% amplitude, 1.1 s period, phase 0.055 s per grapheme. The block is italic, rotated −5°, skewed −6°, with a primary-color stroke |

**Schema helpers** (added to `motion/schema.ts`):
- `textFx(title, value)`: `choice` over `TEXT_FX`. Vietnamese labels: "Hiện ngay", "Gõ phím", "Từng từ trượt lên",
  "Bật từng chữ cái", "Xáo chữ", "Trồi lên từ vạch che", "Sóng nghiêng".
- `pace()`: `choice` with the labels Nhanh / Vừa / Chậm, default `normal`.
- `decor()`: `choice` with the values none / sparkle / dot / emoji, plus `emoji: optText('Emoji')`.

Font fitting keeps working through the existing `fitFontSize` on the full text. Effects never change the layout size.

## Cards that own their exit

`defineMotion` takes an optional `ownsExit: true`. In `MotionLayer.withDefaults`, the default exit for such a component
is `none` instead of the 0.25 s fade, so the card's built-in exit is not muddied. An exit the user sets explicitly is
still applied.

## New cards

Each card is one file `studio/src/motion/<Name>.tsx`, registered in `registry.ts` with a Vietnamese title and
description.

Every new card:
- has `textFx` (default as below), `pace`, and `decor`;
- has `ownsExit: true`;
- draws inside `area` and shrinks its fonts to fit;
- takes its colors from `brand.colors` (primary, accent, accent2, surface, text).

The choreography follows the mockup.

| Name | Title | Props | Default fx | Choreography |
|---|---|---|---|---|
| `Ribbon` | Ruy băng | `title`, `sub?` | typewriter | accent2 bar scales in from the left (0.32 s); the white fold triangle drops (back easing); title types; accent dot pops and blinks; sub enters by words. Exit: sub fades down, then the bar retracts. |
| `TwoTier` | Thẻ hai tầng | `top`, `bottom` | pop | Two white rules draw from the center; the surface box opens vertically (back easing); top text in surface-contrast color; the accent2 skewed (−14°) banner slides in from the left with the bottom text by words. Exit: scale 0.85 plus fade. |
| `Callout` | Nhãn chỉ điểm | `title`, `sub1?`, `sub2?`, `targetX`, `targetY`, `labelX`, `labelY` (% of the area) | typewriter | A ring with a dot pops on the target and pulses; the elbow line draws toward the label; the accent2 box opens from the line side; title types; sub1 (accent2) wipes in from the left; sub2 (surface box, primary text) wipes in from the right with pop. Exit: the boxes erase, then the ring and line fade. Meant for `position: full`. |
| `PinLabel` | Ghim vị trí | `text` | pop | An accent2 pin with a white stroke drops in and bounces; the text is accent-colored with a primary stroke, rotated −7°. Exit: rises and fades. |
| `GlossyPill` | Nhãn bóng | `title`, `sub?`, `sticker?` (emoji) | words | Gradient pill with a white border and glow pops in (back easing); title by words; a shine sweeps across; the surface sub pill unfolds with mask text; the sticker pops and wiggles. Exit: scale 1.3 plus fade. |
| `GiantText` | Chữ khổng lồ | `giant`, `caption?` | none (for the caption) | Giant uppercase text (accent fill, primary stroke) sweeps right→left across the frame in 1.3 s; a light streak flies ahead; the caption lands from scale 2.4 with blur. Exit: the caption erases. Meant for `position: full`. |

**Decor** (`fx/Decor.tsx`), used by all new cards:
- `sparkle`: two 3-stroke bursts at opposite corners that pop in and then pulse.
- `dot`: a blinking accent dot.
- `emoji`: the `emoji` prop as a sticker that pops in and wiggles.

The decoration enters after the main text.

## Old cards

| Card | Change |
|---|---|
| Text | `reveal` choices extend to all 7 ids (default `none`). Rendering goes through `FxText`. `revealSeconds` stays: for Text, every timing is stretched so that `fxDuration == revealSeconds`. The existing `typewriter` and `words` get the new, approved look (a caret, words rising), so they are the one intended visual change to old storyboards. |
| KineticText, LowerThird, PriceTag, DateBadge, Checklist | Gain `textFx` with default `none`, applied to their main text. Nothing else changes. |
| CountUp, Annotate, Picture, ProgressBar | Unchanged. |

**Regression bar:** a still of `projects/khoa-hoc-quang-cao-facebook` at frames that show Text, PriceTag and
KineticText must be pixel-identical before and after the change, for every layer whose effect is the default.

## Sound

Add defaults to `config.json` `sfx.motion`:

| Card | Sound |
|---|---|
| Ribbon | whoosh |
| TwoTier | whoosh |
| Callout | click |
| PinLabel | pop |
| GlossyPill | ting |
| GiantText | whoosh |

Do the same in the pipeline spec's example.

## Docs and agent guidance

**`docs/superpowers/specs/2026-11-18-reel-pipeline-design.md`** ("Storyboard format" and "Remotion studio"):
- list the new cards, `textFx` / `pace` / `decor`, `ownsExit`, and the two brand colors.

**`.claude/skills/make-reel/SKILL.md`:**
- when to use each card;
- vary the text effect from card to card (never one effect for the whole video);
- brand colors are a starting point (per-layer `colors` and new components remain allowed);
- use `Callout` with the target on a person;
- use `GiantText` for one big statement per video, not more.

**CLAUDE.md rule 6:** no change needed. It already points at `motion/*` and the registry.

## Testing

**Vitest** (app, which already imports studio code), new `app/src/screens/Editor/textFx.test.ts` or similar:
- for every fx, `unitStyle` at `t = fxDuration` gives opacity 1 and the identity transform (except the wave bob);
- `scramble` order is identical across two calls with the same seed;
- `pace` scales `fxDuration` linearly;
- `splitUnits` keeps Vietnamese graphemes whole and never splits a word.

Existing tests that list color keys (`settings.test.ts`, `tools/tests`) are updated for the two new keys.

**Type checks:** `cd studio && npx tsc --noEmit`, and `cd app && npx tsc --noEmit`.

**Visual:** one still per new card at mid-hold, over real footage, checked by eye against the mockup: overflow,
contrast, nothing covering faces.

**Regression:** the pixel-identical stills described under "Old cards".

**App:** the generated forms of the new cards show the Vietnamese labels (the existing `motionSchema.test.ts` pattern).

## Error handling

- Invalid card props fail through `parseMotionProps`, as for every component today, listing every problem.
- An unknown `textFx` id is a schema error, never a silent fallback.
- Fonts not yet loaded: `useFontsLoaded` already holds the frame. `FxText` does not measure anything itself.
