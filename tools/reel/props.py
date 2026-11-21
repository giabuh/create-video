"""Builds the fully resolved render-props.json consumed by the Remotion `Reel` composition."""
from pathlib import Path

from .align import estimate_words, find_word
from .captions import chunk_caption

# Cards that animate their own exit (registered with ownsExit: true in studio/src/motion/registry.ts): no default fade.
OWNS_EXIT = {"Ribbon", "TwoTier", "Callout", "PinLabel", "GlossyPill", "GiantText", "OfferCard", "Stamp",
            "MaxKinetic", "MaxOffer", "MaxPhone", "MaxSteps"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _media(items: list[dict], scene_dur: float, sizes: dict | None = None) -> list[dict]:
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
            **({"frame": m["frame"]} if "frame" in m else {}),
            **({"aspect": round(sizes[m["src"]][0] / sizes[m["src"]][1], 4)} if (sizes or {}).get(m["src"], (0, 0))[1] else {}),
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
        "exit": _anim(m.get("exit"), "none" if position == "full" or m["component"] in OWNS_EXIT else "fade", 0.25 if m.get("exit") is None else 0.35),
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
        props = m.get("props") or {}
        if props.get("itemsAt"):  # one voice word per list item -> seconds from the layer start
            times = [_word_time(w, words, caption, f"{where} itemsAt[{j}]", problems) for j, w in enumerate(props["itemsAt"])]
            m = {**m, "props": {**props, "itemTimes": [round(max(0.0, t - start), 3) if t is not None else None for t in times]}}
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


def sfx_files_for(value, files: list[str]) -> list[str]:
    """A sfx value (group name, exact file name, "none"/None) -> the files it can play, sorted by name."""
    if value in (None, "", "none"):
        return []
    if value in files:
        return [value]
    return sorted(f for f in files if f.split("-", 1)[0] == value)


def _held(duration: float, raw_layer: dict) -> float:
    """A held sound lasts the layer, or only its animation when the layer sets props.seconds (CountUp, charts)."""
    secs = (raw_layer.get("props") or {}).get("seconds")  # shortcut: schema default (1.2 s) not known here; set seconds explicitly
    return min(duration, secs) if isinstance(secs, (int, float)) and secs > 0 else duration


def _sfx_events(storyboard: dict, scenes: list[dict], overlays: list[dict], cta_start: float, cta, sfx: dict,
                files: list[str], peaks: dict[str, float]) -> list[dict]:
    """Automatic + explicit sound effects (see spec "Sound effects"); explicit ones (own `sfx` key) always play."""
    motion = sfx.get("motion") or {}
    hold = sfx.get("hold") or []
    ev = []  # (hit time, value, explicit, lead when the file's peak is unknown, layer end for motion else None)
    for i, (sc, raw) in enumerate(zip(scenes, storyboard["scenes"])):
        if i and sc["transition"] != "cut":
            ev.append((sc["start"], raw.get("sfx", sfx.get("scene")), "sfx" in raw, 0.15, None))
        if i and sc["transition"] == "cut":
            ev.append((sc["start"], sfx.get("cut"), False, 0.0, None))
        for k, m in enumerate(sc["media"]):
            if k:
                ev.append((sc["start"] + m["start"], sfx.get("media"), False, 0.0, None))
        for m, rm in zip(sc["motion"], raw.get("motion") or []):
            ev.append((sc["start"] + m["start"], rm.get("sfx", motion.get(m["component"], motion.get("default"))), "sfx" in rm, 0.0,
                       sc["start"] + m["start"] + _held(m["duration"], rm)))
    for m, rm in zip(overlays, storyboard.get("motion") or []):
        ev.append((m["start"], rm.get("sfx", motion.get(m["component"], motion.get("default"))), "sfx" in rm, 0.0,
                   m["start"] + _held(m["duration"], rm)))
    if cta:
        ev.append((cta_start, sfx.get("cta"), False, 0.0, None))
    out, counter, last = [], {}, None
    for start, value, explicit, lead, end in sorted(ev, key=lambda e: e[0]):
        picks = sfx_files_for(value, files)
        if not picks or (not explicit and last is not None and start - last < sfx.get("minGap", 0)):
            continue
        n = counter[value] = counter.get(value, -1) + 1
        file = picks[n % len(picks)]
        # start early by the file's loudest moment so the hit lands on the change, not after it
        held = end is not None and value in hold  # a held sound starts with its layer and stops when it ends
        out.append({"src": f"sfx/{file}", "start": round(max(0.0, start - (0.0 if held else peaks.get(file, lead))), 3), "volume": sfx.get("volume", 0.5),
                    **({"until": round(end, 3)} if held else {})})
        last = start
    return out


MIX = ["push", "cube", "wipe", "flip", "clockWipe"]


def _scene_transition(t: str, i: int) -> str:
    """`mix` rotates the new presentations by scene index; the first scene has nothing to blend from."""
    return t if t != "mix" else "cut" if i == 0 else MIX[(i - 1) % len(MIX)]


def build_render_props(storyboard: dict, settings: dict, brand: dict, audio: dict, words: dict | None = None,
                       sfx_files: list[str] | None = None, sfx_peaks: dict[str, float] | None = None, media_sizes: dict[str, tuple[int, int]] | None = None) -> dict:
    """`sfx_files`: audio file names in sfx/ (none -> no sound effects are emitted); `sfx_peaks`: {file: seconds to its loudest moment}. `media_sizes`: {library file: (width, height)}, gives media their `aspect` (framed media). `words`: {scene id: word timings} from align.py; spoken scenes without an entry use the estimate.
    Raises AnchorError when an `at`/`until`/track anchor cannot be resolved."""
    cap = settings["captions"]
    tr = settings.get("transition") or {"scene": "cut", "media": "cut", "duration": 0.4}
    words = dict(words or {})
    problems: list[str] = []
    scenes, t = [], 0.0
    for si, sc in enumerate(storyboard["scenes"]):
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
            **({"punch": sc["punch"]} if sc.get("punch") else {}),
            **({"bg": sc["bg"]} if "bg" in sc else {}),
            **({"layout": sc["layout"]} if "layout" in sc else {}),
            "overlay": sc.get("overlay"),
            "media": _media(sc.get("media") or [], dur, media_sizes),
            "motion": _motion(sc.get("motion") or [], dur, bool(sc.get("media")), words.get(sc["id"]),
                              sc.get("caption") or "", sc["id"], problems),
            "transition": _scene_transition(sc.get("transition", tr["scene"]), si),
            **({"leak": True} if sc.get("leak") is True else {}),
            "mediaTransition": sc.get("mediaTransition", tr["media"]),
        })
        t += dur
    own = {k: v for k, v in (storyboard.get("cta") or {}).items() if v not in ("", None)}  # empty field = use the brand's
    cta = {"title": "Đăng ký ngay", "duration": 3.0, **brand.get("cta", {}), **own} if storyboard.get("cta") is not None else None
    total = round(t + (cta["duration"] if cta else 0), 3)
    captions = {sc["id"]: sc.get("caption") or "" for sc in storyboard["scenes"]}
    overlays = _track(storyboard.get("motion") or [], scenes, words, captions, t, total, problems)
    by_id = {s["id"]: s for s in scenes}
    drops = []
    for i, d in enumerate(storyboard.get("musicDrop") or []):
        a = _track_time(d.get("start", 0), by_id, words, captions, total, f"musicDrop[{i}] start", problems, end=False)
        b = _track_time(d.get("end", "video"), by_id, words, captions, total, f"musicDrop[{i}] end", problems, end=True)
        if a is not None and b is not None:
            if b > a:
                drops.append([round(a, 3), round(b, 3), float(d.get("to", 0))])
            else:
                problems.append(f"musicDrop[{i}]: end ({b:.2f}s) is not after start ({a:.2f}s)")
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
        "captions": {**{k: cap[k] for k in ("font", "size", "color", "highlightColor")}, "box": bool(cap.get("box"))},
        "look": settings.get("look") or {"grain": 0, "scanlines": 0, "logo": False},
        "music": None if music is None else {"src": f"music/{music['file']}", "volume": music["volume"],
                                             "duckTo": music["duckTo"], "fadeOut": music["fadeOut"], "drops": sorted(drops)},
        "scenes": scenes,
        "cta": cta,
        "totalSeconds": total,
        "transitionSeconds": tr["duration"],
        "overlays": overlays,
        "sfx": _sfx_events(storyboard, scenes, overlays, t, cta, settings["sfx"], sfx_files or [], sfx_peaks or {}) if settings.get("sfx") else [],
    }
