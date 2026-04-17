'use strict';

const API_BASE = 'https://census.daybreakgames.com/s:reedpatterson/get/eq2';
const LEVEL_CAP = 80;

// classKey must match the lowercase key used in the Census spell `classes` object.
// classTree and subclassTree are alternateadvancement collection IDs.
const CLASSES = {
  assassin:     { label: 'Assassin',      classTree: 19, subclassTree: 7  },
  berserker:    { label: 'Berserker',     classTree: 14, subclassTree: 12 },
  brigand:      { label: 'Brigand',       classTree: 21, subclassTree: 8  },
  bruiser:      { label: 'Bruiser',       classTree: 18, subclassTree: 2  },
  coercer:      { label: 'Coercer',       classTree: 35, subclassTree: 6  },
  conjuror:     { label: 'Conjuror',      classTree: 33, subclassTree: 11 },
  defiler:      { label: 'Defiler',       classTree: 30, subclassTree: 9  },
  dirge:        { label: 'Dirge',         classTree: 23, subclassTree: 1  },
  fury:         { label: 'Fury',          classTree: 28, subclassTree: 5  },
  guardian:     { label: 'Guardian',      classTree: 13, subclassTree: 12 },
  illusionist:  { label: 'Illusionist',   classTree: 36, subclassTree: 6  },
  inquisitor:   { label: 'Inquisitor',    classTree: 26, subclassTree: 3  },
  monk:         { label: 'Monk',          classTree: 17, subclassTree: 2  },
  mystic:       { label: 'Mystic',        classTree: 29, subclassTree: 9  },
  necromancer:  { label: 'Necromancer',   classTree: 34, subclassTree: 11 },
  paladin:      { label: 'Paladin',       classTree: 15, subclassTree: 4  },
  ranger:       { label: 'Ranger',        classTree: 20, subclassTree: 7  },
  shadowknight: { label: 'Shadow Knight', classTree: 16, subclassTree: 4  },
  swashbuckler: { label: 'Swashbuckler',  classTree: 22, subclassTree: 8  },
  templar:      { label: 'Templar',       classTree: 25, subclassTree: 3  },
  troubador:    { label: 'Troubador',     classTree: 24, subclassTree: 1  },
  warden:       { label: 'Warden',        classTree: 27, subclassTree: 5  },
  warlock:      { label: 'Warlock',       classTree: 32, subclassTree: 10 },
  wizard:       { label: 'Wizard',        classTree: 31, subclassTree: 10 },
};

// AA node classifications belonging to post-RoK expansions — exclude these.
const EXCLUDE_AA_CLASSIFICATIONS = ['sentinel\'s fate', 'sentinel\'s fate attributes'];
