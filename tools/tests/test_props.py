import pytest

from reel.props import AnchorError, build_render_props

SETTINGS = {
    "template": "fast-cut", "brand": "demo",
    "video": {"fps": 30, "width": 1080, "height": 1920},
    "captions": {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400", "maxWords": 6},
    "music": {"file": "m.mp3", "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5},
}
BRAND = {"name": "Demo", "logo": "logo.png",
         "colors": {"primary": "#1", "accent": "#2", "text": "#3", "background": "#4"}, "cta": {"phone": "0900"}}
SB = {"scenes": [
    {"id": "s1", "say": "x", "caption": "Một hai ba", "highlight": ["hai"], "transition": "fade",
     "media": [{"src": "a.mp4", "from": 1.5, "effect": "zoom-in"}, {"src": "b.jpg", "duration": 1.0}]},
    {"id": "s2", "duration": 2, "motion": [{"component": "CountUp", "props": {"to": 7.5}, "start": 0.5}]},
], "cta": {"title": "Đăng ký"}}
AUDIO = {"s1": {"src": "projects/p/audio/s1-abc.wav", "duration": 3.0, "pauseAfter": 0.5}}


def test_build_render_props():
    p = build_render_props(SB, SETTINGS, BRAND, AUDIO)
    s1, s2 = p["scenes"]
    assert (s1["start"], s1["duration"]) == (0, 3.5) and (s2["start"], s2["duration"]) == (3.5, 2.0)
    assert s1["voice"] == {"src": "projects/p/audio/s1-abc.wav", "duration": 3.0} and s2["voice"] is None
    assert s1["media"] == [
        {"src": "library/a.mp4", "type": "video", "from": 1.5, "start": 0, "duration": 2.5, "effect": "zoom-in"},
        {"src": "library/b.jpg", "type": "image", "from": 0.0, "start": 2.5, "duration": 1.0, "effect": "none"},
    ]
    assert s1["captions"][-1]["end"] == 3.0  # captions follow speech, not the pause
    assert s1["highlight"] == ["hai"] and s1["overlay"] is None
    assert (s1["transition"], s2["transition"]) == ("fade", "cut")
    assert s2["motion"] == [{"component": "CountUp", "props": {"to": 7.5}, "start": 0.5, "duration": 1.5,
                             "position": "full", "box": None, "backdrop": "none", "scale": 1.0, "rotate": 0.0, "opacity": 1.0,
                             "enter": {"type": "none", "duration": 0.0}, "exit": {"type": "none", "duration": 0.0},
                             "keyframes": [], "colors": None}]
    assert p["overlays"] == []
    assert s2["captions"] == [] and s2["media"] == []
    assert p["cta"] == {"duration": 3.0, "phone": "0900", "title": "Đăng ký"}
    assert p["totalSeconds"] == 8.5
    assert p["brand"] == {"name": "Demo", "logo": "brands/demo/logo.png", "colors": BRAND["colors"]}
    assert p["music"] == {"src": "music/m.mp3", "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5}
    assert (p["template"], p["fps"], p["width"], p["height"]) == ("fast-cut", 30, 1080, 1920)
    assert p["captions"] == {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400"}


def test_no_cta_no_music_no_logo():
    p = build_render_props({"scenes": SB["scenes"]}, {**SETTINGS, "music": None}, {**BRAND, "logo": None}, AUDIO)
    assert p["cta"] is None and p["music"] is None and p["brand"]["logo"] is None and p["totalSeconds"] == 5.5


def test_motion_band_over_footage_gets_a_scrim_by_default():
    sb = {"scenes": [
        {"id": "a", "duration": 2, "media": [{"src": "a.mp4"}], "motion": [
            {"component": "KineticText", "position": "center"},
            {"component": "LowerThird"},
            {"component": "PriceTag", "position": "bottom", "backdrop": "none", "scale": 0.8}]},
        {"id": "b", "duration": 2, "motion": [{"component": "KineticText", "position": "top"}]},
    ]}
    a, b = build_render_props(sb, SETTINGS, BRAND, {})["scenes"]
    assert [(m["position"], m["backdrop"], m["scale"]) for m in a["motion"]] == [
        ("center", "scrim", 1.0), ("full", "none", 1.0), ("bottom", "none", 0.8)]
    assert (b["motion"][0]["position"], b["motion"][0]["backdrop"]) == ("top", "none")  # no footage: nothing to darken


def test_free_box_animation_and_colors():
    sb = {"scenes": [{"id": "a", "duration": 3, "media": [{"src": "a.mp4"}], "motion": [
        {"component": "Text", "box": {"x": 5, "y": 10, "w": 50, "h": 20}, "enter": "pop",
         "exit": {"type": "wipe", "duration": 0.5}, "rotate": -6, "colors": {"text": "#FF0000"},
         "keyframes": [{"t": 0, "x": 0}, {"t": 2, "x": 10}]}]}]}
    m = build_render_props(sb, SETTINGS, BRAND, {})["scenes"][0]["motion"][0]
    assert (m["position"], m["box"], m["backdrop"]) == ("free", {"x": 5.0, "y": 10.0, "w": 50.0, "h": 20.0}, "scrim")
    assert m["enter"] == {"type": "pop", "duration": 0.35} and m["exit"] == {"type": "wipe", "duration": 0.5}
    assert (m["rotate"], m["colors"], len(m["keyframes"])) == (-6.0, {"text": "#FF0000"}, 2)


WORDS = [{"w": "Chỉ", "start": 0.0, "end": 0.2}, {"w": "chín", "start": 0.2, "end": 0.5}, {"w": "trăm", "start": 0.5, "end": 0.8},
         {"w": "nghìn", "start": 0.8, "end": 1.2}, {"w": "cho", "start": 1.3, "end": 1.5}, {"w": "khóa", "start": 1.5, "end": 2.0}]
SPOKEN = {"scenes": [
    {"id": "a", "say": "Chỉ chín trăm nghìn cho khóa", "caption": "Chỉ 900K cho khóa", "media": [{"src": "a.mp4"}], "motion": [
        {"component": "PriceTag", "at": "900K", "until": "khóa"},
        {"component": "Text", "at": {"word": "cho", "offset": -0.1}, "duration": 0.5}]},
    {"id": "b", "duration": 2, "media": [{"src": "a.mp4"}]},
]}
VOICE = {"a": {"src": "x.wav", "duration": 2.0, "pauseAfter": 0.3}}


def test_motion_anchored_to_spoken_words():
    p = build_render_props(SPOKEN, SETTINGS, BRAND, VOICE, {"a": WORDS})
    price, text = p["scenes"][0]["motion"]
    assert (price["start"], price["duration"]) == (0.2, 1.8)  # '900K' is only in the caption: spans 'chín trăm nghìn'
    assert (text["start"], text["duration"]) == (1.2, 0.5)


def test_video_track_anchors_and_errors():
    sb = {**SPOKEN, "cta": {"title": "Đăng ký"}, "motion": [
        {"component": "ProgressBar"},
        {"component": "Text", "start": {"scene": "a", "at": "khóa"}, "end": {"scene": "b"}},
        {"component": "Text", "start": {"scene": "b", "offset": 0.5}, "end": "video"},
    ]}
    bar, t1, t2 = build_render_props(sb, SETTINGS, BRAND, VOICE, {"a": WORDS})["overlays"]
    assert (bar["start"], bar["duration"]) == (0, 4.3)          # default: the scenes, not the CTA
    assert (t1["start"], t1["duration"]) == (1.5, 2.8)          # 'khóa' -> end of scene b
    assert (t2["start"], t2["duration"]) == (2.8, 4.5)          # to the end of the video incl. CTA
    bad = {**SPOKEN, "motion": [{"component": "Text", "start": {"scene": "zz"}}],
           "scenes": [{**SPOKEN["scenes"][0], "motion": [{"component": "Text", "at": "nope"}]}, SPOKEN["scenes"][1]]}
    with pytest.raises(AnchorError) as e:
        build_render_props(bad, SETTINGS, BRAND, VOICE, {"a": WORDS})
    assert any("'nope' not found" in x for x in e.value.problems) and any("unknown scene 'zz'" in x for x in e.value.problems)
