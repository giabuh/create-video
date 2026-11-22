"""Engine steps shared by the CLIs (prepare.py, voice_try.py) and the app's TTS worker (worker.py)."""
import json
from pathlib import Path

from .align import estimate_words, scene_words
from .cache import cache_key
from .config import ROOT, apply_template, load_json, resolve_names, resolve_scene_voice, resolve_video, write_json
from .shots import shots
from .props import AnchorError, build_render_props, sfx_files_for
from .tts import probe_duration, synth_to_file
from .validate import validate
from .videos_index import write_videos_index

# shortcut: rough Vietnamese speaking rate for scenes not synthesized yet (preview only); real audio replaces it.
CHARS_PER_SECOND = 14


SFX_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".aac"}


def _media_sizes() -> dict[str, tuple[int, int]]:
    """{library file: (width, height)} from library/media-index.json; missing or unreadable -> {} (framed media then assume a square)."""
    try:
        return {k: (v["width"], v["height"]) for k, v in load_json(ROOT / "library" / "media-index.json").items()}
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def _sfx_peaks(files: list[str]) -> dict[str, float]:
    """Seconds from each sfx file's start to its loudest moment (a whoosh swells, a ting hits at once).
    Cached in .cache/sfx-peaks.json by name:mtime_ns:size (kept out of sfx/, which the app watches and Drive syncs)."""
    cache_path = ROOT / ".cache" / "sfx-peaks.json"
    try:
        cache = load_json(cache_path)
    except (OSError, ValueError):
        cache = {}
    loaded, fresh, out = dict(cache), {}, {}
    for f in files:
        st = (ROOT / "sfx" / f).stat()
        key = f"{f}:{st.st_mtime_ns}:{st.st_size}"
        if key not in cache:
            try:
                import librosa  # in the VieNeu venv prepare.py runs with
                import numpy as np
            except ImportError:
                return {}
            y, sr = librosa.load(ROOT / "sfx" / f, sr=22050, mono=True)
            rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]
            cache[key] = min(1.0, float(np.argmax(rms)) * 256 / sr) if len(rms) else 0.0
        fresh[key] = out[f] = cache[key]
    if fresh != loaded:  # new or dropped entries
        cache_path.parent.mkdir(exist_ok=True)
        write_json(cache_path, fresh)
    return out


def _warn_sfx(sb: dict, sfx: dict | None, files: list[str]) -> None:
    """A sfx value (configured or explicit) that matches no file just plays nothing; say so."""
    if not sfx:
        return
    layers = [m for sc in sb["scenes"] for m in sc.get("motion") or []] + list(sb.get("motion") or [])
    values = [sfx.get("scene"), sfx.get("cta"), *(sfx.get("motion") or {}).values(),
              *(x["sfx"] for x in [*sb["scenes"], *layers] if "sfx" in x)]
    for v in dict.fromkeys(v for v in values if isinstance(v, str) and v != "none"):
        if not sfx_files_for(v, files):
            print(f"warning: sfx '{v}' matches no file in sfx/ (plays nothing)")


def prepare(proj: Path, get_model=None, synth: bool = True, on_progress=None) -> dict:
    """Validate, (optionally) synthesize, write render-props.json (+ timings.json when synth). Never raises on bad input."""
    proj = Path(proj)
    slug = proj.name
    sb = load_json(proj / "storyboard.json")
    cfg = apply_template(load_json(ROOT / "config.json"), sb)
    write_videos_index(ROOT)
    errs = validate(sb, cfg, ROOT)
    if errs:
        return {"ok": False, "stage": "validate", "errors": errs, "stale": [], "totalSeconds": None,
                "targetSeconds": sb.get("targetSeconds")}
    _, brand_id = resolve_names(cfg, sb)
    brand = load_json(ROOT / "brands" / brand_id / "brand.json")
    settings = resolve_video(cfg, brand, sb)
    old = load_json(proj / "timings.json").get("scenes", {}) if (proj / "timings.json").exists() else {}

    spoken = [sc["id"] for sc in sb["scenes"] if sc.get("say") is not None]
    model, audio, timings, failed, stale, scenes = None, {}, {}, [], [], []
    refs: dict[Path, bytes] = {}
    for sc in sb["scenes"]:
        if sc.get("say") is None:
            timings[sc["id"]] = {"duration": float(sc["duration"])}
            scenes.append(sc)
            continue
        v = resolve_scene_voice(cfg, sb, sc)
        ref = ROOT / v["ref"]
        if ref not in refs:
            refs[ref] = ref.read_bytes()
        key = cache_key(refs[ref], sc["say"], v["tts"])
        out = proj / "audio" / f"{sc['id']}-{key}.wav"
        if not synth and not out.exists():
            est = old.get(sc["id"], {}).get("duration") or len(sc["say"]) / CHARS_PER_SECOND
            stale.append(sc["id"])
            scenes.append({**sc, "duration": round(est + v["pauseAfter"], 3)})
            continue
        done = spoken.index(sc["id"])
        if on_progress:
            on_progress(done, len(spoken), sc["id"])
        try:
            if out.exists():
                o = old.get(sc["id"], {})
                dur = o["duration"] if o.get("cacheKey") == key and o.get("duration") else probe_duration(out)
            else:
                if model is None:
                    model = get_model()
                dur = synth_to_file(model, sc["say"], ref, v["tts"], out)
        except Exception as e:  # report per scene; cached scenes stay valid
            failed.append(f"{sc['id']}: {e}")
            continue
        if on_progress:
            on_progress(done + 1, len(spoken), sc["id"])
        audio[sc["id"]] = {"src": f"projects/{slug}/audio/{out.name}", "duration": dur, "pauseAfter": v["pauseAfter"]}
        timings[sc["id"]] = {"duration": dur, "pauseAfter": v["pauseAfter"], "voice": v["voice"],
                             "ref": v["ref"], "tts": v["tts"], "cacheKey": key}
        scenes.append(sc)
    if failed:
        return {"ok": False, "stage": "tts", "errors": failed, "stale": stale, "totalSeconds": None,
                "targetSeconds": sb.get("targetSeconds")}

    # word timings: whisper (when installed, only for scenes something is anchored to), else an estimate
    needed = _anchored_scenes(sb)
    words, engines = {}, {}
    for sc in scenes:
        a = audio.get(sc["id"])
        if not a:
            if sc["id"] in stale:  # preview without audio yet: anchor on the estimated length
                words[sc["id"]], engines[sc["id"]] = estimate_words(sc["say"], sc["duration"]), "estimate (no voice yet)"
            continue
        try:
            words[sc["id"]], engines[sc["id"]] = scene_words(ROOT, cfg, ROOT / a["src"], sc["say"], a["duration"],
                                                             allow_asr=synth and sc["id"] in needed)
        except Exception as e:  # whisper missing/broken must never block a render: fall back to the estimate
            engines[sc["id"]] = f"estimate (whisper failed: {e})"
    try:
        sfx_files = sorted(f.name for f in (ROOT / "sfx").glob("*") if f.suffix.lower() in SFX_EXTS)
        props = build_render_props({**sb, "scenes": scenes}, settings, brand, audio, words, sfx_files,
                                   _sfx_peaks(sfx_files) if settings.get("sfx") else None, _media_sizes())
        _warn_sfx(sb, settings.get("sfx"), sfx_files)
    except AnchorError as e:
        return {"ok": False, "stage": "anchor", "errors": e.problems, "stale": stale, "totalSeconds": None,
                "targetSeconds": sb.get("targetSeconds")}
    write_json(proj / "render-props.json", props)
    if synth:
        write_json(proj / "timings.json", {"scenes": timings, "totalSeconds": props["totalSeconds"]})
    return {"ok": True, "stage": None, "errors": [], "stale": stale, "totalSeconds": props["totalSeconds"],
            "targetSeconds": sb.get("targetSeconds"), "shots": shots(props["scenes"]),
            "words": {k: v for k, v in engines.items() if k in needed}}


def _anchored_scenes(sb: dict) -> set:
    """Scene ids that some motion layer is anchored to by a spoken word."""
    out = {sc["id"] for sc in sb["scenes"] if any(m.get("at") not in (None, "") or m.get("until") not in (None, "") for m in sc.get("motion") or [])}
    for m in sb.get("motion") or []:
        for k in ("start", "end"):
            v = m.get(k)
            if isinstance(v, dict) and v.get("at") not in (None, ""):
                out.add(v.get("scene"))
    return out


def try_variants(model, voice: str, text: str, variants: list[dict], on_progress=None) -> dict:
    """Synthesize `text` once per variant into voices/tries/<voice>-<A..>.wav and write voices/tries/tries.json."""
    cfg = load_json(ROOT / "config.json")
    if voice not in cfg["voices"]:
        raise ValueError(f"Unknown voice '{voice}'. Known: {', '.join(cfg['voices'])}")
    out_dir = ROOT / "voices/tries"
    report = {}
    for i, over in enumerate(variants):
        over = dict(over)
        ref = over.pop("ref", None)
        v = resolve_scene_voice(cfg, {}, {"voice": voice, "tts": over})
        ref = ref or v["ref"]
        letter = chr(65 + i)
        if on_progress:
            on_progress(i, len(variants), letter)
        out = out_dir / f"{voice}-{letter}.wav"
        dur = synth_to_file(model, text, ROOT / ref, v["tts"], out)
        report[letter] = {"file": f"voices/tries/{out.name}", "ref": ref, "tts": v["tts"], "seconds": round(dur, 2)}
    out_dir.mkdir(parents=True, exist_ok=True)
    result = {"voice": voice, "text": text, "variants": report}
    write_json(out_dir / "tries.json", result)
    if on_progress:
        on_progress(len(variants), len(variants), None)
    return result
