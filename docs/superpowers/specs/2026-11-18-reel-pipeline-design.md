# Reel Pipeline (Sub-project 1: Engine) — Design

Date: 2026-11-18
Status: approved in brainstorming, pending written-spec review

## Goal

Produce vertical course-promotion reels (Facebook/TikTok/Shorts, 9:16, ~15–60 s) from real photos/videos of students, with a Vietnamese voice-over from VieNeu-TTS, animated captions, optional background music and a call-to-action end card. Claude (Claude Code CLI, run in `/home/giabao/dev/create-video`) drives the whole pipeline; the user talks to Claude in natural language.

## Sub-project roadmap

1. **Engine (this spec):** media ingest, storyboard, layered config, TTS, Remotion template, render.
2. **App (next spec):** local web UI that reads/writes the engine's files (see "File contract") to browse projects, play renders, edit storyboards/config, audition voices, manage library/templates/brands. Live-updates when files change. No Claude calls.
3. **In-app Claude chat (later spec):** the app runs the local `claude` CLI headless in this folder under the user's own login. Personal single-user use only. Decided 2026-11-19: build the `claude` backend first (A), then add a `codex exec --json` backend (B) behind the same runner interface. Multiple Claude accounts: the user runs `claude`, `claude2`, `claude3` (bashrc `_claude_acc` = same binary with `CLAUDE_CONFIG_DIR=~/.claude-accN`, `projects/` symlinked so transcripts are shared); the app picks an account per chat by setting `CLAUDE_CONFIG_DIR`, so a chat can be resumed on another account when one hits its limit.

## Decisions

- **Remotion is the renderer; pure-FFmpeg pipeline rejected** (text animation and reusable templates are too painful in `drawtext`).
- **Do not clone the Remotion monorepo.** Scaffold a project with `npx create-video@latest` into `studio/`, then install the official Remotion agent skills (`npx skills add remotion-dev/skills`).
- **System FFmpeg 8 (already installed) is used for prep only:** media normalization, frame contact sheets, voice reference trimming, speed change (`atempo`), duration probing. Remotion v4 renders with its own bundled FFmpeg.
- **VieNeu-TTS stays untouched upstream code, as a git submodule** pinned at `22dd2ef` (https://github.com/pnnbao97/VieNeu-TTS). Our scripts run with its interpreter: `VieNeu-TTS/.venv/bin/python`. Model: v3 Turbo on CUDA (RTX 5060 Ti 16 GB). On a machine without an NVIDIA GPU, `Vieneu()` falls back to ONNX on CPU automatically: slower, same API.
- **Voices:** two cloned voices, `phuong` and `vy`, from the Speechma samples (~9 s each). v3 cloning needs only `ref_audio` (no transcript).
  - Active references (user's pick): `voices/phuong-short.wav` and `voices/vy-short.wav` (~6 s, cut at pauses).
  - The `*-full.wav` cuts (~7.5 s) are kept as alternatives, selectable via `config.voices.<name>.ref`.
  - All four reference wavs are committed so every machine has the same voices.
- **Two authoring modes, one storyboard format:** Mode A (most common): Claude writes the script and picks the shots. Mode B: the user dictates the script/shots, and Claude transcribes it into the storyboard faithfully.
- **Multiple templates and brands are supported as folders**; v1 ships one template (`fast-cut`) and one sample brand.
- **Creative mix, not a fixed layout.** By screen time the target is ~60 % real footage, ~30 % Remotion-generated motion graphics, ~10 % the rest (CTA, logo, transitions). The target lives in `config.json` (`mix`).
  - Every scene is a stack of layers: an optional `media` layer (student footage/photos) plus optional `motion` layers (generated graphics). That gives pure-footage scenes, footage with graphics on top, and pure motion scenes.
  - Motion components live in `studio/src/motion/`. **Claude may write new motion components freely for any video**; components the user likes are kept and reused.
  - A template only defines style (fonts, colors, caption look, transitions, pacing), not layout.
- **Portable via GitHub (private repo):** clone on another Linux machine, run `./setup.sh`, then `tools/sync.sh pull` to fetch media from Google Drive.
- **Music:** from `music/` (user-supplied royalty-free tracks, filenames hint at mood); `music: null` renders without music.
- **Landscape media in 9:16:** centered, with a blurred, scaled-up copy of itself filling the background (never crop students out).
- **Font:** Be Vietnam Pro (full Vietnamese diacritics), bundled in `studio/src/assets/fonts/be-vietnam-pro/` (woff2, latin + latin-ext + vietnamese subsets, SIL OFL 1.1) and loaded with `@remotion/fonts`, so renders and the app work offline. (Was `@remotion/google-fonts`, which fetched at render time and timed out without internet.) The app UI uses the same files via `app/src/ui/fonts.css`.
- **Never invent facts in ad copy:** price, phone, dates, address. If missing, Claude asks.

## Directory layout

```
create-video/
├── VieNeu-TTS/              # git submodule (upstream, untouched; .venv ignored)
├── setup.sh                 # one-shot setup on a fresh clone
├── config.json              # global layered defaults (committed)
├── CLAUDE.md                # workflow rules for Claude
├── .claude/skills/make-reel/SKILL.md   # /make-reel workflow skill
├── inbox/                   # user drops new media here (ignored)
├── library/                 # normalized media + thumbs (ignored)
│   ├── media-index.json     # cached per-file descriptions (ignored with library; app reads it)
│   └── thumbs/<file>.jpg    # 6-frame contact sheet per clip
├── music/                   # background tracks (ignored)
├── voices/                  # <name>-short/full.wav references (committed), tries/ (ignored)
├── brands/<brand>/brand.json + logo.png
├── reference/               # sample reels from the user (ignored)
├── studio/                  # Remotion project
│   ├── src/templates/<template>/   # one folder per template (style only)
│   └── src/motion/          # motion-graphics components (growing library)
├── tools/
│   ├── ingest.py            # inbox → library (+ thumbs)
│   ├── make_smoke_media.sh  # throwaway test media for tests and projects/_smoke
│   ├── prepare.py           # validate + resolve config + TTS + write render-props.json
│   ├── voice_try.py         # audition variants of a voice
│   └── sync.sh              # push/pull media to Google Drive (rclone)
└── projects/<YYYY-MM-DD-slug>/
    ├── storyboard.json      # committed
    ├── audio/<scene-id>-<hash>.wav   # TTS cache (ignored)
    ├── timings.json         # per-scene durations + resolved TTS params
    ├── render-props.json    # fully resolved input for Remotion
    ├── preview/             # stills for self-check (ignored)
    └── reel-v<N>.mp4        # versioned renders (ignored)
```

How Remotion reads files outside `studio/`: `studio/public/` contains symlinks `library`, `music`, `brands`, `projects` pointing at the root folders, and the template uses `staticFile()`. Verified in the 2026-11-18 spike: relative symlinks in `public/` resolve for both `remotion render` and `remotion still` (the Studio preview was not tested).

## Layered config

Resolution order (later wins): `config.json` → `config.templates.<template>` → `config.voices.<voice>` → brand `brand.json` (visual fields only) → storyboard top level → scene.

```jsonc
// config.json
{
  "defaults": { "voice": "phuong", "template": "fast-cut", "brand": "demo" },
  "tts": {
    "temperature": 0.8, "top_k": 25, "top_p": 0.95,
    "repetition_penalty": 1.2, "max_chars": 256, "batch_size": 16,
    "silence_p": 0.15, "denoise": true,
    "speed": 1.0,        // applied after TTS with ffmpeg atempo (VieNeu has no speed param)
    "pauseAfter": 0.3,   // seconds of silence after each spoken scene
    "trimSilence": true, // cut the silence VieNeu leaves at both ends of a take (keeps 40 ms / 80 ms)
    "loudness": -16      // LUFS every take is normalized to (two-pass loudnorm, linear); null = off
  },
  "voices": {
    "phuong": { "ref": "voices/phuong-short.wav" },
    "vy":     { "ref": "voices/vy-short.wav" }
  },
  "mix":      { "real": 0.6, "motion": 0.3, "other": 0.1 },   // target share of screen time
  "sync":     { "remote": "video-syn:create-video" },            // rclone remote:path
  "video":    { "fps": 30, "width": 1080, "height": 1920 },
  "music":    { "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5 },
  "captions": { "font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF",
                "highlightColor": "#FFD400", "maxWords": 6 }
}
```

TTS keys map 1:1 onto `Vieneu` v3 Turbo `infer()` kwargs (`src/vieneu/v3turbo.py:600`), except `speed`, `pauseAfter`, `trimSilence` and `loudness`, which are ours (post-processing in `tools/reel/tts.py`). Because they are part of the resolved TTS params they are part of the cache key: changing them re-synthesizes.

**Rule for Claude (written into CLAUDE.md):**
- "từ giờ / mặc định / lần sau cũng…" → edit `config.json`.
- An instruction about the current video → edit only `storyboard.json`.
- Ambiguous → ask once: "chỉ video này hay lưu mặc định?"
- "Lưu thiết lập này làm mặc định" → copy resolved values from `timings.json` into `config.json`.

## Storyboard format

```jsonc
{
  "template": "fast-cut", "brand": "demo", "voice": "phuong", // optional overrides
  "tts": { "speed": 1.05 },                                         // optional overrides
  "music": { "file": "soi-dong-1.mp3", "volume": 0.25 },           // or null
  "targetSeconds": 30,
  "scenes": [
    {
      "id": "s1",
      "say": "Chỉ chín trăm chín mươi chín nghìn cho cả khóa",  // spoken (phonetic for numbers/English)
      "caption": "Chỉ 999K cho cả khóa",                        // displayed
      "voice": "vy", "tts": { "temperature": 0.7 },             // optional per-scene overrides
      "highlight": ["999K"],
      "overlay": { "text": "GIẢM 50%", "position": "top" },
      "media": [
        { "src": "clip012.mp4", "from": 3.2, "effect": "zoom-in" },
        { "src": "anh-lop-05.jpg", "effect": "pan-left" }
      ],
      "motion": [                                                // graphics on top of the footage
        { "component": "CountUp", "props": { "from": 5.5, "to": 7.5, "label": "IELTS" }, "start": 0.5 }
      ],
      "transition": "slide",
      "pauseAfter": 0.3
    },
    { "id": "s2", "duration": 2, "media": [ { "src": "clip003.mp4" } ] },  // silent b-roll scene
    { "id": "s3", "say": "Lộ trình ba bước rõ ràng", "caption": "Lộ trình 3 bước",  // pure motion scene
      "motion": [ { "component": "Checklist", "props": { "items": ["Kiểm tra đầu vào", "Học 1 kèm 1", "Thi thử hằng tuần"] } } ] }
  ],
  "cta": { "title": "Đăng ký ngay", "phone": "…", "duration": 3 }
}
```

- `say` and `caption` are separate because TTS needs numbers, prices, phones and English names spelled phonetically, while captions show the normal spelling.
- Scene length is the spoken audio length plus `pauseAfter`, or `duration` for silent scenes. Several media in one scene split the time evenly unless one has an explicit `duration`.
- `media[].src` is relative to `library/`. `effect` ∈ {`none`, `zoom-in`, `zoom-out`, `pan-left`, `pan-right`}; `transition` ∈ {`cut`, `fade`, `slide`}. `transition` = how the scene enters, `mediaTransition` = between clips inside the scene; both default to `config.transition` (`scene`/`media`, length `duration` s, shipped as `fade` 0.4). Fade is a real crossfade: the outgoing picture keeps running under the incoming one; captions, motion and voice still end at the scene boundary. New effects are added to the template code and become new enum values.
- `motion[]`: `component` is a file name in `studio/src/motion/`; `props` are its typed props; `start`/`duration` (seconds, relative to the scene) are optional and default to the whole scene. A scene with `motion` but no `media` is a pure motion scene, drawn on the brand background.
  - Every layer (scene or video track) also takes, all optional:
    - **Placement:** `position` ∈ {`full` (default: the component lays itself out on the whole frame), `top`, `center`, `bottom` (preset bands, fractions of the height: top 0.09–0.42, center 0.30–0.70, bottom 0.46–0.72, above the captions), `free`}; `box: {x, y, w, h}` in percent of the frame (x/y = top-left; giving a box implies `free`); `scale` (0.3–2), `rotate` (degrees), `opacity` (0–1).
    - **Backdrop:** `backdrop` ∈ {`auto` (default: a dark scrim behind a band/box when there is footage under it), `scrim`, `none`}; the scrim eases in over ≥ 0.4 s so no empty panel shows before the content.
    - **Enter/exit:** `enter`/`exit` = a name or `{type, duration}`; names: `none`, `fade`, `slide-up|down|left|right`, `pop`, `zoom`, `wipe`, `blur`. Default enter `none` (the component's own animation); default exit `fade` 0.25 s for bands/boxes, `none` for full-frame.
    - **Keyframes:** `keyframes: [{t, x?, y?, scale?, rotate?, opacity?}]` — `t` seconds from the layer start, `x`/`y` offsets in percent of the frame, `scale`/`rotate`/`opacity` multiply/add to the layer's values; eased (in-out cubic) between keys.
    - **Colors:** `colors: {primary?, accent?, text?, background?, accent2?, surface?}` overrides the brand for this layer only.
  - **Timing on the voice (scene layers):** `at` = a word/phrase (or `{word, occurrence?, offset?}`) — the layer starts when it is spoken; `until` = same, the layer ends when that word ends. Words are looked up in `say`; a phrase only in `caption` (e.g. `999K` read as "chín trăm chín mươi chín nghìn") is placed between its matched neighbours. Unknown words are reported by `prepare.py` (stage `anchor`) and nothing renders.
  - **Video-wide track:** top-level `motion: [...]` — layers that run across scenes and draw on top of everything (progress bar, sticker, a line bridging two scenes). `start` = seconds or `{scene, at?, offset?, edge?}` (default 0); `end` = seconds, `"video"` (end incl. CTA), or `{scene, at?, offset?, edge?}` (scene default edge `end`); or `duration`; default = end of the last scene. Not counted in the mix.
  - Prefer bands/boxes over footage for text/price/checklist moments; keep `full` for pure motion scenes and for components that carry their own panel (`LowerThird`).
- Mix accounting: a motion-only scene counts as `motion`; in a scene with `media`, the time covered by its motion layers (union of their spans) counts as `motion` and the rest as `real`; the CTA counts as `other`; the video-wide track is not counted. (The app's top bar computes the same in `editorState.ts mixOf`.) `prepare.py` prints the actual mix against `config.mix`.
- Captions (`tools/reel/captions.py`) are split at punctuation first (`, . ; : ! ? …` and standalone dashes), then each phrase into the fewest chunks of ≤ `captions.maxWords` words, cut where it reads best: never inside a known two-word term (`VI_COMPOUNDS`: tin học, khai giảng, học viên…), not right after a function word (và, của, cho…), sizes as even as possible; a 1–2 word chunk joins a neighbour that still fits. Each chunk starts when its first word is spoken (word timings from align.py — whisper or the estimate; caption-only tokens such as `999K` are placed between their spoken neighbours). The template measures each chunk with the real font (`@remotion/layout-utils`, `studio/src/fit.ts`) and shrinks it to fit two lines.
- **Sound effects (SFX)** — files in repo-root `sfx/` (gitignored, synced like `music/`, served to Remotion via the `studio/public/sfx` symlink, managed in the app's Library tab "Hiệu ứng âm thanh"). A file's *group* is its name prefix before the first `-` (`whoosh`, `impact`, `ting`, `sparkle`, `pop`, `click`; any other prefix is its own group). Added automatically by type, from `config.json` `sfx`:
  ```json
  "sfx": { "volume": 0.5, "minGap": 0.8, "scene": "whoosh", "cta": "impact",
           "motion": { "default": "pop", "Text": "ting", "KineticText": "ting", "PriceTag": "ting", "CountUp": "ting",
                       "DateBadge": "pop", "Picture": "pop", "Annotate": "pop", "LowerThird": "click", "Checklist": "click", "ProgressBar": "click",
                       "Ribbon": "whoosh", "TwoTier": "whoosh", "Callout": "click", "PinLabel": "pop", "GlossyPill": "ting", "GiantText": "whoosh" } }
  ```
  - Events: a scene whose `transition` is not `cut` gets `sfx.scene` (not the first scene), placed so the file's loudest moment (measured by `prepare.py` with librosa, capped at 1 s; fallback 0.15 s) lands on the scene start (clamped at 0); every event is aligned the same way, so a slow-swelling whoosh starts early and a ting starts on its hit; every motion layer (scene layers and the video-wide track) gets `sfx.motion[component]` (else `sfx.motion.default`) at its start; the CTA gets `sfx.cta` at its start. A hard cut into a scene (`transition` `cut`, not the first scene) gets `sfx.cut` and every clip change inside a scene gets `sfx.media`, both aligned like the others (no peak known: lead 0); both default to `"none"`.
  - A value is a group name (the file is picked in rotation through that group's files, sorted by name, so repeated events vary), an exact file name in `sfx/`, or `"none"`/`null` (no sound).
  - Overrides: motion layer `sfx` (same value kinds) and scene `sfx` (the scene-transition sound); storyboard top-level `sfx` deep-merges over `config.sfx`, and `"sfx": null` turns all SFX off for that video.
  - Breathing room: an *automatic* event closer than `minGap` seconds to the previous kept event is dropped; explicitly set ones (a layer's or scene's own `sfx`) always play. A group with no files left (the user deleted them) just plays nothing; `prepare.py` warns.
  - Render props: top-level `sfx: [{src: "sfx/<file>", start: <absolute s>, volume}]`; the template plays each as `<Audio>` in a `<Sequence from=start>`. Music ducking ignores SFX.
- Music ducks to `duckTo` while a spoken scene plays and fades out over `fadeOut` at the end. Gaps between two voice clips shorter than 1 s stay ducked (no swell at every scene change); it ramps back up only for longer silent stretches. All of this is computed in Remotion from known timings (`studio/src/components/duck.ts`), with no FFmpeg sidechain.

## Components

### `tools/ingest.py`
For each file in `inbox/`:
- Video → H.264, yuv420p, SDR (tonemap if HDR), constant 30 fps, rotation baked in, AAC audio, written into `library/`.
- Photo (incl. HEIC) → JPG with EXIF rotation applied.

It also writes `library/thumbs/<file>.jpg` (6-frame grid for clips, a resized copy for photos) and moves the original to `inbox/_done/` only after success. It does not write descriptions.

### Media index (`library/media-index.json`)
```jsonc
{ "clip012.mp4": { "type": "video", "duration": 14.2, "width": 1080, "height": 1920,
    "orientation": "portrait", "description": "học viên giơ chứng chỉ trước lớp",
    "tags": ["chứng chỉ", "vui vẻ"], "goodRanges": [[2.0, 9.5]] } }
```
Claude fills `description`/`tags`/`goodRanges` by viewing the thumbnail once per new file. Building the index for a large batch is delegated to a subagent so the main context is not flooded. Story selection afterwards reads only this index.

### `tools/prepare.py <project-dir>` (runs with `VieNeu-TTS/.venv/bin/python`)
1. Validate the storyboard: template/brand/voice exist, media files exist in `library/`, spoken scenes have non-empty `say`, ids are unique. All errors are reported at once, keyed by scene id. Exit non-zero before loading the model.
2. Resolve the layered config per scene.
3. TTS: load the model once. For each spoken scene, compute the cache key = hash(voice ref file content + `say` + all resolved TTS params incl. speed). Reuse `audio/<id>-<hash>.wav` if present, else synthesize, then post-process in one ffmpeg pass (`atempo` if speed ≠ 1, trim leading/trailing silence with a threshold 25 dB under the take's own loudness, loudness-normalize to `loudness`), and save. Failures are reported per scene; other scenes still complete.
4. Write `timings.json` (per-scene duration + resolved params) and `render-props.json` (storyboard + resolved config + brand + timings, with all paths relative to the Remotion public dir). Print the total duration vs `targetSeconds`, and the real/motion/other mix vs `config.mix`.

Validation also checks that every `motion[].component` exists in `studio/src/motion/`, and the placement/animation/anchor fields above (props themselves are checked by the component's zod schema at preview/render time).

### Word timings (`tools/reel/align.py`, `tools/whisper/`)
Only for scenes something is anchored to (`at`/`until`/track anchors). With whisper.cpp installed (`node tools/whisper/setup.mjs`, Remotion's `@remotion/install-whisper-cpp`; `config.align`: `{enabled, model: "large-v3-turbo", version: "1.9.5", language: "vi"}`; files in `.whisper/`, git-ignored), each clip is transcribed with word timestamps and the result is aligned back onto the words of `say` (difflib; unmatched runs, e.g. numbers ASR writes as digits, are spread over their gap) and cached as `audio/<id>-<key>.words.json`. Without whisper (other machines, the app's instant preview before voice exists) the words are spread over the clip by length — anchors still work, less precisely. `prepare.py` prints which source each anchored scene used. Measured in the sandbox (CPU): large-v3-turbo ≈ 20 s per 3 s clip; whisper.cpp is built for CPU by Remotion's installer.

### `tools/voice_try.py --voice <name> --text "<line>" --variants '<json list of tts overrides>'`
Writes `voices/tries/<name>-A.wav`, `-B.wav`, … plus a `tries.json` listing each variant's params, so the user can listen and say "lấy B" → Claude copies those params into `config.voices.<name>`.

### Remotion `studio/`
- One composition `Reel` (1080×1920 @ 30 fps by default). `calculateMetadata` sets `durationInFrames` from `render-props.json` timings (+ CTA duration).
- `Reel` dispatches to `src/templates/<template>/`. Each template is built from small components: `MediaShot` (cover/blur-fill, effects), `Captions` (chunking, highlight, auto-fit font size to the safe area), `Overlay`, `CtaCard`, `MusicTrack` (ducking), `VoiceTrack`.
- Motion library `src/motion/`: one file per component `<Name>.tsx` exporting `<Name>` and `<Name>Schema` (zod, built with the helpers in `motion/schema.ts`: `text`, `longText`, `lines`, `num`, `numDefault`, `color`, `bool`, `choice`, `media` — each with a Vietnamese `title`). `registry.ts` registers it with `defineMotion({component, schema, title, description})`. The schema is the single source of truth: `MotionLayer` parses the storyboard props with it (defaults applied; invalid props fail with every problem listed) and the app generates the component's form from it (`z.toJSONSchema`), so a component written for one video is editable in the app with no app code. Components receive their parsed props plus `brand` (with the layer's color overrides), `layerSeconds` and `area` (px size of the full frame/band/box they are placed in); text components (`Text`, `KineticText`, `Checklist`) shrink their font to fit `area`, measured with the real font (`fit.ts`: `fitFontSize`, `useFontsLoaded` holds the frame until the bundled fonts are ready); `MotionLayer` does placement, enter/exit, keyframes and the backdrop for every component.
  - Built in: `Text` (free text: size, weight, color, background pill, align, reveal typewriter/word-by-word), `KineticText`, `CountUp`, `Checklist`, `PriceTag`, `DateBadge`, `LowerThird`, `Annotate` (hand-drawn circle/box/underline/highlight via `@remotion/rough-notation`, around a word or the layer box), `Picture` (image/video from `library/` as a layer: logo, sticker, picture-in-picture), `ProgressBar` (fills over the layer length; for the video track). Their props are documented by their schemas (and shown in the app).
  - Choreographed cards (design: `docs/superpowers/specs/2026-11-19-text-fx-and-cards-design.md`): `Ribbon` (ribbon with a key benefit line), `TwoTier` (audience + field in two tiers), `Callout` (label with a pointer ring on `targetX`/`targetY`; label default `labelY` 18 so it never covers the ring), `PinLabel` (a place, with a pin), `GlossyPill` (glossy pill for an offer or gift), `GiantText` (one huge statement).
  - Shared schema fields: `fx` (text effect: `none, typewriter, words, pop, scramble, mask, wave`), `pace` (`fast` 0.7 / `normal` 1 / `slow` 1.4), `decor` (`none, sparkle, dot, emoji`) with `emoji`. The older cards also take `fx` (default unchanged), and `Text.reveal` now takes all 7 effects.
  - `ownsExit: true` (set in `registry.ts` by `defineMotion`): the card draws its own exit, so the layer's default exit is `none` instead of `fade`. Mirrored in `tools/reel/props.py` `OWNS_EXIT` and guarded by a test (`app/src/screens/Editor/motionSchema.test.ts`). All six new cards set it.
  - Brand colors gain optional `accent2` (default `#E11D2E`) and `surface` (default `#FFFFFF`); per-layer `colors` accepts them too.
- Video tag: `@remotion/media` `<Video>` for rendering, with `<OffthreadVideo>` while previewing in Studio (per current Remotion docs).
- Brand (`brands/<id>/brand.json`): `{ name, logo, colors: {primary, accent, text, background, accent2?, surface?}, font?, cta: {phone, fanpage, address} }`.
- Commands:
  - Render: `npx remotion render Reel <project>/reel-v<N>.mp4 --props=<project>/render-props.json`
  - Stills: `npx remotion still Reel <project>/preview/<scene>.png --frame=<mid-frame> --props=…`

## Workflow (`/make-reel`, documented in the skill and CLAUDE.md)

0. New media present in `inbox/` → run `tools/ingest.py` → index new files.
1. Brief: course, offer, length, voice, brand, music yes/no. Ask for any missing facts (price, phone, dates) rather than inventing them.
2. Create `projects/<date-slug>/storyboard.json` (Mode A: write the script and pick shots from the index; Mode B: transcribe the user's script).
3. Run `prepare.py`. If the total runs over the target, shorten `say` and rerun (only the changed scenes re-synthesize).
4. Render stills of each scene and view them to self-check for overflow, collisions and wrong shots. Then render and report the path plus a scene summary table.
5. Iterate on the user's feedback. Each render is a new `reel-v<N>.mp4`. Commit the storyboard on each accepted version so "quay lại v2" works.
6. Final render at full resolution.

Saving reusable assets by voice command: "lưu bố cục này thành template X" (copy the template folder, then register it), "tạo thương hiệu mới…" (new `brands/<id>/`), "lưu thiết lập giọng…" (update `config.json`).

## Portability (GitHub + second Linux machine)

**In git (private repo):** all code, `config.json`, `brands/`, `voices/*-short.wav` and `*-full.wav`, `projects/*/storyboard.json`, CLAUDE.md, skills, and the VieNeu-TTS submodule pointer.

**Not in git, synced via Google Drive:** `library/` (media + `media-index.json` + thumbs), `music/`, `reference/`. Approved renders go to Drive `xuat-ban/` from the app (see 2026-11-19-publish-to-drive-design.md).

**Not in git, not synced:** `.venv`, `node_modules`, the TTS audio cache, `preview/` and `inbox/`. These are rebuilt or regenerated per machine.

**`setup.sh`** (idempotent):
1. `git submodule update --init`
2. `uv sync` inside `VieNeu-TTS/`
3. `npm ci` in `studio/`
4. Create the `studio/public/` symlinks.
5. Check `ffmpeg`/`ffprobe`/`rclone`, printing install hints for anything missing.
6. Print a GPU or CPU notice.

The VieNeu model weights download on first use into the HF cache.

**`tools/sync.sh push|pull`** wraps `rclone copy` (never `rclone sync`, so a pull or push can never delete files on the other side; `pull` skips a Drive folder that does not exist yet, e.g. an empty `reference/` never pushed, instead of aborting) between the local folders and `config.sync.remote`. The one-time `rclone config` (Google Drive OAuth) is run by the user interactively on each machine.

## Deviations found during implementation
- 2026-11-19: voice post-processing (trim + loudness), music duck hold, motion placement bands, overlay-aware mix, bundled font (see the sections above).
- 2026-11-19: flexible motion layers (free box, enter/exit, keyframes, colors), schema-driven components, word-anchored timing with whisper.cpp, video-wide motion track, app layer editor with drag/resize on the preview. Demo: `projects/_motion-demo` (needs `tools/make_smoke_media.sh`).
- T6: no API deviation; `@remotion/media` `<Audio>` supports `volume` callbacks and `loop` at 4.0.544.
- T8: `tools/sync.sh pull` skips remote dirs missing on Drive (rclone exit 3) instead of aborting.

## Error handling

| Case | Handling |
|---|---|
| Invalid storyboard | `prepare.py` lists all problems by scene id before loading the model |
| TTS fails on one scene | Report that scene; the cache keeps the others |
| Odd media (HEVC/HDR/VFR/rotated/HEIC) | Normalized at ingest; templates only read `library/` |
| Caption too long | Template auto-shrinks to the safe area; Claude verifies via stills |
| Over target length | Claude shortens copy before rendering |
| Missing ad facts | Ask the user; never invent |
| `rclone` remote missing/unauthorized | `sync.sh` stops with the `rclone config` hint; nothing is deleted locally or remotely |
| Chrome headless shared libs missing | Install the Ubuntu deps listed in the Remotion docs (first-render check) |

## File contract (for sub-project 2, the App)

The App reads and writes only these files, whose schemas are defined above: `config.json`, `brands/*/brand.json`, `library/media-index.json`, `library/thumbs/*`, `projects/*/storyboard.json`, `projects/*/timings.json`, `projects/*/reel-v*.mp4`, `voices/*.wav`, `voices/tries/*`. Engine scripts must keep these schemas stable. Any change must be noted in this spec.

Schemas not shown above (as emitted by the engine):
```jsonc
// projects/<slug>/timings.json — written by prepare.py; git-ignored, regenerate with prepare.py (cached audio makes it instant)
{ "scenes": { "s1": { "duration": 2.4, "pauseAfter": 0.3, "voice": "phuong", "ref": "voices/phuong-short.wav",
                      "tts": { "temperature": 0.8, "top_k": 25, "...": "...", "speed": 1.0 }, "cacheKey": "a1b2c3d4e5f6" },
              "s3": { "duration": 2.0 } },          // silent scene: duration only
  "totalSeconds": 13.02, "mix": { "real": 0.62, "motion": 0.15, "other": 0.23 } }
// voices/tries/tries.json — written by voice_try.py (overwritten each run)
{ "voice": "phuong", "text": "…", "variants": { "A": { "file": "voices/tries/phuong-A.wav", "ref": "voices/phuong-short.wav",
                                                    "tts": { "...": "..." }, "seconds": 1.52 } } }
```
`projects/*/render-props.json` is also git-ignored and regenerated; its shape is `studio/src/types.ts` `RenderProps`.

Added by sub-project 2 (see `2026-11-18-reel-app-design.md`):
- `projects/<slug>/project.json` — `{ "approved": "reel-v2" | null, "renders": { "<version>": { "kind": "draft"|"final", "at": "<ISO>" } } }`, written by the app; absent = nothing approved.
- `projects/<slug>/reel-vN.storyboard.json` — copy of `storyboard.json` taken when `reel-vN.mp4` is rendered.
- `inbox/` — upload target for the app; consumed by `ingest.py`.
- `tools/worker.py` + `tools/reel/pipeline.py` — `prepare()` / `try_variants()` extracted from the CLIs (CLI behaviour unchanged); `prepare(synth=False)` writes `render-props.json` without touching `timings.json`.

## Testing

- `prepare.py`: pytest for storyboard validation, config layer resolution and cache-key stability (pure functions; the TTS model is not tested).
- `studio/`: `tsc --noEmit`, plus rendering stills from a 3-scene fixture storyboard.
- Voice, symlink and Chrome feasibility were already proven by the spike (see below).
- Portability check: fresh `git clone --recursive` into a temp dir, then `./setup.sh`, `prepare.py` and a render of the fixture storyboard succeed with no manual steps besides `rclone config`.

## Out of scope for v1

Word-level karaoke captions (Whisper alignment), auto-posting to social platforms, a second template, the App (sub-project 2) and in-app chat (sub-project 3).

## Spike results (2026-11-18)

- **VieNeu v3 Turbo cloning works with `ref_audio` only.** Model load takes 8.9 s; each ~8 s line takes ~2 s on the RTX 5060 Ti. Two reference cuts per voice are in `voices/` (`*-short` ~6 s, `*-full` ~7.5 s). The user picked `*-short` for both.
- **Remotion 4.0.544** (scaffolded with `npx create-video@4.0.544 --yes --blank studio`), React 19.3.1, TS 5.9.3. Chrome Headless Shell downloads itself; no missing system libs on this machine. Render of 3 s at 1080×1920 takes ~18 s. Vietnamese diacritics render correctly in Be Vietnam Pro.
- **Gotchas:**
  - `@remotion/media` `<Video>` needs `objectFit` as a prop (ignored inside `style`).
  - Use `muted` on clips and play voice/music via `@remotion/media` `<Audio>`.
  - `loadFont("normal", {weights, subsets: ["vietnamese","latin"]})` was required with `@remotion/google-fonts` (now replaced by bundled files, see Decisions).

## Notes

- Remotion license: free for individuals and companies with ≤3 employees; larger companies need a company license.
- The Speechma samples come from a third-party TTS service. The user should confirm its terms allow commercial use of cloned output.
- VieNeu applies an inaudible audio watermark by default (`apply_watermark=True`). This is left on.
