import * as THREE from 'three';

// Reusable detail pieces shared by unit and structure definitions.
// All functions draw into the Builder's *current* part.

// ---- locomotion -----------------------------------------------------------
// Tracked undercarriage: track belts with road wheels, sprocket and idler.
export function tracks(b, { len, h, w, gap, wheels = 5, style = 'generic' }) {
  const L = len / 2;
  for (const s of [-1, 1]) {
    const z = s * gap;
    const prof = [
      [-L, h * 0.3], [-L + h * 0.38, 0], [L - h * 0.65, 0], [L, h * 0.52],
      [L - h * 0.22, h], [-L + h * 0.3, h],
    ];
    b.tapered('tread', prof, w, w, 0, 0, z);
    // inner guard strip + outer rim rail
    const zo = z + s * (w / 2 + 0.002);
    const span = len - h * 1.7;
    for (let i = 0; i < wheels; i++) {
      const x = -span / 2 + span * (i / (wheels - 1));
      b.cylZ('metal', h * 0.26, 0.012, 10, x, h * 0.46, zo);
      b.cylZ('dark', h * 0.11, 0.018, 8, x, h * 0.46, zo + s * 0.003);
    }
    b.cylZ('metal', h * 0.41, 0.014, 12, -L + h * 0.46, h * 0.52, zo);
    b.cylZ('dark', h * 0.22, 0.02, 8, -L + h * 0.46, h * 0.52, zo + s * 0.003);
    b.cylZ('metal', h * 0.34, 0.014, 12, L - h * 0.5, h * 0.56, zo);
    b.cylZ('dark', h * 0.16, 0.02, 8, L - h * 0.5, h * 0.56, zo + s * 0.003);
    // upper track guard
    b.box('dark', len * 0.84, h * 0.07, w * 0.4, -len * 0.02, h * 1.0, z);
  }
}

// Rubber wheel with rim, hub and lug bolts. Axis along Z.
export function wheel(b, r, w, x, y, z, style = 'generic') {
  b.cylZ('rubber', r, w, 14, x, y, z);
  b.cylZ('tread', r * 1.01, w * 0.5, 14, x, y, z);
  const s = Math.sign(z) || 1;
  const zo = z + s * w * 0.5;
  b.cylZ('metal', r * 0.58, w * 0.1, 12, x, y, zo);
  b.cylZ('dark', r * 0.3, w * 0.14, 8, x, y, zo + s * 0.001);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.cylZ('chrome', r * 0.06, w * 0.16, 5, x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, zo + s * 0.001);
  }
}

// ---- small details --------------------------------------------------------
export function antenna(b, x, y, z, h, mat = 'metal', tip = 'glowRed', lean = 0) {
  b.beam(mat, [x, y, z], [x - lean, y + h, z], 0.0035, 5);
  if (tip) b.sphere(tip, 0.007, x - lean, y + h, z, 6, 4);
}

export function hatch(b, x, y, z, r, mat = 'hull') {
  b.cyl(mat, r, r * 1.08, r * 0.28, 12, x, y, z);
  b.torus('dark', r * 0.96, r * 0.07, x, y + r * 0.14, z, Math.PI / 2, 0, 0, 12, 4);
  b.cyl('metal', r * 0.14, r * 0.14, r * 0.22, 6, x, y + r * 0.3, z);
}

export function lamp(b, x, y, z, mat = 'glowAmber', s = 0.012, face = 1) {
  b.box('dark', s * 1.3, s * 1.3, s * 1.3, x, y, z);
  b.box(mat, s * 0.7, s * 1.0, s * 1.0, x + face * s * 0.6, y, z);
}

// vertical exhaust stack with a flared cap
export function stack(b, x, y, z, r, h, mat = 'dark') {
  b.cyl(mat, r, r * 1.15, h, 8, x, y + h / 2, z);
  b.cyl('metal', r * 1.3, r * 1.3, r * 0.5, 8, x, y + h, z);
  b.cyl('dark', r * 0.8, r * 0.8, r * 0.5, 8, x, y + h + 0.001, z);
}

// grille: a row of thin horizontal slats
export function grille(b, mat, x, y, z, w, h, n, face = 'x') {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const yy = y - h / 2 + t * h;
    if (face === 'x') b.box(mat, 0.008, h / n * 0.45, w, x, yy, z);
    else b.box(mat, w, h / n * 0.45, 0.008, x, yy, z);
  }
}

// ---- house emblems (flat plates, drawn facing +Z; rotate with ry/rx) -------
const HAWK = [[0, 0.5], [0.1, 0.22], [0.5, 0.38], [0.36, 0.02], [0.17, -0.06], [0.08, -0.5], [0, -0.3], [-0.08, -0.5], [-0.17, -0.06], [-0.36, 0.02], [-0.5, 0.38], [-0.1, 0.22]];
const HARK = [[-0.5, 0.5], [-0.24, 0.5], [-0.24, 0.12], [0.24, 0.12], [0.24, 0.5], [0.5, 0.5], [0.5, -0.5], [0.24, -0.5], [0.24, -0.12], [-0.24, -0.12], [-0.24, -0.5], [-0.5, -0.5]];
const ORDOS = [[0, 0.5], [0.5, 0], [0, -0.5], [-0.5, 0], [-0.3, 0], [0, -0.3], [0.3, 0], [0, 0.3], [-0.3, 0], [-0.5, 0]];

function emblemMat(style, mat) {
  return mat || (style === 'atreides' ? 'trim' : style === 'harkonnen' ? 'accent' : 'trim');
}
function emblemPts(style) {
  return style === 'atreides' ? HAWK : style === 'harkonnen' ? HARK : ORDOS;
}

// emblem on a vertical side panel; side = +1 (facing +Z) or -1 (facing -Z); head points up
export function emblemSide(b, style, x, y, z, size, side = 1, mat = null, tilt = 0) {
  b.plate(emblemMat(style, mat), emblemPts(style), 0.005, x, y, z, -side * tilt, side > 0 ? 0 : Math.PI, 0, size);
}

// emblem lying flat on a deck, head pointing forward (+X)
export function emblemTop(b, style, x, y, z, size, mat = null) {
  b.plate(emblemMat(style, mat), emblemPts(style), 0.005, x, y, z, -Math.PI / 2, 0, -Math.PI / 2, size);
}

// emblem on a front/back face: facing +X (dir=1) or -X (dir=-1)
export function emblemFront(b, style, x, y, z, size, dir = 1, mat = null) {
  b.plate(emblemMat(style, mat), emblemPts(style), 0.005, x, y, z, 0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0, size);
}

// row of spikes along a line, each pointing along `dir` ([dx,dy,dz])
export function spikes(b, mat, from, to, n, len, r, dir) {
  const d = new THREE.Vector3(...dir).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, d);
  const e = new THREE.Euler().setFromQuaternion(q);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    b.cone(mat, r, len, 5, x + d.x * len / 2, y + d.y * len / 2, z + d.z * len / 2, e.x, e.y, e.z);
  }
}

// Gun barrel with stepped muzzle brake. Axis along +X, starting at x0.
export function barrel(b, x0, len, y, z, r, style = 'generic', mat = 'metal') {
  b.cylX(mat, r, len * 0.82, 10, x0 + len * 0.41, y, z);
  b.cylX('dark', r * 1.32, len * 0.12, 10, x0 + len * 0.1, y, z); // mantlet sleeve
  if (style === 'atreides') {
    b.cylX('trim', r * 1.15, 0.012, 10, x0 + len * 0.45, y, z);
    b.cylX('dark', r * 1.5, len * 0.1, 10, x0 + len * 0.93, y, z);
    b.cylX('trim', r * 1.1, 0.01, 10, x0 + len * 0.99, y, z);
  } else if (style === 'harkonnen') {
    b.cylX('dark', r * 1.5, len * 0.16, 6, x0 + len * 0.92, y, z);
    b.box('dark', len * 0.1, r * 3.2, r * 0.7, x0 + len * 0.92, y, z);
    b.cylX('dark', r * 1.2, len * 0.09, 6, x0 + len * 0.52, y, z);
  } else {
    b.cylX('chrome', r * 1.2, len * 0.07, 10, x0 + len * 0.55, y, z);
    b.cylX('dark', r * 1.45, len * 0.13, 10, x0 + len * 0.93, y, z);
    b.torus('glowGreen', r * 1.35, r * 0.18, x0 + len * 0.86, y, z, 0, Math.PI / 2, 0, 10, 4);
  }
  b.cylX('dark', r * 0.7, 0.004, 8, x0 + len, y, z);
}
