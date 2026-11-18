#!/usr/bin/env python3
"""Audition variants of a voice on one line.

Usage: VieNeu-TTS/.venv/bin/python tools/voice_try.py --voice phuong --text "..." \
         --variants '[{"speed": 1.05}, {"temperature": 0.6}, {"ref": "voices/phuong-full.wav"}]'
Writes voices/tries/<voice>-A.wav, -B.wav, ... and voices/tries/tries.json (resolved params per letter).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reel.config import ROOT, load_json  # noqa: E402
from reel.pipeline import try_variants  # noqa: E402
from reel.tts import load_model  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--variants", default="[{}]", help="JSON list of tts overrides; optional 'ref' per variant")
    a = ap.parse_args()
    cfg = load_json(ROOT / "config.json")
    if a.voice not in cfg["voices"]:
        print(f"Unknown voice '{a.voice}'. Known: {', '.join(cfg['voices'])}")
        return 1
    report = try_variants(load_model(), a.voice, a.text, json.loads(a.variants))
    for k, v in report["variants"].items():
        print(f"{k}: {ROOT / v['file']}  ({v['seconds']:.1f}s)  {v['tts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
