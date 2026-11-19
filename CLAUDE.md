# create-video — rules for Claude

Vertical course-promo reels: student footage + VieNeu-TTS voice + Remotion motion graphics.
Spec: docs/superpowers/specs/2026-11-18-reel-pipeline-design.md. Talk to the user in Vietnamese.
Start a reel with the `/make-reel` skill.

## Commands (run from repo root)
- Ingest: `python3 tools/ingest.py`. Then describe each new file in `library/media-index.json`
  (description, tags, goodRanges) by viewing `library/thumbs/<name>.jpg`; more than 5 files -> delegate to a subagent.
- Prepare: `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>`
- Still: `cd studio && npx remotion still Reel ../projects/<slug>/preview/<id>.png --frame=<n> --props=../projects/<slug>/render-props.json`
- Draft: `cd studio && npx remotion render Reel ../projects/<slug>/reel-v<N>.mp4 --props=../projects/<slug>/render-props.json --scale=0.5`
- Final: same as draft without `--scale`.
- Preview UI for the user: `cd studio && npx remotion studio`
- Voice audition: `VieNeu-TTS/.venv/bin/python tools/voice_try.py --voice phuong --text "..." --variants '[{"speed":1.05},{"temperature":0.6}]'`
- Sync media with Google Drive: `tools/sync.sh push|pull` (rclone remote in config.json `sync.remote`).
- Word timings for motion `at` (optional, once per machine): `node tools/whisper/setup.mjs` (builds whisper.cpp into `.whisper/`).
- App (visual UI for the user): `cd app && npm start`  → http://127.0.0.1:5317 (dev with API auto-restart: `npm run dev`)
- Tests: `uv run --with pytest python -m pytest tools/tests -q`, `cd studio && npx tsc --noEmit`, `cd app && npm test && npx tsc --noEmit` (E2E: `cd app && npm run e2e`).

## Rules
1. Never invent ad facts (price, phone, dates, address, scores, results). Ask the user.
2. "từ giờ / mặc định / lần sau cũng…" -> edit `config.json`. About the current video -> edit only its `storyboard.json`.
   Ambiguous -> ask "Chỉ video này hay lưu làm mặc định?".
3. "Lưu thiết lập này làm mặc định" -> copy the resolved values from `projects/<slug>/timings.json` into `config.json`.
4. `say` = spoken text: spell numbers, prices, phone numbers and English words the way they must be read.
   `caption` = displayed text with normal spelling.
5. Aim for `config.mix` (≈60% real footage / 30% motion / 10% other). `prepare.py` prints the actual mix.
   Motion on top of footage counts as motion: prefer bands/boxes over footage (`position` top/center/bottom, or `box`)
   to cutting to a pure-motion page. Write one scene per spoken idea (several `media` in it) so the voice is not split mid-thought.
   Time key motion on the voice with `at`/`until` (a word of `say` or `caption`) instead of guessing seconds; use the
   video-wide track (top-level `motion`) for things that span scenes. Full layer reference: spec "Storyboard format".
6. Motion graphics: reuse `studio/src/motion/*`, or write a new `studio/src/motion/<Name>.tsx` exporting `<Name>` and
   `<Name>Schema` (zod via the helpers in `motion/schema.ts`, Vietnamese `title`s), and register it in `registry.ts` with
   `defineMotion`. Draw content only (use `brand` colors, `layerSeconds` if it needs its length); placement, enter/exit,
   keyframes and colors come from the layer. Be creative per video: a new component is fine when the built-ins don't fit.
7. Before every draft: render one still per scene and look at it (overflow, covered faces, wrong shot, mix).
8. Never overwrite a render: use the next `reel-v<N>`. Commit `storyboard.json` when the user accepts a version.
9. `VieNeu-TTS/` is upstream code: never edit it.
10. When the app is running, tell the user to check the result in the app (Editor / Bản render) instead of describing frames.
