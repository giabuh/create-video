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
