# Explainer Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the footage/motion mix rule, add an `explainer` template whose videos pick vertical or landscape at
creation and get bespoke per-video motion components, plus a written style bar and a brand facts file.

**Architecture:** The mix target is removed end to end (config, pipeline, app). The `explainer` template is a new
`studio/src/templates/explainer/` folder (the app lists template folders automatically). Format is the existing
`storyboard.video` override, set by the new-project dialog. Per-video components live in `studio/src/videos/<slug>/`
and are pulled into a generated `studio/src/videos/index.ts`, keyed `"<slug>/<Name>"`, that both the renderer and the
app read.

**Tech Stack:** Python 3 (tools/reel, pytest via uv), Remotion 4 + rspack (studio), React + Vite + Hono (app), zod.

**Spec:** `docs/superpowers/specs/2026-11-21-explainer-template-design.md`

## Global Constraints
- Sizes: vertical = 1080x1920 (default, also for projects with no `video` override), landscape = 1920x1080. No other sizes.
- The format choice exists only for template `explainer`. Other templates stay vertical and their components are not changed.
- The scene transition value `"mix"` (`tools/reel/props.py` MIX, `validate.py` TRANSITIONS, `config.json templates.max`) is unrelated and stays.
- Old `timings.json` / snapshots that still contain `mix` must load fine (ignored, not migrated).
- User-facing app text is Vietnamese. Zod field `title`s are Vietnamese.
- Commits: one line, no body, no Co-Authored-By trailer. Workers sharing the tree stage only their own files, by explicit path.
- Tests per task: only the touched modules. Python: `uv run --with pytest python -m pytest tools/tests -q -k <name>`; studio: `cd studio && npx tsc --noEmit`; app: `cd app && npx vitest run <files> && npx tsc --noEmit`.
- `config.json` `mix` key is already removed (done by the main session before dispatch). Only Task 5 edits `config.json` from here on.
- Never edit `VieNeu-TTS/`.

## Review Focus
1. An existing vertical project (no `video` override, old `timings.json` with `mix`) opens in Projects, Editor and Renders exactly as before. → Tasks 2 and 4 tests.
2. A landscape project in the Editor shows a 16:9 frame that fits the pane (no overflow, no letterboxed 9:16 box). → Task 4 test plus a screenshot.
3. A storyboard references `"<slug>/<Name>"` but the file or export is missing → `prepare.py` fails at validate with a clear message, not a render-time crash. → Task 3 test.
4. Two videos both define a component named `Map` → no collision; each storyboard gets its own. → Task 3 test.
5. Project create with `format: "ngang"` but a template other than `explainer`, or an unknown format → 400. → Task 4 test.

---

### Task 1: Remove the mix target from the Python pipeline
Agent: worker-sonnet.

**Files:**
- Modify: `tools/reel/mix.py` (delete `mix()` and `_covered()`; keep `shots()`, and rename the module to `tools/reel/shots.py`)
- Modify: `tools/reel/pipeline.py:9,68-146` (drop `target`, the `mix` result field and the `mix` entry in `timings.json`; keep `"shots"`)
- Modify: `tools/prepare.py:38-41` (drop the Mix line; keep the Shots line)
- Modify/Delete: `tools/tests/test_mix.py` → `tools/tests/test_shots.py` (keep only the `shots()` tests); `tools/tests/test_pipeline.py:47` fixture

**Interfaces:**
- Produces: `tools.reel.shots.shots(scenes: list[dict]) -> dict` (unchanged behavior). The pipeline result no longer has the keys `mix` or `target`.

- [ ] **Step 1:** In `test_pipeline.py`, assert the success result has no `"mix"` or `"target"` key and that the written `timings.json` has no `"mix"`. Run it and see it FAIL.
- [ ] **Step 2:** Make the changes above. `grep -rn "\.mix import\|\"mix\"\]\|\['mix'\]\|res\[.target" tools` returns only transition-related hits.
- [ ] **Step 3:** Run `uv run --with pytest python -m pytest tools/tests -q`. Expected: all pass. (`pipeline.py` is shared core, so run the whole Python suite.)
- [ ] **Step 4:** Commit: `Pipeline: drop the footage/motion mix target`.

### Task 2: Remove the mix target from the app
Agent: worker-sonnet.

**Files:**
- Modify: `app/server/routes/projects.ts:28` (summary `mix`), `:89` (detail `mixTarget`); `app/server/routes/projects.test.ts:55`
- Modify: `app/shared/types.ts:40,43,59,65,85` (remove `Mix` and every `mix`/`mixTarget` field)
- Modify: `app/src/screens/Projects/Projects.tsx:34,46-47,148-150` (mix bar and legend) and `Projects.module.css:16-17`
- Modify: `app/src/screens/Editor/editorState.ts:63` (`mixOf`) and its callers; `editorState.test.ts:46-54`
- Modify: `app/src/screens/Settings/SettingsForm.tsx` (mix bar and sliders; the defaults group saves only `defaults`)
- Delete: `app/src/screens/Settings/mix.ts`, `mix.test.ts`
- Modify: `app/src/ui/tokens.css:12,28` (remove `--mix-*` only if nothing uses them afterwards; `WorkerStatus.module.css:3` uses one, so rename it to a neutral token there instead)

**Interfaces:**
- Produces: `ProjectSummary` and `ProjectDetail` without `mix`/`mixTarget`; `Config` without `mix`.

- [ ] **Step 1:** In `projects.test.ts`, replace the `mixTarget` expectation with: a project whose `timings.json` contains a legacy `"mix": {...}` still lists and opens (200), and the response has no `mix`/`mixTarget` keys. Run it and see it FAIL.
- [ ] **Step 2:** Make the removals. Run `grep -rn "mix" app/src app/server app/shared | grep -iv "color-mix\|mixin"` and expect no hits.
- [ ] **Step 3:** Run `cd app && npm test && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 4:** Commit: `App: drop the mix bar, sliders and live mix share`.

### Task 3: Per-video motion components
Agent: worker-sonnet. Starts after Task 1 (both touch `pipeline.py`).

**Files:**
- Create: `tools/reel/videos_index.py` with `write_videos_index(root: Path) -> bool` (returns True if the file changed)
- Create: `studio/src/videos/index.ts` (generated; committed; header comment `// generated by tools/reel/videos_index.py — do not edit`)
- Create: `studio/src/videos/README.md` (3–5 lines: the contract below)
- Modify: `tools/reel/pipeline.py` (call `write_videos_index` before validate)
- Modify: `tools/reel/validate.py` (motion `component` names containing `/` must exist in the generated index)
- Modify: `studio/src/components/MotionLayer.tsx:95` (lookup `MOTION[name] ?? VIDEO_MOTION[name]`)
- Modify: `app/src/screens/Editor/motionSchema.ts` (picker = shared `MOTION` + `VIDEO_MOTION` entries whose key starts with `${slug}/`)
- Test: `tools/tests/test_videos_index.py`, `app/src/screens/Editor/motionSchema.test.ts` (create if missing)

**Contract:**
- `studio/src/videos/<slug>/index.ts` exports `export const MOTION: Record<string, MotionDef> = {Name: defineMotion({...})}`. Components sit beside it as `<Name>.tsx`, with the same zod and `defineMotion` contract as `motion/*`.
- The generated `index.ts` imports each `./<slug>` (`import {MOTION as v0} from './<slug>'`, sorted by slug) and exports
  `VIDEO_MOTION: Record<string, MotionDef>`, where each key is `"<slug>/<Name>"`. With no video folders it exports `{}`.
- The storyboard uses `"component": "<slug>/<Name>"`. `tools/usage.py --motion` is unchanged: it reads only `registry.ts`, so per-video components never show up in it.

- [ ] **Step 1:** Write `test_videos_index.py`:
  - `test_empty`: no folders → the file exports `{}`.
  - `test_two_videos_same_name`: folders `a/` and `b/`, both exporting `Map` → output contains both `'a/Map'` and `'b/Map'`.
  - `test_idempotent`: the second call returns False.
  - `test_validate_missing`: a storyboard with `"component": "x/Nope"` → validate error mentioning `x/Nope`.
  Run and see FAIL.
- [ ] **Step 2:** Implement. Derive the key list from a regex over `export const MOTION` entries in each `videos/<slug>/index.ts` (same regex style as `tools/usage.py:36`), so validate needs no TypeScript.
- [ ] **Step 3:** `motionSchema.test.ts`: with a mocked `VIDEO_MOTION` holding `a/Map` and `b/Map`, the picker for slug `a` contains `a/Map` and not `b/Map`.
- [ ] **Step 4:** Add a throwaway `studio/src/videos/zz-smoke/` (one tiny component). Run `VieNeu-TTS/.venv/bin/python tools/prepare.py` on a scratch copy of a project that references `zz-smoke/Dot`, then render one still. Expected: the still shows the dot. Delete `zz-smoke` and regenerate the index.
- [ ] **Step 5:** Run the Python suite, `cd studio && npx tsc --noEmit`, and `cd app && npx vitest run src/screens/Editor && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 6:** Commit: `Per-video motion components under studio/src/videos`.

### Task 4: Format per video (create dialog + aspect-aware views)
Agent: worker-sonnet. Starts after Task 2 (both touch `Projects.tsx` and `projects.ts`).

**Files:**
- Modify: `app/server/routes/projects.ts:53-70` (accept `format?: 'doc' | 'ngang'`)
- Modify: `app/src/screens/Projects/Projects.tsx:85-113` (select "Khổ": `Dọc 9:16` / `Ngang 16:9`, shown only when the template is `explainer`; default Dọc)
- Modify: `app/shared/types.ts` (`ProjectSummary`/`ProjectDetail` gain `size: {width: number; height: number}`, resolved as `storyboard.video` merged over `config.video`)
- Modify: `app/src/screens/Editor/PreviewPane.module.css:3` and `PreviewPane.tsx` (frame aspect from `renderProps.width/height` via a CSS var; width = min of the pane width and pane height × aspect)
- Modify: `app/src/screens/Renders/Renders.module.css:8`, `VersionCard.tsx:8` (aspect and the `final` label from `size`)
- Modify: project thumbs that use `VideoThumb` (pass `aspect` from `size`)
- Test: `app/server/routes/projects.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `POST /projects` body `format`; `size` on project summary/detail.

- [ ] **Step 1:** In `projects.test.ts`, write these tests:
  - `{template: 'explainer', format: 'ngang'}` → the storyboard has `video: {width: 1920, height: 1080}`, and the detail `size` is 1920x1080.
  - `format: 'doc'` or no format → no `video` key, and `size` is 1080x1920.
  - `{template: 'story', format: 'ngang'}` → 400.
  - `{format: 'square'}` → 400.
  - A legacy project without `video` → `size` is 1080x1920.
  Run and see FAIL.
- [ ] **Step 2:** Implement the server and types, then the dialog and views.
- [ ] **Step 3:** Run `cd app && npm test && npx tsc --noEmit`. Expected: pass.
- [ ] **Step 4:** Start the app (`make restart`). Create one explainer project in Ngang and open it in the Editor and in Bản render at viewport widths 1440 and 1024. Screenshot both (Claude in Chrome). Check: the frame is 16:9 and fits the pane, and a vertical project still looks as before. Delete the scratch project afterwards.
- [ ] **Step 5:** Commit: `App: Khổ choice for explainer, aspect-aware preview and renders`.

### Task 5: The `explainer` template canvas
Agent: worker-sonnet. It can run in parallel with Tasks 1–4.

**Files:**
- Create: `studio/src/templates/explainer/Explainer.tsx`, plus its own size-aware `ExplainerCaptions.tsx`, `ExplainerCta.tsx` and logo placement in the same folder
- Modify: `studio/src/templates/index.ts` (register `explainer: Explainer`)
- Modify: `config.json` `templates.explainer` (captions on by default, soft scene transitions such as `fade`, look without grain or scanlines, logo on). Use the existing keys only.
- Create: `studio/fixtures/explainer-doc.json`, `studio/fixtures/explainer-ngang.json` (render props for 2 scenes with footage, one plain motion layer, a CTA; the same content at 1080x1920 and 1920x1080)

**Must do:** Light brand canvas from `brand.colors`, soft shadows, logo top-left, continuous scene transitions, a CTA that
ends the video. Everything is sized from `useVideoConfig()` (design on the shorter side); there are no literal 1080/1920
values. Read `docs/superpowers/specs/2026-11-21-explainer-template-design.md` §3. If `ReelFrame` hard-codes vertical
sizes, compose without it inside this folder rather than changing it.
**Must NOT:** change `components/Captions.tsx`, `LowerThird`, `OfferCard`, `SplitCompare` or the shared CTA components.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** For each fixture, render stills at frames covering scene 1, the transition, scene 2 and the CTA:
  `cd studio && npx remotion still Reel /tmp/claude-1000/-home-giabao-dev-create-video/e896d3e0-50c1-4bd0-b00d-f65cb366e876/scratchpad/explainer/<fmt>-<n>.png --frame=<n> --props=fixtures/explainer-<fmt>.json`.
  Look at each: nothing overflows, the logo and CTA sit inside the frame, text is readable at both sizes.
- [ ] **Step 3:** Run `cd studio && npx tsc --noEmit` and `uv run --with pytest python -m pytest tools/tests -q -k "validate or config"`. Expected: pass.
- [ ] **Step 4:** Commit: `Explainer template: size-aware canvas, captions and CTA`.

### Task 6: Style reference, style doc, facts draft
Agent: worker-sonnet (needs vision for frames). It can run in parallel with everything.

**Files:**
- Create: `reference/explainer/sao-viet-brand-film.mp4` (copied from `~/Downloads/video-do-claude-tu-lam-khong-co-skill-hay-repo-gi-het.mp4`, not moved) and `reference/explainer/sheet_*.jpg`. Existing frames and sheets are in `/tmp/claude-1000/-home-giabao-dev-create-video/e896d3e0-50c1-4bd0-b00d-f65cb366e876/scratchpad/ref/` (`t_001..t_051.jpg` = one frame every 3 s; `sheet_a..d.jpg`).
- Create: `docs/style/explainer.md`, per spec §5. Cover: palette roles, card shape and shadow, type scale, logo placement, motion principles, "real footage is the backbone; motion explains on top of it", "one idea = one visual", and the reference's concepts listed as examples, not a menu.
- Create: `brands/demo/facts.md`, per spec §6. Every fact that is read off the frames gets `status: chưa xác nhận`, its timestamp and a `source: reference video` note.

- Create (spec §7): `brands/demo/taste.md`, `brands/demo/pronounce.md`, `docs/style/concepts.md`, `brands/demo/wishlist.md`, each with a one-line purpose and an empty table header; `concepts.md` seeded with the reference's concepts (video: reference, verdict: style bar).

- Create (spec §8): `docs/style/expert-review.md` with the five checklist points.

- [ ] **Step 1:** Read the frames at full resolution (crop or upscale with ffmpeg where text is small) and transcribe every visible fact exactly. Write "không đọc được" instead of guessing.
- [ ] **Step 2:** Write both docs. `facts.md` has sections: Cơ sở, Đánh giá, Khóa học, Quyền lợi, Lịch học, Chứng chỉ, Liên hệ (leave Liên hệ empty if no phone or URL is visible).
- [ ] **Step 3:** Commit `docs/style/explainer.md`, `brands/demo/facts.md`, the four spec §7 files and `docs/style/expert-review.md` (`reference/` is git-ignored): `Explainer style bar and Sao Viet facts draft`.

### Task 7: Rules and skill (main session)
After Tasks 1–5.
- [ ] `CLAUDE.md` rule 5: replace the mix sentence with "real footage is the backbone; motion explains on top of it (no numeric target)". Drop "prepare.py prints the actual mix" and the "prefer bands/boxes over… pure-motion page" clause.
- [ ] `CLAUDE.md` rule 6: for `explainer`, write new components each video under `studio/src/videos/<slug>/` (see its README). Rule 7: landscape QA uses `--platform youtube` / `--safe youtube`. The still-check list drops "mix".
- [ ] `.claude/skills/make-reel/SKILL.md`: drop "and mix". Add the explainer branch (spec §4, steps 1–6). Every template reads `brands/<brand>/facts.md` and uses only facts marked confirmed.
- [ ] `CLAUDE.md` rule 1: add "When the user states a new ad fact in any session, append or update it in `brands/<brand>/facts.md` right away (confirmed, source: user, date) and say so in one line" (spec §6).
- [ ] `CLAUDE.md` + make-reel `SKILL.md`: the spec §7 learning files: append on the spot, read at `/make-reel` start, 3-line retro on accepting a version.
- [ ] make-reel `SKILL.md`: spec §8: write the brief first; fresh `worker-sonnet` expert review of storyboard + still sheet before showing a draft.
- [ ] `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` lines ~28, 96, 160, 199, 285: remove the mix target.
- [ ] Commit: `Rules: no mix target, explainer workflow, facts file`.

### Task 8: Final review (main session), then pilot
- [ ] Read the full branch diff. Run the full suites (Python, studio tsc, app `npm test` + tsc, `npm run e2e`).
- [ ] The user confirms `brands/demo/facts.md`.
- [ ] Pilot: `/make-reel` makes a landscape explainer of about 2 min, covering the reference's ideas, using confirmed facts only. Render through the app. Run QA with `--platform youtube` and `--safe youtube`. The user compares it with the reference.
