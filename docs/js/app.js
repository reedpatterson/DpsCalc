'use strict';

// ── State ──────────────────────────────────────────────────────────────────

let spells = [];
let currentClass = null;

// ── localStorage helpers ───────────────────────────────────────────────────

const LS_STATS  = key => `dpscalc_stats_${key}`;
const LS_FIGHT  = 'dpscalc_fight';
const LS_SPELLS = key => `dpscalc_spells_${key}`;

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function saveStats() {
  if (!currentClass) return;
  lsSet(LS_STATS(currentClass), {
    castSpeed:     document.getElementById('castSpeed').value,
    reuseSpeed:    document.getElementById('reuseSpeed').value,
    recoverySpeed: document.getElementById('recoverySpeed').value,
  });
}

function loadStats(classKey) {
  const saved = lsGet(LS_STATS(classKey));
  if (!saved) return;
  if (saved.castSpeed     != null) document.getElementById('castSpeed').value     = saved.castSpeed;
  if (saved.reuseSpeed    != null) document.getElementById('reuseSpeed').value    = saved.reuseSpeed;
  if (saved.recoverySpeed != null) document.getElementById('recoverySpeed').value = saved.recoverySpeed;
}

function saveFight() {
  lsSet(LS_FIGHT, {
    fightDuration: document.getElementById('fightDuration').value,
    totalMobs:     document.getElementById('totalMobs').value,
    linkedMobs:    document.getElementById('linkedMobs').value,
  });
}

function loadFight() {
  const saved = lsGet(LS_FIGHT);
  if (!saved) return;
  if (saved.fightDuration != null) document.getElementById('fightDuration').value = saved.fightDuration;
  if (saved.totalMobs     != null) document.getElementById('totalMobs').value     = saved.totalMobs;
  if (saved.linkedMobs    != null) document.getElementById('linkedMobs').value    = saved.linkedMobs;
}

function saveSpells() {
  if (!currentClass) return;
  const state = {};
  for (const s of spells) {
    state[s.uid] = {
      enabled:               s.enabled,
      castSecs:              s.castSecs,
      recastSecs:            s.recastSecs,
      userDmgLow:            s.userDmgLow,
      userDmgHigh:           s.userDmgHigh,
      userDotDmgLow:         s.userDotDmgLow,
      userDotDmgHigh:        s.userDotDmgHigh,
      maxTargets:            s.maxTargets,
      userTriggerCount:      s.userTriggerCount,
      userTriggerRatePerMin: s.userTriggerRatePerMin,
      aaPoints:              s.aaPoints,
    };
  }
  lsSet(LS_SPELLS(currentClass), state);
}

function restoreSpells(classKey) {
  const saved = lsGet(LS_SPELLS(classKey));
  if (!saved) return;
  for (const s of spells) {
    const st = saved[s.uid];
    if (!st) continue;
    if (st.enabled               != null) s.enabled               = st.enabled;
    if (st.castSecs              != null) s.castSecs              = st.castSecs;
    if (st.recastSecs            != null) s.recastSecs            = st.recastSecs;
    if (st.userDmgLow            != null) s.userDmgLow            = st.userDmgLow;
    if (st.userDmgHigh           != null) s.userDmgHigh           = st.userDmgHigh;
    if (st.userDotDmgLow         != null) s.userDotDmgLow         = st.userDotDmgLow;
    if (st.userDotDmgHigh        != null) s.userDotDmgHigh        = st.userDotDmgHigh;
    if (st.maxTargets            != null) s.maxTargets            = st.maxTargets;
    if (st.userTriggerCount      != null) s.userTriggerCount      = st.userTriggerCount;
    if (st.userTriggerRatePerMin != null) s.userTriggerRatePerMin = st.userTriggerRatePerMin;
    if (st.aaPoints              != null) s.aaPoints              = st.aaPoints;
  }
}

// ── Class theme ────────────────────────────────────────────────────────────

function applyClassTheme(classKey) {
  const hue = CLASSES[classKey]?.hue ?? 210;
  document.documentElement.style.setProperty('--hue', hue);
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  populateClassSelect();
  loadFight();
  bindEvents();
});

function populateClassSelect() {
  const sel = document.getElementById('classSelect');
  Object.entries(CLASSES)
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, cls]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cls.label;
      sel.appendChild(opt);
    });
}

// ── Event bindings ─────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('classSelect').addEventListener('change', e => {
    if (e.target.value) onLoadSpells();
  });

  document.getElementById('calcBtn').addEventListener('click', onCalculate);

  document.getElementById('enableAllBtn').addEventListener('click', () => setAllEnabled(true));
  document.getElementById('disableAllBtn').addEventListener('click', () => setAllEnabled(false));

  document.getElementById('spellSearch').addEventListener('input', e => {
    filterSpellRows(e.target.value.trim().toLowerCase());
  });

  ['castSpeed', 'reuseSpeed', 'recoverySpeed'].forEach(id =>
    document.getElementById(id).addEventListener('input', saveStats)
  );

  ['fightDuration', 'totalMobs', 'linkedMobs'].forEach(id =>
    document.getElementById(id).addEventListener('input', saveFight)
  );

  document.getElementById('spellTableBody').addEventListener('change', onSpellFieldChange);
  document.getElementById('spellTableBody').addEventListener('input', onSpellFieldChange);
}

// ── Load spells ────────────────────────────────────────────────────────────

async function onLoadSpells() {
  const classKey = document.getElementById('classSelect').value;
  if (!classKey) return;

  currentClass = classKey;
  applyClassTheme(classKey);
  showState('loading');
  document.getElementById('calcBtn').disabled = true;
  document.getElementById('resultsSection').classList.add('d-none');
  document.getElementById('loadStatus').className = 'load-status';

  try {
    spells = await loadClassData(classKey, msg => {
      document.getElementById('loadingMsg').textContent = msg;
    });

    if (!spells.length) {
      showStatus(`No combat spells found for ${CLASSES[classKey].label}.`, 'warn');
      showState('empty');
      return;
    }

    restoreSpells(classKey);
    renderSpellTable();
    loadStats(classKey);
    showState('spells');
    showStatus(`Loaded ${spells.length} spells for ${CLASSES[classKey].label}.`, 'ok');
    document.getElementById('spellSectionTitle').textContent =
      `${CLASSES[classKey].label} Spells (${spells.length})`;
    document.getElementById('calcBtn').disabled = false;

  } catch (err) {
    console.error(err);
    showStatus(`Error: ${err.message}`, 'err');
    showState('empty');
  }
}

function showState(state) {
  document.getElementById('emptyState').classList.toggle('d-none',   state !== 'empty');
  document.getElementById('loadingState').classList.toggle('d-none', state !== 'loading');
  document.getElementById('spellSection').classList.toggle('d-none', state !== 'spells');
}

function showStatus(msg, level) {
  const el = document.getElementById('loadStatus');
  el.className = `load-status ${level}`;
  el.textContent = msg;
}

// ── Render spell table ─────────────────────────────────────────────────────

const TYPE_BADGES = {
  st:        '<span class="tbadge tbadge-st">ST</span>',
  encounter: '<span class="tbadge tbadge-enc">ENC</span>',
  aoe:       '<span class="tbadge tbadge-aoe">AoE</span>',
};

function renderSpellTable() {
  const tbody = document.getElementById('spellTableBody');
  tbody.innerHTML = '';

  spells.forEach((spell, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.idx  = idx;
    tr.dataset.name = spell.name.toLowerCase();
    if (!spell.enabled) tr.classList.add('row-disabled');

    const aaCell = spell.enhanceAA
      ? `<input type="number" class="tbl-input num-xs" data-idx="${idx}" data-field="aaPoints"
               value="${spell.aaPoints}" min="0" max="${spell.enhanceAA.maxtier}"
               title="${escHtml(spell.enhanceAA.description)}">`
      : '<span class="td-muted">—</span>';

    tr.innerHTML = `
      <td><input type="checkbox" class="spell-check" data-idx="${idx}" data-field="enabled"
                 ${spell.enabled ? 'checked' : ''}></td>
      <td>
        ${spellIconHtml(spell)}
        <span class="spell-name${spell.isAA ? ' is-aa' : ''}">${escHtml(spell.name)}</span>
        ${spell.isAA ? '<span class="aa-badge">AA</span>' : ''}
      </td>
      <td class="td-muted">${spell.level}</td>
      <td>${TYPE_BADGES[spell.targetType] || ''}</td>
      <td><input type="number" class="tbl-input num-xs" data-idx="${idx}" data-field="castSecs"
                 value="${spell.castSecs}" min="0" step="0.01"></td>
      <td><input type="number" class="tbl-input num-sm" data-idx="${idx}" data-field="recastSecs"
                 value="${spell.recastSecs}" min="0" step="0.1"></td>
      <td class="dmg-display td-muted" data-dmg-idx="${idx}">${fmtDmgRange(spell)}</td>
      <td><input type="number" class="tbl-input num-xs" data-idx="${idx}" data-field="maxTargets"
                 value="${spell.maxTargets}" min="1" max="24"
                 title="${spell.aoeRadius ? `AoE radius: ${spell.aoeRadius}m` : ''}"></td>
      <td>${aaCell}</td>
    `;
    tr.addEventListener('click', e => {
      if (e.target.closest('input, button, select, a')) return;
      const expRow = tbody.querySelector(`tr[data-exp-idx="${idx}"]`);
      if (expRow) {
        expRow.classList.toggle('d-none');
        tr.classList.toggle('row-expanded', !expRow.classList.contains('d-none'));
      }
    });
    tbody.appendChild(tr);

    // Expand row
    const trExp = document.createElement('tr');
    trExp.className = 'expand-row d-none';
    trExp.dataset.expIdx = idx;

    const dotSection = spell.isDot ? `
      <div class="expand-field">
        <span class="expand-label">DoT/tick Low</span>
        <input type="number" class="tbl-input num-sm" data-idx="${idx}" data-field="userDotDmgLow"
               value="${spell.userDotDmgLow || ''}" min="0" placeholder="tooltip">
      </div>
      <div class="expand-field">
        <span class="expand-label">DoT/tick High</span>
        <input type="number" class="tbl-input num-sm" data-idx="${idx}" data-field="userDotDmgHigh"
               value="${spell.userDotDmgHigh || ''}" min="0" placeholder="tooltip">
      </div>
      <div class="expand-field">
        <span class="expand-label">Tick every</span>
        <span class="expand-value">${spell.dotInterval}s</span>
      </div>
      <div class="expand-field">
        <span class="expand-label">Duration</span>
        <span class="expand-value">${spell.durationSecs}s</span>
      </div>` : '';

    const enhNote = spell.enhanceAA
      ? `<div class="aa-note"><strong>AA:</strong> ${escHtml(spell.enhanceAA.description)} (max ${spell.enhanceAA.maxtier} pts)</div>`
      : '';

    trExp.innerHTML = `
      <td colspan="9">
        ${enhNote}
        <div class="expand-inner">
          <div class="expand-field">
            <span class="expand-label">Dmg Low</span>
            <input type="number" class="tbl-input num-sm" data-idx="${idx}" data-field="userDmgLow"
                   value="${spell.userDmgLow || ''}" min="0" placeholder="tooltip">
          </div>
          <div class="expand-field">
            <span class="expand-label">Dmg High</span>
            <input type="number" class="tbl-input num-sm" data-idx="${idx}" data-field="userDmgHigh"
                   value="${spell.userDmgHigh || ''}" min="0" placeholder="tooltip">
          </div>
          ${spell.triggerCount ? `
          <div class="expand-field">
            <span class="expand-label">Triggers</span>
            <input type="number" class="tbl-input num-xs" data-idx="${idx}" data-field="userTriggerCount"
                   value="${spell.userTriggerCount}" min="1" title="Total damage hits per cast">
          </div>` : ''}
          ${spell.triggerRatePerMin ? `
          <div class="expand-field">
            <span class="expand-label">Triggers/min</span>
            <input type="number" class="tbl-input num-xs" data-idx="${idx}" data-field="userTriggerRatePerMin"
                   value="${spell.userTriggerRatePerMin}" min="0" step="0.1" title="How many times per minute this triggers">
          </div>` : ''}
          ${dotSection}
        </div>
      </td>
    `;
    tbody.appendChild(trExp);
  });

}

// ── Spell field change handler ─────────────────────────────────────────────

function onSpellFieldChange(e) {
  const el    = e.target;
  const idx   = parseInt(el.dataset.idx, 10);
  const field = el.dataset.field;
  if (isNaN(idx) || !field) return;

  const spell = spells[idx];
  if (!spell) return;

  if (field === 'enabled') {
    spell.enabled = el.checked;
    const mainRow = document.querySelector(`tr[data-idx="${idx}"]`);
    mainRow && mainRow.classList.toggle('row-disabled', !spell.enabled);
  } else if (field === 'castOverride' || field === 'recastOverride') {
    spell[field] = el.value !== '' ? parseFloat(el.value) : null;
  } else {
    const val = parseFloat(el.value);
    if (!isNaN(val)) spell[field] = val;
  }

  if (['userDmgLow', 'userDmgHigh'].includes(field)) updateDmgDisplay(idx);

  saveSpells();
}

// ── Enable / disable all ───────────────────────────────────────────────────

function setAllEnabled(enabled) {
  spells.forEach((spell, idx) => {
    spell.enabled = enabled;
    const checkbox = document.querySelector(`input[data-idx="${idx}"][data-field="enabled"]`);
    if (checkbox) checkbox.checked = enabled;
    const row = document.querySelector(`tr[data-idx="${idx}"]`);
    if (row) row.classList.toggle('row-disabled', !enabled);
  });
  saveSpells();
}

// ── Filter spell rows ──────────────────────────────────────────────────────

function filterSpellRows(query) {
  document.querySelectorAll('#spellTableBody tr[data-idx]').forEach(row => {
    const visible = !query || (row.dataset.name || '').includes(query);
    row.classList.toggle('d-none', !visible);
    const expRow = document.querySelector(`tr[data-exp-idx="${row.dataset.idx}"]`);
    if (expRow && !visible) expRow.classList.add('d-none');
  });
}

// ── Calculate ──────────────────────────────────────────────────────────────

function onCalculate() {
  const stats = {
    castSpeed:     parseFloat(document.getElementById('castSpeed').value)     || 0,
    reuseSpeed:    parseFloat(document.getElementById('reuseSpeed').value)    || 0,
    recoverySpeed: parseFloat(document.getElementById('recoverySpeed').value) || 0,
  };
  const fightInfo = {
    fightDuration: parseFloat(document.getElementById('fightDuration').value) || 60,
    totalMobs:     parseInt(document.getElementById('totalMobs').value,   10) || 1,
    linkedMobs:    parseInt(document.getElementById('linkedMobs').value,  10) || 1,
  };

  const results = [];
  for (const spell of spells) {
    if (!spell.enabled) continue;
    const r = calcSpellDPS(spell, fightInfo, stats);
    if (r && r.dps > 0) results.push({ spell, ...r });
  }
  results.sort((a, b) => b.dps - a.dps);
  renderResults(results);
}

function renderResults(results) {
  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '';

  const topDps = results[0]?.dps || 1;

  for (const r of results) {
    const pct = (r.dps / topDps) * 100;
    const tr  = document.createElement('tr');
    tr.className = 'dps-row';
    tr.style.setProperty('--bar-pct', `${pct.toFixed(1)}%`);
    tr.innerHTML = `
      <td>${escHtml(r.spell.name)}${r.spell.isAA ? ' <span class="aa-badge">AA</span>' : ''}</td>
      <td>${TYPE_BADGES[r.spell.targetType] || ''}</td>
      <td class="td-muted">${r.effectiveCast.toFixed(2)}s</td>
      <td class="td-muted">${r.effectiveRecast.toFixed(1)}s</td>
      <td class="td-muted">${r.targetsHit}</td>
      <td class="td-muted">${fmt(r.avgDmgPerCast)}</td>
      <td class="dps-value">${fmt(r.dps)}</td>
      <td class="dps-rel">${pct.toFixed(0)}%</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('resultsSection').classList.remove('d-none');
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDmgRange(spell) {
  if (!spell.userDmgLow && !spell.userDmgHigh) return '<span style="opacity:.35">—</span>';
  return `${fmt(spell.userDmgLow)} – ${fmt(spell.userDmgHigh)}`;
}

function updateDmgDisplay(idx) {
  const cell = document.querySelector(`td.dmg-display[data-dmg-idx="${idx}"]`);
  if (cell) cell.innerHTML = fmtDmgRange(spells[idx]);
}

function spellIconHtml(spell) {
  if (!spell.icon || !spell.icon.id) return '';
  const src = `img/icons/icon_spell_${spell.icon.id}.png`;
  return `<img src="${src}" class="spell-icon" style="margin-right:7px"
               alt="" loading="lazy"
               onerror="this.style.display='none'">`;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n) {
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
}
