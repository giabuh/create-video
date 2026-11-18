"""VieNeu-backed synthesis. Imports vieneu lazily so the pure modules stay importable without it."""
import os
import subprocess
from pathlib import Path

from .config import TTS_KEYS


def load_model():
    from vieneu import Vieneu  # GPU -> PyTorch, CPU -> ONNX (auto)
    return Vieneu()


def probe_duration(path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def synth_to_file(model, say: str, ref_path, tts: dict, out_path) -> float:
    """Synthesize, apply speed with ffmpeg atempo, write atomically (no half-written cache files). Returns seconds."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audio = model.infer(say, ref_audio=str(ref_path), **{k: tts[k] for k in TTS_KEYS if k in tts})
    raw = out_path.with_name(out_path.stem + ".raw.wav")
    tmp = out_path.with_name(out_path.stem + ".tmp.wav")
    model.save(audio, str(raw))
    speed = float(tts.get("speed", 1.0))
    if speed == 1.0:
        raw.rename(tmp)
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter:a", f"atempo={speed}", str(tmp)], check=True)
        raw.unlink()
    os.replace(tmp, out_path)
    return probe_duration(out_path)
