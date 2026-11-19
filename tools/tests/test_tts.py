import re
import shutil
import subprocess

import pytest

from reel.tts import postprocess, probe_duration, probe_rate

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="needs ffmpeg")


def make_take(path, volume, lead, tail):
    """A 1.2 s 'voice' (tremolo tone) with silence before/after, like a raw TTS take."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"sine=f=220:d=1.2,volume={volume},tremolo=f=5:d=0.7",
                    "-af", f"adelay={int(lead * 1000)}:all=1,apad=pad_dur={tail}", "-ar", "24000", "-ac", "1", str(path)], check=True)


def lufs(path) -> float:
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])


def test_quiet_and_loud_takes_end_up_trimmed_and_equally_loud(tmp_path):
    quiet, loud = tmp_path / "q.wav", tmp_path / "l.wav"
    make_take(quiet, 0.05, 0.6, 0.9)
    make_take(loud, 0.6, 0.3, 0.5)
    for src in (quiet, loud):
        out = src.with_name(src.stem + "-out.wav")
        postprocess(src, out, {"trimSilence": True, "loudness": -16})
        assert probe_duration(out) == pytest.approx(1.2 + 0.04 + 0.08, abs=0.06)
        assert lufs(out) == pytest.approx(-16, abs=0.6)
        assert probe_rate(out) == 24000


def test_everything_off_keeps_the_take(tmp_path):
    src, out = tmp_path / "q.wav", tmp_path / "o.wav"
    make_take(src, 0.3, 0.5, 0.5)
    postprocess(src, out, {"trimSilence": False, "loudness": None})
    assert probe_duration(out) == pytest.approx(2.2, abs=0.03)


def test_pure_silence_is_not_trimmed_to_nothing(tmp_path):
    src, out = tmp_path / "s.wav", tmp_path / "o.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "1", str(src)], check=True)
    postprocess(src, out, {"trimSilence": True, "loudness": -16})
    assert probe_duration(out) == pytest.approx(1.0, abs=0.03)
