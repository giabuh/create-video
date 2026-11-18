"""Engine steps shared by the CLIs (prepare.py, voice_try.py) and the app's TTS worker (worker.py)."""
import json
import os
from pathlib import Path

from .cache import cache_key
from .config import ROOT, load_json, resolve_names, resolve_scene_voice, resolve_video
from .mix import mix
from .props import build_render_props
from .tts import probe_duration, synth_to_file
from .validate import validate

# shortcut: rough Vietnamese speaking rate for scenes not synthesized yet (preview only); real audio replaces it.
CHARS_PER_SECOND = 14


def write_json(path: Path, data) -> None:
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")  # pid: the app may run preview and worker prepare concurrently
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def prepare(proj: Path, get_model=None, synth: bool = True, on_progress=None) -> dict:
    """Validate, (optionally) synthesize, write render-props.json (+ timings.json when synth). Never raises on bad input."""
    proj = Path(proj)
    slug = proj.name
    sb = load_json(proj / "storyboard.json")
    cfg = load_json(ROOT / "config.json")
    target = cfg.get("mix")
    errs = validate(sb, cfg, ROOT)
    if errs:
        return {"ok": False, "stage": "validate", "errors": errs, "stale": [], "totalSeconds": None, "mix": None,
                "target": target, "targetSeconds": sb.get("targetSeconds")}
    _, brand_id = resolve_names(cfg, sb)
    brand = load_json(ROOT / "brands" / brand_id / "brand.json")
    settings = resolve_video(cfg, brand, sb)
    old = load_json(proj / "timings.json").get("scenes", {}) if (proj / "timings.json").exists() else {}

    spoken = [sc["id"] for sc in sb["scenes"] if sc.get("say") is not None]
    model, audio, timings, failed, stale, scenes = None, {}, {}, [], [], []
    for sc in sb["scenes"]:
        if sc.get("say") is None:
            timings[sc["id"]] = {"duration": float(sc["duration"])}
            scenes.append(sc)
            continue
        v = resolve_scene_voice(cfg, sb, sc)
        ref = ROOT / v["ref"]
        key = cache_key(ref.read_bytes(), sc["say"], v["tts"])
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
                dur = probe_duration(out)
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
        return {"ok": False, "stage": "tts", "errors": failed, "stale": stale, "totalSeconds": None, "mix": None,
                "target": target, "targetSeconds": sb.get("targetSeconds")}

    props = build_render_props({**sb, "scenes": scenes}, settings, brand, audio)
    cta_s = props["cta"]["duration"] if props["cta"] else 0
    actual = mix([{"duration": s["duration"], "hasMedia": bool(s["media"])} for s in props["scenes"]], cta_s)
    write_json(proj / "render-props.json", props)
    if synth:
        write_json(proj / "timings.json", {"scenes": timings, "totalSeconds": props["totalSeconds"], "mix": actual})
    return {"ok": True, "stage": None, "errors": [], "stale": stale, "totalSeconds": props["totalSeconds"],
            "mix": actual, "target": target, "targetSeconds": sb.get("targetSeconds")}


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
