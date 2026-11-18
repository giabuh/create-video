# Reel Pipeline Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude-driven pipeline in `/home/giabao/dev/create-video` that turns a `storyboard.json` (student footage + Remotion motion graphics + Vietnamese voice-over) into a 1080×1920 MP4 reel, portable to another Linux machine via GitHub + Google Drive.

**Architecture:** Python tools (stdlib-only pure modules in `tools/reel/`, plus a VieNeu-backed TTS module) validate the storyboard, resolve layered config, synthesize cached per-scene audio, and write a fully resolved `render-props.json`. A Remotion 4 project in `studio/` reads that file (through symlinks in `studio/public/`) and renders it with one style template plus a growing library of motion components. Shell scripts handle setup and Drive sync.

**Tech Stack:** Python 3.12 (VieNeu-TTS `.venv` for TTS; system `python3` for stdlib tools), pytest via `uv run --with pytest`, VieNeu-TTS v3 Turbo (git submodule @ `22dd2ef`), Remotion 4.0.544 + React 19 + TypeScript 5.9, FFmpeg 8 (system), rclone (remote `video-syn`).

**Spec:** `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md`

## Global Constraints

- Repo root: `/home/giabao/dev/create-video` (all paths below are relative to it).
- `VieNeu-TTS/` is upstream code: never edit files inside it.
- Remotion packages pinned exactly at `4.0.544`: `remotion`, `@remotion/cli`, `@remotion/media`, `@remotion/google-fonts`.
- Video defaults: 1080×1920, 30 fps; draft renders use `--scale=0.5`.
- Font: Be Vietnam Pro via `loadFont('normal', {weights: ['400','700','800'], subsets: ['vietnamese','latin']})` from `@remotion/google-fonts/BeVietnamPro`.
- Remotion gotchas (from spike):
  - `@remotion/media` `<Video>` takes `objectFit` as a prop (ignored inside `style`).
  - Clips are always `muted`.
  - Voice and music play through `<Audio>`.
- `render-props.json` times are seconds (floats). Remotion converts them with `Math.round(seconds * fps)`.
- All media paths in `render-props.json` are relative to `studio/public/`, which holds committed symlinks: `library → ../../library`, `music → ../../music`, `brands → ../../brands`, `projects → ../../projects`.
- Pure Python modules in `tools/reel/` import only the stdlib. Only `tools/reel/tts.py` touches `vieneu`, and only inside functions.
- JSON is written with `ensure_ascii=False, indent=2` (Vietnamese text stays readable).
- Python tests: `uv run --with pytest python -m pytest tools/tests -q` from the repo root.
- Testing cadence: per task, run only the tests for the files you touched. Run the full suite only at final review.
- Git: stage only your own files by explicit path. Commit messages are a single line with no body and no Co-Authored-By trailer.
- Never invent ad facts (price, phone, dates, address) in any sample/fixture: use obvious placeholders like `0900 000 000`.

## File Structure

```
.gitignore / .gitmodules                 T1
config.json                              T1  layered defaults
brands/demo/brand.json                   T1  sample brand
voices/{phuong,vy}-{short,full}.wav      T1  committed references (already cut)
tools/make_smoke_media.sh                T1  generates throwaway test media
tools/reel/__init__.py                   T2
tools/reel/config.py                     T2  load_json, deep_merge, pick, resolve_names, resolve_scene_voice, resolve_video
tools/reel/validate.py                   T2  validate(storyboard, config, root) -> list[str]
tools/reel/cache.py                      T2  cache_key(ref_bytes, say, tts) -> str
tools/tests/conftest.py                  T2  sys.path + cfg fixture
tools/tests/test_config.py, test_validate.py, test_cache.py   T2
tools/reel/captions.py                   T3  chunk_caption
tools/reel/mix.py                        T3  mix
tools/reel/props.py                      T3  build_render_props
tools/tests/test_captions.py, test_mix.py, test_props.py      T3
tools/reel/tts.py                        T4  load_model, synth_to_file, probe_duration
tools/prepare.py                         T4  CLI
tools/voice_try.py                       T4  CLI
projects/_smoke/storyboard.json          T4  smoke project
tools/ingest.py                          T5  inbox → library + thumbs + index skeleton
tools/tests/test_ingest.py               T5
studio/ (Remotion project)               T6  Root, Reel, types, fonts, components/, templates/fast-cut/, motion/registry.ts, fixtures/smoke-props.json
studio/src/motion/*.tsx                  T7  KineticText, CountUp, Checklist, PriceTag, DateBadge, LowerThird
setup.sh, tools/sync.sh                  T8
CLAUDE.md, .claude/skills/make-reel/SKILL.md, Remotion agent skills   T9
```

## Execution waves

- **Wave 1:** T1 (main session, small).
- **Wave 2 (parallel):** T2, T3, T5, T6. T3 does not import T2 code.
- **Wave 3 (parallel):** T4 (needs T2 and T3), T7 (needs T6).
- **Wave 4 (parallel):** T8 (needs T1 and T6), T9 (needs all).

---

### Task 1: Repo foundation (main session)

**Files:**
- Create: `.gitmodules` (via `git submodule add`), `config.json`, `brands/demo/brand.json`, `tools/make_smoke_media.sh`
- Modify: `.gitignore`
- Commit: `voices/phuong-short.wav`, `voices/phuong-full.wav`, `voices/vy-short.wav`, `voices/vy-full.wav`

**Interfaces:**
- Produces:
  - `config.json` with the shape below (all later tasks read it).
  - `brands/demo/brand.json`.
  - Smoke media: `library/_smoke-landscape.mp4`, `library/_smoke-portrait.mp4`, `library/_smoke.jpg`, `music/_smoke.mp3`, `projects/_smoke/audio/_fixture-voice.wav`.

- [ ] **Step 1: Register VieNeu-TTS as a submodule (reuses the existing clone)**

```bash
cd /home/giabao/dev/create-video
git submodule add https://github.com/pnnbao97/VieNeu-TTS VieNeu-TTS
git config -f .gitmodules submodule.VieNeu-TTS.ignore untracked
git submodule status   # expect: 22dd2ef2a89bba24a77da6dbc84c75f7f4fda05b VieNeu-TTS ...
```

- [ ] **Step 2: Write `config.json`**

```json
{
  "defaults": { "voice": "phuong", "template": "fast-cut", "brand": "demo" },
  "tts": {
    "temperature": 0.8, "top_k": 25, "top_p": 0.95,
    "repetition_penalty": 1.2, "max_chars": 256, "batch_size": 16,
    "silence_p": 0.15, "denoise": true,
    "speed": 1.0,
    "pauseAfter": 0.3
  },
  "voices": {
    "phuong": { "ref": "voices/phuong-short.wav" },
    "vy": { "ref": "voices/vy-short.wav" }
  },
  "video": { "fps": 30, "width": 1080, "height": 1920, "draftScale": 0.5 },
  "music": { "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5 },
  "captions": { "font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400", "maxWords": 6 },
  "mix": { "real": 0.6, "motion": 0.3, "other": 0.1 },
  "sync": { "remote": "video-syn:create-video" }
}
```

- [ ] **Step 3: Write `brands/demo/brand.json`**

```json
{
  "name": "Demo Academy",
  "logo": null,
  "colors": { "primary": "#1E3A8A", "accent": "#FFD400", "text": "#FFFFFF", "background": "#0B1530" },
  "cta": { "phone": "0900 000 000", "fanpage": "fb.com/demo", "address": "" }
}
```

- [ ] **Step 4: Write `tools/make_smoke_media.sh` and run it**

```bash
#!/usr/bin/env bash
# Generates throwaway test media for tests and the _smoke project. Safe to rerun.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p library music projects/_smoke/audio
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
ff -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440 -t 6 \
   -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest library/_smoke-landscape.mp4
ff -f lavfi -i testsrc=size=1080x1920:rate=30 -t 6 -c:v libx264 -pix_fmt yuv420p library/_smoke-portrait.mp4
ff -f lavfi -i gradients=size=1600x1200:seed=7 -frames:v 1 library/_smoke.jpg
ff -f lavfi -i sine=frequency=220:duration=20 -c:a libmp3lame -q:a 4 music/_smoke.mp3
ff -f lavfi -i sine=frequency=660:duration=2.5 projects/_smoke/audio/_fixture-voice.wav
echo "smoke media ready"
```

Run: `chmod +x tools/make_smoke_media.sh && tools/make_smoke_media.sh`
Expected: `smoke media ready`, and the 5 files exist.

- [ ] **Step 5: Commit**

```bash
git add .gitmodules VieNeu-TTS .gitignore config.json brands/demo/brand.json tools/make_smoke_media.sh voices/*.wav
git commit -m "Add VieNeu submodule, config, demo brand, voice refs, smoke media script"
```

---

### Task 2: Config resolution, validation, cache key (pure Python)

**Files:**
- Create: `tools/reel/__init__.py` (empty), `tools/reel/config.py`, `tools/reel/validate.py`, `tools/reel/cache.py`
- Test: `tools/tests/conftest.py`, `tools/tests/test_config.py`, `tools/tests/test_validate.py`, `tools/tests/test_cache.py`

**Interfaces:**
- Consumes: `config.json` shape from T1.
- Produces:
  - `reel.config.ROOT: Path` (repo root).
  - `reel.config.TTS_KEYS: tuple[str, ...]`.
  - `load_json(path) -> dict`.
  - `deep_merge(base: dict, over: dict | None) -> dict` (returns a new dict; never mutates its inputs).
  - `pick(*values, default=None)` (returns the first value that is not None).
  - `resolve_names(config, storyboard) -> tuple[str, str]` returning `(template, brand_id)`.
  - `resolve_scene_voice(config, storyboard, scene) -> {"voice": str, "ref": str, "tts": dict, "pauseAfter": float}`. `tts` includes `speed` and excludes `pauseAfter`.
  - `resolve_video(config, brand, storyboard) -> {"template", "brand", "video", "captions", "music": dict | None}`.
  - `reel.validate.validate(storyboard, config, root) -> list[str]` (an empty list means valid).
  - `reel.cache.cache_key(ref_bytes: bytes, say: str, tts: dict) -> str` (12 hex characters).

- [ ] **Step 1: Write `tools/tests/conftest.py`**

```python
import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # makes `reel` importable

CFG = {
    "defaults": {"voice": "phuong", "template": "fast-cut", "brand": "demo"},
    "tts": {"temperature": 0.8, "top_k": 25, "speed": 1.0, "pauseAfter": 0.3},
    "voices": {
        "phuong": {"ref": "voices/phuong-short.wav", "speed": 1.05},
        "vy": {"ref": "voices/vy-short.wav", "temperature": 0.7},
    },
    "video": {"fps": 30, "width": 1080, "height": 1920, "draftScale": 0.5},
    "music": {"volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5},
    "captions": {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400", "maxWords": 6},
}


@pytest.fixture
def cfg():
    return copy.deepcopy(CFG)
```

- [ ] **Step 2: Write the failing tests `tools/tests/test_config.py`**

```python
from reel.config import deep_merge, resolve_names, resolve_scene_voice, resolve_video


def test_deep_merge_nested_and_override():
    assert deep_merge({"a": {"x": 1, "y": 2}, "b": 1}, {"a": {"y": 3}, "c": 4}) == {"a": {"x": 1, "y": 3}, "b": 1, "c": 4}


def test_deep_merge_does_not_mutate():
    base = {"a": {"x": 1}}
    deep_merge(base, {"a": {"x": 2}})
    assert base == {"a": {"x": 1}}
    assert deep_merge(base, None) == base


def test_voice_layer_order(cfg):
    v = resolve_scene_voice(cfg, {"tts": {"top_k": 30}}, {"id": "s1", "voice": "vy", "tts": {"top_k": 40}})
    assert v["voice"] == "vy" and v["ref"] == "voices/vy-short.wav"
    assert v["tts"]["temperature"] == 0.7 and v["tts"]["top_k"] == 40 and v["tts"]["speed"] == 1.0
    assert "pauseAfter" not in v["tts"] and "ref" not in v["tts"] and v["pauseAfter"] == 0.3


def test_default_voice_uses_voice_speed(cfg):
    v = resolve_scene_voice(cfg, {}, {"id": "s1"})
    assert v["voice"] == "phuong" and v["tts"]["speed"] == 1.05


def test_storyboard_voice_and_scene_pause(cfg):
    v = resolve_scene_voice(cfg, {"voice": "vy"}, {"id": "s1", "pauseAfter": 0})
    assert v["voice"] == "vy" and v["pauseAfter"] == 0.0


def test_config_not_mutated(cfg):
    resolve_scene_voice(cfg, {}, {"id": "s1"})
    assert cfg["tts"]["pauseAfter"] == 0.3 and cfg["voices"]["phuong"]["ref"] == "voices/phuong-short.wav"


def test_resolve_names(cfg):
    assert resolve_names(cfg, {}) == ("fast-cut", "demo")
    assert resolve_names(cfg, {"brand": "b2", "template": "t2"}) == ("t2", "b2")


def test_resolve_video(cfg):
    s = resolve_video(cfg, {"captions": {"highlightColor": "#00FF00"}},
                      {"music": {"file": "a.mp3", "volume": 0.1}, "captions": {"size": 80}})
    assert s["music"] == {"file": "a.mp3", "volume": 0.1, "duckTo": 0.08, "fadeOut": 1.5}
    assert s["captions"]["highlightColor"] == "#00FF00" and s["captions"]["size"] == 80
    assert (s["template"], s["brand"], s["video"]["fps"]) == ("fast-cut", "demo", 30)
    assert resolve_video(cfg, {}, {"music": None})["music"] is None
    assert resolve_video(cfg, {}, {})["music"] is None
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `uv run --with pytest python -m pytest tools/tests/test_config.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'reel'` (or `reel.config`).

- [ ] **Step 4: Implement `tools/reel/config.py`** (also create an empty `tools/reel/__init__.py`)

```python
"""Layered config: config.json -> config.voices.<voice> -> brand (visual) -> storyboard -> scene."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# kwargs passed straight to Vieneu v3 Turbo infer(); `speed` and `pauseAfter` are ours.
TTS_KEYS = ("temperature", "top_k", "top_p", "repetition_penalty", "max_chars", "batch_size", "silence_p", "denoise")


def load_json(path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def deep_merge(base: dict, over: dict | None) -> dict:
    out = dict(base)
    for k, v in (over or {}).items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def pick(*values, default=None):
    return next((v for v in values if v is not None), default)


def resolve_names(config: dict, storyboard: dict) -> tuple[str, str]:
    d = config["defaults"]
    return pick(storyboard.get("template"), d["template"]), pick(storyboard.get("brand"), d["brand"])


def resolve_scene_voice(config: dict, storyboard: dict, scene: dict) -> dict:
    name = pick(scene.get("voice"), storyboard.get("voice"), config["defaults"]["voice"])
    voice_cfg = dict(config["voices"][name])
    ref = voice_cfg.pop("ref")
    tts = deep_merge(deep_merge(deep_merge(config["tts"], voice_cfg), storyboard.get("tts")), scene.get("tts"))
    pause = pick(scene.get("pauseAfter"), tts.pop("pauseAfter", None), default=0.0)
    return {"voice": name, "ref": ref, "tts": tts, "pauseAfter": float(pause)}


def resolve_video(config: dict, brand: dict, storyboard: dict) -> dict:
    template, brand_id = resolve_names(config, storyboard)
    captions = deep_merge(deep_merge(config["captions"], brand.get("captions")), storyboard.get("captions"))
    music = storyboard.get("music")
    return {
        "template": template,
        "brand": brand_id,
        "video": deep_merge(config["video"], storyboard.get("video")),
        "captions": captions,
        "music": None if music is None else deep_merge(config["music"], music),
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run --with pytest python -m pytest tools/tests/test_config.py -q`
Expected: 8 passed.

- [ ] **Step 6: Write the failing tests `tools/tests/test_validate.py` and `tools/tests/test_cache.py`**

```python
# tools/tests/test_validate.py
import pytest

from reel.validate import validate


@pytest.fixture
def root(tmp_path):
    for d in ["studio/src/templates/fast-cut", "studio/src/motion", "brands/demo", "voices", "library", "music"]:
        (tmp_path / d).mkdir(parents=True, exist_ok=True)
    for f in ["studio/src/motion/CountUp.tsx", "brands/demo/brand.json", "voices/phuong-short.wav",
              "voices/vy-short.wav", "library/a.mp4", "music/m.mp3"]:
        (tmp_path / f).write_bytes(b"x")
    return tmp_path


GOOD = [
    {"id": "s1", "say": "Xin chào", "media": [{"src": "a.mp4"}]},
    {"id": "s2", "duration": 2, "motion": [{"component": "CountUp", "props": {}}]},
]


def test_good_storyboard(root, cfg):
    assert validate({"scenes": GOOD, "music": {"file": "m.mp3"}}, cfg, root) == []


def test_reports_all_errors_at_once(root, cfg):
    sb = {"music": {"file": "nope.mp3"}, "scenes": [
        {"id": "s1", "say": "  ", "media": [{"src": "missing.mp4", "effect": "spin"}]},
        {"id": "s1", "motion": [{"component": "Nope"}]},
        {"say": "hi", "voice": "ghost", "media": [{"src": "a.mp4"}], "transition": "wipe"},
        {"id": "s4", "overlay": {"text": "X", "position": "left"}},
    ]}
    text = "\n".join(validate(sb, cfg, root))
    for needle in ["music/nope.mp3", "s1: 'say' is empty", "library/missing.mp4", "effect 'spin'",
                   "s1: duplicate id", "'Nope'", "#3: missing id", "voice 'ghost'", "transition 'wipe'",
                   "s4: needs 'media' or 'motion'", "s4: silent scene needs 'duration'", "position 'left'"]:
        assert needle in text, needle


def test_missing_template_and_brand(root, cfg):
    errs = validate({"template": "x", "brand": "y", "scenes": GOOD}, cfg, root)
    assert any("templates/x" in e for e in errs) and any("brands/y" in e for e in errs)


def test_speed_out_of_range(root, cfg):
    assert any("speed" in e for e in validate({"tts": {"speed": 3}, "scenes": GOOD}, cfg, root))


def test_missing_voice_ref(root, cfg):
    (root / "voices/phuong-short.wav").unlink()
    assert any("voices/phuong-short.wav" in e for e in validate({"scenes": GOOD}, cfg, root))


def test_empty_scenes(root, cfg):
    assert validate({"scenes": []}, cfg, root) == ["scenes: storyboard has no scenes"]
```

```python
# tools/tests/test_cache.py
from reel.cache import cache_key


def test_cache_key_stable_and_sensitive():
    k = cache_key(b"ref", "xin chào", {"a": 1, "b": 2})
    assert len(k) == 12 and k == cache_key(b"ref", "xin chào", {"b": 2, "a": 1})
    assert k != cache_key(b"ref2", "xin chào", {"a": 1, "b": 2})
    assert k != cache_key(b"ref", "xin chao", {"a": 1, "b": 2})
    assert k != cache_key(b"ref", "xin chào", {"a": 1, "b": 3})
```

- [ ] **Step 7: Run them to verify they fail**

Run: `uv run --with pytest python -m pytest tools/tests/test_validate.py tools/tests/test_cache.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'reel.validate'`.

- [ ] **Step 8: Implement `tools/reel/validate.py` and `tools/reel/cache.py`**

```python
# tools/reel/validate.py
"""Storyboard validation. Reports every problem at once, keyed by scene id, before any model loads."""
from pathlib import Path

from .config import pick, resolve_names, resolve_scene_voice

EFFECTS = {"none", "zoom-in", "zoom-out", "pan-left", "pan-right"}
TRANSITIONS = {"cut", "fade", "slide"}
POSITIONS = {"top", "center", "bottom"}


def validate(storyboard: dict, config: dict, root) -> list[str]:
    root = Path(root)
    errs = []
    template, brand = resolve_names(config, storyboard)
    if not (root / "studio/src/templates" / template).is_dir():
        errs.append(f"template: studio/src/templates/{template} not found")
    if not (root / "brands" / brand / "brand.json").is_file():
        errs.append(f"brand: brands/{brand}/brand.json not found")
    music = storyboard.get("music")
    if music is not None:
        if not music.get("file"):
            errs.append("music: missing 'file' (use null for no music)")
        elif not (root / "music" / music["file"]).is_file():
            errs.append(f"music: music/{music['file']} not found")
    scenes = storyboard.get("scenes") or []
    if not scenes:
        return errs + ["scenes: storyboard has no scenes"]

    seen = set()
    for i, sc in enumerate(scenes):
        sid = sc.get("id") or f"#{i + 1}"
        if not sc.get("id"):
            errs.append(f"{sid}: missing id")
        elif sid in seen:
            errs.append(f"{sid}: duplicate id")
        seen.add(sid)

        say = sc.get("say")
        if say is not None and not str(say).strip():
            errs.append(f"{sid}: 'say' is empty")
        if say is None and not sc.get("duration"):
            errs.append(f"{sid}: silent scene needs 'duration' > 0")
        if not sc.get("media") and not sc.get("motion"):
            errs.append(f"{sid}: needs 'media' or 'motion'")
        if say is not None:
            name = pick(sc.get("voice"), storyboard.get("voice"), config["defaults"]["voice"])
            if name not in config["voices"]:
                errs.append(f"{sid}: voice '{name}' not in config.voices")
            else:
                v = resolve_scene_voice(config, storyboard, sc)
                if not (root / v["ref"]).is_file():
                    errs.append(f"{sid}: voice reference {v['ref']} not found")
                speed = float(v["tts"].get("speed", 1.0))
                if not 0.5 <= speed <= 2.0:
                    errs.append(f"{sid}: speed {speed} outside 0.5-2.0")

        for m in sc.get("media") or []:
            if not (root / "library" / m.get("src", "")).is_file():
                errs.append(f"{sid}: library/{m.get('src')} not found")
            if m.get("effect", "none") not in EFFECTS:
                errs.append(f"{sid}: effect '{m.get('effect')}' not in {sorted(EFFECTS)}")
        for mo in sc.get("motion") or []:
            comp = mo.get("component", "")
            if not (root / "studio/src/motion" / f"{comp}.tsx").is_file():
                errs.append(f"{sid}: motion component '{comp}' not found in studio/src/motion/")
        if sc.get("transition", "cut") not in TRANSITIONS:
            errs.append(f"{sid}: transition '{sc.get('transition')}' not in {sorted(TRANSITIONS)}")
        overlay = sc.get("overlay")
        if overlay and overlay.get("position", "top") not in POSITIONS:
            errs.append(f"{sid}: overlay position '{overlay.get('position')}' not in {sorted(POSITIONS)}")
    return errs
```

```python
# tools/reel/cache.py
import hashlib
import json


def cache_key(ref_bytes: bytes, say: str, tts: dict) -> str:
    """Same voice file + text + every resolved TTS param -> same key -> reuse the cached wav."""
    h = hashlib.sha256()
    for part in (ref_bytes, say.encode("utf-8"), json.dumps(tts, sort_keys=True).encode("utf-8")):
        h.update(part)
        h.update(b"\0")
    return h.hexdigest()[:12]
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `uv run --with pytest python -m pytest tools/tests/test_config.py tools/tests/test_validate.py tools/tests/test_cache.py -q`
Expected: 15 passed.

- [ ] **Step 10: Commit**

```bash
git add tools/reel/__init__.py tools/reel/config.py tools/reel/validate.py tools/reel/cache.py tools/tests/conftest.py tools/tests/test_config.py tools/tests/test_validate.py tools/tests/test_cache.py
git commit -m "Add layered config resolution, storyboard validation and TTS cache key"
```

---

### Task 3: Captions, mix accounting, render-props builder (pure Python)

**Files:**
- Create: `tools/reel/captions.py`, `tools/reel/mix.py`, `tools/reel/props.py`
- Test: `tools/tests/test_captions.py`, `tools/tests/test_mix.py`, `tools/tests/test_props.py`

**Interfaces:**
- Consumes:
  - `tools/tests/conftest.py` from T2, which puts `tools/` on `sys.path`. If T2 is not merged yet, create the same file with the identical content from T2 Step 1.
  - This task does not import `reel.config`.
- Produces:
  - `chunk_caption(text: str, max_words: int, duration: float) -> list[{"text", "start", "end"}]`.
  - `mix(scenes: list[{"duration": float, "hasMedia": bool}], cta_seconds: float) -> {"real", "motion", "other"}` (fractions, rounded to 3 places).
  - `build_render_props(storyboard, settings, brand, audio) -> dict`, where:
    - `settings` is `resolve_video()` output;
    - `audio` is `{scene_id: {"src": str, "duration": float, "pauseAfter": float}}` (spoken scenes only);
    - the output matches the `RenderProps` TypeScript type in T6.

- [ ] **Step 1: Write the failing tests**

```python
# tools/tests/test_captions.py
from reel.captions import chunk_caption


def test_chunk_caption_splits_by_words_and_times_by_chars():
    out = chunk_caption("Chỉ 999K cho cả khóa học IELTS cấp tốc", 4, 4.0)
    assert [c["text"] for c in out] == ["Chỉ 999K cho cả", "khóa học IELTS cấp", "tốc"]
    assert out[0]["start"] == 0 and out[-1]["end"] == 4.0
    assert abs(out[1]["start"] - 1.667) < 0.01
    assert all(a["end"] == b["start"] for a, b in zip(out, out[1:]))


def test_chunk_caption_empty():
    assert chunk_caption("   ", 6, 3.0) == []
```

```python
# tools/tests/test_mix.py
from reel.mix import mix


def test_mix_fractions():
    scenes = [{"duration": 6, "hasMedia": True}, {"duration": 3, "hasMedia": False}]
    assert mix(scenes, 1.0) == {"real": 0.6, "motion": 0.3, "other": 0.1}


def test_mix_empty():
    assert mix([], 0) == {"real": 0, "motion": 0, "other": 0}
```

```python
# tools/tests/test_props.py
from reel.props import build_render_props

SETTINGS = {
    "template": "fast-cut", "brand": "demo",
    "video": {"fps": 30, "width": 1080, "height": 1920, "draftScale": 0.5},
    "captions": {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400", "maxWords": 6},
    "music": {"file": "m.mp3", "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5},
}
BRAND = {"name": "Demo", "logo": "logo.png",
         "colors": {"primary": "#1", "accent": "#2", "text": "#3", "background": "#4"}, "cta": {"phone": "0900"}}
SB = {"scenes": [
    {"id": "s1", "say": "x", "caption": "Một hai ba", "highlight": ["hai"], "transition": "fade",
     "media": [{"src": "a.mp4", "from": 1.5, "effect": "zoom-in"}, {"src": "b.jpg", "duration": 1.0}]},
    {"id": "s2", "duration": 2, "motion": [{"component": "CountUp", "props": {"to": 7.5}, "start": 0.5}]},
], "cta": {"title": "Đăng ký"}}
AUDIO = {"s1": {"src": "projects/p/audio/s1-abc.wav", "duration": 3.0, "pauseAfter": 0.5}}


def test_build_render_props():
    p = build_render_props(SB, SETTINGS, BRAND, AUDIO)
    s1, s2 = p["scenes"]
    assert (s1["start"], s1["duration"]) == (0, 3.5) and (s2["start"], s2["duration"]) == (3.5, 2.0)
    assert s1["voice"] == {"src": "projects/p/audio/s1-abc.wav", "duration": 3.0} and s2["voice"] is None
    assert s1["media"] == [
        {"src": "library/a.mp4", "type": "video", "from": 1.5, "start": 0, "duration": 2.5, "effect": "zoom-in"},
        {"src": "library/b.jpg", "type": "image", "from": 0.0, "start": 2.5, "duration": 1.0, "effect": "none"},
    ]
    assert s1["captions"][-1]["end"] == 3.0  # captions follow speech, not the pause
    assert s1["highlight"] == ["hai"] and s1["overlay"] is None
    assert (s1["transition"], s2["transition"]) == ("fade", "cut")
    assert s2["motion"] == [{"component": "CountUp", "props": {"to": 7.5}, "start": 0.5, "duration": 1.5}]
    assert s2["captions"] == [] and s2["media"] == []
    assert p["cta"] == {"duration": 3.0, "phone": "0900", "title": "Đăng ký"}
    assert p["totalSeconds"] == 8.5
    assert p["brand"] == {"name": "Demo", "logo": "brands/demo/logo.png", "colors": BRAND["colors"]}
    assert p["music"] == {"src": "music/m.mp3", "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5}
    assert (p["template"], p["fps"], p["width"], p["height"]) == ("fast-cut", 30, 1080, 1920)
    assert p["captions"] == {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400"}


def test_no_cta_no_music_no_logo():
    p = build_render_props({"scenes": SB["scenes"]}, {**SETTINGS, "music": None}, {**BRAND, "logo": None}, AUDIO)
    assert p["cta"] is None and p["music"] is None and p["brand"]["logo"] is None and p["totalSeconds"] == 5.5
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run --with pytest python -m pytest tools/tests/test_captions.py tools/tests/test_mix.py tools/tests/test_props.py -q`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement the three modules**

```python
# tools/reel/captions.py
def chunk_caption(text: str, max_words: int, duration: float) -> list[dict]:
    """Split into <= max_words chunks, timed by character share of `duration`.
    shortcut: proportional timing, no word alignment; upgrade with Whisper for karaoke captions."""
    words = text.split()
    if not words:
        return []
    chunks = [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]
    total = sum(len(c) for c in chunks)
    out, t = [], 0.0
    for c in chunks:
        d = duration * len(c) / total
        out.append({"text": c, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    out[-1]["end"] = round(duration, 3)
    return out
```

```python
# tools/reel/mix.py
def mix(scenes: list[dict], cta_seconds: float) -> dict:
    """Share of screen time: scenes with media = real, motion-only scenes = motion, CTA = other."""
    real = sum(s["duration"] for s in scenes if s["hasMedia"])
    motion = sum(s["duration"] for s in scenes if not s["hasMedia"])
    total = real + motion + cta_seconds
    if total <= 0:
        return {"real": 0, "motion": 0, "other": 0}
    return {"real": round(real / total, 3), "motion": round(motion / total, 3), "other": round(cta_seconds / total, 3)}
```

```python
# tools/reel/props.py
"""Builds the fully resolved render-props.json consumed by the Remotion `Reel` composition."""
from pathlib import Path

from .captions import chunk_caption

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _media(items: list[dict], scene_dur: float) -> list[dict]:
    fixed = sum(m["duration"] for m in items if m.get("duration"))
    free = [m for m in items if not m.get("duration")]
    each = max(scene_dur - fixed, 0) / len(free) if free else 0
    out, t = [], 0.0
    for m in items:
        d = m.get("duration") or each
        out.append({
            "src": f"library/{m['src']}",
            "type": "image" if Path(m["src"]).suffix.lower() in IMAGE_EXTS else "video",
            "from": float(m.get("from", 0)),
            "start": round(t, 3),
            "duration": round(d, 3),
            "effect": m.get("effect", "none"),
        })
        t += d
    return out


def _motion(items: list[dict], scene_dur: float) -> list[dict]:
    out = []
    for m in items:
        start = float(m.get("start", 0))
        out.append({"component": m["component"], "props": m.get("props", {}), "start": start,
                    "duration": float(m.get("duration", scene_dur - start))})
    return out


def build_render_props(storyboard: dict, settings: dict, brand: dict, audio: dict) -> dict:
    cap = settings["captions"]
    scenes, t = [], 0.0
    for sc in storyboard["scenes"]:
        a = audio.get(sc["id"])
        dur = a["duration"] + a["pauseAfter"] if a else float(sc["duration"])
        scenes.append({
            "id": sc["id"],
            "start": round(t, 3),
            "duration": round(dur, 3),
            "voice": {"src": a["src"], "duration": a["duration"]} if a else None,
            "captions": chunk_caption(sc.get("caption") or "", cap["maxWords"], a["duration"] if a else dur),
            "highlight": sc.get("highlight", []),
            "overlay": sc.get("overlay"),
            "media": _media(sc.get("media") or [], dur),
            "motion": _motion(sc.get("motion") or [], dur),
            "transition": sc.get("transition", "cut"),
        })
        t += dur
    cta = {"duration": 3.0, **brand.get("cta", {}), **storyboard["cta"]} if storyboard.get("cta") else None
    music = settings["music"]
    video = settings["video"]
    return {
        "template": settings["template"],
        "fps": video["fps"], "width": video["width"], "height": video["height"],
        "brand": {"name": brand.get("name", ""),
                  "logo": f"brands/{settings['brand']}/{brand['logo']}" if brand.get("logo") else None,
                  "colors": brand["colors"]},
        "captions": {k: cap[k] for k in ("font", "size", "color", "highlightColor")},
        "music": None if music is None else {"src": f"music/{music['file']}", "volume": music["volume"],
                                             "duckTo": music["duckTo"], "fadeOut": music["fadeOut"]},
        "scenes": scenes,
        "cta": cta,
        "totalSeconds": round(t + (cta["duration"] if cta else 0), 3),
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --with pytest python -m pytest tools/tests/test_captions.py tools/tests/test_mix.py tools/tests/test_props.py -q`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/reel/captions.py tools/reel/mix.py tools/reel/props.py tools/tests/test_captions.py tools/tests/test_mix.py tools/tests/test_props.py
git commit -m "Add caption chunking, mix accounting and render-props builder"
```

---

### Task 4: TTS module, `prepare.py`, `voice_try.py`

**Files:**
- Create: `tools/reel/tts.py`, `tools/prepare.py`, `tools/voice_try.py`, `projects/_smoke/storyboard.json`

**Interfaces:**
- Consumes:
  - All T2 functions and T3's `build_render_props`, `mix`.
  - The `Vieneu` v3 Turbo API: `Vieneu()`, `.infer(text, ref_audio=..., **TTS_KEYS kwargs)`, `.save(audio, path)`. See `VieNeu-TTS/src/vieneu/v3turbo.py:600`.
- Produces:
  - CLI `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>` writes `projects/<slug>/timings.json` and `projects/<slug>/render-props.json`. Exit codes: 1 = invalid storyboard or TTS failure, 0 = ok.
  - CLI `voice_try.py` writes `voices/tries/<voice>-A.wav`, etc., plus `voices/tries/tries.json`.
  - `reel.tts.probe_duration(path) -> float`.

- [ ] **Step 1: Implement `tools/reel/tts.py`**

```python
"""VieNeu-backed synthesis. Imports vieneu lazily so the pure modules stay importable without it."""
import os
import subprocess
from pathlib import Path

from .config import TTS_KEYS


def load_model():
    from vieneu import Vieneu  # GPU -> PyTorch, CPU -> ONNX (auto)
    return Vieneu()


def probe_duration(path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def synth_to_file(model, say: str, ref_path, tts: dict, out_path) -> float:
    """Synthesize, apply speed with ffmpeg atempo, write atomically (no half-written cache files). Returns seconds."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audio = model.infer(say, ref_audio=str(ref_path), **{k: tts[k] for k in TTS_KEYS if k in tts})
    raw = out_path.with_name(out_path.stem + ".raw.wav")
    tmp = out_path.with_name(out_path.stem + ".tmp.wav")
    model.save(audio, str(raw))
    speed = float(tts.get("speed", 1.0))
    if speed == 1.0:
        raw.rename(tmp)
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter:a", f"atempo={speed}", str(tmp)], check=True)
        raw.unlink()
    os.replace(tmp, out_path)
    return probe_duration(out_path)
```

- [ ] **Step 2: Implement `tools/prepare.py`**

```python
#!/usr/bin/env python3
"""Validate a storyboard, synthesize cached per-scene voice, write timings.json + render-props.json.

Usage: VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reel.cache import cache_key  # noqa: E402
from reel.config import ROOT, load_json, resolve_names, resolve_scene_voice, resolve_video  # noqa: E402
from reel.mix import mix  # noqa: E402
from reel.props import build_render_props  # noqa: E402
from reel.tts import load_model, probe_duration, synth_to_file  # noqa: E402
from reel.validate import validate  # noqa: E402


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    proj = Path(argv[1]) if Path(argv[1]).is_absolute() else (Path.cwd() / argv[1])
    proj = proj.resolve()
    slug = proj.name
    sb = load_json(proj / "storyboard.json")
    cfg = load_json(ROOT / "config.json")

    errs = validate(sb, cfg, ROOT)
    if errs:
        print("Storyboard errors:")
        for e in errs:
            print(f"  - {e}")
        return 1

    _, brand_id = resolve_names(cfg, sb)
    brand = load_json(ROOT / "brands" / brand_id / "brand.json")
    settings = resolve_video(cfg, brand, sb)

    model, audio, timings, failed = None, {}, {}, []
    for sc in sb["scenes"]:
        if sc.get("say") is None:
            timings[sc["id"]] = {"duration": float(sc["duration"])}
            continue
        v = resolve_scene_voice(cfg, sb, sc)
        ref = ROOT / v["ref"]
        key = cache_key(ref.read_bytes(), sc["say"], v["tts"])
        out = proj / "audio" / f"{sc['id']}-{key}.wav"
        try:
            if out.exists():
                dur = probe_duration(out)
            else:
                if model is None:
                    model = load_model()
                dur = synth_to_file(model, sc["say"], ref, v["tts"], out)
        except Exception as e:  # report per scene; cached scenes stay valid
            failed.append(f"{sc['id']}: {e}")
            continue
        audio[sc["id"]] = {"src": f"projects/{slug}/audio/{out.name}", "duration": dur, "pauseAfter": v["pauseAfter"]}
        timings[sc["id"]] = {"duration": dur, "pauseAfter": v["pauseAfter"], "voice": v["voice"],
                             "ref": v["ref"], "tts": v["tts"], "cacheKey": key}
    if failed:
        print("TTS failed:")
        for f in failed:
            print(f"  - {f}")
        return 1

    props = build_render_props(sb, settings, brand, audio)
    cta_s = props["cta"]["duration"] if props["cta"] else 0
    actual = mix([{"duration": s["duration"], "hasMedia": bool(s["media"])} for s in props["scenes"]], cta_s)
    write_json(proj / "render-props.json", props)
    write_json(proj / "timings.json", {"scenes": timings, "totalSeconds": props["totalSeconds"], "mix": actual})

    target = sb.get("targetSeconds")
    print(f"Total: {props['totalSeconds']:.1f}s" + (f" (target {target}s)" if target else ""))
    print(f"Mix: real {actual['real']:.0%} / motion {actual['motion']:.0%} / other {actual['other']:.0%}"
          f"  (target {cfg['mix']['real']:.0%}/{cfg['mix']['motion']:.0%}/{cfg['mix']['other']:.0%})")
    print(f"Wrote {proj / 'render-props.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 3: Write `projects/_smoke/storyboard.json`**

```json
{
  "targetSeconds": 12,
  "music": { "file": "_smoke.mp3" },
  "scenes": [
    { "id": "s1", "say": "Học viên đạt chứng chỉ ai en tê ét bảy chấm năm chỉ sau ba tháng.",
      "caption": "Học viên đạt IELTS 7.5 chỉ sau 3 tháng", "highlight": ["7.5"],
      "media": [ { "src": "_smoke-landscape.mp4", "from": 1, "effect": "zoom-in" } ] },
    { "id": "s2", "say": "Lớp học sôi động mỗi ngày.", "caption": "Lớp học sôi động mỗi ngày", "voice": "vy",
      "transition": "fade",
      "media": [ { "src": "_smoke-portrait.mp4" }, { "src": "_smoke.jpg", "effect": "pan-left" } ] },
    { "id": "s3", "duration": 2, "transition": "slide",
      "media": [ { "src": "_smoke.jpg", "effect": "zoom-out" } ] }
  ],
  "cta": { "title": "Đăng ký ngay" }
}
```

(T7 adds a motion scene to this storyboard after the motion library exists.)

- [ ] **Step 4: Run `prepare.py` on the smoke project (real GPU run)**

Run (needs T1 Step 4 smoke media):
`VieNeu-TTS/.venv/bin/python tools/prepare.py projects/_smoke 2>&1 | grep -vE 'it/s|%\|' | tail -8`

Expected:
- A `Total: ...s (target 12s)` line and a `Mix: real 7x% / motion 0% / other 2x%` line.
- `projects/_smoke/audio/s1-*.wav` and `s2-*.wav` exist.
- `render-props.json` has 3 scenes, with `s2.voice.src` pointing at the `s2-*.wav`.

- [ ] **Step 5: Verify the cache, the validation path and a speed change**

1. Rerun Step 4. Expected: it finishes in under 3 s with no model load (the first-run log shows the model loading; the second does not), and the same wav names.
2. Temporarily set `"say": ""` on s1. Run: expect `s1: 'say' is empty` and exit code 1 (`echo $?`). Revert.
3. Add `"tts": {"speed": 1.2}` to s2. Run: expect a new `s2-<otherhash>.wav` that is shorter than the old one (`ffprobe`). Revert, and delete the extra wav.

- [ ] **Step 6: Implement `tools/voice_try.py`**

```python
#!/usr/bin/env python3
"""Audition variants of a voice on one line.

Usage: VieNeu-TTS/.venv/bin/python tools/voice_try.py --voice phuong --text "..." \
         --variants '[{"speed": 1.05}, {"temperature": 0.6}, {"ref": "voices/phuong-full.wav"}]'
Writes voices/tries/<voice>-A.wav, -B.wav, ... and voices/tries/tries.json (resolved params per letter).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reel.config import ROOT, load_json, resolve_scene_voice  # noqa: E402
from reel.tts import load_model, synth_to_file  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--variants", default="[{}]", help="JSON list of tts overrides; optional 'ref' per variant")
    a = ap.parse_args()
    cfg = load_json(ROOT / "config.json")
    if a.voice not in cfg["voices"]:
        print(f"Unknown voice '{a.voice}'. Known: {', '.join(cfg['voices'])}")
        return 1
    variants = json.loads(a.variants)
    model = load_model()
    out_dir = ROOT / "voices/tries"
    report = {}
    for i, over in enumerate(variants):
        over = dict(over)
        ref = over.pop("ref", None)
        v = resolve_scene_voice(cfg, {}, {"voice": a.voice, "tts": over})
        ref = ref or v["ref"]
        letter = chr(65 + i)
        out = out_dir / f"{a.voice}-{letter}.wav"
        dur = synth_to_file(model, a.text, ROOT / ref, v["tts"], out)
        report[letter] = {"file": str(out.relative_to(ROOT)), "ref": ref, "tts": v["tts"], "seconds": round(dur, 2)}
        print(f"{letter}: {out}  ({dur:.1f}s)  {over or 'defaults'}")
    (out_dir / "tries.json").write_text(json.dumps({"voice": a.voice, "text": a.text, "variants": report},
                                                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 7: Run `voice_try.py`**

Run: `VieNeu-TTS/.venv/bin/python tools/voice_try.py --voice phuong --text "Đăng ký ngay hôm nay." --variants '[{}, {"speed": 1.1}, {"ref": "voices/phuong-full.wav"}]' 2>&1 | grep -E '^[A-C]:'`
Expected: three lines A/B/C. B's duration is ~9 % shorter than A's. `voices/tries/tries.json` lists 3 variants.

- [ ] **Step 8: Run the Python unit tests touched by the imports, then commit**

Run: `uv run --with pytest python -m pytest tools/tests -q`. Expected: all pass.

```bash
git add tools/reel/tts.py tools/prepare.py tools/voice_try.py projects/_smoke/storyboard.json
git commit -m "Add TTS synthesis with cache, prepare.py and voice_try.py"
```

---

### Task 5: Media ingest (`tools/ingest.py`)

**Files:**
- Create: `tools/ingest.py`
- Test: `tools/tests/test_ingest.py`

**Interfaces:**
- Produces:
  - CLI `python3 tools/ingest.py`.
  - The function `ingest(inbox: Path, library: Path) -> list[str]` (returns the new library file names).
  - `library/media-index.json` entries `{type, duration, width, height, orientation, description: "", tags: [], goodRanges}`. Existing entries are never overwritten.
  - `library/thumbs/<name>.jpg`.
  - Originals moved to `inbox/_done/` only after success.

- [ ] **Step 1: Write the failing test `tools/tests/test_ingest.py`**

```python
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import ingest, slugify  # noqa: E402


def ff(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def test_slugify():
    assert slugify("Học viên Lớp Đặc biệt (1)") == "hoc-vien-lop-dac-biet-1"


def test_ingest_normalizes_and_indexes(tmp_path):
    inbox, lib = tmp_path / "inbox", tmp_path / "library"
    inbox.mkdir()
    ff("-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=25", "-t", "2", "-c:v", "libx264", str(inbox / "Lớp học.MOV"))
    ff("-f", "lavfi", "-i", "testsrc=size=720x1280:rate=60", "-t", "2", "-c:v", "libx264", str(inbox / "doc.mp4"))
    ff("-f", "lavfi", "-i", "gradients=size=800x600", "-frames:v", "1", str(inbox / "anh.png"))
    (inbox / "notes.txt").write_text("skip me")

    names = ingest(inbox, lib)

    assert sorted(names) == ["anh.jpg", "doc.mp4", "lop-hoc.mp4"]
    idx = json.loads((lib / "media-index.json").read_text(encoding="utf-8"))
    assert idx["lop-hoc.mp4"]["orientation"] == "landscape" and idx["doc.mp4"]["orientation"] == "portrait"
    assert idx["anh.jpg"]["type"] == "image" and idx["lop-hoc.mp4"]["description"] == ""
    assert abs(idx["lop-hoc.mp4"]["duration"] - 2.0) < 0.2
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                       "stream=codec_name,r_frame_rate,pix_fmt", "-of", "json", str(lib / "doc.mp4")],
                                      capture_output=True, text=True, check=True).stdout)["streams"][0]
    assert probe == {"codec_name": "h264", "r_frame_rate": "30/1", "pix_fmt": "yuv420p"}
    for n in names:
        assert (lib / "thumbs" / f"{Path(n).stem}.jpg").is_file()
    assert (inbox / "_done" / "doc.mp4").is_file() and (inbox / "notes.txt").is_file()

    idx["doc.mp4"]["description"] = "kept"
    (lib / "media-index.json").write_text(json.dumps(idx), encoding="utf-8")
    ff("-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30", "-t", "1", "-c:v", "libx264", str(inbox / "doc.mp4"))
    assert ingest(inbox, lib) == ["doc-2.mp4"]  # name collision -> suffix; old entry untouched
    assert json.loads((lib / "media-index.json").read_text(encoding="utf-8"))["doc.mp4"]["description"] == "kept"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `uv run --with pytest python -m pytest tools/tests/test_ingest.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'ingest'`.

- [ ] **Step 3: Implement `tools/ingest.py`**

```python
#!/usr/bin/env python3
"""Normalize new media from inbox/ into library/ (+ thumbs, + media-index.json skeleton).

Usage: python3 tools/ingest.py
Videos -> H.264 yuv420p SDR 30 fps (short side <= 1080, rotation baked in). Photos (incl. HEIC) -> JPG.
Claude fills description/tags/goodRanges afterwards by viewing library/thumbs/<name>.jpg.
"""
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEO = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".3gp"}
IMAGE = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
SCALE = "scale='if(lt(iw,ih),min(1080,iw),-2)':'if(lt(iw,ih),-2,min(1080,ih))'"
TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
           "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name.replace("đ", "d").replace("Đ", "D"))
    s = s.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "media"


def run(*args) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def unique(library: Path, stem: str, ext: str) -> Path:
    p, n = library / f"{stem}{ext}", 2
    while p.exists():
        p, n = library / f"{stem}-{n}{ext}", n + 1
    return p


def normalize_video(src: Path, dst: Path) -> None:
    v = next(s for s in probe(src)["streams"] if s["codec_type"] == "video")
    hdr = v.get("color_transfer") in ("smpte2084", "arib-std-b67")
    vf = ",".join(([TONEMAP] if hdr else []) + [SCALE, "fps=30", "format=yuv420p"])
    run("-i", str(src), "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", str(dst))


def normalize_image(src: Path, dst: Path) -> None:
    # shortcut: relies on ffmpeg applying EXIF orientation; check the first real portrait phone photo.
    try:
        run("-i", str(src), "-vf", "scale='min(2160,iw)':-2", "-frames:v", "1", "-q:v", "2", str(dst))
    except subprocess.CalledProcessError:
        if not shutil.which("heif-convert"):
            raise RuntimeError(f"cannot decode {src.name}; for HEIC install: sudo apt install libheif-examples")
        tmp = dst.with_suffix(".tmp.jpg")
        subprocess.run(["heif-convert", str(src), str(tmp)], check=True, capture_output=True)
        run("-i", str(tmp), "-vf", "scale='min(2160,iw)':-2", "-frames:v", "1", "-q:v", "2", str(dst))
        tmp.unlink()


def thumb(path: Path, kind: str, duration: float, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if kind == "video":
        run("-i", str(path), "-vf", f"fps={6 / max(duration, 0.5):.4f},scale=480:-2,tile=3x2", "-frames:v", "1", str(dst))
    else:
        run("-i", str(path), "-vf", "scale=480:-2", "-frames:v", "1", str(dst))


def entry(path: Path, kind: str) -> dict:
    info = probe(path)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    dur = round(float(info["format"].get("duration", 0)), 2) if kind == "video" else None
    return {"type": kind, "duration": dur, "width": w, "height": h,
            "orientation": "portrait" if h > w else "landscape" if w > h else "square",
            "description": "", "tags": [], "goodRanges": [[0, dur]] if kind == "video" else []}


def ingest(inbox: Path, library: Path) -> list[str]:
    library.mkdir(parents=True, exist_ok=True)
    index_path = library / "media-index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    done, added = inbox / "_done", []
    for src in sorted(p for p in inbox.iterdir() if p.is_file()):
        ext = src.suffix.lower()
        kind = "video" if ext in VIDEO else "image" if ext in IMAGE else None
        if kind is None:
            print(f"skip (unsupported): {src.name}")
            continue
        dst = unique(library, slugify(src.stem), ".mp4" if kind == "video" else ".jpg")
        try:
            (normalize_video if kind == "video" else normalize_image)(src, dst)
            index[dst.name] = entry(dst, kind)
            thumb(dst, kind, index[dst.name]["duration"] or 0, library / "thumbs" / f"{dst.stem}.jpg")
        except Exception as e:  # leave the original in inbox, drop partial output
            dst.unlink(missing_ok=True)
            index.pop(dst.name, None)
            print(f"FAILED {src.name}: {e}")
            continue
        index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        done.mkdir(exist_ok=True)
        shutil.move(str(src), unique(done, src.stem, src.suffix))
        added.append(dst.name)
        print(f"ok: {src.name} -> library/{dst.name}")
    return added


if __name__ == "__main__":
    names = ingest(ROOT / "inbox", ROOT / "library")
    print(f"{len(names)} new file(s). Next: describe them in library/media-index.json from library/thumbs/.")
    sys.exit(0)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `uv run --with pytest python -m pytest tools/tests/test_ingest.py -q`
Expected: 2 passed. If the `slugify` assertion fails on `đ`, fix `slugify`, not the test.

- [ ] **Step 5: Commit**

```bash
git add tools/ingest.py tools/tests/test_ingest.py
git commit -m "Add media ingest: normalize inbox into library with thumbs and index skeleton"
```

---

### Task 6: Remotion studio, `fast-cut` template, core components

**Files:**
- Create: `studio/` (scaffold), `studio/public/{library,music,brands,projects}` (symlinks), `studio/src/types.ts`, `studio/src/fonts.ts`, `studio/src/Reel.tsx`, `studio/src/effects.ts`, `studio/src/components/{ReelVideo,MediaShot,Captions,Overlay,CtaCard,MusicTrack,SceneTransition,MotionLayer}.tsx`, `studio/src/templates/index.ts`, `studio/src/templates/fast-cut/FastCut.tsx`, `studio/src/motion/registry.ts`, `studio/fixtures/smoke-props.json`
- Modify: `studio/src/Root.tsx`, `studio/tsconfig.json` (enable `resolveJsonModule`)

**Interfaces:**
- Consumes:
  - The `render-props.json` shape from T3 (mirrored by `RenderProps` below).
  - Smoke media from T1.
- Produces:
  - Composition id `Reel`.
  - `RenderProps` and the other types in `src/types.ts`.
  - `MOTION` registry in `src/motion/registry.ts` (empty; T7 fills it). Each motion component receives its own props plus `brand: Brand`.
  - `fontFamily` export from `src/fonts.ts`.
  - `TEMPLATES` in `src/templates/index.ts`.

Before coding, check the current API with Context7 (library `/remotion-dev/remotion`) for:
- the `@remotion/media` `<Video>` props (`trimBefore`, `objectFit`, `muted`) and `<OffthreadVideo>`'s `trimBefore`;
- whether `@remotion/media` `<Audio>` accepts a `volume` callback and `loop`. If not, use `Audio` from `remotion` for music only, and say so in your report.

- [ ] **Step 1: Scaffold and pin**

```bash
cd /home/giabao/dev/create-video
npx create-video@4.0.544 --yes --blank studio
rm -rf studio/.git   # if the scaffold initialised its own repo
cd studio
npm i -E remotion@4.0.544 @remotion/cli@4.0.544 @remotion/media@4.0.544 @remotion/google-fonts@4.0.544
mkdir -p public && cd public
ln -sfn ../../library library; ln -sfn ../../music music; ln -sfn ../../brands brands; ln -sfn ../../projects projects
```

Then set `"resolveJsonModule": true` in `studio/tsconfig.json` under `compilerOptions`.

- [ ] **Step 2: Write `src/types.ts`, `src/fonts.ts`, `src/effects.ts`**

```ts
// src/types.ts — mirrors tools/reel/props.py build_render_props()
export type Effect = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
export type Transition = 'cut' | 'fade' | 'slide';
export type CaptionChunk = {text: string; start: number; end: number};
export type MediaItem = {src: string; type: 'video' | 'image'; from: number; start: number; duration: number; effect: Effect};
export type MotionItem = {component: string; props: Record<string, unknown>; start: number; duration: number};
export type Overlay = {text: string; position: 'top' | 'center' | 'bottom'};
export type Scene = {
  id: string; start: number; duration: number;
  voice: {src: string; duration: number} | null;
  captions: CaptionChunk[]; highlight: string[]; overlay: Overlay | null;
  media: MediaItem[]; motion: MotionItem[]; transition: Transition;
};
export type Brand = {name: string; logo: string | null; colors: {primary: string; accent: string; text: string; background: string}};
export type CaptionStyle = {font: string; size: number; color: string; highlightColor: string};
export type Music = {src: string; volume: number; duckTo: number; fadeOut: number};
export type Cta = {title: string; phone?: string; fanpage?: string; address?: string; duration: number};
export type RenderProps = {
  template: string; fps: number; width: number; height: number;
  brand: Brand; captions: CaptionStyle; music: Music | null;
  scenes: Scene[]; cta: Cta | null; totalSeconds: number;
};
```

```ts
// src/fonts.ts
import {loadFont} from '@remotion/google-fonts/BeVietnamPro';

// shortcut: only Be Vietnam Pro is loaded; another captions.font needs its own loadFont here.
export const {fontFamily} = loadFont('normal', {weights: ['400', '700', '800'], subsets: ['vietnamese', 'latin']});
```

```ts
// src/effects.ts
import type {Effect} from './types';

/** CSS transform for a media effect at progress p ∈ [0,1]. */
export const effectTransform = (e: Effect, p: number): string => {
  switch (e) {
    case 'zoom-in': return `scale(${1 + 0.12 * p})`;
    case 'zoom-out': return `scale(${1.12 - 0.12 * p})`;
    case 'pan-left': return `scale(1.15) translateX(${4 - 8 * p}%)`;
    case 'pan-right': return `scale(1.15) translateX(${-4 + 8 * p}%)`;
    default: return 'none';
  }
};
```

- [ ] **Step 3: Write the components**

```tsx
// src/components/ReelVideo.tsx — @remotion/media Video when rendering, OffthreadVideo in Studio preview
import React from 'react';
import {OffthreadVideo, useRemotionEnvironment} from 'remotion';
import {Video} from '@remotion/media';

export const ReelVideo: React.FC<{src: string; trimBefore: number; objectFit: 'contain' | 'cover'; style: React.CSSProperties}> = (p) => {
  const env = useRemotionEnvironment();
  return env.isRendering
    ? <Video src={p.src} muted trimBefore={p.trimBefore} objectFit={p.objectFit} style={p.style} />
    : <OffthreadVideo src={p.src} muted trimBefore={p.trimBefore} style={{...p.style, objectFit: p.objectFit}} />;
};
```

```tsx
// src/components/MediaShot.tsx — contain-fit media over a blurred cover copy (never crops students)
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {effectTransform} from '../effects';
import type {MediaItem} from '../types';
import {ReelVideo} from './ReelVideo';

export const MediaShot: React.FC<{item: MediaItem}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, Math.round(item.duration * fps)));
  const src = staticFile(item.src);
  const full: React.CSSProperties = {width: '100%', height: '100%'};
  const layer = (fit: 'contain' | 'cover', style: React.CSSProperties) =>
    item.type === 'image'
      ? <Img src={src} style={{...full, objectFit: fit, ...style}} />
      : <ReelVideo src={src} trimBefore={Math.round(item.from * fps)} objectFit={fit} style={{...full, ...style}} />;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: 'blur(40px) brightness(0.7)', transform: 'scale(1.2)'}}>{layer('cover', {})}</AbsoluteFill>
      <AbsoluteFill>{layer('contain', {transform: effectTransform(item.effect, p)})}</AbsoluteFill>
    </AbsoluteFill>
  );
};
```

```tsx
// src/components/Captions.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {CaptionChunk, CaptionStyle} from '../types';

const norm = (w: string) => w.replace(/[.,!?;:"“”()]/g, '').toLowerCase();

// shortcut: heuristic glyph width (0.55em); switch to @remotion/layout-utils measureText if stills show overflow.
export const fitSize = (text: string, base: number, maxWidth: number, maxLines = 2): number => {
  const lines = text.length / (maxWidth / (base * 0.55));
  return lines <= maxLines ? base : Math.floor(base * Math.sqrt(maxLines / lines));
};

export const Captions: React.FC<{chunks: CaptionChunk[]; highlight: string[]; style: CaptionStyle}> = ({chunks, highlight, style}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const t = frame / fps;
  const c = chunks.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const pop = spring({frame: Math.round((t - c.start) * fps), fps, config: {damping: 14}});
  const marks = new Set(highlight.map(norm));
  return (
    // paddingBottom keeps captions above the Reels/TikTok bottom UI
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 380}}>
      <div style={{
        fontFamily, fontWeight: 800, fontSize: fitSize(c.text, style.size, width * 0.86), color: style.color,
        textAlign: 'center', maxWidth: '86%', lineHeight: 1.15, transform: `scale(${0.85 + 0.15 * pop})`,
        textShadow: '0 4px 18px rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.9)',
      }}>
        {c.text.split(' ').map((w, i) => (
          <span key={i} style={marks.has(norm(w)) ? {color: style.highlightColor} : undefined}>{w} </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// src/components/Overlay.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand, Overlay as OverlayT} from '../types';

export const Overlay: React.FC<{overlay: OverlayT; brand: Brand}> = ({overlay, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 10}});
  const pos: React.CSSProperties = overlay.position === 'top' ? {top: 240} : overlay.position === 'bottom' ? {bottom: 640} : {top: '45%'};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', ...pos}}>
        <div style={{
          fontFamily, fontWeight: 800, fontSize: 96, color: brand.colors.background, background: brand.colors.accent,
          padding: '18px 44px', borderRadius: 20, transform: `rotate(-3deg) scale(${s})`, boxShadow: '0 12px 40px rgba(0,0,0,.4)',
        }}>{overlay.text}</div>
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// src/components/CtaCard.tsx
import React from 'react';
import {AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand, Cta} from '../types';

export const CtaCard: React.FC<{cta: Cta; brand: Brand}> = ({cta, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = (delay: number) => spring({frame: frame - delay, fps, config: {damping: 14}});
  const lines = [cta.phone && `☎ ${cta.phone}`, cta.fanpage, cta.address].filter(Boolean) as string[];
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(160deg, ${brand.colors.primary}, ${brand.colors.background})`,
      justifyContent: 'center', alignItems: 'center', gap: 40, padding: 80, fontFamily,
    }}>
      {brand.logo && <Img src={staticFile(brand.logo)} style={{width: 260, opacity: enter(0)}} />}
      <div style={{fontWeight: 800, fontSize: 120, color: brand.colors.accent, textAlign: 'center', transform: `scale(${enter(4)})`}}>{cta.title}</div>
      {lines.map((l, i) => (
        <div key={i} style={{fontWeight: 700, fontSize: 58, color: brand.colors.text, textAlign: 'center',
          opacity: enter(10 + i * 5), transform: `translateY(${(1 - enter(10 + i * 5)) * 40}px)`}}>{l}</div>
      ))}
    </AbsoluteFill>
  );
};
```

```tsx
// src/components/MusicTrack.tsx — ducks under every voice clip, fades out at the end
import React from 'react';
import {staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import type {Music, Scene} from '../types';

const RAMP = 0.25; // seconds

export const musicVolumeAt = (t: number, music: Music, scenes: Scene[], total: number): number => {
  let v = music.volume;
  for (const s of scenes) {
    if (!s.voice) continue;
    const a = s.start, b = s.start + s.voice.duration;
    const d = t < a ? a - t : t > b ? t - b : 0;
    if (d < RAMP) v = Math.min(v, music.volume + (music.duckTo - music.volume) * (1 - d / RAMP));
  }
  const fadeStart = total - music.fadeOut;
  return t > fadeStart ? v * Math.max(0, (total - t) / music.fadeOut) : v;
};

export const MusicTrack: React.FC<{music: Music; scenes: Scene[]; total: number}> = ({music, scenes, total}) => {
  const {fps} = useVideoConfig();
  return <Audio src={staticFile(music.src)} loop volume={(f: number) => musicVolumeAt(f / fps, music, scenes, total)} />;
};
```

```tsx
// src/components/SceneTransition.tsx
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Transition} from '../types';

// shortcut: scenes don't overlap, so 'slide' reveals the template background briefly; add TransitionSeries if that looks off.
export const SceneTransition: React.FC<{type: Transition; children: React.ReactNode}> = ({type, children}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const p = Math.min(1, frame / Math.round(0.3 * fps));
  const style: React.CSSProperties =
    type === 'fade' ? {opacity: p}
    : type === 'slide' ? {transform: `translateX(${(1 - Easing.out(Easing.cubic)(p)) * width}px)`}
    : {};
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
```

```tsx
// src/components/MotionLayer.tsx
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MOTION} from '../motion/registry';
import type {Brand, MotionItem} from '../types';

export const MotionLayer: React.FC<{item: MotionItem; brand: Brand}> = ({item, brand}) => {
  const C = MOTION[item.component];
  if (!C) throw new Error(`Unknown motion component "${item.component}" — add it to studio/src/motion/registry.ts`);
  return <AbsoluteFill><C {...item.props} brand={brand} /></AbsoluteFill>;
};
```

```ts
// src/motion/registry.ts — one entry per file studio/src/motion/<Name>.tsx exporting <Name>
import type React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOTION: Record<string, React.ComponentType<any>> = {};
```

- [ ] **Step 4: Write the template, registry, `Reel`, `Root`**

```tsx
// src/templates/fast-cut/FastCut.tsx — style: quick cuts, bold captions, accent overlays, logo top-left
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Captions} from '../../components/Captions';
import {CtaCard} from '../../components/CtaCard';
import {MediaShot} from '../../components/MediaShot';
import {MotionLayer} from '../../components/MotionLayer';
import {MusicTrack} from '../../components/MusicTrack';
import {Overlay} from '../../components/Overlay';
import {SceneTransition} from '../../components/SceneTransition';
import type {RenderProps} from '../../types';

export const FastCut: React.FC<RenderProps> = (p) => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.max(1, Math.round(s * fps));
  const {colors} = p.brand;
  const ctaStart = p.scenes.reduce((s, sc) => s + sc.duration, 0);
  return (
    <AbsoluteFill style={{backgroundColor: colors.background}}>
      {p.scenes.map((sc) => (
        <Sequence key={sc.id} name={sc.id} from={Math.round(sc.start * fps)} durationInFrames={f(sc.duration)}>
          <SceneTransition type={sc.transition}>
            {sc.media.length === 0 && (
              <AbsoluteFill style={{background: `linear-gradient(160deg, ${colors.primary}, ${colors.background})`}} />
            )}
            {sc.media.map((m, i) => (
              <Sequence key={`media-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                <MediaShot item={m} />
              </Sequence>
            ))}
            {sc.motion.map((m, i) => (
              <Sequence key={`motion-${i}`} from={Math.round(m.start * fps)} durationInFrames={f(m.duration)}>
                <MotionLayer item={m} brand={p.brand} />
              </Sequence>
            ))}
            {sc.overlay && <Overlay overlay={sc.overlay} brand={p.brand} />}
            <Captions chunks={sc.captions} highlight={sc.highlight} style={p.captions} />
          </SceneTransition>
          {sc.voice && <Audio src={staticFile(sc.voice.src)} />}
        </Sequence>
      ))}
      {p.brand.logo && (
        <AbsoluteFill><Img src={staticFile(p.brand.logo)} style={{position: 'absolute', top: 80, left: 60, width: 160}} /></AbsoluteFill>
      )}
      {p.cta && (
        <Sequence name="cta" from={Math.round(ctaStart * fps)} durationInFrames={f(p.cta.duration)}>
          <CtaCard cta={p.cta} brand={p.brand} />
        </Sequence>
      )}
      {p.music && <MusicTrack music={p.music} scenes={p.scenes} total={p.totalSeconds} />}
    </AbsoluteFill>
  );
};
```

```ts
// src/templates/index.ts — template name (storyboard "template") -> component; one folder per template
import type React from 'react';
import type {RenderProps} from '../types';
import {FastCut} from './fast-cut/FastCut';

export const TEMPLATES: Record<string, React.FC<RenderProps>> = {'fast-cut': FastCut};
```

```tsx
// src/Reel.tsx
import React from 'react';
import {TEMPLATES} from './templates';
import type {RenderProps} from './types';
import './fonts';

export const Reel: React.FC<RenderProps> = (props) => {
  const T = TEMPLATES[props.template];
  if (!T) throw new Error(`Unknown template "${props.template}" — register it in studio/src/templates/index.ts`);
  return <T {...props} />;
};
```

```tsx
// src/Root.tsx (replace the scaffold's composition list; keep the exported name the scaffold's index.ts uses)
import React from 'react';
import {Composition} from 'remotion';
import smoke from '../fixtures/smoke-props.json';
import {Reel} from './Reel';
import type {RenderProps} from './types';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    defaultProps={smoke as unknown as RenderProps}
    durationInFrames={1}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({props}) => ({
      durationInFrames: Math.max(1, Math.ceil(props.totalSeconds * props.fps)),
      fps: props.fps,
      width: props.width,
      height: props.height,
    })}
  />
);
```

- [ ] **Step 5: Write `studio/fixtures/smoke-props.json`**

```json
{
  "template": "fast-cut", "fps": 30, "width": 1080, "height": 1920,
  "brand": {"name": "Demo Academy", "logo": null,
            "colors": {"primary": "#1E3A8A", "accent": "#FFD400", "text": "#FFFFFF", "background": "#0B1530"}},
  "captions": {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400"},
  "music": {"src": "music/_smoke.mp3", "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5},
  "scenes": [
    {"id": "s1", "start": 0, "duration": 3,
     "voice": {"src": "projects/_smoke/audio/_fixture-voice.wav", "duration": 2.5},
     "captions": [{"text": "Học viên đạt IELTS 7.5", "start": 0, "end": 1.25},
                  {"text": "chỉ sau 3 tháng", "start": 1.25, "end": 2.5}],
     "highlight": ["7.5"], "overlay": {"text": "GIẢM 50%", "position": "top"},
     "media": [{"src": "library/_smoke-landscape.mp4", "type": "video", "from": 1, "start": 0, "duration": 3, "effect": "zoom-in"}],
     "motion": [], "transition": "cut"},
    {"id": "s2", "start": 3, "duration": 2, "voice": null,
     "captions": [{"text": "Lớp học sôi động mỗi ngày", "start": 0, "end": 2}],
     "highlight": [], "overlay": null,
     "media": [{"src": "library/_smoke-portrait.mp4", "type": "video", "from": 0, "start": 0, "duration": 1, "effect": "none"},
               {"src": "library/_smoke.jpg", "type": "image", "from": 0, "start": 1, "duration": 1, "effect": "pan-left"}],
     "motion": [], "transition": "fade"},
    {"id": "s3", "start": 5, "duration": 2, "voice": null, "captions": [], "highlight": [], "overlay": null,
     "media": [], "motion": [], "transition": "slide"}
  ],
  "cta": {"title": "Đăng ký ngay", "phone": "0900 000 000", "fanpage": "fb.com/demo", "duration": 3},
  "totalSeconds": 10
}
```

- [ ] **Step 6: Typecheck and render stills**

```bash
cd /home/giabao/dev/create-video/studio
npx tsc --noEmit
mkdir -p ../projects/_smoke/preview
for fr in 45 100 130 165 255; do npx remotion still Reel ../projects/_smoke/preview/f$fr.png --frame=$fr --props=fixtures/smoke-props.json --log=error; done
```

Expected: tsc exits 0 and 5 PNGs exist. **View each PNG yourself** and check:
- f45: the landscape clip sits centered over a blurred copy; "GIẢM 50%" is tilted at the top; the caption shows "Học viên đạt IELTS 7.5" with "7.5" in yellow.
- f100: the portrait clip fills the frame; the caption is visible.
- f130: the pan-left photo.
- f165: the brand gradient background (pure motion scene, empty for now).
- f255: the CTA card with the title, phone and fanpage, with diacritics intact.

- [ ] **Step 7: Render a draft and probe it**

```bash
npx remotion render Reel ../projects/_smoke/smoke-v0.mp4 --props=fixtures/smoke-props.json --scale=0.5 --log=error
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of compact ../projects/_smoke/smoke-v0.mp4
```

Expected: duration ≈ 10.0 s, a video stream at 540×960, and an audio stream present.

- [ ] **Step 8: Commit**

```bash
cd /home/giabao/dev/create-video
git add studio/package.json studio/package-lock.json studio/tsconfig.json studio/remotion.config.ts studio/src studio/fixtures studio/public studio/.gitignore studio/README.md
git status --short studio   # verify: no node_modules, no mp4
git commit -m "Add Remotion studio with fast-cut template and core reel components"
```

(Adjust the `git add` list to the files the scaffold actually created; never add `node_modules`.)

---

### Task 7: Motion graphics library

**Files:**
- Create: `studio/src/motion/{KineticText,CountUp,Checklist,PriceTag,DateBadge,LowerThird}.tsx`
- Modify: `studio/src/motion/registry.ts`, `studio/fixtures/smoke-props.json` (scene s3 gets motion), `projects/_smoke/storyboard.json` (add a motion scene)

**Interfaces:**
- Consumes:
  - From T6: `Brand` (`src/types.ts`), `fontFamily` (`src/fonts.ts`), `MOTION` (`src/motion/registry.ts`).
- Produces: registry keys `KineticText`, `CountUp`, `Checklist`, `PriceTag`, `DateBadge`, `LowerThird`. File name = export name = registry key; Python validation checks `studio/src/motion/<Name>.tsx`.

Props contract (also used in storyboards):

| Component | Props |
|---|---|
| `KineticText` | `lines: string[]` |
| `CountUp` | `from: number, to: number, decimals?: number (=1), label?: string, suffix?: string` |
| `Checklist` | `items: string[], title?: string` |
| `PriceTag` | `price: string, old?: string, note?: string` |
| `DateBadge` | `label: string, date: string` |
| `LowerThird` | `title: string, subtitle?: string` |

- [ ] **Step 1: Write the six components**

```tsx
// src/motion/KineticText.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const KineticText: React.FC<{lines: string[]; brand: Brand}> = ({lines, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24, padding: 80}}>
      {lines.map((line, i) => {
        const s = spring({frame: frame - i * 8, fps, config: {damping: 12}});
        return (
          <div key={i} style={{
            fontFamily, fontWeight: 800, fontSize: 110, lineHeight: 1.05, textAlign: 'center',
            color: i % 2 ? brand.colors.accent : brand.colors.text, opacity: s,
            transform: `translateY(${(1 - s) * 80}px) scale(${0.8 + 0.2 * s})`, textShadow: '0 6px 24px rgba(0,0,0,.6)',
          }}>{line}</div>
        );
      })}
    </AbsoluteFill>
  );
};
```

```tsx
// src/motion/CountUp.tsx
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const CountUp: React.FC<{from: number; to: number; decimals?: number; label?: string; suffix?: string; brand: Brand}> = (
  {from, to, decimals = 1, label, suffix = '', brand},
) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = interpolate(frame, [0, 1.2 * fps], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const pop = spring({frame, fps, config: {damping: 10}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{background: brand.colors.primary, borderRadius: 48, padding: '40px 72px', textAlign: 'center',
        transform: `scale(${pop})`, boxShadow: '0 20px 60px rgba(0,0,0,.45)', fontFamily}}>
        {label && <div style={{fontWeight: 700, fontSize: 56, color: brand.colors.text}}>{label}</div>}
        <div style={{fontWeight: 800, fontSize: 220, lineHeight: 1, color: brand.colors.accent}}>
          {(from + (to - from) * p).toFixed(decimals)}{suffix}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// src/motion/Checklist.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const Checklist: React.FC<{items: string[]; title?: string; brand: Brand}> = ({items, title, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: '0 90px', gap: 36, fontFamily}}>
      {title && <div style={{fontWeight: 800, fontSize: 84, color: brand.colors.accent, marginBottom: 20}}>{title}</div>}
      {items.map((item, i) => {
        const s = spring({frame: frame - Math.round((0.3 + i * 0.5) * fps), fps, config: {damping: 14}});
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 32, opacity: s, transform: `translateX(${(1 - s) * -120}px)`}}>
            <div style={{width: 84, height: 84, borderRadius: 42, background: brand.colors.accent, color: brand.colors.background,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800, flexShrink: 0}}>✓</div>
            <div style={{fontWeight: 700, fontSize: 64, color: brand.colors.text, lineHeight: 1.15}}>{item}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
```

```tsx
// src/motion/PriceTag.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const PriceTag: React.FC<{price: string; old?: string; note?: string; brand: Brand}> = ({price, old, note, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 9}});
  const strike = spring({frame: frame - 12, fps, config: {damping: 20}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{background: brand.colors.accent, borderRadius: 40, padding: '48px 80px', textAlign: 'center',
        transform: `rotate(-4deg) scale(${s})`, boxShadow: '0 24px 70px rgba(0,0,0,.5)'}}>
        {old && (
          <div style={{position: 'relative', display: 'inline-block', fontWeight: 700, fontSize: 72, color: brand.colors.background, opacity: 0.7}}>
            {old}
            <div style={{position: 'absolute', left: 0, top: '52%', height: 8, width: `${strike * 100}%`, background: '#E11D48'}} />
          </div>
        )}
        <div style={{fontWeight: 800, fontSize: 180, lineHeight: 1, color: brand.colors.background}}>{price}</div>
        {note && <div style={{fontWeight: 700, fontSize: 52, color: brand.colors.background, marginTop: 12}}>{note}</div>}
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// src/motion/DateBadge.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const DateBadge: React.FC<{label: string; date: string; brand: Brand}> = ({label, date, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 12}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily}}>
      <div style={{width: 620, borderRadius: 36, overflow: 'hidden', background: '#FFFFFF', transform: `translateY(${(1 - s) * 300}px)`,
        opacity: s, boxShadow: '0 24px 70px rgba(0,0,0,.5)', textAlign: 'center'}}>
        <div style={{background: brand.colors.primary, color: brand.colors.text, fontWeight: 800, fontSize: 60, padding: '28px 0'}}>{label}</div>
        <div style={{color: brand.colors.background, fontWeight: 800, fontSize: 120, padding: '40px 0'}}>{date}</div>
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// src/motion/LowerThird.tsx
import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../fonts';
import type {Brand} from '../types';

export const LowerThird: React.FC<{title: string; subtitle?: string; brand: Brand}> = ({title, subtitle, brand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{fontFamily}}>
      <div style={{position: 'absolute', left: 0, bottom: 640, transform: `translateX(${(s - 1) * 100}%)`,
        background: brand.colors.primary, borderLeft: `16px solid ${brand.colors.accent}`, padding: '24px 48px 24px 40px',
        borderRadius: '0 24px 24px 0', maxWidth: '88%'}}>
        <div style={{fontWeight: 800, fontSize: 64, color: brand.colors.text}}>{title}</div>
        {subtitle && <div style={{fontWeight: 400, fontSize: 44, color: brand.colors.accent}}>{subtitle}</div>}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Register them**

```ts
// src/motion/registry.ts — one entry per file studio/src/motion/<Name>.tsx exporting <Name>
import type React from 'react';
import {Checklist} from './Checklist';
import {CountUp} from './CountUp';
import {DateBadge} from './DateBadge';
import {KineticText} from './KineticText';
import {LowerThird} from './LowerThird';
import {PriceTag} from './PriceTag';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOTION: Record<string, React.ComponentType<any>> = {
  KineticText, CountUp, Checklist, PriceTag, DateBadge, LowerThird,
};
```

- [ ] **Step 3: Exercise every component in the fixture**

In `studio/fixtures/smoke-props.json`:
- Give s3 these `motion` items:
  ```json
  [{"component": "Checklist", "props": {"title": "Lộ trình 3 bước", "items": ["Kiểm tra đầu vào", "Học 1 kèm 1", "Thi thử hằng tuần"]}, "start": 0, "duration": 1},
   {"component": "PriceTag", "props": {"old": "1.990K", "price": "999K", "note": "Ưu đãi tháng này"}, "start": 1, "duration": 1}]
  ```
- Give s1 `"motion": [{"component": "CountUp", "props": {"from": 5.5, "to": 7.5, "label": "IELTS"}, "start": 1.5, "duration": 1.5}]`.
- Give s2 `"motion": [{"component": "LowerThird", "props": {"title": "Cô Minh Anh", "subtitle": "8.5 IELTS"}, "start": 0, "duration": 2}]`.

KineticText and DateBadge are covered in Step 4 via a temporary props file `studio/fixtures/motion-extra.json`: a copy of the fixture where s3's motion is `[{"component":"KineticText","props":{"lines":["Học thật","Thi thật","Điểm thật"]},"start":0,"duration":1},{"component":"DateBadge","props":{"label":"Khai giảng","date":"01/12"},"start":1,"duration":1}]`. Commit this file too.

- [ ] **Step 4: Typecheck and view stills**

```bash
cd /home/giabao/dev/create-video/studio && npx tsc --noEmit
for fr in 80 100 160 190; do npx remotion still Reel ../projects/_smoke/preview/m$fr.png --frame=$fr --props=fixtures/smoke-props.json --log=error; done
for fr in 165 195; do npx remotion still Reel ../projects/_smoke/preview/x$fr.png --frame=$fr --props=fixtures/motion-extra.json --log=error; done
```

Expected (view each PNG):
- m80: CountUp over footage.
- m100: LowerThird.
- m160: Checklist.
- m190: PriceTag with "1.990K" struck through.
- x165: KineticText.
- x195: DateBadge.

All text must have Vietnamese diacritics intact, with no overflow off-canvas.

- [ ] **Step 5: Add a motion scene to `projects/_smoke/storyboard.json`**

Insert this as scene `s3m` before s3:

```json
{ "id": "s3m", "say": "Lộ trình ba bước rõ ràng.", "caption": "Lộ trình 3 bước rõ ràng",
  "motion": [ { "component": "Checklist", "props": { "items": ["Kiểm tra đầu vào", "Học 1 kèm 1", "Thi thử hằng tuần"] } } ] }
```

Then run `uv run --with pytest python -m pytest tools/tests -q` (if T2 is merged) to confirm validation still passes on fixtures.

- [ ] **Step 6: Commit**

```bash
cd /home/giabao/dev/create-video
git add studio/src/motion studio/fixtures/smoke-props.json studio/fixtures/motion-extra.json projects/_smoke/storyboard.json
git commit -m "Add motion graphics library: KineticText, CountUp, Checklist, PriceTag, DateBadge, LowerThird"
```

---

### Task 8: `setup.sh`, `tools/sync.sh`, fresh-clone check

**Files:**
- Create: `setup.sh`, `tools/sync.sh`

**Interfaces:**
- Consumes:
  - `config.json` `sync.remote` (T1).
  - `studio/package-lock.json` (T6).
  - The submodule (T1).
- Produces:
  - `./setup.sh` (idempotent).
  - `tools/sync.sh push|pull [extra rclone flags, e.g. --dry-run]`.

- [ ] **Step 1: Write `setup.sh`**

```bash
#!/usr/bin/env bash
# One-shot, idempotent setup on a fresh clone: ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"
ok() { echo "✓ $*"; }
warn() { echo "⚠ $*"; }

for t in git ffmpeg ffprobe uv node npm rclone python3; do
  if command -v "$t" >/dev/null; then ok "$t"; else warn "missing $t"; fi
done
command -v ffmpeg >/dev/null || warn "  install: sudo apt install ffmpeg"
command -v rclone >/dev/null || warn "  install: sudo apt install rclone"
command -v uv >/dev/null || warn "  install: curl -LsSf https://astral.sh/uv/install.sh | sh"

git submodule update --init
if command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1; then
  ok "NVIDIA GPU found -> VieNeu with CUDA"; (cd VieNeu-TTS && uv sync --extra cuda)
else
  warn "No NVIDIA GPU -> VieNeu runs on CPU (ONNX), slower"; (cd VieNeu-TTS && uv sync)
fi

(cd studio && npm ci)
mkdir -p inbox library music reference voices/tries projects
[ -f library/media-index.json ] || echo '{}' > library/media-index.json
for d in library music brands projects; do
  [ -L "studio/public/$d" ] || { warn "studio/public/$d symlink missing, recreating"; ln -sfn "../../$d" "studio/public/$d"; }
done

REMOTE=$(python3 -c 'import json;print(json.load(open("config.json"))["sync"]["remote"].split(":")[0])')
if command -v rclone >/dev/null && rclone listremotes | grep -qx "$REMOTE:"; then
  ok "rclone remote $REMOTE: -> run: tools/sync.sh pull"
else
  warn "rclone remote '$REMOTE' not set up: run 'rclone config', create a Google Drive remote named $REMOTE"
fi
ok "setup done"
```

- [ ] **Step 2: Write `tools/sync.sh`**

```bash
#!/usr/bin/env bash
# Copy media between this machine and Google Drive. Never deletes; never overwrites a newer file.
# Usage: tools/sync.sh push|pull [extra rclone flags, e.g. --dry-run]
set -euo pipefail
cd "$(dirname "$0")/.."
mode=${1:-}
case "$mode" in push|pull) shift ;; *) echo "Usage: tools/sync.sh push|pull [--dry-run]"; exit 2 ;; esac

REMOTE=$(python3 -c 'import json;print(json.load(open("config.json"))["sync"]["remote"])')
rclone listremotes | grep -qx "${REMOTE%%:*}:" || { echo "rclone remote '${REMOTE%%:*}' not configured. Run: rclone config"; exit 1; }

copy() { # copy <local> <remote-subpath> [filters...]
  local local_dir=$1 sub=$2; shift 2
  mkdir -p "$local_dir"
  if [ "$mode" = push ]; then
    rclone copy "$local_dir" "$REMOTE/$sub" --update "$@" "${EXTRA[@]}"
  else
    rclone copy "$REMOTE/$sub" "$local_dir" --update "$@" "${EXTRA[@]}"
  fi
  echo "✓ $mode $local_dir"
}

EXTRA=("$@")
copy library library
copy music music
copy reference reference
copy projects projects --include "*/reel-v*.mp4"
```

- [ ] **Step 3: Test `sync.sh` safely**

```bash
chmod +x setup.sh tools/sync.sh
tools/sync.sh bogus; echo "exit=$?"            # expect usage + exit=2
tools/sync.sh push --dry-run 2>&1 | tail -5    # expect "✓ push ..." lines; rclone NOTICE lines say what would be copied
tools/sync.sh pull --dry-run 2>&1 | tail -5
```

Expected: no errors. The dry runs make no changes on Drive or locally. (The first real `push` happens in T9 after the user confirms.)

- [ ] **Step 4: Fresh-clone check**

```bash
TMP=$(mktemp -d)
git clone --recursive /home/giabao/dev/create-video "$TMP/cv"
cd "$TMP/cv" && ./setup.sh 2>&1 | tail -15
ls -la studio/public | grep -- '->'
tools/make_smoke_media.sh
VieNeu-TTS/.venv/bin/python tools/prepare.py projects/_smoke 2>&1 | grep -vE 'it/s|%\|' | tail -4
cd studio && npx remotion render Reel ../projects/_smoke/reel-v1.mp4 --props=../projects/_smoke/render-props.json --scale=0.5 --log=error && ls -la ../projects/_smoke/reel-v1.mp4
```

Expected:
- `setup.sh` ends with `✓ setup done` (an rclone warning is fine in the temp clone).
- The 4 symlinks exist.
- `prepare.py` prints Total/Mix.
- The mp4 exists.

Note: the submodule clones from GitHub, and `uv` reuses its cache. Delete `$TMP` afterwards.

- [ ] **Step 5: Commit**

```bash
cd /home/giabao/dev/create-video
git add setup.sh tools/sync.sh
git commit -m "Add setup.sh and Google Drive sync script"
```

---

### Task 9: Claude workflow (CLAUDE.md, `/make-reel`), Remotion skills, end-to-end

**Files:**
- Create: `CLAUDE.md`, `.claude/skills/make-reel/SKILL.md`
- Install: Remotion agent skills
- Modify: `docs/superpowers/specs/2026-11-18-reel-pipeline-design.md` (record any deviations found during T2–T8)

**Interfaces:**
- Consumes: every CLI from T4, T5, T6 and T8.

- [ ] **Step 1: Write `CLAUDE.md`**

````markdown
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
- Tests: `uv run --with pytest python -m pytest tools/tests -q` and `cd studio && npx tsc --noEmit`.

## Rules
1. Never invent ad facts (price, phone, dates, address, scores, results). Ask the user.
2. "từ giờ / mặc định / lần sau cũng…" -> edit `config.json`. About the current video -> edit only its `storyboard.json`.
   Ambiguous -> ask "Chỉ video này hay lưu làm mặc định?".
3. "Lưu thiết lập này làm mặc định" -> copy the resolved values from `projects/<slug>/timings.json` into `config.json`.
4. `say` = spoken text: spell numbers, prices, phone numbers and English words the way they must be read.
   `caption` = displayed text with normal spelling.
5. Aim for `config.mix` (≈60% real footage / 30% motion / 10% other). `prepare.py` prints the actual mix.
6. Motion graphics: reuse `studio/src/motion/*`, or write a new `studio/src/motion/<Name>.tsx` exporting `<Name>`,
   register it in `registry.ts`, and use the `brand` prop for colors. Add its props to the table in the spec.
7. Before every draft: render one still per scene and look at it (overflow, covered faces, wrong shot, mix).
8. Never overwrite a render: use the next `reel-v<N>`. Commit `storyboard.json` when the user accepts a version.
9. `VieNeu-TTS/` is upstream code: never edit it.
````

- [ ] **Step 2: Write `.claude/skills/make-reel/SKILL.md`**

```markdown
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
   - Mode A (default): write the script yourself; choose shots from `media-index.json` (`description`, `goodRanges`); add motion scenes/layers to reach ~60/30/10.
   - Mode B: the user dictated script/shots — transcribe faithfully, don't rewrite.
4. **Prepare:** `VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug>`. Fix any reported errors.
   Over `targetSeconds` -> shorten `say` and rerun (only changed scenes re-synthesize).
5. **Self-check:** render a still at the middle frame of each scene and look at every one; fix problems before rendering.
6. **Draft:** render `reel-v<N>.mp4` at `--scale=0.5`. Reply in Vietnamese with:
   - the absolute path;
   - a table (scene | lời đọc | hình | motion | giây);
   - total length and mix.
7. **Iterate:** apply feedback per CLAUDE.md rule 2. Re-run prepare -> stills -> next `reel-v<N>`.
8. **Final:** on approval, render without `--scale`, commit `storyboard.json`, and offer `tools/sync.sh push`.
```

- [ ] **Step 3: Install the official Remotion agent skills**

Run: `cd /home/giabao/dev/create-video && npx skills add remotion-dev/skills`.
- If it asks interactively, choose the project-level Claude Code target.
- Verify that the skill files landed under `.claude/skills/`, then commit them so other machines get them.
- If the command doesn't exist or fails, report the exact error and skip this step (not blocking).

- [ ] **Step 4: End-to-end on the smoke project**

```bash
cd /home/giabao/dev/create-video
VieNeu-TTS/.venv/bin/python tools/prepare.py projects/_smoke 2>&1 | grep -vE 'it/s|%\|' | tail -4
cd studio && npx remotion render Reel ../projects/_smoke/reel-v1.mp4 --props=../projects/_smoke/render-props.json --scale=0.5 --log=error
ffprobe -v error -show_entries format=duration -of csv=p=0 ../projects/_smoke/reel-v1.mp4
```

Expected:
- The mix line shows a non-zero motion share.
- The mp4 duration equals `totalSeconds` from `render-props.json` (±0.1 s).
- Listen to the beginning (`ffplay -autoexit -t 4 ../projects/_smoke/reel-v1.mp4`, or report the path to the user): the voice is audible over ducked music.

- [ ] **Step 5: Spec sync and commit**

Update the spec where implementation differed:
- `tools/ingest.sh` became `tools/ingest.py`;
- originals now go to `inbox/_done/`;
- `tools/make_smoke_media.sh` was added;
- note the motion props table;
- add any API deviation reported by T6.

```bash
git add CLAUDE.md .claude/skills docs/superpowers/specs/2026-11-18-reel-pipeline-design.md
git commit -m "Add CLAUDE.md, make-reel skill and Remotion agent skills"
```
