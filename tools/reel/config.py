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
