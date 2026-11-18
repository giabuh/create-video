#!/usr/bin/env python3
"""Long-lived TTS worker for the app: JSON lines on stdin -> JSON lines on stdout. Logs go to stderr.

Run with: VieNeu-TTS/.venv/bin/python tools/worker.py
"""
import json
import os
import re
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reel import pipeline  # noqa: E402

SLUG = re.compile(r"^[a-z0-9_][a-z0-9_-]{0,63}$")


def load_model():
    from reel.tts import load_model as real
    return real()


def detect_device():
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


class Worker:
    def __init__(self, loader=load_model, out=sys.stdout):
        self.loader, self.out, self.model, self.device = loader, out, None, None

    def send(self, obj) -> None:
        self.out.write(json.dumps(obj, ensure_ascii=False) + "\n")
        self.out.flush()

    def get_model(self):
        if self.model is None:
            self.send({"event": "model", "state": "loading"})
            try:
                self.model = self.loader()
            except Exception as e:
                self.send({"event": "model", "state": "error", "error": str(e)})
                raise
            self.device = detect_device()
            self.send({"event": "model", "state": "ready", "device": self.device})
        return self.model

    def handle(self, req: dict) -> dict:
        rid, cmd = req.get("id"), req.get("cmd")
        progress = lambda done, total, label: self.send({"id": rid, "event": "progress", "done": done, "total": total, "label": label})  # noqa: E731
        if cmd == "ping":
            return {"id": rid, "ok": True, "modelLoaded": self.model is not None, "device": self.device}
        if cmd == "prepare":
            slug = str(req.get("project", ""))
            if not SLUG.match(slug):
                return {"id": rid, "ok": False, "errors": [f"bad project: {slug}"]}
            res = pipeline.prepare(pipeline.ROOT / "projects" / slug, self.get_model, synth=True, on_progress=progress)
            return {"id": rid, **res}
        if cmd == "try":
            for k in ("voice", "text"):
                if k not in req:
                    return {"id": rid, "ok": False, "errors": [f"missing field: {k}"]}
            tries = pipeline.try_variants(self.get_model(), req["voice"], req["text"], req.get("variants") or [{}], on_progress=progress)
            return {"id": rid, "ok": True, "tries": tries}
        return {"id": rid, "ok": False, "errors": [f"unknown cmd: {cmd}"]}

    def feed(self, line: str) -> None:
        line = line.strip()
        if not line:
            return
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            self.send({"id": None, "ok": False, "errors": [f"bad json: {e}"]})
            return
        if not isinstance(req, dict):
            self.send({"id": None, "ok": False, "errors": ["request must be a JSON object"]})
            return
        try:
            self.send(self.handle(req))
        except Exception as e:  # keep serving after any failure
            traceback.print_exc(file=sys.stderr)
            self.send({"id": req.get("id"), "ok": False, "errors": [str(e)]})


def main() -> int:
    # VieNeu/torch may print to stdout; keep the protocol on a private dup of fd 1 and send fd 1 to stderr.
    proto = os.fdopen(os.dup(1), "w", encoding="utf-8")
    os.dup2(2, 1)
    sys.stdout = sys.stderr
    w = Worker(out=proto)
    w.send({"event": "ready"})
    for line in sys.stdin:
        w.feed(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
