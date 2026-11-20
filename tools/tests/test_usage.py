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


def test_motion_combos_counts_variants_and_last_project(tmp_path):
    import os
    from usage import motion_combos
    def mk(slug, sb, mtime):
        d = tmp_path / "projects" / slug
        d.mkdir(parents=True)
        (d / "storyboard.json").write_text(json.dumps(sb))
        os.utime(d / "storyboard.json", (mtime, mtime))
    mk("old", {"scenes": [{"motion": [{"component": "Checklist", "props": {"variant": "steps"}}, {"component": "Ribbon", "props": {}}]}]}, 100)
    mk("new", {"motion": [{"component": "Ribbon"}], "scenes": [{"motion": [{"component": "PriceTag", "props": {"variant": "slam"}}]}]}, 200)
    ranked, last = motion_combos(tmp_path)
    assert ranked == {"Checklist/steps": 1, "PriceTag/slam": 1, "Ribbon/default": 2}
    assert last == ("new", {"Ribbon/default", "PriceTag/slam"})
