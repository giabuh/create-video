from reel.mix import mix


def test_mix_fractions():
    scenes = [{"duration": 6, "hasMedia": True}, {"duration": 3, "hasMedia": False}]
    assert mix(scenes, 1.0) == {"real": 0.6, "motion": 0.3, "other": 0.1}


def test_mix_empty():
    assert mix([], 0) == {"real": 0, "motion": 0, "other": 0}
