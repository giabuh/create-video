from reel.mix import mix


def test_mix_fractions():
    scenes = [{"duration": 6, "hasMedia": True}, {"duration": 3, "hasMedia": False}]
    assert mix(scenes, 1.0) == {"real": 0.6, "motion": 0.3, "other": 0.1}


def test_mix_empty():
    assert mix([], 0) == {"real": 0, "motion": 0, "other": 0}


def test_motion_on_footage_counts_as_motion():
    # 6 s of footage with a 2 s overlay + 1.5 s overlapping overlay (union 2.5 s), and a 3 s motion-only scene
    scenes = [{"duration": 6, "hasMedia": True, "motion": [(1, 2), (2.5, 1)]}, {"duration": 3, "hasMedia": False}]
    assert mix(scenes, 1.0) == {"real": 0.35, "motion": 0.55, "other": 0.1}


def test_overlay_is_clipped_to_the_scene():
    scenes = [{"duration": 4, "hasMedia": True, "motion": [(3, 5)]}]
    assert mix(scenes, 0) == {"real": 0.75, "motion": 0.25, "other": 0}


def test_shots_count_media_and_text_cards():
    from reel.mix import shots
    assert shots([{"duration": 4, "media": [1, 2]}, {"duration": 2, "media": []}]) == {"count": 3, "avg": 2.0}
    assert shots([]) == {"count": 0, "avg": 0}
