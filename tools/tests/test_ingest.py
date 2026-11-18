import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import ingest, slugify  # noqa: E402


def ff(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def test_slugify():
    assert slugify("Học viên Lớp Đặc biệt (1)") == "hoc-vien-lop-dac-biet-1"


def test_ingest_normalizes_and_indexes(tmp_path):
    inbox, lib = tmp_path / "inbox", tmp_path / "library"
    inbox.mkdir()
    ff("-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=25", "-t", "2", "-c:v", "libx264", str(inbox / "Lớp học.MOV"))
    ff("-f", "lavfi", "-i", "testsrc=size=720x1280:rate=60", "-t", "2", "-c:v", "libx264", str(inbox / "doc.mp4"))
    ff("-f", "lavfi", "-i", "gradients=size=800x600", "-frames:v", "1", str(inbox / "anh.png"))
    (inbox / "notes.txt").write_text("skip me")

    names = ingest(inbox, lib)

    assert sorted(names) == ["anh.jpg", "doc.mp4", "lop-hoc.mp4"]
    idx = json.loads((lib / "media-index.json").read_text(encoding="utf-8"))
    assert idx["lop-hoc.mp4"]["orientation"] == "landscape" and idx["doc.mp4"]["orientation"] == "portrait"
    assert idx["anh.jpg"]["type"] == "image" and idx["lop-hoc.mp4"]["description"] == ""
    assert abs(idx["lop-hoc.mp4"]["duration"] - 2.0) < 0.2
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                       "stream=codec_name,r_frame_rate,pix_fmt", "-of", "json", str(lib / "doc.mp4")],
                                      capture_output=True, text=True, check=True).stdout)["streams"][0]
    assert probe == {"codec_name": "h264", "r_frame_rate": "30/1", "pix_fmt": "yuv420p"}
    for n in names:
        assert (lib / "thumbs" / f"{Path(n).stem}.jpg").is_file()
    assert (inbox / "_done" / "doc.mp4").is_file() and (inbox / "notes.txt").is_file()

    idx["doc.mp4"]["description"] = "kept"
    (lib / "media-index.json").write_text(json.dumps(idx), encoding="utf-8")
    ff("-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30", "-t", "1", "-c:v", "libx264", str(inbox / "doc.mp4"))
    assert ingest(inbox, lib) == ["doc-2.mp4"]  # name collision -> suffix; old entry untouched
    assert json.loads((lib / "media-index.json").read_text(encoding="utf-8"))["doc.mp4"]["description"] == "kept"
