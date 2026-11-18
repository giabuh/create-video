import hashlib
import json


def cache_key(ref_bytes: bytes, say: str, tts: dict) -> str:
    """Same voice file + text + every resolved TTS param -> same key -> reuse the cached wav."""
    h = hashlib.sha256()
    for part in (ref_bytes, say.encode("utf-8"), json.dumps(tts, sort_keys=True).encode("utf-8")):
        h.update(part)
        h.update(b"\0")
    return h.hexdigest()[:12]
