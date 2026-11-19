"""Builds the fully resolved render-props.json consumed by the Remotion `Reel` composition."""
from pathlib import Path

from .align import estimate_words, find_word
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


class AnchorError(ValueError):
    """Some `at` / `until` / scene anchors could not be resolved; .problems lists them (keyed by scene id)."""

    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


def _anim(v, default_type: str, default_dur: float = 0.35) -> dict:
    if v is None:
        return {"type": default_type, "duration": default_dur if default_type != "none" else 0.0}
    if isinstance(v, str):
        return {"type": v, "duration": default_dur if v != "none" else 0.0}
    return {"type": v.get("type", "fade"), "duration": float(v.get("duration", default_dur))}


def _word_ref(v) -> tuple[str, int, float]:
    """'999K' or {"word": "999K", "occurrence": 2, "offset": -0.1} -> (word, occurrence, offset)."""
    if isinstance(v, str):
        return v, 1, 0.0
    return v["word"], int(v.get("occurrence", 1)), float(v.get("offset", 0))


def _layer(m: dict, start: float, duration: float, has_media: bool) -> dict:
    """Resolved placement/animation for one motion layer (timing already decided)."""
    position = m.get("position") or ("free" if m.get("box") else "full")
    backdrop = m.get("backdrop", "auto")
    if backdrop == "auto":  # a band/box over footage gets a dark scrim; full-frame layers keep their own look
        backdrop = "scrim" if has_media and position != "full" else "none"
    box = m.get("box")
    return {
        "component": m["component"], "props": m.get("props", {}),
        "start": round(start, 3), "duration": round(max(0.05, duration), 3),
        "position": position, "box": {k: float(box[k]) for k in ("x", "y", "w", "h")} if box else None,
        "backdrop": backdrop, "scale": float(m.get("scale", 1)), "rotate": float(m.get("rotate", 0)),
        "opacity": float(m.get("opacity", 1)),
        "enter": _anim(m.get("enter"), "none"),
        "exit": _anim(m.get("exit"), "none" if position == "full" else "fade", 0.25 if m.get("exit") is None else 0.35),
        "keyframes": [dict(k) for k in m.get("keyframes") or []],
        "colors": m.get("colors") or None,
    }


def _word_time(ref, words: list[dict] | None, caption: str, where: str, problems: list[str], end: bool = False):
    word, occ, off = _word_ref(ref)
    if not words:
        problems.append(f"{where}: '{word}' — this scene has no voice to anchor to")
        return None
    hit = find_word(word, words, caption, occ)
    if hit is None:
        problems.append(f"{where}: '{word}' not found in the scene's say/caption" + (f" (occurrence {occ})" if occ > 1 else ""))
        return None
    return hit[1 if end else 0] + off


def _motion(items: list[dict], scene_dur: float, has_media: bool, words=None, caption: str = "", sid: str = "",
            problems: list[str] | None = None) -> list[dict]:
    problems = [] if problems is None else problems
    out = []
    for i, m in enumerate(items):
        where = f"{sid}: motion[{i}] {m.get('component')}"
        start = float(m.get("start", 0))
        if m.get("at") not in (None, ""):
            t = _word_time(m["at"], words, caption, where + " at", problems)
            start = t if t is not None else start
        start = min(max(0.0, start), max(0.0, scene_dur - 0.05))
        if m.get("until") not in (None, ""):
            t = _word_time(m["until"], words, caption, where + " until", problems, end=True)
            dur = (t - start) if t is not None else scene_dur - start
        else:
            dur = float(m.get("duration", scene_dur - start))
        out.append(_layer(m, start, min(dur, scene_dur - start), has_media))
    return out


def _track_time(v, scenes: dict, words: dict, captions: dict, total: float, where: str, problems: list[str], end: bool):
    """Video-track time: seconds, "video" (= end of the video), or {"scene", "at"?, "offset"?, "edge"?}."""
    if isinstance(v, (int, float)):
        return float(v)
    if v == "video":
        return total
    sc = scenes.get(v.get("scene"))
    if sc is None:
        problems.append(f"{where}: unknown scene '{v.get('scene')}'")
        return None
    off = float(v.get("offset", 0))
    if v.get("at") not in (None, ""):
        t = _word_time(v["at"], words.get(sc["id"]), captions.get(sc["id"], ""), where, problems, end=end)
        return None if t is None else sc["start"] + t + off
    edge = v.get("edge", "end" if end else "start")
    return sc["start"] + (sc["duration"] if edge == "end" else 0) + off


def _track(items: list[dict], scenes: list[dict], words: dict, captions: dict, scenes_end: float, total: float,
           problems: list[str]) -> list[dict]:
    by_id = {s["id"]: s for s in scenes}
    out = []
    for i, m in enumerate(items):
        where = f"motion track[{i}] {m.get('component')}"
        start = _track_time(m.get("start", 0), by_id, words, captions, total, where + " start", problems, end=False)
        if m.get("end") is not None:
            end = _track_time(m["end"], by_id, words, captions, total, where + " end", problems, end=True)
        elif m.get("duration") is not None:
            end = (start or 0) + float(m["duration"])
        else:
            end = scenes_end
        if start is None or end is None:
            continue
        start = min(max(0.0, start), total)
        out.append(_layer(m, start, min(end, total) - start, True))
    return out


def build_render_props(storyboard: dict, settings: dict, brand: dict, audio: dict, words: dict | None = None) -> dict:
    """`words`: {scene id: word timings} from align.py; spoken scenes without an entry use the estimate.
    Raises AnchorError when an `at`/`until`/track anchor cannot be resolved."""
    cap = settings["captions"]
    words = dict(words or {})
    problems: list[str] = []
    scenes, t = [], 0.0
    for sc in storyboard["scenes"]:
        a = audio.get(sc["id"])
        if a and sc["id"] not in words and sc.get("say"):
            words[sc["id"]] = estimate_words(sc["say"], a["duration"])
        dur = a["duration"] + a["pauseAfter"] if a else float(sc["duration"])
        scenes.append({
            "id": sc["id"],
            "start": round(t, 3),
            "duration": round(dur, 3),
            "voice": {"src": a["src"], "duration": a["duration"]} if a else None,
            "captions": chunk_caption(sc.get("caption") or "", cap["maxWords"], a["duration"] if a else dur, words.get(sc["id"])),
            "highlight": sc.get("highlight", []),
            "overlay": sc.get("overlay"),
            "media": _media(sc.get("media") or [], dur),
            "motion": _motion(sc.get("motion") or [], dur, bool(sc.get("media")), words.get(sc["id"]),
                              sc.get("caption") or "", sc["id"], problems),
            "transition": sc.get("transition", "cut"),
        })
        t += dur
    cta = {"duration": 3.0, **brand.get("cta", {}), **storyboard["cta"]} if storyboard.get("cta") else None
    total = round(t + (cta["duration"] if cta else 0), 3)
    captions = {sc["id"]: sc.get("caption") or "" for sc in storyboard["scenes"]}
    overlays = _track(storyboard.get("motion") or [], scenes, words, captions, t, total, problems)
    if problems:
        raise AnchorError(problems)
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
        "totalSeconds": total,
        "overlays": overlays,
    }
