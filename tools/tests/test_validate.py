import pytest

from reel.validate import validate


@pytest.fixture
def root(tmp_path):
    for d in ["studio/src/templates/fast-cut", "studio/src/motion", "brands/demo", "voices", "library", "music"]:
        (tmp_path / d).mkdir(parents=True, exist_ok=True)
    for f in ["studio/src/motion/CountUp.tsx", "brands/demo/brand.json", "voices/phuong-short.wav",
              "voices/vy-short.wav", "library/a.mp4", "music/m.mp3"]:
        (tmp_path / f).write_bytes(b"x")
    return tmp_path


GOOD = [
    {"id": "s1", "say": "Xin chào", "media": [{"src": "a.mp4"}]},
    {"id": "s2", "duration": 2, "motion": [{"component": "CountUp", "props": {}}]},
]


def test_good_storyboard(root, cfg):
    assert validate({"scenes": GOOD, "music": {"file": "m.mp3"}}, cfg, root) == []


def test_reports_all_errors_at_once(root, cfg):
    sb = {"music": {"file": "nope.mp3"}, "scenes": [
        {"id": "s1", "say": "  ", "media": [{"src": "missing.mp4", "effect": "spin"}]},
        {"id": "s1", "motion": [{"component": "Nope"}]},
        {"say": "hi", "voice": "ghost", "media": [{"src": "a.mp4"}], "transition": "wipe"},
        {"id": "s4", "overlay": {"text": "X", "position": "left"}},
    ]}
    text = "\n".join(validate(sb, cfg, root))
    for needle in ["music/nope.mp3", "s1: 'say' is empty", "library/missing.mp4", "effect 'spin'",
                   "s1: duplicate id", "'Nope'", "#3: missing id", "voice 'ghost'", "transition 'wipe'",
                   "s4: needs 'media' or 'motion'", "s4: silent scene needs 'duration'", "position 'left'"]:
        assert needle in text, needle


def test_glitch_effect_accepted(root, cfg):
    sb = {"scenes": [{"id": "s1", "say": "x", "media": [{"src": "a.mp4", "effect": "glitch"}]}]}
    assert validate(sb, cfg, root) == []


def test_missing_template_and_brand(root, cfg):
    errs = validate({"template": "x", "brand": "y", "scenes": GOOD}, cfg, root)
    assert any("templates/x" in e for e in errs) and any("brands/y" in e for e in errs)


def test_speed_out_of_range(root, cfg):
    assert any("speed" in e for e in validate({"tts": {"speed": 3}, "scenes": GOOD}, cfg, root))


def test_missing_voice_ref(root, cfg):
    (root / "voices/phuong-short.wav").unlink()
    assert any("voices/phuong-short.wav" in e for e in validate({"scenes": GOOD}, cfg, root))


def test_empty_scenes(root, cfg):
    assert validate({"scenes": []}, cfg, root) == ["scenes: storyboard has no scenes"]


def test_motion_placement_and_loudness(root, cfg):
    cfg["tts"]["loudness"] = -50
    sb = {"scenes": [{"id": "s1", "say": "x", "media": [{"src": "a.mp4"}],
                      "motion": [{"component": "CountUp", "position": "left", "backdrop": "blur", "scale": 5}]}]}
    text = "\n".join(validate(sb, cfg, root))
    for needle in ["motion position 'left'", "motion backdrop 'blur'", "motion scale 5", "loudness -50"]:
        assert needle in text, needle


def test_flexible_layers_and_track(root, cfg):
    sb = {"scenes": [
        {"id": "s1", "duration": 2, "media": [{"src": "a.mp4"}], "motion": [
            {"component": "CountUp", "position": "free", "enter": "spin", "keyframes": [{"x": 3}], "colors": {"glow": "#fff"}, "at": "x"}]},
    ], "motion": [{"component": "CountUp", "start": {"scene": "nope"}, "end": "later", "box": {"x": 0, "y": 0, "w": 0, "h": 5}}]}
    text = "\n".join(validate(sb, cfg, root))
    for needle in ["needs a box", "enter must be", "keyframes must be", "colors may override", "at needs a spoken scene",
                   "track[0].start: unknown scene 'nope'", "track[0].end: seconds", "track[0]: box must be"]:
        assert needle in text, needle
    ok = {"scenes": [{"id": "s1", "say": "xin chào", "media": [{"src": "a.mp4"}], "motion": [
        {"component": "CountUp", "box": {"x": 5, "y": 5, "w": 40, "h": 20}, "enter": {"type": "pop", "duration": 0.4},
         "keyframes": [{"t": 0, "x": 0}, {"t": 1, "x": 5, "rotate": 10}], "at": {"word": "chào", "offset": -0.1}}]}],
          "motion": [{"component": "CountUp", "start": {"scene": "s1", "at": "xin"}, "end": "video"}]}
    assert validate(ok, cfg, root) == []


def test_brand_color_keys_accepted(root, cfg):
    sb = {"scenes": [{"id": "s1", "say": "x", "media": [{"src": "a.mp4"}],
                      "motion": [{"component": "CountUp", "colors": {"accent2": "#f00", "surface": "#fff"}}]}]}
    assert "colors may override" not in "\n".join(validate(sb, cfg, root))


def test_sfx_field_types(root, cfg):
    ok = [{"id": "s1", "say": "x", "media": [{"src": "a.mp4"}], "sfx": None,
           "motion": [{"component": "CountUp", "sfx": "whoosh-nope.mp3"}]}]
    assert validate({"scenes": ok}, cfg, root) == []
    bad = [{"id": "s1", "say": "x", "media": [{"src": "a.mp4"}], "sfx": 3,
            "motion": [{"component": "CountUp", "sfx": ["x"]}]}]
    errs = validate({"scenes": bad}, cfg, root)
    assert len([e for e in errs if "sfx" in e]) == 2


def test_chart_requires_source(root, cfg):
    (root / "studio/src/motion/BarChart.tsx").write_bytes(b"x")
    (root / "studio/src/motion/LineChart.tsx").write_bytes(b"x")
    bad = {"scenes": [{"id": "s1", "duration": 2, "motion": [
        {"component": "BarChart", "props": {"bars": ["a | 1"]}},
        {"component": "LineChart", "props": {"source": "  "}}]}],
        "motion": [{"component": "BarChart"}]}
    errs = validate(bad, cfg, root)
    assert "s1: motion[0] BarChart: props.source is required (Nguồn số liệu)" in errs
    assert "s1: motion[1] LineChart: props.source is required (Nguồn số liệu)" in errs
    assert "motion track[0] BarChart: props.source is required (Nguồn số liệu)" in errs
    ok = {"scenes": [{"id": "s1", "duration": 2, "motion": [
        {"component": "BarChart", "props": {"source": "GSO 2024"}}]}]}
    assert validate(ok, cfg, root) == []


def test_bg_must_be_light_or_dark(root, cfg):
    ok = {"scenes": [{"id": "s1", "duration": 2, "bg": "light", "motion": [{"component": "CountUp", "props": {}}]}]}
    assert validate(ok, cfg, root) == []
    ok["scenes"][0]["bg"] = "blue"
    assert any("bg 'blue'" in e for e in validate(ok, cfg, root))


def test_story_allows_text_card_scene_without_media(root, cfg):
    (root / "studio/src/templates/story").mkdir()
    sb = {"template": "story", "music": {"file": "m.mp3"}, "scenes": [{"id": "s1", "say": "Xin chào"}]}
    assert validate(sb, cfg, root) == []
    assert "s1: needs 'media' or 'motion'" in validate({**sb, "template": "fast-cut"}, cfg, root)


def test_media_frame_must_be_full_or_card(root, cfg):
    ok = {"scenes": [{"id": "s1", "say": "x", "media": [{"src": "a.mp4", "frame": "card"}]}]}
    assert not any("frame" in e for e in validate(ok, cfg, root))
    bad = {"scenes": [{"id": "s1", "say": "x", "media": [{"src": "a.mp4", "frame": "round"}]}]}
    assert any("frame 'round'" in e for e in validate(bad, cfg, root))
