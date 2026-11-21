# Explainer template + dropping the mix rule (design)

## Intent / why
The user had Claude make a 2:34 brand film for Trung tâm Tin học Sao Việt with no repo and no skills
(`~/Downloads/video-do-claude-tu-lam-khong-co-skill-hay-repo-gi-het.mp4`, 1920x1080). It looks better than the
reels this repo makes. Analysis: every idea got its **own visualization** (a skill curve for "không giới hạn số buổi",
a 3D pillar map for "13 cơ sở", a document stack + MIỄN PHÍ stamp + timeline for "học liệu trọn đời", a chat mockup
for "mô-đun AI"). It used one consistent visual language (white canvas, navy/orange, rounded cards, soft shadows) and
continuous choreography (elements build and morph instead of hard cuts + overlay boxes).

The repo's rules hold the creativity back: the 60/30/10 footage/motion mix target, "reuse `motion/*` first", and fixed
templates make Claude pick the nearest existing box instead of asking how an idea should look.

So: keep the pipeline (library, VieNeu voice, render, QA, app). Loosen the creative layer and add a template built
for bespoke motion design.

## Goals
1. **Drop the mix rule everywhere, for every template.** No target, no setting, no report.
2. **New template `explainer`.** It shows up in the app's template picker like `fast-cut`. Each video gets new,
   bespoke motion components written for it. Reusing an existing component is allowed but never the default.
3. **Each explainer video picks one format when it is created: vertical 1080x1920 or landscape 1920x1080.**
   Landscape is landscape, vertical is vertical. There is no single storyboard that renders both.
4. **Claude decides the creative approach itself and builds it.** It does not ask the user per scene.
5. **The user's video is the style reference** (a quality bar, saved in the repo's reference area).
6. **A brand facts file**, so Claude has real data to visualize without inventing any.

## Non-goals
- One storyboard rendering both formats (option B, rejected by the user: each platform gets its own video).
- Making the 6 existing templates landscape-capable. They stay vertical. The format choice appears only for `explainer`.
- HyperFrames or any engine change. This stays in Remotion.
- Transcribing or re-voicing the reference video.

## Anti-goals (failure even if it works)
- `explainer` turning into a fixed kit, where every video reuses the same cards. Each video must have its own
  visual concept.
- Copying the reference video's look 1:1. It sets the quality bar (consistency, one visual idea per point,
  continuous motion), not the exact design.
- Any invented fact (CLAUDE.md rule 1 still applies). Numbers on screen come from the facts file or the user.

## Approaches considered (format support)
- **A. Each video picks one format at creation. (Chosen by the user.)** Simplest. Each platform gets a video
  written for it: landscape is long and complete, vertical is short and hook-first.
- B. One storyboard and voice rendered in both formats. Rejected: the two platforms want different content and length.
- C. Two templates, `explainer-doc` and `explainer-ngang`. Rejected: duplicated code that drifts apart.

## Design

### 1. Remove the mix rule
- `CLAUDE.md` rule 5: delete the mix target sentence and "prepare.py prints the actual mix". Keep "one scene per
  spoken idea" and "time key motion on the voice with `at`/`until`". Also drop "prefer bands/boxes over footage to
  cutting to a pure-motion page"; for `explainer`, pure-motion pages are normal.
- `.claude/skills/make-reel/SKILL.md`: drop "mix" from the draft report (line ~26) and any other mix guidance.
- `config.json`: remove the `mix` key.
- App Settings: remove the mix bar and sliders (`app/src/screens/Settings/SettingsForm.tsx`, `mix.ts` and its test,
  the `--mix-*` tokens, the `mix` field in the shared `Config` type and in server settings validation).
- Python: remove `tools/reel/mix.py`, `tests/test_mix.py`, the `mix`/`target` fields of the pipeline result, the
  `mix` entry in `timings.json`, and the Mix line in `prepare.py`. **Builder:** grep every consumer of these fields
  (the app reads the pipeline result and `timings.json`) and remove them together. `shots()` lives in `mix.py`: if
  something still uses it, move it next to its caller instead of deleting it.
- **Not touched:** the scene transition value `"mix"` in `props.py`/`validate.py`. It is unrelated (rotating
  transitions).
- The reel spec (`docs/superpowers/specs/2026-11-18-reel-pipeline-design.md`): remove the mix target wherever it is
  stated.

### 2. Format per video
- The pipeline already deep-merges `storyboard.video` over `config.video` (`tools/reel/config.py:53`), and
  `Root.tsx` takes width/height from the props. **A landscape video is a storyboard with
  `"video": {"width": 1920, "height": 1080}`.** No new storyboard field.
- **New-project dialog** (`app/src/screens/Projects/Projects.tsx`): a "Khổ" select (Dọc 9:16 / Ngang 16:9) that
  appears only when the template is `explainer`. Default: Dọc. Landscape writes the `video` override into the new
  storyboard. The server project-create route accepts and validates it (only these two sizes).
- **App views follow the project's aspect** instead of the hard-coded `9 / 16`: Editor preview frame
  (`PreviewPane.module.css`), Renders grid (`Renders.module.css`), project thumbs (`VideoThumb` already takes `aspect`).
  The Editor layout must stay usable with a wide frame. **Builder:** check every `9 / 16` / `0.5625` /
  `1080`/`1920` in `app/src`.
- **QA:** vertical uses `--platform tiktok` / `--safe tiktok` as today. Landscape uses `check.py --platform youtube`
  and `look.py --safe youtube` (the platform exists in `_platforms.py`). CLAUDE.md rule 7 and the make-reel skill say
  this.

### 3. The `explainer` template
- `studio/src/templates/explainer/Explainer.tsx`, registered in `templates/index.ts`, and listed wherever the app
  gets its template list.
- **What the template owns (the canvas, not the content):** a calm brand canvas (light by default, from `brand`
  colors), the logo placement, a caption style that fits it, soft continuous scene transitions, and the CTA ending.
  It must lay out correctly at both 1080x1920 and 1920x1080: read `useVideoConfig()` and design for the shorter
  side, with no hard-coded 1080/1920.
- **Captions:** the template supports them, and `config.json templates.explainer` sets the default (my call: off,
  like the reference, where the on-screen text carries the message). Claude may turn them on per video. Vertical
  social video usually benefits from captions.
- `config.json templates.explainer`: the template's defaults (captions, transitions, music, look), in the same shape
  as the other template entries.
- **Per-video components:** each explainer video's bespoke components live in
  `studio/src/videos/<slug>/<Name>.tsx`, not in the shared `studio/src/motion/`. They are referenced from the
  storyboard like any motion component. They must not clutter other videos (the app's motion picker, `usage.py
  --motion`). **Builder decides the mechanism** (e.g. webpack `require.context` over `videos/*/index.ts`, or a
  generated index), as long as adding a video needs no edit to shared registry code beyond what is automatic. They
  use the same zod-schema + `defineMotion` contract, so the app's field editor still works for them.
- Footage is welcome where it helps (a real class, a real campus). It is no longer required.

### 4. Creative process (make-reel skill, `explainer` branch)
Claude runs this alone, with no per-scene questions to the user:
1. Read the brand facts file and `docs/style/explainer.md`. Confirm the brief (topic, format, length, CTA) and any
   missing facts with the user once, at the start (rule 1).
2. Write the script as a list of ideas, one scene per spoken idea.
3. For each idea, choose a **visual concept**: what makes it understood instantly (chart, map, timeline, UI mockup,
   kinetic type, annotated footage, object metaphor…). Write the concepts into the storyboard notes before coding.
   Avoid repeating a concept used in this brand's previous explainer (check the last project).
4. Write the components in `studio/src/videos/<slug>/`.
5. Render a still per scene (2–3 for scenes with heavy motion). Critique them against the reference bar (consistency,
   one idea per visual, readable text, safe zones for the format). Fix, then render.
6. QA per format (section 2), then report.

The skill keeps its existing steps (voice, prepare, render naming, commit on accept). Only the creative part changes.
CLAUDE.md rule 6 becomes: for `explainer`, write new components each video under `studio/src/videos/<slug>/`; other
templates keep reusing `motion/*` first.

### 5. Style reference
- The video file goes to `reference/explainer/sao-viet-brand-film.mp4` (`reference/` is git-ignored; it syncs via
  Drive like the other media). Its contact sheets (one frame every 3 s) go beside it.
- `docs/style/explainer.md` (in git) is the written bar, extracted from the reference: palette roles, card shape and
  shadow, type scale, logo placement, motion principles (build-up, morphs, no hard cut + box), "one idea = one
  visual", and the 12–15 concepts the reference used as **examples, not a menu**. It states plainly that each video
  must find its own concept.

### 6. Brand facts
- `brands/<brand>/facts.md` (in git), e.g. `brands/demo/facts.md` for the Sao Việt brand. It holds course list,
  campuses, ratings, certifications, schedules, benefits, contact, and a "source / confirmed on" note per fact.
- First draft: the facts visible in the reference video (13 cơ sở: TP.HCM 6, Bình Dương 4, Đồng Nai 2; Google
  ratings per campus; certifications; ca sáng/chiều/tối; học liệu miễn phí trọn đời; kèm 1-1; không giới hạn số buổi;
  mô-đun AI). **The user confirms each one before it is used.** Unconfirmed facts are marked and never shown.
- The make-reel skill reads it for every template, not only `explainer`.

## Done means
- Mix is gone: no `mix` key in `config.json`, no mix UI, no mix in pipeline output, docs updated, all tests pass.
- `explainer` is selectable in the app. The "Khổ" choice appears for it only, and a landscape project previews and
  renders at 1920x1080 in the app (Editor and Renders show 16:9 correctly).
- `docs/style/explainer.md` and `brands/demo/facts.md` exist. The reference video is stored in `reference/explainer/`.
- **Pilot:** one landscape explainer made with the new process, covering the reference's content with VieNeu voice,
  for the user to compare against the reference. A vertical pilot is optional (user's call after the landscape one).
- Tests: `uv run --with pytest python -m pytest tools/tests -q`, `cd studio && npx tsc --noEmit`,
  `cd app && npm test && npx tsc --noEmit`.

## Settled after the builder check (main-session calls)
- **Reference file:** it exists at the Downloads path (probed: 1920x1080, 30 fps, 154.5 s, has audio). Copy it, don't move it.
- **Brand:** `brands/demo` is the Sao Việt brand (its logos are `logo-marketing-sao-viet*.png`). The new-project dialog
  already has a brand select, so nothing new is needed.
- **Pilot script:** Claude writes a new script covering the reference's ideas (no transcript needed), landscape, about
  2 minutes, with the CTA taken from confirmed contact facts. The pilot starts only after the user has confirmed
  `facts.md`. Unconfirmed facts are left out of it.
- **Per-video components in the app:** a video's components appear in the Editor's motion picker **only for that
  video**. Shared `motion/*` components appear for all. The builder checks how the app gets the registry and schemas
  today and extends it in the same way.
- **Old data:** existing `timings.json` / snapshots with a `mix` field are tolerated (ignored), not migrated.
- **Shared studio pieces:** the explainer template uses its own size-aware captions, logo and CTA (inside
  `templates/explainer/`). The existing `Captions`, `LowerThird`, `OfferCard`, `SplitCompare` and CTA components are
  not changed. `Root.tsx` already takes its size from the props.
- **Landscape safe zones:** if the app draws a platform safe-zone overlay, it follows the project's format (youtube
  zones for 16:9).
- **Footage in a 16:9 frame:** no new pipeline logic. How portrait footage sits in a landscape frame (framed card,
  blurred fill, crop) is a per-video design decision, made with the existing media layer options.
- **Projects with no `video` override** are vertical.

## Left to the builder
- Per-video component loading mechanism (section 3).
- The exact explainer canvas design and transitions, within the style doc.
- How the Editor layout adapts to a 16:9 frame.
