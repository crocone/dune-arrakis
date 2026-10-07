import * as THREE from 'three';
import { Y0, foundation, windows, garageDoor, roofUnit, tankV, railing, flag, lattice, pipeRun, crenellations, antenna, stack, emblemFront, emblemSide, emblemTop, spikes } from './bkit.js';

// Production structures: barracks, WOR, light / heavy / high-tech factories.

function archRoof(b, mat, ribMat, x0, x1, cz, r, y = Y0, ribs = 6) {
  const len = x1 - x0;
  b.add(mat, new THREE.CylinderGeometry(r, r, len, 20, 1, false, 0, Math.PI), (x0 + x1) / 2, y, cz, 0, 0, Math.PI / 2);
  for (let i = 0; i < ribs; i++) {
    const x = x0 + (i / (ribs - 1)) * len;
    b.add(ribMat, new THREE.TorusGeometry(r + 0.005, 0.014, 5, 20, Math.PI), x, y, cz, 0, Math.PI / 2, 0);
  }
}

export const BASE2_DEFS = {
  barracks(b, st) {
    foundation(b, 2, 2);
    const W = st === 'harkonnen' ? 'hull' : 'hullLight';
    b.cbox(W, 1.6, 0.34, 0.8, 0.05, 1.0, Y0 + 0.17, 1.25);
    b.cbox(W, 0.8, 0.3, 0.7, 0.05, 0.6, Y0 + 0.15, 0.6);
    const top = Y0 + 0.34;
    b.cbox('accent', 1.64, 0.04, 0.84, 0.01, 1.0, top + 0.02, 1.25);
    b.cbox('accent', 0.84, 0.04, 0.74, 0.01, 0.6, Y0 + 0.32, 0.6);
    windows(b, 0.4, 1.75, Y0 + 0.22, 1.656, 5);
    windows(b, 0.3, 0.9, Y0 + 0.2, 0.956, 3);
    // entrance
    b.cbox('dark', 0.3, 0.24, 0.04, 0.008, 1.0, Y0 + 0.13, 1.64);
    b.box(st === 'harkonnen' ? 'glowRed' : 'glowAmber', 0.18, 0.02, 0.01, 1.0, Y0 + 0.26, 1.665);
    for (const s of [-1, 1]) b.cbox('hazard', 0.03, 0.22, 0.03, 0.005, 1.0 + s * 0.18, Y0 + 0.12, 1.66);
    roofUnit(b, 1.5, top + 0.04, 1.0);
    roofUnit(b, 0.5, Y0 + 0.34, 0.4, 0.8);
    flag(b, 1.75, Y0 + 0.36, 1.52, 0.45, 0.16);
    antenna(b, 0.3, Y0 + 0.34, 0.35, 0.3, 'metal', 'glowRed', 0);
    const roofY = top + 0.04;
    if (st === 'atreides') {
      // hawk: swept wings spread over the roof, beak facing the entrance
      for (const s of [-1, 1]) {
        const cx = 1.0;
        const pts = [[cx + s * 0.04, 1.0], [cx + s * 0.78, 0.82], [cx + s * 0.86, 1.05], [cx + s * 0.5, 1.2], [cx + s * 0.04, 1.35]];
        b.prism('trim', pts, 0.025, roofY, 0.004);
        b.prism('accent', pts.map(([x, z]) => [cx + (x - cx) * 0.92, 1.0 + (z - 1.0) * 0.9 + 0.02]), 0.012, roofY + 0.025);
        for (let i = 1; i < 5; i++) b.beam('trim', [cx + s * 0.05, roofY + 0.04, 1.15], [cx + s * (0.2 + i * 0.15), roofY + 0.04, 0.88 + i * 0.03], 0.006, 4);
      }
      b.cone('trim', 0.08, 0.28, 4, 1.0, roofY + 0.07, 1.5, Math.PI / 2, 0, 0);
      b.cbox('trim', 0.12, 0.1, 0.2, 0.02, 1.0, roofY + 0.06, 1.2);
      b.sphere('glowCyan', 0.016, 0.97, roofY + 0.1, 1.38, 6, 4);
      b.sphere('glowCyan', 0.016, 1.03, roofY + 0.1, 1.38, 6, 4);
      emblemFront(b, st, 1.0, Y0 + 0.3, 1.676, 0.14, 1);
    } else if (st === 'harkonnen') {
      // bull: skull plate with horns and glowing eyes over the gate
      b.cbox('dark', 0.55, 0.28, 0.12, 0.03, 1.0, top + 0.19, 1.6);
      b.cbox('hull', 0.3, 0.16, 0.14, 0.02, 1.0, top + 0.13, 1.63);
      b.cbox('dark', 0.16, 0.1, 0.16, 0.02, 1.0, top + 0.06, 1.67);
      b.torus('metal', 0.04, 0.007, 1.0, top + 0.03, 1.76, 0, 0, 0, 10, 4);
      for (const s of [-1, 1]) {
        b.sphere('glowRed', 0.022, 1.0 + s * 0.1, top + 0.2, 1.7, 8, 6);
        const hx = 1.0 + s * 0.26;
        b.beam('hull', [hx, top + 0.22, 1.6], [1.0 + s * 0.42, top + 0.3, 1.6], 0.04, 8, 0.03);
        b.beam('hull', [1.0 + s * 0.42, top + 0.3, 1.6], [1.0 + s * 0.52, top + 0.5, 1.6], 0.03, 8, 0.016);
        b.beam('metal', [1.0 + s * 0.52, top + 0.5, 1.6], [1.0 + s * 0.5, top + 0.62, 1.6], 0.016, 8, 0.004);
      }
      spikes(b, 'dark', [0.25, roofY, 1.0], [1.75, roofY, 1.0], 8, 0.1, 0.02, [0, 1, -0.3]);
      stack(b, 0.3, Y0 + 0.34, 0.3, 0.035, 0.28);
      b.torus('glowRed', 0.037, 0.006, 0.3, Y0 + 0.64, 0.3, Math.PI / 2, 0, 0, 12, 4);
    } else {
      // snake: coiled serpent sculpture on the roof, domed rear wing
      b.hemi('accent', 0.38, 0.6, Y0 + 0.34, 0.6, 22, 0.55);
      b.torus('chrome', 0.38, 0.012, 0.6, Y0 + 0.345, 0.6, Math.PI / 2, 0, 0, 24, 4);
      const cx = 1.1, cz = 1.2;
      for (let i = 0; i < 5; i++) {
        const r = 0.3 - i * 0.04;
        b.torus('hull', r, 0.04, cx, roofY + 0.04 + i * 0.07, cz, Math.PI / 2, 0, 0, 24, 8);
        b.torus('accent', r, 0.012, cx, roofY + 0.075 + i * 0.07, cz, Math.PI / 2, 0, 0, 24, 4);
      }
      b.beam('hull', [cx + 0.1, roofY + 0.36, cz], [cx + 0.28, roofY + 0.5, cz], 0.04, 10, 0.034);
      b.sphere('hull', 0.055, cx + 0.3, roofY + 0.52, cz, 12, 8, 0.8, 1.4, 1.0);
      b.sphere('glowGreen', 0.012, cx + 0.34, roofY + 0.55, cz + 0.03, 6, 4);
      b.sphere('glowGreen', 0.012, cx + 0.34, roofY + 0.55, cz - 0.03, 6, 4);
      b.box('glowRed', 0.07, 0.004, 0.008, cx + 0.4, roofY + 0.5, cz);
      emblemFront(b, st, 1.0, Y0 + 0.3, 1.676, 0.12, 1);
    }
  },

  wor(b, st) {
    foundation(b, 2, 2);
    // stepped ziggurat of heavy plating
    b.cbox('hull', 1.7, 0.26, 1.5, 0.05, 1.0, Y0 + 0.13, 1.0);
    b.cbox('accent', 1.74, 0.03, 1.54, 0.01, 1.0, Y0 + 0.275, 1.0);
    b.cbox('hull', 1.3, 0.22, 1.1, 0.05, 1.0, Y0 + 0.39, 1.0);
    b.cbox('hullLight', 1.34, 0.025, 1.14, 0.008, 1.0, Y0 + 0.5, 1.0);
    b.cbox('hull', 0.86, 0.2, 0.7, 0.04, 1.0, Y0 + 0.6, 1.0);
    // central tower with conical roof
    b.cyl('hullLight', 0.24, 0.3, 0.5, 12, 1.0, Y0 + 0.95, 1.0);
    b.torus('accent', 0.255, 0.018, 1.0, Y0 + 0.75, 1.0, Math.PI / 2, 0, 0, 20, 4);
    b.torus('metal', 0.25, 0.012, 1.0, Y0 + 1.1, 1.0, Math.PI / 2, 0, 0, 20, 4);
    b.cone('accent', 0.3, 0.26, 12, 1.0, Y0 + 1.33, 1.0);
    b.cyl('chrome', 0.01, 0.012, 0.18, 6, 1.0, Y0 + 1.55, 1.0);
    b.sphere('glowRed', 0.03, 1.0, Y0 + 1.66, 1.0, 8, 6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box('glowAmber', 0.03, 0.06, 0.012, 1.0 + Math.cos(a) * 0.27, Y0 + 0.95, 1.0 + Math.sin(a) * 0.27, 0, -a - Math.PI / 2, 0);
    }
    windows(b, 0.35, 1.65, Y0 + 0.18, 1.756, 6, 'glowAmber');
    // armoured gate with warning lights
    b.cbox('dark', 0.5, 0.28, 0.06, 0.01, 1.0, Y0 + 0.14, 1.74);
    for (let i = 0; i < 5; i++) b.box('metal', 0.46, 0.014, 0.012, 1.0, Y0 + 0.05 + i * 0.05, 1.775);
    b.box(st === 'ordos' ? 'glowGreen' : 'glowRed', 0.4, 0.02, 0.012, 1.0, Y0 + 0.3, 1.77);
    for (const s of [-1, 1]) {
      b.cbox('hazard', 0.04, 0.28, 0.04, 0.005, 1.0 + s * 0.28, Y0 + 0.14, 1.76);
      // searchlights on the tier corners
      b.cbox('dark', 0.06, 0.05, 0.06, 0.01, 1.0 + s * 0.55, Y0 + 0.53, 1.44);
      b.cone('glowWhite', 0.025, 0.04, 8, 1.0 + s * 0.55, Y0 + 0.57, 1.47, Math.PI / 2, 0, 0);
    }
    emblemFront(b, st, 1.0, Y0 + 0.46, 1.556 + 0.01, 0.18, 1, st === 'harkonnen' ? 'accent' : null);
    roofUnit(b, 0.55, Y0 + 0.27, 0.55);
    roofUnit(b, 1.45, Y0 + 0.27, 0.55);
    if (st === 'harkonnen') {
      spikes(b, 'dark', [0.2, Y0 + 0.29, 0.25], [1.8, Y0 + 0.29, 0.25], 9, 0.12, 0.025, [0, 1, -0.2]);
      spikes(b, 'dark', [0.2, Y0 + 0.29, 1.75], [1.8, Y0 + 0.29, 1.75], 9, 0.12, 0.025, [0, 1, 0.2]);
      for (const x of [0.45, 1.55]) {
        stack(b, x, Y0 + 0.5, 0.75, 0.04, 0.3);
        b.torus('glowRed', 0.042, 0.007, x, Y0 + 0.8, 0.75, Math.PI / 2, 0, 0, 12, 4);
      }
    } else if (st === 'atreides') {
      crenellations(b, 'trim', 0.25, 1.75, Y0 + 0.29, 1.75, 9, 0.08, 0.045, 0.04);
    } else {
      for (const x of [0.5, 1.5]) {
        b.hemi('accent', 0.2, x, Y0 + 0.28, 0.6, 18, 0.9);
        b.torus('chrome', 0.2, 0.01, x, Y0 + 0.285, 0.6, Math.PI / 2, 0, 0, 20, 4);
      }
    }
  },

  lightFactory(b, st) {
    foundation(b, 2, 2);
    // vaulted hangar, door on the +X end
    b.cbox('dark', 1.62, 0.04, 1.02, 0.01, 1.0, Y0 + 0.02, 0.95);
    archRoof(b, st === 'harkonnen' ? 'hull' : 'hullLight', st === 'atreides' ? 'trim' : st === 'ordos' ? 'chrome' : 'accent', 0.2, 1.8, 0.95, 0.5, Y0, 7);
    b.add('dark', new THREE.CircleGeometry(0.5, 22, 0, Math.PI), 1.804, Y0, 0.95, 0, Math.PI / 2, 0);
    b.cbox('dark', 0.03, 0.34, 0.66, 0.006, 1.81, Y0 + 0.17, 0.95);
    for (let i = 0; i < 6; i++) b.box('metal', 0.012, 0.025, 0.62, 1.828, Y0 + 0.05 + i * 0.055, 0.95);
    b.box('glowAmber', 0.014, 0.025, 0.4, 1.834, Y0 + 0.4, 0.95);
    for (let i = 0; i < 5; i++) b.box(i % 2 ? 'dark' : 'hazard', 0.014, 0.03, 0.13, 1.826, Y0 + 0.395 - 0.0, 0.62 + i * 0.1);
    // side office + generator
    b.cbox('hullLight', 0.8, 0.26, 0.38, 0.04, 0.7, Y0 + 0.13, 1.62);
    b.cbox('accent', 0.84, 0.03, 0.42, 0.008, 0.7, Y0 + 0.275, 1.62);
    windows(b, 0.4, 1.0, Y0 + 0.17, 1.816, 3);
    roofUnit(b, 0.5, Y0 + 0.29, 1.62, 0.9);
    stack(b, 1.25, Y0 + 0.0, 1.55, 0.05, 0.5);
    if (st === 'harkonnen') {
      b.torus('glowRed', 0.052, 0.008, 1.25, Y0 + 0.5, 1.55, Math.PI / 2, 0, 0, 12, 4);
      spikes(b, 'dark', [0.25, Y0 + 0.5, 0.95], [1.75, Y0 + 0.5, 0.95], 8, 0.09, 0.02, [0, 1, 0]);
    }
    // overhead crane rail + hoist
    b.beam('metal', [0.35, Y0 + 0.56, 0.7], [1.65, Y0 + 0.56, 0.7], 0.012, 5);
    b.cbox('dark', 0.1, 0.05, 0.08, 0.01, 1.2, Y0 + 0.57, 0.7);
    emblemSide(b, st, 1.0, Y0 + 0.2, 1.816, 0.1, 1);
  },

  heavyFactory(b, st) {
    foundation(b, 3, 2);
    // main shed with sawtooth roof
    b.cbox('hull', 2.4, 0.5, 1.5, 0.05, 1.3, Y0 + 0.25, 1.0);
    b.cbox('accent', 2.44, 0.045, 1.54, 0.012, 1.3, Y0 + 0.52, 1.0);
    for (let i = 0; i < 4; i++) {
      const x0 = 0.28 + i * 0.5;
      b.tapered('hullLight', [[x0, Y0 + 0.545], [x0 + 0.5, Y0 + 0.545], [x0 + 0.5, Y0 + 0.74], [x0 + 0.02, Y0 + 0.57]], 1.4, 1.4, 0, 0, 1.0);
      b.box('glass', 0.012, 0.15, 1.3, x0 + 0.505, Y0 + 0.65, 1.0);
      b.box('accent', 0.03, 0.03, 1.4, x0 + 0.5, Y0 + 0.74, 1.0);
    }
    // big rolling door on the +X end
    garageDoor(b, 1.0, Y0, 2.52, 0.7, 0.42, 'x', 1);
    b.box('glowAmber', 0.012, 0.025, 0.62, 2.532, Y0 + 0.5, 1.0);
    windows(b, 0.35, 2.3, Y0 + 0.32, 1.756, 7);
    // loading apron
    b.cbox('concreteDark', 0.4, 0.03, 0.9, 0.01, 2.72, Y0 + 0.015, 1.0);
    for (let i = 0; i < 6; i++) b.box(i % 2 ? 'dark' : 'hazard', 0.3, 0.004, 0.1, 2.72, Y0 + 0.032, 0.6 + i * 0.16);
    // rotating gantry crane (animated)
    b.cbox('dark', 0.08, 0.5, 0.08, 0.01, 2.2, Y0 + 0.8, 0.45);
    b.part('crane', [2.2, Y0 + 1.06, 0.45]);
    b.cyl('dark', 0.08, 0.09, 0.05, 10, 2.2, Y0 + 1.05, 0.45);
    b.cbox('accent', 0.1, 0.07, 0.1, 0.01, 2.22, Y0 + 1.1, 0.45);
    b.beam('trim', [2.2, Y0 + 1.1, 0.45], [1.1, Y0 + 1.1, 0.45], 0.014, 6);
    b.beam('metal', [2.2, Y0 + 1.1, 0.45], [2.45, Y0 + 1.1, 0.45], 0.012, 6);
    b.cbox('dark', 0.1, 0.07, 0.09, 0.01, 2.43, Y0 + 1.09, 0.45);
    b.beam('chrome', [2.18, Y0 + 1.1, 0.45], [2.18, Y0 + 1.22, 0.45], 0.007, 5);
    b.beam('chrome', [2.18, Y0 + 1.22, 0.45], [1.3, Y0 + 1.1, 0.45], 0.004, 4);
    b.beam('chrome', [1.25, Y0 + 1.09, 0.45], [1.25, Y0 + 0.8, 0.45], 0.003, 4);
    b.cbox('hazard', 0.06, 0.05, 0.06, 0.008, 1.25, Y0 + 0.77, 0.45);
    b.part('body');
    // stacks, fuel tanks, pipes
    for (const x of [0.5, 0.75]) {
      stack(b, x, Y0 + 0.5, 0.25, 0.05, st === 'harkonnen' ? 0.55 : 0.4);
      if (st === 'harkonnen') b.torus('glowRed', 0.052, 0.008, x, Y0 + 1.05, 0.25, Math.PI / 2, 0, 0, 12, 4);
    }
    tankV(b, 0.3, Y0 + 0.0, 1.8, 0.14, 0.36, 'hullLight', 'accent', false);
    pipeRun(b, [[0.3, Y0 + 0.3, 1.8], [0.3, Y0 + 0.4, 1.5], [0.6, Y0 + 0.4, 1.0]], 0.02);
    roofUnit(b, 2.0, Y0 + 0.545, 1.3);
    emblemFront(b, st, 1.3, Y0 + 0.4, 1.756, 0.2, 1, st === 'harkonnen' ? 'dark' : null);
    if (st === 'harkonnen') spikes(b, 'dark', [0.2, Y0 + 0.545, 1.72], [2.4, Y0 + 0.545, 1.72], 11, 0.1, 0.022, [0, 1, 0.2]);
    if (st === 'atreides') crenellations(b, 'trim', 0.2, 2.4, Y0 + 0.545, 1.74, 12, 0.08, 0.04, 0.04);
  },

  highTechFactory(b, st) {
    foundation(b, 3, 2);
    b.cbox('hullLight', 2.1, 0.42, 1.4, 0.07, 1.15, Y0 + 0.21, 1.0);
    archRoof(b, 'hull', st === 'atreides' ? 'trim' : st === 'ordos' ? 'chrome' : 'accent', 0.15, 2.15, 1.0, 0.56, Y0 + 0.4, 8);
    b.add('dark', new THREE.CircleGeometry(0.56, 22, 0, Math.PI), 2.154, Y0 + 0.4, 1.0, 0, Math.PI / 2, 0);
    b.cbox('dark', 0.03, 0.4, 0.75, 0.006, 2.16, Y0 + 0.24, 1.0);
    for (let i = 0; i < 6; i++) b.box('metal', 0.012, 0.025, 0.7, 2.176, Y0 + 0.07 + i * 0.06, 1.0);
    b.box('glowCyan', 0.012, 0.03, 0.55, 2.182, Y0 + 0.5, 1.0);
    windows(b, 0.3, 2.0, Y0 + 0.26, 1.706, 7, 'glowCyan');
    // glass observation dome and antennas
    b.hemi('glass', 0.2, 0.55, Y0 + 0.97, 0.9, 18, 0.9);
    b.torus('chrome', 0.2, 0.012, 0.55, Y0 + 0.97, 0.9, Math.PI / 2, 0, 0, 20, 4);
    antenna(b, 1.2, Y0 + 1.0, 1.3, 0.35, 'metal', 'glowRed', 0);
    antenna(b, 1.4, Y0 + 1.0, 0.6, 0.25, 'metal', 'glowCyan', 0);
    roofUnit(b, 1.8, Y0 + 0.95, 0.75, 0.8);
    // ornithopter landing pad
    b.cbox('concreteDark', 0.75, 0.05, 0.75, 0.025, 2.58, Y0 + 0.025, 0.5);
    b.torus('glowCyan', 0.27, 0.014, 2.58, Y0 + 0.055, 0.5, Math.PI / 2, 0, 0, 28, 4);
    b.torus('hazard', 0.32, 0.012, 2.58, Y0 + 0.055, 0.5, Math.PI / 2, 0, 0, 28, 4);
    b.box('hazard', 0.3, 0.004, 0.04, 2.58, Y0 + 0.054, 0.5);
    b.box('hazard', 0.04, 0.004, 0.3, 2.58, Y0 + 0.054, 0.5);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box('glowCyan', 0.04, 0.02, 0.04, 2.58 + dx * 0.33, Y0 + 0.06, 0.5 + dz * 0.33);
    if (st === 'harkonnen') {
      spikes(b, 'dark', [0.25, Y0 + 0.42, 1.68], [2.05, Y0 + 0.42, 1.68], 9, 0.09, 0.02, [0, 1, 0.3]);
      stack(b, 0.4, Y0 + 0.42, 0.45, 0.04, 0.3);
    }
  },
};
