from reel.config import deep_merge, resolve_names, resolve_scene_voice, resolve_video


def test_deep_merge_nested_and_override():
    assert deep_merge({"a": {"x": 1, "y": 2}, "b": 1}, {"a": {"y": 3}, "c": 4}) == {"a": {"x": 1, "y": 3}, "b": 1, "c": 4}


def test_deep_merge_does_not_mutate():
    base = {"a": {"x": 1}}
    deep_merge(base, {"a": {"x": 2}})
    assert base == {"a": {"x": 1}}
    assert deep_merge(base, None) == base


def test_voice_layer_order(cfg):
    v = resolve_scene_voice(cfg, {"tts": {"top_k": 30}}, {"id": "s1", "voice": "vy", "tts": {"top_k": 40}})
    assert v["voice"] == "vy" and v["ref"] == "voices/vy-short.wav"
    assert v["tts"]["temperature"] == 0.7 and v["tts"]["top_k"] == 40 and v["tts"]["speed"] == 1.0
    assert "pauseAfter" not in v["tts"] and "ref" not in v["tts"] and v["pauseAfter"] == 0.3


def test_default_voice_uses_voice_speed(cfg):
    v = resolve_scene_voice(cfg, {}, {"id": "s1"})
    assert v["voice"] == "phuong" and v["tts"]["speed"] == 1.05


def test_storyboard_voice_and_scene_pause(cfg):
    v = resolve_scene_voice(cfg, {"voice": "vy"}, {"id": "s1", "pauseAfter": 0})
    assert v["voice"] == "vy" and v["pauseAfter"] == 0.0


def test_config_not_mutated(cfg):
    resolve_scene_voice(cfg, {}, {"id": "s1"})
    assert cfg["tts"]["pauseAfter"] == 0.3 and cfg["voices"]["phuong"]["ref"] == "voices/phuong-short.wav"


def test_resolve_names(cfg):
    assert resolve_names(cfg, {}) == ("fast-cut", "demo")
    assert resolve_names(cfg, {"brand": "b2", "template": "t2"}) == ("t2", "b2")


def test_resolve_video(cfg):
    s = resolve_video(cfg, {"captions": {"highlightColor": "#00FF00"}},
                      {"music": {"file": "a.mp3", "volume": 0.1}, "captions": {"size": 80}})
    assert s["music"] == {"file": "a.mp3", "volume": 0.1, "duckTo": 0.08, "fadeOut": 1.5}
    assert s["captions"]["highlightColor"] == "#00FF00" and s["captions"]["size"] == 80
    assert (s["template"], s["brand"], s["video"]["fps"]) == ("fast-cut", "demo", 30)
    assert resolve_video(cfg, {}, {"music": None})["music"] is None
    assert resolve_video(cfg, {}, {})["music"] is None


def test_resolve_video_sfx(cfg):
    assert resolve_video(cfg, {}, {})["sfx"] is None
    cfg["sfx"] = {"volume": 0.5, "scene": "whoosh", "motion": {"default": "pop", "Text": "ting"}}
    s = resolve_video(cfg, {}, {"sfx": {"volume": 0.2, "motion": {"Text": "none"}}})["sfx"]
    assert s == {"volume": 0.2, "scene": "whoosh", "motion": {"default": "pop", "Text": "none"}}
    assert resolve_video(cfg, {}, {"sfx": None})["sfx"] is None
    assert resolve_video(cfg, {}, {})["sfx"]["volume"] == 0.5
