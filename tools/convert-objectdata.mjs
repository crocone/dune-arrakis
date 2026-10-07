// Converts Dune Legacy's ObjectData.ini into src/data/objectData.json
// Usage: node tools/convert-objectdata.mjs <path to ObjectData.ini>
import fs from 'node:fs';

const src = process.argv[2];
const text = fs.readFileSync(src, 'utf8').replace(/\r/g, '');
const sections = {};
let cur = null;
for (let line of text.split('\n')) {
  line = line.replace(/#.*$/, '').trim();
  if (!line) continue;
  const m = line.match(/^\[(.+)\]$/);
  if (m) { cur = m[1].trim(); sections[cur] = sections[cur] || {}; continue; }
  const kv = line.match(/^([^=]+)=(.*)$/);
  if (kv && cur) sections[cur][kv[1].trim()] = kv[2].trim();
}

const KEYMAP = {
  'Barracks': 'barracks', 'Construction Yard': 'constructionYard', 'Gun-Turret': 'gunTurret', 'Heavy Factory': 'heavyFactory',
  'Hightech Factory': 'highTechFactory', 'House IX': 'ix', 'Light Factory': 'lightFactory', 'Palace': 'palace', 'Radar': 'radar',
  'Refinery': 'refinery', 'Repair Yard': 'repairYard', 'Rocket-Turret': 'rocketTurret', 'Spice Silo': 'silo', 'Slab1': 'slab1',
  'Slab4': 'slab4', 'Starport': 'starport', 'Wall': 'wall', 'Windtrap': 'windtrap', 'WOR': 'wor',
  'Carryall': 'carryall', 'Devastator': 'devastator', 'Deviator': 'deviator', 'Frigate': 'frigate', 'Harvester': 'harvester',
  'Launcher': 'launcher', 'MCV': 'mcv', 'Ornithopter': 'ornithopter', 'Quad': 'quad', 'Raider Trike': 'raider', 'Saboteur': 'saboteur',
  'Sandworm': 'sandworm', 'Siege Tank': 'siegeTank', 'Soldier': 'soldier', 'Sonic Tank': 'sonicTank', 'Tank': 'tank', 'Trike': 'trike',
  'Trooper': 'trooper', 'Invalid': null,
};
const STRUCTS = new Set(['barracks','constructionYard','gunTurret','heavyFactory','highTechFactory','ix','lightFactory','palace','radar','refinery','repairYard','rocketTurret','silo','slab1','slab4','starport','wall','windtrap','wor']);
const LETTERS = ['H','A','O','F','S','M'];
const NUM = ['HitPoints','Price','Power','ViewRange','Capacity','WeaponDamage','WeaponRange','WeaponReloadTime','MaxSpeed','TurnSpeed','BuildTime','InfSpawnProp','TechLevel','UpgradeLevel'];
const camel = (k) => k[0].toLowerCase() + k.slice(1);

function convValue(key, v) {
  if (key === 'Enabled') return v.toLowerCase() === 'true';
  if (key === 'Builder') return KEYMAP[v] ?? null;
  if (key === 'Prerequisite') return v.split(',').map((s) => s.trim()).filter(Boolean).map((s) => KEYMAP[s] ?? s);
  if (NUM.includes(key)) return Number(v);
  return v;
}

const out = { mapSettings: {}, structures: {}, units: {} };
for (const [k, v] of Object.entries(sections['Map Settings'] || {})) out.mapSettings[camel(k)] = Number(v);
for (const [name, props] of Object.entries(sections)) {
  if (name === 'Map Settings' || name.startsWith('default')) continue;
  const id = KEYMAP[name];
  if (!id) { console.warn('skip', name); continue; }
  const isStruct = STRUCTS.has(id);
  const def = sections[isStruct ? 'default structure' : 'default unit'];
  const entry = { name, base: {}, house: {} };
  const all = { ...def, ...props };
  for (const [k, v] of Object.entries(all)) {
    const hm = k.match(/^(\w+)\(([A-Z])\)$/);
    if (hm) {
      const h = LETTERS.indexOf(hm[2]);
      entry.house[h] = entry.house[h] || {};
      entry.house[h][camel(hm[1])] = convValue(hm[1], v);
    } else entry.base[camel(k)] = convValue(k, v);
  }
  if (!entry.base.prerequisite) entry.base.prerequisite = [];
  (isStruct ? out.structures : out.units)[id] = entry;
}
fs.writeFileSync('src/data/objectData.json', JSON.stringify(out, null, 1));
console.log('structures', Object.keys(out.structures).length, 'units', Object.keys(out.units).length);
