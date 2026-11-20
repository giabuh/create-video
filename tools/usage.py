"""Print how many projects use each library media file, least-used first (prefer those for new reels)."""
import json
from pathlib import Path


def counts(root: Path) -> dict[str, int]:
    index = json.loads((root / "library/media-index.json").read_text())
    used: dict[str, set[str]] = {n: set() for n in index}
    for sb in root.glob("projects/*/storyboard.json"):
        for scene in json.loads(sb.read_text()).get("scenes", []):
            for m in scene.get("media", []):
                used.setdefault(m["src"], set()).add(sb.parent.name)
    return {n: len(p) for n, p in sorted(used.items(), key=lambda kv: len(kv[1]))}


if __name__ == "__main__":
    for name, n in counts(Path(__file__).resolve().parent.parent).items():
        print(f"{n}\t{name}")
