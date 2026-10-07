import * as THREE from 'three';
import { tracks, antenna, hatch, lamp, stack, grille, spikes, barrel, emblemTop, emblemSide, emblemFront } from './kit.js';

// ---------------------------------------------------------------------------
// Tracked vehicle family: one chassis builder per house style + weapon turrets.
// ---------------------------------------------------------------------------
const CH = {
  tank: { L: 0.62, W: 0.3, tH: 0.15, tW: 0.13, gap: 0.17, top: 0.27, wheels: 5, tx: -0.02, k: 1 },
  siege: { L: 0.72, W: 0.36, tH: 0.17, tW: 0.15, gap: 0.21, top: 0.31, wheels: 6, tx: -0.04, k: 1.22 },
  launcher: { L: 0.62, W: 0.3, tH: 0.15, tW: 0.13, gap: 0.17, top: 0.27, wheels: 5, tx: -0.07, k: 1 },
  sonic: { L: 0.64, W: 0.32, tH: 0.15, tW: 0.13, gap: 0.18, top: 0.27, wheels: 5, tx: -0.03, k: 1.02 },
  devastator: { L: 0.86, W: 0.46, tH: 0.2, tW: 0.18, gap: 0.27, top: 0.4, wheels: 7, tx: 0.0, k: 1.5 },
};

function chassis(b, st, c) {
  const { L, W, tH, tW, gap, top } = c;
  const hl = L / 2;
  const y0 = tH * 0.85;
  const hh = top - y0;
  const sideAt = (wb, wt, t) => (wb + (wt - wb) * t) / 2;
  const tiltOf = (wb, wt) => Math.atan2((wb - wt) / 2, hh);
  b.part('body');
  tracks(b, { len: L, h: tH, w: tW, gap, wheels: c.wheels, style: st });
  if (st === 'harkonnen') {
    // stepped, brutal slab hull with a heavy brow plate
    b.tapered('hull', [[-hl + 0.01, y0], [-hl + 0.01, top - hh * 0.1], [-hl * 0.72, top], [hl * 0.3, top], [hl - 0.01, y0 + hh * 0.42], [hl - 0.01, y0]], W + 0.05, W - 0.04);
    b.cbox('accent', L * 0.16, hh * 0.2, W * 0.94, 0.006, hl - L * 0.06, y0 + hh * 0.62, 0);
    b.cbox('accent', L * 0.3, hh * 0.1, W * 0.7, 0.004, hl * 0.1, top + hh * 0.04, 0);
    for (const s of [-1, 1]) {
      b.cbox('hull', L * 0.98, 0.012, tW + 0.02, 0.004, 0, tH + 0.008, s * gap);
      b.cbox('accent', L * 0.9, 0.008, 0.012, 0.003, 0, tH + 0.016, s * (gap + tW / 2 + 0.006));
      spikes(b, 'dark', [hl, tH + 0.012, s * (gap - tW * 0.33)], [hl, tH + 0.012, s * (gap + tW * 0.33)], 3, 0.045 * c.k, 0.011 * c.k, [1, 0.25, 0]);
      b.box('glowRed', 0.006, 0.009, 0.055, hl - 0.004, y0 + hh * 0.25, s * W * 0.27);
      stack(b, -hl + 0.055, top - 0.035, s * W * 0.37, 0.013 * c.k, 0.05 * c.k);
      b.cbox('accent', L * 0.2, hh * 0.46, 0.016, 0.004, -hl * 0.1, y0 + hh * 0.5, s * (sideAt(W + 0.05, W - 0.04, 0.5) + 0.004), -s * tiltOf(W + 0.05, W - 0.04));
      emblemSide(b, st, -hl * 0.1, y0 + hh * 0.5, s * (sideAt(W + 0.05, W - 0.04, 0.5) + 0.0125), 0.04 * c.k, s, 'dark', tiltOf(W + 0.05, W - 0.04));
    }
    b.box('dark', L * 0.26, 0.008, W * 0.64, -hl * 0.55, top + 0.001, 0);
    for (let i = 0; i < 4; i++) b.box('hull', 0.012, 0.007, W * 0.58, -hl * 0.55 - 0.05 + i * 0.033, top + 0.005, 0);
    b.bolts('metal', [[-hl * 0.2, top + 0.004, W * 0.4], [-hl * 0.2, top + 0.004, -W * 0.4], [hl * 0.25, top + 0.004, W * 0.4], [hl * 0.25, top + 0.004, -W * 0.4]], 0.007 * c.k);
  } else if (st === 'ordos') {
    // smooth teardrop hull with bulbous rear pods and a glowing underbelly
    b.tapered('hull', [[-hl + 0.02, y0], [-hl, y0 + hh * 0.55], [-hl * 0.7, top - hh * 0.04], [0, top], [hl * 0.5, top - hh * 0.1], [hl, y0 + hh * 0.3], [hl - 0.02, y0]], W + 0.04, W - 0.08);
    for (const s of [-1, 1]) {
      b.sphere('hullLight', hh * 0.5, -hl * 0.5, y0 + hh * 0.5, s * W * 0.42, 12, 8, 0.7, 1.7, 0.8);
      b.rbox('accent', L * 0.98, 0.014, tW + 0.015, 0.006, 0, tH + 0.008, s * gap);
      b.box('chrome', L * 0.9, 0.006, 0.006, 0, tH + 0.014, s * (gap + tW / 2 + 0.004));
      b.sphere('glowGreen', 0.012 * c.k, hl - 0.005, y0 + hh * 0.3, s * W * 0.2, 8, 6);
      emblemSide(b, st, hl * 0.2, y0 + hh * 0.45, s * (sideAt(W + 0.04, W - 0.08, 0.45) + 0.004), 0.04 * c.k, s, null, tiltOf(W + 0.04, W - 0.08));
    }
    b.box('glowGreen', L * 0.62, 0.004, W * 0.5, 0, y0 - 0.003, 0);
    b.beam('chrome', [-hl * 0.3, top, W * 0.3], [-hl * 0.3, top + 0.09 * c.k, W * 0.3], 0.004);
    b.sphere('glowGreen', 0.009 * c.k, -hl * 0.3, top + 0.092 * c.k, W * 0.3, 8, 6);
    b.rbox('accent', 0.08 * c.k, 0.016, 0.1 * c.k, 0.006, -hl * 0.55, top + 0.004, 0);
    for (let i = 0; i < 3; i++) b.box('dark', 0.006, 0.004, 0.08 * c.k, -hl * 0.55 - 0.02 + i * 0.02, top + 0.013, 0);
  } else {
    // atreides: sleek wedge with gold trim and twin cyan engine pods
    b.tapered('hull', [[-hl + 0.01, y0], [-hl + 0.01, y0 + hh * 0.65], [-hl * 0.72, top], [hl * 0.15, top], [hl - 0.01, y0 + hh * 0.38], [hl - 0.01, y0]], W + 0.04, W - 0.1);
    b.cbox('accent', L * 0.5, 0.006, W * 0.5, 0.002, -hl * 0.1, top + 0.003, 0);
    for (const s of [-1, 1]) {
      b.rbox('accent', L * 0.98, 0.014, tW + 0.015, 0.006, 0, tH + 0.008, s * gap);
      b.box('trim', L * 0.92, 0.008, 0.006, 0, tH + 0.014, s * (gap + tW / 2 + 0.004));
      b.cylX('dark', 0.034 * c.k, 0.05, 10, -hl - 0.004, y0 + hh * 0.5, s * W * 0.24);
      b.cylX('glowCyan', 0.024 * c.k, 0.008, 10, -hl - 0.03, y0 + hh * 0.5, s * W * 0.24);
      b.box('glowCyan', 0.006, 0.008, 0.04, hl - 0.004, y0 + hh * 0.22, s * W * 0.26);
      emblemSide(b, st, -hl * 0.1, y0 + hh * 0.5, s * (sideAt(W + 0.04, W - 0.1, 0.5) + 0.004), 0.05 * c.k, s, null, tiltOf(W + 0.04, W - 0.1));
    }
    b.box('trim', 0.01, 0.01, W * 0.72, hl - 0.01, y0 + hh * 0.42, 0);
    emblemTop(b, st, -hl * 0.58, top + 0.0075, 0, 0.09 * c.k);
    for (let i = 0; i < 3; i++) b.box('dark', 0.006, 0.004, W * 0.45, -hl * 0.9 + i * 0.02, top + 0.005, 0);
  }
}

// ---- turret bodies ----------------------------------------------------------
function turretBody(b, st, c, ox, oy) {
  const k = c.k;
  b.cyl('dark', 0.1 * k, 0.11 * k, 0.02 * k, 16, ox, oy + 0.006 * k, 0);
  if (st === 'harkonnen') {
    b.tapered('hull', [[-0.125, 0], [-0.125, 0.045], [-0.08, 0.085], [0.07, 0.085], [0.125, 0.055], [0.125, 0]].map(([x, y]) => [x * k, y * k]), 0.26 * k, 0.17 * k, ox, oy + 0.014 * k, 0);
    for (const s of [-1, 1]) {
      b.cbox('accent', 0.1 * k, 0.05 * k, 0.02 * k, 0.005, ox - 0.02 * k, oy + 0.05 * k, s * 0.118 * k);
      for (let i = 0; i < 3; i++) b.cylX('dark', 0.007 * k, 0.03 * k, 6, ox - 0.07 * k + i * 0.02 * k, oy + 0.075 * k, s * 0.132 * k);
      b.box('glowRed', 0.005, 0.01 * k, 0.045 * k, ox + 0.1 * k, oy + 0.07 * k, s * 0.035 * k);
    }
    b.cbox('dark', 0.05 * k, 0.065 * k, 0.12 * k, 0.008, ox + 0.125 * k, oy + 0.052 * k, 0);
    emblemTop(b, st, ox - 0.03 * k, oy + 0.1 * k, 0, 0.06 * k);
  } else if (st === 'ordos') {
    b.sphere('accent', 0.13 * k, ox, oy + 0.02 * k, 0, 20, 12, 0.5, 1.25, 0.95);
    b.torus('chrome', 0.118 * k, 0.006 * k, ox, oy + 0.016 * k, 0, Math.PI / 2, 0, 0, 24, 5);
    b.rbox('hullLight', 0.05 * k, 0.05 * k, 0.085 * k, 0.02, ox + 0.12 * k, oy + 0.04 * k, 0);
    b.sphere('hullLight', 0.034 * k, ox - 0.03 * k, oy + 0.07 * k, 0.07 * k, 10, 8, 0.8);
    b.sphere('glowGreen', 0.013 * k, ox - 0.002 * k, oy + 0.072 * k, 0.07 * k, 8, 6);
    emblemTop(b, st, ox - 0.05 * k, oy + 0.0645 * k, -0.03 * k, 0.05 * k);
  } else {
    b.lathe('accent', [[0, 0], [0.108, 0], [0.118, 0.022], [0.1, 0.052], [0.056, 0.076], [0, 0.083]].map(([r, y]) => [r * k, y * k]), 20, ox, oy + 0.012 * k, 0, 0, 0, 0, 1.12, 1, 0.96);
    b.torus('trim', 0.112 * k, 0.005 * k, ox, oy + 0.03 * k, 0, Math.PI / 2, 0, 0, 24, 5);
    b.rbox('hullLight', 0.05 * k, 0.048 * k, 0.1 * k, 0.012, ox + 0.12 * k, oy + 0.042 * k, 0);
    b.box('glowCyan', 0.006, 0.01 * k, 0.04 * k, ox + 0.1 * k, oy + 0.075 * k, 0.05 * k);
    emblemTop(b, st, ox - 0.015 * k, oy + 0.0955 * k, 0, 0.05 * k);
  }
  hatch(b, ox - 0.055 * k, oy + (st === 'harkonnen' ? 0.095 : 0.085) * k, -0.045 * k, 0.026 * k);
  antenna(b, ox - 0.1 * k, oy + 0.07 * k, 0.075 * k, 0.14 * k, 'metal', 'glowRed', 0.01);
}

function cannon(b, st, c, twin) {
  const ox = c.tx, oy = c.top, k = c.k;
  b.part('turret', [ox, oy, 0]);
  turretBody(b, st, c, ox, oy);
  b.part('barrel', [ox + 0.13 * k, oy + 0.045 * k, 0], 'turret');
  if (twin) {
    for (const s of [-1, 1]) barrel(b, ox + 0.13 * k, 0.34 * k, oy + 0.045 * k, s * 0.055 * k, 0.022 * k, st);
  } else {
    barrel(b, ox + 0.13 * k, 0.3 * k, oy + 0.045 * k, 0, 0.022 * k, st);
  }
}

// rocket pod tilted back-to-front; pivots with the turret
function rocketPod(b, st, c, gas) {
  const ox = c.tx, oy = c.top;
  b.part('turret', [ox, oy, 0]);
  b.cyl('dark', 0.1, 0.11, 0.025, 16, ox, oy + 0.008, 0);
  b.cbox(st === 'harkonnen' ? 'dark' : 'hull', 0.2, 0.03, 0.2, 0.01, ox, oy + 0.03, 0);
  const a = 0.38; // pitch
  const ca = Math.cos(a), sa = Math.sin(a);
  const P = (x, y, z = 0) => [ox + 0.02 + x * ca - y * sa, oy + 0.1 + x * sa + y * ca, z];
  // frame / box
  b.add(st === 'harkonnen' ? 'dark' : 'hull', new THREE.BoxGeometry(0.36, 0.13, 0.25), ox + 0.02, oy + 0.1, 0, 0, 0, a);
  b.add('accent', new THREE.BoxGeometry(0.16, 0.012, 0.255), ...P(-0.08, 0.071), 0, 0, a);
  // support struts
  for (const s of [-1, 1]) b.beam('metal', [ox - 0.06, oy + 0.03, s * 0.09], [ox - 0.06, oy + 0.1, s * 0.11], 0.006);
  b.part('barrel', [ox + 0.2, oy + 0.15, 0], 'turret');
  const cols = gas ? 2 : 3;
  const rows = gas ? 1 : 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const z = (i - (cols - 1) / 2) * (gas ? 0.11 : 0.075);
      const y = (j - (rows - 1) / 2) * 0.062;
      const p0 = P(0.1, y, z);
      const p1 = P(0.2, y, z);
      b.beam('dark', p0, p1, gas ? 0.04 : 0.029, 10);
      b.beam('metal', P(0.19, y, z), P(0.205, y, z), gas ? 0.043 : 0.032, 10);
      const nose = P(0.215, y, z);
      if (gas) {
        b.beam('chrome', p1, P(0.265, y, z), 0.024, 8);
        b.sphere('glowGreen', 0.036, ...P(0.28, y, z), 10, 8);
      } else {
        b.beam('rocket', P(0.17, y, z), nose, 0.021, 8);
        b.cone(st === 'harkonnen' ? 'accent' : 'rocket', 0.021, 0.04, 8, nose[0] + ca * 0.02, nose[1] + sa * 0.02, nose[2], 0, 0, a - Math.PI / 2);
      }
    }
  }
  b.part('turret');
  if (gas) {
    // gas canisters + pipes
    for (const s of [-1, 1]) {
      b.cyl('glowGreen', 0.022, 0.022, 0.1, 10, ox - 0.1, oy + 0.075, s * 0.1, 0, 0, Math.PI / 2 - 0.2);
      b.torus('chrome', 0.023, 0.004, ox - 0.1, oy + 0.075, s * 0.1, 0, Math.PI / 2, 0, 10, 4);
      b.pipe('metal', [[ox - 0.12, oy + 0.08, s * 0.1], [ox - 0.02, oy + 0.15, s * 0.07], P(0.1, 0.03, s * 0.055)], 0.007);
    }
  }
  hatch(b, ox - 0.1, oy + 0.05, 0.08, 0.02);
  antenna(b, ox - 0.12, oy + 0.1, -0.1, 0.12, 'metal', 'glowRed', 0.01);
}

function sonicDish(b, st, c) {
  const ox = c.tx, oy = c.top, k = c.k;
  b.part('turret', [ox, oy, 0]);
  b.cyl('dark', 0.1, 0.11, 0.025, 16, ox, oy + 0.008, 0);
  b.cbox('hull', 0.2, 0.05, 0.2, 0.015, ox - 0.01, oy + 0.04, 0);
  b.torus('trim', 0.098, 0.005, ox - 0.01, oy + 0.066, 0, Math.PI / 2, 0, 0, 20, 5);
  // yoke arms
  for (const s of [-1, 1]) {
    b.cbox('hull', 0.04, 0.12, 0.016, 0.004, ox + 0.06, oy + 0.1, s * 0.14);
    b.cylZ('metal', 0.014, 0.05, 8, ox + 0.1, oy + 0.12, s * 0.14);
  }
  b.part('barrel', [ox + 0.1, oy + 0.12, 0], 'turret');
  // parabolic dish (double sided shell), opening toward +X
  const dish = [[0.02, 0], [0.06, 0.012], [0.1, 0.04], [0.13, 0.085], [0.145, 0.12]];
  b.lathe('metal2', dish, 24, ox + 0.04, oy + 0.12, 0, 0, 0, -Math.PI / 2);
  b.torus('trim', 0.145, 0.008, ox + 0.04 + 0.12, oy + 0.12, 0, 0, Math.PI / 2, 0, 24, 5);
  b.torus('glowCyan', 0.105, 0.005, ox + 0.04 + 0.06, oy + 0.12, 0, 0, Math.PI / 2, 0, 24, 4);
  b.torus('glowCyan', 0.07, 0.005, ox + 0.04 + 0.034, oy + 0.12, 0, 0, Math.PI / 2, 0, 20, 4);
  b.torus('glowCyan', 0.035, 0.005, ox + 0.04 + 0.015, oy + 0.12, 0, 0, Math.PI / 2, 0, 16, 4);
  // emitter spike on a tripod
  b.cone('chrome', 0.02, 0.1, 8, ox + 0.04 + 0.075, oy + 0.12, 0, 0, 0, -Math.PI / 2);
  b.sphere('glowCyan', 0.016, ox + 0.04 + 0.13, oy + 0.12, 0, 8, 6);
  for (const [dy, dz] of [[0.1, 0], [-0.05, 0.087], [-0.05, -0.087]]) {
    b.beam('metal', [ox + 0.04 + 0.12, oy + 0.12 + dy, dz], [ox + 0.04 + 0.12 - 0.04, oy + 0.12, 0], 0.004, 5);
  }
  b.part('turret');
  hatch(b, ox - 0.06, oy + 0.07, 0.06, 0.02);
  antenna(b, ox - 0.1, oy + 0.06, -0.08, 0.1, 'metal', 'glowCyan', 0.005);
}

function plasmaTurret(b, st, c) {
  const ox = c.tx, oy = c.top, k = c.k;
  b.part('turret', [ox, oy, 0]);
  b.cyl('dark', 0.1 * k, 0.11 * k, 0.02 * k, 16, ox, oy + 0.006 * k, 0);
  // blocky heavy turret with sloped sides
  b.tapered('hull', [[-0.12, 0], [-0.12, 0.05], [-0.08, 0.09], [0.06, 0.09], [0.12, 0.06], [0.12, 0]].map(([x, y]) => [x * k, y * k]), 0.28 * k, 0.19 * k, ox, oy + 0.014 * k, 0);
  b.cbox('dark', 0.06 * k, 0.07 * k, 0.17 * k, 0.008, ox + 0.12 * k, oy + 0.058 * k, 0);
  for (const s of [-1, 1]) {
    b.cbox('accent', 0.12 * k, 0.07 * k, 0.025 * k, 0.005, ox - 0.01 * k, oy + 0.055 * k, s * 0.14 * k);
    b.box('glowRed', 0.005, 0.011 * k, 0.05 * k, ox + 0.093 * k, oy + 0.09 * k, s * 0.04 * k);
    spikes(b, 'dark', [ox - 0.05 * k, oy + 0.09 * k, s * 0.145 * k], [ox + 0.06 * k, oy + 0.09 * k, s * 0.145 * k], 3, 0.04 * k, 0.01 * k, [0, 0.6, s * 0.8]);
    // radiator fins on the back
    for (let i = 0; i < 4; i++) b.box('dark', 0.006, 0.05 * k, 0.04 * k, ox - 0.13 * k - 0.004, oy + (0.03 + i * 0.016) * k, s * 0.05 * k);
  }
  emblemTop(b, st, ox - 0.03 * k, oy + 0.1 * k, 0, 0.08 * k);
  hatch(b, ox - 0.07 * k, oy + 0.1 * k, 0.09 * k, 0.03 * k);
  b.part('barrel', [ox + 0.15 * k, oy + 0.06 * k, 0], 'turret');
  for (const s of [-1, 1]) {
    const z = s * 0.058 * k;
    const y = oy + 0.06 * k;
    b.cylX('metal', 0.026 * k, 0.26 * k, 10, ox + 0.28 * k, y, z);
    b.cylX('dark', 0.034 * k, 0.05 * k, 10, ox + 0.17 * k, y, z);
    b.cylX('dark', 0.036 * k, 0.03 * k, 10, ox + 0.3 * k, y, z);
    b.cyl('dark', 0.052 * k, 0.034 * k, 0.07 * k, 10, ox + 0.43 * k, y, z, 0, 0, Math.PI / 2);
    b.sphere('glowAmber', 0.03 * k, ox + 0.45 * k, y, z, 10, 8);
    b.torus('glowRed', 0.045 * k, 0.005 * k, ox + 0.4 * k, y, z, 0, Math.PI / 2, 0, 12, 4);
  }
}

export const TANK_DEFS = {
  tank(b, st) {
    chassis(b, st, CH.tank);
    cannon(b, st, CH.tank, false);
  },
  siegeTank(b, st) {
    chassis(b, st, CH.siege);
    cannon(b, st, CH.siege, true);
  },
  launcher(b, st) {
    chassis(b, st, CH.launcher);
    rocketPod(b, st, CH.launcher, false);
  },
  deviator(b, st) {
    chassis(b, st, CH.launcher);
    rocketPod(b, st, CH.launcher, true);
  },
  sonicTank(b, st) {
    chassis(b, st, CH.sonic);
    sonicDish(b, st, CH.sonic);
  },
  devastator(b, st) {
    chassis(b, st, CH.devastator);
    // reactor housing on the rear deck
    const c = CH.devastator;
    b.part('body');
    b.cbox('dark', 0.3, 0.1, 0.32, 0.015, -0.27, c.top + 0.04, 0);
    for (let i = 0; i < 5; i++) b.box('glowAmber', 0.004, 0.012, 0.22, -0.12, c.top + 0.03 + i * 0.016, 0);
    for (const s of [-1, 1]) b.cylX('metal', 0.03, 0.08, 8, -0.44, c.top + 0.05, s * 0.11);
    plasmaTurret(b, st, c);
  },
};
