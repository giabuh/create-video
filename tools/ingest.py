#!/usr/bin/env python3
"""Normalize new media from inbox/ into library/ (+ thumbs, + media-index.json skeleton).

Usage: python3 tools/ingest.py
Videos -> H.264 yuv420p SDR 30 fps (short side <= 1080, rotation baked in). Photos (incl. HEIC) -> JPG.
Claude fills description/tags/goodRanges afterwards by viewing library/thumbs/<name>.jpg.
"""
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEO = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".3gp"}
IMAGE = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
SCALE = "scale='if(lt(iw,ih),min(1080,iw),-2)':'if(lt(iw,ih),-2,min(1080,ih))'"
TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,"
           "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name.replace("đ", "d").replace("Đ", "D"))
    s = s.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "media"


def run(*args) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def unique(library: Path, stem: str, ext: str) -> Path:
    p, n = library / f"{stem}{ext}", 2
    while p.exists():
        p, n = library / f"{stem}-{n}{ext}", n + 1
    return p


def normalize_video(src: Path, dst: Path) -> None:
    v = next(s for s in probe(src)["streams"] if s["codec_type"] == "video")
    hdr = v.get("color_transfer") in ("smpte2084", "arib-std-b67")
    vf = ",".join(([TONEMAP] if hdr else []) + [SCALE, "fps=30", "format=yuv420p"])
    run("-i", str(src), "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", str(dst))


def normalize_image(src: Path, dst: Path) -> None:
    # shortcut: relies on ffmpeg applying EXIF orientation; check the first real portrait phone photo.
    try:
        run("-i", str(src), "-vf", "scale='min(2160,iw)':-2", "-frames:v", "1", "-q:v", "2", str(dst))
    except subprocess.CalledProcessError:
        if not shutil.which("heif-convert"):
            raise RuntimeError(f"cannot decode {src.name}; for HEIC install: sudo apt install libheif-examples")
        tmp = dst.with_suffix(".tmp.jpg")
        subprocess.run(["heif-convert", str(src), str(tmp)], check=True, capture_output=True)
        run("-i", str(tmp), "-vf", "scale='min(2160,iw)':-2", "-frames:v", "1", "-q:v", "2", str(dst))
        tmp.unlink()


def thumb(path: Path, kind: str, duration: float, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if kind == "video":
        run("-i", str(path), "-vf", f"fps={6 / max(duration, 0.5):.4f},scale=480:-2,tile=3x2", "-frames:v", "1", str(dst))
    else:
        run("-i", str(path), "-vf", "scale=480:-2", "-frames:v", "1", str(dst))


def entry(path: Path, kind: str) -> dict:
    info = probe(path)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    dur = round(float(info["format"].get("duration", 0)), 2) if kind == "video" else None
    return {"type": kind, "duration": dur, "width": w, "height": h,
            "orientation": "portrait" if h > w else "landscape" if w > h else "square",
            "description": "", "tags": [], "goodRanges": [[0, dur]] if kind == "video" else []}


def ingest(inbox: Path, library: Path) -> list[str]:
    library.mkdir(parents=True, exist_ok=True)
    index_path = library / "media-index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    done, added = inbox / "_done", []
    for src in sorted(p for p in inbox.iterdir() if p.is_file()):
        ext = src.suffix.lower()
        kind = "video" if ext in VIDEO else "image" if ext in IMAGE else None
        if kind is None:
            print(f"skip (unsupported): {src.name}")
            continue
        dst = unique(library, slugify(src.stem), ".mp4" if kind == "video" else ".jpg")
        try:
            (normalize_video if kind == "video" else normalize_image)(src, dst)
            index[dst.name] = entry(dst, kind)
            thumb(dst, kind, index[dst.name]["duration"] or 0, library / "thumbs" / f"{dst.stem}.jpg")
        except Exception as e:  # leave the original in inbox, drop partial output
            dst.unlink(missing_ok=True)
            index.pop(dst.name, None)
            print(f"FAILED {src.name}: {e}")
            continue
        index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        done.mkdir(exist_ok=True)
        shutil.move(str(src), unique(done, src.stem, src.suffix))
        added.append(dst.name)
        print(f"ok: {src.name} -> library/{dst.name}")
    return added


if __name__ == "__main__":
    names = ingest(ROOT / "inbox", ROOT / "library")
    print(f"{len(names)} new file(s). Next: describe them in library/media-index.json from library/thumbs/.")
    sys.exit(0)
