#!/usr/bin/env python3
"""Flood-fill solid background (sampled from corners) to transparent.
Usage: colorkey.py <in.png> [out.png] [tol=40]
Keys whatever color dominates the corners (works for colored backgrounds).
"""
import sys
from collections import deque, Counter
from PIL import Image

inp = sys.argv[1]
outp = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].isdigit() else inp
tol = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 40
im = Image.open(inp).convert("RGBA")
w, h = im.size
px = im.load()
# sample corner color (most common among 4 corners)
corners = [px[0,0], px[w-1,0], px[0,h-1], px[w-1,h-1]]
bg = Counter([c[:3] for c in corners]).most_common(1)[0][0]
br, bg2, bb = bg

def close(c):
    return abs(c[0]-br) <= tol and abs(c[1]-bg2) <= tol and abs(c[2]-bb) <= tol

seen = bytearray(w * h)
dq = deque()
for x in range(w):
    dq.append((x, 0)); dq.append((x, h - 1))
for y in range(h):
    dq.append((0, y)); dq.append((w - 1, y))
cleared = 0
while dq:
    x, y = dq.popleft()
    if x < 0 or y < 0 or x >= w or y >= h:
        continue
    idx = y * w + x
    if seen[idx]:
        continue
    seen[idx] = 1
    c = px[x, y]
    if close(c):
        px[x, y] = (c[0], c[1], c[2], 0)
        cleared += 1
        dq.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
im.save(outp)
print(f"keyed {inp} bg={bg} cleared={cleared}/{w*h}")
