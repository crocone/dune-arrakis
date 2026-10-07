export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const TWO_PI = Math.PI * 2;

export function normAngle(a) {
  a %= TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

// signed shortest difference b - a in (-PI, PI]
export function angleDiff(a, b) {
  let d = normAngle(b) - normAngle(a);
  if (d > Math.PI) d -= TWO_PI;
  if (d <= -Math.PI) d += TWO_PI;
  return d;
}

// Rotate angle `from` toward `to` by at most `maxStep`. Returns new angle.
export function turnTowards(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= maxStep) return normAngle(to);
  return normAngle(from + Math.sign(d) * maxStep);
}

// Angle in our world: x to the east, y (tile row) to the south. Angle 0 = east, PI/2 = south.
export function angleTo(x1, y1, x2, y2) {
  return normAngle(Math.atan2(y2 - y1, x2 - x1));
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Chebyshev/octile like distance used for tile ranges (Dune Legacy uses blockDistance)
export function blockDistance(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  return dx > dy ? dx + dy / 2 : dy + dx / 2;
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Small value noise used for cosmetic terrain detail (deterministic)
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x, y, octaves = 4, seed = 0) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
