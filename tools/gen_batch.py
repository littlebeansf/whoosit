#!/usr/bin/env python3
"""Generate a slice of the character art manifest.
Usage: gen_batch.py <start> <end>   (end exclusive)
Each image is generated with up to 3 retries on transient network errors.
Outputs land in /home/user/workspace/<filename>.png (workspace root) and are
then moved into the proper assets/<deck>/ folder.
"""
import json, sys, subprocess, shlex, os, time, shutil

start, end = int(sys.argv[1]), int(sys.argv[2])
manifest = json.load(open("tools/_manifest.json"))
WS = "/home/user/workspace"

for item in manifest[start:end]:
    deck, fn, out, prompt = item["deck"], item["filename"], item["out"], item["prompt"]
    dest = os.path.join(WS, "whoosit", out)
    if os.path.exists(dest) and os.path.getsize(dest) > 10000:
        print(f"SKIP {deck}/{fn} (exists)")
        continue
    payload = {"prompt": prompt, "filename": f"{deck}_{fn}",
               "model": "gpt_image_1_5", "aspect_ratio": "1:1",
               "background": "transparent"}
    cmd = "asi-generate-image " + shlex.quote(json.dumps(payload))
    ok = False
    for attempt in range(3):
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        gen_path = os.path.join(WS, f"{deck}_{fn}.png")
        if os.path.exists(gen_path) and os.path.getsize(gen_path) > 10000:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(gen_path, dest)
            print(f"OK   {deck}/{fn}")
            ok = True
            break
        else:
            tail = (r.stdout or r.stderr or "")[-160:]
            print(f"RETRY {deck}/{fn} attempt {attempt+1}: {tail.strip()[:120]}")
            time.sleep(4)
    if not ok:
        print(f"FAIL {deck}/{fn}")
