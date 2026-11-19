def _covered(spans: list[tuple[float, float]], length: float) -> float:
    """Length of the union of [start, start+duration) spans, clipped to [0, length]."""
    iv = sorted((max(0.0, s), min(length, s + d)) for s, d in spans if d > 0)
    total, cur_a, cur_b = 0.0, None, None
    for a, b in iv:
        if b <= a:
            continue
        if cur_b is None or a > cur_b:
            if cur_b is not None:
                total += cur_b - cur_a
            cur_a, cur_b = a, b
        else:
            cur_b = max(cur_b, b)
    if cur_b is not None:
        total += cur_b - cur_a
    return total


def mix(scenes: list[dict], cta_seconds: float) -> dict:
    """Share of screen time. Motion-only scenes = motion; in scenes with media, the time a motion layer
    sits on the footage counts as motion and the rest as real; CTA = other.

    Each scene: {"duration", "hasMedia", "motion": [(start, duration), ...] (optional)}.
    """
    real = motion = 0.0
    for s in scenes:
        if not s["hasMedia"]:
            motion += s["duration"]
            continue
        cov = _covered(s.get("motion") or [], s["duration"])
        motion += cov
        real += s["duration"] - cov
    total = real + motion + cta_seconds
    if total <= 0:
        return {"real": 0, "motion": 0, "other": 0}
    return {"real": round(real / total, 3), "motion": round(motion / total, 3), "other": round(cta_seconds / total, 3)}
