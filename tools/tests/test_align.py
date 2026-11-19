from reel.align import align_words, estimate_words, find_word

SAY = "Chỉ chín trăm chín mươi chín nghìn cho cả khóa học tin học văn phòng"
# what whisper (base) actually returned for a TTS read of SAY: the number came back as digits
ASR = [{"w": "Chỉ", "start": 0.01, "end": 0.18}, {"w": "chính", "start": 0.18, "end": 0.42}, {"w": "19.19.000", "start": 0.42, "end": 1.87},
       {"w": "cho", "start": 1.87, "end": 2.03}, {"w": "cả", "start": 2.03, "end": 2.13}, {"w": "quả", "start": 2.13, "end": 2.28},
       {"w": "học", "start": 2.28, "end": 2.44}, {"w": "tên", "start": 2.44, "end": 2.59}, {"w": "học", "start": 2.59, "end": 2.8},
       {"w": "văn", "start": 2.8, "end": 2.9}, {"w": "phòng,", "start": 2.9, "end": 3.38}]


def test_alignment_keeps_the_script_words_and_the_asr_clock():
    ws = align_words(SAY, ASR, 3.4)
    assert [w["w"] for w in ws] == SAY.split()
    assert ws[0]["start"] == 0.01 and ws[-1]["end"] == 3.38            # matched words keep ASR times
    assert ws[1]["start"] == 0.18 and ws[6]["end"] == 1.87              # the number is spread over its gap
    assert all(a["end"] <= b["start"] + 1e-6 for a, b in zip(ws, ws[1:]))


def test_find_word_in_say_then_caption():
    ws = align_words(SAY, ASR, 3.4)
    assert find_word("cho cả", ws) == (1.87, 2.13)
    assert find_word("học", ws, occurrence=2) == (2.59, 2.8)
    assert find_word("999K", ws, caption="Chỉ 999K cho cả khóa Tin học văn phòng") == (0.18, 1.87)
    assert find_word("không có", ws, caption="Chỉ 999K") is None


def test_estimate_covers_the_speech():
    ws = estimate_words("một hai ba", 1.12)
    assert ws[0]["start"] == 0.04 and abs(ws[-1]["end"] - 1.04) < 1e-3 and len(ws) == 3
