# create-video — rules for Claude

Course-promo videos: student footage + VieNeu-TTS voice + Remotion motion graphics. Vertical 1080x1920 by default;
template `explainer` may be landscape 1920x1080 (one format per video, storyboard `video`).
Spec: docs/superpowers/specs/2026-11-18-reel-pipeline-design.md. Talk to the user in Vietnamese.
Start a reel with the `/make-reel` skill.

## Commands (run from repo root)
- Ingest: `python3 tools/ingest.py`. Then describe each new file in `library/media-index.json`
  (description, tags, goodRanges) by viewing `library/thumbs/<name>.jpg`; more than 5 files -> delegate to a subagent.
- Usage (least-used first): `python3 tools/usage.py` (media); `python3 tools/usage.py --motion` (motion component/variant + last project's combo).
- Prepare: `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>`
- Still: `cd studio && npx remotion still Reel ../projects/<slug>/preview/<id>.png --frame=<n> --props=../projects/<slug>/render-props.json`
- Render: `cd studio && npx remotion render Reel ../projects/<slug>/reel-v<N>.mp4 --props=../projects/<slug>/render-props.json`
  (skips the app's audio peak limiter: renders for the client go through the app, Editor -> Render.)
- Preview UI for the user: `cd studio && npx remotion studio`
- Voice audition: `VieNeu-TTS/.venv/bin/python tools/voice_try.py --voice phuong --text "..." --variants '[{"speed":1.05},{"temperature":0.6}]'`
- Sync media with Google Drive: `tools/sync.sh push|pull` (rclone remote in config.json `sync.remote`).
- Word timings for motion `at` (optional, once per machine): `node tools/whisper/setup.mjs` (builds whisper.cpp into `.whisper/`).
- App (visual UI for the user): `cd app && npm start`  → http://127.0.0.1:5317 (dev with API auto-restart: `npm run dev`)
  Or from repo root: `make app` / `make restart` (kills whatever holds ports 5316/5317, then starts dev) / `make stop` / `make test` / `make push|pull|sync` (Drive, `ARGS=--dry-run` to preview).
- Tests: `uv run --with pytest python -m pytest tools/tests -q`, `cd studio && npx tsc --noEmit`, `cd app && npm test && npx tsc --noEmit` (E2E: `cd app && npm run e2e`, `cd app && npm run e2e:chat`).

## Rules
1. Never invent ad facts (price, phone, dates, address, scores, results). Ask the user. Use only facts marked confirmed in
   `brands/<brand>/facts.md`. When the user states a new ad fact in any session, append or update it there right away
   (confirmed, source: user, date) and say so in one line.
2. "từ giờ / mặc định / lần sau cũng…" -> edit `config.json` ("từ giờ video <template>…" -> `config.json` `templates.<template>`). About the current video -> edit only its `storyboard.json`.
   Ambiguous -> ask "Chỉ video này hay lưu làm mặc định?".
3. "Lưu thiết lập này làm mặc định" -> copy the resolved values from `projects/<slug>/timings.json` into `config.json`.
4. `say` = spoken text: spell numbers, prices, phone numbers and English words the way they must be read.
   `caption` = displayed text with normal spelling.
5. Real footage is the backbone; motion explains on top of it or beside it (no numeric target). Keep pure-motion pages
   short, only for what footage can't show, and log the missing shot in `brands/<brand>/wishlist.md`.
   Write one scene per spoken idea (several `media` in it) so the voice is not split mid-thought.
   Time key motion on the voice with `at`/`until` (a word of `say` or `caption`) instead of guessing seconds; use the
   video-wide track (top-level `motion`) for things that span scenes. Full layer reference: spec "Storyboard format".
6. Motion graphics: reuse `studio/src/motion/*`, or write a new `studio/src/motion/<Name>.tsx` exporting `<Name>` and
   `<Name>Schema` (zod via the helpers in `motion/schema.ts`, Vietnamese `title`s), and register it in `registry.ts` with
   `defineMotion`. Draw content only (use `brand` colors, `layerSeconds` if it needs its length); placement, enter/exit,
   keyframes and colors come from the layer. Be creative per video: a new component is fine when the built-ins don't fit.
   Template `explainer`: write new components each video under `studio/src/videos/<slug>/` (see its README); the
   style bar is `docs/style/explainer.md`.
7. Before every draft: render one still per scene and look at it (overflow, covered faces, wrong shot), then get a fresh
   `worker-sonnet` expert review of the storyboard + still sheet against `docs/style/expert-review.md` and fix its findings.
   Landscape videos use `--platform youtube` / `--safe youtube` below instead of tiktok.
   After every render: `python3 .claude/skills/ffmpeg-skill/scripts/check.py <mp4> --platform tiktok` and
   `python3 .claude/skills/ffmpeg-skill/scripts/look.py <mp4> --safe tiktok -o projects/<slug>/preview/safe.png`;
   look at the sheet and report FAILs and text/CTA inside the shaded (platform UI) zones.
8. Never overwrite a render: use the next `reel-v<N>`. Commit `storyboard.json` when the user accepts a version.
9. `VieNeu-TTS/` is upstream code: never edit it.
10. When the app is running, tell the user to check the result in the app (Editor / Bản render) instead of describing frames.
11. Learning files: append on the spot when the user says something that belongs there, and say so in one line:
   `brands/<brand>/taste.md` (praise/rejections), `brands/<brand>/pronounce.md` (TTS fixes), `docs/style/concepts.md`
   (visual concepts + verdict), `brands/<brand>/wishlist.md` (missing shots). Read them all at the start of `/make-reel`.
