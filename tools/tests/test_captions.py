from reel.captions import chunk_caption, split_caption


def test_split_at_punctuation_and_never_inside_a_term():
    assert split_caption("Giá ưu đãi và ngày khai giảng — xem ngay bên dưới", 6) == ["Giá ưu đãi", "và ngày khai giảng", "xem ngay bên dưới"]
    assert split_caption("Học Excel từ con số 0, thực hành ngay trên máy", 6) == ["Học Excel từ con số 0,", "thực hành ngay trên máy"]
    assert split_caption("Chỉ 999K, cho cả khóa học tin học văn phòng cấp tốc", 6) == ["Chỉ 999K, cho cả khóa học", "tin học văn phòng cấp tốc"]


def test_chunks_respect_max_words_and_keep_every_word():
    text = "Chỉ 999K cho cả khóa học IELTS cấp tốc"
    out = split_caption(text, 4)
    assert all(len(c.split()) <= 4 for c in out) and " ".join(out) == text


def test_timed_by_characters_without_words():
    out = chunk_caption("Một hai ba bốn năm sáu bảy tám", 4, 4.0)
    assert out[0]["start"] == 0 and out[-1]["end"] == 4.0
    assert all(a["end"] == b["start"] for a, b in zip(out, out[1:]))


def test_timed_on_the_voice_with_words():
    words = [{"w": w, "start": i * 0.3, "end": i * 0.3 + 0.28} for i, w in enumerate("Chỉ chín trăm nghìn cho cả khóa học tin học văn phòng".split())]
    out = chunk_caption("Chỉ 900K, cho cả khóa học tin học văn phòng", 6, 4.0, words)
    assert [c["text"] for c in out] == ["Chỉ 900K, cho cả khóa học", "tin học văn phòng"]
    assert out[0]["start"] == 0 and out[1]["start"] == 2.4 and out[-1]["end"] == 4.0  # 'tin' is the 9th spoken word


def test_chunk_caption_empty():
    assert chunk_caption("   ", 6, 3.0) == []


def test_phone_number_is_never_split():
    chunks = split_caption("Nhắn tin hoặc gọi 0876 929 145 để biết lịch khai giảng.", 6)
    assert any("0876 929 145" in c for c in chunks), chunks
