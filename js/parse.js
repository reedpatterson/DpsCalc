'use strict';

// ── effect_list text parsing ───────────────────────────────────────────────
// All functions accept a raw Census spell record and return derived values.

function effectTexts(spell) {
  return (spell.effect_list || []).map(e => e.description || '');
}

// Returns 'st' | 'encounter' | 'aoe'
function detectTargetType(spell) {
  if (spell.target_type === 'self') {
    // Caster-centered AoE (Firestorm, etc.) — confirm via text.
    for (const t of effectTexts(spell)) {
      if (/area of effect/i.test(t)) return { targetType: 'aoe' };
    }
    // target_type=self without AoE text is likely a self-buff; treat as ST
    // for DPS purposes (won't contribute damage anyway).
    return { targetType: 'aoe' };
  }

  for (const t of effectTexts(spell)) {
    if (/target encounter/i.test(t)) return { targetType: 'encounter' };
    if (/area of effect/i.test(t))   return { targetType: 'aoe' };
  }

  return { targetType: 'st' };
}

// Returns { isTrigger, triggerCount, triggerRatePerMin }.
// Fixed-count:  "Grants a total of X triggers" — multiplied across all indentation levels.
// Rate-based:   "Triggers about X.X times per minute" — stored as triggerRatePerMin.
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
    triggerCount:     foundCount        ? product          : null,
    triggerRatePerMin: triggerRatePerMin !== null ? triggerRatePerMin : null,
  };
}

// Returns { isDot, dotInterval } where dotInterval is in seconds.
function detectDot(spell) {
  for (const t of effectTexts(spell)) {
    const m = t.match(/every\s+([\d.]+)\s+seconds?/i);
    if (m) return { isDot: true, dotInterval: parseFloat(m[1]) };
  }
  return { isDot: false, dotInterval: null };
}

// Returns { dmgLow, dmgHigh } parsed from the first damage description.
// Strips locale-formatted numbers (commas). Returns {0,0} if unparseable.
function parseBaseDamage(spell) {
  for (const t of effectTexts(spell)) {
    const m = t.match(/[Ii]nflicts?\s+([\d,]+)\s*[-–]\s*([\d,]+)/);
    if (m) {
      return {
        dmgLow:  parseInt(m[1].replace(/,/g, ''), 10),
        dmgHigh: parseInt(m[2].replace(/,/g, ''), 10),
      };
    }
  }
  return { dmgLow: 0, dmgHigh: 0 };
}

// Parses an "Enhance: X" pcinnate spell's effect_list for per-tier reductions.
// Returns { castRedPerTier, recastRedPerTier } in seconds.
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

// ── DPS calculation ────────────────────────────────────────────────────────

function calcSpellDPS(spell, fightInfo, stats) {
  const { castSpeed, reuseSpeed, recoverySpeed } = stats;
  const { fightDuration, totalMobs, linkedMobs } = fightInfo;

  // Start from base API times, apply AA reduction, then user overrides.
  let baseCast   = spell.castSecs;
  let baseRecast = spell.recastSecs;

  if (spell.enhanceAA && spell.aaPoints > 0) {
    baseCast   = Math.max(0, baseCast   - spell.enhanceAA.castRedPerTier   * spell.aaPoints);
    baseRecast = Math.max(0, baseRecast - spell.enhanceAA.recastRedPerTier * spell.aaPoints);
  }

  // Apply character stats: effective = base * 100 / (100 + stat%)
  // Minimum cast time 0.5 s (EQ2 hard floor).
  const effectiveCast     = Math.max(baseCast, 0.5) * 100 / (100 + castSpeed);
  const effectiveRecast   = Math.max(baseRecast, 0) * 100 / (100 + reuseSpeed);
  const effectiveRecovery = 0.5 * 100 / (100 + recoverySpeed);
  const cycleSecs = effectiveCast + effectiveRecovery;

  if (cycleSecs <= 0) return null;

  // Damage per cast.
  const avgInitDmg = (spell.userDmgLow + spell.userDmgHigh) / 2;
  let avgDotDmg = 0;

  if (spell.isDot && spell.dotInterval && spell.dotInterval > 0) {
    const ticksPerCast = Math.floor(spell.durationSecs / spell.dotInterval);
    avgDotDmg = ((spell.userDotDmgLow || 0) + (spell.userDotDmgHigh || 0)) / 2 * ticksPerCast;
  }

  // Targets hit.
  let targetsHit = 1;
  if (spell.targetType === 'encounter') {
    targetsHit = Math.min(spell.maxTargets || 1, linkedMobs);
  } else if (spell.targetType === 'aoe') {
    targetsHit = Math.min(spell.maxTargets || 1, totalMobs);
  }

  // Rate-based procs (e.g. "Triggers about 4.0 times per minute") bypass the
  // cast-cycle model entirely — DPS is simply damage × rate.
  if (spell.triggerRatePerMin && spell.userTriggerRatePerMin) {
    const rate = spell.userTriggerRatePerMin / 60;
    const avgDmg = (avgInitDmg + avgDotDmg) * targetsHit;
    const dps = avgDmg * rate;
    return { effectiveCast: 0, effectiveRecast: 0, effectiveRecovery: 0, cycleSecs: 0, targetsHit, avgDmgPerCast: avgDmg, dps };
  }

  const triggerCount  = spell.isTrigger ? (spell.userTriggerCount || 1) : 1;
  const avgDmgPerCast = (avgInitDmg + avgDotDmg) * targetsHit * triggerCount;
  const dps = avgDmgPerCast / cycleSecs;

  return { effectiveCast, effectiveRecast, effectiveRecovery, cycleSecs, targetsHit, avgDmgPerCast, dps };
}
