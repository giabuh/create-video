import json

from reel.validate import validate
from reel.videos_index import write_videos_index


def video(root, slug, *names):
    d = root / "studio/src/videos" / slug
    d.mkdir(parents=True)
    body = "".join(f"  {n}: defineMotion({{}}),\n" for n in names)
    (d / "index.ts").write_text(f"export const MOTION = {{\n{body}}};\n")


def out(root):
    return (root / "studio/src/videos/index.ts").read_text()


def test_empty(tmp_path):
    write_videos_index(tmp_path)
    assert "VIDEO_MOTION: Record<string, MotionDef> = {\n};" in out(tmp_path)


def test_two_videos_same_name(tmp_path):
    video(tmp_path, "a", "Map")
    video(tmp_path, "b", "Map")
    write_videos_index(tmp_path)
    assert "'a/Map': v0.Map" in out(tmp_path) and "'b/Map': v1.Map" in out(tmp_path)


def test_idempotent(tmp_path):
    video(tmp_path, "a", "Map")
    assert write_videos_index(tmp_path) is True
    assert write_videos_index(tmp_path) is False


def test_validate_missing(tmp_path, cfg):
    for d in ["studio/src/templates/fast-cut", "brands/demo"]:
        (tmp_path / d).mkdir(parents=True)
    (tmp_path / "brands/demo/brand.json").write_text("{}")
    video(tmp_path, "x", "Yes")
    sb = lambda c: {"scenes": [{"id": "s1", "duration": 2, "motion": [{"component": c}]}]}
    assert not any("x/" in e for e in validate(sb("x/Yes"), cfg, tmp_path))
    assert any("x/Nope" in e for e in validate(sb("x/Nope"), cfg, tmp_path))
