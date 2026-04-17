# EQ2 DPS Calculator

A spell rotation efficiency calculator for EverQuest II, scoped to the **Ruins of Kunark era (levels 1–80)**.

Plain HTML/JS — no build step, no runtime dependencies. Hosted via GitHub Pages from the `docs/` folder.

---

## Usage

Open `index.html` in a browser (or visit the GitHub Pages URL). Select your class, enter your character stats and fight parameters, fill in tooltip damage values for each spell, and hit **Calculate DPS**.

### Refreshing spell data

Spell data is pre-fetched from the [EQ2 Census API](https://census.daybreakgames.com) and stored as static JSON in `data/spells/`. To refresh:

```bash
node scripts/fetch-spells.js            # all 24 classes
node scripts/fetch-spells.js wizard     # single class
```

Requires Node 18+. After fetching, copy updated files to `docs/data/spells/` to deploy.

---

## How it works

- **Base spells** — class-trained combat spells (levels 1–80), one per spell line (highest tier at or below cap), from the Census `spell` collection.
- **AA combat spells** — standalone hostile abilities from the class and subclass AA trees (e.g. Manaburn), resolved via CRC lookup. Post-RoK expansion nodes (Sentinel's Fate etc.) are excluded.
- **Enhance AAs** — passive modifiers like "Enhance: Immolation" that reduce cast or recast time per AA point invested. Parsed from the AA tree and surfaced as a per-spell point input.
- **Stat formula** — `effective = base × 100 / (100 + stat%)` for cast speed, reuse speed, and recovery speed. Applied on top of any AA reductions.
- **DPS** — `avg damage per cast / cycle time`, where cycle = effective cast + effective recast + 0.5s recovery. Sorted descending. Total is the sum across all enabled spells (assumes perfect interleave).

---

## Project structure

```
index.html              app shell (Bootstrap 5 CDN)
js/
  data.js               class definitions, AA tree IDs, constants
  api.js                loads pre-fetched JSON at runtime
  parse.js              effect_list text parsing, DPS calculation
  app.js                UI rendering, state, event wiring
css/style.css
data/spells/{class}.json   pre-fetched spell data (24 files)
scripts/fetch-spells.js    Census API data pipeline (run manually)
docs/                   GitHub Pages mirror of all the above
```

---

## Known limitations & future improvements

### Data completeness
- [ ] **Spell icons** — `icon.id` is stored on every spell record. The Census serving endpoint for EQ2 icons appears partially deprecated; image URL pattern unconfirmed. When resolved, wire up `spellIconHtml()` in `js/app.js` (one-line TODO). Fallback options: EQ2 Wiki CDN or self-hosted `.dds` extracts from the game client.
- [ ] **Heroic tree AAs** — the Heroic AA tree (separate from class/subclass) is not yet included. Same CRC-based pipeline applies; tree IDs need mapping.
- [ ] **Multi-hit spells** — some spells (e.g. Ice Spears) hit multiple times per cast. Not exposed in the Census API; would require a manual multiplier field per spell.
- [ ] **Spell proc effects** — triggered on-hit effects aren't captured. Out of scope for damage-range-based calculation.

### Calculation accuracy
- [ ] **Rotation simulation** — current DPS is per-spell in isolation (`dmg / cycle`). A proper rotation simulator would model a time-stepped queue, accounting for cast/recast overlap, global cooldown, and DoT tick timing more accurately.
- [ ] **DoT overlap** — if recast < dot duration, successive casts overlap and ticks stack. The current model assumes one DoT active at a time.
- [ ] **Minimum recast floors** — EQ2 has hard floors on recast reduction (typically 75% max reduction). Not currently enforced.
- [ ] **Fight duration clamping** — last cast of a DoT may not run its full duration before the fight ends. Not modeled.

### Character inputs
- [ ] **Crit chance / crit bonus** — significant DPS multiplier at higher gear levels. Would require user-provided crit % and crit bonus % inputs, then apply to avg damage.
- [ ] **Potency / ability modifier** — the dominant DPS stat in later EQ2. Not relevant for vanilla RoK era but worth adding if scope expands.
- [ ] **AA point budget enforcement** — currently accepts any AA point values per spell with no cap. A global "total AA points" field with a running tally would prevent over-allocation.
- [ ] **Damage formula integration** — rather than requiring the user to supply tooltip damage values, derive spell damage from character stats (ability modifier, INT/STR/etc., spell damage bonus) using EQ2's damage formulas. This would make the calculator self-contained given only a character's stat sheet.
- [ ] **Stat distribution optimizer** — given a fixed pool of stat points or gear budget, simulate different distributions (e.g. more ability modifier vs. more crit bonus vs. more reuse speed) and surface which allocation produces the highest total DPS for a given spell set and fight scenario. Natural extension of damage formula integration.

### UX
- [ ] **Save / load character profiles** — persist stat inputs and per-spell configurations to `localStorage` so sessions survive a page refresh.
- [ ] **Spell notes field** — free-text per spell for player annotations (e.g. "use on cooldown", "skip on AoE fights").
- [ ] **Heals and wards tab** — the data pipeline and class structure already support it; just needs a separate UI mode and heal-per-second calculation replacing DPS.
- [ ] **Spell icon display** — blocked on icon URL resolution (see above).
- [ ] **Export results** — copy-to-clipboard or CSV download of the results table.
