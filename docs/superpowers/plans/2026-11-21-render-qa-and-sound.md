# Render QA + sound upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parts 1 and 2 of `docs/superpowers/specs/2026-11-21-story-videos-design.md`: true-peak-safe app renders, a
post-render QA step, and sound upgrades (per-template config layer, SFX on cuts/clip changes, music drops, held SFX
for counters, new SFX groups).

**Architecture:** Python `tools/reel` resolves config and builds `render-props.json`; Remotion (`studio/`) plays it;
the app (`app/server/render.ts`) renders. Every new sound behaviour defaults to off so existing reels are unchanged.

**Tech Stack:** Python 3 + pytest (`tools/tests`), TypeScript + Remotion 4 (`studio/`), Node + vitest (`app/`), ffmpeg 8.

## Global Constraints

- Course-promo reels must sound and look exactly as before: new keys default to `"none"`/absent.
- `VieNeu-TTS/` is upstream: never edit.
- Another session may have uncommitted files in this tree (`studio/src/templates/{slideshow,split-compare,testimonial}/`,
  `studio/src/templates/index.ts`, `projects/2026-11-21-so-sanh-toi-da/`). Never edit, stage or revert them.
  Stage only your own files by explicit path.
- Commit messages: one line, no body, no Co-Authored-By.
- Per task run only the tests for touched modules:
  Python `uv run --with pytest python -m pytest tools/tests/<file> -q`; studio `cd studio && npx tsc --noEmit`;
  app `cd app && npx vitest run <file> && npx tsc --noEmit`.

## Dependency / parallel groups

- Wave 1 (parallel): Task 1 (app only), Task 4 (config/props/duck).
- Wave 2: Task 2 (after 4: both edit `tools/reel/props.py`, `config.json`, `app/shared/types.ts`; staging by path
  would mix their changes).
- Wave 3: Task 3 (after 2: same function `_sfx_events`).
- Tasks 5 and 6 are done by the main session; 6 needs user approval of downloads.

---

### Task 1: True-peak limiter in app renders

**Files:**
- Modify: `app/server/render.ts` (after the `renderMedia` / `renderChunked` call, before `rename(tmp, …)`, ~line 100-107)
- Test: `app/server/render.test.ts`

**Interfaces:**
- Produces: `export const limiterArgs = (src: string, dst: string): string[]`

- [ ] **Step 1: failing test** in `app/server/render.test.ts`:

```ts
import {chunkRanges, limiterArgs} from './render.ts';

describe('limiterArgs', () => {
  it('copies video and limits audio peaks to -1.5 dBFS', () => {
    const a = limiterArgs('in.tmp.mp4', 'out.lim.mp4');
    expect(a.slice(0, 4)).toEqual(['-v', 'error', '-y', '-i']);
    expect(a).toContain('in.tmp.mp4');
    expect(a.join(' ')).toContain('-c:v copy');
    expect(a.join(' ')).toMatch(/alimiter=limit=0\.84\d*:level=disabled/);  // 10^(-1.5/20) = 0.841
    expect(a.join(' ')).toContain('-c:a aac');
    expect(a.at(-1)).toBe('out.lim.mp4');
  });
});
```

- [ ] **Step 2:** `cd app && npx vitest run server/render.test.ts` → FAIL (`limiterArgs` not exported).
- [ ] **Step 3: implement** in `render.ts`:

```ts
const PEAK_DBFS = -1.5; // platform spec is <= -1 dBTP; alimiter works on sample peaks, so keep 0.5 dB margin
/** ffmpeg args: video stream copied, audio through a peak limiter (integrated loudness unchanged). */
export const limiterArgs = (src: string, dst: string): string[] => [
  '-v', 'error', '-y', '-i', src, '-map', '0', '-c:v', 'copy',
  '-af', `alimiter=limit=${(10 ** (PEAK_DBFS / 20)).toFixed(3)}:level=disabled:attack=1:release=50`,
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', dst,
];
```

  In `renderVersion`, after the render call and `ctx.signal.throwIfAborted()`:

```ts
    ctx.progress(0.99, 'Giới hạn đỉnh âm thanh');
    const limited = safeJoin('projects', slug, `${name}.lim.mp4`);
    try { await execFileP('ffmpeg', limiterArgs(tmp, limited)); }
    catch (e) { await rm(limited, {force: true}); throw e; }
    await rename(limited, tmp);
```

  (The existing `catch` already removes `tmp` and the snapshot on any error, so a failed limiter creates no
  `reel-v<N>`.) Keep sample rate/channels as ffmpeg defaults from the input (do not pass `-ar`/`-ac`).
- [ ] **Step 4:** `cd app && npx vitest run server/render.test.ts && npx tsc --noEmit` → PASS.
- [ ] **Step 5:** commit `git add app/server/render.ts app/server/render.test.ts && git commit -m "Limit audio peaks to -1.5 dBFS in app renders"`.

Report: test output; do NOT run a real render (main session does it).

---

### Task 2: SFX on hard cuts and clip changes

**Files:**
- Modify: `tools/reel/props.py` `_sfx_events` (~line 157-181)
- Modify: `config.json` `sfx` (add `"cut": "none", "media": "none"`)
- Modify: `app/shared/types.ts:88` (`sfx` config type: add `cut: string | null; media: string | null`)
- Modify: spec `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` "Sound effects" Events bullet: add the two events.
- Test: `tools/tests/test_props.py`

**Interfaces:**
- Consumes: scene dicts as built in `build_render_props` (`start`, `transition`, `media[i]["start"]` relative to the scene).
- Produces: config keys `sfx.cut`, `sfx.media` (value kinds same as `sfx.scene`).

- [ ] **Step 1: failing tests** (append to `test_props.py`, reuse `_sfx`, `_sb`, `SFX`, `FILES`):

```python
def test_sfx_hard_cut_and_media_change_events():
    sfx = {**SFX, "scene": "none", "cut": "whoosh", "media": "pop", "minGap": 0.0, "motion": {}}
    sb = _sb()
    sb["scenes"][0]["media"] = [{"src": "a.mp4", "duration": 1.0}, {"src": "b.mp4"}]  # clip change at 1.0
    ev, _ = _sfx(sb, sfx)
    # s1 first scene: no cut sound; clip change at 1.0; s2 starts at 3.0 with transition "cut" -> whoosh;
    # s3 (cut, no media) at 6.0 -> whoosh (rotates)
    assert ev == [(1.0, "sfx/pop-a.mp3"), (3.0, "sfx/whoosh-a.mp3"), (6.0, "sfx/whoosh-b.mp3")]


def test_sfx_cut_and_media_default_off():
    sb = _sb()
    sb["scenes"][0]["media"] = [{"src": "a.mp4", "duration": 1.0}, {"src": "b.mp4"}]
    ev, _ = _sfx(sb, {**SFX, "motion": {}})   # SFX has no cut/media keys
    assert all("whoosh" not in s or t != 6.0 for t, s in ev) and (1.0, "sfx/pop-a.mp3") not in ev
```

  Check `_sb()`'s s1 transition is `fade` and s1 is first, so `scene` must not fire for it; adjust expected values if
  the fixture's durations differ (s1/s2 have 3.0 s audio, s3 duration 2). The lead when the peak is unknown is 0.0 for
  these events.
- [ ] **Step 2:** `uv run --with pytest python -m pytest tools/tests/test_props.py -q` → FAIL.
- [ ] **Step 3: implement** in the scene loop of `_sfx_events`:

```python
        if i and sc["transition"] == "cut":
            ev.append((sc["start"], sfx.get("cut"), False, 0.0))
        for k, m in enumerate(sc["media"]):
            if k:
                ev.append((sc["start"] + m["start"], sfx.get("media"), False, 0.0))
```

  (Keep the existing `!= "cut"` scene branch; scene-level `sfx` override still applies only to non-cut transitions.)
  Add `"cut": "none", "media": "none"` to `config.json` `sfx`.
- [ ] **Step 4:** pytest `tools/tests/test_props.py` → PASS; `cd app && npx tsc --noEmit` → PASS.
- [ ] **Step 5:** commit only `tools/reel/props.py tools/tests/test_props.py config.json app/shared/types.ts docs/superpowers/specs/2026-11-18-reel-pipeline-design.md`:
  `git commit -m "Add SFX events for hard cuts and clip changes"`.

---

### Task 3: Hold an SFX for the layer length (counter tick)

Depends on Task 2 (same function).

**Files:**
- Modify: `tools/reel/props.py` `_sfx_events`
- Create: `studio/src/components/SfxTrack.tsx`
- Modify: `studio/src/templates/fast-cut/FastCut.tsx` (replace the inline `p.sfx` map with `<SfxTrack sfx={p.sfx ?? []} />`)
- Modify: `studio/src/types.ts:41` (`sfx?: {src: string; start: number; volume: number; until?: number}[]`)
- Modify: `app/shared/types.ts` sfx config type: `hold?: string[]`
- Test: `tools/tests/test_props.py`

**Interfaces:**
- Produces: config `sfx.hold: string[]` (group names); SFX event field `until` (absolute seconds);
  `SfxTrack: React.FC<{sfx: {src; start; volume; until?}[]}>` (other templates may adopt it).

- [ ] **Step 1: failing test:**

```python
def test_sfx_hold_group_lasts_the_layer():
    files = FILES + ["tick-a.mp3"]
    sfx = {**SFX, "motion": {"CountUp": "tick"}, "hold": ["tick"], "minGap": 0.0}
    _, p = _sfx(_sb(), sfx, files)
    tick = next(x for x in p["sfx"] if x["src"] == "sfx/tick-a.mp3")
    count = p["scenes"][2]["motion"][0]
    assert tick["until"] == round(p["scenes"][2]["start"] + count["start"] + count["duration"], 3)
    assert all("until" not in x for x in p["sfx"] if x is not tick)
```

- [ ] **Step 2:** pytest → FAIL.
- [ ] **Step 3: implement:** carry the layer end on motion events (scene layers: `sc["start"] + m["start"] + m["duration"]`;
  track layers: `m["start"] + m["duration"]`) as a 5th tuple field (None for other events). When emitting, if the
  value is a group name in `sfx.get("hold", [])`, add `"until": round(end, 3)`. A held event's `start` uses lead 0
  (start on the layer start, no peak alignment).
  `SfxTrack.tsx`:

```tsx
// sound effects; a held one (until) stops at its layer end with a 0.1 s fade
import React from 'react';
import {Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';

type Sfx = {src: string; start: number; volume: number; until?: number};
export const SfxTrack: React.FC<{sfx: Sfx[]}> = ({sfx}) => {
  const {fps} = useVideoConfig();
  return <>{sfx.map((x, i) => {
    const len = x.until === undefined ? undefined : Math.max(1, Math.round((x.until - x.start) * fps));
    const fade = Math.round(0.1 * fps);
    const volume = len === undefined ? x.volume : (f: number) => x.volume * Math.min(1, Math.max(0, (len - f) / fade));
    return (
      <Sequence key={`sfx-${i}`} from={Math.round(x.start * fps)} durationInFrames={len} name={`sfx:${x.src}`}>
        <Audio src={staticFile(x.src)} volume={volume} />
      </Sequence>
    );
  })}</>;
};
```

- [ ] **Step 4:** pytest `test_props.py` → PASS; `cd studio && npx tsc --noEmit` → PASS; `cd app && npx tsc --noEmit` → PASS.
  Render one still of an existing project to confirm FastCut still renders:
  `cd studio && npx remotion still Reel /tmp/sfx-check.png --frame=30 --props=../projects/2026-11-20-demo-card-moi/render-props.json` → exit 0.
- [ ] **Step 5:** commit own files: `git commit -m "Hold SFX for the layer length via sfx.hold and SfxTrack"`.

---

### Task 4: Per-template config layer + music drops

**Files:**
- Modify: `tools/reel/config.py` (new `apply_template`; module docstring order)
- Modify: `tools/reel/pipeline.py` (`prepare`: `cfg = apply_template(cfg, sb)` right after loading both)
- Modify: `tools/reel/validate.py` (same, where it loads config)
- Modify: `tools/reel/props.py` `build_render_props` (resolve `storyboard["musicDrop"]`)
- Modify: `studio/src/components/duck.ts`, `studio/src/types.ts` (`Music` gains `drops?: [number, number, number][]`)
- Modify: `app/shared/types.ts` (storyboard type: `musicDrop?: {start: Json; end: Json; to?: number}[]`; config: `templates?: Record<string, Json>`)
- Modify: `config.json` (add `"templates": {}`)
- Modify: `CLAUDE.md` rule 2 (add: "từ giờ video <template>…" -> `config.json` `templates.<template>`)
- Modify: `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` "Layered config" order line
- Test: `tools/tests/test_config.py`, `tools/tests/test_props.py`, `app/src/screens/Editor/musicDuck.test.ts`

**Interfaces:**
- Produces: `apply_template(config: dict, storyboard: dict) -> dict` (config with `config["templates"][template]`
  deep-merged over the root; `templates` key itself kept); render props `music.drops: [[start, end, to], …]`
  (absolute seconds, sorted); `musicVolumeAt` honours `music.drops`.

- [ ] **Step 1: failing tests.**
  `test_config.py`:

```python
from reel.config import apply_template

def test_apply_template_layer():
    cfg = {"defaults": {"template": "fast-cut", "brand": "b", "voice": "v"},
           "sfx": {"volume": 0.5, "cut": "none"}, "templates": {"story": {"sfx": {"cut": "whoosh"}}}}
    assert apply_template(cfg, {})["sfx"]["cut"] == "none"
    out = apply_template(cfg, {"template": "story"})
    assert out["sfx"] == {"volume": 0.5, "cut": "whoosh"}
    assert apply_template({k: v for k, v in cfg.items() if k != "templates"}, {"template": "story"})["sfx"]["cut"] == "none"
```

  `test_props.py` (use the existing `SPOKEN`, `SETTINGS`, `BRAND`, `VOICE`, `WORDS` fixtures; SETTINGS must have a
  music dict — if it has `music: None`, pass `{**SETTINGS, "music": {"file": "m.mp3", "volume": 0.6, "duckTo": 0.2, "fadeOut": 1.5}}`):

```python
def test_music_drop_resolves_word_anchors():
    music = {"file": "m.mp3", "volume": 0.6, "duckTo": 0.2, "fadeOut": 1.5}
    sb = {**SPOKEN, "musicDrop": [{"start": {"scene": "a", "at": "khóa"}, "end": {"scene": "b", "edge": "end"}}]}
    p = build_render_props(sb, {**SETTINGS, "music": music}, BRAND, VOICE, {"a": WORDS})
    (a, b, to), = p["music"]["drops"]
    assert to == 0 and a < b
    bad = {**SPOKEN, "musicDrop": [{"start": {"scene": "zz"}, "end": "video"}]}
    with pytest.raises(AnchorError) as e:
        build_render_props(bad, {**SETTINGS, "music": music}, BRAND, VOICE, {"a": WORDS})
    assert any("musicDrop[0]" in x and "unknown scene 'zz'" in x for x in e.value.problems)
```

  `musicDuck.test.ts`:

```ts
  it('drops to the drop level between start and end, ramping 0.15 s', () => {
    const m = {...music, drops: [[5, 7, 0]] as [number, number, number][]};
    expect(musicVolumeAt(6, m, [], 20)).toBe(0);
    expect(musicVolumeAt(4, m, [], 20)).toBe(music.volume);
    expect(musicVolumeAt(5 - 0.075, m, [], 20)).toBeCloseTo(music.volume / 2, 5);
    expect(musicVolumeAt(8, m, [], 20)).toBe(music.volume);
  });
```

- [ ] **Step 2:** run the three test files → FAIL.
- [ ] **Step 3: implement.**
  `config.py`:

```python
def apply_template(config: dict, storyboard: dict) -> dict:
    """Layer config.templates.<template> over the root config (see spec "Layered config")."""
    template, _ = resolve_names(config, storyboard)
    return deep_merge(config, (config.get("templates") or {}).get(template))
```

  Update the module docstring order: `config.json -> config.templates.<template> -> config.voices.<voice> -> brand -> storyboard -> scene`.
  In `pipeline.prepare` and `validate.py`, apply it once right after config and storyboard are loaded, so every
  later `resolve_*` call sees the merged config.
  `props.py` in `build_render_props`, after `overlays = _track(...)` and before `if problems:`:

```python
    by_id = {s["id"]: s for s in scenes}
    drops = []
    for i, d in enumerate(storyboard.get("musicDrop") or []):
        a = _track_time(d.get("start", 0), by_id, words, captions, total, f"musicDrop[{i}] start", problems, end=False)
        b = _track_time(d.get("end", "video"), by_id, words, captions, total, f"musicDrop[{i}] end", problems, end=True)
        if a is not None and b is not None and b > a:
            drops.append([round(a, 3), round(b, 3), float(d.get("to", 0))])
```

  and add `"drops": sorted(drops)` to the `music` dict in the return (only when music is not None).
  `duck.ts`:

```ts
const DROP_RAMP = 0.15; // seconds
// ... at the end of musicVolumeAt, before the fade-out return:
  for (const [a, b, to] of music.drops ?? []) {
    const d = t < a ? a - t : t > b ? t - b : 0;
    if (d < DROP_RAMP) v = Math.min(v, to + (v - to) * (d / DROP_RAMP));
  }
```

  (`v` here is the ducked level, so the drop ramps from whatever the music was doing.) `types.ts` `Music`:
  `drops?: [number, number, number][]`.
- [ ] **Step 4:** pytest `test_config.py test_props.py test_pipeline.py test_validate.py`, `cd app && npx vitest run src/screens/Editor/musicDuck.test.ts && npx tsc --noEmit`, `cd studio && npx tsc --noEmit` → PASS.
  Config is shared core: also run the full Python suite `uv run --with pytest python -m pytest tools/tests -q`.
- [ ] **Step 5:** commit own files: `git commit -m "Add per-template config layer and storyboard music drops"`.

---

### Task 5 (main session): docs for post-render QA (spec 1b)

- CLAUDE.md rule 7: append "After every render: `python3 .claude/skills/ffmpeg-skill/scripts/check.py <mp4> --platform tiktok`
  and `python3 .claude/skills/ffmpeg-skill/scripts/look.py <mp4> --safe tiktok -o projects/<slug>/preview/safe.png`;
  look at the sheet; report FAILs and anything inside the shaded zones." Also note under Render: client deliveries go
  through the app (the CLI command skips the peak limiter).
- `/make-reel` step 6: same check.
- Commit: `Add post-render platform and safe-zone check`.

### Task 6 (main session, needs user approval): SFX files + story defaults

- Find 3–4 `impact` and 3–4 `tick` (counter roll, ≥ 2 s) sounds on Mixkit; list title/id/link to the user; download
  approved ones as `sfx/impact-<slug>.mp3`, `sfx/tick-<slug>.mp3`; add rows to `sfx/SOURCES.md`.
- `config.json` `templates.story`: `{"sfx": {"cut": "whoosh", "media": "click", "minGap": 0.4, "cta": "impact",
  "hold": ["tick"], "motion": {"CountUp": "tick"}}}`.

### Final (main session)

- Full suites: `uv run --with pytest python -m pytest tools/tests -q`, `cd studio && npx tsc --noEmit`,
  `cd app && npm test && npx tsc --noEmit`.
- Re-render `2026-11-20-demo-card-moi` via the app → `reel-v5`; `check.py --platform tiktok` true peak ≤ −1 dBTP;
  same storyboard so it must sound like `reel-v4` (no new SFX).
