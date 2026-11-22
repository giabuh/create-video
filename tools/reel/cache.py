import hashlib
import json
from functools import lru_cache


@lru_cache(maxsize=8)
def _ref_hasher(ref_bytes: bytes):  # same bytes object -> its hash is computed once per run
    h = hashlib.sha256()
    h.update(ref_bytes)
    h.update(b"\0")
    return h


def cache_key(ref_bytes: bytes, say: str, tts: dict) -> str:
    """Same voice file + text + every resolved TTS param -> same key -> reuse the cached wav."""
    h = _ref_hasher(ref_bytes).copy()
    for part in (say.encode("utf-8"), json.dumps(tts, sort_keys=True).encode("utf-8")):
        h.update(part)
        h.update(b"\0")
    return h.hexdigest()[:12]
