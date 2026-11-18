# Reel Pipeline (Sub-project 1: Engine) — Design

Date: 2026-11-18
Status: approved in brainstorming, pending written-spec review

## Goal

Produce vertical course-promotion reels (Facebook/TikTok/Shorts, 9:16, ~15–60 s) from real photos/videos of students, with a Vietnamese voice-over from VieNeu-TTS, animated captions, optional background music and a call-to-action end card. Claude (Claude Code CLI, run in `/home/giabao/dev/create-video`) drives the whole pipeline; the user talks to Claude in natural language.

## Sub-project roadmap

1. **Engine (this spec):** media ingest, storyboard, layered config, TTS, Remotion template, render.
2. **App (next spec):** local web UI that reads/writes the engine's files (see "File contract") to browse projects, play renders, edit storyboards/config, audition voices, manage library/templates/brands. Live-updates when files change. No Claude calls.
3. **In-app Claude chat (later spec):** the app runs the local `claude` CLI headless in this folder under the user's own login. Personal single-user use only.

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
- **Font:** Be Vietnam Pro (full Vietnamese diacritics), via `@remotion/google-fonts`.
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

Resolution order (later wins): `config.json` → `config.voices.<voice>` → brand `brand.json` (visual fields only) → storyboard top level → scene.

```jsonc
// config.json
{
  "defaults": { "voice": "phuong", "template": "fast-cut", "brand": "demo" },
  "tts": {
    "temperature": 0.8, "top_k": 25, "top_p": 0.95,
    "repetition_penalty": 1.2, "max_chars": 256, "batch_size": 16,
    "silence_p": 0.15, "denoise": true,
    "speed": 1.0,        // applied after TTS with ffmpeg atempo (VieNeu has no speed param)
    "pauseAfter": 0.3    // seconds of silence after each spoken scene
  },
  "voices": {
    "phuong": { "ref": "voices/phuong-short.wav" },
    "vy":     { "ref": "voices/vy-short.wav" }
  },
  "mix":      { "real": 0.6, "motion": 0.3, "other": 0.1 },   // target share of screen time
  "sync":     { "remote": "video-syn:create-video" },            // rclone remote:path
  "video":    { "fps": 30, "width": 1080, "height": 1920, "draftScale": 0.5 },
  "music":    { "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5 },
  "captions": { "font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF",
                "highlightColor": "#FFD400", "maxWords": 6 }
}
```

TTS keys map 1:1 onto `Vieneu` v3 Turbo `infer()` kwargs (`src/vieneu/v3turbo.py:600`), except `speed` and `pauseAfter`, which are ours.

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
- `media[].src` is relative to `library/`. `effect` ∈ {`none`, `zoom-in`, `zoom-out`, `pan-left`, `pan-right`}; `transition` ∈ {`cut`, `fade`, `slide`}. New effects are added to the template code and become new enum values.
- `motion[]`: `component` is a file name in `studio/src/motion/`; `props` are its typed props; `start`/`duration` (seconds, relative to the scene) are optional and default to the whole scene. A scene with `motion` but no `media` is a pure motion scene, drawn on the brand background.
- Mix accounting: a scene counts as `real` if it has `media`, as `motion` if it has only `motion`, and the CTA counts as `other`. `prepare.py` prints the actual mix against `config.mix`.
- Captions are split into chunks of ≤ `captions.maxWords` words, timed proportionally to character count within the scene's audio. (Shortcut: no word-level alignment. Upgrade later with Whisper for karaoke-style highlighting.)
- Music ducks to `duckTo` while a spoken scene plays, ramps back between scenes, and fades out over `fadeOut` at the end. All of this is computed in Remotion from known timings, with no FFmpeg sidechain.

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
3. TTS: load the model once. For each spoken scene, compute the cache key = hash(voice ref file content + `say` + all resolved TTS params incl. speed). Reuse `audio/<id>-<hash>.wav` if present, else synthesize, apply `atempo` if speed ≠ 1, and save. Failures are reported per scene; other scenes still complete.
4. Write `timings.json` (per-scene duration + resolved params) and `render-props.json` (storyboard + resolved config + brand + timings, with all paths relative to the Remotion public dir). Print the total duration vs `targetSeconds`, and the real/motion/other mix vs `config.mix`.

Validation also checks that every `motion[].component` exists in `studio/src/motion/`.

### `tools/voice_try.py --voice <name> --text "<line>" --variants '<json list of tts overrides>'`
Writes `voices/tries/<name>-A.wav`, `-B.wav`, … plus a `tries.json` listing each variant's params, so the user can listen and say "lấy B" → Claude copies those params into `config.voices.<name>`.

### Remotion `studio/`
- One composition `Reel` (1080×1920 @ 30 fps by default). `calculateMetadata` sets `durationInFrames` from `render-props.json` timings (+ CTA duration).
- `Reel` dispatches to `src/templates/<template>/`. Each template is built from small components: `MediaShot` (cover/blur-fill, effects), `Captions` (chunking, highlight, auto-fit font size to the safe area), `Overlay`, `CtaCard`, `MusicTrack` (ducking), `VoiceTrack`.
- Motion library `src/motion/`: one file per component, a typed props interface, branded through the brand colors and font. v1 seeds a few: `KineticText`, `CountUp`, `Checklist`, `PriceTag`, `DateBadge`, `LowerThird`. A `registry.ts` maps names to components; Claude adds an entry when writing a new one. All components also receive `brand`. Props:

| Component | Props |
|---|---|
| `KineticText` | `lines: string[]` |
| `CountUp` | `from: number`, `to: number`, `decimals?: number`, `label?: string`, `suffix?: string` |
| `Checklist` | `items: string[]`, `title?: string` |
| `PriceTag` | `price: string`, `old?: string`, `note?: string` |
| `DateBadge` | `label: string`, `date: string` |
| `LowerThird` | `title: string`, `subtitle?: string` |
- Video tag: `@remotion/media` `<Video>` for rendering, with `<OffthreadVideo>` while previewing in Studio (per current Remotion docs).
- Brand (`brands/<id>/brand.json`): `{ name, logo, colors: {primary, accent, text}, font?, cta: {phone, fanpage, address} }`.
- Commands:
  - Draft: `npx remotion render Reel <project>/reel-v<N>.mp4 --props=<project>/render-props.json --scale=<draftScale>`
  - Final: the same command without `--scale`.
  - Stills: `npx remotion still Reel <project>/preview/<scene>.png --frame=<mid-frame> --props=…`

## Workflow (`/make-reel`, documented in the skill and CLAUDE.md)

0. New media present in `inbox/` → run `tools/ingest.py` → index new files.
1. Brief: course, offer, length, voice, brand, music yes/no. Ask for any missing facts (price, phone, dates) rather than inventing them.
2. Create `projects/<date-slug>/storyboard.json` (Mode A: write the script and pick shots from the index; Mode B: transcribe the user's script).
3. Run `prepare.py`. If the total runs over the target, shorten `say` and rerun (only the changed scenes re-synthesize).
4. Render stills of each scene and view them to self-check for overflow, collisions and wrong shots. Then render a draft and report the path plus a scene summary table.
5. Iterate on the user's feedback. Each render is a new `reel-v<N>.mp4`. Commit the storyboard on each accepted version so "quay lại v2" works.
6. Final render at full resolution.

Saving reusable assets by voice command: "lưu bố cục này thành template X" (copy the template folder, then register it), "tạo thương hiệu mới…" (new `brands/<id>/`), "lưu thiết lập giọng…" (update `config.json`).

## Portability (GitHub + second Linux machine)

**In git (private repo):** all code, `config.json`, `brands/`, `voices/*-short.wav` and `*-full.wav`, `projects/*/storyboard.json`, CLAUDE.md, skills, and the VieNeu-TTS submodule pointer.

**Not in git, synced via Google Drive:** `library/` (media + `media-index.json` + thumbs), `music/`, `reference/`, and `projects/*/reel-v*.mp4`.

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
- Portability check: fresh `git clone --recursive` into a temp dir, then `./setup.sh`, `prepare.py` and a draft render of the fixture storyboard succeed with no manual steps besides `rclone config`.

## Out of scope for v1

Word-level karaoke captions (Whisper alignment), auto-posting to social platforms, a second template, the App (sub-project 2) and in-app chat (sub-project 3).

## Spike results (2026-11-18)

- **VieNeu v3 Turbo cloning works with `ref_audio` only.** Model load takes 8.9 s; each ~8 s line takes ~2 s on the RTX 5060 Ti. Two reference cuts per voice are in `voices/` (`*-short` ~6 s, `*-full` ~7.5 s). The user picked `*-short` for both.
- **Remotion 4.0.544** (scaffolded with `npx create-video@4.0.544 --yes --blank studio`), React 19.3.1, TS 5.9.3. Chrome Headless Shell downloads itself; no missing system libs on this machine. Render of 3 s at 1080×1920 takes ~18 s. Vietnamese diacritics render correctly in Be Vietnam Pro.
- **Gotchas:**
  - `@remotion/media` `<Video>` needs `objectFit` as a prop (ignored inside `style`).
  - Use `muted` on clips and play voice/music via `@remotion/media` `<Audio>`.
  - `loadFont("normal", {weights, subsets: ["vietnamese","latin"]})` is required.

## Notes

- Remotion license: free for individuals and companies with ≤3 employees; larger companies need a company license.
- The Speechma samples come from a third-party TTS service. The user should confirm its terms allow commercial use of cloned output.
- VieNeu applies an inaudible audio watermark by default (`apply_watermark=True`). This is left on.
