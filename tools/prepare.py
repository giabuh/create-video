#!/usr/bin/env python3
"""Validate a storyboard, synthesize cached per-scene voice, write timings.json + render-props.json.

Usage: VieNeu-TTS/.venv/bin/python tools/prepare.py projects/<slug> [--preview] [--json]
  --preview  no TTS: reuse cached audio, mark the rest stale, keep timings.json (runs with plain python3)
  --json     print one JSON result line instead of the human summary
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reel.pipeline import prepare  # noqa: E402


def get_model():
    from reel.tts import load_model
    return load_model()


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    flags = {a for a in argv[1:] if a.startswith("--")}
    if len(args) != 1 or flags - {"--preview", "--json"}:
        print(__doc__)
        return 2
    proj = (Path(args[0]) if Path(args[0]).is_absolute() else Path.cwd() / args[0]).resolve()
    res = prepare(proj, get_model=get_model, synth="--preview" not in flags)
    if "--json" in flags:
        print(json.dumps(res, ensure_ascii=False))
        return 0 if res["ok"] else 1
    if not res["ok"]:
        print({"validate": "Storyboard errors:", "anchor": "Motion anchors not found:"}.get(res["stage"], "TTS failed:"))
        for e in res["errors"]:
            print(f"  - {e}")
        return 1
    t, m, tg = res["targetSeconds"], res["mix"], res["target"]
    print(f"Total: {res['totalSeconds']:.1f}s" + (f" (target {t}s)" if t else ""))
    print(f"Mix: real {m['real']:.0%} / motion {m['motion']:.0%} / other {m['other']:.0%}"
          f"  (target {tg['real']:.0%}/{tg['motion']:.0%}/{tg['other']:.0%})")
    if res.get("shots"):
        print(f"Shots: {res['shots']['count']}, avg {res['shots']['avg']}s (story target <= 2.5s)")
    for sid, engine in (res.get("words") or {}).items():
        print(f"Word timings {sid}: {engine}")
    if res["stale"]:
        print(f"Stale (no voice yet): {', '.join(res['stale'])}")
    print(f"Wrote {proj / 'render-props.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
