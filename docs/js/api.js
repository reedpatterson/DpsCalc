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
    userDmgLow:     0,
    userDmgHigh:    0,
    userDotDmgLow:  0,
    userDotDmgHigh: 0,
    maxTargets:       s.targetType === 'st' ? 1 : (s.maxTargetsApi || 4),
    userTriggerCount:     s.triggerCount     ? (s.triggerCount)     : null,
    userTriggerRatePerMin: s.triggerRatePerMin ? (s.triggerRatePerMin) : null,
    aaPoints:         0,
  }));
}
