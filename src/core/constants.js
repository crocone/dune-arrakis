// Core constants shared by simulation and rendering.
// Simulation timing mirrors Dune Legacy: one game cycle = 16 ms (62.5 Hz),
// one tile = 64 "world pixels". All per-cycle values from ObjectData are kept as-is.

export const CYCLE_MS = 16;
export const CYCLES_PER_SECOND = 1000 / CYCLE_MS; // 62.5
export const TILESIZE = 64; // world pixels per tile (Dune Legacy)

export const msToCycles = (ms) => Math.floor(ms / CYCLE_MS);

// Terrain types
export const T = {
  SAND: 0,
  DUNES: 1,
  ROCK: 2,
  MOUNTAIN: 3,
  SPICE: 4,
  THICK_SPICE: 5,
  SPICE_BLOOM: 6,
  SPECIAL_BLOOM: 7,
  SLAB: 8,
};

export const TERRAIN_NAMES = ['Sand', 'Dunes', 'Rock', 'Mountains', 'Spice', 'Thick spice', 'Spice bloom', 'Special bloom', 'Concrete'];

export const isSandLike = (t) => t === T.SAND || t === T.DUNES || t === T.SPICE || t === T.THICK_SPICE || t === T.SPICE_BLOOM || t === T.SPECIAL_BLOOM;
export const isRockLike = (t) => t === T.ROCK || t === T.SLAB || t === T.MOUNTAIN;
export const isSpice = (t) => t === T.SPICE || t === T.THICK_SPICE;

// Houses
export const H = {
  HARKONNEN: 0,
  ATREIDES: 1,
  ORDOS: 2,
  FREMEN: 3,
  SARDAUKAR: 4,
  MERCENARY: 5,
};
export const HOUSE_COUNT = 6;
export const HOUSE_KEYS = ['harkonnen', 'atreides', 'ordos', 'fremen', 'sardaukar', 'mercenary'];
export const HOUSE_LETTER = ['H', 'A', 'O', 'F', 'S', 'M'];
export const HOUSE_NAMES = ['Harkonnen', 'Atreides', 'Ordos', 'Fremen', 'Sardaukar', 'Mercenaries'];
export const HOUSE_NAMES_EN = ['Harkonnen', 'Atreides', 'Ordos', 'Fremen', 'Sardaukar', 'Mercenary'];
export const HOUSE_COLORS = [0xc8302c, 0x2f6fd6, 0x2f9a4a, 0xb59a74, 0x8a3fb8, 0xd9922a];
export const HOUSE_COLORS_CSS = ['#d23a33', '#3b7de0', '#36a957', '#c2a67f', '#9a4fca', '#e39d30'];

export function houseFromName(name) {
  const n = String(name).trim().toLowerCase();
  const idx = HOUSE_NAMES_EN.findIndex((h) => h.toLowerCase() === n);
  return idx;
}

// Eight compass directions (Dune Legacy angles: 0 = right/east, counter-clockwise in screen space)
export const DIRS8 = [
  [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1],
];

export const DIFFICULTY = { EASY: 0, MEDIUM: 1, HARD: 2 };
