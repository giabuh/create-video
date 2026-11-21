# Story videos + render QA (design)

## Goal

Add a second video type next to the course-promo reel: a **story / explainer short** in the style of the reference
video analysed on 2026-11-21 (narrated story, fast text cards, words revealed on the voice, boxes and highlights on
real pictures, counters and charts, RGB glitch, a sound effect on almost every visual event, music dropping out for
emphasis, a final impact). It covers both stories about the centre/students (real footage from `library/`) and
knowledge/news topics (text cards, charts, screenshots the user supplies), in one shared style.
Along the way, fix two delivery problems found by `ffmpeg-skill` on `reel-v4` (true peak, safe-zone check).

## Decisions

- Renderer: **Remotion**, as a new template `story` in the existing pipeline (same storyboard, VieNeu voice, SFX,
  ducking, app). HyperFrames (pilot on branch `hyperframes-pilot`) is not used; its registry may inspire components,
  rewritten in Remotion.
- Format: 9:16, 1080x1920, 30–60 s, Vietnamese VieNeu voice (same as reels).
- Course-promo reels must sound and look exactly as before: every new behaviour defaults to off and is turned on by
  the `story` template defaults (or explicitly by the user).
- Content sourcing per video (user picks; default B): A user writes the script with facts; B user gives sources
  (links, documents, student stories), Claude writes the script; C Claude researches the web and cites. Stories about
  the centre or its students are never researched: always ask the user.
- Pictures that are not centre footage: motion graphics drawn in code, plus images/screenshots the user supplies.
  No AI-generated images in this spec. Never build a fake screenshot of a real publication (its name, logo, layout);
  use the user's real screenshot or a generic headline card with its own design.
- `ffmpeg-skill` (kajisho5, v4.3.0 @1cc736f, project scope in `.claude/skills/ffmpeg-skill/`, description narrowed to
  QA/analysis) is used for checks only: `check.py`, `look.py --safe`, `loudness.py`, `scenes.py`/`probe.py` for
  reference videos. Its `scenes.py --beats` reported `usable: false` on the voice-heavy reference; do not rely on it.

## Build order (each part gets its own plan)

1. Render QA (small, helps current reels at once).
2. Sound upgrades (used by both video types).
3. Template `story` + new effects and components.
4. Script workflow in `/make-reel`.

## Part 1: render QA

### 1a. True-peak limit on render
- Measured on `projects/2026-11-20-demo-card-moi/reel-v4.mp4`: −13.8 LUFS (ok), true peak −0.08 dBTP (fails the
  ≤ −1 dBTP platform spec; platforms re-encode and can clip).
- In `app/server/render.ts`, after Remotion has written `<name>.tmp.mp4` and before the rename to `<name>.mp4`, run
  ffmpeg once: video stream copied, audio through a peak limiter at −1.5 dBFS (0.5 dB margin because the limiter acts
  on sample peaks, not true peaks), re-encoded AAC at the same sample rate and channels. Integrated loudness is not
  changed.
- Applies to the app render path only (both single and chunked renders, after the chunks are combined).
  CLAUDE.md notes: renders delivered to the client go through the app; the raw `npx remotion render` command skips it.
- Errors: ffmpeg failure fails the render job, removes the temp files, no `reel-v<N>` is created.
- Test: unit test for the ffmpeg argument builder; one real render then `check.py --platform tiktok` must report
  true peak ≤ −1 dBTP.

### 1b. Delivery and safe-zone check
- CLAUDE.md rule 7 and `/make-reel` step 6 gain a post-render step:
  `python3 .claude/skills/ffmpeg-skill/scripts/check.py <mp4> --platform tiktok` and
  `python3 .claude/skills/ffmpeg-skill/scripts/look.py <mp4> --safe tiktok -o <project>/preview/safe.png`, then look
  at the sheet. Report FAILs and elements inside the shaded zones to the user.
- Docs/skill only, no code. Layout problems the sheet shows (on `reel-v4`: bottom captions, phone number and CTA card
  sit in TikTok's bottom UI zone; right-side buttons cover card edges) are reported, not auto-fixed here.

## Part 2: sound upgrades

### 2a. Per-template config layer
- `config.json` gains `templates.<template>`; resolution order becomes `config.json` → `config.templates.<template>`
  → `config.voices.<voice>` → brand → storyboard top level → scene. Deep merge, same as the other layers.
- "từ giờ video story…" edits `config.templates.story` (CLAUDE.md rule 2 updated).

### 2b. SFX on hard cuts and clip changes
- Two new automatic events in `tools/reel/props.py` `_sfx_events`: `sfx.cut` at the start of a scene whose transition
  is `cut` (not the first scene), and `sfx.media` at each clip change inside a scene (not the first clip).
- Both default to `"none"` in `config.json`. Aligned like other events (file peak on the change), subject to `minGap`.
- `templates.story` sets `sfx: {cut: "whoosh", media: "click", minGap: 0.4, cta: "impact"}` (final values tuned on
  the demo render).

### 2c. Music drop on words (`musicDrop`)
- Storyboard top level: `"musicDrop": [{"start": {"scene": "s5", "at": "lý do"}, "end": {"scene": "s6", "at": "tin tưởng"}, "to": 0}]`;
  `start`/`end` use the same time format as the video-wide motion track (seconds, `"video"`, or
  `{scene, at?, offset?, edge?}`); `to` is the music volume during the drop (default 0).
- Music ramps to `to` over 0.15 s at `at` and back to its normal (ducked) level over 0.15 s at `until`.
  Computed in `studio/src/components/duck.ts` (pure, unit-tested); resolved times passed in render props.
- Errors: an unresolvable word raises `AnchorError` (same message style as motion anchors).

### 2d. Counter tick
- An SFX event may carry `until` (absolute seconds): the template stops the file there with a 0.1 s fade.
- `templates.story` maps `sfx.motion.CountUp` to group `tick` (one long counter-roll file); the event's `until` is
  the layer end, so the tick lasts exactly as long as the count.

### 2e. New SFX files
- New groups `impact-*` (boom/hit, 3–4 files) and `tick-*` (counter roll, 3–4 files) from Mixkit (same licence as the
  current files). Claude lists the candidates for the user to approve before downloading; add them to
  `sfx/SOURCES.md`. Synced via Drive like the rest of `sfx/`.

### Tests
- `tools/tests`: cut/media events, `minGap` with them, `until`, template layer resolution, `musicDrop` anchor
  resolution and errors. `duck.ts` unit test for drops. One short render to listen to.

## Part 3: template `story`

### 3a. Template
- `studio/src/templates/story/Story.tsx`, registered in `templates/index.ts`.
- The scene/media/motion/sfx/music/CTA skeleton now in `FastCut.tsx` moves to a shared component; each template passes
  its style (captions renderer, background, look, logo). `fast-cut` stills before/after the refactor must match.
- Story style:
  - Captions as **text cards**: large centred text, words revealed on the voice (word timings from `align.py`,
    estimate otherwise), no background box.
  - A scene with no `media` is a flat text-card scene; new scene field `bg: "light" | "dark"` (off-white / near-black
    from brand colours; default `dark`).
  - Whole-video **look** layer: subtle grain + scan lines, `templates.story.look: {grain, scanlines}` (on/off, strength).
  - Logo off by default.

### 3b. Text effects (all text components, both templates)
- `blur-in`: big blurred text sharpening into place.
- `glitch`: RGB split with small jitter.
Added to `studio/src/motion/fx/textFx.ts`.

### 3c. Media effect
- `glitch` added to media `Effect` (next to zoom/pan): RGB split on a photo or clip, in `MediaShot`. App's
  `app/shared` `Effect` type updated to match.

### 3d. New components
- `BarChart`: labelled bars (optional logo image), values grow in, optional rank swap.
- `LineChart`: lines draw in, label at each line end.
- Both have a required `source` field shown as a small "Nguồn: …" line. Zod schemas with Vietnamese titles,
  registered with `defineMotion`; draw content only.

### 3e. Reused as is
- Word reveal: `textFx` `word`/`words`/`typewriter`. Highlight and boxes on screenshots or faces: `Annotate`
  (`highlight`, `box`) moved with layer keyframes. Name labels: `PinLabel`. Counters: `CountUp`. Screenshots: ingest
  into `library/`, show with `Picture` + zoom-in.

### Tests
- `cd studio && npx tsc --noEmit`, schema/registry tests for the new components, one still per new component/effect,
  `fast-cut` before/after stills. A ~30 s demo story video with 2–3 scenes of each kind for the user to review.

## Part 4: script workflow in `/make-reel`

- Brief asks the video type: course promo (`fast-cut`) or story (`story`). For story, ask sourcing A/B/C (default B).
- Storyboard top level `sources: [{id, title, url?, note?}]`; scene `sources: ["s1", …]`.
- For the `story` template `prepare.py` errors when a scene's `say`, `caption` or chart data contains a digit and the
  scene has no `sources` key, or when a source id is unknown. `"sources": []` is an explicit opt-out for numbers that
  are not facts ("khóa 3 tháng", "bước 1").
- Script approval (story only): before `prepare.py`, show a table (cảnh | lời đọc | chữ trên màn hình | nguồn) and wait
  for the user's OK.
- Story writing guide in the skill: hook in the first 2 s; one idea per scene, short sentences; punchline on a
  `blur-in` text card; `musicDrop` on the turn of the story; `impact` SFX on the key reveal; numbers via `CountUp` or
  charts with sources; ending CTA (follow the page or a related course).
- Post-render QA step from 1b.

## Out of scope

- AI image generation, AI video, avatars.
- Beat-synced cutting (the reference does not cut on the beat; 1/18 cuts within 70 ms of a beat).
- Automatic face tracking (boxes are placed by Claude from stills with keyframes).
- Auto-fixing safe-zone layout of existing reels.
- HyperFrames integration.

## Done

- Part 1: app render of `reel-v5` passes `check.py --platform tiktok` true peak; CLAUDE.md and skill updated.
- Part 2: tests pass; a course-promo reel re-rendered sounds the same as before; the demo story has SFX on cuts,
  a music drop and an ending impact.
- Part 3: tsc + tests pass; `fast-cut` stills unchanged; demo story rendered.
- Part 4: `/make-reel` makes a story video end to end with sources and script approval; `prepare.py` source errors
  covered by tests.
