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
    {"id": "s1", "say": "x", "caption": "Một hai ba", "highlight": ["hai"], "punch": ["ba"], "transition": "fade",
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
    assert s1["punch"] == ["ba"] and "punch" not in s2
    assert s1["highlight"] == ["hai"] and s1["overlay"] is None
    assert (s1["transition"], s2["transition"]) == ("fade", "cut")
    tr = build_render_props(SB, {**SETTINGS, "transition": {"scene": "slide", "media": "fade", "duration": 0.5}}, BRAND, AUDIO)
    assert [(s["transition"], s["mediaTransition"]) for s in tr["scenes"]] == [("fade", "fade"), ("slide", "fade")]
    assert tr["transitionSeconds"] == 0.5
    assert s2["motion"] == [{"component": "CountUp", "props": {"to": 7.5}, "start": 0.5, "duration": 1.5,
                             "position": "full", "box": None, "backdrop": "none", "scale": 1.0, "rotate": 0.0, "opacity": 1.0,
                             "enter": {"type": "none", "duration": 0.0}, "exit": {"type": "none", "duration": 0.0},
                             "keyframes": [], "colors": None}]
    assert p["overlays"] == []
    assert s2["captions"] == [] and s2["media"] == []
    assert p["cta"] == {"duration": 3.0, "phone": "0900", "title": "Đăng ký"}
    assert p["totalSeconds"] == 8.5
    assert p["brand"] == {"name": "Demo", "logo": "brands/demo/logo.png", "colors": BRAND["colors"]}
    assert p["music"] == {"src": "music/m.mp3", "volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5, "drops": []}
    assert (p["template"], p["fps"], p["width"], p["height"]) == ("fast-cut", 30, 1080, 1920)
    assert p["captions"] == {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400", "box": False}


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


def test_checklist_items_at_resolve_to_times_from_layer_start():
    sb = {"scenes": [{**SPOKEN["scenes"][0], "motion": [
        {"component": "Checklist", "at": "chín", "props": {"items": ["a", "b"], "itemsAt": ["chín", "khóa"]}}]}]}
    m = build_render_props(sb, SETTINGS, BRAND, VOICE, {"a": WORDS})["scenes"][0]["motion"][0]
    assert m["props"]["itemTimes"] == [0.0, 1.3]
    assert "itemTimes" not in sb["scenes"][0]["motion"][0]["props"]  # storyboard untouched


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


SFX = {"volume": 0.5, "minGap": 0.8, "scene": "whoosh", "cta": "impact",
       "motion": {"default": "pop", "CountUp": "ting"}}
FILES = ["impact-a.mp3", "pop-a.mp3", "pop-b.mp3", "ting-a.mp3", "whoosh-a.mp3", "whoosh-b.mp3"]


def _sfx(sb, sfx=SFX, files=FILES):
    audio = {"s1": {"src": "a.wav", "duration": 3.0, "pauseAfter": 0.0}, "s2": {"src": "b.wav", "duration": 3.0, "pauseAfter": 0.0}}
    p = build_render_props(sb, {**SETTINGS, "sfx": sfx}, BRAND, audio, sfx_files=files)
    return [(x["start"], x["src"]) for x in p["sfx"]], p


def _sb(**kw):
    return {"scenes": [
        {"id": "s1", "say": "x", "transition": "fade", "media": [{"src": "a.mp4"}]},
        {"id": "s2", "say": "x", "media": [{"src": "a.mp4"}], **kw.get("s2", {})},
        {"id": "s3", "duration": 2, "motion": [{"component": "CountUp", "start": 0.5}], **kw.get("s3", {})},
    ], **kw.get("top", {})}


def test_sfx_off_without_settings_or_files():
    sb = _sb()
    assert _sfx(sb, None)[1]["sfx"] == [] and _sfx(sb, SFX, [])[1]["sfx"] == []


def test_sfx_scene_cta_motion_rotation_and_first_scene():
    ev, p = _sfx(_sb(s2={"transition": "fade"}, top={"cta": {"title": "x"}}))
    # s1 has a transition but is first: no whoosh; s2 fades in at 3.0
    assert ev == [(2.85, "sfx/whoosh-a.mp3"), (6.5, "sfx/ting-a.mp3"), (8.0, "sfx/impact-a.mp3")]
    assert all(x["volume"] == 0.5 for x in p["sfx"])


def test_sfx_cut_scene_has_no_whoosh_and_group_rotates():
    sb = _sb(s2={"transition": "slide"}, s3={"transition": "fade", "motion": []})
    sb["scenes"][0]["transition"] = "cut"
    ev, _ = _sfx(sb)
    assert ev == [(2.85, "sfx/whoosh-a.mp3"), (5.85, "sfx/whoosh-b.mp3")]
    sb["scenes"][1]["transition"] = "cut"
    assert _sfx(sb)[0] == [(5.85, "sfx/whoosh-a.mp3")]


def test_sfx_explicit_kept_auto_dropped_by_mingap_and_none():
    sb = _sb(s3={"transition": "fade", "motion": [
        {"component": "CountUp", "start": 0.1, "sfx": "none"},        # explicit none: silent
        {"component": "Text", "start": 0.2},                         # auto pop: 0.35 after whoosh -> dropped
        {"component": "Text", "start": 0.3, "sfx": "pop-b.mp3"},     # explicit exact file: kept
        {"component": "Text", "start": 0.5},                         # auto, 0.2 after kept explicit -> dropped
        {"component": "CountUp", "start": 1.5}]})                    # auto ting, far enough
    ev, _ = _sfx(sb)
    assert ev == [(5.85, "sfx/whoosh-a.mp3"), (6.3, "sfx/pop-b.mp3"), (7.5, "sfx/ting-a.mp3")]
    assert [e for e in _sfx(_sb(s2={"transition": "fade", "sfx": "none"}))[0] if e[0] < 3] == []


def test_sfx_video_track_uses_absolute_start():
    ev, _ = _sfx(_sb(top={"motion": [{"component": "CountUp", "start": 4.0, "duration": 1}]}))
    assert (4.0, "sfx/ting-a.mp3") in ev


def test_sfx_peak_lands_on_the_change():
    audio = {"s1": {"src": "a.wav", "duration": 3.0, "pauseAfter": 0.0}, "s2": {"src": "b.wav", "duration": 3.0, "pauseAfter": 0.0}}
    p = build_render_props(_sb(s2={"transition": "fade"}), {**SETTINGS, "sfx": SFX}, BRAND, audio, sfx_files=FILES, sfx_peaks={"whoosh-a.mp3": 0.7})
    assert p["sfx"][0] == {"src": "sfx/whoosh-a.mp3", "start": 2.3, "volume": SFX.get("volume", 0.5)}


def test_self_animating_cards_have_no_default_exit_fade():
    sb = {"scenes": [{"id": "a", "duration": 3, "media": [{"src": "a.mp4"}], "motion": [
        {"component": "Ribbon", "position": "bottom"}, {"component": "Text", "position": "bottom"}]}]}
    rib, txt = build_render_props(sb, SETTINGS, BRAND, {})["scenes"][0]["motion"]
    assert rib["exit"] == {"type": "none", "duration": 0.0}
    assert txt["exit"] == {"type": "fade", "duration": 0.25}


def test_music_drop_resolves_word_anchors():
    sb = {**SPOKEN, "musicDrop": [{"start": {"scene": "a", "at": "khóa"}, "end": {"scene": "b", "edge": "end"}}]}
    p = build_render_props(sb, SETTINGS, BRAND, VOICE, {"a": WORDS})
    (a, b, to), = p["music"]["drops"]
    assert to == 0 and a < b
    bad = {**SPOKEN, "musicDrop": [{"start": {"scene": "zz"}, "end": "video"}]}
    with pytest.raises(AnchorError) as e:
        build_render_props(bad, SETTINGS, BRAND, VOICE, {"a": WORDS})
    assert any("musicDrop[0]" in x and "unknown scene 'zz'" in x for x in e.value.problems)
    backwards = {**SPOKEN, "musicDrop": [{"start": {"scene": "b", "edge": "end"}, "end": {"scene": "a"}}]}
    with pytest.raises(AnchorError) as e:
        build_render_props(backwards, SETTINGS, BRAND, VOICE, {"a": WORDS})
    assert any("musicDrop[0]: end" in x for x in e.value.problems)


def test_sfx_hard_cut_and_media_change_events():
    sfx = {**SFX, "scene": "none", "cut": "whoosh", "media": "pop", "minGap": 0.0, "motion": {}}
    sb = _sb()
    sb["scenes"][0]["media"] = [{"src": "a.mp4", "duration": 1.0}, {"src": "b.mp4"}]  # clip change at 1.0
    ev, _ = _sfx(sb, sfx)
    assert ev == [(1.0, "sfx/pop-a.mp3"), (3.0, "sfx/whoosh-a.mp3"), (6.0, "sfx/whoosh-b.mp3")]


def test_sfx_cut_and_media_default_off():
    sb = _sb()
    sb["scenes"][0]["media"] = [{"src": "a.mp4", "duration": 1.0}, {"src": "b.mp4"}]
    ev, _ = _sfx(sb, {**SFX, "motion": {}})   # SFX has no cut/media keys
    assert ev == []


def test_sfx_hold_group_lasts_the_layer():
    files = FILES + ["tick-a.mp3"]
    sfx = {**SFX, "motion": {"CountUp": "tick"}, "hold": ["tick"], "minGap": 0.0}
    _, p = _sfx(_sb(), sfx, files)
    tick = next(x for x in p["sfx"] if x["src"] == "sfx/tick-a.mp3")
    count = p["scenes"][2]["motion"][0]
    assert tick["until"] == round(p["scenes"][2]["start"] + count["start"] + count["duration"], 3)
    assert all("until" not in x for x in p["sfx"] if x is not tick)
    sb = _sb()
    sb["scenes"][2]["motion"][0].setdefault("props", {})["seconds"] = 0.5
    _, p = _sfx(sb, sfx, files)
    tick = next(x for x in p["sfx"] if x["src"] == "sfx/tick-a.mp3")
    assert tick["until"] == round(p["scenes"][2]["start"] + p["scenes"][2]["motion"][0]["start"] + 0.5, 3)


def test_scene_bg_and_look_land_in_props():
    sb = {"scenes": [{"id": "a", "duration": 1, "bg": "light", "motion": [{"component": "CountUp", "props": {}}]},
                     {"id": "b", "duration": 1, "motion": [{"component": "CountUp", "props": {}}]}]}
    p = build_render_props(sb, {**SETTINGS, "look": {"grain": 0.5, "scanlines": 1, "logo": True}}, BRAND, {})
    assert [s.get("bg") for s in p["scenes"]] == ["light", None]
    sb["scenes"][0]["layout"] = "collage"
    assert [s.get("layout") for s in build_render_props(sb, SETTINGS, BRAND, {})["scenes"]] == ["collage", None]
    assert p["look"] == {"grain": 0.5, "scanlines": 1, "logo": True}
    assert build_render_props(sb, SETTINGS, BRAND, {})["look"] == {"grain": 0, "scanlines": 0, "logo": False}


def test_media_aspect_and_frame_land_in_props():
    sb = {"scenes": [{"id": "s", "duration": 2, "media": [{"src": "a.mp4", "frame": "full"}, {"src": "b.jpg"}]}]}
    m = build_render_props(sb, SETTINGS, BRAND, {}, media_sizes={"a.mp4": (1080, 1920)})["scenes"][0]["media"]
    assert m[0]["aspect"] == 0.5625 and m[0]["frame"] == "full"
    assert "aspect" not in m[1] and "frame" not in m[1]


def _mix_sb(n=7, **first):
    return {"scenes": [{"id": f"s{i}", "duration": 1, "motion": [{"component": "Text"}], **(first if i == 0 else {})} for i in range(n)]}


def test_mix_rotates_per_scene_and_scene_overrides():
    st = {**SETTINGS, "transition": {"scene": "mix", "media": "cut", "duration": 0.4}}
    p = build_render_props(_mix_sb(), st, BRAND, {})
    assert [s["transition"] for s in p["scenes"]] == ["cut", "push", "cube", "wipe", "flip", "clockWipe", "push"]
    sb = _mix_sb()
    sb["scenes"][2]["transition"] = "fade"
    assert build_render_props(sb, st, BRAND, {})["scenes"][2]["transition"] == "fade"
    sb["scenes"][1]["transition"] = "mix"
    sb["scenes"][2]["transition"] = "mix"
    p = build_render_props(sb, SETTINGS, BRAND, {})
    assert [s["transition"] for s in p["scenes"][:3]] == ["cut", "push", "cube"]


def test_leak_passthrough_only_when_true():
    sb = _mix_sb(2)
    sb["scenes"][1]["leak"] = True
    s0, s1 = build_render_props(sb, SETTINGS, BRAND, {})["scenes"]
    assert s1["leak"] is True and "leak" not in s0


def test_max_cards_own_their_exit_and_look_passes_through():
    sb = {"scenes": [{"id": "a", "duration": 2, "motion": [{"component": "MaxSteps", "position": "bottom"}]}]}
    assert build_render_props(sb, SETTINGS, BRAND, {})["scenes"][0]["motion"][0]["exit"]["type"] == "none"
    look = {"grain": 0.2, "scanlines": 0, "logo": False, "vignette": 0.5, "grade": True, "progress": True}
    assert build_render_props(sb, {**SETTINGS, "look": look}, BRAND, {})["look"] == look
    assert build_render_props(sb, SETTINGS, BRAND, {})["look"] == {"grain": 0, "scanlines": 0, "logo": False}
