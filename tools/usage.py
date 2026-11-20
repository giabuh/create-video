"""Print how many projects use each library media file, least-used first (prefer those for new reels)."""
import json
import sys
from pathlib import Path


def counts(root: Path) -> dict[str, int]:
    index = json.loads((root / "library/media-index.json").read_text())
    used: dict[str, set[str]] = {n: set() for n in index}
    for sb in root.glob("projects/*/storyboard.json"):
        for scene in json.loads(sb.read_text()).get("scenes", []):
            for m in scene.get("media", []):
                used.setdefault(m["src"], set()).add(sb.parent.name)
    return {n: len(p) for n, p in sorted(used.items(), key=lambda kv: len(kv[1]))}


def motion_combos(root: Path):
    """Return ({component/variant: project count} least-used first, (last project slug, its combos))."""
    used: dict[str, set[str]] = {}
    per: list[tuple[float, str, set[str]]] = []
    for sb in root.glob("projects/*/storyboard.json"):
        data = json.loads(sb.read_text())
        layers = list(data.get("motion", [])) + [m for s in data.get("scenes", []) for m in s.get("motion", [])]
        combos = {f'{m["component"]}/{(m.get("props") or {}).get("variant", "default")}' for m in layers}
        for c in combos:
            used.setdefault(c, set()).add(sb.parent.name)
        per.append((sb.stat().st_mtime, sb.parent.name, combos))
    ranked = dict(sorted(((c, len(p)) for c, p in used.items()), key=lambda kv: (kv[1], kv[0])))
    last = max(per)[1:] if per else None
    return ranked, last


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    if "--motion" in sys.argv:
        ranked, last = motion_combos(root)
        for name, n in ranked.items():
            print(f"{n}\t{name}")
        if last:
            print(f"last project: {last[0]}: {', '.join(sorted(last[1]))}")
    else:
        for name, n in counts(root).items():
            print(f"{n}\t{name}")
