from reel.props import build_render_props

SETTINGS = {
    "template": "fast-cut", "brand": "demo",
    "video": {"fps": 30, "width": 1080, "height": 1920, "draftScale": 0.5},
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
    assert s2["motion"] == [{"component": "CountUp", "props": {"to": 7.5}, "start": 0.5, "duration": 1.5}]
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
