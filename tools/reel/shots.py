def shots(scenes: list[dict]) -> dict:
    """Picture changes: each media item is a shot, a scene without media is one shot. Story target avg <= 2.5 s."""
    n = sum(max(1, len(s["media"])) for s in scenes)
    return {"count": n, "avg": round(sum(s["duration"] for s in scenes) / n, 2) if n else 0}
