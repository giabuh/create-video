# Remotion vs HyperFrames, round 2: each engine goes all-out

## Prep

Verdict: **GO** on all gate items. Done on branch `hyperframes-pilot`, 2026-11-21.

### Project copy (`projects/2026-11-21-so-sanh-toi-da/`)
- Copied `storyboard.json`, `timings.json`, `audio/` from `projects/2026-11-20-demo-card-moi/`; ran `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/2026-11-21-so-sanh-toi-da` (1.3 s, no synthesis: all audio cached).
- `totalSeconds` = 26.69 (same as the original); frames = ceil(26.69 x 30) = **801**. Canvas 1080x1920, 30 fps, `transitionSeconds` 0.4, template `fast-cut`.
- All 5 voice wavs have the same sha256 before and after `prepare.py`, and the same as the original project (checked with `sha256sum`).
- Voice wavs and word timings (all under `projects/2026-11-21-so-sanh-toi-da/audio/`, scene start in the full reel in brackets):
  - mo-dau [0.0, 3.433 s]: `mo-dau-6e8376081904.wav` / `.words.json` (14 words)
  - kem-1-1 [3.433, 5.519 s]: `kem-1-1-af3c7454a597.wav` / `.words.json`
  - ban-se-hoc [8.953, 7.101 s]: `ban-se-hoc-8e8bd734f188.wav` / `.words.json`
  - uu-dai [16.054, 3.217 s]: `uu-dai-923088b0af87.wav` / `.words.json`
  - goi-ngay [19.271, 4.42 s]: `goi-ngay-1b8e132aa6a9.wav` / `.words.json` (17 words)
- `.words.json` format is the pipeline's own: `{"engine":"whisper:large-v3-turbo","words":[{"w","start","end"}]}`, seconds from the wav start. `mo-dau` and `goi-ngay` were created with `tools/reel/align.py` `scene_words(..., allow_asr=True)` (whisper_words + align_words); word counts match `say`.
- `render-props.json`, `timings.json` and `audio/` are git-ignored; only `storyboard.json` is committed.

### Remotion packages (studio workspace, root `package-lock.json`)
Installed with `npm install -w studio --save-exact`: `@remotion/transitions`, `light-leaks`, `motion-blur`, `noise`, `shapes`, `paths`, `three`, `lottie` all **4.0.544**; `three` **0.187.0**; `@react-three/fiber` **9.8.2** (peer `react >=19 <19.4`, repo has 19.3.1); `lottie-web` **5.13.0**; `@types/three` **0.187.0** (dev). `cd studio && npx tsc --noEmit` exit 0; `cd app && npm test` 47 files / 240 tests pass.

### WebGL (Remotion)
Throwaway `@remotion/three` spinning cube, `npx remotion still ... --frame=10` from `studio/` with the repo `remotion.config.ts` (`gl: vulkan`): **works with no flag** (cube rendered, checked visually). `--gl=angle` and `--gl=egl` both failed (page error at React root, no WebGL context). So: keep the config default, pass no `--gl`. Throwaway file deleted. Note the flat look is just ambient + point light; add more lights for depth.

### Template pass-through
`template: "probe"` in a scratch storyboard is **rejected** by `tools/reel/validate.py:20` ("template: studio/src/templates/probe not found") because the name must be a directory in `studio/src/templates/`. With an empty temporary `studio/src/templates/probe/` dir (removed afterwards) `render-props.json` gets `"template": "probe"` (`tools/reel/props.py:223`). So a new template name needs its directory; the committed storyboard keeps `fast-cut`.

### Showcase footage
- A = `library/video-doc-hoc-vien-nu-thuc-hanh-excel-tren-laptop.mp4`, 720x1280, 30 fps, 10.37 s, use from 0.5 s. Blue-shirt student for about the first 4-5 s, then the shot changes to a monitor view.
- B = `library/video-doc-hoc-sinh-hoc-lap-trinh-python.mp4`, 720x1280, 8.31 s, range 0.5-7.5 s (schoolboy at a monitor, head and hands visible).

### Cutout
`hyperframes remove-background <A> -o showcase/shared/cutout.webm` (local CPU model, onnxruntime-node installed once into the HyperFrames cache, no sign-in, 101.7 s for 311 frames). Result: VP9 + alpha (`ALPHA_MODE=1`), yuv420p, 720x1280, 30 fps, 4.9 MB, same timeline as A. Verified over a solid magenta with a text layer behind it:
- HyperFrames: `<video class="clip" src="assets/cutout.webm" data-media-start="0.5">` then `hyperframes snapshot --at 1`: alpha honoured, text hidden behind the hair and shirt.
- Remotion: `<OffthreadVideo src={staticFile("cutout.webm")} transparent startFrom={15} style={{position:"absolute",...}}/>` then `remotion still`: alpha honoured (RGBA pixels checked: opaque on the person, 0 elsewhere). **Gotcha:** give the OffthreadVideo `position: "absolute"`; a static `<img>` paints below positioned siblings, so the text came out in front of the student until fixed.
- No matte needed.

### HyperFrames registry
`hyperframes add cinematic-zoom --no-clipboard --json` (from the project dir; `catalog --tag transition --json` lists blocks). Fetches from `https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry` (needs network, no HeyGen account). Writes `compositions/cinematic-zoom.html`, `hyperframes.json`, `hyperframes.lock.json`; prints the include snippet `<div data-composition-id="main" data-composition-src="compositions/cinematic-zoom.html" data-duration="4" data-width="1920" data-height="1080"></div>` (add `data-start`/`data-track-index`; the block is 1920x1080 and a demo scene containing a placeholder prompt text, to strip). `grep -rn http` shows **remote URLs**: `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js">` and a Google Fonts `@import url(...)` in the block. Vendor by replacing the script `src` with the local `assets/gsap.min.js` (copy from `tools/hyperframes/node_modules/gsap/dist/gsap.min.js`) and deleting the `@import` (use a local font from `studio/src/assets/fonts`), so renders need no network.

### Other facts for later tasks
- Logo: `brands/demo/logo-marketing-sao-viet-3-nobg.png`; brand colours primary #1E3A8A, accent #FFD400, text #FFFFFF, background #0B1530.
- Showcase brief: `showcase/brief.md` (7-row table verbatim, inputs, output names `showcase/out/r-<n>.mp4` / `h-<n>.mp4`).
- Shared files `studio/src/templates/index.ts`, `studio/src/templates/{slideshow,split-compare,testimonial}/` and `projects/2026-11-20-demo-card-moi/{hyperframes,project.json}` are modified/untracked by someone else; not touched or staged here.
