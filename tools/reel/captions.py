def chunk_caption(text: str, max_words: int, duration: float) -> list[dict]:
    """Split into <= max_words chunks, timed by character share of `duration`.
    shortcut: proportional timing, no word alignment; upgrade with Whisper for karaoke captions."""
    words = text.split()
    if not words:
        return []
    chunks = [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]
    total = sum(len(c) for c in chunks)
    out, t = [], 0.0
    for c in chunks:
        d = duration * len(c) / total
        out.append({"text": c, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    out[-1]["end"] = round(duration, 3)
    return out
