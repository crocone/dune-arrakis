// Procedural mission generator. Produces a Dune Legacy "Version 2" scenario INI text
// (explicit map) from a campaign level template or skirmish settings.
// Terrain comes from the original Dune II seed generator (mapseed.js).
import { T, H, HOUSE_NAMES_EN } from '../core/constants.js';
import { createRawMapFromSeed, MAP_SCALES } from './mapseed.js';
import { Random } from '../core/random.js';
import { STRUCTURE_SIZE, stats } from '../data/gamedata.js';
import { CAMPAIGNS } from '../data/campaign.js';

const SEED_TYPE = { 0x7: T.SAND, 0x2: T.ROCK, 0x8: T.ROCK, 0x9: T.DUNES, 0xa: T.MOUNTAIN, 0xb: T.SPICE, 0xc: T.THICK_SPICE };
const TYPE_CHAR = { [T.SAND]: '-', [T.DUNES]: '^', [T.SPICE]: '~', [T.THICK_SPICE]: '+', [T.ROCK]: '%', [T.MOUNTAIN]: '@', [T.SPICE_BLOOM]: 'O', [T.SPECIAL_BLOOM]: 'Q', [T.SLAB]: '%' };
const INI_STRUCT = {
  constructionYard: 'Construction Yard', windtrap: 'Windtrap', refinery: 'Refinery', silo: 'Spice Silo', radar: 'Radar', barracks: 'Barracks',
  wor: 'WOR', lightFactory: 'Light Factory', heavyFactory: 'Heavy Factory', highTechFactory: 'Hightech Factory', repairYard: 'Repair Yard',
  starport: 'Starport', palace: 'Palace', ix: 'House IX', gunTurret: 'Gun-Turret', rocketTurret: 'Rocket-Turret', wall: 'Wall',
};
const INI_UNIT = {
  soldier: 'Soldier', trooper: 'Trooper', infantry: 'Infantry', troopers: 'Troopers', trike: 'Trike', raider: 'Raider Trike', quad: 'Quad',
  tank: 'Tank', siegeTank: 'Siege Tank', launcher: 'Launcher', devastator: 'Devastator', deviator: 'Deviator', sonicTank: 'Sonic Tank',
  harvester: 'Harvester', mcv: 'MCV', carryall: 'Carryall', ornithopter: 'Ornithopter', saboteur: 'Saboteur', sandworm: 'Sandworm',
};

export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e37;
  }
  return h >>> 0;
}

function parseList(s) {
  const out = [];
  if (!s) return out;
  for (const part of s.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const [type, n] = p.split('*');
    out.push([type.trim(), n ? parseInt(n, 10) : 1]);
  }
  return out;
}

// Build terrain from a Dune II seed (cropped by map scale)
function terrainFromSeed(seed, scale) {
  const raw = createRawMapFromSeed(seed);
  const sc = MAP_SCALES[scale] ?? MAP_SCALES[0];
  const size = sc.size;
  const types = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = raw[(y + sc.offset) * 64 + (x + sc.offset)];
    types[y * size + x] = SEED_TYPE[v >> 4] ?? T.SAND;
  }
  return { w: size, h: size, types };
}

class Layout {
  constructor(w, h, types, rng) {
    this.w = w;
    this.h = h;
    this.types = types;
    this.rng = rng;
    this.occ = new Int16Array(w * h); // 0 free, >0 structure/unit marker
    this.structures = [];
    this.units = [];
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  t(x, y) {
    return this.types[y * this.w + x];
  }

  // 4-connected rock components
  rockComponents() {
    const comp = new Int32Array(this.w * this.h).fill(-1);
    const comps = [];
    for (let i = 0; i < this.w * this.h; i++) {
      if (comp[i] >= 0 || this.types[i] !== T.ROCK) continue;
      const id = comps.length;
      const tiles = [];
      const stack = [i];
      comp[i] = id;
      while (stack.length) {
        const k = stack.pop();
        tiles.push(k);
        const x = k % this.w;
        const y = (k / this.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (!this.inb(nx, ny)) continue;
          const nk = ny * this.w + nx;
          if (comp[nk] < 0 && this.types[nk] === T.ROCK) {
            comp[nk] = id;
            stack.push(nk);
          }
        }
      }
      let cx = 0;
      let cy = 0;
      for (const k of tiles) {
        cx += k % this.w;
        cy += (k / this.w) | 0;
      }
      comps.push({ id, tiles, size: tiles.length, cx: cx / tiles.length, cy: cy / tiles.length });
    }
    this.comp = comp;
    return comps;
  }

  // prefix sums of rock tiles for fast density queries
  buildRockSum() {
    const W = this.w + 1;
    const sum = new Int32Array(W * (this.h + 1));
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = this.types[y * this.w + x] === T.ROCK ? 1 : 0;
        sum[(y + 1) * W + (x + 1)] = v + sum[y * W + (x + 1)] + sum[(y + 1) * W + x] - sum[y * W + x];
      }
    }
    this.rockSum = sum;
  }

  rockDensity(cx, cy, r) {
    const W = this.w + 1;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(this.w, cx + r + 1);
    const y1 = Math.min(this.h, cy + r + 1);
    const s = this.rockSum;
    return s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0];
  }

  // best base center inside a component: max rock density in radius r, away from map border
  bestCenter(c, r = 5) {
    if (!this.rockSum) this.buildRockSum();
    let best = c.tiles[0];
    let bv = -1;
    for (const k of c.tiles) {
      const x = k % this.w;
      const y = (k / this.w) | 0;
      if (x < 3 || y < 3 || x > this.w - 4 || y > this.h - 4) continue;
      const v = this.rockDensity(x, y, r);
      if (v > bv) {
        bv = v;
        best = k;
      }
    }
    c.density = bv;
    return [best % this.w, (best / this.w) | 0];
  }

  // carve a rock plateau (used when a map lacks room for a base)
  carvePlateau(cx, cy, rx, ry) {
    for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) {
      for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
        if (!this.inb(x, y)) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 + this.rng.rand() * 0.15) this.types[y * this.w + x] = T.ROCK;
      }
    }
    this.rockSum = null;
  }

  canPlace(type, x, y, spacing = 1) {
    const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i;
      const ty = y + j;
      if (!this.inb(tx, ty)) return false;
      if (this.t(tx, ty) !== T.ROCK) return false;
      if (this.occ[ty * this.w + tx]) return false;
    }
    if (spacing > 0) {
      for (let j = -spacing; j < h + spacing; j++) for (let i = -spacing; i < w + spacing; i++) {
        const tx = x + i;
        const ty = y + j;
        if (!this.inb(tx, ty)) continue;
        if (this.occ[ty * this.w + tx] === 2) return false; // other building
      }
    }
    return true;
  }

  mark(type, x, y, v = 2) {
    const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.occ[(y + j) * this.w + (x + i)] = v;
  }

  // place building as close to (cx,cy) as possible
  placeNear(house, type, cx, cy, maxR = 14, spacing = 1) {
    const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
    let best = null;
    let bd = Infinity;
    for (let y = Math.floor(cy - maxR); y <= cy + maxR; y++) {
      for (let x = Math.floor(cx - maxR); x <= cx + maxR; x++) {
        const d = Math.hypot(x + w / 2 - cx, y + h / 2 - cy) + this.rng.rand() * 0.8;
        if (d >= bd) continue;
        if (!this.canPlace(type, x, y, spacing)) continue;
        bd = d;
        best = [x, y];
      }
    }
    if (!best) return null;
    this.mark(type, best[0], best[1], type === 'wall' || type === 'gunTurret' || type === 'rocketTurret' ? 3 : 2);
    this.structures.push({ house, type, x: best[0], y: best[1] });
    return best;
  }

  freeTileNear(cx, cy, maxR, pred) {
    for (let r = 0; r <= maxR; r++) {
      const cands = [];
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (!this.inb(x, y) || this.occ[y * this.w + x]) continue;
        const t = this.t(x, y);
        if (t === T.MOUNTAIN || t === T.SPICE_BLOOM) continue;
        if (pred && !pred(x, y, t)) continue;
        cands.push([x, y]);
      }
      if (cands.length) return cands[this.rng.randInt(0, cands.length - 1)];
    }
    return null;
  }

  addUnit(house, type, x, y, mode, angle = null) {
    this.occ[y * this.w + x] = 1;
    this.units.push({ house, type, x, y, mode, angle: angle ?? this.rng.randInt(0, 7) * 32 });
  }
}

// Build a base around (cx, cy). Walls and turrets face the direction (dx, dy).
function buildBase(L, house, cx, cy, baseList, dirX, dirY) {
  const items = parseList(baseList);
  const order = ['constructionYard', 'windtrap', 'refinery', 'silo', 'radar', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'repairYard', 'starport', 'ix', 'palace'];
  const buildings = [];
  const defenses = [];
  let walls = 0;
  for (const [type, n] of items) {
    if (type === 'wall') walls += n;
    else if (type === 'gunTurret' || type === 'rocketTurret') for (let i = 0; i < n; i++) defenses.push(type);
    else for (let i = 0; i < n; i++) buildings.push(type);
  }
  buildings.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const type of buildings) {
    let p = L.placeNear(house, type, cx, cy, 16, 1);
    if (!p) p = L.placeNear(house, type, cx, cy, 22, 0);
    if (!p) continue;
    const [w, h] = STRUCTURE_SIZE[type];
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0] + w - 1);
    maxY = Math.max(maxY, p[1] + h - 1);
  }
  if (minX === Infinity) {
    minX = maxX = Math.round(cx);
    minY = maxY = Math.round(cy);
  }
  const len = Math.hypot(dirX, dirY) || 1;
  const fx = dirX / len;
  const fy = dirY / len;
  // defensive ring tiles around the base bounding box, sorted towards the enemy
  const ring = (d) => {
    const tiles = [];
    for (let y = minY - d; y <= maxY + d; y++) for (let x = minX - d; x <= maxX + d; x++) {
      const onRing = x === minX - d || x === maxX + d || y === minY - d || y === maxY + d;
      if (!onRing || !L.inb(x, y)) continue;
      if (L.t(x, y) !== T.ROCK || L.occ[y * L.w + x]) continue;
      const vx = x - (minX + maxX) / 2;
      const vy = y - (minY + maxY) / 2;
      const vl = Math.hypot(vx, vy) || 1;
      tiles.push({ x, y, score: (vx * fx + vy * fy) / vl });
    }
    tiles.sort((a, b) => b.score - a.score);
    return tiles;
  };
  // turrets first (inside the wall line)
  let ti = 0;
  const tring = ring(2);
  for (const type of defenses) {
    while (ti < tring.length && L.occ[tring[ti].y * L.w + tring[ti].x]) ti++;
    if (ti >= tring.length) break;
    const t = tring[ti];
    L.occ[t.y * L.w + t.x] = 3;
    L.structures.push({ house, type, x: t.x, y: t.y });
    ti += 2;
  }
  // walls: contiguous segments on ring 3, with gaps for exits
  const wring = ring(3);
  let placed = 0;
  let k = 0;
  for (const t of wring) {
    if (placed >= walls) break;
    k++;
    if (k % 7 === 0) continue; // exit gap
    if (L.occ[t.y * L.w + t.x]) continue;
    L.occ[t.y * L.w + t.x] = 3;
    L.structures.push({ house, type: 'wall', x: t.x, y: t.y });
    placed++;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function placeArmy(L, house, list, cx, cy, opts = {}) {
  const items = parseList(list);
  const radius = opts.radius ?? 6;
  for (const [type, n] of items) {
    for (let i = 0; i < n; i++) {
      const realType = type;
      let mode = opts.mode || 'Area Guard';
      if (opts.ambushRatio !== undefined) mode = L.rng.rand() < opts.ambushRatio ? 'Ambush' : 'Hunt';
      const ox = cx + (opts.spread ? L.rng.randInt(-opts.spread, opts.spread) : 0);
      const oy = cy + (opts.spread ? L.rng.randInt(-opts.spread, opts.spread) : 0);
      const isInf = realType === 'soldier' || realType === 'trooper' || realType === 'infantry' || realType === 'troopers';
      const p = L.freeTileNear(Math.round(ox), Math.round(oy), radius + 6, (x, y, t) => (isInf ? true : t !== T.MOUNTAIN));
      if (!p) continue;
      L.addUnit(house, realType, p[0], p[1], mode);
    }
  }
}

function spiceAround(L, cx, cy, r) {
  let n = 0;
  for (let y = Math.max(0, cy - r); y <= Math.min(L.h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(L.w - 1, cx + r); x++) {
    const t = L.t(x, y);
    if (t === T.SPICE || t === T.THICK_SPICE) n++;
  }
  return n;
}

function toIni(L, meta) {
  const lines = [];
  lines.push('; Generated by Dune: Arrakis mission generator');
  lines.push('[BASIC]');
  lines.push('Version=2');
  lines.push(`WinFlags=${meta.winFlags}`);
  lines.push(`LoseFlags=${meta.loseFlags}`);
  lines.push(`TechLevel=${meta.techLevel}`);
  if (meta.timeout) lines.push(`TimeOut=${meta.timeout}`);
  lines.push('');
  lines.push('[MAP]');
  lines.push(`SizeX=${L.w}`);
  lines.push(`SizeY=${L.h}`);
  if (meta.fields?.length) lines.push(`Field=${meta.fields.map(([x, y]) => y * L.w + x).join(',')}`);
  for (let y = 0; y < L.h; y++) {
    let row = '';
    for (let x = 0; x < L.w; x++) row += TYPE_CHAR[L.t(x, y)] || '-';
    lines.push(`${String(y).padStart(3, '0')}=${row}`);
  }
  lines.push('');
  for (const [hid, info] of Object.entries(meta.houses)) {
    lines.push(`[${HOUSE_NAMES_EN[hid]}]`);
    lines.push(`Quota=${info.quota || 0}`);
    lines.push(`Credits=${info.credits || 0}`);
    lines.push(`MaxUnit=${info.maxUnit || 25}`);
    lines.push('');
  }
  lines.push('[UNITS]');
  L.units.forEach((u, i) => {
    lines.push(`ID${String(i).padStart(3, '0')}=${HOUSE_NAMES_EN[u.house]},${INI_UNIT[u.type] || u.type},256,${u.y * L.w + u.x},${u.angle},${u.mode}`);
  });
  lines.push('');
  lines.push('[STRUCTURES]');
  L.structures.forEach((s, i) => {
    lines.push(`ID${String(i).padStart(3, '0')}=${HOUSE_NAMES_EN[s.house]},${INI_STRUCT[s.type] || s.type},256,${s.y * L.w + s.x}`);
  });
  lines.push('');
  lines.push('[REINFORCEMENTS]');
  (meta.reinforcements || []).forEach((r, i) => {
    lines.push(`${i + 1}=${HOUSE_NAMES_EN[r.house]},${INI_UNIT[r.type] || r.type},${r.where},${r.minute}${r.repeat ? '+' : ''}`);
  });
  lines.push('');
  if (meta.choam) {
    lines.push('[CHOAM]');
    for (const [type, n] of meta.choam) lines.push(`${INI_UNIT[type] || type}=${n}`);
  }
  return lines.join('\n');
}

function parseReinf(str, player, enemies, isPlayer) {
  const m = str.match(/^(?:([A-Za-z0-9]):)?([a-zA-Z]+)(?:\*(\d+))?@(\d+)(\+)?$/);
  if (!m) return [];
  const [, prefix, type, n, minute, rep] = m;
  let house = isPlayer ? player : enemies[0];
  if (prefix === 'S') house = H.SARDAUKAR;
  else if (prefix !== undefined && /\d/.test(prefix)) house = enemies[parseInt(prefix, 10)] ?? enemies[0];
  const count = n ? parseInt(n, 10) : 1;
  const out = [];
  const infantry = type === 'infantry' || type === 'troopers' || type === 'soldier' || type === 'trooper';
  let where = isPlayer ? 'Homebase' : house === H.SARDAUKAR || infantry ? 'Enemybase' : 'Homebase';
  for (let i = 0; i < count; i++) out.push({ house, type, where, minute: parseInt(minute, 10), repeat: !!rep });
  return out;
}

// ---------------------------------------------------------------------------
// Campaign mission
// ---------------------------------------------------------------------------
export function generateCampaignMission(playerHouse, level, variant = 0) {
  const tpl = CAMPAIGNS[playerHouse][level - 1];
  const scale = tpl.scale ?? 0;
  const enemies = tpl.enemies;
  for (let attempt = 0; attempt < 60; attempt++) {
    const seed = hashSeed('dune-arrakis', playerHouse, level, variant, attempt);
    const rng = new Random(seed);
    const terr = terrainFromSeed(seed & 0xffff, scale);
    const L = new Layout(terr.w, terr.h, terr.types, rng);
    const res = layoutMission(L, tpl, playerHouse, enemies, level, variant, attempt);
    if (!res) continue;
    return res;
  }
  // should not happen; fall back to carving plateaus on a random seed
  const seed = hashSeed('dune-arrakis-fallback', playerHouse, level, variant);
  const rng = new Random(seed);
  const terr = terrainFromSeed(seed & 0xffff, scale);
  const L = new Layout(terr.w, terr.h, terr.types, rng);
  return layoutMission(L, tpl, playerHouse, enemies, level, variant, 99, true);
}

function layoutMission(L, tpl, playerHouse, enemies, level, variant, attempt, forceCarve = false) {
  const rng = L.rng;
  const big = L.w > 40;
  const needPlayer = big ? 60 : 16;
  const enemyBases = tpl.enemy.filter((e) => e.base);
  const needEnemy = (e) => {
    let area = 0;
    for (const [type, n] of parseList(e.base)) {
      const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
      area += (type === 'wall' ? 0.3 : (w + 1) * (h + 1)) * n;
    }
    return Math.max(big ? 40 : 14, area * 0.55);
  };
  let comps = L.rockComponents().sort((a, b) => b.size - a.size);
  const sites = [];
  // choose player site: a component of adequate size; prefer by variant (west/center/east)
  const pref = [0.2, 0.5, 0.8][variant % 3];
  const playerCands = comps.filter((c) => {
    if (c.size < needPlayer) return false;
    L.bestCenter(c, big ? 5 : 3);
    return c.density >= (big ? 55 : 22);
  });
  let playerSite = null;
  if (playerCands.length && !forceCarve) {
    playerCands.sort((a, b) => Math.abs(a.cx / L.w - pref) - Math.abs(b.cx / L.w - pref) + (b.size - a.size) * 0.002);
    playerSite = playerCands[0];
  }
  if (!playerSite) {
    if (attempt < 40 && !forceCarve) return null;
    const cx = L.w * pref;
    const cy = L.h * 0.75;
    L.carvePlateau(cx, cy, big ? 6 : 4, big ? 5 : 3);
    comps = L.rockComponents().sort((a, b) => b.size - a.size);
    playerSite = comps.find((c) => Math.hypot(c.cx - cx, c.cy - cy) < 6) || comps[0];
  }
  sites.push(playerSite);
  const enemySites = [];
  for (const e of enemyBases) {
    const need = needEnemy(e);
    const cands = comps.filter((c) => {
      if (sites.includes(c) || enemySites.includes(c) || c.size < need) return false;
      L.bestCenter(c, big ? 5 : 3);
      return c.density >= (big ? 55 : 20);
    });
    let best = null;
    let bestScore = -Infinity;
    for (const c of cands) {
      const dPlayer = Math.hypot(c.cx - playerSite.cx, c.cy - playerSite.cy);
      let dOthers = Infinity;
      for (const s of enemySites) dOthers = Math.min(dOthers, Math.hypot(c.cx - s.cx, c.cy - s.cy));
      const score = Math.min(dPlayer, dOthers * 1.2) + Math.min(c.size, 200) * 0.03;
      if (dPlayer < (big ? 18 : 10)) continue;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) {
      if (attempt < 40 && !forceCarve) return null;
      // carve a plateau far from the player
      let fx = L.w - playerSite.cx;
      let fy = L.h - playerSite.cy;
      fx = Math.max(8, Math.min(L.w - 8, fx + rng.randInt(-6, 6) + enemySites.length * 10));
      fy = Math.max(8, Math.min(L.h - 8, fy + rng.randInt(-6, 6) - enemySites.length * 10));
      L.carvePlateau(fx, fy, big ? 8 : 4, big ? 7 : 4);
      comps = L.rockComponents().sort((a, b) => b.size - a.size);
      best = comps.find((c) => Math.hypot(c.cx - fx, c.cy - fy) < 6) || comps[0];
    }
    enemySites.push(best);
  }
  // site centers: densest rock spot of the component
  const centerOf = (c) => L.bestCenter(c, big ? 5 : 3);
  const [pcx, pcy] = centerOf(playerSite);
  // player: construction yard + army
  const cy = L.placeNear(playerHouse, 'constructionYard', pcx, pcy, 8, 0);
  if (!cy) return null;
  const baseCenterP = [cy[0] + 1, cy[1] + 1];
  placeArmy(L, playerHouse, tpl.player, baseCenterP[0], baseCenterP[1] + 2, { mode: 'Guard', radius: 4 });
  // enemies
  const enemyCenters = [];
  let ebi = 0;
  tpl.enemy.forEach((e, idx) => {
    const house = enemies[idx] ?? enemies[0];
    if (e.base) {
      const site = enemySites[ebi++];
      const [ecx, ecy] = centerOf(site);
      const dir = [baseCenterP[0] - ecx, baseCenterP[1] - ecy];
      let baseList = e.base;
      if (tpl.palaceVariants && !tpl.palaceVariants.includes(idx)) baseList = baseList.replace(/,?palace/, '');
      if (tpl.palaceVariants && level === 8) {
        // only one of the two bases has a palace depending on the region variant
        const withPalace = tpl.palaceVariants[variant % tpl.palaceVariants.length];
        if (idx !== withPalace) baseList = baseList.replace(/,?palace/, '');
        else if (!/palace/.test(baseList)) baseList += ',palace';
      }
      const b = buildBase(L, house, ecx, ecy, baseList, dir[0], dir[1]);
      enemyCenters.push([b.cx, b.cy]);
      placeArmy(L, house, e.units, Math.round(b.cx + Math.sign(dir[0]) * 3), Math.round(b.cy + Math.sign(dir[1]) * 3), { mode: 'Area Guard', radius: 7 });
    } else {
      // no base: infantry spread between player and far side
      const fx = Math.round(L.w - baseCenterP[0]);
      const fy = Math.round(L.h * 0.3);
      enemyCenters.push([fx, fy]);
      placeArmy(L, house, e.units, fx, fy, { ambushRatio: e.ambushRatio ?? 0.7, spread: Math.floor(L.w / 4), radius: 4 });
    }
  });
  // spice near player and enemies
  const fields = [];
  const ensureSpice = (x, y, minCount, rMin, rMax) => {
    if (spiceAround(L, x, y, rMax) >= minCount) return;
    for (let i = 0; i < 80; i++) {
      const a = rng.rand() * Math.PI * 2;
      const r = rng.randFloat(rMin, rMax);
      const fx = Math.round(x + Math.cos(a) * r);
      const fy = Math.round(y + Math.sin(a) * r);
      if (!L.inb(fx, fy)) continue;
      const t = L.t(fx, fy);
      if (t === T.SAND || t === T.DUNES) {
        fields.push([fx, fy]);
        return;
      }
    }
  };
  ensureSpice(baseCenterP[0], baseCenterP[1], big ? 30 : 12, 4, big ? 11 : 7);
  if (level <= 2) ensureSpice(baseCenterP[0], baseCenterP[1], big ? 50 : 22, 5, big ? 13 : 9);
  for (const [ex, ey] of enemyCenters) ensureSpice(Math.round(ex), Math.round(ey), 20, 5, 12);
  // spice blooms on open sand (from level 2)
  if (level >= 2) {
    const nb = big ? rng.randInt(2, 4) : 1;
    for (let i = 0; i < nb; i++) {
      const p = L.freeTileNear(rng.randInt(4, L.w - 5), rng.randInt(4, L.h - 5), 10, (x, y, t) => t === T.SAND && Math.hypot(x - baseCenterP[0], y - baseCenterP[1]) > 8);
      if (p) L.types[p[1] * L.w + p[0]] = T.SPICE_BLOOM;
    }
  }
  // worms on sand, away from bases
  const wormHouse = H.FREMEN;
  for (let i = 0; i < (tpl.worms || 0); i++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = rng.randInt(2, L.w - 3);
      const y = rng.randInt(2, L.h - 3);
      const t = L.t(x, y);
      if ((t === T.SAND || t === T.DUNES || t === T.SPICE) && !L.occ[y * L.w + x] && Math.hypot(x - baseCenterP[0], y - baseCenterP[1]) > 14) {
        L.addUnit(wormHouse, 'sandworm', x, y, 'Ambush');
        break;
      }
    }
  }
  // houses
  const houses = {};
  houses[playerHouse] = { credits: tpl.credits, quota: tpl.quota || 0, maxUnit: 25 };
  enemies.forEach((e, i) => {
    houses[e] = { credits: tpl.enemyCredits?.[i] ?? 500, quota: 0, maxUnit: 25 };
  });
  if ((tpl.enemyReinf || []).some((r) => r.startsWith('S:'))) houses[H.SARDAUKAR] = houses[H.SARDAUKAR] || { credits: 0, quota: 0, maxUnit: 25 };
  if (tpl.worms) houses[wormHouse] = houses[wormHouse] || { credits: 0, quota: 0, maxUnit: 25 };
  // reinforcements
  const reinforcements = [];
  for (const r of tpl.enemyReinf || []) reinforcements.push(...parseReinf(r, playerHouse, enemies, false));
  for (const r of tpl.playerReinf || []) reinforcements.push(...parseReinf(r, playerHouse, enemies, true));
  const choam = tpl.choam ? tpl.choam.split(',').map((p) => {
    const [t, n] = p.split(':');
    return [t.trim(), parseInt(n, 10)];
  }) : null;
  const quotaLevel = !!tpl.quota;
  const meta = {
    winFlags: level === 1 ? 6 : level === 2 ? 7 : 3,
    loseFlags: level === 1 ? 4 : level === 2 ? 5 : 1,
    techLevel: Math.min(8, level),
    houses,
    fields,
    reinforcements,
    choam,
  };
  return {
    ini: toIni(L, meta),
    playerHouse,
    level,
    variant,
    quota: tpl.quota || 0,
    techLevel: meta.techLevel,
    objective: quotaLevel ? (level === 2 ? `Accumulate ${tpl.quota} credits of spice or destroy the enemy base` : `Accumulate ${tpl.quota} credits of spice`) : 'Destroy all enemy structures',
    enemies,
    startView: baseCenterP,
  };
}

// ---------------------------------------------------------------------------
// Random skirmish map
// ---------------------------------------------------------------------------
export function generateSkirmishMap(opts) {
  const { seed = 1, players = [], startCredits = 3000, worms = 2, techLevel = 8, mapScale = 0 } = opts;
  for (let attempt = 0; attempt < 80; attempt++) {
    const s = hashSeed('skirmish', seed, attempt);
    const rng = new Random(s);
    const terr = terrainFromSeed(s & 0xffff, mapScale);
    const L = new Layout(terr.w, terr.h, terr.types, rng);
    let comps = L.rockComponents().filter((c) => {
      if (c.size < 45) return false;
      L.bestCenter(c, 5);
      return c.density >= 70;
    }).sort((a, b) => b.size - a.size);
    if (comps.length < players.length && attempt < 70) continue;
    // choose sites maximizing pairwise distance
    const chosen = [];
    for (let i = 0; i < players.length; i++) {
      let best = null;
      let bs = -1;
      for (const c of comps) {
        if (chosen.includes(c)) continue;
        let d = chosen.length ? Infinity : Math.min(c.size, 200);
        for (const o of chosen) d = Math.min(d, Math.hypot(c.cx - o.cx, c.cy - o.cy));
        if (d > bs) {
          bs = d;
          best = c;
        }
      }
      if (!best) {
        const a = (i / players.length) * Math.PI * 2;
        const fx = L.w / 2 + Math.cos(a) * L.w * 0.32;
        const fy = L.h / 2 + Math.sin(a) * L.h * 0.32;
        L.carvePlateau(fx, fy, 7, 6);
        comps = L.rockComponents();
        best = comps.find((c) => Math.hypot(c.cx - fx, c.cy - fy) < 6) || comps[0];
      }
      chosen.push(best);
    }
    if (chosen.length < 2) continue;
    const minDist = Math.min(...chosen.flatMap((a, i) => chosen.slice(i + 1).map((b) => Math.hypot(a.cx - b.cx, a.cy - b.cy))));
    if (minDist < 22 && attempt < 70) continue;
    const houses = {};
    const starts = [];
    players.forEach((p, i) => {
      const c = chosen[i];
      const [x, y] = L.bestCenter(c, 5);
      const pcy = L.placeNear(p.house, 'constructionYard', x, y, 8, 0);
      houses[p.house] = { credits: startCredits, quota: 0, maxUnit: 0 };
      if (pcy) {
        starts.push([pcy[0] + 1, pcy[1] + 1]);
        const armyList = p.house === H.HARKONNEN ? 'trooper*3,quad*2' : p.house === H.ORDOS ? 'soldier*3,raider*2' : 'soldier*3,trike*2';
        placeArmy(L, p.house, armyList, pcy[0] + 1, pcy[1] + 3, { mode: 'Guard', radius: 4 });
      }
    });
    const fields = [];
    for (const [sx, sy] of starts) {
      if (spiceAround(L, sx, sy, 12) < 40) {
        for (let i = 0; i < 60; i++) {
          const a = rng.rand() * Math.PI * 2;
          const r = rng.randFloat(5, 11);
          const fx = Math.round(sx + Math.cos(a) * r);
          const fy = Math.round(sy + Math.sin(a) * r);
          if (L.inb(fx, fy) && (L.t(fx, fy) === T.SAND || L.t(fx, fy) === T.DUNES)) {
            fields.push([fx, fy]);
            break;
          }
        }
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = L.freeTileNear(rng.randInt(5, L.w - 6), rng.randInt(5, L.h - 6), 10, (x, y, t) => t === T.SAND);
      if (p) L.types[p[1] * L.w + p[0]] = T.SPICE_BLOOM;
    }
    if (worms > 0) {
      houses[H.FREMEN] = houses[H.FREMEN] || { credits: 0, quota: 0, maxUnit: 0 };
      for (let i = 0; i < worms; i++) {
        for (let tries = 0; tries < 80; tries++) {
          const x = rng.randInt(2, L.w - 3);
          const y = rng.randInt(2, L.h - 3);
          const t = L.t(x, y);
          if ((t === T.SAND || t === T.DUNES) && !L.occ[y * L.w + x] && starts.every(([sx, sy]) => Math.hypot(x - sx, y - sy) > 14)) {
            L.addUnit(H.FREMEN, 'sandworm', x, y, 'Ambush');
            break;
          }
        }
      }
    }
    const choam = [['trike', 5], ['quad', 5], ['tank', 6], ['launcher', 5], ['siegeTank', 6], ['harvester', 4], ['mcv', 2], ['carryall', 3], ['ornithopter', 5]];
    const meta = { winFlags: 3, loseFlags: 1, techLevel, houses, fields, reinforcements: [], choam };
    return { ini: toIni(L, meta), starts };
  }
  return null;
}
