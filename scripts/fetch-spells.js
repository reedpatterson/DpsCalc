#!/usr/bin/env node
/**
 * Fetches spell data from the EQ2 Census API for all 24 classes (levels 1-80)
 * and writes one processed JSON file per class to data/spells/{class}.json.
 *
 * Usage:
 *   node scripts/fetch-spells.js            # fetch all classes
 *   node scripts/fetch-spells.js wizard     # fetch a single class
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'data', 'spells');

const API_BASE = 'https://census.daybreakgames.com/s:reedpatterson/get/eq2';
const LEVEL_CAP = 80;
const LEVEL_MIN = 51; // exclude pre-51 spells — mostly obsolete early-game versions

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

const EXCLUDE_AA_CLASSIFICATIONS = ["sentinel's fate", "sentinel's fate attributes"];

// ── API helpers ────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API ${resp.status}: ${url}`);
  return resp.json();
}

async function fetchBaseSpells(classKey) {
  const fields = 'name,level,target_type,cast_secs_hundredths,recast_secs,duration,effect_list,max_targets,aoe_radius_meters,icon';
  const spells = [];
  let start = 0;
  const limit = 500;

  while (true) {
    const data = await apiFetch(
      `/spell?given_by=class&c:has=classes.${classKey}&level=[${LEVEL_CAP}` +
      `&beneficial=0&c:limit=${limit}&c:start=${start}&c:show=${fields}&c:sort=level:1`
    );
    const batch = data.spell_list || [];
    spells.push(...batch);
    if (batch.length < limit) break;
    start += limit;
  }

  // Deduplicate by "base spell name" (strip Roman numeral suffix), keeping
  // the highest-level entry per spell line (e.g. Incinerate XIII wins over I–XII).
  const byBase = new Map();
  for (const s of spells) {
    const base = s.name.replace(/\s+(XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)$/i, '').trim();
    const ex = byBase.get(base);
    if (!ex || s.level > ex.level) byBase.set(base, s);
  }
  return [...byBase.values()]
    .filter(s => s.level >= LEVEL_MIN)
    .sort((a, b) => a.level - b.level);
}

async function fetchAATreeNodes(treeId) {
  const fields = [
    'alternateadvancementnode_list.name',
    'alternateadvancementnode_list.spellcrc',
    'alternateadvancementnode_list.classification',
    'alternateadvancementnode_list.maxtier',
  ].join(',');
  const data = await apiFetch(`/alternateadvancement/${treeId}?c:show=${fields}`);
  const list = data.alternateadvancement_list;
  const record = list ? list[0] : data;
  const nodes = record ? (record.alternateadvancementnode_list || []) : [];
  return nodes.filter(n => {
    const cls = (n.classification || '').toLowerCase();
    return !EXCLUDE_AA_CLASSIFICATIONS.some(excl => cls.includes(excl));
  });
}

async function fetchSpellsByCRCs(crcs) {
  if (!crcs.length) return [];
  const fields = 'name,level,type,target_type,cast_secs_hundredths,recast_secs,duration,effect_list,beneficial,tier,given_by,max_targets,aoe_radius_meters,icon';
  return Promise.all(
    crcs.map(async crc => {
      try {
        const data = await apiFetch(`/spell?crc=${crc}&level=[${LEVEL_CAP}&c:limit=20&c:show=${fields}`);
        return { crc, spells: data.spell_list || [] };
      } catch {
        return { crc, spells: [] };
      }
    })
  );
}

// ── Parsing ────────────────────────────────────────────────────────────────

function effectTexts(spell) {
  return (spell.effect_list || []).map(e => e.description || '');
}

function detectTargetType(spell) {
  if (spell.target_type === 'self') return 'aoe';
  for (const t of effectTexts(spell)) {
    if (/target encounter/i.test(t)) return 'encounter';
    if (/area of effect/i.test(t))   return 'aoe';
  }
  return 'st';
}

function detectTrigger(spell) {
  let product        = 1;
  let foundCount     = false;
  let triggerRatePerMin = null;

  for (const t of effectTexts(spell)) {
    let m;
    m = t.match(/grants?\s+a\s+total\s+of\s+(\d+)\s+triggers?/i);
    if (m) { product *= parseInt(m[1], 10); foundCount = true; continue; }

    m = t.match(/triggers?\s+about\s+([\d.]+)\s+times?\s+per\s+minute/i);
    if (m) { triggerRatePerMin = parseFloat(m[1]); }
  }

  const isTrigger = foundCount || triggerRatePerMin !== null;
  return {
    isTrigger,
    triggerCount:      foundCount           ? product          : null,
    triggerRatePerMin: triggerRatePerMin !== null ? triggerRatePerMin : null,
  };
}

function detectDot(spell) {
  for (const t of effectTexts(spell)) {
    const m = t.match(/every\s+([\d.]+)\s+seconds?/i);
    if (m) return { isDot: true, dotInterval: parseFloat(m[1]) };
  }
  return { isDot: false, dotInterval: null };
}

function parseBaseDamage(spell) {
  for (const t of effectTexts(spell)) {
    const m = t.match(/[Ii]nflicts?\s+([\d,]+)\s*[-–]\s*([\d,]+)/);
    if (m) return {
      dmgLow:  parseInt(m[1].replace(/,/g, ''), 10),
      dmgHigh: parseInt(m[2].replace(/,/g, ''), 10),
    };
  }
  return { dmgLow: 0, dmgHigh: 0 };
}

function parseEnhanceAA(spell) {
  let castRedPerTier = 0;
  let recastRedPerTier = 0;
  for (const t of effectTexts(spell)) {
    let m;
    m = t.match(/[Ii]mproves?\s+casting\s+speed\s+by\s+([\d.]+)\s+seconds?/i);
    if (m) { castRedPerTier = parseFloat(m[1]); continue; }
    m = t.match(/[Rr]educes?\s+cast(?:ing)?\s+(?:time|speed)\s+by\s+([\d.]+)\s+seconds?/i);
    if (m) { castRedPerTier = parseFloat(m[1]); continue; }
    m = t.match(/[Rr]educes?\s+recast\s+(?:time|speed)\s+by\s+([\d.]+)\s+seconds?/i);
    if (m) { recastRedPerTier = parseFloat(m[1]); continue; }
    m = t.match(/[Ii]mproves?\s+reuse\s+speed\s+by\s+([\d.]+)\s+seconds?/i);
    if (m) { recastRedPerTier = parseFloat(m[1]); continue; }
  }
  return { castRedPerTier, recastRedPerTier };
}

function processRawSpell(raw, isAA) {
  const castSecs     = (raw.cast_secs_hundredths || 0) / 100;
  const recastSecs   = raw.recast_secs || 0;
  const durationSecs = ((raw.duration || {}).min_sec_tenths || 0) / 10;
  const targetType   = detectTargetType(raw);
  const { isDot, dotInterval }       = detectDot(raw);
  const { isTrigger, triggerCount, triggerRatePerMin } = detectTrigger(raw);
  const { dmgLow, dmgHigh } = parseBaseDamage(raw);

  return {
    uid: String(raw.id || raw.name),
    name: raw.name || '(unknown)',
    level: raw.level || 0,
    castSecs,
    recastSecs,
    durationSecs,
    targetType,
    isDot,
    dotInterval,
    isTrigger,
    triggerCount,
    triggerRatePerMin,
    dmgLow,
    dmgHigh,
    maxTargetsApi: raw.max_targets || null,
    aoeRadius: raw.aoe_radius_meters || null,
    // Icon fields stored for future use — Census serving endpoint for EQ2 icons
    // appears partially deprecated. When a reliable URL pattern is confirmed, use
    // icon.id to construct the image src (e.g. icons.attachment owner_id=icon.id &category=spell).
    // Fallback: EQ2 Wiki (eq2.fandom.com) or self-hosted .dds extracts from game client.
    icon: raw.icon ? {
      id:         raw.icon.id         ?? null,
      backdrop:   raw.icon.backdrop   ?? null,
      heroic_op:  raw.icon.icon_heroic_op ?? null,
    } : null,
    isAA,
    enhanceAA: null,
  };
}

// ── Build spell list ───────────────────────────────────────────────────────

function buildSpellList(baseSpells, nodeByCrc, crcResults) {
  const enhanceAAs = new Map();
  const combatAASpells = [];

  for (const { crc, spells } of crcResults) {
    const node = nodeByCrc.get(crc);
    if (!node || !spells.length) continue;

    const combat = spells.filter(s => s.beneficial === 0 && (s.type === 'spells' || s.type === 'arts'));
    if (combat.length) {
      const best = combat.sort((a, b) => b.level - a.level)[0];
      combatAASpells.push(processRawSpell(best, true));
      continue;
    }

    const enh = spells.filter(s => s.beneficial === 1 && s.type === 'pcinnates');
    if (enh.length) {
      // Pick the highest-level tier=1 entry (level=0 stubs have generic text; level=70 has actual values).
      const tier1s = enh.filter(s => s.tier === 1).sort((a, b) => b.level - a.level);
      const ref = tier1s[0] || enh[0];
      const parsed = parseEnhanceAA(ref);
      const targetName = (ref.name || '').replace(/^Enhance:\s*/i, '').trim().toLowerCase();
      enhanceAAs.set(targetName, {
        ...parsed,
        maxtier: node.maxtier || 5,
        description: (ref.effect_list || []).map(e => e.description).join(' | '),
      });
    }
  }

  const allSpells = [
    ...baseSpells.map(s => processRawSpell(s, false)),
    ...combatAASpells,
  ];

  for (const spell of allSpells) {
    const spellBaseName = spell.name.replace(/\s+(XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)$/i, '').trim().toLowerCase();
    const enh = enhanceAAs.get(spell.name.toLowerCase()) || enhanceAAs.get(spellBaseName);
    if (enh) spell.enhanceAA = enh;
  }

  return allSpells;
}

// ── Per-class fetch ────────────────────────────────────────────────────────

async function fetchClass(classKey) {
  const def = CLASSES[classKey];
  process.stdout.write(`  ${def.label}: base spells… `);
  const baseSpells = await fetchBaseSpells(classKey);
  process.stdout.write(`${baseSpells.length} spells, AA trees… `);

  const [classNodes, subNodes] = await Promise.all([
    fetchAATreeNodes(def.classTree),
    fetchAATreeNodes(def.subclassTree),
  ]);

  const nodeByCrc = new Map();
  for (const n of [...classNodes, ...subNodes]) {
    if (n.spellcrc && !nodeByCrc.has(n.spellcrc)) nodeByCrc.set(n.spellcrc, n);
  }

  process.stdout.write(`${nodeByCrc.size} CRCs… `);
  const crcResults = await fetchSpellsByCRCs([...nodeByCrc.keys()]);

  const spells = buildSpellList(baseSpells, nodeByCrc, crcResults);
  process.stdout.write(`done (${spells.length} total)\n`);
  return spells;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const target = process.argv[2];
  const keys = target ? [target] : Object.keys(CLASSES);

  for (const key of keys) {
    if (!CLASSES[key]) {
      console.error(`Unknown class: ${key}. Valid: ${Object.keys(CLASSES).join(', ')}`);
      process.exit(1);
    }
    const spells = await fetchClass(key);
    const outPath = join(OUT_DIR, `${key}.json`);
    writeFileSync(outPath, JSON.stringify(spells, null, 2));
  }

  console.log('\nDone. Files written to data/spells/');
}

main().catch(err => { console.error(err); process.exit(1); });
