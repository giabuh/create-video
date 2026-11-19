"""Word timings for a spoken scene, so motion can start on a word (`"at": "999K"`).

Two sources, same output ([{"w": "chín", "start": 0.04, "end": 0.31}, ...], seconds from the clip start, one entry per
word of `say`):
- whisper.cpp through Remotion's @remotion/install-whisper-cpp (tools/whisper/), aligned back onto the words of `say`
  (the script is the truth; ASR only supplies the clock), cached next to the audio as <id>-<key>.words.json;
- an estimate proportional to word length, when whisper is not installed (preview, other machines).
"""
import json
import re
import subprocess
import tempfile
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

TOKEN = re.compile(r"\w+(?:[.,']\w+)*", re.UNICODE)
WHISPER_DIR = ".whisper"


def norm(word: str) -> str:
    """Lowercase NFC, punctuation dropped (ASR returns 'phòng,')."""
    return "".join(tokens(word)).lower()


def tokens(text: str) -> list[str]:
    return TOKEN.findall(unicodedata.normalize("NFC", text or ""))


def _spread(ws: list[str], a: float, b: float) -> list[dict]:
    """Lay words over [a, b] proportionally to their length (+1 so short words still get time)."""
    weights = [len(w) + 1 for w in ws]
    total = sum(weights) or 1
    out, t = [], a
    for w, k in zip(ws, weights):
        d = (b - a) * k / total
        out.append({"w": w, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    return out


def estimate_words(say: str, duration: float, lead: float = 0.04, tail: float = 0.08) -> list[dict]:
    """No ASR: spread the words of `say` over the speech part of the clip (trimmed clips keep ~40 ms / 80 ms of silence)."""
    a, b = min(lead, duration / 4), max(duration - tail, duration * 3 / 4)
    return _spread(tokens(say), a, b)


def align_words(say: str, asr: list[dict], duration: float) -> list[dict]:
    """Put ASR timings onto the words of `say`. Matched words take the ASR clock; runs of unmatched words are spread
    over the gap between their matched neighbours."""
    ws = tokens(say)
    if not asr:
        return estimate_words(say, duration)
    sm = SequenceMatcher(None, [norm(w) for w in ws], [norm(x["w"]) for x in asr], autojunk=False)
    times: list[tuple[float, float] | None] = [None] * len(ws)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            x = asr[blk.b + k]
            times[blk.a + k] = (float(x["start"]), float(x["end"]))
    out, i = [], 0
    while i < len(ws):
        if times[i] is not None:
            s, e = times[i]
            out.append({"w": ws[i], "start": round(s, 3), "end": round(e, 3)})
            i += 1
            continue
        j = i
        while j < len(ws) and times[j] is None:
            j += 1
        a = out[-1]["end"] if out else 0.0
        b = times[j][0] if j < len(ws) else duration
        out += _spread(ws[i:j], a, max(a, b))
        i = j
    return out


def find_word(at: str, words: list[dict], caption: str = "", occurrence: int = 1):
    """(start, end) of the `occurrence`-th match of the phrase `at`, searched in the spoken words first, then in the
    caption (for '999K' when `say` reads 'chín trăm chín mươi chín nghìn': placed between its matched neighbours).
    None if not found."""
    target = [norm(t) for t in tokens(at)]
    if not target:
        return None
    seq = [norm(w["w"]) for w in words]
    seen = 0
    for i in range(len(seq) - len(target) + 1):
        if seq[i:i + len(target)] == target:
            seen += 1
            if seen == occurrence:
                return words[i]["start"], words[i + len(target) - 1]["end"]
    if caption and words:
        return _via_caption(target, words, caption, occurrence)
    return None


def _via_caption(target: list[str], words: list[dict], caption: str, occurrence: int):
    """The phrase is only in the caption (e.g. '999K' displayed, 'chín trăm … nghìn' spoken). Align caption tokens to
    spoken words; the phrase spans the gap between its nearest matched neighbours."""
    cap = [norm(t) for t in tokens(caption)]
    seen, at = 0, None
    for i in range(len(cap) - len(target) + 1):
        if cap[i:i + len(target)] == target:
            seen += 1
            if seen == occurrence:
                at = i
                break
    if at is None:
        return None
    say = [norm(w["w"]) for w in words]
    cap_to_say = {}
    for blk in SequenceMatcher(None, cap, say, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            cap_to_say[blk.a + k] = blk.b + k
    lo, hi = at, at + len(target) - 1
    if lo in cap_to_say and hi in cap_to_say:
        return words[cap_to_say[lo]]["start"], words[cap_to_say[hi]]["end"]
    prev = max((cap_to_say[i] for i in range(lo) if i in cap_to_say), default=None)
    nxt = min((cap_to_say[i] for i in range(hi + 1, len(cap)) if i in cap_to_say), default=None)
    a = words[prev + 1]["start"] if prev is not None and prev + 1 < len(words) else words[0]["start"]
    b = words[nxt - 1]["end"] if nxt is not None and nxt > 0 else words[-1]["end"]
    return round(a, 3), round(max(a, b), 3)


def caption_token_times(caption: str, words: list[dict]) -> list[float]:
    """Start time of every word token of `caption`: tokens that match a spoken word take its time; the others
    (999K for 'chín trăm … nghìn') are spread between their matched neighbours."""
    cap = [norm(t) for t in tokens(caption)]
    if not cap or not words:
        return [0.0] * len(cap)
    say = [norm(w["w"]) for w in words]
    m = {}
    for blk in SequenceMatcher(None, cap, say, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            m[blk.a + k] = blk.b + k
    out, i = [], 0
    while i < len(cap):
        if i in m:
            out.append(words[m[i]]["start"])
            i += 1
            continue
        j = i
        while j < len(cap) and j not in m:
            j += 1
        prev = m.get(i - 1)
        a = words[prev + 1]["start"] if prev is not None and prev + 1 < len(words) else (words[prev]["end"] if prev is not None else words[0]["start"])
        b = words[m[j]]["start"] if j < len(cap) else words[-1]["end"]
        span = max(0.0, b - a)
        out += [round(a + span * (k - i) / (j - i), 3) for k in range(i, j)]
        i = j
    return out


# --- whisper.cpp (Remotion) -------------------------------------------------------------------

def whisper_ready(root: Path, cfg: dict) -> bool:
    a = cfg.get("align") or {}
    d = root / WHISPER_DIR
    return bool(a.get("enabled", True)) and (d / "whisper.cpp" / "build" / "bin" / "whisper-cli").exists() \
        and (d / "whisper.cpp" / f"ggml-{a.get('model', 'large-v3-turbo')}.bin").exists()


def whisper_words(root: Path, cfg: dict, wav: Path) -> list[dict]:
    """Transcribe one clip with whisper.cpp (Vietnamese, word timestamps). Raises on failure."""
    a = cfg.get("align") or {}
    with tempfile.TemporaryDirectory() as tmp:
        w16 = Path(tmp) / "in.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ar", "16000", "-ac", "1", str(w16)], check=True)
        out = subprocess.run(["node", str(root / "tools/whisper/words.mjs"), str(w16), a.get("model", "large-v3-turbo"),
                              a.get("version", "1.9.5"), a.get("language", "vi")],
                             cwd=root, capture_output=True, text=True, check=True).stdout
    return json.loads(out.strip().splitlines()[-1])


def scene_words(root: Path, cfg: dict, wav: Path, say: str, duration: float, allow_asr: bool) -> tuple[list[dict], str]:
    """Words for one clip and their source ('whisper:<model>' or 'estimate'). Whisper results are cached by clip."""
    cache = wav.with_name(wav.stem + ".words.json")
    if cache.exists():
        c = json.loads(cache.read_text(encoding="utf-8"))
        return c["words"], c["engine"]
    if allow_asr and whisper_ready(root, cfg):
        words = align_words(say, whisper_words(root, cfg, wav), duration)
        engine = f"whisper:{(cfg.get('align') or {}).get('model', 'large-v3-turbo')}"
        cache.write_text(json.dumps({"engine": engine, "words": words}, ensure_ascii=False), encoding="utf-8")
        return words, engine
    return estimate_words(say, duration), "estimate"
