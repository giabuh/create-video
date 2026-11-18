def mix(scenes: list[dict], cta_seconds: float) -> dict:
    """Share of screen time: scenes with media = real, motion-only scenes = motion, CTA = other."""
    real = sum(s["duration"] for s in scenes if s["hasMedia"])
    motion = sum(s["duration"] for s in scenes if not s["hasMedia"])
    total = real + motion + cta_seconds
    if total <= 0:
        return {"real": 0, "motion": 0, "other": 0}
    return {"real": round(real / total, 3), "motion": round(motion / total, 3), "other": round(cta_seconds / total, 3)}
