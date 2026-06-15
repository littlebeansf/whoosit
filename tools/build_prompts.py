import json, os

cast = json.load(open("tools/_cast.json"))

# Shared style preamble — keeps all 64 portraits visually consistent so they
# read as one cohesive Guess-Who deck.
STYLE = (
    "Retro comic / pop-art character portrait. Bold thick black ink outlines, "
    "flat cel-shaded coloring, vintage halftone Ben-Day dot shading, punchy "
    "saturated primary colors, subtle screen-print texture. Head-and-shoulders "
    "bust centered, facing forward, friendly exaggerated cartoon proportions, "
    "big readable features. Plain solid flat background (no scenery). "
    "Single character only. No text, no letters, no logos, no speech bubbles, "
    "no border. Original character, not based on any existing copyrighted design."
)

# Per-deck flavor + attribute -> descriptive phrase maps.
DECKS = {
  "wizards": {
    "lead": "A fantasy wizard.",
    "maps": {
      "robe": {"grey":"wearing a grey robe","crimson":"wearing a deep crimson robe","emerald":"wearing an emerald-green robe","midnight":"wearing a midnight-blue robe"},
      "beard": {"long":"with a very long flowing beard","short":"with a short trimmed beard","braided":"with a braided beard","none":"clean-shaven, no beard"},
      "hat": {True:"wearing a tall pointed wizard hat",False:"with no hat, hair visible"},
      "staff": {"staff":"holding a tall wooden magic staff","wand":"holding a slender magic wand","orb":"holding a glowing crystal orb","tome":"clutching a thick spellbook tome"},
      "familiar": {"owl":"a small owl perched on the shoulder","cat":"a small cat beside them","raven":"a black raven on the shoulder","none":"no animal companion"},
      "glow": {"golden":"surrounded by a warm golden magic glow","icy":"surrounded by a pale icy-blue glow","fiery":"surrounded by a fiery orange glow","none":"no magic aura"},
    },
  },
  "toons": {
    "lead": "A classic Saturday-morning cartoon character.",
    "maps": {
      "kind": {"warthog":"a chubby cartoon warthog","sea-critter":"a goofy cartoon sea creature","cowboy":"a cartoon cowboy person","critter":"a cute cartoon animal critter"},
      "color": {"yellow":"bright yellow body","pink":"pink body","blue":"blue body","brown":"warm brown body"},
      "teeth": {True:"with big prominent buck teeth",False:"normal small teeth"},
      "headgear": {"cowboy-hat":"wearing a cowboy hat","cap":"wearing a baseball cap","bow":"wearing a hair bow","none":"bare head"},
      "feet": {"boots":"","sneakers":"","barefoot":"","flippers":""},  # feet rarely visible in bust; omit
      "face": {"goofy":"goofy silly grinning expression","sneaky":"sneaky sly smirk","happy":"big cheerful happy smile","angry":"grumpy angry frown"},
    },
  },
  "heroes": {
    "lead": "A comic-book superhero.",
    "maps": {
      "suit": {"red":"wearing a bright red superhero suit","blue":"wearing a blue superhero suit","green":"wearing a green superhero suit","gold":"wearing a gold-and-yellow superhero suit"},
      "power": {"armor":"clad in sleek metal power armor","strength":"extremely muscular and bulky","flight":"heroic confident flying pose","gadgets":"sleek agile build with tech gear"},
      "cape": {True:"with a flowing cape behind them",False:"no cape"},
      "mask": {"domino":"wearing a small domino eye mask","full":"wearing a full face mask","helmet":"wearing a full metal helmet","none":"no mask, face fully visible"},
      "emblem": {"star":"a bold star emblem on the chest","bolt":"a lightning-bolt emblem on the chest","shield":"a shield emblem on the chest","none":"plain chest, no emblem"},
      "hair": {"black":"black hair","blonde":"blonde hair","red":"red hair","hidden":"hair hidden by mask or helmet"},
    },
  },
  "villains": {
    "lead": "A comic-book supervillain.",
    "maps": {
      "skin": {"pale":"very pale white skin","green":"green skin","grey":"ashen grey skin","red":"red skin"},
      "hair": {"bald":"completely bald head","wild":"wild messy hair","slick":"slicked-back hair","horned-helm":"wearing a horned helmet"},
      "cape": {True:"wearing a dramatic dark cape or cloak",False:"no cape"},
      "weapon": {"staff":"holding a sinister magic staff","claws":"with menacing sharp claws","blaster":"holding a futuristic blaster weapon","none":"empty hands, no weapon"},
      "scar": {True:"with a visible scar across the face",False:"no scar"},
      "grin": {"sneer":"arrogant sneer","grin":"wicked toothy grin","scowl":"furious scowl","cold":"cold emotionless stare"},
    },
  },
}

manifest = []
for deck_id, deck in DECKS.items():
    for c in cast[deck_id]:
        parts = [deck["lead"], c["ref"] + "."]
        for attr_id, mp in deck["maps"].items():
            v = c["attrs"].get(attr_id)
            phrase = mp.get(v, "")
            if phrase:
                parts.append(phrase + ".")
        desc = " ".join(parts)
        prompt = f"{STYLE} {desc}"
        manifest.append({
            "deck": deck_id,
            "filename": c["id"],
            "out": f"assets/{deck_id}/{c['id']}.png",
            "prompt": prompt,
        })

json.dump(manifest, open("tools/_manifest.json","w"), indent=2)
print(f"built {len(manifest)} prompts")
print("\nSAMPLE:\n", manifest[0]["prompt"][:400])
print("\n", manifest[33]["prompt"][:400])
