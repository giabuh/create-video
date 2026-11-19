import json
from pathlib import Path

import pytest

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


def fake_synth(calls):
    def synth(model, say, ref, tts, out):
        calls.append(say)
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_bytes(b"wav")
        return 1.5
    return synth


def test_preview_marks_unsynthesized_scenes_stale_and_keeps_timings(proj, monkeypatch):
    monkeypatch.setattr(pipeline, "synth_to_file", lambda *a: pytest.fail("preview must not synthesize"))
    (proj / "timings.json").write_text(json.dumps({"scenes": {"s1": {"duration": 2.2}}, "totalSeconds": 0, "mix": {}}), encoding="utf-8")
    before = (proj / "timings.json").read_text(encoding="utf-8")
    res = pipeline.prepare(proj, get_model=lambda: pytest.fail("no model in preview"), synth=False)
    assert res["ok"] and res["stale"] == ["s1"]
    props = json.loads((proj / "render-props.json").read_text(encoding="utf-8"))
    s1 = props["scenes"][0]
    assert s1["voice"] is None and s1["duration"] == pytest.approx(2.2 + 0.3)  # old duration + pauseAfter
    assert (proj / "timings.json").read_text(encoding="utf-8") == before


def test_preview_estimates_duration_without_old_timings(proj, monkeypatch):
    res = pipeline.prepare(proj, synth=False)
    s1 = json.loads((proj / "render-props.json").read_text(encoding="utf-8"))["scenes"][0]
    assert res["stale"] == ["s1"]
    assert s1["duration"] == pytest.approx(len("Xin chào các bạn") / pipeline.CHARS_PER_SECOND + 0.3, abs=1e-3)
    assert not (proj / "timings.json").exists()


def test_synth_writes_audio_timings_and_reports_progress(proj, monkeypatch):
    calls, progress = [], []
    monkeypatch.setattr(pipeline, "synth_to_file", fake_synth(calls))
    res = pipeline.prepare(proj, get_model=lambda: "model", synth=True, on_progress=lambda d, t, s: progress.append((d, t, s)))
    assert res["ok"] and res["stale"] == [] and calls == ["Xin chào các bạn"]
    assert progress == [(0, 1, "s1"), (1, 1, "s1")]
    t = json.loads((proj / "timings.json").read_text(encoding="utf-8"))
    assert t["scenes"]["s1"]["duration"] == 1.5 and t["scenes"]["s2"] == {"duration": 2.0}
    # second run is fully cached: preview now has no stale scenes
    assert pipeline.prepare(proj, synth=False)["stale"] == []


def test_validation_errors_are_returned_not_raised(proj):
    sb = json.loads((proj / "storyboard.json").read_text(encoding="utf-8"))
    sb["scenes"][0]["media"] = [{"src": "missing.mp4"}]
    (proj / "storyboard.json").write_text(json.dumps(sb), encoding="utf-8")
    res = pipeline.prepare(proj, synth=False)
    assert not res["ok"] and res["stage"] == "validate" and any("missing.mp4" in e for e in res["errors"])


def test_try_variants_writes_tries_json(proj, monkeypatch):
    calls = []
    monkeypatch.setattr(pipeline, "synth_to_file", fake_synth(calls))
    rep = pipeline.try_variants("model", "phuong", "Câu thử", [{"speed": 1.05}, {"temperature": 0.6, "ref": "voices/phuong-short.wav"}])
    assert list(rep["variants"]) == ["A", "B"] and rep["variants"]["A"]["tts"]["speed"] == 1.05
    saved = json.loads((pipeline.ROOT / "voices/tries/tries.json").read_text(encoding="utf-8"))
    assert saved == rep and calls == ["Câu thử", "Câu thử"]


def _anchor(proj, at):
    sb = json.loads((proj / "storyboard.json").read_text(encoding="utf-8"))
    (proj.parents[1] / "studio/src/motion").mkdir(parents=True, exist_ok=True)
    (proj.parents[1] / "studio/src/motion/Text.tsx").write_text("")
    sb["scenes"][0]["motion"] = [{"component": "Text", "props": {"text": "x"}, "at": at}]
    (proj / "storyboard.json").write_text(json.dumps(sb, ensure_ascii=False), encoding="utf-8")


def test_anchor_resolves_with_the_estimate_when_whisper_is_missing(proj, monkeypatch):
    _anchor(proj, "các bạn")
    monkeypatch.setattr(pipeline, "synth_to_file", fake_synth([]))
    res = pipeline.prepare(proj, get_model=lambda: "model", synth=True)
    assert res["ok"] and res["words"] == {"s1": "estimate"}
    m = json.loads((proj / "render-props.json").read_text(encoding="utf-8"))["scenes"][0]["motion"][0]
    assert 0.5 < m["start"] < 1.5  # 'các bạn' is the second half of 'Xin chào các bạn' (1.5 s)


def test_unknown_anchor_word_is_reported_not_raised(proj, monkeypatch):
    _anchor(proj, "không có")
    res = pipeline.prepare(proj, synth=False)
    assert not res["ok"] and res["stage"] == "anchor" and "'không có' not found" in res["errors"][0]
