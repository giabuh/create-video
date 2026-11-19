import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # makes `reel` importable

CFG = {
    "defaults": {"voice": "phuong", "template": "fast-cut", "brand": "demo"},
    "tts": {"temperature": 0.8, "top_k": 25, "speed": 1.0, "pauseAfter": 0.3},
    "voices": {
        "phuong": {"ref": "voices/phuong-short.wav", "speed": 1.05},
        "vy": {"ref": "voices/vy-short.wav", "temperature": 0.7},
    },
    "video": {"fps": 30, "width": 1080, "height": 1920},
    "music": {"volume": 0.25, "duckTo": 0.08, "fadeOut": 1.5},
    "captions": {"font": "Be Vietnam Pro", "size": 64, "color": "#FFFFFF", "highlightColor": "#FFD400", "maxWords": 6},
}


@pytest.fixture
def cfg():
    return copy.deepcopy(CFG)
