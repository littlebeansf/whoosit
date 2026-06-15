#!/usr/bin/env python3
"""Fill in any missing character art (idempotent, sequential, robust).
Usage: gen_fill.py [start] [end]   (defaults to whole manifest)
Skips files that already exist and are >10KB. Up to 5 retries with backoff.
"""
import json, sys, subprocess, shlex, os, time, shutil

manifest = json.load(open("tools/_manifest.json"))
WS = "/home/user/workspace"
start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
end = int(sys.argv[2]) if len(sys.argv) > 2 else len(manifest)
# optional 3rd arg: wall-clock budget in seconds; stop starting new images after it
BUDGET = int(sys.argv[3]) if len(sys.argv) > 3 else 100000
T0 = time.time()

missing = []
for item in manifest[start:end]:
    dest = os.path.join(WS, "whoosit", item["out"])
    if not (os.path.exists(dest) and os.path.getsize(dest) > 10000):
        missing.append(item)
print(f"MISSING in [{start}:{end}]: {len(missing)} -> " + ", ".join(f"{m['deck']}/{m['filename']}" for m in missing), flush=True)

for item in missing:
    if time.time() - T0 > BUDGET:
        print("BUDGET REACHED, stopping", flush=True)
        break
    deck, fn, out, prompt = item["deck"], item["filename"], item["out"], item["prompt"]
    dest = os.path.join(WS, "whoosit", out)
    payload = {"prompt": prompt, "filename": f"{deck}_{fn}",
               "model": "gpt_image_1_5", "aspect_ratio": "1:1",
               "background": "transparent"}
    cmd = "asi-generate-image " + shlex.quote(json.dumps(payload))
    ok = False
    for attempt in range(8):
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        gen_path = os.path.join(WS, f"{deck}_{fn}.png")
        if os.path.exists(gen_path) and os.path.getsize(gen_path) > 10000:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(gen_path, dest)
            print(f"OK   {deck}/{fn}", flush=True)
            ok = True
            break
        else:
            tail = (r.stdout or r.stderr or "")[-160:]
            print(f"RETRY {deck}/{fn} attempt {attempt+1}: {tail.strip()[:120]}", flush=True)
            time.sleep(2)
    if not ok:
        print(f"FAIL {deck}/{fn}", flush=True)
print("DONE", flush=True)
