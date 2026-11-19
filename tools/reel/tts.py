"""VieNeu-backed synthesis. Imports vieneu lazily so the pure modules stay importable without it."""
import json
import os
import re
import subprocess
from pathlib import Path

from .config import TTS_KEYS

# Silence kept at each end after trimming, so the first/last consonant is never clipped.
KEEP_HEAD = 0.04
KEEP_TAIL = 0.08
SILENCE_DB_MAX = -40  # never call anything louder than this "silence"


def load_model():
    from vieneu import Vieneu  # GPU -> PyTorch, CPU -> ONNX (auto)
    return Vieneu()


def probe_duration(path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def probe_rate(path) -> int:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True).stdout
    return int(out.strip())


def _trim_filters(threshold_db: float) -> list[str]:
    """Drop leading/trailing silence; the gap between scenes then comes only from `pauseAfter`."""
    one = f"silenceremove=start_periods=1:start_threshold={threshold_db:.1f}dB:start_silence={{keep}}"
    return [one.format(keep=KEEP_HEAD), "areverse", one.format(keep=KEEP_TAIL), "areverse"]


def _silence_threshold(loudness_lufs: float) -> float:
    """Adaptive: 25 dB under the clip's own loudness, so a quiet take is never trimmed away entirely."""
    return max(-70.0, min(SILENCE_DB_MAX, loudness_lufs - 25))


def _loudnorm(target: float) -> str:
    return f"loudnorm=I={target}:TP=-1.5:LRA=11"


def _measure(src: Path, pre: list[str], target: float) -> dict:
    """First loudnorm pass: measure the clip after `pre` filters (EBU R128)."""
    af = ",".join([*pre, _loudnorm(target) + ":print_format=json"])
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", af, "-f", "null", "-"],
                         capture_output=True, text=True, check=True).stderr
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err)
    if not m:
        raise RuntimeError("loudnorm: no measurement in ffmpeg output")
    return json.loads(m.group(0))


def postprocess(src, dst, tts: dict) -> None:
    """speed (atempo) -> trim silence -> loudness normalize, in one ffmpeg run. Keeps the sample rate.

    Every clip ends up equally loud and starts/ends on speech, so joined scenes sound like one read.
    Controlled by our tts keys: `speed`, `trimSilence` (default True), `loudness` (LUFS, None = off).
    """
    src, dst = Path(src), Path(dst)
    pre = []
    speed = float(tts.get("speed", 1.0))
    if speed != 1.0:
        pre.append(f"atempo={speed}")
    target = tts.get("loudness")
    ref_target = float(target) if target is not None else -16.0
    if tts.get("trimSilence", True):
        level = float(_measure(src, pre, ref_target)["input_i"])
        if level > -70:  # digital silence: nothing to trim against
            pre += _trim_filters(_silence_threshold(level))
    chain = list(pre)
    if target is not None:
        m = _measure(src, pre, float(target))
        if float(m["input_i"]) > -70:  # not digital silence; loudnorm can't measure that
            chain.append(f"{_loudnorm(float(target))}:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
                         f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    _run(src, dst, chain)
    if tts.get("trimSilence", True) and _duration_or_zero(dst) < 0.2 < probe_duration(src):
        _run(src, dst, [f for f in chain if not f.startswith("silenceremove") and f != "areverse"])  # trimmed it all: keep the take


def _run(src: Path, dst: Path, chain: list[str]) -> None:
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(src)]
    if chain:
        cmd += ["-af", ",".join(chain)]
    cmd += ["-ar", str(probe_rate(src)), str(dst)]  # loudnorm would otherwise upsample to 192 kHz
    subprocess.run(cmd, check=True)


def _duration_or_zero(path) -> float:
    try:
        return probe_duration(path)
    except (ValueError, subprocess.CalledProcessError):
        return 0.0


def synth_to_file(model, say: str, ref_path, tts: dict, out_path) -> float:
    """Synthesize, post-process (speed, trim, loudness), write atomically (no half-written cache files). Returns seconds."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audio = model.infer(say, ref_audio=str(ref_path), **{k: tts[k] for k in TTS_KEYS if k in tts})
    raw = out_path.with_name(out_path.stem + ".raw.wav")
    tmp = out_path.with_name(out_path.stem + ".tmp.wav")
    model.save(audio, str(raw))
    try:
        postprocess(raw, tmp, tts)
    finally:
        raw.unlink(missing_ok=True)
    os.replace(tmp, out_path)
    return probe_duration(out_path)
