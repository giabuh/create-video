import json

from usage import counts


def test_counts_projects_least_used_first(tmp_path):
    (tmp_path / "library").mkdir()
    (tmp_path / "library/media-index.json").write_text(json.dumps({"a.mp4": {}, "b.jpg": {}, "c.mp4": {}}))
    for slug, srcs in {"p1": [["a.mp4", "a.mp4"], ["b.jpg"]], "p2": [["a.mp4"]]}.items():
        (tmp_path / "projects" / slug).mkdir(parents=True)
        sb = {"scenes": [{"media": [{"src": s} for s in scene]} for scene in srcs]}
        (tmp_path / "projects" / slug / "storyboard.json").write_text(json.dumps(sb))
    assert list(counts(tmp_path).items()) == [("c.mp4", 0), ("b.jpg", 1), ("a.mp4", 2)]
