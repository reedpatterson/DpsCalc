#!/usr/bin/env node
// Downloads all spell icons referenced in data/spells/*.json to img/icons/.

const fs   = require('fs');
const path = require('path');
const https = require('https');

const SPELLS_DIR = path.join(__dirname, '../data/spells');
const ICONS_DIR  = path.join(__dirname, '../img/icons');
const DOCS_DIR   = path.join(__dirname, '../docs/img/icons');
const BASE_URL   = 'https://zam.zamimg.com/eq2/i/images/Icons/icon_spell_';
const DELAY_MS   = 100; // polite delay between requests

fs.mkdirSync(ICONS_DIR, { recursive: true });
fs.mkdirSync(DOCS_DIR,  { recursive: true });

// Collect unique icon IDs
const ids = new Set();
for (const file of fs.readdirSync(SPELLS_DIR)) {
  const spells = JSON.parse(fs.readFileSync(path.join(SPELLS_DIR, file)));
  for (const spell of spells) {
    if (spell.icon?.id) ids.add(spell.icon.id);
  }
}

const sorted = [...ids].sort((a, b) => a - b);
console.log(`Found ${sorted.length} unique icon IDs.`);

function download(id) {
  return new Promise((resolve, reject) => {
    const dest = path.join(ICONS_DIR, `icon_spell_${id}.png`);
    if (fs.existsSync(dest)) { process.stdout.write('.'); return resolve(); }

    const url = `${BASE_URL}${id}.png`;
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        process.stdout.write('x');
        return resolve(); // skip, don't reject
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          // Mirror to docs/
          fs.copyFileSync(dest, path.join(DOCS_DIR, `icon_spell_${id}.png`));
          process.stdout.write('+');
          resolve();
        });
      });
    }).on('error', err => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  let done = 0;
  for (const id of sorted) {
    await download(id);
    done++;
    if (done % 50 === 0) console.log(` ${done}/${sorted.length}`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log(`\nDone. ${sorted.length} icons processed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
