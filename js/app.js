'use strict';

// ── State ──────────────────────────────────────────────────────────────────

let spells = [];    // array of spell objects (from api.js / parse.js)
let currentClass = null;

// ── localStorage helpers ───────────────────────────────────────────────────
// Stats and fight info are global. Per-spell inputs are keyed by class.

const LS_STATS  = key => `dpscalc_stats_${key}`;
const LS_FIGHT  = 'dpscalc_fight';
const LS_SPELLS = key => `dpscalc_spells_${key}`;

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Persist the three stat inputs for the current class.
function saveStats() {
  if (!currentClass) return;
  lsSet(LS_STATS(currentClass), {
    castSpeed:     document.getElementById('castSpeed').value,
    reuseSpeed:    document.getElementById('reuseSpeed').value,
    recoverySpeed: document.getElementById('recoverySpeed').value,
  });
}

// Restore stat inputs for a given class key.
function loadStats(classKey) {
  const saved = lsGet(LS_STATS(classKey));
  if (!saved) return;
  if (saved.castSpeed     != null) document.getElementById('castSpeed').value     = saved.castSpeed;
  if (saved.reuseSpeed    != null) document.getElementById('reuseSpeed').value    = saved.reuseSpeed;
  if (saved.recoverySpeed != null) document.getElementById('recoverySpeed').value = saved.recoverySpeed;
}

// Persist the three fight inputs.
function saveFight() {
  lsSet(LS_FIGHT, {
    fightDuration: document.getElementById('fightDuration').value,
    totalMobs:     document.getElementById('totalMobs').value,
    linkedMobs:    document.getElementById('linkedMobs').value,
  });
}

// Restore fight inputs from storage.
function loadFight() {
  const saved = lsGet(LS_FIGHT);
  if (!saved) return;
  if (saved.fightDuration != null) document.getElementById('fightDuration').value = saved.fightDuration;
  if (saved.totalMobs     != null) document.getElementById('totalMobs').value     = saved.totalMobs;
  if (saved.linkedMobs    != null) document.getElementById('linkedMobs').value    = saved.linkedMobs;
}

// Persist user-mutable spell state for the current class.
// Keyed by spell uid so it survives re-fetches.
function saveSpells() {
  if (!currentClass) return;
  const state = {};
  for (const s of spells) {
    state[s.uid] = {
      enabled:        s.enabled,
      userDmgLow:     s.userDmgLow,
      userDmgHigh:    s.userDmgHigh,
      userDotDmgLow:  s.userDotDmgLow,
      userDotDmgHigh: s.userDotDmgHigh,
      maxTargets:     s.maxTargets,
      aaPoints:       s.aaPoints,
      castOverride:   s.castOverride,
      recastOverride: s.recastOverride,
    };
  }
  lsSet(LS_SPELLS(currentClass), state);
}

// Overlay saved spell state onto a freshly loaded spell array in-place.
function restoreSpells(classKey) {
  const saved = lsGet(LS_SPELLS(classKey));
  if (!saved) return;
  for (const s of spells) {
    const st = saved[s.uid];
    if (!st) continue;
    if (st.enabled        != null) s.enabled        = st.enabled;
    if (st.userDmgLow     != null) s.userDmgLow     = st.userDmgLow;
    if (st.userDmgHigh    != null) s.userDmgHigh     = st.userDmgHigh;
    if (st.userDotDmgLow  != null) s.userDotDmgLow  = st.userDotDmgLow;
    if (st.userDotDmgHigh != null) s.userDotDmgHigh = st.userDotDmgHigh;
    if (st.maxTargets     != null) s.maxTargets     = st.maxTargets;
    if (st.aaPoints       != null) s.aaPoints       = st.aaPoints;
    s.castOverride   = st.castOverride   ?? null;
    s.recastOverride = st.recastOverride ?? null;
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  populateClassSelect();
  loadFight();
  bindEvents();

  // Bootstrap tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el =>
    new bootstrap.Tooltip(el, { trigger: 'hover' })
  );
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
    document.getElementById('loadBtn').disabled = !e.target.value;
  });

  document.getElementById('loadBtn').addEventListener('click', onLoadSpells);
  document.getElementById('calcBtn').addEventListener('click', onCalculate);

  document.getElementById('enableAllBtn').addEventListener('click', () => setAllEnabled(true));
  document.getElementById('disableAllBtn').addEventListener('click', () => setAllEnabled(false));

  document.getElementById('spellSearch').addEventListener('input', e => {
    filterSpellRows(e.target.value.trim().toLowerCase());
  });

  // Save stats on change (per class).
  ['castSpeed', 'reuseSpeed', 'recoverySpeed'].forEach(id =>
    document.getElementById(id).addEventListener('input', saveStats)
  );

  // Save fight info on change (global).
  ['fightDuration', 'totalMobs', 'linkedMobs'].forEach(id =>
    document.getElementById(id).addEventListener('input', saveFight)
  );

  // Delegate input changes on the spell table.
  document.getElementById('spellTableBody').addEventListener('change', onSpellFieldChange);
  document.getElementById('spellTableBody').addEventListener('input', onSpellFieldChange);
}

// ── Load spells ────────────────────────────────────────────────────────────

async function onLoadSpells() {
  const classKey = document.getElementById('classSelect').value;
  if (!classKey) return;

  currentClass = classKey;
  showState('loading');
  document.getElementById('calcBtn').disabled = true;
  document.getElementById('resultsSection').classList.add('d-none');

  try {
    spells = await loadClassData(classKey, msg => {
      document.getElementById('loadingMsg').textContent = msg;
    });

    if (!spells.length) {
      showStatus(`No combat spells found for ${CLASSES[classKey].label}.`, 'text-warning');
      showState('empty');
      return;
    }

    restoreSpells(classKey);   // overlay saved spell state before render
    renderSpellTable();
    loadStats(classKey);       // restore per-class stats after render
    showState('spells');
    showStatus(`Loaded ${spells.length} spells for ${CLASSES[classKey].label}.`, 'text-success');
    document.getElementById('spellSectionTitle').textContent =
      `${CLASSES[classKey].label} Spells (${spells.length})`;
    document.getElementById('calcBtn').disabled = false;

  } catch (err) {
    console.error(err);
    showStatus(`Error: ${err.message}`, 'text-danger');
    showState('empty');
  }
}

function showState(state) {
  document.getElementById('emptyState').classList.toggle('d-none',   state !== 'empty');
  document.getElementById('loadingState').classList.toggle('d-none', state !== 'loading');
  document.getElementById('spellSection').classList.toggle('d-none', state !== 'spells');
}

function showStatus(msg, cls) {
  const el = document.getElementById('loadStatus');
  el.className = `form-text mt-2 ${cls}`;
  el.textContent = msg;
}

// ── Render spell table ─────────────────────────────────────────────────────

const TYPE_BADGES = {
  st:        '<span class="badge bg-secondary">ST</span>',
  encounter: '<span class="badge bg-primary">ENC</span>',
  aoe:       '<span class="badge bg-danger">AoE</span>',
};

function renderSpellTable() {
  const tbody = document.getElementById('spellTableBody');
  tbody.innerHTML = '';

  spells.forEach((spell, idx) => {
    // Main row
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.dataset.name = spell.name.toLowerCase();

    const aaCell = spell.enhanceAA
      ? `<input type="number" class="form-control form-control-sm num-xs" data-idx="${idx}" data-field="aaPoints"
               value="${spell.aaPoints}" min="0" max="${spell.enhanceAA.maxtier}"
               title="${escHtml(spell.enhanceAA.description)}">`
      : '<span class="text-muted">—</span>';

    const castDisplay  = spell.castSecs.toFixed(2);
    const recastDisplay = spell.recastSecs.toFixed(1);

    tr.innerHTML = `
      <td><input type="checkbox" class="form-check-input" data-idx="${idx}" data-field="enabled"
                 ${spell.enabled ? 'checked' : ''}></td>
      <td>
        ${spellIconHtml(spell)}
      <span class="spell-name${spell.isAA ? ' text-info' : ''}">${escHtml(spell.name)}</span>
        ${spell.isAA ? '<span class="badge bg-info text-dark ms-1" style="font-size:.65em">AA</span>' : ''}
      </td>
      <td class="text-muted">${spell.level}</td>
      <td>${TYPE_BADGES[spell.targetType] || ''}</td>
      <td class="text-muted">${castDisplay}s</td>
      <td class="text-muted">${recastDisplay}s</td>
      <td><input type="number" class="form-control form-control-sm num-sm" data-idx="${idx}" data-field="userDmgLow"
                 value="${spell.userDmgLow}" min="0" placeholder="low"></td>
      <td><input type="number" class="form-control form-control-sm num-sm" data-idx="${idx}" data-field="userDmgHigh"
                 value="${spell.userDmgHigh}" min="0" placeholder="high"></td>
      <td><input type="number" class="form-control form-control-sm num-xs" data-idx="${idx}" data-field="maxTargets"
                 value="${spell.maxTargets}" min="1" max="24"
                 title="${spell.aoeRadius ? `AoE radius: ${spell.aoeRadius}m` : ''}"></td>
      <td>${aaCell}</td>
      <td>
        <button class="btn btn-link btn-sm p-0 expand-btn" data-idx="${idx}" title="More options">▾</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Expand row (DoT details + overrides) — hidden by default.
    const trExp = document.createElement('tr');
    trExp.className = 'expand-row d-none';
    trExp.dataset.expIdx = idx;

    const dotSection = spell.isDot ? `
      <div class="row g-2 mb-2">
        <div class="col-auto">
          <label class="form-label form-label-sm mb-0">DoT Interval</label>
          <div class="form-control-plaintext form-control-sm py-0">${spell.dotInterval}s</div>
        </div>
        <div class="col-auto">
          <label class="form-label form-label-sm mb-0">DoT Duration</label>
          <div class="form-control-plaintext form-control-sm py-0">${spell.durationSecs}s</div>
        </div>
        <div class="col-auto">
          <label class="form-label form-label-sm mb-0">DoT Dmg/tick Low</label>
          <input type="number" class="form-control form-control-sm num-sm" data-idx="${idx}" data-field="userDotDmgLow"
                 value="${spell.userDotDmgLow}" min="0">
        </div>
        <div class="col-auto">
          <label class="form-label form-label-sm mb-0">DoT Dmg/tick High</label>
          <input type="number" class="form-control form-control-sm num-sm" data-idx="${idx}" data-field="userDotDmgHigh"
                 value="${spell.userDotDmgHigh}" min="0">
        </div>
      </div>` : '';

    const enhNote = spell.enhanceAA
      ? `<div class="text-info mb-2" style="font-size:.8em">
           <strong>AA:</strong> ${escHtml(spell.enhanceAA.description)}
           (max ${spell.enhanceAA.maxtier} pts)
         </div>`
      : '';

    trExp.innerHTML = `
      <td colspan="11" class="bg-dark bg-opacity-10 px-4 py-2">
        ${enhNote}
        ${dotSection}
        <div class="row g-2">
          <div class="col-auto">
            <label class="form-label form-label-sm mb-0">Cast Override (s)</label>
            <input type="number" class="form-control form-control-sm num-sm" data-idx="${idx}" data-field="castOverride"
                   value="${spell.castOverride ?? ''}" min="0" step="0.01" placeholder="—">
          </div>
          <div class="col-auto">
            <label class="form-label form-label-sm mb-0">Recast Override (s)</label>
            <input type="number" class="form-control form-control-sm num-sm" data-idx="${idx}" data-field="recastOverride"
                   value="${spell.recastOverride ?? ''}" min="0" step="0.1" placeholder="—">
          </div>
          <div class="col-auto align-self-end">
            <button class="btn btn-outline-secondary btn-sm" data-idx="${idx}" data-action="clearOverrides">
              Clear overrides
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(trExp);
  });

  // Bind expand buttons (delegated via parent binding already, but need click separately).
  tbody.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      const expRow = tbody.querySelector(`tr[data-exp-idx="${idx}"]`);
      if (expRow) {
        expRow.classList.toggle('d-none');
        btn.textContent = expRow.classList.contains('d-none') ? '▾' : '▴';
      }
    });
  });

  tbody.querySelectorAll('[data-action="clearOverrides"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      spells[idx].castOverride   = null;
      spells[idx].recastOverride = null;
      // Clear the override inputs in that row.
      const expRow = tbody.querySelector(`tr[data-exp-idx="${idx}"]`);
      expRow.querySelector('[data-field="castOverride"]').value   = '';
      expRow.querySelector('[data-field="recastOverride"]').value = '';
    });
  });
}

// ── Spell field change handler (delegated) ────────────────────────────────

function onSpellFieldChange(e) {
  const el = e.target;
  const idx = parseInt(el.dataset.idx, 10);
  const field = el.dataset.field;
  if (isNaN(idx) || !field) return;

  const spell = spells[idx];
  if (!spell) return;

  if (field === 'enabled') {
    spell.enabled = el.checked;
    const mainRow = document.querySelector(`tr[data-idx="${idx}"]`);
    mainRow && mainRow.classList.toggle('table-secondary', !spell.enabled);
  } else if (field === 'castOverride' || field === 'recastOverride') {
    spell[field] = el.value !== '' ? parseFloat(el.value) : null;
  } else {
    const val = parseFloat(el.value);
    if (!isNaN(val)) spell[field] = val;
  }

  saveSpells();
}

// ── Enable / disable all ───────────────────────────────────────────────────

function setAllEnabled(enabled) {
  spells.forEach((spell, idx) => {
    spell.enabled = enabled;
    const checkbox = document.querySelector(`input[data-idx="${idx}"][data-field="enabled"]`);
    if (checkbox) checkbox.checked = enabled;
    const row = document.querySelector(`tr[data-idx="${idx}"]`);
    if (row) row.classList.toggle('table-secondary', !enabled);
  });
  saveSpells();
}

// ── Filter spell rows ──────────────────────────────────────────────────────

function filterSpellRows(query) {
  document.querySelectorAll('#spellTableBody tr[data-idx]').forEach(row => {
    const name = row.dataset.name || '';
    const visible = !query || name.includes(query);
    row.classList.toggle('d-none', !visible);
    // Keep expand row in sync.
    const idx = row.dataset.idx;
    const expRow = document.querySelector(`tr[data-exp-idx="${idx}"]`);
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
    const tr = document.createElement('tr');
    tr.className = 'dps-bar-row';
    tr.style.setProperty('--bar-pct', `${pct.toFixed(1)}%`);
    tr.innerHTML = `
      <td>${escHtml(r.spell.name)}${r.spell.isAA ? ' <span class="badge bg-info text-dark" style="font-size:.65em">AA</span>' : ''}</td>
      <td>${TYPE_BADGES[r.spell.targetType] || ''}</td>
      <td>${r.effectiveCast.toFixed(2)}s</td>
      <td>${r.effectiveRecast.toFixed(1)}s</td>
      <td>${r.targetsHit}</td>
      <td>${fmt(r.avgDmgPerCast)}</td>
      <td class="text-end fw-semibold">${fmt(r.dps)}</td>
      <td class="text-end text-muted" style="font-size:.8em;min-width:3.5em">${pct.toFixed(0)}%</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('resultsSection').classList.remove('d-none');
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Returns an <img> for the spell icon, hidden on error.
// URL pattern TBD — wire up icon.id here when the Census serving endpoint
// or a reliable alternative (Wiki CDN / self-hosted) is confirmed.
function spellIconHtml(spell) {
  if (!spell.icon || !spell.icon.id) return '';
  // TODO: replace '#' with the resolved icon URL, e.g.:
  //   `https://example.com/eq2/icons/${spell.icon.id}.png`
  const src = '#';
  return `<img src="${src}" class="spell-icon me-1"
               alt="" loading="lazy"
               onerror="this.style.display='none'">`;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n) {
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
}
