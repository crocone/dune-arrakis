import { antenna, stack, emblemFront, emblemSide, emblemTop, spikes } from './kit.js';

// Structure helper pieces. Footprint origin = top-left corner (x right, z "down" / towards the viewer).
export const Y0 = 0.06; // top surface of the concrete foundation

export function foundation(b, w, h) {
  b.cbox('concrete', w - 0.04, 0.12, h - 0.04, 0.025, w / 2, 0, h / 2);
  const t = 0.03;
  b.box('concreteDark', w - 0.08, 0.014, t, w / 2, 0.063, 0.05);
  b.box('concreteDark', w - 0.08, 0.014, t, w / 2, 0.063, h - 0.05);
  b.box('concreteDark', t, 0.014, h - 0.14, 0.05, 0.063, h / 2);
  b.box('concreteDark', t, 0.014, h - 0.14, w - 0.05, 0.063, h / 2);
  for (const [x, z, sx, sz] of [[0.14, 0.14, 1, 1], [w - 0.14, 0.14, -1, 1], [0.14, h - 0.14, 1, -1], [w - 0.14, h - 0.14, -1, -1]]) {
    b.box('hazard', 0.09, 0.005, 0.02, x, 0.064, z);
    b.box('hazard', 0.02, 0.005, 0.09, x, 0.064, z);
  }
}

// lit windows with dark frames. face 'z' = on a wall perpendicular to Z (front/back), 'x' = side wall
export function windows(b, x0, x1, y, z, n, mat = 'glowAmber', face = 'z', hgt = 0.04, dir = 1) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = x0 + t * (x1 - x0);
    const wdt = ((x1 - x0) / n) * 0.55;
    if (face === 'z') {
      b.box('dark', wdt + 0.012, hgt + 0.012, 0.012, p, y, z);
      b.box(mat, wdt, hgt, 0.012, p, y, z + dir * 0.004);
    } else {
      b.box('dark', 0.012, hgt + 0.012, wdt + 0.012, z, y, p);
      b.box(mat, 0.012, hgt, wdt, z + dir * 0.004, y, p);
    }
  }
}

// roll-up garage door with a hazard header and ramp lights. Faces +Z unless face='x'.
export function garageDoor(b, cx, y0, z, w, hgt, face = 'z', dir = 1) {
  if (face === 'z') {
    b.cbox('dark', w + 0.08, hgt + 0.06, 0.03, 0.006, cx, y0 + hgt / 2 + 0.01, z);
    for (let i = 0; i < 6; i++) b.box('metal', w, hgt / 7 * 0.7, 0.012, cx, y0 + 0.03 + (i + 0.5) * (hgt / 6.4), z + dir * 0.014);
    for (let i = 0; i < 6; i++) b.box(i % 2 ? 'dark' : 'hazard', w / 6, 0.025, 0.014, cx - w / 2 + (i + 0.5) * (w / 6), y0 + hgt + 0.035, z + dir * 0.012);
    b.box('glowAmber', 0.03, 0.02, 0.014, cx - w / 2 - 0.06, y0 + hgt + 0.03, z + dir * 0.012);
    b.box('glowAmber', 0.03, 0.02, 0.014, cx + w / 2 + 0.06, y0 + hgt + 0.03, z + dir * 0.012);
  } else {
    b.cbox('dark', 0.03, hgt + 0.06, w + 0.08, 0.006, z, y0 + hgt / 2 + 0.01, cx);
    for (let i = 0; i < 6; i++) b.box('metal', 0.012, hgt / 7 * 0.7, w, z + dir * 0.014, y0 + 0.03 + (i + 0.5) * (hgt / 6.4), cx);
    for (let i = 0; i < 6; i++) b.box(i % 2 ? 'dark' : 'hazard', 0.014, 0.025, w / 6, z + dir * 0.012, y0 + hgt + 0.035, cx - w / 2 + (i + 0.5) * (w / 6));
  }
}

// rooftop AC / vent unit
export function roofUnit(b, x, y, z, s = 1) {
  b.cbox('dark', 0.12 * s, 0.07 * s, 0.1 * s, 0.01, x, y + 0.035 * s, z);
  b.cyl('metal', 0.035 * s, 0.035 * s, 0.01, 10, x, y + 0.075 * s, z);
  for (let i = 0; i < 3; i++) b.box('metal', 0.1 * s, 0.003, 0.004, x, y + 0.077 * s, z - 0.02 * s + i * 0.02 * s);
}

// vertical storage tank with bands, domed lid and ladder
export function tankV(b, x, y, z, r, h, mat = 'hullLight', band = 'accent', ladder = true) {
  b.cyl(mat, r, r * 1.03, h, 18, x, y + h / 2, z);
  b.hemi(mat, r * 0.99, x, y + h, z, 18, 0.45);
  for (const t of [0.22, 0.62]) b.torus(band, r * 1.015, r * 0.04, x, y + h * t, z, Math.PI / 2, 0, 0, 20, 4);
  b.torus('metal', r * 1.02, r * 0.03, x, y + h * 0.95, z, Math.PI / 2, 0, 0, 20, 4);
  b.cyl('dark', r * 0.18, r * 0.2, 0.04, 8, x, y + h + r * 0.43, z);
  if (ladder) {
    b.beam('metal', [x + r * 1.0, y + 0.02, z + r * 0.2], [x + r * 0.95, y + h, z + r * 0.2], 0.005, 5);
    b.beam('metal', [x + r * 1.0, y + 0.02, z + r * 0.34], [x + r * 0.95, y + h, z + r * 0.34], 0.005, 5);
    const n = Math.max(3, Math.floor(h / 0.06));
    for (let i = 0; i < n; i++) b.beam('metal', [x + r * 1.0, y + 0.04 + (i / n) * h, z + r * 0.2], [x + r * 1.0, y + 0.04 + (i / n) * h, z + r * 0.34], 0.003, 4);
  }
}

// guard rail on the roof edge (x0,z0)->(x1,z1) at height y
export function railing(b, x0, z0, x1, z1, y, h = 0.07, posts = 5) {
  b.beam('metal', [x0, y + h, z0], [x1, y + h, z1], 0.0035, 4);
  b.beam('metal', [x0, y + h * 0.5, z0], [x1, y + h * 0.5, z1], 0.0025, 4);
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    b.cyl('metal', 0.003, 0.003, h, 4, x, y + h / 2, z);
  }
}

// banner on a pole (house colour)
export function flag(b, x, y, z, h = 0.5, w = 0.14, dirZ = 1) {
  b.cyl('metal', 0.008, 0.01, h, 6, x, y + h / 2, z);
  b.sphere('trim', 0.014, x, y + h + 0.01, z, 6, 4);
  b.cbox('accent', 0.006, w * 0.9, w, 0.002, x + 0.0, y + h - w * 0.6, z + dirZ * w * 0.55);
  b.box('trim', 0.007, 0.012, w, x, y + h - 0.012, z + dirZ * w * 0.55);
}

// lattice tower: four legs converging
export function lattice(b, x, z, y0, y1, wBot, wTop, r = 0.01, levels = 4) {
  const c = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [sx, sz] of c) b.beam('metal', [x + sx * wBot / 2, y0, z + sz * wBot / 2], [x + sx * wTop / 2, y1, z + sz * wTop / 2], r, 5);
  for (let i = 1; i <= levels; i++) {
    const t = i / levels;
    const y = y0 + (y1 - y0) * t;
    const w = wBot + (wTop - wBot) * t;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = c[k], [bx, bz] = c[(k + 1) % 4];
      b.beam('metal', [x + ax * w / 2, y, z + az * w / 2], [x + bx * w / 2, y, z + bz * w / 2], r * 0.55, 4);
    }
    if (i < levels) {
      const t0 = (i - 1) / levels;
      const w0 = wBot + (wTop - wBot) * t0;
      const y00 = y0 + (y1 - y0) * t0;
      b.beam('metal', [x + w0 / 2, y00, z + w0 / 2], [x + w / 2, y, z - w / 2], r * 0.4, 4);
    }
  }
}

// pipe run with flange rings
export function pipeRun(b, pts, r = 0.025, mat = 'metal') {
  b.pipe(mat, pts, r, 8);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    b.sphere('dark', r * 1.28, mx, my, mz, 8, 6);
  }
}

// crenellated parapet along a wall (Atreides / palace)
export function crenellations(b, mat, x0, x1, y, z, n, w = 0.05, h = 0.05, d = 0.04) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    b.cbox(mat, w, h, d, 0.005, x0 + (x1 - x0) * t, y + h / 2, z);
  }
}

export { antenna, stack, emblemFront, emblemSide, emblemTop, spikes };
