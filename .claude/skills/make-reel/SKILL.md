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
   - Mode A (default): write the script yourself; choose shots from `media-index.json` (`description`, `goodRanges`); add motion layers to reach ~60/30/10 —
     mostly on top of footage (bands/boxes), timed on the voice with `at`/`until`, plus a video-wide `motion` track when something spans scenes.
     Write a new motion component (with its schema) when the idea needs one.
   - Mode B: the user dictated script/shots — transcribe faithfully, don't rewrite.
4. **Prepare:** `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>`. Fix any reported errors.
   Over `targetSeconds` -> shorten `say` and rerun (only changed scenes re-synthesize).
5. **Self-check:** render a still at the middle frame of each scene and look at every one; fix problems before rendering.
6. **Render:** render `reel-v<N>.mp4` at full quality (no `--scale`). Reply in Vietnamese with:
   - the absolute path;
   - a table (scene | lời đọc | hình | motion | giây);
   - total length and mix.
7. **Iterate:** apply feedback per CLAUDE.md rule 2. Re-run prepare -> stills -> next `reel-v<N>`.
8. **Approve:** on approval, commit `storyboard.json` (no sync push of the mp4).
