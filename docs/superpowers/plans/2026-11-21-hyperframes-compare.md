# Remotion vs HyperFrames pilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `projects/2026-11-20-demo-card-moi` with HyperFrames next to a fresh Remotion render and measure visual quality, speed and stability.

**Architecture:** A small generator (`tools/hyperframes/build.mjs`) turns `render-props.json` into a HyperFrames `index.html`
(footage, fades, captions, baseline audio, one host `<div>` per motion layer). Hand-written GSAP cards in
`projects/<slug>/hyperframes/cards/` fill those hosts. A bench script renders both engines, checks the outputs and
writes the comparison files. Spec: `docs/superpowers/specs/2026-11-21-hyperframes-compare-design.md`.

**Tech Stack:** HyperFrames CLI (pinned), GSAP (vendored), Node 24 (`node:test`), ffmpeg/ffprobe, the app's HTTP API.

## Global Constraints

- Do not change `app/`, `studio/`, `app/server/render.ts` or `VieNeu-TTS/`.
- Do not edit `projects/2026-11-20-demo-card-moi/project.json` by hand (the user has an uncommitted change in it; the app may write it).
- HyperFrames runs locally only. Every `hyperframes` command runs with `HYPERFRAMES_NO_TELEMETRY=1`. Never run `hyperframes cloud …`, `hyperframes auth login`, or any HeyGen MCP tool.
- Use the pinned local binary `tools/hyperframes/node_modules/.bin/hyperframes`, not a bare `npx hyperframes`.
- Never overwrite a `reel-vN.mp4`. HyperFrames renders go to `projects/2026-11-20-demo-card-moi/compare/` first.
- All on-screen text is copied verbatim from `render-props.json` (CLAUDE.md rule 1: never invent ad facts).
- GSAP is vendored into `projects/<slug>/hyperframes/assets/` (no CDN at render time); fonts are the files in `studio/src/assets/fonts/`.
- `projects/*/hyperframes/assets/` and `projects/*/compare/` are git-ignored (already in `.gitignore`). Never commit footage or frames from it.
- Stage only your own files by explicit path. Commit messages: one line, no body, no Co-Authored-By trailer.
- Tests per task: run only the tests for what you touched (`node --test tools/hyperframes/`); no full suite.
- Write findings into the report `docs/reports/2026-11-21-remotion-vs-hyperframes.md` (text and tables only; images are referenced by their path in `compare/`).

## Known facts (already done by the main session)

- Baseline Remotion render: `projects/2026-11-20-demo-card-moi/reel-v4.mp4`, rendered through the app
  (`POST http://127.0.0.1:5316/api/projects/2026-11-20-demo-card-moi/render`). Job time 16.1 s (`endedAt − startedAt`,
  first render of this session). h264, 1080×1920, 30/1 fps, 12.27 Mbps, **801 frames**, 26.709 s.
- Baseline audio: `projects/2026-11-20-demo-card-moi/hyperframes/assets/baseline.wav` (26.709 s; voice, ducked music and sfx).
- App API: base `http://127.0.0.1:5316/api`. `POST /projects/<slug>/render` returns the job (`id`, `state`);
  `GET /jobs` lists jobs (`state` `running|queued|done|failed`, `startedAt`, `endedAt`, `result.version`);
  `DELETE /projects/<slug>/renders/<version>` deletes a version. Non-GET requests must send no `Origin` header or
  `Origin: http://127.0.0.1:5316` (`app/server/guard.ts`).
- HyperFrames: clips are static `<video>/<audio>/<div class="clip">` with `data-start`, `data-duration`,
  `data-track-index`; source offset on `<video>/<audio>` is **`data-media-start`**; clips on one track must not
  overlap; higher tracks draw in front; the root GSAP timeline is paused and registered as
  `window.__timelines["<data-composition-id>"]`. Render flags: `--gpu` (NVENC encode), `--browser-gpu`
  (forces Chrome GPU, errors if none), `--video-bitrate 12M`, `-w/--workers 1-8`, `-q/--quality`, `-o`.
  Telemetry: `hyperframes telemetry disable`, `hyperframes telemetry status --json`, env `HYPERFRAMES_NO_TELEMETRY=1`.
- Remotion timing to mirror (`studio/src/templates/fast-cut/FastCut.tsx`): a scene starts at `scene.start`, its media
  and motion at `scene.start + item.start`; frames are `Math.round(seconds × fps)`; the CTA starts at the sum of
  scene durations; the total is `ceil(totalSeconds × fps)` frames. Read FastCut.tsx for the transition tail.
- This project uses: motion `Stamp`, `Checklist`, `Picture` ×3, `OfferCard`, all `position: "free"` with a `box`;
  enter `none|pop`, exit `none|fade`; no keyframes; scene transitions all `fade`, `transitionSeconds` 0.4;
  captions `Be Vietnam Pro` 64 px, `#FFFFFF`, highlight `#FFD400`, `box: true`; CTA 3 s with logo, phone, fanpage.

## File map

| File | Task | Purpose |
| --- | --- | --- |
| `tools/hyperframes/package.json`, `package-lock.json` | 1 | Pins `hyperframes` and `gsap` exact versions |
| skill files from `npx skills add heygen-com/hyperframes`, `skills-lock.json` | 1 | HyperFrames authoring guidance |
| `docs/reports/2026-11-21-remotion-vs-hyperframes.md` | 1 (creates), 4 (fills) | Results report |
| `tools/hyperframes/build.mjs` | 2 | `render-props.json` → `index.html` |
| `tools/hyperframes/build.test.mjs` | 2 | Unit tests for the generator |
| `projects/2026-11-20-demo-card-moi/hyperframes/index.html` | 2 (generated) | The composition |
| `projects/2026-11-20-demo-card-moi/hyperframes/cards/*.js`, `cards/cards.css` | 3 | Hand-written cards and the shared layer helper |
| `tools/hyperframes/bench.mjs` | 4 | Timed runs, checks, side-by-side, final copy |

---

### Task 1: Spike — install, telemetry off, go/no-go render

**Files:**
- Create: `tools/hyperframes/package.json`, `tools/hyperframes/package-lock.json`
- Create: skill files written by `npx skills add heygen-com/hyperframes`; Modify: `skills-lock.json`
- Create: `docs/reports/2026-11-21-remotion-vs-hyperframes.md` (section "Setup" only)
- Scratch (git-ignored): `projects/2026-11-20-demo-card-moi/compare/spike/`

**Interfaces:**
- Produces for Task 2: the report's "Setup" section states (1) the exact `hyperframes` and `gsap` versions,
  (2) **footage mode**: `in-place` (a relative `src` such as `../../../library/x.mp4` or a symlink works from
  `projects/<slug>/hyperframes/`) or `copy` (only files inside the project dir load), (3) the GSAP file path to vendor,
  (4) the exact working render command line.

- [ ] **Step 1: Pin and install.** `npm view hyperframes version` and `npm view gsap version`; write
  `tools/hyperframes/package.json`:
  ```json
  {"name": "hyperframes-pilot", "private": true, "type": "module",
   "dependencies": {"hyperframes": "<exact version>", "gsap": "<exact version>"}}
  ```
  Run `cd tools/hyperframes && npm install`. Expected: `node_modules/.bin/hyperframes` exists.
- [ ] **Step 2: Telemetry off.** `HYPERFRAMES_NO_TELEMETRY=1 tools/hyperframes/node_modules/.bin/hyperframes telemetry disable`
  then `… telemetry status --json`. Expected: `"enabled": false`. Record the output in the report.
- [ ] **Step 3: Install skills (user approved).** From the repo root: `npx skills add heygen-com/hyperframes`.
  Record which directories it created. Read the main HyperFrames composition skill so Task 3 can be pointed at it;
  write its path in the report.
- [ ] **Step 4: Doctor.** `HYPERFRAMES_NO_TELEMETRY=1 tools/hyperframes/node_modules/.bin/hyperframes doctor`. Paste the
  result summary (pass/fail lines) into the report.
- [ ] **Step 5: Spike composition.** In `projects/2026-11-20-demo-card-moi/compare/spike/` write `index.html`: root
  `data-composition-id="spike"` 1080×1920; one `<video class="clip" muted>` of
  `library/video-doc-hoc-vien-nu-thuc-hanh-excel-tren-laptop.mp4` (`data-start="0" data-duration="3"
  data-media-start="0.5" data-track-index="0"`); one `<audio>` of `../../hyperframes/assets/baseline.wav`
  (`data-start="0" data-duration="3" data-track-index="1"`); one `<div class="clip">` with the text
  `Muốn tự chạy quảng cáo Facebook` in Be Vietnam Pro 800 loaded with `@font-face` from the woff2 files in
  `studio/src/assets/fonts/be-vietnam-pro/` (copied into `spike/`), faded in by a paused GSAP timeline registered as
  `window.__timelines.spike`; GSAP loaded from a local copy of `node_modules/gsap/dist/gsap.min.js`.
  Try the footage `src` first as a relative path to the repo `library/`, then as a symlink, then as a copy;
  use the first that renders the real picture.
- [ ] **Step 6: Render with GPU flags.**
  `HYPERFRAMES_NO_TELEMETRY=1 tools/hyperframes/node_modules/.bin/hyperframes render projects/2026-11-20-demo-card-moi/compare/spike --gpu --browser-gpu --video-bitrate 12M -o projects/2026-11-20-demo-card-moi/compare/spike/out.mp4`.
  Expected: exit 0. Check with `ffprobe` (h264, 1080×1920, 30 fps, 90 frames, audio present), and confirm NVENC was used
  (render log, or `ffprobe -show_entries stream_tags=encoder`). `--browser-gpu` errors when there is no GPU, so a
  success means Chrome used the GPU; record any fallback message.
- [ ] **Step 7: Look at it.** Extract frame 45 to `compare/spike/f45.png` (`ffmpeg -ss 1.5 -i out.mp4 -frames:v 1`),
  view it: real footage visible, Vietnamese diacritics correct, text not in a fallback font. Note any VFR or
  sparse-keyframe warnings from the render log.
- [ ] **Step 8: Verdict.** In the report "Setup" section write GO or NO-GO with the facts above (versions, footage
  mode, GSAP path, command line, telemetry status, doctor summary, NVENC/GPU evidence, warnings). NO-GO if any check
  failed and no flag or config fixed it: stop and report.
- [ ] **Step 9: Commit.**
  ```bash
  git add tools/hyperframes/package.json tools/hyperframes/package-lock.json skills-lock.json docs/reports/2026-11-21-remotion-vs-hyperframes.md <skill dirs created in Step 3>
  git commit -m "Add pinned HyperFrames pilot tooling and spike results"
  ```

### Task 2: Generator `build.mjs` (footage, fades, captions, audio, card hosts)

**Files:**
- Create: `tools/hyperframes/build.mjs`, `tools/hyperframes/build.test.mjs`
- Generated (committed): `projects/2026-11-20-demo-card-moi/hyperframes/index.html`
- Read first: `studio/src/templates/fast-cut/FastCut.tsx`, `studio/src/components/{MediaShot,Captions,SceneTransition,ReelVideo}.tsx`,
  `studio/src/effects.ts`, `studio/src/fonts.ts`, `studio/src/types.ts`, the report "Setup" section (footage mode, GSAP path).

**Interfaces:**
- Consumes: Task 1 report "Setup" (footage mode, GSAP path).
- Produces for Task 3 (exact contract):
  - Root: `<div id="root" data-composition-id="root" data-start="0" data-width="1080" data-height="1920">`.
  - Before card scripts: `window.__hf = {tl, fps, W: 1080, H: 1920, brand}` where `tl = gsap.timeline({paused: true})`
    and `brand` is `render-props.json` `brand` with `colors` defaults applied (`accent2 #E11D2E`, `surface #FFFFFF`);
    `window.__hfCards = {}`.
  - Each motion layer: `<div class="clip mo" id="mo-<sceneId>-<i>" data-card="<component>" data-start="<abs s>"
    data-duration="<s>" data-track-index="<n>" style="position:absolute;left:<x>%;top:<y>%;width:<w>%;height:<h>%">`
    containing `<script type="application/json" class="mo-props">` + the whole `MotionItem` JSON (props, enter,
    exit, keyframes, scale, rotate, opacity, colors, backdrop, box).
  - CTA: `<div class="clip mo" id="cta" data-card="Cta" …>` covering the full frame, JSON
    `{"cta": <cta>, "bg": <last scene's media[0]>}`.
  - Card scripts: `<script src="cards/layer.js">` then `<script src="cards/<Name>.js">` for each used component and
    `Cta`, plus `<link rel="stylesheet" href="cards/cards.css">`. Each card file sets
    `window.__hfCards.<Name> = (host, item, t0) => void` (builds DOM inside `host`, adds tweens to `__hf.tl` at
    absolute time `t0`).
  - Last inline script: dispatch every `[data-card]` host to its card (throw `missing card <Name>` if absent), then
    `window.__timelines = window.__timelines || {}; window.__timelines.root = tl;`.
  - CLI: `node tools/hyperframes/build.mjs projects/<slug> [--no-cards]`; `--no-cards` omits motion hosts, CTA and
    card scripts (used to check the frame before Task 3 exists).

- [ ] **Step 1: Write the failing tests** in `tools/hyperframes/build.test.mjs`:
  ```js
  import {test} from 'node:test';
  import assert from 'node:assert/strict';
  import {allocTracks, buildHtml} from './build.mjs';

  const props = {
    fps: 30, width: 1080, height: 1920, totalSeconds: 7, transitionSeconds: 0.4,
    brand: {name: 'B', logo: null, colors: {primary: '#111111', accent: '#FFD400', text: '#FFFFFF', background: '#000000'}},
    captions: {font: 'Be Vietnam Pro', size: 64, color: '#FFFFFF', highlightColor: '#FFD400', box: true},
    music: null, sfx: [], overlays: [],
    cta: {title: 'Gọi ngay', duration: 2, phone: '0123', fanpage: 'fb.com/x'},
    scenes: [
      {id: 's1', start: 0, duration: 2.5, voice: null, overlay: null, transition: 'fade', highlight: ['Facebook'],
       captions: [{text: 'Muốn <b> & Facebook', start: 0, end: 1.2}],
       media: [{src: 'library/a.mp4', type: 'video', from: 0.5, start: 0, duration: 1.5, effect: 'zoom-in'},
               {src: 'library/b.mp4', type: 'video', from: 1, start: 1.5, duration: 1, effect: 'none'}],
       motion: [{component: 'Stamp', props: {main: 'X'}, start: 0.5, duration: 1, position: 'free',
                 box: {x: 40, y: 10, w: 56, h: 14}, backdrop: 'none', scale: 1, rotate: 0, opacity: 1,
                 enter: {type: 'none', duration: 0}, exit: {type: 'none', duration: 0}, keyframes: [], colors: null}]},
      {id: 's2', start: 2.5, duration: 2.5, voice: null, overlay: null, transition: 'fade', highlight: [],
       captions: [], motion: [],
       media: [{src: 'library/c.mp4', type: 'video', from: 0, start: 0, duration: 2.5, effect: 'none'}]},
    ],
  };
  const opts = {media: src => `../../../${src}`, audio: 'assets/baseline.wav', gsap: 'assets/gsap.min.js', cards: true};
  const clips = html => [...html.matchAll(/<(video|audio|div)[^>]*data-start="([\d.]+)"[^>]*data-duration="([\d.]+)"[^>]*data-track-index="(\d+)"/g)]
    .map(m => ({start: +m[2], end: +m[2] + +m[3], track: +m[4]}));

  test('allocTracks puts overlapping clips on different tracks and reuses free ones', () => {
    assert.deepEqual(allocTracks([{start: 0, duration: 2}, {start: 1.6, duration: 2}, {start: 3.6, duration: 1}], 10), [10, 11, 10]);
  });
  test('every media item becomes a muted <video> with data-media-start', () => {
    const html = buildHtml(props, opts);
    assert.equal((html.match(/<video /g) ?? []).length >= 3, true);
    assert.match(html, /<video[^>]*src="\.\.\/\.\.\/\.\.\/library\/a\.mp4"[^>]*data-media-start="0\.5"[^>]*muted/);
  });
  test('no two clips on one track overlap', () => {
    const cs = clips(buildHtml(props, opts));
    for (const a of cs) for (const b of cs) if (a !== b && a.track === b.track)
      assert.ok(a.end <= b.start + 1e-6 || b.end <= a.start + 1e-6, `overlap on track ${a.track}`);
  });
  test('caption text is escaped and kept verbatim, highlight word wrapped', () => {
    const html = buildHtml(props, opts);
    assert.match(html, /Muốn &lt;b&gt; &amp; <span class="hl">Facebook<\/span>/);
  });
  test('motion layers and CTA become card hosts with parseable props', () => {
    const html = buildHtml(props, opts);
    assert.match(html, /<div class="clip mo" id="mo-s1-0" data-card="Stamp" data-start="0\.5" data-duration="1"/);
    assert.match(html, /data-card="Cta" data-start="5"/);
    const json = html.match(/<script type="application\/json" class="mo-props">(.*?)<\/script>/s)[1];
    assert.equal(JSON.parse(json).props.main, 'X');
  });
  test('--no-cards omits hosts and card scripts', () => {
    const html = buildHtml(props, {...opts, cards: false});
    assert.doesNotMatch(html, /data-card=/);
    assert.doesNotMatch(html, /cards\//);
  });
  test('one audio clip with the baseline audio over the whole video', () => {
    assert.match(buildHtml(props, opts), /<audio[^>]*src="assets\/baseline\.wav"[^>]*data-start="0"[^>]*data-duration="7"/);
  });
  test('unsupported placement fails loudly', () => {
    const bad = structuredClone(props); bad.scenes[0].motion[0].position = 'top';
    assert.throws(() => buildHtml(bad, opts), /pilot supports position "free" only/);
  });
  ```
- [ ] **Step 2: Run, expect FAIL.** `node --test tools/hyperframes/` → fails: cannot import `./build.mjs`.
- [ ] **Step 3: Implement `build.mjs`.** Exports `esc(s)`, `allocTracks(clips, base)`, `buildHtml(props, opts)`; a
  `main` runs when invoked as a script. Core pieces (complete these; the visual details come from the studio files
  listed above):
  ```js
  // render-props.json -> HyperFrames index.html. Pilot: covers only what demo-card-moi uses; anything else throws.
  import {readFileSync, writeFileSync} from 'node:fs';
  import path from 'node:path';
  import {fileURLToPath} from 'node:url';

  export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const sec = x => String(+x.toFixed(3));

  /** Lowest track >= base whose last clip has ended; clips are taken in start order, result keeps input order. */
  export function allocTracks(clips, base) {
    const ends = [], out = new Array(clips.length);
    [...clips.keys()].sort((a, b) => clips[a].start - clips[b].start).forEach(k => {
      const c = clips[k];
      let i = ends.findIndex(e => e <= c.start + 1e-6);
      if (i < 0) i = ends.push(0) - 1;
      ends[i] = c.start + c.duration;
      out[k] = base + i;
    });
    return out;
  }
  ```
  `buildHtml` builds, in this layer order (each group gets its own track range so higher groups draw in front):
  1. **Footage** (tracks from 0): for each scene and media item, absolute start `scene.start + item.start` and
     duration exactly as FastCut/MediaShot/SceneTransition place them (including the fade overlap/tail of
     `transitionSeconds`); `<video class="clip" src="<opts.media(src)>" data-media-start="<from>" muted playsinline>`;
     `object-fit: cover`; the blurred background fill exactly as `MediaShot.tsx` draws it; `effect`
     (`zoom-in|zoom-out|pan-left|pan-right`, values from `studio/src/effects.ts`) as a GSAP tween over the clip;
     `fade` as opacity tweens on the incoming clip. Image items (`type: "image"`) use `<img class="clip">`.
     Throw `pilot supports transition "<t>"?` style errors for anything other than `cut|fade`.
  2. **Card hosts** (`opts.cards` only; next track range): the contract above. `position` other than `free` throws
     `pilot supports position "free" only`.
  3. **Captions** (next range): one `<div class="clip cap">` per chunk at `scene.start + chunk.start` for
     `end − start`; words escaped with `esc`; words in `scene.highlight` wrapped in `<span class="hl">`; style,
     safe area, box and auto-fit (shrink until it fits) as `Captions.tsx` does; any caption animation it has, as GSAP.
  4. **CTA host** (`opts.cards` only; top track) at the sum of scene durations for `cta.duration`.
  5. **Audio**: `<audio src="<opts.audio>" data-start="0" data-duration="<totalSeconds>" data-track-index="<own>">`.
  Head: `@font-face` for the Be Vietnam Pro (and Barlow Condensed, if the cards need it) woff2 files referenced
  as `assets/fonts/<file>`, root 1080×1920 black background, `<script src="<opts.gsap>">`.
  `main`: reads `<project>/render-props.json`; `opts.media` = relative path to the repo file (footage mode
  `in-place`) or copies the used files into `<project>/hyperframes/assets/media/` (mode `copy`); copies the font
  files and `node_modules/gsap/dist/gsap.min.js` into `assets/`; writes `<project>/hyperframes/index.html`.
- [ ] **Step 4: Run, expect PASS.** `node --test tools/hyperframes/` → all tests pass.
- [ ] **Step 5: Check the frame on the real project.**
  `node tools/hyperframes/build.mjs projects/2026-11-20-demo-card-moi --no-cards`, then
  `HYPERFRAMES_NO_TELEMETRY=1 tools/hyperframes/node_modules/.bin/hyperframes lint projects/2026-11-20-demo-card-moi/hyperframes`
  (expected: no errors), then a draft render
  `… render projects/2026-11-20-demo-card-moi/hyperframes --gpu --browser-gpu -q draft -o projects/2026-11-20-demo-card-moi/compare/frame-draft.mp4`.
  Expected: 801 frames. Extract frames at the middle of each scene and at 1.717 s (first cut) from both this file and
  `reel-v4.mp4` into `compare/frame-check/` and look at the pairs: same shots, same crop, captions in the same place
  and size, fades at the same times.
- [ ] **Step 6: Commit.**
  ```bash
  git add tools/hyperframes/build.mjs tools/hyperframes/build.test.mjs
  git commit -m "Add HyperFrames generator for the pilot reel"
  ```
  (The real `index.html` is committed in Task 3, generated with cards.)

### Task 3: Cards — `layer.js`, `Stamp`, `Checklist`, `Picture`, `OfferCard`, `Cta`

**Files:**
- Create: `projects/2026-11-20-demo-card-moi/hyperframes/cards/{layer.js,Stamp.js,Checklist.js,Picture.js,OfferCard.js,Cta.js,cards.css}`
- Generated (commit): `projects/2026-11-20-demo-card-moi/hyperframes/index.html`
- Read first: the HyperFrames skill path in the report "Setup"; `studio/src/components/MotionLayer.tsx`
  (placement, enter/exit, scale/rotate/opacity, backdrop, colors), `studio/src/components/CtaCard.tsx`,
  `studio/src/motion/{Stamp,Checklist,Picture,OfferCard}.tsx`, `studio/src/motion/{style,schema}.ts`, `studio/src/fit.ts`;
  `docs/superpowers/specs/2026-11-20-card-style-design.md` (the card style); the `props` of each layer in
  `projects/2026-11-20-demo-card-moi/render-props.json`.

**Interfaces:**
- Consumes: the Task 2 contract (`window.__hf`, `window.__hfCards`, host attributes, `.mo-props` JSON, `t0`).
- Produces: `window.__hfCards.<Name> = (host, item, t0) => void` for the five names; `layer.js` exposes
  `window.__hfLayer(host, item, t0)` that applies `enter`/`exit` (`none|fade|pop|…` as MotionLayer defines them,
  with each card's `ownsExit` from `studio/src/motion/registry.ts`), `scale`, `rotate`, `opacity`, `backdrop` and
  `colors`, called by every card.

- [ ] **Step 1: Layer helper.** Write `cards/layer.js` mirroring `MotionLayer.tsx` (same durations, easing feel,
  start/end times; GSAP eases instead of Remotion springs are fine).
- [ ] **Step 2: Cards.** One file per card. Content, brand colors, fonts, sizes, layout and the timing of inner steps
  (e.g. Checklist `itemsAt`/`itemTimes` voice sync, Stamp shape) match the Remotion component; text is taken from
  `item.props` as is. Motion is written the GSAP way, following the HyperFrames skill. Text that must fit its box
  shrinks like `fit.ts` does.
- [ ] **Step 3: Build with cards.** `node tools/hyperframes/build.mjs projects/2026-11-20-demo-card-moi`, then
  `hyperframes lint …/hyperframes` (no errors) and a draft render to `compare/cards-draft.mp4` (801 frames, exit 0,
  no `missing card`).
- [ ] **Step 4: Compare stills.** For every card: frames at entrance + 0.2 s, middle, and exit − 0.1 s, plus the CTA
  middle, from `cards-draft.mp4` and `reel-v4.mp4` into `compare/card-check/`. Look at each pair: same text (every
  diacritic), same place and size within a few pixels, same colors, nothing cut off or covering faces more than in
  Remotion. Fix and repeat until they match.
- [ ] **Step 5: Commit.**
  ```bash
  git add projects/2026-11-20-demo-card-moi/hyperframes/index.html projects/2026-11-20-demo-card-moi/hyperframes/cards
  git commit -m "Add HyperFrames cards for the pilot reel"
  ```

### Task 4: Bench, checks, side-by-side, final version, report

**Files:**
- Create: `tools/hyperframes/bench.mjs`
- Modify: `docs/reports/2026-11-21-remotion-vs-hyperframes.md`
- Outputs (git-ignored): `projects/2026-11-20-demo-card-moi/compare/{bench.json,logs/,hf-*.mp4,side-by-side.mp4,pairs/}`;
  final `projects/2026-11-20-demo-card-moi/reel-v<N>.mp4` (HyperFrames)

**Interfaces:**
- Consumes: the committed `hyperframes/index.html` and cards; the app API (Known facts).
- Produces: `compare/bench.json` = `{remotion: {runs: [{version, seconds, ok, error}]}, hyperframes: {sweep: [{workers, seconds, ok}], best: <workers>, runs: [{file, seconds, ok, exitCode, warnings}]}, spec: {...}, stability: {...}, final: "reel-vN"}`.

Run it only when nothing else uses the GPU (no other worker, render or spike running).

- [ ] **Step 1: Write `bench.mjs`** (`node tools/hyperframes/bench.mjs projects/2026-11-20-demo-card-moi`), in this order:
  1. **Remotion ×3**, sequential: `POST /api/projects/<slug>/render`, poll `GET /api/jobs` every 1 s until that job is
     `done|failed`; record `version`, `seconds = (endedAt − startedAt)/1000`.
  2. (Deletion of these 3 versions happens in sub-step 9, after the stability comparison needs them.)
  3. **HyperFrames sweep**: one render each at `-w 2`, `-w 4`, `-w 6` and no `-w` (auto), with
     `--gpu --browser-gpu --video-bitrate 12M`, output `compare/hf-sweep-w<k>.mp4`, wall clock via
     `performance.now()` around `spawnSync`; stdout/stderr to `compare/logs/`. Best = fastest that succeeded.
  4. **HyperFrames ×3** at the best setting → `compare/hf-run-<i>.mp4`, timed the same way.
  5. **Spec check** (assert, exit non-zero on mismatch): `ffprobe -count_frames` on `reel-v4.mp4` and each HF run:
     h264, 1080×1920, 30/1, `nb_read_frames` = 801 for all, bitrate within 10–14 Mbps; audio stream present.
  6. **Stability**: per run exit code and warning lines (grep `warn|error` in logs); `ffmpeg -vf blackdetect=d=0.1`
     and `freezedetect=n=0.001:d=0.5` on `reel-v4.mp4` and `hf-run-1.mp4` (list intervals; frozen intervals that
     match a still image or a deliberate hold in the storyboard are expected, note them as such);
     frames at every scene boundary (frame `round(scene.start × 30)` −1, 0, +1) from both engines into
     `compare/pairs/boundary-*`; run-to-run consistency: `ffmpeg -lavfi ssim` and `psnr` between `hf-run-1` and
     `hf-run-2`, and between the first two Remotion bench renders.
  7. **Visual pairs**: frames at the middle of each scene, each card's entrance + 0.2 s and exit − 0.1 s, and the CTA
     middle, from `reel-v4.mp4` and `hf-run-1.mp4` into `compare/pairs/` (`<t>-remotion.png`, `<t>-hf.png`).
  8. **Side-by-side**: `ffmpeg -i reel-v4.mp4 -i hf-run-1.mp4 -filter_complex "[0:v][1:v]hstack=inputs=2,scale=1080:-2[v]" -map "[v]" -map 0:a -c:v libx264 -crf 18 -c:a copy compare/side-by-side.mp4`.
  9. **Delete only the versions the 3 Remotion bench jobs returned**, via `DELETE /api/projects/<slug>/renders/<v>`.
     Guards, each a hard error before any delete: the version came from this run's job results; its number is
     greater than 4; it is not `project.json` `approved`. Never delete anything else.
  10. **Final version**: next N = 1 + max over `reel-v(\d+)\.(mp4|tmp\.mp4|storyboard\.json)` files in the project dir
     and the keys of `project.json` `renders` and `published` (mirrors `app/server/versions.ts`); assert
     `reel-v<N>.mp4` does not exist; copy `hf-run-1.mp4` there. Confirm it is listed by
     `GET /api/projects/<slug>` (`versions`).
  11. Write `compare/bench.json`.
- [ ] **Step 2: Run it** with the GPU otherwise idle. Expected: exit 0, `bench.json` complete.
- [ ] **Step 3: Look at the pairs** in `compare/pairs/` and the side-by-side at a few moments; write what differs
  (motion feel, footage handling, blur fill, encode artifacts, caption/card placement).
- [ ] **Step 4: Fill the report** `docs/reports/2026-11-21-remotion-vs-hyperframes.md`: speed table (Remotion
  baseline job 16.1 s as first-in-session, bench median; HF sweep, best workers, first run, median), spec check,
  stability observations (with the "one 27 s video, observations not a verdict" caveat), visual notes, which
  `reel-vN` is which engine, limits (HF audio mixing not tested; Remotion time includes the cached voice check;
  sharpness equal by construction).
- [ ] **Step 5: Commit.**
  ```bash
  git add tools/hyperframes/bench.mjs docs/reports/2026-11-21-remotion-vs-hyperframes.md
  git commit -m "Add HyperFrames vs Remotion bench and pilot report"
  ```

---

## Ledger

| Task | Agent | Status | Notes |
| --- | --- | --- | --- |
| 1 Spike | worker-sonnet | pending | go/no-go gate |
| 2 Generator | worker-sonnet | pending | after 1 = GO |
| 3 Cards | worker-sonnet | pending | after 2 |
| 4 Bench + report | worker-sonnet (review: worker-opus, it deletes versions) | pending | after 3; GPU idle |
| Final review | main session | pending | full diff, full tests, spec check |
