// mapseed_port.js
// 1:1 port of the Dune II seed-based map generator from Dune Legacy (src/MapSeed.cpp, function
// createMapWithSeed(Uint32, Uint16*)), which in turn is a translation of
// the original Dune II assembly code.
//
// Verified by bitwise comparison against the original C++ (compiled with MSVC) on a large
// set of seeds — see docs/research/03_structures_economy_ai.md, section 9.
//
// ES module, no dependencies.
//
//   import { createMapFromSeed, cropForMapScale } from './mapseed_port.js';
//   const m = createMapFromSeed(1498);        // {width:64,height:64,tiles:[...],raw:Uint16Array}
//   const play = cropForMapScale(m, 0);       // 62x62 play area (MapScale=0)
//
// All integer operations replicate C semantics (Uint8/Uint16/Sint16/Uint32),
// including the original's "quirks" (x=64 wrapping to the next row, Uint16 overflow
// at the dune threshold, etc.). Do NOT "fix" them — otherwise the maps will stop matching.

// ---------------------------------------------------------------------------
// Tables (copied from src/MapSeed.cpp:33-95 unchanged)
// ---------------------------------------------------------------------------

// BoolArray[v] == 1 means a "solid" type (4 = rock, 6 = mountain) — there is no spice on it
const BoolArray = [0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0];

// Offsets in the 16x16(+17) grid for "blobs" (src/MapSeed.cpp:36)
const OffsetArray1 = [
  0, -1, 1, -16, 16,
  -17, 17, -15, 15,
  -2, 2, -32, 32,
  -4, 4, -64, 64,
  -30, 30, -34, 34,
];

// 42 entries of 4 bytes (x1,y1,x2,y2) for subdividing 4x4 cells (src/MapSeed.cpp:45)
const OffsetArray2 = [
  0, 0, 4, 0, 4, 0, 4, 4, 0, 0, 0, 4, 0, 4, 4, 4, 0, 0, 0, 2, 0,
  2, 0, 4, 0, 0, 2, 0, 2, 0, 4, 0, 4, 0, 4, 2, 4, 2, 4, 4, 0, 4,
  2, 4, 2, 4, 4, 4, 0, 0, 4, 4, 2, 0, 2, 2, 0, 0, 2, 2, 4, 0, 2,
  2, 0, 2, 2, 2, 2, 2, 4, 2, 2, 2, 0, 4, 2, 2, 4, 4, 2, 2, 2, 4,
  0, 0, 4, 0, 4, 0, 4, 4, 0, 0, 0, 4, 0, 4, 4, 4, 0, 0, 0, 2, 0,
  2, 0, 4, 0, 0, 2, 0, 2, 0, 4, 0, 4, 0, 4, 2, 4, 2, 4, 4, 0, 4,
  2, 4, 2, 4, 4, 4, 4, 0, 0, 4, 2, 0, 2, 2, 0, 0, 2, 2, 4, 0, 2,
  2, 0, 2, 2, 2, 2, 2, 4, 2, 2, 2, 0, 4, 2, 2, 4, 4, 2, 2, 2, 4,
];

// Tile table for values > 85 (not used in practice: the maximum is 80)
const TileTypes = [
  220, 221, 222, 229, 230, 231, 213, 214, 215, 223, 224, 225, 232, 233, 234, 216,
  217, 218, 226, 227, 228, 235, 236, 237, 219, 217, 218, 226, 227, 228, 235, 236,
  237, 238, 239, 244, 245, 125, 240, 246, 247, 241, 242, 248, 249, 241, 243, 248,
  249, 241, 242, 248, 250, 241, 243, 248, 250, 251, 252, 253, 258, 259, 260, 223,
  224, 225, 232, 233, 234, 254, 255, 256, 261, 262, 263, 257, 255, 256, 261, 262,
  263, 254, 255, 256, 261, 264, 265, 257, 255, 256, 261, 264, 265, 254, 255, 256,
  261, 266, 267, 257, 255, 256, 261, 266, 267, 210, 268, 269, 273, 274, 275, 223,
  224, 225, 232, 233, 234, 270, 271, 272, 276, 277, 278, 270, 271, 272, 279, 277,
  278, 270, 271, 272, 276, 277, 278, 270, 271, 272, 279, 277, 278, 270, 271, 272,
  276, 277, 278, 270, 271, 272, 279, 277, 278, 238, 239, 244, 245, 125, 240, 246,
  247, 280, 281, 282, 283, 280, 281, 282, 284, 238, 239, 244, 245, 125, 240, 246,
  247, 285, 286, 288, 289, 287, 286, 290, 289, 143, 291, 295, 296, 125, 240, 246,
  247, 292, 293, 297, 298, 294, 293, 297, 298, 238, 239, 244, 245, 125, 240, 246,
  247, 299, 300, 301, 302, 299, 300, 301, 303, 238, 239, 244, 245, 125, 240, 246,
  247, 304, 305, 306, 307, 304, 305, 306, 308, 210, 211, 212, 220, 221, 222, 229,
  230, 231, 213, 214, 215, 223, 313, 225, 232, 233, 234, 309, 310, 311, 314, 315,
  316, 319, 320, 321, 312, 310, 311, 314, 315, 316, 319, 320, 321, 309, 310, 311,
];

// sinus[i] = 127*sin(pi*i/128) (Sint8), src/MapSeed.cpp:78
const sinus = [
  0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45,
  48, 51, 54, 57, 59, 62, 65, 67, 70, 73, 75, 78, 80, 82, 85, 87,
  89, 91, 94, 96, 98, 100, 101, 103, 105, 107, 108, 110, 111, 113, 114, 116,
  117, 118, 119, 120, 121, 122, 123, 123, 124, 125, 125, 126, 126, 126, 126, 126,
  127, 126, 126, 126, 126, 126, 125, 125, 124, 123, 123, 122, 121, 120, 119, 118,
  117, 116, 114, 113, 112, 110, 108, 107, 105, 103, 102, 100, 98, 96, 94, 91,
  89, 87, 85, 82, 80, 78, 75, 73, 70, 67, 65, 62, 59, 57, 54, 51,
  48, 45, 42, 39, 36, 33, 30, 27, 24, 21, 18, 15, 12, 9, 6, 3,
  0, -3, -6, -9, -12, -15, -18, -21, -24, -27, -30, -33, -36, -39, -42, -45,
  -48, -51, -54, -57, -59, -62, -65, -67, -70, -73, -75, -78, -80, -82, -85, -87,
  -89, -91, -94, -96, -98, -100, -102, -103, -105, -107, -108, -110, -111, -113, -114, -116,
  -117, -118, -119, -120, -121, -122, -123, -123, -124, -125, -125, -126, -126, -126, -126, -126,
  -126, -126, -126, -126, -126, -126, -125, -125, -124, -123, -123, -122, -121, -120, -119, -118,
  -117, -116, -114, -113, -112, -110, -108, -107, -105, -103, -102, -100, -98, -96, -94, -91,
  -89, -87, -85, -82, -80, -78, -75, -73, -70, -67, -65, -62, -59, -57, -54, -51,
  -48, -45, -42, -39, -36, -33, -30, -27, -24, -21, -18, -15, -12, -9, -6, -3,
];

// ---------------------------------------------------------------------------
// Dune II random number generator (src/MapSeed.cpp:167 SeedRand)
// Only the 3 low bytes of the 32-bit seed are used (p0 is the lowest byte).
// ---------------------------------------------------------------------------
function makeSeedRand(initialSeed) {
  let seed = initialSeed >>> 0;
  return function seedRand() {
    let p0 = seed & 0xff;
    let p1 = (seed >>> 8) & 0xff;
    let p2 = (seed >>> 16) & 0xff;
    const p3 = (seed >>> 24) & 0xff;

    let a = p0 >> 1;              // shr al,1
    let carry = a & 0x01;         // shr al,1 -> CF = bit 1 of the original p0
    a = a >> 1;

    let oldCarry = carry;         // rcl byte [seed+2],1
    carry = (p2 & 0x80) >> 7;
    p2 = ((p2 << 1) | oldCarry) & 0xff;

    oldCarry = carry;             // rcl byte [seed+1],1
    carry = (p1 & 0x80) >> 7;
    p1 = ((p1 << 1) | oldCarry) & 0xff;

    carry = carry === 1 ? 0 : 1;  // cmc

    a = (a - (p0 + carry)) & 0xff; // sbb al,[seed]  (result in Uint8)

    carry = a & 0x01;             // shr al,1
    p0 = ((p0 >> 1) | (carry << 7)) & 0xff; // rcr byte [seed],1

    a = p0 ^ p1;                  // xor al,[seed+1]

    seed = (p0 | (p1 << 8) | (p2 << 16) | (p3 << 24)) >>> 0;
    return a; // 0..255
  };
}

// (x | (y << 6)) — deliberately a bitwise OR, exactly as in the original (src/MapSeed.cpp:103)
function idx(x, y) {
  return x | (y << 6);
}
function idxOOB(x, y) {
  return idx(x & 0x3f, y);
}

// src/MapSeed.cpp:125 SmoothNeighbourhood
function smoothNeighbourhood(index, map) {
  const tileType = map[index];
  if (tileType === 8) {
    map[index] = 9;
    smoothNeighbourhood(index, map);
  } else if (tileType === 9) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const pos = idx((index & 0x3f) + dx, ((index >> 6) & 0x3f) + dy);
        if (pos < 0) continue;
        if (pos >= 64 * 64) continue;
        if (BoolArray[map[pos]] === 1) {
          map[index] = 8;
          continue;
        } else {
          if (map[pos] === 9) continue;
          map[pos] = 8;
        }
      }
    }
  } else {
    if (BoolArray[tileType] === 0) {
      map[index] = 8;
    }
  }
}

/**
 * Generates a "raw" 64x64 map the way Dune II does.
 * @param {number} paraSeed the [MAP] Seed= value (Uint32)
 * @returns {Uint16Array} 4096 Dune II tile values (127..207); type = value >> 4
 */
export function createRawMapFromSeed(paraSeed) {
  const seedRand = makeSeedRand(paraSeed);

  // Uint8 Array4x4TerrainGrid[16*16+16+1]; element [272] is uninitialized in C,
  // but it never ends up in the result (only 0..255 are read).
  const grid = new Uint8Array(16 * 16 + 16 + 1);
  // Uint32 MapArray[65*65]; elements >= 4096 are always 0
  const map = new Uint32Array(65 * 65);

  let i, j, index, randNum;

  // 1) coarse 16x16(+16) grid: heights 0..10
  for (i = 0; i < 16 * 16 + 16; i++) {
    grid[i] = seedRand() & 0x0f;
    if (grid[i] <= 0x0a) continue;
    grid[i] = 0x0a;
  }

  // 2) 1..16 "blobs": add a random value (mod 16) at 21 points around the center
  for (i = seedRand() & 0x0f; i >= 0; i--) {
    randNum = seedRand() & 0xff;
    for (j = 0; j < 21; j++) {
      index = randNum + OffsetArray1[j];
      index = index >= 0 ? index : 0;
      index = index <= 16 * 16 + 16 ? index : 16 * 16 + 16;
      grid[index] = (grid[index] + (seedRand() & 0x0f)) & 0x0f;
    }
  }

  // 3) 1..4 "depressions": assign 0..3
  for (i = seedRand() & 0x03; i >= 0; i--) {
    randNum = seedRand() & 0xff;
    for (j = 0; j < 21; j++) {
      index = randNum + OffsetArray1[j];
      index = index >= 0 ? index : 0;
      index = index <= 16 * 16 + 16 ? index : 16 * 16 + 16;
      grid[index] = seedRand() & 0x03;
    }
  }

  // 4) lay the grid out over the map with a stride of 4
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      map[idx(x, y)] = grid[y * 4 + x / 4];
    }
  }

  // 5) subdivision: segment midpoints according to the OffsetArray2 table
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const base = x % 8 === 0 ? 21 : 0;
      for (i = base; base + 21 > i; i++) {
        let p1 = idx(x + OffsetArray2[4 * i], y + OffsetArray2[4 * i + 1]);
        let p2 = idx(x + OffsetArray2[4 * i + 2], y + OffsetArray2[4 * i + 3]);
        const pos = ((p1 + p2) / 2) | 0; // int division, then Uint16 (always >= 0)
        if (pos >= 64 * 64) continue;
        p1 = idxOOB(x + OffsetArray2[4 * i], y + OffsetArray2[4 * i + 1]);
        p2 = idxOOB(x + OffsetArray2[4 * i + 2], y + OffsetArray2[4 * i + 3]);
        map[pos] = Math.floor((map[p1] + map[p2] + 1) / 2);
      }
    }
  }

  // 6) 3x3 box filter (not in-place: the original values of the row above/current/below are used)
  {
    let curRow = new Uint16Array(0x80); // memset 0
    let oldRow = new Uint16Array(0x80);
    for (let y = 0; y < 64; y++) {
      oldRow = Uint16Array.from(curRow);
      for (i = 0; i < 64; i++) curRow[i] = map[y * 64 + i];
      for (let x = 0; x < 64; x++) {
        const c = curRow[x];
        const a00 = x > 0 && y > 0 ? oldRow[x - 1] : c;
        const a10 = y > 0 ? oldRow[x] : c;
        const a20 = x < 63 && y > 0 ? oldRow[x + 1] : c;
        const a01 = x > 0 ? curRow[x - 1] : c;
        const a11 = c;
        const a21 = x < 63 ? curRow[x + 1] : c;
        const a02 = x > 0 && y < 63 ? map[(y + 1) * 64 + x - 1] : c;
        const a12 = y < 63 ? map[(y + 1) * 64 + x] : c;
        const a22 = x < 63 && y < 63 ? map[(y + 1) * 64 + x + 1] : c;
        map[y * 64 + x] = Math.floor((a00 + a10 + a20 + a01 + a11 + a12 + a02 + a21 + a22) / 9);
      }
    }
  }

  // 7) thresholds: height -> type (0 sand, 2 dunes, 4 rock, 6 mountain)
  randNum = seedRand() & 0x0f;
  randNum = randNum < 8 ? 8 : randNum;
  randNum = randNum > 0x0c ? 0x0c : randNum;
  // point.y is Uint16! When (rand&3)==0 it becomes 0xFFFF, and the min() below yields randNum-3.
  let pointY = ((seedRand() & 0x03) - 1) & 0xffff;
  pointY = randNum - 3 < pointY ? randNum - 3 : pointY;

  for (i = 0; i < 64 * 64; i++) {
    const h = map[i] & 0xffff;
    if (randNum + 4 < h) {
      map[i] = 0x06;          // mountain
    } else if (h >= randNum) {
      map[i] = 0x04;          // rock
    } else if (h <= pointY) {
      map[i] = 0x02;          // dunes
    } else {
      map[i] = 0x00;          // sand
    }
  }

  // 8) spice: (rand & 0x2F) fields, each with up to 31 "drops" within a radius of ~4 tiles
  for (i = seedRand() & 0x2f; i !== 0; i--) {
    let py = seedRand() & 0x3f; // y first,
    let px = seedRand() & 0x3f; // then x
    index = idx(px, py);

    if (BoolArray[map[index]] === 1) { // on rock/mountain — retry
      i++;
      continue;
    }

    randNum = seedRand() & 0x1f;
    for (j = 0; j < randNum; j++) {
      const max = seedRand() & 0x3f;
      let pos;
      if (max === 0) {
        pos = index;
      } else {
        py = ((index << 2) & 0xff00) | 0x80;  // 8.8 fixed point, tile center
        px = ((index & 0x3f) << 8) | 0x80;

        let randNum2 = seedRand() & 0xff;
        while (randNum2 > max) randNum2 = randNum2 >> 1;

        const randNum3 = seedRand() & 0xff;

        px = (px + (((sinus[randNum3] * randNum2) >> 7) << 4)) & 0xffff;
        py = (py + ((((-1) * sinus[(randNum3 + 64) % 256] * randNum2) >> 7) << 4)) & 0xffff;

        if (px > 0x4000 || py > 0x4000) {
          pos = index;
        } else {
          pos = ((py & 0xff00) >> 2) | (px >> 8);
        }
      }

      if (pos >= 64 * 64) { // repeat this same iteration of j
        j--;
        continue;
      }

      smoothNeighbourhood(pos, map);
    }
  }

  // 9) "smoothing" — computing the neighbour mask (for sprite selection) and the final tile
  {
    let curRow = new Uint16Array(0x80);
    let oldRow = new Uint16Array(0x80);
    for (i = 0; i < 64; i++) curRow[i] = map[i];

    for (let y = 0; y < 64; y++) {
      oldRow = Uint16Array.from(curRow);
      for (i = 0; i < 64; i++) curRow[i] = map[y * 64 + i];

      for (let x = 0; x < 64; x++) {
        const center = map[y * 64 + x];
        const up = y > 0 ? oldRow[x] : center;
        const left = x > 0 ? curRow[x - 1] : center;
        const right = x < 63 ? curRow[x + 1] : center;
        const down = y < 63 ? map[(y + 1) * 64 + x] : center;

        let v = 0;
        switch (center) {
          case 4:
            if (up === 4 || up === 6) v |= 0x01;
            if (right === 4 || right === 6) v |= 0x02;
            if (down === 4 || down === 6) v |= 0x04;
            if (left === 4 || left === 6) v |= 0x08;
            break;
          case 8:
            if (up === 8 || up === 9) v |= 0x01;
            if (right === 8 || right === 9) v |= 0x02;
            if (down === 8 || down === 9) v |= 0x04;
            if (left === 8 || left === 9) v |= 0x08;
            break;
          default:
            if (up === center) v |= 0x01;
            if (right === center) v |= 0x02;
            if (down === center) v |= 0x04;
            if (left === center) v |= 0x08;
            break;
        }

        if (center === 0) v = 0;
        if (center === 4) v += 1;
        if (center === 2) v += 0x11;
        if (center === 6) v += 0x21;
        if (center === 8) v += 0x31;
        if (center === 9) v += 0x41;

        map[y * 64 + x] = v;
      }
    }
  }

  // 10) final tile numbers
  const result = new Uint16Array(64 * 64);
  for (i = 0; i < 64 * 64; i++) {
    const v = map[i];
    const t = (v & 0xfe00) | (v <= 85 ? v + 127 : TileTypes[v - 85]) | 0xf800;
    result[i] = t & 0x1ff;
  }
  return result;
}

// Type by the high nibble of the tile (src/INIMap/INIMapLoader.cpp:130-161)
export const SEED_TERRAIN = Object.freeze({
  0x7: 'sand',
  0x2: 'rock',       // "Building" — never created by the generator, treated as rock
  0x8: 'rock',
  0x9: 'dunes',
  0xa: 'mountain',
  0xb: 'spice',
  0xc: 'thickSpice',
});

export function seedTileToTerrain(rawTile) {
  return SEED_TERRAIN[rawTile >> 4] || 'sand';
}

/**
 * @param {number} seed the [MAP] Seed= value
 * @returns {{width:64,height:64,seed:number,tiles:string[],raw:Uint16Array,neighbourMask:Uint8Array}}
 *   tiles[y*64+x] — 'sand' | 'dunes' | 'rock' | 'mountain' | 'spice' | 'thickSpice'
 *   raw — original Dune II tile numbers (type = raw>>4)
 *   neighbourMask — 4-bit connectivity mask (bit0=up, bit1=right, bit2=down, bit3=left)
 *                   for autotiling; 0 for sand
 */
export function createMapFromSeed(seed) {
  const raw = createRawMapFromSeed(seed);
  const tiles = new Array(64 * 64);
  const neighbourMask = new Uint8Array(64 * 64);
  for (let i = 0; i < 64 * 64; i++) {
    tiles[i] = seedTileToTerrain(raw[i]);
    neighbourMask[i] = tiles[i] === 'sand' ? 0 : (raw[i] & 0x0f);
  }
  return { width: 64, height: 64, seed: seed >>> 0, tiles, raw, neighbourMask };
}

// MapScale -> play-area size and offset (src/INIMap/INIMapLoader.cpp:90-115)
export const MAP_SCALES = Object.freeze({
  0: { size: 62, offset: 1 },
  1: { size: 32, offset: 16 },
  2: { size: 21, offset: 11 },
});

/** Crops the play area out of the 64x64 map according to MapScale. */
export function cropForMapScale(map64, mapScale) {
  const { size, offset } = MAP_SCALES[mapScale] ?? MAP_SCALES[2];
  const tiles = new Array(size * size);
  const raw = new Uint16Array(size * size);
  const neighbourMask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y + offset) * 64 + (x + offset);
      tiles[y * size + x] = map64.tiles[s];
      raw[y * size + x] = map64.raw[s];
      neighbourMask[y * size + x] = map64.neighbourMask[s];
    }
  }
  return { width: size, height: size, offset, tiles, raw, neighbourMask };
}

/** Position from the INI (pos = y*64 + x in the logical 64x64 map) -> play-area coordinates. */
export function iniPosToXY(pos, mapScale) {
  const { offset } = MAP_SCALES[mapScale] ?? MAP_SCALES[2];
  return { x: (pos % 64) - offset, y: Math.floor(pos / 64) - offset };
}
