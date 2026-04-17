'use strict';

// Loads pre-fetched spell data from data/spells/{class}.json.
// To refresh the data, run: node scripts/fetch-spells.js [className]

async function loadClassData(classKey, onProgress) {
  onProgress('Loading spell data…');
  const resp = await fetch(`data/spells/${classKey}.json`);
  if (!resp.ok) {
    throw new Error(
      `No data found for ${CLASSES[classKey].label}. ` +
      `Run: node scripts/fetch-spells.js ${classKey}`
    );
  }
  const spells = await resp.json();
  onProgress(`Loaded ${spells.length} spells.`);

  // Attach runtime UI state that isn't stored in the static JSON.
  return spells.map(s => ({
    ...s,
    enabled:        true,
    userDmgLow:     s.dmgLow,
    userDmgHigh:    s.dmgHigh,
    userDotDmgLow:  s.isDot ? s.dmgLow  : 0,
    userDotDmgHigh: s.isDot ? s.dmgHigh : 0,
    maxTargets:     s.targetType === 'st' ? 1 : (s.maxTargetsApi || 4),
    aaPoints:       0,
    castOverride:   null,
    recastOverride: null,
  }));
}
