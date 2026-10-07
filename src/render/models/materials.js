import * as THREE from 'three';
import { HOUSE_COLORS } from '../../core/constants.js';

// ---------------------------------------------------------------------------
// Procedural textures + PBR materials shared by all unit / structure models.
// Everything is generated at runtime from canvases (no image assets).
// ---------------------------------------------------------------------------

// UV density (texture repeats per model unit) for box-projected UVs, per material.
export const UV_SCALE = {
  default: 2.4,
  tread: 6,
  concrete: 1.2,
  concreteDark: 1.2,
  sandstone: 1.6,
  cloth: 7,
  clothDark: 7,
  canvas: 4,
  worm: 2.6,
};
// materials that must not be darkened by baked ambient occlusion
export const NO_AO = new Set(['glowCyan', 'glowAmber', 'glowGreen', 'glowRed', 'glowWhite', 'accentGlow', 'glass', 'skin']);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hasDom = typeof document !== 'undefined';

function makeCanvas(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}

// periodic value noise in [0,1]
function noiseField(n, cells, rng) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const out = new Float32Array(n * n);
  const k = cells / n;
  for (let y = 0; y < n; y++) {
    const fy = y * k;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < n; x++) {
      const fx = x * k;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const a = g[(y0 % cells) * cells + (x0 % cells)];
      const b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
      const c = g[((y0 + 1) % cells) * cells + (x0 % cells)];
      const d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
      out[y * n + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

function fbm(n, base, octaves, rng) {
  const out = new Float32Array(n * n);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = noiseField(n, base << o, rng);
    for (let i = 0; i < out.length; i++) out[i] += f[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const wrap = (v, n) => ((v % n) + n) % n;

function heightToNormalCanvas(H, n, strength) {
  const c = makeCanvas(n);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const l = H[y * n + wrap(x - 1, n)];
      const r = H[y * n + wrap(x + 1, n)];
      const u = H[wrap(y - 1, n) * n + x];
      const d = H[wrap(y + 1, n) * n + x];
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * n + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(F, n, lo = 0, hi = 1, tint = null) {
  const c = makeCanvas(n);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = Math.max(0, Math.min(1, F[i]));
    const g = (lo + (hi - lo) * v) * 255;
    img.data[i * 4] = tint ? g * tint[0] : g;
    img.data[i * 4 + 1] = tint ? g * tint[1] : g;
    img.data[i * 4 + 2] = tint ? g * tint[2] : g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function disc(H, n, cx, cy, r, h) {
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const k = 1 - d / r;
      H[wrap(cy + dy, n) * n + wrap(cx + dx, n)] += h * Math.sqrt(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Texture sets: { map, normalMap, roughnessMap }
// ---------------------------------------------------------------------------
const texSets = new Map();

function buildPlating() {
  const n = 256;
  const rng = mulberry32(1337);
  const H = new Float32Array(n * n).fill(0.5);
  const A = new Float32Array(n * n).fill(0.9); // albedo multiplier
  const R = new Float32Array(n * n).fill(0.85); // roughness multiplier
  const low = fbm(n, 4, 4, rng);
  const mid = fbm(n, 16, 3, rng);
  for (let i = 0; i < n * n; i++) {
    H[i] += (mid[i] - 0.5) * 0.05;
    A[i] = 0.78 + low[i] * 0.22;
    R[i] = 0.7 + mid[i] * 0.3;
  }
  // panel layout: 2x2 big plates each split in irregular sub-plates
  const xs = [0, 96, 160];
  const ys = [0, 64, 176];
  const groove = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = wrap(y, n) * n + wrap(x, n);
        H[i] -= 0.34;
        A[i] *= 0.45;
        R[i] = 1;
      }
    }
  };
  for (const x of xs) groove(x, 0, x + 2, n);
  for (const y of ys) groove(0, y, n, y + 2);
  // plate-to-plate height steps + per-plate shading
  for (let py = 0; py < ys.length; py++) {
    for (let px = 0; px < xs.length; px++) {
      const x0 = xs[px] + 2, x1 = px + 1 < xs.length ? xs[px + 1] : n;
      const y0 = ys[py] + 2, y1 = py + 1 < ys.length ? ys[py + 1] : n;
      const dh = (rng() - 0.5) * 0.08;
      const da = 0.9 + rng() * 0.18;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = wrap(y, n) * n + wrap(x, n);
          H[i] += dh;
          A[i] *= da;
        }
      }
      // rivets along plate edges
      const step = 12;
      for (let x = x0 + 6; x < x1 - 4; x += step) {
        disc(H, n, x, y0 + 5, 2.2, 0.28);
        disc(H, n, x, y1 - 6, 2.2, 0.28);
      }
      for (let y = y0 + 6 + step; y < y1 - 8; y += step) {
        disc(H, n, x0 + 5, y, 2.2, 0.28);
        disc(H, n, x1 - 6, y, 2.2, 0.28);
      }
    }
  }
  // a couple of hatch / vent rectangles
  const rect = (x0, y0, w, h, dh, da) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = wrap(y, n) * n + wrap(x, n);
      H[i] += dh;
      A[i] *= da;
    }
  };
  for (let k = 0; k < 6; k++) rect(104, 10 + k * 8, 48, 4, -0.18, 0.55); // louver slots
  rect(20, 84, 48, 48, 0.1, 0.92);
  for (const [cx, cy] of [[24, 88], [64, 88], [24, 128], [64, 128]]) disc(H, n, cx, cy, 2.4, 0.3);
  // scratches (lighter, rougher-less)
  for (let k = 0; k < 70; k++) {
    let x = rng() * n, y = rng() * n;
    const a = rng() * Math.PI * 2;
    const len = 6 + rng() * 26;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a); y += Math.sin(a);
      const i = wrap(Math.round(y), n) * n + wrap(Math.round(x), n);
      H[i] -= 0.06;
      A[i] = Math.min(1, A[i] * 1.25);
      R[i] *= 0.55;
    }
  }
  // grime streaks (vertical oily drips)
  for (let k = 0; k < 26; k++) {
    const x = Math.floor(rng() * n);
    const y0 = Math.floor(rng() * n);
    const len = 20 + rng() * 60;
    const w = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < len; s++) {
      const f = 1 - s / len;
      for (let dx = 0; dx < w; dx++) {
        const i = wrap(y0 + s, n) * n + wrap(x + dx, n);
        A[i] *= 1 - 0.28 * f;
        R[i] = Math.min(1, R[i] + 0.1 * f);
      }
    }
  }
  return {
    map: tex(grayCanvas(A, n, 0, 1, [1, 0.985, 0.96]), true),
    normalMap: tex(heightToNormalCanvas(H, n, 3.4), false),
    roughnessMap: tex(grayCanvas(R, n), false),
  };
}

function buildConcrete() {
  const n = 256;
  const rng = mulberry32(777);
  const H = new Float32Array(n * n);
  const A = new Float32Array(n * n);
  const R = new Float32Array(n * n);
  const big = fbm(n, 3, 3, rng);
  const fine = fbm(n, 32, 3, rng);
  for (let i = 0; i < n * n; i++) {
    H[i] = fine[i] * 0.35 + big[i] * 0.2;
    A[i] = 0.72 + big[i] * 0.28 - (fine[i] - 0.5) * 0.12;
    R[i] = 0.9 + fine[i] * 0.1;
  }
  // expansion joints (slab edges)
  for (let k = 0; k < n; k++) {
    for (let w = 0; w < 2; w++) {
      for (const [x, y] of [[k, w], [w, k], [k, 128 + w], [128 + w, k]]) {
        const i = wrap(y, n) * n + wrap(x, n);
        H[i] -= 0.45;
        A[i] *= 0.5;
      }
    }
  }
  // hairline cracks
  for (let c = 0; c < 9; c++) {
    let x = rng() * n, y = rng() * n;
    let a = rng() * Math.PI * 2;
    for (let s = 0; s < 70; s++) {
      a += (rng() - 0.5) * 0.7;
      x += Math.cos(a); y += Math.sin(a);
      const i = wrap(Math.round(y), n) * n + wrap(Math.round(x), n);
      H[i] -= 0.35;
      A[i] *= 0.62;
    }
  }
  // pits / aggregate
  for (let k = 0; k < 220; k++) {
    const x = Math.floor(rng() * n), y = Math.floor(rng() * n);
    disc(H, n, x, y, 1.5 + rng() * 1.5, -0.25);
    A[wrap(y, n) * n + wrap(x, n)] *= 0.7;
  }
  // oil / sand stains
  const stain = fbm(n, 5, 2, rng);
  for (let i = 0; i < n * n; i++) if (stain[i] > 0.62) A[i] *= 0.82;
  return {
    map: tex(grayCanvas(A, n, 0, 1, [1, 0.985, 0.95]), true),
    normalMap: tex(heightToNormalCanvas(H, n, 2.2), false),
    roughnessMap: tex(grayCanvas(R, n), false),
  };
}

function buildSandstone() {
  const n = 256;
  const rng = mulberry32(4242);
  const H = new Float32Array(n * n);
  const A = new Float32Array(n * n);
  const R = new Float32Array(n * n);
  const big = fbm(n, 4, 3, rng);
  const fine = fbm(n, 40, 2, rng);
  for (let i = 0; i < n * n; i++) {
    H[i] = fine[i] * 0.3 + big[i] * 0.15;
    A[i] = 0.78 + big[i] * 0.22;
    R[i] = 0.88 + fine[i] * 0.12;
  }
  // brick bond: rows 32px, blocks 64px with half offset
  for (let row = 0; row < 8; row++) {
    const y0 = row * 32;
    const off = (row % 2) * 32;
    const shade = [];
    for (let b = 0; b < 4; b++) shade.push(0.9 + rng() * 0.18);
    for (let b = 0; b < 4; b++) {
      const bx = b * 64 + off;
      for (let y = y0 + 2; y < y0 + 32; y++) {
        for (let x = bx + 2; x < bx + 64; x++) {
          const i = wrap(y, n) * n + wrap(x, n);
          A[i] *= shade[b];
          H[i] += (shade[b] - 1) * 0.5;
        }
      }
      for (let y = y0; y < y0 + 32; y++) for (let w = 0; w < 2; w++) {
        const i = wrap(y, n) * n + wrap(bx + w, n);
        H[i] -= 0.55;
        A[i] *= 0.55;
      }
    }
    for (let x = 0; x < n; x++) for (let w = 0; w < 2; w++) {
      const i = wrap(y0 + w, n) * n + x;
      H[i] -= 0.55;
      A[i] *= 0.55;
    }
  }
  // erosion pits
  for (let k = 0; k < 160; k++) disc(H, n, Math.floor(rng() * n), Math.floor(rng() * n), 1.6 + rng() * 2.2, -0.3);
  return {
    map: tex(grayCanvas(A, n, 0, 1, [1, 0.97, 0.92]), true),
    normalMap: tex(heightToNormalCanvas(H, n, 2.6), false),
    roughnessMap: tex(grayCanvas(R, n), false),
  };
}

function buildTread() {
  const n = 128;
  const rng = mulberry32(99);
  const H = new Float32Array(n * n);
  const A = new Float32Array(n * n);
  const R = new Float32Array(n * n).fill(0.9);
  const f = fbm(n, 16, 2, rng);
  // track links along X: 8 links per tile, each with a raised cleat and a pin line
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = x % 16;
      let h = 0.4;
      if (px < 2) h = 0.0;
      else if (px < 5) h = 0.55 + (px - 2) * 0.1;
      else if (px < 11) h = 0.85;
      else h = 0.55;
      // cleat notches across the width
      if (px >= 5 && px < 11 && (y % 32) < 3) h -= 0.3;
      const i = y * n + x;
      H[i] = h + (f[i] - 0.5) * 0.15;
      A[i] = 0.55 + h * 0.45 + (f[i] - 0.5) * 0.25;
    }
  }
  return {
    map: tex(grayCanvas(A, n, 0, 1), true),
    normalMap: tex(heightToNormalCanvas(H, n, 2.6), false),
    roughnessMap: tex(grayCanvas(R, n), false),
  };
}

function buildCloth() {
  const n = 128;
  const rng = mulberry32(31);
  const H = new Float32Array(n * n);
  const A = new Float32Array(n * n);
  const R = new Float32Array(n * n).fill(1);
  const f = fbm(n, 8, 3, rng);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const warp = Math.sin((x / 4) * Math.PI);
      const weft = Math.sin((y / 4) * Math.PI);
      const over = ((x >> 2) + (y >> 2)) % 2 === 0;
      const h = over ? 0.5 + 0.5 * warp * 0.5 : 0.5 + 0.5 * weft * 0.5;
      const i = y * n + x;
      H[i] = h + (f[i] - 0.5) * 0.2;
      A[i] = 0.72 + h * 0.2 + f[i] * 0.2;
    }
  }
  return {
    map: tex(grayCanvas(A, n, 0, 1), true),
    normalMap: tex(heightToNormalCanvas(H, n, 1.6), false),
    roughnessMap: tex(grayCanvas(R, n), false),
  };
}

function buildWorm() {
  const n = 256;
  const rng = mulberry32(555);
  const H = new Float32Array(n * n);
  const A = new Float32Array(n * n);
  const R = new Float32Array(n * n).fill(0.9);
  const f = fbm(n, 12, 4, rng);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // horizontal segment rings with small scales
      const ring = Math.sin((y / n) * Math.PI * 2 * 12);
      const cellx = Math.sin((x / n) * Math.PI * 2 * 36 + (Math.floor(y / 21) % 2) * 1.5);
      const h = 0.5 + ring * 0.25 + cellx * 0.08;
      const i = y * n + x;
      H[i] = h + (f[i] - 0.5) * 0.4;
      A[i] = 0.75 + (ring * 0.5 + 0.5) * 0.15 + f[i] * 0.15;
    }
  }
  return {
    map: tex(grayCanvas(A, n, 0, 1, [1, 0.97, 0.92]), true),
    normalMap: tex(heightToNormalCanvas(H, n, 3.2), false),
    roughnessMap: tex(grayCanvas(R, n), false),
  };
}

function getTexSet(name) {
  if (!hasDom) return null;
  if (texSets.has(name)) return texSets.get(name);
  let s = null;
  switch (name) {
    case 'plating': s = buildPlating(); break;
    case 'concrete': s = buildConcrete(); break;
    case 'sandstone': s = buildSandstone(); break;
    case 'tread': s = buildTread(); break;
    case 'cloth': s = buildCloth(); break;
    case 'worm': s = buildWorm(); break;
    default: s = null;
  }
  texSets.set(name, s);
  return s;
}

// ---------------------------------------------------------------------------
// Desert environment map (equirect gradient with a sun disc) for metal reflections.
// ---------------------------------------------------------------------------
let envTex = null;
function getEnv() {
  if (!hasDom) return null;
  if (envTex) return envTex;
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#7fa6d6');
  grad.addColorStop(0.28, '#b9cde0');
  grad.addColorStop(0.47, '#f3e1bd');
  grad.addColorStop(0.52, '#d9b27a');
  grad.addColorStop(0.7, '#a77a48');
  grad.addColorStop(1.0, '#4e3320');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // dunes silhouette band at the horizon
  g.fillStyle = 'rgba(160,110,60,0.55)';
  g.beginPath();
  g.moveTo(0, h * 0.52);
  for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.5 + 0.018 * Math.sin(x * 0.045) + 0.01 * Math.sin(x * 0.13)));
  g.lineTo(w, h * 0.6);
  g.lineTo(0, h * 0.6);
  g.fill();
  // sun disc matching the game's key light direction (-30, 30, -20)
  const sx = (Math.atan2(-20, -30) / (Math.PI * 2) + 0.5) * w;
  const sy = (1 - (Math.asin(0.55) / Math.PI + 0.5)) * h;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 38);
  sg.addColorStop(0, 'rgba(255,252,240,1)');
  sg.addColorStop(0.25, 'rgba(255,240,205,0.9)');
  sg.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = sg;
  g.fillRect(sx - 40, sy - 40, 80, 80);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  envTex = t;
  return t;
}

// ---------------------------------------------------------------------------
// House palettes. Index = house id (0 Harkonnen, 1 Atreides, 2 Ordos, 3 Fremen, 4 Sardaukar, 5 Mercenary)
// ---------------------------------------------------------------------------
export const PALETTES = [
  { hull: 0x4a4644, light: 0x7b726a, trim: 0xa0703f, dark: 0x1e1b1a, glow: 0xff5a2a, cloth: 0x5a4d44 },
  { hull: 0x8793a6, light: 0xc9d0d8, trim: 0xd9b24e, dark: 0x2a3140, glow: 0x66d8ff, cloth: 0x5c6a86 },
  { hull: 0x5c7c70, light: 0xaec6b8, trim: 0xc7d3cf, dark: 0x1f2e29, glow: 0x7dff6a, cloth: 0x4c6a52 },
  { hull: 0x98835f, light: 0xc9b58e, trim: 0x6b563a, dark: 0x2e251a, glow: 0x66d8ff, cloth: 0x8a7a58 },
  { hull: 0x363640, light: 0x696976, trim: 0xcaa44a, dark: 0x16161c, glow: 0xb678ff, cloth: 0x3d3846 },
  { hull: 0x6d6a48, light: 0xa5a07a, trim: 0xb98a3a, dark: 0x25241a, glow: 0xffb04a, cloth: 0x6a6446 },
];

const matCache = new Map();

function std(params, texName, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...params });
  const set = texName ? getTexSet(texName) : null;
  if (set) {
    m.map = set.map;
    m.normalMap = set.normalMap;
    m.normalScale = new THREE.Vector2(extra.normal ?? 0.8, extra.normal ?? 0.8);
    m.roughnessMap = set.roughnessMap;
  }
  const env = getEnv();
  if (env) {
    m.envMap = env;
    m.envMapIntensity = extra.env ?? 0.7;
  }
  return m;
}

function glow(color, emissive, intensity) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.35, vertexColors: true });
}

export function getMaterial(key, house = 0) {
  const ck = key + ':' + house;
  if (matCache.has(ck)) return matCache.get(ck);
  const pal = PALETTES[house] || PALETTES[0];
  const hc = new THREE.Color(HOUSE_COLORS[house] ?? 0x999999);
  let m;
  switch (key) {
    case 'hull':
      m = std({ color: pal.hull, metalness: 0.62, roughness: 0.52 }, 'plating', { env: 0.85 });
      break;
    case 'hullLight':
      m = std({ color: pal.light, metalness: 0.4, roughness: 0.55 }, 'plating', { env: 0.7 });
      break;
    case 'accent':
      m = std({ color: hc, metalness: 0.3, roughness: 0.42 }, 'plating', { normal: 0.55, env: 0.75 });
      break;
    case 'accentGlow':
      m = glow(hc, hc, 1.6);
      break;
    case 'trim':
      m = std({ color: pal.trim, metalness: 0.85, roughness: 0.34 }, 'plating', { normal: 0.4, env: 1.0 });
      break;
    case 'dark':
      m = std({ color: pal.dark, metalness: 0.7, roughness: 0.5 }, 'plating', { normal: 0.9, env: 0.7 });
      break;
    case 'metal':
      m = std({ color: 0xa8a39a, metalness: 0.92, roughness: 0.32 }, 'plating', { normal: 0.5, env: 1.1 });
      break;
    case 'membrane':
      m = std({ color: new THREE.Color(0xe3ecef).lerp(hc, 0.28), metalness: 0.1, roughness: 0.28, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }, null, { env: 1.0 });
      break;
    case 'metal2':
      m = std({ color: 0xb9b4aa, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }, 'plating', { normal: 0.4, env: 1.1 });
      break;
    case 'chrome':
      m = std({ color: 0xd8dcdf, metalness: 1.0, roughness: 0.14 }, null, { env: 1.3 });
      break;
    case 'brass':
      m = std({ color: 0xc9a050, metalness: 0.95, roughness: 0.3 }, null, { env: 1.1 });
      break;
    case 'hazard':
      m = std({ color: 0xdcae1c, metalness: 0.35, roughness: 0.5 }, 'plating', { normal: 0.6, env: 0.7 });
      break;
    case 'tread':
      m = std({ color: 0x2a2724, metalness: 0.35, roughness: 0.82 }, 'tread', { normal: 1.0, env: 0.25 });
      break;
    case 'rubber':
      m = std({ color: 0x181716, metalness: 0.0, roughness: 0.92 }, null, { env: 0.2 });
      break;
    case 'glass':
      m = std({ color: 0x1b3346, metalness: 0.3, roughness: 0.08, emissive: 0x1f5a7a, emissiveIntensity: 0.35 }, null, { env: 1.4 });
      break;
    case 'glowCyan': m = glow(0x66e0ff, 0x44d0ff, 2.4); break;
    case 'glowAmber': m = glow(0xffb455, 0xff9a2a, 2.4); break;
    case 'glowGreen': m = glow(0x9dff7a, 0x6dff3a, 2.2); break;
    case 'glowRed': m = glow(0xff6a5a, 0xff3322, 2.4); break;
    case 'glowWhite': m = glow(0xffffff, 0xfff4dd, 2.6); break;
    case 'concrete':
      m = std({ color: 0x938d82, metalness: 0.02, roughness: 0.92 }, 'concrete', { normal: 0.9, env: 0.35 });
      break;
    case 'concreteDark':
      m = std({ color: 0x625d55, metalness: 0.02, roughness: 0.94 }, 'concrete', { normal: 0.9, env: 0.3 });
      break;
    case 'sandstone': {
      const base = new THREE.Color(0xbb9366).lerp(hc, 0.06);
      m = std({ color: base, metalness: 0.0, roughness: 0.88 }, 'sandstone', { normal: 1.0, env: 0.35 });
      break;
    }
    case 'spice':
      m = std({ color: 0xc55b22, emissive: 0x5a1e05, emissiveIntensity: 0.5, roughness: 0.85 }, 'concrete', { normal: 1.4, env: 0.3 });
      break;
    case 'water':
      m = std({ color: 0x3f8db5, metalness: 0.2, roughness: 0.12, emissive: 0x0d3550, emissiveIntensity: 0.6 }, null, { env: 1.2 });
      break;
    case 'cloth':
      m = std({ color: pal.cloth, roughness: 0.95 }, 'cloth', { normal: 0.3, env: 0.2 });
      break;
    case 'clothDark':
      m = std({ color: new THREE.Color(pal.cloth).multiplyScalar(0.45), roughness: 0.95 }, 'cloth', { normal: 0.3, env: 0.2 });
      break;
    case 'canvas':
      m = std({ color: new THREE.Color(0xb9a37a).lerp(hc, 0.12), roughness: 0.96, side: THREE.DoubleSide }, 'cloth', { normal: 0.6, env: 0.2 });
      break;
    case 'leather':
      m = std({ color: 0x5a3b26, roughness: 0.7, metalness: 0.05 }, 'cloth', { normal: 0.5, env: 0.3 });
      break;
    case 'skin':
      m = new THREE.MeshStandardMaterial({ color: 0xc89a78, roughness: 0.75, vertexColors: true });
      break;
    case 'worm':
      m = std({ color: 0x8a6a4a, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide }, 'worm', { normal: 0.6, env: 0.4 });
      break;
    case 'wormInner':
      m = std({ color: 0xd9a27a, roughness: 0.5, emissive: 0x6a1a08, emissiveIntensity: 0.9, side: THREE.DoubleSide }, null, { env: 0.5 });
      break;
    case 'teeth':
      m = std({ color: 0xeee2c8, roughness: 0.35 }, null, { env: 0.6 });
      break;
    case 'rocket':
      m = std({ color: 0xd8d2c4, metalness: 0.35, roughness: 0.45 }, null, { env: 0.8 });
      break;
    default:
      m = new THREE.MeshStandardMaterial({ color: 0xff00ff });
  }
  matCache.set(ck, m);
  return m;
}
