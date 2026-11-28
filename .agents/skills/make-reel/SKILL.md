---
name: make-reel
description: Make or revise a course-promo video (storyboard -> voice -> Remotion render): vertical reels, or a vertical/landscape `explainer`. Use when the user asks for a reel/video quảng cáo khóa học, or to change an existing one.
---

# Make a reel

Follow AGENTS.md rules. Steps:

0. **Read first:** `brands/<brand>/facts.md` (use only confirmed facts), `taste.md`, `pronounce.md`, `wishlist.md`,
   `docs/style/concepts.md`, `docs/style/expert-review.md`; for `explainer` also `docs/style/paper.md` (default look; `docs/style/explainer.md` for its principles and the `clean` look).
1. **Media:** if `inbox/` has files, run `python3 tools/ingest.py` and describe the new entries in `library/media-index.json`.
2. **Brief** (write it into the storyboard notes): audience, their pain, one promise, proof (confirmed facts), one concrete
   action at the end; plus course, offer, template, format (`explainer` only: dọc 1080x1920 or ngang 1920x1080), target
   length, voice (default from config), brand. Ask for any missing fact once, at the start; never invent them.
   **Music:** always set storyboard `music: {"file": ...}` yourself (no default track exists; user's call 2026-11-21).
   Pick a `music/` track that fits the mood; among equal fits take the least used:
   `python3 -c "import json,glob,collections as c;print(c.Counter((json.load(open(f)).get('music') or {}).get('file') for f in glob.glob('projects/*/storyboard.json')))"`.
   No music only when the user asks for it.
3. **Project:** create `projects/<YYYY-MM-DD>-<slug>/storyboard.json` (format: spec "Storyboard format"; landscape adds
   `"video": {"width":1920,"height":1080}`).
   - Mode A (default): write the script yourself, one scene per spoken idea; the first 3 s hit the pain or a curious number
     with real people on screen. Choose shots from `media-index.json` (`description`, `goodRanges`); run
     `python3 tools/usage.py` first: among shots that fit the idea equally well, pick the least-used (fit beats freshness).
     Real footage is the backbone: add motion on top of or beside it, timed on the voice with `at`/`until`, plus a
     video-wide `motion` track when something spans scenes. Write a new motion component (with its schema) when the idea needs one.
   - Template `explainer` (no per-scene questions to the user): for each idea pick a **visual concept** that makes it
     understood instantly. Start from the footage that shows it, then decide the motion on top (annotation, framed
     footage, chart beside a shot, map, timeline, UI mockup, kinetic type…). Write the concepts into the storyboard
     notes before coding; don't repeat a concept from this brand's last explainer (`docs/style/concepts.md`). Write the
     components in `studio/src/videos/<slug>/` (README there); several components -> `worker-sonnet` workers in
     parallel, one component each. No fitting footage -> borrow a near shot or keep a short motion page, and log the
     missing shot in `wishlist.md`.
   - Mode B: the user dictated script/shots — transcribe faithfully, don't rewrite.
4. **Prepare:** `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>`. Fix any reported errors.
   Over `targetSeconds` -> shorten `say` and rerun (only changed scenes re-synthesize).
5. **Self-check:** render a still at the middle frame of each scene (2–3 for heavy-motion scenes) and look at every one;
   for `explainer` critique them against `docs/style/paper.md`. Then a fresh `worker-sonnet` reviewer reads the
   storyboard + still sheet against `docs/style/expert-review.md` (brief, hook, muted viewing, proof, ad policy); fix its
   findings before rendering. `worker-haiku` may describe stills against a checklist or run the QA commands.
6. **Render:** render `reel-v<N>.mp4` at full quality (no `--scale`). Then run the post-render check (AGENTS.md rule 7:
   `check.py` + `look.py`, `--platform/--safe tiktok` for vertical, `youtube` for landscape) and fix or report what it
   flags. Reply in Vietnamese with:
   - the absolute path;
   - a table (scene | lời đọc | hình | motion | giây);
   - total length.
7. **Iterate:** apply feedback per AGENTS.md rule 2; log praise/rejections in `taste.md` and TTS fixes in `pronounce.md`.
   Re-run prepare -> stills -> next `reel-v<N>`.
8. **Approve:** on approval, commit `storyboard.json` (no sync push of the mp4), then a 3-line retro: update
   `docs/style/concepts.md` (concepts + verdict) and `wishlist.md`; add any mistake seen twice to the step-5 check list.
   A per-video component praised twice -> propose promoting it into `studio/src/motion/` (user decides).

## Thẻ và hiệu ứng chữ

Motion cards, pick by purpose:
- `Ribbon`: a key benefit line.
- `TwoTier`: who it is for (audience plus field).
- `Callout`: pointing at a person or a screen; set `targetX`/`targetY` on the subject and verify on a still.
- `PinLabel`: a place.
- `GlossyPill`: an offer or gift.
- `GiantText`: one big statement, at most one per video.
- `OfferCard`: an offer/discount (label, title with `highlight`, stamp via `stampTop/stampMain/stampBottom`); `variant` `card` | `giant` (huge number in a yellow slab).
- `Stamp`: stamp any short label (round or rect, `top`/main/`bottom`); lands with a shake.
- `Checklist`: `variant` `steps` (staircase bars) | `grid` (2x2 tiles).
- `PriceTag`: `variant` `slam` | `countdown` (price counts from `old` to `price`); `stamp` text, empty = none.
- `DateBadge`: `variant` `slab` | `calendar`; optional `sub` line.
- CTA end card: one style (glass card with logo, pill, phone, fanpage); empty fields are hidden, so fill `cta` truthfully.

Rules:
- Vary `fx` (`none, typewriter, words, pop, scramble, mask, wave`) between consecutive cards; never use one effect for the whole video.
- Brand colors are a starting point: per-layer `colors` (now including `accent2`/`surface`) and new components stay allowed.
- Choreographed cards need a layer of at least about 2.5 s at `pace: normal`, or they exit before they finish; use `pace: fast` for short layers.
- Variety: run `python3 tools/usage.py --motion` before choosing cards/variants. Pick by fit first; among equal fits take the least-used;
  never repeat the last project's combo. New components are allowed if they use the brand tokens in `studio/src/motion/style.ts`.

## Khoảnh khắc đặc trưng và chuyển cảnh

- Each video gets ONE signature moment: a `MaxKinetic` slam on the key promise, the 3D CTA (template `max`), or `leak: true` on the turning-point scene.
- Vary scene `transition`: use `mix` or pick per scene (`cut, fade, slide, push, cube, wipe, flip, clockWipe`); never one kind throughout. `usage.py --motion` prints transition counts: take the least used.
- Prefer the cards listed under "never used" by `usage.py --motion` when they fit.
- Template `max` exists for reels that must not look templated. The template is the user's call per video, or a default in `config.json` per rule 2; never switch the default silently.
