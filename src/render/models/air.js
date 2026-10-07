import * as THREE from 'three';
import { antenna, lamp, spikes, emblemTop, emblemSide, emblemFront } from './kit.js';

// Air units: carryall, ornithopter and the frigate (Heighliner shuttle).

const mirror = (pts, s) => pts.map(([x, z]) => [x, z * s]);

export const AIR_DEFS = {
  carryall(b, st) {
    // fuselage: flattened cigar
    b.lathe('hull', [[0, -0.36], [0.045, -0.34], [0.08, -0.26], [0.097, -0.1], [0.097, 0.08], [0.082, 0.22], [0.045, 0.32], [0, 0.35]], 22, 0, 0, 0, 0, 0, -Math.PI / 2, 0.82, 1, 1.15);
    b.cbox('accent', 0.34, 0.012, 0.11, 0.004, -0.02, 0.078, 0);
    b.cbox('dark', 0.32, 0.05, 0.15, 0.015, -0.02, -0.085, 0);
    b.sphere('glass', 0.062, 0.2, 0.034, 0, 14, 10, 0.75, 1.4, 1.0);
    b.torus('trim', 0.058, 0.004, 0.17, 0.034, 0, 0, Math.PI / 2, 0, 12, 4);
    for (const s of [-1, 1]) {
      // two wing pairs (dragonfly layout)
      const front = st === 'harkonnen'
        ? [[0.18, 0.08], [0.0, 0.08], [-0.08, 0.5], [0.0, 0.54], [0.1, 0.28]]
        : [[0.16, 0.08], [-0.02, 0.08], [-0.12, 0.52], [-0.02, 0.57]];
      const rear = [[-0.12, 0.08], [-0.3, 0.08], [-0.36, 0.42], [-0.26, 0.44]];
      b.prism('hullLight', mirror(front, s), 0.022, 0.03, 0.004);
      b.prism('hullLight', mirror(rear, s), 0.02, 0.0, 0.004);
      b.prism('accent', mirror([[0.12, 0.2], [0.0, 0.2], [-0.04, 0.4], [0.04, 0.42]], s), 0.004, 0.0525);
      b.beam('trim', [0.16, 0.05, s * 0.09], [-0.02, 0.05, s * 0.57], 0.008, 6);
      b.beam('metal', [-0.12, 0.012, s * 0.09], [-0.26, 0.012, s * 0.44], 0.007, 6);
      for (const t of [0.3, 0.55, 0.8]) b.beam('metal', [0.14 - t * 0.14, 0.04, s * (0.08 + t * 0.46)], [-0.1 - t * 0.12, 0.04, s * (0.08 + t * 0.44)], 0.004, 4);
      // wingtip engine pods
      b.cylX('dark', 0.045, 0.2, 12, -0.07, 0.04, s * 0.58);
      b.torus('chrome', 0.045, 0.007, 0.03, 0.04, s * 0.58, 0, Math.PI / 2, 0, 14, 4);
      b.cylX('accent', 0.047, 0.04, 12, -0.07, 0.04, s * 0.58);
      b.cylX('glowAmber', 0.034, 0.01, 12, -0.172, 0.04, s * 0.58);
      b.cone('dark', 0.03, 0.05, 10, 0.05, 0.04, s * 0.58, 0, 0, Math.PI / 2);
      b.sphere(s > 0 ? 'glowGreen' : 'glowRed', 0.01, 0.0, 0.07, s * 0.6, 6, 4);
      // big rear nozzles
      b.cylX('dark', 0.052, 0.14, 12, -0.37, -0.02, s * 0.12);
      b.torus('metal', 0.052, 0.008, -0.3, -0.02, s * 0.12, 0, Math.PI / 2, 0, 14, 4);
      b.cylX('glowAmber', 0.04, 0.01, 12, -0.441, -0.02, s * 0.12);
      // landing struts with pads
      for (const x of [0.12, -0.12]) {
        b.beam('dark', [x, -0.09, s * 0.07], [x + (x > 0 ? 0.03 : -0.03), -0.2, s * 0.1], 0.01, 6);
        b.cyl('metal', 0.026, 0.03, 0.012, 8, x + (x > 0 ? 0.03 : -0.03), -0.205, s * 0.1);
      }
      emblemTop(b, st, -0.04, 0.0545, s * 0.3, 0.1);
      if (st === 'harkonnen') spikes(b, 'dark', [0.0, 0.04, s * 0.54], [0.16, 0.04, s * 0.1], 4, 0.05, 0.012, [0.3, 0, s * 0.9]);
    }
    // tail fin + stabilizers
    b.tapered('accent', [[-0.26, 0.07], [-0.4, 0.07], [-0.46, 0.2], [-0.4, 0.21]], 0.012, 0.012);
    b.prism('hullLight', [[-0.3, 0.07], [-0.46, 0.2], [-0.46, -0.2], [-0.3, -0.07]], 0.012, 0.02, 0.003);
    // winch + hook
    b.cyl('metal', 0.02, 0.02, 0.1, 8, 0, -0.14, 0);
    b.beam('chrome', [0, -0.11, 0], [0, -0.2, 0], 0.005, 5);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.beam('metal', [0, -0.2, 0], [Math.cos(a) * 0.04, -0.25, Math.sin(a) * 0.04], 0.006, 5);
    }
    lamp(b, 0.3, -0.01, 0.04, 'glowWhite', 0.012);
    lamp(b, 0.3, -0.01, -0.04, 'glowWhite', 0.012);
    antenna(b, 0.0, 0.08, 0.0, 0.1, 'metal', 'glowRed', 0.02);
  },

  ornithopter(b, st) {
    // fuselage
    b.lathe('hull', [[0, -0.22], [0.03, -0.2], [0.054, -0.1], [0.062, 0.04], [0.05, 0.15], [0.026, 0.23], [0, 0.26]], 16, 0.02, 0, 0, 0, 0, -Math.PI / 2, 0.85, 1, 0.95);
    b.cbox('accent', 0.2, 0.01, 0.07, 0.003, -0.05, 0.049, 0);
    b.sphere('glass', 0.05, 0.14, 0.028, 0, 12, 10, 0.78, 1.4, 0.95);
    b.torus('trim', 0.047, 0.003, 0.12, 0.028, 0, 0, Math.PI / 2, 0, 12, 4);
    // tail boom + fins
    b.beam('hull', [-0.18, 0.01, 0], [-0.43, 0.035, 0], 0.012, 6);
    b.tapered('accent', [[-0.34, 0.03], [-0.46, 0.03], [-0.47, 0.11], [-0.42, 0.115]], 0.008, 0.008);
    b.prism('hullLight', [[-0.38, 0.015], [-0.46, 0.07], [-0.46, -0.07], [-0.38, -0.015]], 0.008, 0.02);
    // rocket booster
    b.cylX('dark', 0.03, 0.1, 10, -0.24, -0.015, 0);
    b.cylX('glowAmber', 0.02, 0.008, 10, -0.294, -0.015, 0);
    b.torus('metal', 0.03, 0.005, -0.2, -0.015, 0, 0, Math.PI / 2, 0, 10, 4);
    // skids + guns
    for (const s of [-1, 1]) {
      b.beam('dark', [0.1, -0.035, s * 0.03], [0.12, -0.075, s * 0.045], 0.005, 5);
      b.beam('dark', [-0.08, -0.04, s * 0.03], [-0.1, -0.075, s * 0.045], 0.005, 5);
      b.beam('metal', [0.17, -0.076, s * 0.045], [-0.12, -0.076, s * 0.045], 0.005, 5);
      b.cylX('metal', 0.008, 0.14, 6, 0.27, -0.03, s * 0.025);
      b.cylX('dark', 0.013, 0.04, 6, 0.2, -0.03, s * 0.025);
    }
    if (st === 'harkonnen') {
      for (const s of [-1, 1]) {
        b.cbox('dark', 0.12, 0.03, 0.04, 0.006, 0.0, -0.045, s * 0.07);
        b.cone('accent', 0.012, 0.03, 6, 0.1, -0.045, s * 0.07, 0, 0, -Math.PI / 2);
      }
    }
    emblemTop(b, st, -0.05, 0.0555, 0, 0.06);
    lamp(b, 0.22, 0.0, 0.02, 'glowWhite', 0.008);
    // flapping wings (dragonfly pairs); pivot at the shoulder
    for (const s of [1, -1]) {
      b.part(s > 0 ? 'wingL' : 'wingR', [0.02, 0.04, s * 0.06]);
      const fore = st === 'harkonnen'
        ? [[0.09, s * 0.06], [-0.02, s * 0.06], [-0.1, s * 0.56], [0.04, s * 0.5]]
        : st === 'ordos'
          ? [[0.08, s * 0.06], [-0.03, s * 0.06], [-0.06, s * 0.3], [-0.14, s * 0.54], [-0.02, s * 0.55], [0.06, s * 0.36]]
          : [[0.07, s * 0.06], [-0.03, s * 0.06], [-0.09, s * 0.56], [0.02, s * 0.54]];
      const hind = [[-0.05, s * 0.06], [-0.15, s * 0.06], [-0.2, s * 0.42], [-0.11, s * 0.4]];
      b.prism('membrane', fore, 0.004, 0.042);
      b.prism('membrane', hind, 0.004, 0.038);
      b.beam(st === 'atreides' ? 'trim' : 'metal', [0.07, 0.045, s * 0.06], [0.03, 0.045, s * 0.55], 0.007, 5);
      b.beam('metal', [-0.03, 0.04, s * 0.06], [-0.09, 0.044, s * 0.55], 0.005, 5);
      b.beam('metal', [-0.1, 0.04, s * 0.06], [-0.2, 0.04, s * 0.41], 0.004, 5);
      for (const t of [0.3, 0.55, 0.8]) b.beam('metal', [0.065 - t * 0.04, 0.045, s * (0.06 + t * 0.48)], [-0.03 - t * 0.06, 0.044, s * (0.06 + t * 0.48)], 0.0025, 4);
      b.cyl('accent', 0.014, 0.014, 0.05, 8, 0.0, 0.045, s * 0.07, Math.PI / 2, 0, 0);
      b.part('body');
    }
  },

  frigate(b, st) {
    // long ribbed cargo hull
    b.cbox('hull', 1.8, 0.34, 0.76, 0.1, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const x = -0.7 + i * 0.235;
      b.cbox('hullLight', 0.06, 0.4, 0.82, 0.015, x, 0.0, 0);
      b.box('trim', 0.05, 0.02, 0.84, x, 0.15, 0);
    }
    for (const s of [-1, 1]) {
      // cargo bay doors + running lights
      b.cbox('dark', 1.3, 0.16, 0.02, 0.01, -0.05, 0.02, s * 0.385);
      for (let i = 0; i < 9; i++) b.box(i % 3 === 0 ? 'glowAmber' : 'glowWhite', 0.025, 0.018, 0.012, -0.64 + i * 0.16, -0.12, s * 0.385);
      b.cbox('accent', 0.5, 0.05, 0.02, 0.006, 0.55, 0.0, s * 0.385);
      emblemSide(b, st, 0.55, 0.0, s * 0.4, 0.14, s);
      // docking struts
      b.beam('dark', [0.3, -0.12, s * 0.3], [0.38, -0.3, s * 0.34], 0.025, 6);
      b.beam('dark', [-0.3, -0.12, s * 0.3], [-0.38, -0.3, s * 0.34], 0.025, 6);
      for (const x of [0.38, -0.38]) b.cyl('metal', 0.07, 0.08, 0.025, 10, x, -0.31, s * 0.34);
    }
    // bridge tower with a glass band
    b.rbox('hullLight', 0.8, 0.2, 0.5, 0.05, -0.4, 0.26, 0);
    b.rbox('accent', 0.82, 0.04, 0.52, 0.015, -0.4, 0.37, 0);
    b.cbox('hull', 0.32, 0.18, 0.4, 0.03, 0.55, 0.26, 0);
    b.box('glass', 0.012, 0.07, 0.36, 0.71, 0.27, 0);
    for (const s of [-1, 1]) b.box('glass', 0.3, 0.06, 0.006, 0.55, 0.27, s * 0.2);
    b.cbox('accent', 0.34, 0.03, 0.42, 0.01, 0.55, 0.36, 0);
    antenna(b, -0.1, 0.38, 0.1, 0.25, 'metal', 'glowRed', 0.03);
    antenna(b, -0.6, 0.38, -0.1, 0.2, 'metal', 'glowGreen', 0);
    // engines
    for (const z of [-0.28, 0, 0.28]) {
      b.cylX('dark', 0.12, 0.22, 14, -0.95, -0.02, z);
      b.torus('metal', 0.12, 0.016, -0.86, -0.02, z, 0, Math.PI / 2, 0, 16, 5);
      b.torus('trim', 0.1, 0.01, -1.0, -0.02, z, 0, Math.PI / 2, 0, 16, 4);
      b.cylX('glowAmber', 0.095, 0.01, 14, -1.056, -0.02, z);
    }
    // dorsal spine
    b.cbox('dark', 1.2, 0.04, 0.12, 0.01, 0.1, 0.19, 0);
    for (let i = 0; i < 6; i++) b.box('glowCyan', 0.03, 0.012, 0.03, -0.4 + i * 0.2, 0.215, 0);
    for (const s of [-1, 1]) b.cbox('hullLight', 0.3, 0.05, 0.12, 0.01, 0.2, -0.05, s * 0.45);
  },
};
