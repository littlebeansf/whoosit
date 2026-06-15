// WHO-O-SITT deck data.
// Each deck defines:
//   - meta (id, name, accent color, tagline)
//   - attributes: the question axes. Each has an id, label, type ('bool' | 'enum'),
//     and for enums the list of possible values (used to auto-build questions).
//   - cast: 16 characters, each with an id, name, and a value for every attribute.
//
// Questions are generated from attributes so adding a deck = pure data, no UI code.
//
// The cast is a roster of ORIGINAL characters that take strong, legally-safe
// inspiration from famous fantasy / cartoon / superhero / villain archetypes.
// Every character is drawn in a bold retro comic / pop-art style and given a
// distinctive silhouette so they are easy to tell apart at tile size.

export const DECKS = {
  // ----------------------------------------------------------------------
  // 1) WIZARDS — fantasy / sword-and-sorcery archetypes
  // ----------------------------------------------------------------------
  wizards: {
    id: 'wizards',
    name: 'Order of the Misty Tower',
    tagline: 'Sixteen spellcasters. One owes you a riddle.',
    accent: '#8b5cf6',
    accentInk: '#0d0820',
    attributes: [
      { id: 'robe', label: 'robe colour', type: 'enum',
        values: ['grey', 'crimson', 'emerald', 'midnight'],
        q: (v) => `Does your wizard wear a ${v} robe?` },
      { id: 'beard', label: 'beard', type: 'enum',
        values: ['long', 'short', 'braided', 'none'],
        q: (v) => v === 'none' ? `Is your wizard clean-shaven?` : `Does your wizard have a ${v} beard?` },
      { id: 'hat', label: 'pointed hat', type: 'bool',
        q: () => `Does your wizard wear a pointed hat?` },
      { id: 'staff', label: 'magic item', type: 'enum',
        values: ['staff', 'wand', 'orb', 'tome'],
        q: (v) => `Does your wizard carry a ${v}?` },
      { id: 'familiar', label: 'familiar', type: 'enum',
        values: ['owl', 'cat', 'raven', 'none'],
        q: (v) => v === 'none' ? `Does your wizard have no familiar?` : `Does your wizard have a pet ${v}?` },
      { id: 'glow', label: 'aura', type: 'enum',
        values: ['golden', 'icy', 'fiery', 'none'],
        q: (v) => v === 'none' ? `Does your wizard have no magic aura?` : `Does your wizard glow with a ${v} aura?` },
    ],
    cast: [
      { id: 'w01', name: 'Greybram',  ref: 'wise grey pilgrim wizard',        robe: 'grey',     beard: 'long',    hat: true,  staff: 'staff', familiar: 'owl',  glow: 'golden' },
      { id: 'w02', name: 'Mordecai',  ref: 'dark scheming court mage',        robe: 'midnight', beard: 'short',   hat: true,  staff: 'orb',   familiar: 'raven', glow: 'fiery' },
      { id: 'w03', name: 'Elowyn',    ref: 'kind forest enchantress',         robe: 'emerald',  beard: 'none',    hat: false, staff: 'wand',  familiar: 'cat',  glow: 'icy' },
      { id: 'w04', name: 'Brakka',    ref: 'gruff dwarven runesmith',         robe: 'crimson',  beard: 'braided', hat: false, staff: 'tome',  familiar: 'none', glow: 'none' },
      { id: 'w05', name: 'Sylphine',  ref: 'icy young sorceress apprentice',  robe: 'midnight', beard: 'none',    hat: true,  staff: 'wand',  familiar: 'owl',  glow: 'icy' },
      { id: 'w06', name: 'Old Pell',  ref: 'sleepy hedge wizard',             robe: 'grey',     beard: 'long',    hat: true,  staff: 'staff', familiar: 'cat',  glow: 'none' },
      { id: 'w07', name: 'Vandros',   ref: 'fiery battle archmage',           robe: 'crimson',  beard: 'short',   hat: false, staff: 'staff', familiar: 'raven', glow: 'fiery' },
      { id: 'w08', name: 'Iris',      ref: 'cheerful star-reading seer',      robe: 'emerald',  beard: 'none',    hat: true,  staff: 'orb',   familiar: 'none', glow: 'golden' },
      { id: 'w09', name: 'Thornwick', ref: 'cranky swamp witch-doctor',       robe: 'midnight', beard: 'braided', hat: false, staff: 'tome',  familiar: 'raven', glow: 'none' },
      { id: 'w10', name: 'Marigold',  ref: 'warm grandmother healer mage',    robe: 'crimson',  beard: 'none',    hat: false, staff: 'wand',  familiar: 'cat',  glow: 'golden' },
      { id: 'w11', name: 'Fenwise',   ref: 'scholarly bespectacled wizard',   robe: 'grey',     beard: 'short',   hat: true,  staff: 'tome',  familiar: 'owl',  glow: 'icy' },
      { id: 'w12', name: 'Zalindra',  ref: 'glamorous high sorceress',        robe: 'midnight', beard: 'none',    hat: true,  staff: 'orb',   familiar: 'cat',  glow: 'fiery' },
      { id: 'w13', name: 'Grumthar',  ref: 'stout grumpy mountain mage',      robe: 'emerald',  beard: 'braided', hat: false, staff: 'staff', familiar: 'none', glow: 'fiery' },
      { id: 'w14', name: 'Lumen',     ref: 'glowing celestial boy wizard',    robe: 'grey',     beard: 'none',    hat: false, staff: 'wand',  familiar: 'owl',  glow: 'golden' },
      { id: 'w15', name: 'Crowe',     ref: 'mysterious hooded necromancer',   robe: 'midnight', beard: 'long',    hat: false, staff: 'staff', familiar: 'raven', glow: 'icy' },
      { id: 'w16', name: 'Bramblefae',ref: 'tiny mischievous pixie-mage',     robe: 'emerald',  beard: 'none',    hat: true,  staff: 'wand',  familiar: 'none', glow: 'none' },
    ],
  },

  // ----------------------------------------------------------------------
  // 2) TOONS — classic Saturday-morning cartoon archetypes
  // ----------------------------------------------------------------------
  toons: {
    id: 'toons',
    name: 'Saturday Morning Mayhem',
    tagline: 'No school today. Just cartoon chaos.',
    accent: '#ffb300',
    accentInk: '#1c1300',
    attributes: [
      { id: 'kind', label: 'creature kind', type: 'enum',
        values: ['warthog', 'sea-critter', 'cowboy', 'critter'],
        q: (v) => v === 'sea-critter' ? `Is your toon a sea creature?`
                 : v === 'cowboy' ? `Is your toon a cowboy?`
                 : `Is your toon a ${v}?` },
      { id: 'color', label: 'main colour', type: 'enum',
        values: ['yellow', 'pink', 'blue', 'brown'],
        q: (v) => `Is your toon mostly ${v}?` },
      { id: 'teeth', label: 'big buck teeth', type: 'bool',
        q: () => `Does your toon have big buck teeth?` },
      { id: 'headgear', label: 'headgear', type: 'enum',
        values: ['cowboy-hat', 'cap', 'bow', 'none'],
        q: (v) => v === 'none' ? `Is your toon bare-headed?`
                 : v === 'cowboy-hat' ? `Does your toon wear a cowboy hat?`
                 : `Does your toon wear a ${v}?` },
      { id: 'feet', label: 'footwear', type: 'enum',
        values: ['boots', 'sneakers', 'barefoot', 'flippers'],
        q: (v) => v === 'barefoot' ? `Is your toon barefoot?` : `Does your toon wear ${v}?` },
      { id: 'face', label: 'expression', type: 'enum',
        values: ['goofy', 'sneaky', 'happy', 'angry'],
        q: (v) => `Does your toon look ${v}?` },
    ],
    cast: [
      { id: 't01', name: 'Porkó',     ref: 'lovable goofy warthog',            kind: 'warthog',     color: 'brown',  teeth: true,  headgear: 'none',       feet: 'barefoot', face: 'goofy' },
      { id: 't02', name: 'Bubbert',   ref: 'happy square yellow sea sponge',   kind: 'sea-critter', color: 'yellow', teeth: true,  headgear: 'none',       feet: 'sneakers', face: 'happy' },
      { id: 't03', name: 'Quickdraw', ref: 'sharpshooting cowboy hero',        kind: 'cowboy',      color: 'blue',   teeth: false, headgear: 'cowboy-hat', feet: 'boots',    face: 'happy' },
      { id: 't04', name: 'Stareez',   ref: 'dim pink starfish buddy',          kind: 'sea-critter', color: 'pink',   teeth: false, headgear: 'none',       feet: 'barefoot', face: 'goofy' },
      { id: 't05', name: 'Bandit Bo', ref: 'sneaky cartoon bank robber',       kind: 'cowboy',      color: 'brown',  teeth: false, headgear: 'cowboy-hat', feet: 'boots',    face: 'sneaky' },
      { id: 't06', name: 'Sunny',     ref: 'cheery yellow chick critter',      kind: 'critter',     color: 'yellow', teeth: false, headgear: 'bow',        feet: 'barefoot', face: 'happy' },
      { id: 't07', name: 'Tuskan',    ref: 'grumpy big-tusked warthog',        kind: 'warthog',     color: 'brown',  teeth: true,  headgear: 'cap',        feet: 'boots',    face: 'angry' },
      { id: 't08', name: 'Squidly',   ref: 'cranky blue octopus neighbor',     kind: 'sea-critter', color: 'blue',   teeth: false, headgear: 'none',       feet: 'flippers', face: 'angry' },
      { id: 't09', name: 'Pearl',     ref: 'sweet pink seahorse girl',         kind: 'sea-critter', color: 'pink',   teeth: false, headgear: 'bow',        feet: 'flippers', face: 'happy' },
      { id: 't10', name: 'Rusty',     ref: 'goofy young cowpoke sidekick',     kind: 'cowboy',      color: 'yellow', teeth: true,  headgear: 'cowboy-hat', feet: 'boots',    face: 'goofy' },
      { id: 't11', name: 'Whiskers',  ref: 'sneaky alley-cat trickster',       kind: 'critter',     color: 'blue',   teeth: false, headgear: 'cap',        feet: 'sneakers', face: 'sneaky' },
      { id: 't12', name: 'Bonk',      ref: 'big dumb brown gorilla pal',       kind: 'critter',     color: 'brown',  teeth: false, headgear: 'none',       feet: 'barefoot', face: 'goofy' },
      { id: 't13', name: 'Daisy Mae', ref: 'spunky pink cowgirl',              kind: 'cowboy',      color: 'pink',   teeth: false, headgear: 'cowboy-hat', feet: 'boots',    face: 'happy' },
      { id: 't14', name: 'Gilbert',   ref: 'nerdy yellow fish in glasses',     kind: 'sea-critter', color: 'yellow', teeth: true,  headgear: 'none',       feet: 'flippers', face: 'goofy' },
      { id: 't15', name: 'Hambone',   ref: 'sneaky greedy pink piglet',        kind: 'warthog',     color: 'pink',   teeth: true,  headgear: 'cap',        feet: 'sneakers', face: 'sneaky' },
      { id: 't16', name: 'Scrappy',   ref: 'feisty little brown dog',          kind: 'critter',     color: 'brown',  teeth: false, headgear: 'bow',        feet: 'sneakers', face: 'angry' },
    ],
  },

  // ----------------------------------------------------------------------
  // 3) HEROES — superhero archetypes
  // ----------------------------------------------------------------------
  heroes: {
    id: 'heroes',
    name: 'The Justice Bureau',
    tagline: 'Capes filed in triplicate. Pick your champion.',
    accent: '#ef4444',
    accentInk: '#1a0606',
    attributes: [
      { id: 'suit', label: 'suit colour', type: 'enum',
        values: ['red', 'blue', 'green', 'gold'],
        q: (v) => `Does your hero wear a ${v} suit?` },
      { id: 'power', label: 'power source', type: 'enum',
        values: ['armor', 'strength', 'flight', 'gadgets'],
        q: (v) => v === 'strength' ? `Is your hero super-strong?`
                 : v === 'flight' ? `Can your hero fly?`
                 : `Does your hero rely on ${v}?` },
      { id: 'cape', label: 'cape', type: 'bool',
        q: () => `Does your hero wear a cape?` },
      { id: 'mask', label: 'mask style', type: 'enum',
        values: ['domino', 'full', 'helmet', 'none'],
        q: (v) => v === 'none' ? `Does your hero go without a mask?`
                 : v === 'domino' ? `Does your hero wear a small eye mask?`
                 : v === 'full' ? `Does your hero wear a full face mask?`
                 : `Does your hero wear a helmet?` },
      { id: 'emblem', label: 'chest emblem', type: 'enum',
        values: ['star', 'bolt', 'shield', 'none'],
        q: (v) => v === 'none' ? `Does your hero have no chest emblem?` : `Does your hero have a ${v} on their chest?` },
      { id: 'hair', label: 'hair colour', type: 'enum',
        values: ['black', 'blonde', 'red', 'hidden'],
        q: (v) => v === 'hidden' ? `Is your hero's hair fully hidden?` : `Does your hero have ${v} hair?` },
    ],
    cast: [
      { id: 'x01', name: 'Ironheart',   ref: 'armored flying tech hero in red and gold suit', suit: 'gold', power: 'armor',    cape: false, mask: 'helmet', emblem: 'bolt',   hair: 'hidden' },
      { id: 'x02', name: 'Lady Valor',  ref: 'warrior princess hero with tiara and gold cuffs', suit: 'red',  power: 'strength', cape: true,  mask: 'none',   emblem: 'star',   hair: 'black' },
      { id: 'x03', name: 'The Titan',   ref: 'huge raging green muscle hero',                  suit: 'green',power: 'strength', cape: false, mask: 'none',   emblem: 'none',   hair: 'black' },
      { id: 'x04', name: 'Skyfist',     ref: 'classic flying blue caped strongman',            suit: 'blue', power: 'flight',   cape: true,  mask: 'none',   emblem: 'shield', hair: 'black' },
      { id: 'x05', name: 'Nightwing',   ref: 'brooding gadget vigilante in dark suit',         suit: 'blue', power: 'gadgets',  cape: true,  mask: 'full',   emblem: 'none',   hair: 'hidden' },
      { id: 'x06', name: 'Captain Bolt',ref: 'fast red speedster hero',                        suit: 'red',  power: 'gadgets',  cape: false, mask: 'full',   emblem: 'bolt',   hair: 'hidden' },
      { id: 'x07', name: 'Goldguard',   ref: 'patriotic shield-bearing soldier hero',          suit: 'blue', power: 'strength', cape: false, mask: 'domino', emblem: 'star',   hair: 'blonde' },
      { id: 'x08', name: 'Verdant',     ref: 'plant-powered green nature heroine',             suit: 'green',power: 'gadgets',  cape: true,  mask: 'domino', emblem: 'none',   hair: 'red' },
      { id: 'x09', name: 'Solara',      ref: 'glowing golden flying sun heroine',              suit: 'gold', power: 'flight',   cape: true,  mask: 'none',   emblem: 'star',   hair: 'blonde' },
      { id: 'x10', name: 'Gearjaw',     ref: 'bulky armored gadget hero',                      suit: 'red',  power: 'armor',    cape: false, mask: 'helmet', emblem: 'shield', hair: 'hidden' },
      { id: 'x11', name: 'Mistral',     ref: 'wind-flying blue caped heroine',                 suit: 'blue', power: 'flight',   cape: true,  mask: 'domino', emblem: 'bolt',   hair: 'blonde' },
      { id: 'x12', name: 'Ember',       ref: 'fiery red-haired flame hero',                    suit: 'red',  power: 'flight',   cape: false, mask: 'none',   emblem: 'none',   hair: 'red' },
      { id: 'x13', name: 'Bulwark',     ref: 'rocky armored green tank hero',                  suit: 'green',power: 'armor',    cape: false, mask: 'helmet', emblem: 'shield', hair: 'hidden' },
      { id: 'x14', name: 'Quickfox',    ref: 'agile masked acrobat heroine',                   suit: 'gold', power: 'gadgets',  cape: false, mask: 'domino', emblem: 'bolt',   hair: 'red' },
      { id: 'x15', name: 'Atlas',       ref: 'golden caped flying strongman',                  suit: 'gold', power: 'strength', cape: true,  mask: 'none',   emblem: 'shield', hair: 'blonde' },
      { id: 'x16', name: 'Shade',       ref: 'stealthy dark caped martial hero',               suit: 'green',power: 'gadgets',  cape: true,  mask: 'full',   emblem: 'star',   hair: 'hidden' },
    ],
  },

  // ----------------------------------------------------------------------
  // 4) VILLAINS — dark-lord / supervillain archetypes
  // ----------------------------------------------------------------------
  villains: {
    id: 'villains',
    name: 'The Legion of Gloom',
    tagline: 'Every monologue. None of the mercy.',
    accent: '#22d3ee',
    accentInk: '#03161a',
    attributes: [
      { id: 'skin', label: 'skin tone', type: 'enum',
        values: ['pale', 'green', 'grey', 'red'],
        q: (v) => `Is your villain ${v}-skinned?` },
      { id: 'hair', label: 'hair', type: 'enum',
        values: ['bald', 'wild', 'slick', 'horned-helm'],
        q: (v) => v === 'bald' ? `Is your villain bald?`
                 : v === 'horned-helm' ? `Does your villain wear a horned helmet?`
                 : `Does your villain have ${v} hair?` },
      { id: 'cape', label: 'cape or cloak', type: 'bool',
        q: () => `Does your villain wear a cape or cloak?` },
      { id: 'weapon', label: 'signature weapon', type: 'enum',
        values: ['staff', 'claws', 'blaster', 'none'],
        q: (v) => v === 'none' ? `Does your villain carry no weapon?` : `Does your villain wield ${v === 'claws' ? 'claws' : 'a ' + v}?` },
      { id: 'scar', label: 'face scar', type: 'bool',
        q: () => `Does your villain have a face scar?` },
      { id: 'grin', label: 'expression', type: 'enum',
        values: ['sneer', 'grin', 'scowl', 'cold'],
        q: (v) => v === 'cold' ? `Does your villain look cold and emotionless?` : `Does your villain ${v === 'sneer' ? 'sneer' : v === 'grin' ? 'grin wickedly' : 'scowl'}?` },
    ],
    cast: [
      { id: 'v01', name: 'Lord Vesper', ref: 'pale snake-faced bald dark lord',          skin: 'pale',  hair: 'bald',        cape: true,  weapon: 'staff',   scar: false, grin: 'cold' },
      { id: 'v02', name: 'Skullface',   ref: 'grey skull-masked overlord',               skin: 'grey',  hair: 'horned-helm', cape: true,  weapon: 'staff',   scar: false, grin: 'scowl' },
      { id: 'v03', name: 'Grinjaw',     ref: 'pale grinning clown-anarchist villain',    skin: 'pale',  hair: 'wild',        cape: false, weapon: 'none',    scar: true,  grin: 'grin' },
      { id: 'v04', name: 'Madame Venom',ref: 'green-skinned glamorous poison sorceress', skin: 'green', hair: 'slick',       cape: true,  weapon: 'staff',   scar: false, grin: 'sneer' },
      { id: 'v05', name: 'Brute Crank', ref: 'huge red armored brute villain',           skin: 'red',   hair: 'bald',        cape: false, weapon: 'claws',   scar: true,  grin: 'scowl' },
      { id: 'v06', name: 'Doctor Hex',  ref: 'green masked mad-scientist villain',       skin: 'green', hair: 'slick',       cape: true,  weapon: 'blaster', scar: false, grin: 'cold' },
      { id: 'v07', name: 'Razorback',   ref: 'grey clawed mutant brawler',               skin: 'grey',  hair: 'wild',        cape: false, weapon: 'claws',   scar: true,  grin: 'sneer' },
      { id: 'v08', name: 'The Baroness',ref: 'pale slick-haired cold aristocrat villain',skin: 'pale',  hair: 'slick',       cape: true,  weapon: 'none',    scar: false, grin: 'cold' },
      { id: 'v09', name: 'Magmar',      ref: 'red fiery horned demon lord',              skin: 'red',   hair: 'horned-helm', cape: true,  weapon: 'claws',   scar: false, grin: 'grin' },
      { id: 'v10', name: 'Zilch',       ref: 'grey sneaky goblin henchman',              skin: 'grey',  hair: 'wild',        cape: false, weapon: 'blaster', scar: false, grin: 'sneer' },
      { id: 'v11', name: 'Nightshade',  ref: 'pale gothic caped vampire villain',        skin: 'pale',  hair: 'slick',       cape: true,  weapon: 'none',    scar: false, grin: 'sneer' },
      { id: 'v12', name: 'Krang Prime', ref: 'green brain-faced alien overlord',         skin: 'green', hair: 'bald',        cape: false, weapon: 'blaster', scar: false, grin: 'cold' },
      { id: 'v13', name: 'Scorchscar',  ref: 'red half-burned scarred warlord',          skin: 'red',   hair: 'slick',       cape: true,  weapon: 'staff',   scar: true,  grin: 'scowl' },
      { id: 'v14', name: 'Bonelord',    ref: 'pale skeletal horned necro-king',          skin: 'pale',  hair: 'horned-helm', cape: true,  weapon: 'staff',   scar: false, grin: 'grin' },
      { id: 'v15', name: 'Sludge',      ref: 'green oozing toxic blob villain',          skin: 'green', hair: 'bald',        cape: false, weapon: 'claws',   scar: false, grin: 'grin' },
      { id: 'v16', name: 'General Iron',ref: 'grey horned-helm armored war general',     skin: 'grey',  hair: 'horned-helm', cape: false, weapon: 'blaster', scar: true,  grin: 'scowl' },
    ],
  },
};

export const DECK_LIST = Object.values(DECKS);
