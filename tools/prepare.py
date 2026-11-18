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
