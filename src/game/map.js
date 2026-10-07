import { T, isSandLike, isSpice } from '../core/constants.js';

export const MAX_TEAMS = 8;
export const FOGTIME = 625; // cycles (10 s)
export const RANDOM_SPICE_MIN = 74;
export const RANDOM_SPICE_MAX = 148;
export const RANDOM_THICK_SPICE_MIN = 148;
export const RANDOM_THICK_SPICE_MAX = 296;

export const INFANTRY_SLOTS = 5;
// Sub-tile infantry positions (fractions of a tile): center + 4 corners (Dune Legacy InfantryBase)
export const INFANTRY_OFFSETS = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

// Speed factor per terrain: speed * (2 - difficulty)
// Wheeled + infantry: GroundUnit::getTerrainDifficulty; tracked: TrackedUnit::getTerrainDifficulty
const TRACKED_DIFFICULTY = {
  [T.SLAB]: 1.0,
  [T.SAND]: 1.5625,
  [T.ROCK]: 1.375,
  [T.DUNES]: 1.375,
  [T.MOUNTAIN]: 1.0,
  [T.SPICE]: 1.375,
  [T.THICK_SPICE]: 1.375,
  [T.SPICE_BLOOM]: 1.5625,
  [T.SPECIAL_BLOOM]: 1.5625,
};
const GROUND_DIFFICULTY = {
  [T.SLAB]: 1.0,
  [T.SAND]: 1.375,
  [T.ROCK]: 1.5625,
  [T.DUNES]: 1.375,
  [T.MOUNTAIN]: 1.0,
  [T.SPICE]: 1.375,
  [T.THICK_SPICE]: 1.375,
  [T.SPICE_BLOOM]: 1.375,
  [T.SPECIAL_BLOOM]: 1.375,
};
const WORM_DIFFICULTY = {
  [T.SLAB]: 1.0,
  [T.SAND]: 1.25,
  [T.ROCK]: 1.0,
  [T.DUNES]: 1.25,
  [T.MOUNTAIN]: 1.0,
  [T.SPICE]: 1.25,
  [T.THICK_SPICE]: 1.25,
  [T.SPICE_BLOOM]: 1.25,
  [T.SPECIAL_BLOOM]: 1.25,
};

// moveClass: 'wheeled' | 'infantry' | 'tracked' | 'worm' | 'air'
export function terrainDifficulty(type, moveClass) {
  if (moveClass === 'air') return 1;
  const table = moveClass === 'tracked' ? TRACKED_DIFFICULTY : moveClass === 'worm' ? WORM_DIFFICULTY : GROUND_DIFFICULTY;
  return table[type] ?? 1;
}

export function terrainSpeedFactor(type, moveClass) {
  return 2 - terrainDifficulty(type, moveClass);
}

export class GameMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.types = new Uint8Array(n);
    this.spice = new Float32Array(n);
    this.damage = new Uint8Array(n); // cosmetic craters
    this.tracks = new Uint16Array(n); // cosmetic
    // occupancy
    this.ground = new Int32Array(n); // non-infantry ground object id (unit or structure), 0 = none
    this.infantry = new Int32Array(n * INFANTRY_SLOTS);
    this.air = new Int32Array(n); // last air unit hovering (not blocking)
    this.underground = new Int32Array(n); // sandworm
    this.tileOwner = new Int8Array(n).fill(-1); // house owning the tile (for build range)
    this.sandRegion = new Int32Array(n).fill(-1);
    this.pathRevision = 0;
    // shroud / fog per team: cycle when the tile was last seen (-1 = never explored)
    this.seen = [];
    for (let t = 0; t < MAX_TEAMS; t++) this.seen.push(new Int32Array(n).fill(-1));
    this.cycle = 0;
    this.dirtyTerrain = []; // list of [x,y] changed tiles for renderer
    this.spiceDirty = true;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  idx(x, y) {
    return y * this.width + x;
  }

  getType(x, y) {
    return this.types[y * this.width + x];
  }

  setType(x, y, t) {
    const i = y * this.width + x;
    if (this.types[i] === t) return;
    this.types[i] = t;
    if (!isSpice(t)) this.spice[i] = 0;
    this.dirtyTerrain.push([x, y]);
    this.spiceDirty = true;
  }

  isSand(x, y) {
    return isSandLike(this.getType(x, y));
  }

  isRock(x, y) {
    const t = this.getType(x, y);
    return t === T.ROCK || t === T.SLAB || t === T.MOUNTAIN;
  }

  // Build surface: rock or slab (not mountain)
  isBuildable(x, y) {
    const t = this.getType(x, y);
    return t === T.ROCK || t === T.SLAB;
  }

  hasGroundObject(x, y) {
    return this.ground[this.idx(x, y)] !== 0;
  }

  infantryCount(x, y) {
    const base = this.idx(x, y) * INFANTRY_SLOTS;
    let c = 0;
    for (let k = 0; k < INFANTRY_SLOTS; k++) if (this.infantry[base + k]) c++;
    return c;
  }

  freeInfantrySlot(x, y) {
    const base = this.idx(x, y) * INFANTRY_SLOTS;
    for (let k = 0; k < INFANTRY_SLOTS; k++) if (!this.infantry[base + k]) return k;
    return -1;
  }

  infantryIds(x, y) {
    const out = [];
    const base = this.idx(x, y) * INFANTRY_SLOTS;
    for (let k = 0; k < INFANTRY_SLOTS; k++) if (this.infantry[base + k]) out.push(this.infantry[base + k]);
    return out;
  }

  // Spice
  getSpice(x, y) {
    return this.spice[this.idx(x, y)];
  }

  // Tile::harvestSpice — returns amount actually removed (float amounts allowed)
  harvestSpice(x, y, amount) {
    const i = this.idx(x, y);
    const t = this.types[i];
    if (!isSpice(t)) return 0;
    const take = Math.min(amount, this.spice[i]);
    this.spice[i] -= take;
    this.spiceDirty = true;
    if (t === T.THICK_SPICE && this.spice[i] < RANDOM_THICK_SPICE_MIN) {
      this.types[i] = T.SPICE;
      this.dirtyTerrain.push([x, y]);
      this.spiceRemoved(x, y);
    } else if (this.spice[i] <= 0) {
      this.spice[i] = 0;
      this.types[i] = T.SAND;
      this.dirtyTerrain.push([x, y]);
      this.spiceRemoved(x, y);
    }
    return take;
  }

  // Map::spiceRemoved — orthogonal thick spice neighbours degrade to normal spice
  spiceRemoved(x, y) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;
      const j = this.idx(nx, ny);
      if (this.types[j] === T.THICK_SPICE) {
        this.types[j] = T.SPICE;
        this.dirtyTerrain.push([nx, ny]);
      }
    }
  }

  // set a tile to spice with a random amount (RANDOMSPICEMIN..MAX)
  setSpice(x, y, thick, rng) {
    const i = this.idx(x, y);
    this.types[i] = thick ? T.THICK_SPICE : T.SPICE;
    this.spice[i] = thick ? rng.randInt(RANDOM_THICK_SPICE_MIN, RANDOM_THICK_SPICE_MAX) : rng.randInt(RANDOM_SPICE_MIN, RANDOM_SPICE_MAX);
    this.dirtyTerrain.push([x, y]);
    this.spiceDirty = true;
  }

  // Fog of war helpers (Dune Legacy: tiles get fogged FOGTIME cycles after last being seen)
  isExplored(team, x, y) {
    return this.seen[team][this.idx(x, y)] >= 0;
  }

  isFogged(team, x, y) {
    const s = this.seen[team][this.idx(x, y)];
    return s < 0 || this.cycle - s > FOGTIME;
  }

  // Map::viewMap - reveal tiles with blockDistanceApprox <= range
  viewMap(team, cx, cy, range) {
    const seen = this.seen[team];
    const c = this.cycle;
    for (let y = Math.max(0, cy - range); y <= Math.min(this.height - 1, cy + range); y++) {
      const dy = Math.abs(y - cy);
      for (let x = Math.max(0, cx - range); x <= Math.min(this.width - 1, cx + range); x++) {
        const dx = Math.abs(x - cx);
        const mx = dx > dy ? dx : dy;
        const mn = dx > dy ? dy : dx;
        if (Math.round((2 * mx + mn) / 2) <= range) seen[y * this.width + x] = c;
      }
    }
  }

  revealAll(team) {
    this.seen[team].fill(this.cycle);
  }

  // Find nearest tile (spiral search) satisfying predicate
  findNearest(cx, cy, maxR, pred) {
    if (this.inBounds(cx, cy) && pred(cx, cy)) return [cx, cy];
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bd = Infinity;
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
          if (!this.inBounds(x, y)) continue;
          if (!pred(x, y)) continue;
          const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d < bd) {
            bd = d;
            best = [x, y];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  takeDirtyTerrain() {
    const d = this.dirtyTerrain;
    this.dirtyTerrain = [];
    return d;
  }
}
