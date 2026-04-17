'use strict';

const API_BASE = 'https://census.daybreakgames.com/s:reedpatterson/get/eq2';
const LEVEL_CAP = 80;

// classKey must match the lowercase key used in the Census spell `classes` object.
// classTree and subclassTree are alternateadvancement collection IDs.
const CLASSES = {
  assassin:     { label: 'Assassin',      classTree: 19, subclassTree: 7,  hue: 0   },
  berserker:    { label: 'Berserker',     classTree: 14, subclassTree: 12, hue: 14  },
  brigand:      { label: 'Brigand',       classTree: 21, subclassTree: 8,  hue: 40  },
  bruiser:      { label: 'Bruiser',       classTree: 18, subclassTree: 2,  hue: 25  },
  coercer:      { label: 'Coercer',       classTree: 35, subclassTree: 6,  hue: 280 },
  conjuror:     { label: 'Conjuror',      classTree: 33, subclassTree: 11, hue: 28  },
  defiler:      { label: 'Defiler',       classTree: 30, subclassTree: 9,  hue: 155 },
  dirge:        { label: 'Dirge',         classTree: 23, subclassTree: 1,  hue: 232 },
  fury:         { label: 'Fury',          classTree: 28, subclassTree: 5,  hue: 118 },
  guardian:     { label: 'Guardian',      classTree: 13, subclassTree: 12, hue: 207 },
  illusionist:  { label: 'Illusionist',   classTree: 36, subclassTree: 6,  hue: 310 },
  inquisitor:   { label: 'Inquisitor',    classTree: 26, subclassTree: 3,  hue: 5   },
  monk:         { label: 'Monk',          classTree: 17, subclassTree: 2,  hue: 150 },
  mystic:       { label: 'Mystic',        classTree: 29, subclassTree: 9,  hue: 258 },
  necromancer:  { label: 'Necromancer',   classTree: 34, subclassTree: 11, hue: 138 },
  paladin:      { label: 'Paladin',       classTree: 15, subclassTree: 4,  hue: 48  },
  ranger:       { label: 'Ranger',        classTree: 20, subclassTree: 7,  hue: 128 },
  shadowknight: { label: 'Shadow Knight', classTree: 16, subclassTree: 4,  hue: 345 },
  swashbuckler: { label: 'Swashbuckler',  classTree: 22, subclassTree: 8,  hue: 188 },
  templar:      { label: 'Templar',       classTree: 25, subclassTree: 3,  hue: 52  },
  troubador:    { label: 'Troubador',     classTree: 24, subclassTree: 1,  hue: 44  },
  warden:       { label: 'Warden',        classTree: 27, subclassTree: 5,  hue: 124 },
  warlock:      { label: 'Warlock',       classTree: 32, subclassTree: 10, hue: 270 },
  wizard:       { label: 'Wizard',        classTree: 31, subclassTree: 10, hue: 200 },
};

// AA node classifications belonging to post-RoK expansions — exclude these.
const EXCLUDE_AA_CLASSIFICATIONS = ['sentinel\'s fate', 'sentinel\'s fate attributes'];
