import io
import json
from pathlib import Path

import pytest

import worker  # tools/worker.py (conftest.py already puts tools/ on sys.path)
from reel import pipeline

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def proj(tmp_path, monkeypatch):
    """A throwaway repo root with config, brand, a template dir and one project."""
    root = tmp_path
    (root / "studio/src/templates/fast-cut").mkdir(parents=True)
    (root / "brands/demo").mkdir(parents=True)
    (root / "voices").mkdir()
    (root / "voices/phuong-short.wav").write_bytes(b"ref")
    (root / "library").mkdir()
    (root / "library/a.jpg").write_bytes(b"x")
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    (root / "config.json").write_text(json.dumps(cfg), encoding="utf-8")
    (root / "brands/demo/brand.json").write_text((ROOT / "brands/demo/brand.json").read_text(encoding="utf-8"), encoding="utf-8")
    p = root / "projects/p1"
    p.mkdir(parents=True)
    sb = {"scenes": [
        {"id": "s1", "say": "Xin chào các bạn", "caption": "Xin chào", "media": [{"src": "a.jpg"}]},
        {"id": "s2", "duration": 2, "media": [{"src": "a.jpg"}]},
    ], "cta": {"title": "Đăng ký"}}
    (p / "storyboard.json").write_text(json.dumps(sb, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(pipeline, "ROOT", root)
    monkeypatch.setattr(pipeline, "probe_duration", lambda path: 1.5)
    return p


def run(lines, monkeypatch, loader=lambda: "model"):
    out = io.StringIO()
    w = worker.Worker(loader=loader, out=out)
    for line in lines:
        w.feed(line)
    return [json.loads(l) for l in out.getvalue().splitlines()]


def test_ping_and_bad_json(monkeypatch):
    msgs = run(['{"id":"1","cmd":"ping"}', "not json", '{"id":"2","cmd":"nope"}'], monkeypatch)
    assert msgs[0] == {"id": "1", "ok": True, "modelLoaded": False, "device": None}
    assert msgs[1]["ok"] is False and msgs[1]["id"] is None
    assert msgs[2] == {"id": "2", "ok": False, "errors": ["unknown cmd: nope"]}


def test_prepare_streams_progress_and_loads_model_once(proj, monkeypatch):  # proj fixture copied from test_pipeline.py
    loads = []
    monkeypatch.setattr(pipeline, "synth_to_file", lambda m, say, ref, tts, out: (out.parent.mkdir(parents=True, exist_ok=True), out.write_bytes(b"w"), 1.0)[2])
    monkeypatch.setattr(worker, "detect_device", lambda: "cpu")
    msgs = run(['{"id":"a","cmd":"prepare","project":"p1"}', '{"id":"b","cmd":"prepare","project":"p1"}'],
               monkeypatch, loader=lambda: loads.append(1) or "model")
    assert loads == [1]
    assert {"event": "model", "state": "ready", "device": "cpu"} in msgs
    assert [m["done"] for m in msgs if m.get("event") == "progress" and m["id"] == "a"] == [0, 1]
    final = [m for m in msgs if m.get("id") == "a" and "ok" in m][0]
    assert final["ok"] and final["stale"] == []


def test_prepare_rejects_path_escape(monkeypatch):
    msgs = run(['{"id":"x","cmd":"prepare","project":"../etc"}'], monkeypatch)
    assert msgs[0]["ok"] is False


def test_non_object_request_and_missing_field(monkeypatch):
    msgs = run(['[]', '5', 'null', '{"id":"t","cmd":"try","text":"x"}', '{"id":"1","cmd":"ping"}'], monkeypatch)
    assert [m["ok"] for m in msgs] == [False, False, False, False, True]
    assert msgs[0]["id"] is None
    assert msgs[3] == {"id": "t", "ok": False, "errors": ["missing field: voice"]}
