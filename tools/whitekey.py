#!/usr/bin/env python3
"""Flood-fill near-white background to transparent from image edges.
Usage: whitekey.py <in.png> <out.png> [threshold=232]
Preserves interior whites (teeth, highlights) by only clearing edge-connected white.
"""
import sys
from collections import deque
from PIL import Image

inp, outp = sys.argv[1], sys.argv[2]
thr = int(sys.argv[3]) if len(sys.argv) > 3 else 232
im = Image.open(inp).convert("RGBA")
w, h = im.size
px = im.load()
seen = bytearray(w * h)
dq = deque()
for x in range(w):
    dq.append((x, 0)); dq.append((x, h - 1))
for y in range(h):
    dq.append((0, y)); dq.append((w - 1, y))
while dq:
    x, y = dq.popleft()
    if x < 0 or y < 0 or x >= w or y >= h:
        continue
    idx = y * w + x
    if seen[idx]:
        continue
    seen[idx] = 1
    r, g, b, a = px[x, y]
    if r >= thr and g >= thr and b >= thr:
        px[x, y] = (255, 255, 255, 0)
        dq.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
im.save(outp)
print(f"keyed {inp} -> {outp} (thr={thr})")
