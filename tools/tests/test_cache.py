from reel.cache import cache_key


def test_cache_key_stable_and_sensitive():
    k = cache_key(b"ref", "xin chào", {"a": 1, "b": 2})
    assert len(k) == 12 and k == cache_key(b"ref", "xin chào", {"b": 2, "a": 1})
    assert k != cache_key(b"ref2", "xin chào", {"a": 1, "b": 2})
    assert k != cache_key(b"ref", "xin chao", {"a": 1, "b": 2})
    assert k != cache_key(b"ref", "xin chào", {"a": 1, "b": 3})
