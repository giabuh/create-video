# Reel Studio App (Sub-project 2) — Design

Date: 2026-11-18
Status: approved in brainstorming, pending written-spec review
Engine spec: `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` (its "File contract" is the base for this app).
Approved mockup (6 screens): https://claude.ai/artifact/L3bNEtvbSu5DqVUqJcZ4Dd

## Goal

A local web app over the engine's files so the user can do everything visually: browse projects, preview and edit storyboards, generate voices, render and compare versions, upload and describe media, audition voices, edit brands and defaults. Buttons run the engine directly (no Claude calls; in-app chat is sub-project 3). Claude CLI keeps working on the same files at the same time; the app live-updates.

## Decisions (user-approved)

- **Scope v1:** all six mockup screens: Projects, Editor, Renders, Library (+ upload, + music tab), Voices, Brand & settings.
- **Buttons run the engine:** generate voice, draft/final render, voice tries, media ingest.
- **Local only:** server binds `127.0.0.1`, no login.
- **Stack (approach 1):** one Node/TypeScript package `app/`: React + Vite frontend, Hono server, Remotion Player for preview, `@remotion/renderer` for renders, one long-lived Python worker for TTS.
- **Upload in-app:** drag-and-drop media straight into the app (no manual copying into `inbox/`).
- **Fully custom UI kit from the start:** every control (select/dropdown, inputs, sliders, switches, tabs, dialogs, menus, toasts, tooltips) is our own styled component; no native-looking widgets. Smooth animations throughout. Large, readable default text.
- **Light and dark themes**, plus a UI text-size setting.
- Added in the mockup and accepted: "Thêm giọng" (upload a 6–10 s reference), "Duyệt bản này" (marks approved + commits the storyboard), "Xoá khỏi thư viện" (blocked while the file is used).

## Architecture

```
browser (React SPA via Vite :5317) ──/api proxy, HTTP/JSON + SSE──► app server (Node, Hono, 127.0.0.1:5316)
                                          ├─ static: /library /music /brands /projects /voices (read-only)
                                          ├─ file store: atomic JSON read/write + mtime conflict check
                                          ├─ watcher: fs.watch(recursive) → SSE "changed" events
                                          ├─ job queue → renderer (@remotion/renderer, in-process)
                                          │            → ingest (spawn python3 tools/ingest.py)
                                          │            → git (approve)
                                          └─ voice worker (spawn VieNeu-TTS/.venv/bin/python tools/worker.py)
                                                JSON lines over stdin/stdout; model loaded once, kept warm
```

- The repo root is an npm workspace (`studio`, `app`) so React and Remotion are installed once. `npm start` in `app/` runs the API (5316) and Vite (5317, proxying `/api` and media roots); there is no dist build, so edits to `studio/src` hot-reload into the preview. `npm run dev` is the same with API auto-restart.
- The Player and the renderer use the **same** components from `studio/src` (imported via a Vite alias `@studio` → `../studio/src`, with `resolve.dedupe` for `react`, `react-dom`, `remotion`, `@remotion/*`). `app/package.json` pins the same Remotion version as `studio/` (4.0.544), plus `@remotion/player`, `@remotion/renderer`, `@remotion/bundler` at 4.0.544.
  - Risk: cross-package import of studio source. Plan Task 1 is a spike that proves Player renders `fixtures/smoke-props.json` in the app before anything else is built.
- Static asset paths: studio components call `staticFile("library/x.mp4")` → `/library/x.mp4`. The server serves those roots, so Player preview needs no copying.
- Renders: bundle `studio/src/index.ts` once per server start (re-bundle when `studio/src` changes), then `selectComposition` + `renderMedia` with `onProgress` and a `cancelSignal`. Draft = `scale: config.video.draftScale`.

## Python worker (`tools/worker.py`)

- Runs with `VieNeu-TTS/.venv/bin/python`. Reads one JSON object per line from stdin, writes one JSON object per line to stdout; logs go to stderr. Requests carry an `id`; replies echo it.
- Commands:
  - `{"id","cmd":"ping"}` → `{"id","ok":true,"modelLoaded":bool,"device":"cuda"|"cpu"}`
  - `{"id","cmd":"prepare","project":"<slug>"}` (always synth; instant preview runs `python3 tools/prepare.py <proj> --preview --json` as a short-lived process instead, so it never queues behind voice generation) → `{"id","ok":true,"totalSeconds","mix","stale":["s2"],"errors":[]}` or `{"id","ok":false,"errors":[...]}`
  - `{"id","cmd":"try","voice","text","variants":[{...}]}` → `{"id","ok":true,"tries":<tries.json content>}`
  - Progress events while working: `{"id","event":"progress","done":2,"total":5,"scene":"s2"}`.
- Model loads lazily on the first synth and stays loaded. The server restarts the worker if it exits and fails the in-flight job with its stderr tail.
- **Refactor, no behaviour change for the CLI:** move the body of `prepare.py main()` into `tools/reel/pipeline.py: prepare(proj: Path, get_model, synth=True) -> dict` and the variant loop of `voice_try.py` into `pipeline.try_variants(model, voice, text, variants) -> dict`. `prepare.py` and `voice_try.py` become thin CLIs over them.
- **`synth=false` (instant preview):** scenes whose cached wav exists use it. Other spoken scenes get no audio, a duration taken from the previous `timings.json` entry for that scene id, else an estimate of `len(say) / 14` seconds, and are listed in `stale`. Writes `render-props.json` (with `stale`-scene audio omitted) but **does not** overwrite `timings.json`.
- Both the app worker and a CLI `prepare.py` started by Claude may hold the model at once; fine on the 16 GB GPU.

## Server API (all JSON unless noted; base `/api`)

| Method & path | Purpose |
|---|---|
| `GET /projects` | list: slug, status, latest render, scene count, totalSeconds, mix, mtime |
| `POST /projects` `{slug,template,brand,voice,targetSeconds}` | create `projects/<slug>/storyboard.json` with `scenes: []` |
| `GET /projects/:slug` | storyboard + timings + render-props + versions + project.json |
| `PUT /projects/:slug/storyboard` `{storyboard, baseMtime}` | atomic save; `409` with current file if mtime differs |
| `POST /projects/:slug/preview` | worker `prepare synth=false` → new render-props |
| `POST /projects/:slug/voice` | job: worker `prepare synth=true` |
| `POST /projects/:slug/render` `{kind:"draft"|"final"}` | job: snapshot storyboard to `reel-vN.storyboard.json`, render `reel-vN.mp4` |
| `POST /projects/:slug/approve` `{version}` | write `project.json`, `git add` + `git commit` the version snapshot (see Security) |
| `GET /library`, `PUT /library/:name` `{entry, baseMtime}`, `DELETE /library/:name` | media index read/edit/delete (delete refused while referenced) |
| `PUT /upload/:filename` (raw body stream) | stream into `inbox/<sanitized name>`; then `POST /ingest` |
| `POST /ingest` | job: `python3 tools/ingest.py` |
| `GET/PUT /music`, `PUT /upload-music/:filename` | list and upload music |
| `POST /voices/try` `{voice,text,variants}` | job: worker `try` |
| `POST /voices` `{name}` + `PUT /upload-voice/:name` | add a voice: ffmpeg-convert the upload to `voices/<name>-short.wav` (mono 24 kHz), register in `config.voices` |
| `GET/PUT /config`, `GET/PUT /brands/:id`, `POST /brands` | settings and brands (atomic, mtime-checked) |
| `GET /jobs`, `POST /jobs/:id/cancel` | job list and cancel |
| `GET /events` (SSE) | `changed {path}`, `job {id, kind, state, progress, message}`, `worker {modelLoaded, device}` |

Jobs run one at a time per lane: `gpu` (voice, tries), `render`, `io` (ingest, git). State: `queued | running | done | failed | cancelled`.

## File contract additions

Added to the engine spec's "File contract" in the same commit as this spec:
- `projects/<slug>/project.json` — `{ "approved": "reel-v2" | null, "renders": { "reel-v2": { "kind": "draft" | "final", "at": "<ISO time>" } } }`, written by the app. Optional; absent = nothing approved, render kinds unknown.
- `projects/<slug>/reel-vN.storyboard.json` — a copy of `storyboard.json` taken when `reel-vN.mp4` is rendered. Committed only when the user approves that version.
- `inbox/` — upload target (already used by `ingest.py`).

Project status shown in the UI is derived: rendering (job running) → "Đang render"; `project.json.approved` → "Đã duyệt vN"; any `reel-v*.mp4` → "Bản nháp vN"; else "Chưa render".

## UI system (`app/src/ui/`)

Built once, used by every screen; a `/ui` gallery route shows every component in both themes for review and future work.

- **Tokens** (`tokens.css`, CSS custom properties): colors for `[data-theme="dark"]` (mockup palette: bg `#0D0E11`, panel `#15171C`, line `#262A33`, text `#ECEEF2`, muted `#A0A6B1`, accent `#F5B83D`, info `#6E9BFF`, success `#4CC38A`, danger `#FF6B6B`) and `[data-theme="light"]` (bg `#F6F7F9`, panel `#FFFFFF`, line `#E2E5EA`, text `#14161A`, muted `#5A616D`, accent `#B7791F` for text/`#F5B83D` for fills, info `#2F5FD0`, success `#1F8A5B`, danger `#C93A3A`); all text pairs ≥ 4.5:1. Mix colors: real = info, motion = accent, other = neutral grey.
- **Theme:** "Hệ thống / Sáng / Tối" switch in the sidebar footer; "Hệ thống" follows `prefers-color-scheme`. Saved in `localStorage`.
- **Type:** Be Vietnam Pro (Vietnamese subset). Base **16 px** body, 14 px minimum for labels and meta, 13 px floor anywhere. Scale: 13 / 14 / 16 / 18 / 22 / 28. All sizes in `rem`. A "Cỡ chữ giao diện" setting (Vừa 100 % / Lớn 112.5 % / Rất lớn 125 %) scales the root font size; saved in `localStorage`.
- **Motion tokens:** durations 120 / 200 / 320 ms, easing `cubic-bezier(.2,.8,.2,1)`. Popovers/menus fade+scale from origin, dialogs/drawers slide+fade, toasts slide in, list items animate on add/remove/reorder, page transitions via the View Transitions API, skeleton shimmer while loading, progress bars animate smoothly. Everything collapses to instant under `prefers-reduced-motion`.
- **Components:** Button (primary/secondary/ghost/danger, sizes, loading state), IconButton (always `aria-label`), Input, Textarea (autosize), NumberField (comma decimals, step buttons), Select (custom listbox, keyboard + typeahead), Combobox/TagInput (tags, highlight words), Slider (with value bubble), RangeSlider (media good ranges), Switch, SegmentedControl, Tabs, Dialog, Drawer, Popover, DropdownMenu, Tooltip, Toast, ProgressBar, Skeleton, EmptyState, Badge/Chip, ColorField (swatch + hex + presets), DropZone (drag-and-drop + picker), AudioPlayer with waveform, VideoCard, SortableList (scene reorder).
- **Library choice:** accessible behaviour from **Radix UI primitives** (unstyled: Select, Dialog, Popover, DropdownMenu, Tooltip, Tabs, Slider, Switch, Toast), styled entirely with our tokens; **dnd-kit** for sortable scenes. No CSS framework; plain CSS modules + tokens. No animation library (CSS + View Transitions).
- Accessibility: real buttons/links/labels, visible focus rings, 44 px touch targets, Vietnamese `lang`, all controls keyboard-operable.

## Loading & feedback states (every screen, every action)

No action may leave the user wondering whether something is happening. Each data view and each action defines all of its states:

- **Initial load:** skeletons shaped like the real content (project cards, scene list, media tiles, inspector fields, voice cards), never a blank screen or a lone spinner. Skeletons appear after 150 ms (no flash on fast loads) and cross-fade to content.
- **Buttons:** pressed → loading state (inline spinner + verb in progress, e.g. "Đang tạo giọng…"), disabled while running, width does not jump. Long actions also appear in the Jobs panel.
- **Long jobs (voice, render, ingest, tries, upload):** determinate progress bar with %, step text ("Cảnh 2/5", "Khung 242/390", "Đang chuẩn hoá 45%"), elapsed time and an ETA once known, a Cancel button where the job supports it. Indeterminate bar only until the first progress event. The Jobs panel in the sidebar lists running/queued/recent jobs on every screen; a finished job fires a toast with a link to its result.
- **Worker warm-up:** first voice action while the model loads shows "Đang nạp model giọng… (~10 giây)" in the button and the sidebar status dot pulses amber; green when ready, red with reason on failure.
- **Saving:** a status pill in the editor top bar cycles "Đang lưu…" → "Đã lưu" (with time) → "Lỗi lưu — thử lại" (button). Preview refresh after an edit shows a subtle shimmer over the Player, never a blocking overlay.
- **Uploads:** per-file rows with upload % then ingest %, thumbnails pop in when ready; the user can keep working while they run.
- **Media in Player/cards:** placeholder tile with shimmer until the video/image can play; broken/missing file → named placeholder.
- **Empty states:** illustrated message + primary action for no projects, empty storyboard, empty library, no renders yet, no tries yet.
- **Errors:** inline next to the field/scene for validation; toast + retry for actions; full-panel error with retry if a view fails to load. Lost SSE connection → top banner "Mất kết nối với server — đang thử lại…" with automatic reconnect and a refetch on reconnect.
- **Optimistic UI** for instant-feeling edits (reorder, rename, tag edits), rolled back with a toast if the save fails.

## Screens

As in the approved mockup (one artboard each). Behaviour notes:
- **Projects:** cards with latest render thumbnail (first frame via `<video preload="metadata">`), status chip, mix bar, filters, search; "Dự án mới" dialog.
- **Editor:** scene list (sortable, add/duplicate/delete), Player (scene or whole video), inspector tabs Cảnh / Toàn video / CTA, timeline (scenes proportional to duration, voice waveform, music strip), mix vs target in the top bar. Edits autosave (debounced 500 ms) then call `preview`; a banner offers "Tạo lại giọng" when `stale` is non-empty. Motion layers: a form per known component (KineticText, CountUp, Checklist, PriceTag, DateBadge, LowerThird; fields from the engine spec's motion props table), a JSON field for any other component in `registry.ts`. Media picker opens a Library drawer.
- **Renders:** versions side by side (play, meta, approve, open folder), running render progress with cancel.
- **Library:** tabs Ảnh & video / Nhạc; DropZone with per-file upload + ingest progress; filters; detail drawer (description, tags, good ranges, "used in"). Writes to `media-index.json` wait for any running ingest job.
- **Voices:** voice cards (ref select, play ref), try panel (variants table, results with waveform, "Lưu làm mặc định" writes the variant's tts values into `config.tts` / ref into `config.voices.<v>.ref`), default tts sliders.
- **Brand & settings:** brand list/editor with live CTA preview (rendered by the real `CtaCard` in a small Player), defaults, mix targets, captions, music, theme and text size.

## Error handling

- Every write is atomic (write temp file + rename) and mtime-checked; a `409` reloads the file in the UI with a toast "File vừa được sửa bên ngoài — đã tải lại".
- Invalid storyboard: server runs the worker's validation and shows the engine's error list inline on the affected scene; nothing is rendered.
- Job failures show the last 20 lines of the job log in a toast + job panel; the job can be retried.
- Worker crash: auto-restart once per job; status dot turns red with the reason.
- Upload: sanitized names (same slug rule as `ingest.py`), extension allow-list, no size cap; a failed ingest leaves the original in `inbox/` (engine behaviour) and is shown as failed.
- Missing referenced media (e.g. after a Drive pull is incomplete): Player shows a placeholder tile with the file name instead of crashing.

## Security

- Bind `127.0.0.1` only. Reject requests whose `Host` is not `127.0.0.1:<port>`/`localhost:<port>` and state-changing requests whose `Origin` is present and different (blocks DNS rebinding and cross-site requests from other tabs).
- All path params resolved under their root and rejected if they escape it (`..`, absolute paths, symlinks out of the root except the known studio symlinks).
- The app never reads or serves `~/.config/rclone`, `.git`, `VieNeu-TTS/` or anything outside the listed roots.
- Git commit runs only on the explicit "Duyệt bản này" click, with a single-line message `Approve <slug> reel-vN`, staging only that project's `project.json` and `reel-vN.storyboard.json`, plus `storyboard.json` only if it is byte-identical to that snapshot (approving an older version never touches the user's current edits).

## Testing

- `app/`: vitest for path safety, Host/Origin guard, atomic write + mtime conflict, version numbering, project status derivation, upload name sanitizing, job queue lanes/cancel.
- Python: pytest for `pipeline.prepare` (synth=false stale/estimate logic, timings untouched) and the worker protocol (fake model).
- `tsc --noEmit` for `app/` (which also type-checks the imported studio components).
- End-to-end (Playwright, at final review): open `_smoke`, edit a caption → Player shows it; generate voice; draft render produces the next `reel-vN.mp4`; upload a small file → appears in Library; toggle light/dark.

## Setup & docs

- `setup.sh` gains `(cd app && npm ci)`.
- `CLAUDE.md` gains the command `cd app && npm start` (opens http://localhost:5317) and a rule: when the app is open, prefer telling the user to look at it rather than describing renders.

## Out of scope

In-app Claude chat (sub-project 3), Drive sync buttons (keep `tools/sync.sh`), a second template, multi-user or remote access, editing motion component source code in the app.
