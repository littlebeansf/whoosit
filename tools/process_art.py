#!/usr/bin/env python3
"""Trim transparent borders and resize cryptid portraits to a uniform 512px box."""
import os
from PIL import Image

SRC = "/home/user/workspace/whoosit/assets/cryptid"
TARGET = 512
PAD = 24  # transparent padding so portraits don't touch tile edges

for fn in sorted(os.listdir(SRC)):
    if not fn.endswith(".png"):
        continue
    p = os.path.join(SRC, fn)
    im = Image.open(p).convert("RGBA")
    # trim to alpha bbox
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # fit into TARGET-2*PAD square, centered
    inner = TARGET - 2 * PAD
    w, h = im.size
    scale = min(inner / w, inner / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
    canvas.paste(im, ((TARGET - nw) // 2, (TARGET - nh) // 2), im)
    canvas.save(p, optimize=True)
    print(f"{fn}: {w}x{h} -> {TARGET}x{TARGET} ({os.path.getsize(p)//1024}KB)")

print("done")
