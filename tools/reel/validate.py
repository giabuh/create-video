"""Storyboard validation. Reports every problem at once, keyed by scene id, before any model loads."""
from pathlib import Path

from .config import pick, resolve_names, resolve_scene_voice

EFFECTS = {"none", "zoom-in", "zoom-out", "pan-left", "pan-right"}
TRANSITIONS = {"cut", "fade", "slide"}
POSITIONS = {"top", "center", "bottom"}
MOTION_POSITIONS = {"full", "top", "center", "bottom", "free"}
ANIMS = {"none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "pop", "zoom", "wipe", "blur"}
COLOR_KEYS = {"primary", "accent", "text", "background"}
KEYFRAME_KEYS = {"t", "x", "y", "scale", "rotate", "opacity"}
BACKDROPS = {"auto", "scrim", "none"}


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
                loud = v["tts"].get("loudness")
                if loud is not None and (isinstance(loud, bool) or not isinstance(loud, (int, float)) or not -30 <= loud <= -8):
                    errs.append(f"{sid}: loudness {loud} must be a LUFS number in -30..-8 (or null = off)")
                if not isinstance(v["tts"].get("trimSilence", True), bool):
                    errs.append(f"{sid}: trimSilence must be true or false")

        for m in sc.get("media") or []:
            if not (root / "library" / m.get("src", "")).is_file():
                errs.append(f"{sid}: library/{m.get('src')} not found")
            if m.get("effect", "none") not in EFFECTS:
                errs.append(f"{sid}: effect '{m.get('effect')}' not in {sorted(EFFECTS)}")
        for i, mo in enumerate(sc.get("motion") or []):
            errs += _layer_errors(mo, f"{sid}: motion[{i}]", root)
            for k in ("at", "until"):
                if mo.get(k) not in (None, ""):
                    errs += _word_ref_errors(mo[k], f"{sid}: motion[{i}].{k}")
                    if say is None:
                        errs.append(f"{sid}: motion[{i}].{k} needs a spoken scene ('say')")
        if "sfx" in sc and not _sfx_ok(sc["sfx"]):
            errs.append(f"{sid}: sfx must be a group name, a file name or null")
        for k in ("transition", "mediaTransition"):
            if sc.get(k, "cut") not in TRANSITIONS:
                errs.append(f"{sid}: {k} '{sc.get(k)}' not in {sorted(TRANSITIONS)}")
        overlay = sc.get("overlay")
        if overlay and overlay.get("position", "top") not in POSITIONS:
            errs.append(f"{sid}: overlay position '{overlay.get('position')}' not in {sorted(POSITIONS)}")
    ids = {sc.get("id") for sc in scenes}
    for i, mo in enumerate(storyboard.get("motion") or []):
        where = f"motion track[{i}]"
        errs += _layer_errors(mo, where, root)
        for k in ("start", "end"):
            v = mo.get(k)
            if v is None or isinstance(v, (int, float)) and not isinstance(v, bool) or (k == "end" and v == "video"):
                continue
            if not isinstance(v, dict):
                errs.append(f"{where}.{k}: seconds, {{\"scene\": id, ...}}" + (" or \"video\"" if k == "end" else ""))
                continue
            if v.get("scene") not in ids:
                errs.append(f"{where}.{k}: unknown scene '{v.get('scene')}'")
            if v.get("at") not in (None, ""):
                errs += _word_ref_errors(v["at"], f"{where}.{k}.at")
            if v.get("edge", "start") not in {"start", "end"}:
                errs.append(f"{where}.{k}.edge must be 'start' or 'end'")
    return errs


def _sfx_ok(v) -> bool:
    return v is None or isinstance(v, str)


def _num(v, lo=None, hi=None) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and (lo is None or v >= lo) and (hi is None or v <= hi)


def _word_ref_errors(v, where: str) -> list[str]:
    if isinstance(v, str) and v.strip():
        return []
    if isinstance(v, dict) and isinstance(v.get("word"), str) and v["word"].strip() \
            and _num(v.get("occurrence", 1), 1) and _num(v.get("offset", 0), -10, 10):
        return []
    return [f"{where}: a word/phrase, or {{\"word\", \"occurrence\"?, \"offset\"?}}"]


def _layer_errors(mo: dict, where: str, root: Path) -> list[str]:
    errs = []
    comp = mo.get("component", "")
    if not (root / "studio/src/motion" / f"{comp}.tsx").is_file():
        errs.append(f"{where}: motion component '{comp}' not found in studio/src/motion/")
    if mo.get("position", "full") not in MOTION_POSITIONS:
        errs.append(f"{where}: motion position '{mo.get('position')}' not in {sorted(MOTION_POSITIONS)}")
    box = mo.get("box")
    if box is not None and not (isinstance(box, dict) and all(_num(box.get(k), -50, 150) for k in ("x", "y")) and all(_num(box.get(k), 1, 200) for k in ("w", "h"))):
        errs.append(f"{where}: box must be {{x, y, w, h}} in percent of the frame")
    if mo.get("position") == "free" and box is None:
        errs.append(f"{where}: position 'free' needs a box")
    if mo.get("backdrop", "auto") not in BACKDROPS:
        errs.append(f"{where}: motion backdrop '{mo.get('backdrop')}' not in {sorted(BACKDROPS)}")
    if not _num(mo.get("scale", 1), 0.3, 2):
        errs.append(f"{where}: motion scale {mo.get('scale')} must be a number in 0.3-2")
    if not _num(mo.get("rotate", 0), -360, 360):
        errs.append(f"{where}: rotate must be degrees in -360..360")
    if not _num(mo.get("opacity", 1), 0, 1):
        errs.append(f"{where}: opacity must be 0..1")
    for k in ("enter", "exit"):
        a = mo.get(k)
        t = a if isinstance(a, str) else a.get("type", "fade") if isinstance(a, dict) else "none" if a is None else None
        if t not in ANIMS or isinstance(a, dict) and not _num(a.get("duration", 0.35), 0, 10):
            errs.append(f"{where}: {k} must be one of {sorted(ANIMS)} (or {{type, duration}})")
    kfs = mo.get("keyframes")
    if kfs is not None and not (isinstance(kfs, list) and all(isinstance(k, dict) and _num(k.get("t"), 0) and set(k) <= KEYFRAME_KEYS
                                                         and all(_num(k[x]) for x in k) for k in kfs)):
        errs.append(f"{where}: keyframes must be a list of {{t, x?, y?, scale?, rotate?, opacity?}}")
    cols = mo.get("colors")
    if cols is not None and not (isinstance(cols, dict) and set(cols) <= COLOR_KEYS and all(isinstance(v, str) for v in cols.values())):
        errs.append(f"{where}: colors may override {sorted(COLOR_KEYS)} with color strings")
    if "sfx" in mo and not _sfx_ok(mo["sfx"]):
        errs.append(f"{where}: sfx must be a group name, a file name or null")
    if mo.get("props") is not None and not isinstance(mo.get("props"), dict):
        errs.append(f"{where}: props must be an object")
    return errs
