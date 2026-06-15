#!/usr/bin/env python3
"""Generate missing character art with nano_banana_pro, then white-key to transparent.
Usage: gen_nb.py <start> <end> [budget_seconds]
Idempotent: skips files that exist and are >10KB.
"""
import json, sys, subprocess, shlex, os, time, shutil
from collections import deque
from PIL import Image

manifest = json.load(open("tools/_manifest.json"))
WS = "/home/user/workspace"
start, end = int(sys.argv[1]), int(sys.argv[2])
BUDGET = int(sys.argv[3]) if len(sys.argv) > 3 else 100000
T0 = time.time()
THR = 230

def whitekey(path):
    im = Image.open(path).convert("RGBA")
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
        if r >= THR and g >= THR and b >= THR:
            px[x, y] = (255, 255, 255, 0)
            dq.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    im.save(path)

missing = []
for item in manifest[start:end]:
    dest = os.path.join(WS, "whoosit", item["out"])
    if not (os.path.exists(dest) and os.path.getsize(dest) > 10000):
        missing.append(item)
print(f"MISSING [{start}:{end}]: {len(missing)} -> " + ", ".join(f"{m['deck']}/{m['filename']}" for m in missing), flush=True)

for item in missing:
    if time.time() - T0 > BUDGET:
        print("BUDGET REACHED", flush=True); break
    deck, fn, out = item["deck"], item["filename"], item["out"]
    prompt = item["prompt"].replace(
        "Plain solid flat background (no scenery).",
        "Set against a perfectly uniform flat pure solid white background, no scenery.")
    dest = os.path.join(WS, "whoosit", out)
    payload = {"prompt": prompt, "filename": f"{deck}_{fn}",
               "model": "nano_banana_pro", "aspect_ratio": "1:1"}
    cmd = "asi-generate-image " + shlex.quote(json.dumps(payload))
    ok = False
    for attempt in range(4):
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        gen = os.path.join(WS, f"{deck}_{fn}.png")
        if os.path.exists(gen) and os.path.getsize(gen) > 10000:
            try:
                whitekey(gen)
            except Exception as e:
                print(f"KEYERR {deck}/{fn}: {e}", flush=True)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(gen, dest)
            print(f"OK   {deck}/{fn}", flush=True)
            ok = True
            break
        else:
            tail = (r.stdout or r.stderr or "")[-120:]
            print(f"RETRY {deck}/{fn} a{attempt+1}: {tail.strip()[:90]}", flush=True)
            time.sleep(3)
    if not ok:
        print(f"FAIL {deck}/{fn}", flush=True)
print("DONE", flush=True)
