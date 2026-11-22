"""Print how many projects use each library media file, least-used first (prefer those for new reels)."""
import re
import sys
from pathlib import Path

from reel.config import load_json


def iter_storyboards(root: Path):
    """(path, storyboard dict) for every projects/*/storyboard.json."""
    for sb in root.glob("projects/*/storyboard.json"):
        yield sb, load_json(sb)


def counts(root: Path) -> dict[str, int]:
    index = load_json(root / "library/media-index.json")
    used: dict[str, set[str]] = {n: set() for n in index}
    for sb, data in iter_storyboards(root):
        for scene in data.get("scenes", []):
            for m in scene.get("media", []):
                used.setdefault(m["src"], set()).add(sb.parent.name)
    return {n: len(p) for n, p in sorted(used.items(), key=lambda kv: len(kv[1]))}


def motion_combos(root: Path):
    """Return ({component/variant: project count} least-used first, (last project slug, its combos))."""
    used: dict[str, set[str]] = {}
    per: list[tuple[float, str, set[str]]] = []
    for sb, data in iter_storyboards(root):
        layers = list(data.get("motion", [])) + [m for s in data.get("scenes", []) for m in s.get("motion", [])]
        combos = {f'{m["component"]}/{(m.get("props") or {}).get("variant", "default")}' for m in layers}
        for c in combos:
            used.setdefault(c, set()).add(sb.parent.name)
        per.append((sb.stat().st_mtime, sb.parent.name, combos))
    ranked = dict(sorted(((c, len(p)) for c, p in used.items()), key=lambda kv: (kv[1], kv[0])))
    last = max(per)[1:] if per else None
    return ranked, last


def unused_components(root: Path) -> list[str]:
    """Registry components (studio/src/motion/registry.ts) that no storyboard uses."""
    names = re.findall(r"^\s+(\w+): defineMotion\(", (root / "studio/src/motion/registry.ts").read_text(), re.M)
    used = {c.split("/")[0] for c in motion_combos(root)[0]}
    return [n for n in names if n not in used]


def transition_counts(root: Path) -> dict[str, int]:
    """Scene transition counts across storyboards, least used first; a missing value counts as cut; unused kinds show 0."""
    from reel.validate import TRANSITIONS
    n: dict[str, int] = dict.fromkeys(TRANSITIONS, 0)
    for _, data in iter_storyboards(root):
        for scene in data.get("scenes", []):
            t = scene.get("transition") or "cut"
            n[t] = n.get(t, 0) + 1
    return dict(sorted(n.items(), key=lambda kv: (kv[1], kv[0])))


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    if "--motion" in sys.argv:
        ranked, last = motion_combos(root)
        for name, n in ranked.items():
            print(f"{n}\t{name}")
        if last:
            print(f"last project: {last[0]}: {', '.join(sorted(last[1]))}")
        print("never used: " + (", ".join(unused_components(root)) or "-"))
        print("transitions (least used first): " + ", ".join(f"{t} {k}" for t, k in transition_counts(root).items()))
    else:
        for name, n in counts(root).items():
            print(f"{n}\t{name}")
