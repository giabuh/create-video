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
