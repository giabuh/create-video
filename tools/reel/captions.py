"""Caption chunks: split at punctuation first, then into balanced pieces of <= max_words, timed on the voice."""
import math
import re

from .align import caption_token_times, tokens

DASH = re.compile(r"^[-–—]+$")
END = re.compile(r"[,.;:!?…]$")
DIGITS = re.compile(r"^\d+$")


def _phrases(words: list[str]) -> list[list[str]]:
    out, cur = [], []
    for w in words:
        if DASH.match(w):  # a standalone dash separates phrases and is not shown at a chunk edge
            if cur:
                out.append(cur)
            cur = []
            continue
        if cur and DIGITS.match(cur[-1].split()[-1]) and w[:1].isdigit():
            cur[-1] += " " + w  # a phone number "0876 929 145" is one unit: never split across chunks
        else:
            cur.append(w)
        if END.search(w):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


# Two-word terms a caption chunk must not split (course-promo vocabulary; add more as they come up).
VI_COMPOUNDS = {tuple(x.split()) for x in """
tin học|văn phòng|khai giảng|học viên|giáo viên|giảng viên|ưu đãi|học phí|khóa học|lớp học|thực hành|lý thuyết|cấp tốc|
đăng ký|liên hệ|lộ trình|rõ ràng|chứng chỉ|kỹ năng|đồ họa|thiết kế|lập trình|kế toán|văn bản|trang tính|trình chiếu|
máy tính|bàn phím|phần mềm|phần cứng|cơ bản|nâng cao|chuyên nghiệp|miễn phí|giảm giá|học bổng|tốt nghiệp|việc làm|
mỗi ngày|mỗi tuần|cuối tuần|buổi tối|buổi sáng|ngay hôm|hôm nay|tháng này|chi nhánh|cơ sở|trung tâm|sao việt|
từng bạn|kèm cặp|đầu vào|đầu ra|bài tập|dự án|thời gian|linh hoạt|hỗ trợ|trọn đời|cam kết|chất lượng|số điện|điện thoại|
con số|bên dưới|bên trên|ngay bây|bây giờ|văn phòng""".replace("\n", "").split("|") if x.strip()}
# Words that read well at the start of a chunk; a chunk should not end on them.
STARTERS = {"và", "với", "cho", "để", "của", "ở", "tại", "trong", "khi", "nếu", "mà", "là", "có", "được", "từ", "đến", "sau",
            "trước", "chỉ", "cùng", "nhưng", "hoặc", "hay", "vì", "nên", "thì", "các", "những", "một"}


def _key(w: str) -> str:
    return "".join(tokens(w)).lower()


def _break_cost(left: str, right: str) -> float:
    c = 0.0
    if (_key(left), _key(right)) in VI_COMPOUNDS:
        c += 4
    if _key(left) in STARTERS:
        c += 1.5  # chunk ending on "và", "của"…
    if _key(right) in STARTERS:
        c -= 0.5
    return c


def _balanced(phrase: list[str], max_words: int) -> list[list[str]]:
    """Fewest chunks of <= max_words, cut where it reads best: never inside a known two-word term, not right after a
    function word, sizes as even as possible (7 words -> 4 + 3, not 6 + 1)."""
    n = len(phrase)
    k = math.ceil(n / max_words)
    if k <= 1:
        return [phrase]
    avg = n / k
    # best[j][i]: min cost to cut phrase[:i] into j chunks
    best = [[math.inf] * (n + 1) for _ in range(k + 1)]
    back = [[0] * (n + 1) for _ in range(k + 1)]
    best[0][0] = 0.0
    for j in range(1, k + 1):
        for i in range(1, n + 1):
            for p in range(max(0, i - max_words), i):
                if best[j - 1][p] == math.inf:
                    continue
                cost = best[j - 1][p] + 0.5 * (i - p - avg) ** 2 + (_break_cost(phrase[i - 1], phrase[i]) if i < n else 0)
                if cost < best[j][i]:
                    best[j][i], back[j][i] = cost, p
    cuts, i = [], n
    for j in range(k, 0, -1):
        cuts.append(i)
        i = back[j][i]
    cuts = sorted(cuts)
    out, p = [], 0
    for c in cuts:
        out.append(phrase[p:c])
        p = c
    return out


def split_caption(text: str, max_words: int) -> list[str]:
    chunks: list[list[str]] = []
    for ph in _phrases(text.split()):
        chunks += _balanced(ph, max_words)
    # a chunk of 1-2 words joins a neighbour when that still fits ("Chỉ 999K," + "cho cả khóa học")
    i = 0
    while i < len(chunks):
        c = chunks[i]
        if len(chunks) > 1 and len(c) <= 2:
            if i + 1 < len(chunks) and len(c) + len(chunks[i + 1]) <= max_words:
                chunks[i:i + 2] = [c + chunks[i + 1]]
                continue
            if i > 0 and len(chunks[i - 1]) + len(c) <= max_words:
                chunks[i - 1:i + 1] = [chunks[i - 1] + c]
                i -= 1
                continue
        i += 1
    return [" ".join(c) for c in chunks]


def _word_times(chunk: str, start: float, end: float, tt: list[float] | None, k: int) -> list[float]:
    """Start of every space-separated word of `chunk`, clamped non-decreasing into [start, end). `tt` = caption token
    times from the voice (k = this chunk's first token), None = even spread."""
    ws, n = chunk.split(), len(chunk.split())
    if tt is None:
        raw = [start + i * (end - start) / n for i in range(n)]
    else:
        raw = []
        for w in ws:
            m = len(tokens(w))
            raw.append(tt[k] if m and k < len(tt) else (raw[-1] if raw else start))  # a bare dash/symbol rides the previous word
            k += m
    top = max(start, end - 0.001)
    out, prev = [], start
    for t in raw:
        prev = min(max(t, prev), top)
        out.append(round(prev, 3))
    out[0] = round(start, 3)
    return out


def chunk_caption(text: str, max_words: int, duration: float, words: list[dict] | None = None) -> list[dict]:
    """Chunks with start/end in seconds within [0, duration]. With word timings (align.py) each chunk starts when its
    first word is spoken; without, time is shared by character count."""
    chunks = split_caption(text or "", max_words)
    if not chunks:
        return []
    if words:
        times = caption_token_times(text, words)  # one start per word token of the caption
        starts, ks, k = [], [], 0
        for c in chunks:
            n = len(tokens(c))
            starts.append(times[k] if n and k < len(times) else (starts[-1] if starts else 0.0))
            ks.append(k)
            k += n
        starts[0] = 0.0
        ends = starts[1:] + [duration]
        out = []
        for c, a, b, k0 in zip(chunks, starts, ends, ks):
            a, b = round(a, 3), round(max(a, b), 3)
            out.append({"text": c, "start": a, "end": b, "times": _word_times(c, a, b, times, k0)})
        return out
    total = sum(len(c) for c in chunks)
    out, t = [], 0.0
    for c in chunks:
        d = duration * len(c) / total
        out.append({"text": c, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    out[-1]["end"] = round(duration, 3)
    for o in out:
        o["times"] = _word_times(o["text"], o["start"], o["end"], None, 0)
    return out
