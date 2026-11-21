# Story template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 3 of `docs/superpowers/specs/2026-11-21-story-videos-design.md`: a second Remotion template `story`
(text-card captions revealed word by word, flat light/dark text-card scenes, grain + scan-line look), new text effects
`blur-in` / `glitch`, a `glitch` media effect, and `BarChart` / `LineChart` motion components with a required source.

**Architecture:** Python `tools/reel` resolves the storyboard into `render-props.json`; Remotion `studio/` draws it;
the Editor in `app/` reads the same types and the motion registry. The scene/media/motion/SFX/music skeleton in
`FastCut.tsx` moves to a shared component so both templates share it; templates only pass style.

**Tech Stack:** Python 3 + pytest, TypeScript + Remotion 4 + zod (`studio/`), vitest (`app/`).

## Global Constraints

- Work only in the worktree `/home/giabao/dev/create-video/.claude/worktrees/story-template` (branch `story-template`).
  `node_modules`, `library`, `music`, `sfx`, `.whisper` there are symlinks to the main checkout: never delete them,
  never stage them.
- Course-promo reels (`fast-cut`) must look and sound exactly as before.
- Motion components: export `<Name>` and `<Name>Schema` (zod via helpers in `studio/src/motion/schema.ts`, Vietnamese
  `title`s), register in `studio/src/motion/registry.ts` with `defineMotion`; draw content only, colours from `brand`.
- `VieNeu-TTS/` is upstream: never edit.
- Stage only your own files by explicit path. Commit messages: one line, no body, no Co-Authored-By.
- Per task run only the tests for touched modules: Python `uv run --with pytest python -m pytest tools/tests/<file> -q`;
  studio `cd studio && npx tsc --noEmit`; app `cd app && npx vitest run <files> && npx tsc --noEmit`.
- Stills: `cd studio && npx remotion still Reel <out.png> --frame=<n> --props=<render-props.json>`; write stills under
  `/tmp/claude-1000/-home-giabao-dev-create-video/3bc4d84d-adeb-4875-ae20-eae1ac332188/scratchpad/stills/`.

## Waves

- Wave 1 (parallel, disjoint files): Task 1, Task 2, Task 3.
- Wave 2: Task 4 (`studio/src/types.ts`, `validate.py` shared with Tasks 1 and 3).
- Wave 3: Task 5 (skeleton refactor), then Task 6 (story template).
- Task 7 (story defaults, demo video) is done by the main session.

---

### Task 1: Per-word times in caption chunks

**Files:** Modify `tools/reel/captions.py` (`chunk_caption`), `studio/src/types.ts:4` (`CaptionChunk`).
Test: `tools/tests/test_captions.py`.

**Interfaces:** Produces chunk field `times: list[float]`: absolute-in-scene start second of each space-separated
token of `text`, same length as `text.split()`, non-decreasing, each within `[start, end)`.
`CaptionChunk = {text: string; start: number; end: number; times?: number[]}`.

- [ ] Step 1: failing tests: (a) with `words` given (use the existing word fixtures in `test_captions.py`), every chunk
  has `len(times) == len(text.split())`, `times[0] == start`, times non-decreasing and `< end`; a token that matches a
  spoken word gets that word's start (use `align.caption_token_times`, already in `tools/reel/align.py:124`);
  (b) without `words`, times are spread evenly: `start + i * (end - start) / n`.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement: in each return path of `chunk_caption` add `"times"`. With words: compute
  `caption_token_times(text, words)` once for the whole caption, slice per chunk by token count, clamp into
  `[start, end)` and make non-decreasing; without words: even spread. Round to 3 decimals. Update `CaptionChunk`.
- [ ] Step 4: run `test_captions.py test_props.py` (props tests may compare whole chunk dicts; update expected dicts
  to include `times`, nothing else) + studio tsc → PASS.
- [ ] Step 5: commit `Add per-word times to caption chunks`.

---

### Task 2: Text effects `blur-in` and `glitch`

**Files:** Modify `studio/src/motion/fx/textFx.ts` (`TEXT_FX`, `TEXT_FX_LABELS`, `SPEC`, `UnitStyle`, `unitStyle`),
`studio/src/motion/fx/FxText.tsx` only if it drops style keys. Test: `app/src/screens/Editor/textFx.test.ts`.

**Interfaces:** `TEXT_FX` gains `'blur-in'` (label `Mờ → rõ`) and `'glitch'` (label `Nhiễu màu`).
`UnitStyle` may carry `filter?: string` and `textShadow?: string` (FxText must spread them onto the unit span).

- [ ] Step 1: failing tests in `textFx.test.ts`:
  - `blur-in` (unit `word`, gap 0.06, dur 0.5): at `t = 0` unit 0 has `opacity` 0 and `filter` containing `blur(`
    with a value ≥ 12px; at `t = 2` every unit has opacity 1 and `filter` `none` (or undefined) and transform `none`.
  - `glitch` (unit `char`, gap 0.02, dur 0.3): during the reveal `textShadow` contains two colour offsets
    (e.g. `#ff2a6d` and `#05d9e8`); at `t = 2` style is settled (opacity 1, no textShadow, transform `none`).
  - Both are deterministic: same args → same style.
- [ ] Step 2: run `cd app && npx vitest run src/screens/Editor/textFx.test.ts` → FAIL.
- [ ] Step 3: implement:
  - `blur-in`: `opacity: p`, `filter: done ? 'none' : \`blur(${(1 - ease(p)) * 16}px)\``, `transform: done ? 'none' : \`scale(${1.15 - 0.15 * ease(p)})\``.
  - `glitch`: opacity `p > 0 ? 1 : 0`; while `p < 1`: `transform: translateX(${jitter}px)` with jitter from a
    deterministic hash of `(i, Math.floor(t * 30), seed)` in ±6px, `textShadow: \`${dx}px 0 #ff2a6d, ${-dx}px 0 #05d9e8\``
    with `dx = 4 * (1 - p)`; settled when done.
  - Make FxText pass `filter` / `textShadow` through.
- [ ] Step 4: run `textFx.test.ts choreo.test.ts` + app tsc + studio tsc → PASS.
- [ ] Step 5: commit `Add blur-in and glitch text effects`.

---

### Task 3: `BarChart` and `LineChart` components

**Files:** Create `studio/src/motion/BarChart.tsx`, `studio/src/motion/LineChart.tsx`; modify
`studio/src/motion/registry.ts`, `tools/reel/validate.py` (source check). Tests: `app/src/screens/Editor/motionSchema.test.ts`
(add cases), `tools/tests/test_validate.py`.

**Interfaces:**
- The Editor builds its form from these schemas and only supports flat fields and string arrays (`lines`); nested
  `z.array(z.object(...))` is NOT supported (`app/src/screens/Editor/motionSchema.ts:25-32`). So rows are text lines
  parsed in the component; a malformed line is skipped (never crash the render).
- `BarChartSchema`: `title: optText('Tiêu đề')`, `bars: lines('Cột (mỗi dòng: Nhãn | Giá trị | ảnh tuỳ chọn)')`
  (1–6 rows; value parsed with `,` or `.` decimals), `unit: optText('Đơn vị')` (shown after values),
  `rankSwap: bool('Đổi hạng khi chạy', false)`, `seconds: numDefault('Chạy trong (giây)', 1.2, {min: 0.2, max: 6, step: 0.1})`,
  `source: text('Nguồn')`.
  Draw: horizontal bars, label left, value at bar end counting up with the bar, bars grow over `seconds`.
  Rows are shown largest on top; with `rankSwap`, rows start in the listed order and slide to value order during the
  last 40% of `seconds` (the reference video's "2 overtakes 1"). Colours: bars `brand.colors.primary`, the largest
  bar `brand.colors.accent`; source line small at the bottom: `Nguồn: <source>`.
- `LineChartSchema`: `title: optText('Tiêu đề')`, `labels: lines('Nhãn trục X (mỗi dòng một nhãn)')`,
  `series: lines('Đường (mỗi dòng: Tên | v1, v2, v3… | ảnh tuỳ chọn)')` (1–3 rows; values separated by `,` or spaces),
  `unit: optText('Đơn vị')`, `seconds: numDefault('Vẽ trong (giây)', 1.5, {min: 0.2, max: 6, step: 0.1})`, `source: text('Nguồn')`.
  Draw: SVG lines drawn in left→right over `seconds` (stroke-dashoffset), x labels under the axis, the series name (and
  image if any) at each line end; series colours `primary`, `accent`, `accent2`; same source line.
  (Use `lines` exactly as defined in `schema.ts`; image paths are library-relative like other components' media.)
  Test cases must also cover the row parser (pure function exported from each file, e.g. `parseBars(lines)`), incl.
  malformed rows skipped.
- Registry titles: `BarChart` → `Biểu đồ cột`, description `Cột ngang có nhãn, số chạy lên, ghi nguồn`;
  `LineChart` → `Biểu đồ đường`, description `Đường vẽ dần theo thời gian, ghi nguồn`.
- `validate.py`: for a motion layer whose component is `BarChart` or `LineChart`, error
  `"<sid>: motion[<i>] <Component>: props.source is required (Nguồn số liệu)"` when `props.source` is missing or blank.
  Applies to scene layers and the video-wide track. (shortcut comment: per-component check, upgrade to schema-driven
  validation if more components need required props.)

- [ ] Step 1: failing tests: `motionSchema.test.ts` — both names in `MOTION`, schemas parse a minimal valid props
  object and reject one without `source`; `test_validate.py` — missing/blank `source` reports the error, present passes.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement components (≤ 120 lines each), registry entries, validate check.
- [ ] Step 4: tests + studio/app tsc → PASS. Render a still of each component: copy
  `projects/test/render-props.json` to the scratchpad, append one motion layer per component to the first scene
  (`position: "center"`, `start: 0`, `duration: 3`, plus the fields every `MotionItem` needs — copy them from an
  existing motion item in that file), render frame 60; view both PNGs (no overflow, values legible).
- [ ] Step 5: commit `Add BarChart and LineChart motion components with required source`.

---

### Task 4: Media effect `glitch`

**Files:** Modify `studio/src/types.ts:2` (`Effect`), `studio/src/effects.ts`, `studio/src/components/MediaShot.tsx`,
`app/shared/types.ts:5`, `app/src/screens/Editor/InspectorScene.tsx:17` (label `Nhiễu màu (glitch)`),
`tools/reel/validate.py:6` (`EFFECTS`). Test: new `app/src/screens/Editor/glitch.test.ts` (imports studio's pure
function like `musicDuck.test.ts` does), `tools/tests/test_validate.py`.

**Interfaces:** `export const glitchAt = (frame: number, fps: number, seed = 0): {dx: number; dy: number; split: number}`
in `studio/src/effects.ts` (pure). Bursts: active 3 frames out of every `round(fps * 0.9)` (offset by seed), plus the
first 4 frames of the shot; when active `split` in 6..14 px and `dx`,`dy` in ±10 / ±3 px; otherwise
`split = dx = dy = 0` (a quiet frame is identical to the un-glitched shot). Deterministic (hash, no Math.random).

- [ ] Step 1: failing tests: `glitchAt` deterministic, burst frames have `split ≥ 6`, quiet frames all zero, roughly 3 burst frames per 27 at 30 fps; `validate` accepts `effect: "glitch"`.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement. MediaShot decodes each clip once and paints the blurred cover layer from it
  (`MediaShot.tsx:19-39`): do NOT add extra `<Video>` copies. Apply the split only to the contain (foreground) layer,
  with one inline SVG filter per shot (unique id): `feColorMatrix` keeps R only → `feOffset dx=+split`; another
  `feColorMatrix` keeps G+B only → `feOffset dx=-split`; combine with `feComposite operator="arithmetic" k2=1 k3=1`
  (sum, so with split 0 the picture is unchanged, no over-exposure). Translate the foreground by `dx, dy` on burst
  frames. Set the filter only when `split > 0`. `effectTransform('glitch', p)` returns `'none'`.
- [ ] Step 4: tests + both tsc → PASS; render stills of a photo scene and a video scene with `glitch`, one burst frame
  and one quiet frame each; view them; the quiet frame must match the same scene rendered with `effect: "none"`.
- [ ] Step 5: commit `Add glitch media effect`.

---

### Task 5: Shared template skeleton (refactor, no visual change)

**Files:** Create `studio/src/components/ReelFrame.tsx`; modify `studio/src/templates/fast-cut/FastCut.tsx`.

**Interfaces:** `ReelFrame: React.FC<{p: RenderProps; captions: (sc: Scene) => React.ReactNode; empty: (sc: Scene) => React.ReactNode; logo: boolean; children?: React.ReactNode}>`
draws everything `FastCut` draws today (scenes with transitions, media, motion, overlay, voice, CTA, video-wide track,
`SfxTrack`, `MusicTrack`), calling `captions(sc)` where `<Captions …>` is now and `empty(sc)` where the media-less
gradient is now; `children` render on top of everything (used later for the look layer). `FastCut` becomes
`<ReelFrame p={p} logo captions={sc => <Captions …same props…/>} empty={() => <AbsoluteFill …same gradient…/>} />`.

- [ ] Step 1: before the change, render stills of `projects/2026-11-20-demo-card-moi/render-props.json` at frames
  30, 200, 400, 700 and of `projects/test/render-props.json` at 30, 600, 1200 (keep them). Those videos only use
  `cut`: also make a scratch copy of `projects/test/render-props.json` with scene 2 `transition: "fade"` and scene 3
  `transition: "slide"` and a clip change with `mediaTransition: "fade"`, and render frames in the middle of each
  transition plus one frame of the CTA. First render one frame twice and confirm the two PNGs are identical (if not,
  compare with a small tolerance and say so in the report).
- [ ] Step 2: refactor.
- [ ] Step 3: render the same stills again; compare each pair pixel-exactly
  (`ffmpeg -v error -i a.png -i b.png -filter_complex "[0][1]blend=all_mode=difference,blackframe=99:1" -f null -`
  or python PIL `ImageChops.difference(...).getbbox() is None`). All must be identical. studio tsc → PASS.
- [ ] Step 4: commit `Move the reel skeleton into a shared ReelFrame`.

---

### Task 6: Template `story`

Depends on Tasks 1, 2, 5.

**Files:** Create `studio/src/templates/story/Story.tsx`, `studio/src/components/StoryCaptions.tsx`,
`studio/src/components/Look.tsx`; modify `studio/src/templates/index.ts`, `studio/src/types.ts` (`Scene.bg?`,
`RenderProps.look?`), `tools/reel/props.py` (scene `bg`, top-level `look`), `tools/reel/config.py` (`resolve_video`
passes `look`), `tools/reel/validate.py` (`bg` in `{"light", "dark"}`), `app/shared/types.ts` (`SceneSpec.bg?`).
Tests: `tools/tests/test_props.py`, `tools/tests/test_validate.py`, `tools/tests/test_config.py`.

**Interfaces:**
- Storyboard scene `bg: "light" | "dark"` (default `"dark"`), passed to the render-props scene as `bg`.
- Config/storyboard `look: {grain: number, scanlines: number, logo: boolean}` (0..1 strengths; default
  `{grain: 0, scanlines: 0, logo: false}` when absent) resolved like `captions`: `config.look` → storyboard `look`;
  render props top-level `look`. (Defaults for `story` come from `config.templates.story.look`, Task 7.)
- `StoryCaptions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle; dark: boolean}>`:
  the current chunk, centred in the safe area (x 8%–92%, y 22%–70%), large (`style.size * 1.6`, auto-shrink so the
  longest chunk fits in 3 lines), weight 800, no box; each word appears at its `times[i]` (fallback: even spread) with
  a 0.18 s fade + 6 px rise; highlighted units use `style.highlightColor` and take the time of their first token;
  text colour near-white on dark, near-black on light. Over footage (scene has media) add
  `textShadow: 0 4px 24px rgba(0,0,0,.85)` and a soft dark radial scrim behind the text block.
  Collision rule: while a motion layer of the same scene with `position` `center` or `full` (or a free `box` whose
  centre is in the middle third) is on screen, the card is hidden (pass the scene's motion items in as a prop).
- `Look: React.FC<{grain: number; scanlines: number}>`: full-frame overlay, `pointerEvents: none`: scan lines as a
  repeating linear gradient (2 px dark line every 4 px, opacity `0.12 * scanlines`); grain as an SVG `feTurbulence`
  noise whose `seed` changes every 2 frames, opacity `0.10 * grain`, `mixBlendMode: overlay`. Renders nothing when
  both are 0.
- `Story` = `<ReelFrame p logo={p.look?.logo ?? false} captions={sc => <StoryCaptions … dark={(sc.bg ?? 'dark') === 'dark'} />} empty={sc => flat background: dark #0B0B0F, light #F3EFE6}><Look …/></ReelFrame>`.
  Registered as `story` in `templates/index.ts` (do not touch other entries).

- [ ] Step 1: failing Python tests: scene `bg` passes through (default absent → not set or `"dark"`, pick one and
  test it); `validate` rejects `bg: "blue"`; `look` resolves config → storyboard and lands in render props.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement Python, types, components, template.
- [ ] Step 4: tests + both tsc → PASS. Build a story render-props by copying `projects/test/render-props.json`,
  setting `"template": "story"`, `look: {grain: 1, scanlines: 1, logo: false}`, and on one scene `media: []` +
  `bg: "light"`; render stills at a spoken frame of a footage scene, of the light text-card scene, and of a dark one;
  view them (text inside the safe area, words partially revealed mid-chunk, look visible but subtle).
- [ ] Step 5: commit `Add story template with text-card captions and look layer`.

### Task 7 (main session)

- `config.json` `templates.story`: `look: {grain: 0.6, scanlines: 0.5, logo: false}`, `captions` size tuned on stills,
  `sfx` block from the Part 2 plan (after the user approves impact/tick files).
- Demo project `projects/2026-11-21-demo-story/` (2–3 centre/student scenes from `library/`, 2–3 knowledge scenes with
  text cards, a `CountUp`, a `BarChart` with a real, user-provided or clearly sample-labelled source, a `musicDrop`,
  `blur-in` punchline). Ask the user for facts; never invent them. Prepare, stills, render, `check.py`, `look.py --safe`.
