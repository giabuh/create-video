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

from reel.config import ROOT, load_json, resolve_scene_voice  # noqa: E402
from reel.tts import load_model, synth_to_file  # noqa: E402


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
    variants = json.loads(a.variants)
    model = load_model()
    out_dir = ROOT / "voices/tries"
    report = {}
    for i, over in enumerate(variants):
        over = dict(over)
        ref = over.pop("ref", None)
        v = resolve_scene_voice(cfg, {}, {"voice": a.voice, "tts": over})
        ref = ref or v["ref"]
        letter = chr(65 + i)
        out = out_dir / f"{a.voice}-{letter}.wav"
        dur = synth_to_file(model, a.text, ROOT / ref, v["tts"], out)
        report[letter] = {"file": str(out.relative_to(ROOT)), "ref": ref, "tts": v["tts"], "seconds": round(dur, 2)}
        print(f"{letter}: {out}  ({dur:.1f}s)  {over or 'defaults'}")
    (out_dir / "tries.json").write_text(json.dumps({"voice": a.voice, "text": a.text, "variants": report},
                                                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
