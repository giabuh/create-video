from reel.captions import chunk_caption


def test_chunk_caption_splits_by_words_and_times_by_chars():
    out = chunk_caption("Chỉ 999K cho cả khóa học IELTS cấp tốc", 4, 4.0)
    assert [c["text"] for c in out] == ["Chỉ 999K cho cả", "khóa học IELTS cấp", "tốc"]
    assert out[0]["start"] == 0 and out[-1]["end"] == 4.0
    assert abs(out[1]["start"] - 1.667) < 0.01
    assert all(a["end"] == b["start"] for a, b in zip(out, out[1:]))


def test_chunk_caption_empty():
    assert chunk_caption("   ", 6, 3.0) == []
