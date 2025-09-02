from PIL import Image
from pathlib import Path
import re

SIZES = [640, 960, 1280, 1600]
IN_DIR  = Path("media/research/shape-tuning/orig")
OUT_DIR = Path("media/research/shape-tuning")

def nkey(p):
    s = p.name
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]

def convert_one_dir(in_dir: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    exts = {".png",".jpg",".jpeg",".gif",".tif",".tiff",".bmp",".webp"}
    files = sorted([p for p in in_dir.rglob("*") if p.suffix.lower() in exts], key=nkey)
    for i, src in enumerate(files, start=1):
        im = Image.open(src)
        if getattr(im, "is_animated", False):
            im.seek(0)
        im = im.convert("RGB")
        w, h = im.size
        im.save(out_dir/f"{i}.webp", "WEBP", quality=90, method=6)
        for s in SIZES:
            if s < w:
                nh = int(h * (s / w))
                im_r = im.resize((s, nh), resample=Image.LANCZOS)
            else:
                im_r = im.copy()
            im_r.save(out_dir/f"{i}-{s}.webp", "WEBP", quality=85, method=6)
        print("✓", out_dir/f"{i}.webp")

if __name__ == "__main__":
    convert_one_dir(IN_DIR, OUT_DIR)
    print("Done.")
