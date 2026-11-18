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
