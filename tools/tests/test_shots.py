from reel.shots import shots


def test_shots_count_media_and_text_cards():
    assert shots([{"duration": 4, "media": [1, 2]}, {"duration": 2, "media": []}]) == {"count": 3, "avg": 2.0}
    assert shots([]) == {"count": 0, "avg": 0}
