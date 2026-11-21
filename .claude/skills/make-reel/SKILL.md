---
name: make-reel
description: Make or revise a vertical course-promo reel (storyboard -> voice -> Remotion render). Use when the user asks for a reel/video quảng cáo khóa học, or to change an existing one.
---

# Make a reel

Follow CLAUDE.md rules. Steps:

1. **Media:** if `inbox/` has files, run `python3 tools/ingest.py` and describe the new entries in `library/media-index.json`.
2. **Brief:** get course, offer, target length, voice (default from config), brand, music yes/no.
   Ask for any missing fact (price, phone, dates); never invent them.
3. **Project:** create `projects/<YYYY-MM-DD>-<slug>/storyboard.json` (format: spec "Storyboard format").
   - Mode A (default): write the script yourself; choose shots from `media-index.json` (`description`, `goodRanges`);
     run `python3 tools/usage.py` first: among shots that fit the idea equally well, pick the least-used (fit beats freshness); add motion layers to reach ~60/30/10 —
     mostly on top of footage (bands/boxes), timed on the voice with `at`/`until`, plus a video-wide `motion` track when something spans scenes.
     Write a new motion component (with its schema) when the idea needs one.
   - Mode B: the user dictated script/shots — transcribe faithfully, don't rewrite.
4. **Prepare:** `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>`. Fix any reported errors.
   Over `targetSeconds` -> shorten `say` and rerun (only changed scenes re-synthesize).
5. **Self-check:** render a still at the middle frame of each scene and look at every one; fix problems before rendering.
6. **Render:** render `reel-v<N>.mp4` at full quality (no `--scale`). Then run the post-render check (CLAUDE.md rule 7:
   `check.py --platform tiktok` + `look.py --safe tiktok`) and fix or report what it flags. Reply in Vietnamese with:
   - the absolute path;
   - a table (scene | lời đọc | hình | motion | giây);
   - total length and mix.
7. **Iterate:** apply feedback per CLAUDE.md rule 2. Re-run prepare -> stills -> next `reel-v<N>`.
8. **Approve:** on approval, commit `storyboard.json` (no sync push of the mp4).

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
