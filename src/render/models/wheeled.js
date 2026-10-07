import * as THREE from 'three';
import { wheel, antenna, hatch, lamp, stack, spikes, emblemSide, emblemTop, emblemFront } from './kit.js';

// Light wheeled vehicles: trike, raider, quad.

// seated driver bust (faces +X)
function driver(b, st, x, y, z) {
  b.cbox('cloth', 0.04, 0.05, 0.062, 0.012, x, y + 0.025, z);
  b.cbox('accent', 0.03, 0.03, 0.066, 0.008, x + 0.004, y + 0.03, z);
  b.sphere('skin', 0.02, x + 0.006, y + 0.065, z, 10, 8);
  b.hemi(st === 'harkonnen' ? 'dark' : 'accent', 0.024, x + 0.004, y + 0.066, z, 10);
  b.box(st === 'ordos' ? 'glowGreen' : st === 'harkonnen' ? 'glowRed' : 'glass', 0.006, 0.01, 0.034, x + 0.026, y + 0.066, z);
  for (const s of [-1, 1]) b.beam('cloth', [x, y + 0.04, s * 0.03], [x + 0.045, y + 0.035, s * 0.028], 0.008, 5);
}

function mgMount(b, st, ox, oy, oz = 0, twin = true) {
  b.part('turret', [ox, oy, oz]);
  b.cyl('dark', 0.03, 0.035, 0.02, 10, ox, oy + 0.005, oz);
  b.cbox('hull', 0.04, 0.045, 0.1, 0.008, ox + 0.005, oy + 0.035, oz);
  b.cbox('accent', 0.012, 0.05, 0.11, 0.003, ox + 0.025, oy + 0.038, oz);
  b.part('barrel', [ox + 0.03, oy + 0.04, oz], 'turret');
  const zs = twin ? [-0.032, 0.032] : [0];
  for (const z of zs) {
    b.cylX('metal', 0.0085, 0.16, 8, ox + 0.1, oy + 0.04, oz + z);
    b.cylX('dark', 0.013, 0.05, 8, ox + 0.05, oy + 0.04, oz + z);
    b.cylX('dark', 0.012, 0.016, 6, ox + 0.18, oy + 0.04, oz + z);
  }
  b.part('turret');
  b.cbox('dark', 0.035, 0.03, 0.04, 0.005, ox - 0.03, oy + 0.03, oz + 0.055);
}

export const WHEELED_DEFS = {
  trike(b, st) {
    wheel(b, 0.07, 0.045, 0.17, 0.07, 0, st);
    for (const s of [-1, 1]) wheel(b, 0.08, 0.06, -0.13, 0.08, s * 0.115, st);
    // chassis wedge + rear axle block
    b.tapered('hull', [[-0.2, 0.09], [-0.2, 0.15], [-0.06, 0.17], [0.1, 0.15], [0.2, 0.11], [0.2, 0.09]], 0.15, 0.1);
    b.cbox('dark', 0.1, 0.06, 0.2, 0.01, -0.13, 0.11, 0);
    for (const s of [-1, 1]) {
      b.beam('metal', [0.17, 0.075, s * 0.028], [0.13, 0.15, s * 0.03], 0.007, 6);
      b.rbox('accent', 0.17, 0.012, 0.075, 0.005, -0.13, 0.178, s * 0.115);
      b.beam('chrome', [-0.2, 0.13, s * 0.045], [-0.3, 0.115, s * 0.05], 0.009, 8);
      b.cylX('dark', 0.011, 0.02, 8, -0.305, 0.115, s * 0.05);
    }
    b.rbox('accent', 0.1, 0.012, 0.07, 0.005, 0.17, 0.145, 0);
    b.cbox('leather', 0.075, 0.03, 0.095, 0.008, -0.07, 0.185, 0);
    b.cbox('leather', 0.018, 0.06, 0.095, 0.006, -0.11, 0.2, 0, 0, 0, 0.2);
    driver(b, st, -0.05, 0.19, 0);
    // steering column + dash
    b.beam('metal', [0.0, 0.17, 0], [0.04, 0.215, 0], 0.005, 6);
    b.cbox('dark', 0.03, 0.025, 0.1, 0.006, 0.07, 0.185, 0);
    b.box('glass', 0.012, 0.045, 0.1, 0.095, 0.215, 0, 0, 0, -0.5);
    lamp(b, 0.205, 0.135, 0.03, st === 'harkonnen' ? 'glowRed' : 'glowAmber', 0.012);
    lamp(b, 0.205, 0.135, -0.03, st === 'harkonnen' ? 'glowRed' : 'glowAmber', 0.012);
    // roll hoop
    for (const s of [-1, 1]) {
      b.pipe('chrome', [[-0.12, 0.17, s * 0.06], [-0.12, 0.3, s * 0.05], [-0.0, 0.31, s * 0.05], [0.02, 0.2, s * 0.05]], 0.0065);
    }
    b.beam('chrome', [-0.12, 0.3, -0.05], [-0.12, 0.3, 0.05], 0.0065, 6);
    if (st === 'harkonnen') {
      // bull bar, caged wheels and spikes
      b.cbox('dark', 0.014, 0.06, 0.15, 0.004, 0.225, 0.105, 0);
      spikes(b, 'dark', [0.235, 0.09, -0.07], [0.235, 0.09, 0.07], 4, 0.05, 0.011, [1, 0.1, 0]);
      for (const s of [-1, 1]) b.pipe('dark', [[-0.12, 0.17, s * 0.09], [-0.02, 0.2, s * 0.09], [0.02, 0.2, s * 0.06]], 0.006);
      stack(b, -0.19, 0.16, 0.06, 0.012, 0.05);
      stack(b, -0.19, 0.16, -0.06, 0.012, 0.05);
    } else if (st === 'ordos') {
      b.hemi('glass', 0.08, -0.04, 0.18, 0, 14, 0.8);
      b.torus('chrome', 0.08, 0.005, -0.04, 0.18, 0, Math.PI / 2, 0, 0, 16, 4);
      b.box('glowGreen', 0.2, 0.004, 0.08, 0.0, 0.092, 0);
    } else {
      b.box('trim', 0.2, 0.006, 0.006, 0.0, 0.17, 0.052);
      b.box('trim', 0.2, 0.006, 0.006, 0.0, 0.17, -0.052);
      antenna(b, -0.19, 0.17, 0.07, 0.17, 'metal', 'glowCyan', 0.01);
      b.box('accent', 0.04, 0.025, 0.002, -0.2, 0.34, 0.07);
    }
    emblemFront(b, st, -0.2 - 0.003, 0.14, 0, 0.05, -1);
    mgMount(b, st, 0.04, 0.215, 0, true);
  },

  raider(b, st) {
    wheel(b, 0.075, 0.045, 0.21, 0.075, 0, st);
    for (const s of [-1, 1]) wheel(b, 0.082, 0.06, -0.15, 0.082, s * 0.115, st);
    // long teardrop body
    b.tapered('hull', [[-0.24, 0.1], [-0.2, 0.15], [-0.04, 0.18], [0.12, 0.155], [0.27, 0.11], [0.26, 0.095]], 0.15, 0.09);
    b.sphere('hull', 0.07, -0.2, 0.15, 0, 12, 8, 0.8, 1.6, 1.1);
    for (const s of [-1, 1]) {
      b.rbox('accent', 0.2, 0.013, 0.08, 0.006, -0.15, 0.182, s * 0.115);
      b.cbox('hullLight', 0.2, 0.05, 0.012, 0.004, -0.15, 0.14, s * 0.09);
      b.box('chrome', 0.18, 0.004, 0.004, -0.15, 0.178, s * 0.145);
      b.beam('chrome', [0.21, 0.08, s * 0.03], [0.16, 0.14, s * 0.035], 0.006);
    }
    b.rbox('accent', 0.13, 0.013, 0.07, 0.006, 0.2, 0.15, 0);
    // bubble canopy
    b.hemi('glass', 0.085, 0.0, 0.16, 0, 16, 0.85);
    b.torus('chrome', 0.085, 0.005, 0.0, 0.16, 0, Math.PI / 2, 0, 0, 16, 4);
    b.box('hullLight', 0.02, 0.07, 0.003, 0.0, 0.2, 0, 0, 0, 0);
    driver(b, st, -0.01, 0.16, 0);
    // tail fin + underglow + exhaust
    b.tapered('accent', [[-0.28, 0.17], [-0.18, 0.17], [-0.22, 0.26], [-0.3, 0.27]], 0.012, 0.012);
    b.box('glowGreen', 0.32, 0.004, 0.075, 0.0, 0.094, 0);
    for (const s of [-1, 1]) {
      b.cylX('dark', 0.016, 0.04, 8, -0.27, 0.14, s * 0.04);
      b.cylX('glowGreen', 0.011, 0.01, 8, -0.295, 0.14, s * 0.04);
    }
    lamp(b, 0.26, 0.12, 0.025, 'glowGreen', 0.011);
    lamp(b, 0.26, 0.12, -0.025, 'glowGreen', 0.011);
    emblemSide(b, st, -0.12, 0.15, 0.1, 0.035, 1, null, 0);
    emblemSide(b, st, -0.12, 0.15, -0.1, 0.035, -1, null, 0);
    // asymmetric single gun on a side mount
    b.part('turret', [0.08, 0.155, 0.075]);
    b.cyl('dark', 0.025, 0.03, 0.02, 10, 0.08, 0.16, 0.075);
    b.cbox('hull', 0.05, 0.04, 0.05, 0.008, 0.085, 0.185, 0.075);
    b.part('barrel', [0.11, 0.19, 0.075], 'turret');
    b.cylX('metal', 0.009, 0.2, 8, 0.2, 0.19, 0.075);
    b.cylX('chrome', 0.014, 0.02, 8, 0.12, 0.19, 0.075);
    b.torus('glowGreen', 0.014, 0.003, 0.28, 0.19, 0.075, 0, Math.PI / 2, 0, 8, 4);
    b.part('turret');
    antenna(b, -0.22, 0.17, -0.07, 0.15, 'chrome', 'glowGreen', 0.01);
  },

  quad(b, st) {
    for (const x of [0.15, -0.15]) for (const s of [-1, 1]) wheel(b, 0.078, 0.062, x, 0.078, s * 0.135, st);
    // axle + body
    for (const x of [0.15, -0.15]) b.cylZ('dark', 0.012, 0.26, 6, x, 0.078, 0);
    b.tapered('hull', [[-0.22, 0.1], [-0.22, 0.2], [-0.15, 0.225], [0.12, 0.225], [0.22, 0.17], [0.22, 0.1]], 0.24, 0.2);
    for (const s of [-1, 1]) {
      for (const x of [0.15, -0.15]) b.rbox('accent', 0.15, 0.014, 0.075, 0.006, x, 0.168, s * 0.135);
      b.cbox('dark', 0.2, 0.04, 0.012, 0.003, 0, 0.13, s * 0.125);
    }
    // cab
    b.tapered('hullLight', [[-0.1, 0.225], [-0.1, 0.27], [-0.04, 0.3], [0.05, 0.3], [0.1, 0.25], [0.1, 0.225]], 0.19, 0.15);
    b.box('glass', 0.003, 0.05, 0.13, 0.1, 0.263, 0, 0, 0, -0.5);
    for (const s of [-1, 1]) b.box('glass', 0.1, 0.035, 0.003, 0.0, 0.265, s * 0.088);
    b.cbox('accent', 0.14, 0.01, 0.17, 0.003, -0.0, 0.305, 0);
    // hood grille + lights
    b.cbox('dark', 0.012, 0.06, 0.15, 0.003, 0.225, 0.14, 0);
    for (let i = 0; i < 4; i++) b.box('metal', 0.004, 0.005, 0.13, 0.232, 0.115 + i * 0.016, 0);
    lamp(b, 0.225, 0.2, 0.08, st === 'harkonnen' ? 'glowRed' : 'glowAmber', 0.014);
    lamp(b, 0.225, 0.2, -0.08, st === 'harkonnen' ? 'glowRed' : 'glowAmber', 0.014);
    // rear cargo rack + jerrycans + spare wheel
    b.cbox('dark', 0.1, 0.02, 0.2, 0.004, -0.17, 0.235, 0);
    for (const s of [-1, 1]) b.cbox('hull', 0.04, 0.05, 0.03, 0.006, -0.17, 0.27, s * 0.06);
    b.cyl('rubber', 0.03, 0.03, 0.02, 10, -0.235, 0.18, 0, 0, 0, Math.PI / 2);
    b.cbox('dark', 0.012, 0.09, 0.2, 0.003, -0.225, 0.15, 0);
    if (st === 'harkonnen') {
      spikes(b, 'dark', [0.235, 0.1, -0.1], [0.235, 0.1, 0.1], 4, 0.045, 0.011, [1, 0.1, 0]);
      b.cbox('dark', 0.04, 0.012, 0.2, 0.003, 0.215, 0.205, 0);
      stack(b, -0.17, 0.225, 0.095, 0.012, 0.06);
    } else if (st === 'ordos') {
      b.box('glowGreen', 0.3, 0.004, 0.17, 0, 0.098, 0);
      b.beam('chrome', [0.0, 0.305, 0.07], [0.0, 0.38, 0.07], 0.004);
      b.sphere('glowGreen', 0.01, 0.0, 0.382, 0.07, 6, 4);
    } else {
      b.box('trim', 0.4, 0.006, 0.004, 0, 0.225, 0.123);
      b.box('trim', 0.4, 0.006, 0.004, 0, 0.225, -0.123);
      antenna(b, -0.2, 0.235, 0.09, 0.16, 'metal', 'glowCyan', 0.01);
    }
    emblemSide(b, st, -0.03, 0.17, 0.125 * 0.99 + 0.006, 0.04, 1);
    emblemSide(b, st, -0.03, 0.17, -0.125 * 0.99 - 0.006, 0.04, -1);
    mgMount(b, st, 0.0, 0.31, 0, true);
  },
};
