#!/usr/bin/env python3
"""Regenerate specific fixes with nano_banana_pro + white-key.
Handles: solid-bg redo (use manifest prompt) and copyright-risk redo (override prompt).
Usage: regen_fixes.py [budget_seconds]
"""
import json, sys, subprocess, shlex, os, time, shutil
from collections import deque
from PIL import Image

manifest = {m["filename"]: m for m in json.load(open("tools/_manifest.json"))}
WS = "/home/user/workspace"
BUDGET = int(sys.argv[1]) if len(sys.argv) > 1 else 100000
T0 = time.time()
THR = 230

STYLE = ("Retro comic / pop-art character portrait. Bold thick black ink outlines, flat cel-shaded coloring, "
         "vintage halftone Ben-Day dot shading, punchy saturated primary colors, subtle screen-print texture. "
         "Tight head-and-shoulders bust, face large and centered, facing forward, friendly exaggerated cartoon "
         "proportions, big readable features. Set against a perfectly uniform flat pure solid white background, no scenery. "
         "Single character only. Absolutely NO text, NO letters, NO numbers, NO real-world logos, no speech bubbles, no border. "
         "Completely original character. ")

# copyright-safe overrides (emblems = generic geometric shapes, NO famous logos)
OVERRIDE = {
 "x04": STYLE + "An original flying superhero strongman. Bright sky-blue costume. Heroic confident smile, dark wavy hair. "
        "A flowing royal-blue cape. No mask. A simple plain geometric SHIELD-shaped badge on the chest that is a solid blank crest with NO letter and NO symbol inside. "
        "Must NOT resemble Superman: no S, no diamond logo, no spit-curl.",
 "x05": STYLE + "An original brooding gadget vigilante. Dark navy-blue costume. A flowing dark cape. "
        "A sleek full face cowl mask with small rounded ears and visible mouth/chin. No chest emblem. "
        "Must NOT resemble Batman: avoid bat shapes, avoid black-and-grey bat logo.",
 "x07": STYLE + "An original patriotic soldier hero. Sky-blue costume. No cape. A small domino eye mask. Blonde hair. "
        "A plain solid five-pointed STAR on the chest, NO stripes, NO circular shield. "
        "Must NOT resemble Captain America: no red-white-striped round shield, no wings on the mask.",
 "x10": STYLE + "An original bulky armored gadget hero. Deep red mechanical power-armor suit with a full metal helmet. No cape. "
        "A plain blank geometric SHIELD badge on the chest with NOTHING inside it. "
        "Must NOT resemble Superman or any real hero logo: no letters, no diamond, no S.",
 "x15": STYLE + "An original golden caped flying strongman. Shiny gold costume, blonde hair, no mask, a flowing golden cape. "
        "A plain blank geometric SHIELD crest on the chest with NOTHING inside it. "
        "Must NOT resemble Superman: no S, no diamond, no real logo.",
 "v03": STYLE + "An original sinister circus clown villain. Chalk-white painted face, a wide unsettling grin, mismatched patchwork "
        "ragged carnival jacket in clashing colors. Wild messy dark hair (NOT green). "
        "Must NOT resemble the Joker: avoid green hair, avoid purple suit, avoid a single tear/scar.",
}

# solid-bg redo: just re-use manifest prompt (model will give white bg this time)
SOLID = ["w02", "w09", "w10", "w11", "t01", "t15", "v15"]

def whitekey(path):
    im = Image.open(path).convert("RGBA"); w, h = im.size; px = im.load()
    seen = bytearray(w * h); dq = deque()
    for x in range(w): dq.append((x,0)); dq.append((x,h-1))
    for y in range(h): dq.append((0,y)); dq.append((w-1,y))
    while dq:
        x, y = dq.popleft()
        if x<0 or y<0 or x>=w or y>=h: continue
        idx=y*w+x
        if seen[idx]: continue
        seen[idx]=1
        r,g,b,a=px[x,y]
        if r>=THR and g>=THR and b>=THR:
            px[x,y]=(255,255,255,0); dq.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
    im.save(path)

jobs = []
for fid in SOLID:
    m = manifest[fid]
    p = m["prompt"].replace("Plain solid flat background (no scenery).",
                            "Set against a perfectly uniform flat pure solid white background, no scenery.")
    jobs.append((m["deck"], fid, m["out"], p))
for fid, p in OVERRIDE.items():
    m = manifest[fid]
    jobs.append((m["deck"], fid, m["out"], p))

print(f"JOBS: {len(jobs)} -> " + ", ".join(j[1] for j in jobs), flush=True)
for deck, fid, out, prompt in jobs:
    if time.time()-T0 > BUDGET:
        print("BUDGET REACHED", flush=True); break
    dest = os.path.join(WS, "whoosit", out)
    payload = {"prompt": prompt, "filename": f"{deck}_{fid}", "model": "nano_banana_pro", "aspect_ratio": "1:1"}
    cmd = "asi-generate-image " + shlex.quote(json.dumps(payload))
    ok = False
    for attempt in range(4):
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        gen = os.path.join(WS, f"{deck}_{fid}.png")
        if os.path.exists(gen) and os.path.getsize(gen) > 10000:
            try: whitekey(gen)
            except Exception as e: print(f"KEYERR {fid}: {e}", flush=True)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(gen, dest)
            print(f"OK   {deck}/{fid}", flush=True); ok = True; break
        else:
            tail=(r.stdout or r.stderr or "")[-110:]
            print(f"RETRY {fid} a{attempt+1}: {tail.strip()[:80]}", flush=True); time.sleep(3)
    if not ok: print(f"FAIL {deck}/{fid}", flush=True)
print("DONE", flush=True)
