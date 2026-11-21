# Max kit in the shared studio library: design

## Goal
The user's reels look templated. The free-style "max" reel from the Remotion vs HyperFrames pilot
(`/home/giabao/dev/create-video-hf`, branch `hyperframes-pilot`, `compare-r2/raw/p1-r-1*`) did not, and the user loved
it.

The difference is the pipeline, not the engine:
- the storyboard only has `cut`, `fade` and `slide` transitions;
- there are no light leaks, no film look beyond grain and scan lines, and no 3D CTA;
- the cards are few;
- make-reel rotates the same pieces.

The goal is to bring the max kit into the shared library, so any storyboard can use it, and to add a `max` template that
turns it all on. The user picked this over copying the pilot's standalone template (2026-11-21).

## Decisions
- **Built on `ReelFrame`.** The pilot's `Max.tsx` re-implements the reel skeleton with `TransitionSeries`. Under it the
  following silently do nothing:
  - per-scene `transition`, `overlay` and collage `layout`;
  - `look`, `SfxTrack` and `CtaCard`.

  It also breaks past 6 scenes. The kit is therefore rebuilt as pieces of the shared skeleton, not ported as is.
- **Old videos render the same.** `cut`, `fade` and `slide` keep their current enter-only behaviour, and every new field
  is optional.
- **No `BehindText`.** It needs a per-video alpha cutout webm, which is not in git.
- **No hard-coded brand.** The pilot's navy `#0B1530` and yellow `#FFD400` become brand colors. Use `accent` where the
  pilot used yellow, and `background` or `primary` where it used navy.
- **No invented facts.** The demo reuses an existing storyboard's text (CLAUDE.md rule 1).
- **Packages.** These are added to `studio/package.json` at exact versions, with the lockfile updated:
  - `@remotion/transitions`, `@remotion/light-leaks`, `@remotion/motion-blur`, `@remotion/noise`,
    `@remotion/shapes` and `@remotion/three`, all at `4.0.544` like the other `@remotion/*` packages;
  - `three` `0.187.0` and `@react-three/fiber` `9.8.2`, the peer of `@remotion/three`;
  - `@types/three` `0.187.0` as a dev dependency.

## Pieces

### 1. Transitions
- **New names:** `push`, `cube`, `wipe`, `flip` and `clockWipe`.
  - They are allowed for scene `transition`, but not for `mediaTransition`, which stays `cut | fade | slide`.
  - They map to `@remotion/transitions` presentations, with the pilot's settings:
    - `push` is `pushCut({flashColor: brand accent, flashOpacity: 0.7})`;
    - `cube` is `cube({direction: 'from-right'})`;
    - `wipe` is `wipe({direction: 'from-bottom-left'})`;
    - `flip` is `flip({direction: 'from-right'})`;
    - `clockWipe` is `clockWipe({width, height})`.
- **`mix`.** This scene transition value is resolved by `tools/reel/props.py` to
  `["push", "cube", "wipe", "flip", "clockWipe"][(i - 1) % 5]` for scene index `i ≥ 1`. It is the `max` template's
  default. A scene's own `transition` always wins.
- **Both sides animate.** For a new-name transition between scene A and scene B:
  - `ReelFrame` wraps B's first `tf` frames in the presentation's `entering` direction;
  - it wraps A's tail, the `tf` frames A already runs under B, in the `exiting` direction;
  - both use `presentationProgress = linear frame / tf`, clamped to 0..1;
  - `cut`, `fade` and `slide` keep today's enter-only `SceneTransition` code path untouched.
- **SFX.** A non-cut transition already adds the template's `sfx.cut` sound (`props.py`), and the new names count as
  non-cut.
- **Where the names live.** The name list is kept in sync in four places:
  - `studio/src/types.ts` (`Transition`);
  - `app/shared/types.ts` (`TransitionName`);
  - `tools/reel/validate.py` (`TRANSITIONS`, plus `mix` for the scene transition only);
  - the reel pipeline spec's "Storyboard format" section.

### 2. Light leak
- A scene may set `leak: true`. A `@remotion/light-leaks` `<LightLeak>` then plays over the whole frame for 34 frames
  from that scene's start, screen-blended above the scenes and under the captions' layer order as `ReelFrame` stacks it.
  - `seed` is the scene index, and `hueShift` is 0.
- `validate.py` checks that `leak` is a bool, and `props.py` passes it through as `scene.leak`.

### 3. Look
`look` gains three optional knobs. The template defaults come from `config.json` `templates.<t>.look`.
- `vignette` (0..1) is a radial edge darkening. At 1 it matches the pilot's vignette.
- `grade` (bool) applies the pilot's footage grade, `contrast(1.07) saturate(1.15) brightness(1.02)`. It is applied to
  footage only (`MediaShot` video/image), not to text or cards.
- `progress` (bool) draws a 10 px bar in the brand accent across the top. It fills over the scenes and is hidden during
  the CTA.

`components/Look.tsx` draws `vignette` and `progress`. Grain and scan lines are unchanged.

### 4. Motion cards
The pilot's cards are ported to `studio/src/motion/`, registered with `defineMotion` and `ownsExit: true`, and added to
`OWNS_EXIT` in `props.py`. Their titles and descriptions are in Vietnamese and say how each differs from the older card
it resembles:

| Component | Title | Differs from |
|---|---|---|
| `MaxKinetic` | "Chữ đập mạnh" | `KineticText`: words slam in with motion blur. `variant` `slam` or `tag`. |
| `MaxOffer` | "Ưu đãi nổi bật" | `OfferCard`: big number/card, star burst, sparks. |
| `MaxPhone` | "Số điện thoại lớn" | Phone digits in groups, popping in. |
| `MaxSteps` | "Các bước" | `Checklist`: numbered steps entering one by one. It must also fade out at the end, fixing a known pilot bug. |

All text, numbers and phone groups are props. Colors come from `brand`.

### 5. Pop captions
`components/PopCaptions.tsx` is ported from the pilot's `MaxCaptions`. Captions are TikTok-style, and the word being
spoken gets an accent-colored block with a spring pop. It uses the existing caption chunks and `highlight`.

When real word timings exist (`align`), they drive the active word, as other caption styles do. Otherwise timing is
spread by letter count, as in the pilot.

### 6. 3D CTA
`components/CtaCard3D.tsx` is ported from the pilot's `MaxCta`:
- the brand logo on an extruded rounded plate (`@remotion/three`), slowly turning;
- noise-driven bokeh, a rotating star, the CTA button and the phone and fanpage lines.

Two fixes over the pilot:
- The logo aspect comes from the loaded texture, not the hard-coded 685/338.
- Without `brand.logo` it falls back to the normal `CtaCard`.

`ReelFrame` gets an optional `renderCta` prop. The default is today's `CtaCard`, so other templates don't change.

### 7. `max` template
`studio/src/templates/max/Max.tsx` is built on `ReelFrame`:
- `PopCaptions` for captions;
- `CtaCard3D` for the CTA;
- the logo shown;
- `<Look/>` with the template's look as children;
- a `LightLeak` at the CTA start.

It is registered in `templates/index.ts`. The `config.json` `templates.max` defaults are:
- `transition` `{scene: "mix", media: "cut", duration: 0.5}`;
- `look` `{grain: 0.5, scanlines: 0, logo: true, vignette: 1, grade: true, progress: true}`;
- `sfx` as the story template has it.

### 8. make-reel
- **`.claude/skills/make-reel/SKILL.md`:**
  - Every video gets one signature moment, for example a `MaxKinetic` slam on the key promise, the 3D CTA, or a
    `leak` on the turning-point scene.
  - Vary scene transitions instead of one kind throughout.
  - Prefer cards that have never been used.
  - The `max` template is the default for promo reels that should not look templated. The user decides per video, or
    in `config.json` per rule 2.
- **`tools/usage.py --motion`** also lists registry components with zero uses and the transition counts across
  projects, least used first, so new cards and transitions get picked.

## Testing
- **Python** (`uv run --with pytest python -m pytest tools/tests -q`):
  - validate accepts the new names, `mix` (scene only) and `leak`, and rejects a bad name;
  - the current test that uses `wipe` as its invalid example changes to another invalid name;
  - `props.py` resolves `mix` by index, passes `leak`, and does not fade the new cards' exit;
  - `usage.py` lists unused components and transition counts.
- **Studio:** `cd studio && npx tsc --noEmit`.
- **App:** `cd app && npm test && npx tsc --noEmit`. The registry builds the Editor schemas, so the new card schemas
  must be valid.
- **Stills** (CLAUDE.md rule 7, looked at by the main session):
  - one still per new card;
  - mid-transition stills for each new transition;
  - a still of the 3D CTA and of the `max` look.
- **Demo.** A `max` version of an existing project's storyboard, with the same text, rendered to a new `reel-v<N>`
  (never overwriting), then checked with `check.py` and `look.py` (rule 7). The user watches it.

## Out of scope
- `BehindText` and cutout generation.
- `@remotion/effects`, Lottie and the pilot's showcase clips.
- Editor UI for these fields: the user edits only through the agent.
- Changing the default template for every video. That is the user's call.
