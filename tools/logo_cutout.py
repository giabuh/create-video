"""Make a logo's flat background transparent: flood-fill from the 4 corners, then crop. Usage: logo_cutout.py IN OUT.png"""
import sys
from PIL import Image, ImageDraw

def cutout(src: str, dst: str, thresh: int = 40) -> bool:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    if im.getchannel("A").getextrema()[0] < 255:
        return False  # already has transparency (corners may be opaque after an earlier crop)
    for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if im.getpixel(p)[3]:
            ImageDraw.floodfill(im, p, (0, 0, 0, 0), thresh=thresh)
    box = im.getchannel("A").getbbox()
    if box:  # keep a 2px transparent margin so a second run sees the transparency and skips
        im = im.crop((max(box[0] - 2, 0), max(box[1] - 2, 0), min(box[2] + 2, w), min(box[3] + 2, h)))
    im.save(dst)
    return True

if __name__ == "__main__":
    sys.exit(0 if cutout(sys.argv[1], sys.argv[2]) else 3)
