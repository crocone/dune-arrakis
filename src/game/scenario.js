import { T, H, HOUSE_NAMES_EN } from '../core/constants.js';
import { parseIni } from './ini.js';
import { createRawMapFromSeed, MAP_SCALES } from './mapseed.js';
import { Game } from './game.js';
import { modeFromIni, MODE } from './object.js';
import { itemIdFromIniName, stats, isStructureType } from '../data/gamedata.js';
import { AIPlayer } from './ai.js';
import { msToCycles } from '../core/constants.js';

const SEED_TYPE = { 0x7: T.SAND, 0x2: T.ROCK, 0x8: T.ROCK, 0x9: T.DUNES, 0xa: T.MOUNTAIN, 0xb: T.SPICE, 0xc: T.THICK_SPICE };
const CHAR_TYPE = { '-': T.SAND, '^': T.DUNES, '~': T.SPICE, '+': T.THICK_SPICE, '%': T.ROCK, '@': T.MOUNTAIN, O: T.SPICE_BLOOM, Q: T.SPECIAL_BLOOM };

export function houseIdFromName(name) {
  const n = String(name).trim().toLowerCase();
  return HOUSE_NAMES_EN.findIndex((h) => h.toLowerCase() === n);
}

// INI angle (0..255, 0 = north, clockwise) -> direction index (0 = east, counter-clockwise)
function iniAngleToDir(a) {
  a = parseInt(a, 10);
  if (Number.isNaN(a) || a < 0 || a > 255) a = 64;
  const k = Math.floor((a + 16) / 32);
  return (((8 - k + 2) % 8) + 8) % 8;
}

/**
 * Builds a ready-to-run Game from a scenario INI text.
 * opts: {
 *   player: house id of the human player (campaign) | null,
 *   playerSlots: { 'player1': houseId, ... } for multiplayer-style maps,
 *   humanSlot: 'player1' (which player section is human),
 *   campaign: bool, techLevel, difficulty, settings, seed,
 *   teams: { houseId: team } override
 * }
 */
export function createGameFromIni(text, opts = {}) {
  const ini = parseIni(text);
  const version = ini.getInt('BASIC', 'Version', 1);
  const mapScale = ini.getInt('BASIC', 'MapScale', 0);
  let winFlags = ini.getInt('BASIC', 'WinFlags', 3);
  let loseFlags = ini.getInt('BASIC', 'LoseFlags', 1);
  const timeout = ini.getInt('BASIC', 'TimeOut', ini.getInt('BASIC', 'TIMEOUT', 0));
  const techLevel = opts.techLevel ?? ini.getInt('BASIC', 'TechLevel', 8);

  const game = new Game({
    seed: opts.seed ?? (Date.now() & 0x7fffffff),
    settings: opts.settings,
    player: opts.player ?? H.ATREIDES,
    techLevel,
    campaign: !!opts.campaign,
    scenario: { winFlags, loseFlags, timeout, name: opts.name || '' },
  });

  // ---- map ----
  let width;
  let height;
  let offset = 0;
  let logicalW = 64;
  if (version < 2) {
    const sc = MAP_SCALES[mapScale] ?? MAP_SCALES[0];
    width = height = sc.size;
    offset = sc.offset;
    logicalW = 64;
    game.initMap(width, height);
    const seed = ini.getInt('MAP', 'Seed', 0) >>> 0;
    const raw = createRawMapFromSeed(seed);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = raw[(y + offset) * 64 + (x + offset)];
        const t = SEED_TYPE[v >> 4] ?? T.SAND;
        game.map.types[y * width + x] = t;
      }
    }
  } else {
    width = ini.getInt('MAP', 'SizeX', 64);
    height = ini.getInt('MAP', 'SizeY', 64);
    logicalW = width;
    game.initMap(width, height);
    for (let y = 0; y < height; y++) {
      const key = String(y).padStart(3, '0');
      const row = ini.get('MAP', key, '');
      for (let x = 0; x < width; x++) {
        const ch = row[x];
        game.map.types[y * width + x] = CHAR_TYPE[ch] ?? T.SAND;
      }
    }
  }
  const posToXY = (pos) => {
    pos = parseInt(pos, 10);
    return [(pos % logicalW) - offset, Math.floor(pos / logicalW) - offset];
  };
  const map = game.map;
  // spice amounts
  for (let i = 0; i < width * height; i++) {
    const t = map.types[i];
    if (t === T.SPICE) map.spice[i] = game.rng.randInt(74, 148);
    else if (t === T.THICK_SPICE) map.spice[i] = game.rng.randInt(148, 296);
  }
  const listPositions = (key) => (ini.get('MAP', key, '') || '').split(',').map((s) => s.trim()).filter(Boolean).map(posToXY);
  for (const [x, y] of listPositions('Bloom')) if (map.inBounds(x, y)) map.types[map.idx(x, y)] = T.SPICE_BLOOM;
  for (const [x, y] of listPositions('Special')) if (map.inBounds(x, y)) map.types[map.idx(x, y)] = T.SPECIAL_BLOOM;
  for (const [x, y] of listPositions('Field')) if (map.inBounds(x, y)) game.spiceField(x, y, 5, true, true);
  map.dirtyTerrain = [];

  // ---- houses ----
  const playerSections = [];
  for (let i = 1; i <= 6; i++) if (ini.has('player' + i)) playerSections.push('player' + i);
  const sectionToHouse = new Map();
  const houseSection = new Map();
  for (let h = 0; h < 6; h++) {
    if (ini.has(HOUSE_NAMES_EN[h])) {
      sectionToHouse.set(HOUSE_NAMES_EN[h].toLowerCase(), h);
      houseSection.set(h, HOUSE_NAMES_EN[h]);
    }
  }
  if (opts.playerSlots) {
    for (const [slot, h] of Object.entries(opts.playerSlots)) {
      sectionToHouse.set(slot.toLowerCase(), h);
      houseSection.set(h, slot);
    }
  }
  const humanHouse = opts.player ?? H.ATREIDES;
  const resolveHouse = (name) => {
    const n = String(name).trim().toLowerCase();
    if (sectionToHouse.has(n)) return sectionToHouse.get(n);
    if (n.startsWith('player')) return -1; // unused player slot
    const h = houseIdFromName(n);
    return h;
  };
  const ensureHouse = (h) => {
    if (h < 0) return null;
    if (game.houses[h]) return game.houses[h];
    const section = houseSection.get(h);
    const credits = section ? ini.getInt(section, 'Credits', 3000) : 0;
    const quota = section ? ini.getInt(section, 'Quota', 0) : 0;
    const maxUnits = section ? ini.getInt(section, 'MaxUnit', ini.getInt(section, 'MaxUnits', 0)) : 0;
    let team;
    if (opts.teams && opts.teams[h] !== undefined) team = opts.teams[h];
    else if (opts.campaign || !opts.playerSlots) team = h === humanHouse ? 1 : 2;
    else team = h + 1;
    const house = game.addHouse(h, {
      human: h === humanHouse,
      credits: (opts.creditsOverride && h === humanHouse) ? opts.creditsOverride : credits,
      quota,
      maxUnits,
      team,
    });
    return house;
  };
  for (const [h] of houseSection) ensureHouse(h);
  ensureHouse(humanHouse);

  // ---- units ----
  for (const [, value] of ini.entries('UNITS')) {
    const parts = value.split(',').map((s) => s.trim());
    if (parts.length < 4) continue;
    const h = resolveHouse(parts[0]);
    if (h < 0) continue;
    ensureHouse(h);
    let id = itemIdFromIniName(parts[1]);
    if (!id) continue;
    const hp = Math.min(1, (parseInt(parts[2], 10) || 256) / 256);
    const [x, y] = posToXY(parts[3]);
    if (!map.inBounds(x, y)) continue;
    const dir = iniAngleToDir(parts[4]);
    let mode = modeFromIni(parts[5] || 'Area Guard');
    if (!parts[5]) mode = MODE.AREAGUARD;
    let count = 1;
    if (id === 'infantry') { id = 'soldier'; count = 3; }
    else if (id === 'troopers') { id = 'trooper'; count = 3; }
    else if (id === 'special') {
      id = h === H.HARKONNEN ? 'devastator' : h === H.ATREIDES ? 'sonicTank' : h === H.ORDOS ? 'deviator' : (x + y) % 2 ? 'sonicTank' : 'devastator';
    }
    const st = stats(id, h);
    if (!st.enabled && id !== 'sandworm' && id !== 'saboteur' && id !== 'frigate') continue;
    for (let i = 0; i < count; i++) {
      const u = game.placeUnit(id, h, x, y, { health: hp, angle: dir, mode, byScenario: true });
      if (u && id === 'sandworm') u.attackMode = MODE.AMBUSH;
      if (u && id === 'harvester' && mode !== MODE.STOP) u.attackMode = MODE.HARVEST;
    }
  }

  // ---- structures ----
  for (const [key, value] of ini.entries('STRUCTURES')) {
    const parts = value.split(',').map((s) => s.trim());
    if (key.toUpperCase().startsWith('GEN')) {
      const pos = parseInt(key.slice(3), 10);
      const h = resolveHouse(parts[0]);
      if (h < 0) continue;
      ensureHouse(h);
      const [x, y] = posToXY(pos);
      if (!map.inBounds(x, y)) continue;
      const type = (parts[1] || '').toLowerCase();
      if (type === 'concrete') {
        if (map.types[map.idx(x, y)] === T.ROCK || map.types[map.idx(x, y)] === T.SLAB) {
          map.types[map.idx(x, y)] = T.SLAB;
          map.tileOwner[map.idx(x, y)] = h;
        }
      } else if (type === 'wall') {
        if (!map.ground[map.idx(x, y)]) game.placeStructure(h, 'wall', x, y, { byScenario: true });
      }
      continue;
    }
    if (parts.length < 4) continue;
    const h = resolveHouse(parts[0]);
    if (h < 0) continue;
    ensureHouse(h);
    const id = itemIdFromIniName(parts[1]);
    if (!id || !isStructureType(id)) continue;
    const hp = Math.min(1, (parseInt(parts[2], 10) || 256) / 256);
    const [x, y] = posToXY(parts[3]);
    if (!map.inBounds(x, y)) continue;
    // remove units occupying the footprint (scenario structures win)
    const s = game.placeStructure(h, id, x, y, { byScenario: true, health: hp, freeHarvester: true });
    if (s) s.byScenario = true;
  }

  // ---- reinforcements ----
  for (const [, value] of ini.entries('REINFORCEMENTS')) {
    const parts = value.split(',').map((s) => s.trim());
    if (parts.length < 4) continue;
    const h = resolveHouse(parts[0]);
    if (h < 0) continue;
    ensureHouse(h);
    const id = itemIdFromIniName(parts[1]);
    if (!id) continue;
    let timeStr = parts[3];
    let repeat = false;
    if (timeStr.endsWith('+')) {
      repeat = true;
      timeStr = timeStr.slice(0, -1);
    }
    if (parts[4] && parts[4].trim() === '+') repeat = true;
    const minutes = parseInt(timeStr, 10) || 0;
    const cycle = msToCycles(minutes * 60 * 1000);
    const where = parts[2];
    // merge identical triggers into one carryall
    const existing = game.triggers.find((t) => t.kind === 'reinforce' && t.house === h && t.cycle === cycle && t.where === where && !!t.repeat === (repeat && cycle > 0));
    if (existing) existing.units.push(id);
    else game.addReinforcement({ house: h, units: [id], where, cycle: Math.max(1, cycle), repeat: repeat && cycle > 0 ? cycle : 0 });
  }

  // ---- CHOAM ----
  for (const [name, value] of ini.entries('CHOAM')) {
    const id = itemIdFromIniName(name);
    if (!id) continue;
    let n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) n = 0;
    for (const house of game.houses) if (house) house.choam.addItem(id, n);
  }

  // ---- timeout ----
  if (timeout > 0 && winFlags & 8) {
    game.triggers.push({ kind: 'timeout', next: msToCycles(timeout * 60 * 1000), cycle: msToCycles(timeout * 60 * 1000) });
  }

  // ---- AI ----
  for (const house of game.houses) {
    if (!house || house.isHuman) continue;
    if (house.id === H.FREMEN && house.numStructures === 0 && !opts.campaign) continue;
    house.ai = new AIPlayer(game, house.id, {
      mode: opts.campaign ? 'campaign' : opts.aiMode || 'skirmish',
      difficulty: opts.difficulty ?? 1,
    });
  }

  // ---- finishing ----
  game.computeSandRegions();
  for (const house of game.houses) if (house) house.recalcPowerAndStorage();
  for (const s of game.structures) if (s.isBuilder) s.updateBuildList();
  // initial view
  const tactical = ini.getInt('BASIC', 'TacticalPos', -1);
  if (tactical >= 0 && version < 2) {
    const [tx, ty] = posToXY(tactical + 64 * 5 + 7);
    game.startView = [tx, ty];
  }
  if (!game.startView || !map.inBounds(game.startView[0], game.startView[1])) {
    const c = game.baseCenter(humanHouse);
    game.startView = c || [Math.floor(width / 2), Math.floor(height / 2)];
  }
  for (const house of game.houses) {
    if (!house) continue;
    house.everHadStructures = house.numStructures > 0;
    if (!house.checkAlive()) house.defeated = true;
  }
  return game;
}

export function readMapInfo(text) {
  const ini = parseIni(text);
  const players = [];
  for (let i = 1; i <= 6; i++) if (ini.has('player' + i)) players.push('player' + i);
  const houses = [];
  for (let h = 0; h < 6; h++) if (ini.has(HOUSE_NAMES_EN[h])) houses.push(h);
  return {
    version: ini.getInt('BASIC', 'Version', 1),
    techLevel: ini.getInt('BASIC', 'TechLevel', 8),
    author: ini.get('BASIC', 'Author', ''),
    license: ini.get('BASIC', 'License', ''),
    width: ini.getInt('MAP', 'SizeX', 64),
    height: ini.getInt('MAP', 'SizeY', 64),
    players,
    houses,
  };
}
