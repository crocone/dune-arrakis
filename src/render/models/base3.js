import * as THREE from 'three';
import { Y0, foundation, windows, garageDoor, roofUnit, tankV, railing, flag, lattice, pipeRun, crenellations, antenna, stack, emblemFront, emblemSide, emblemTop, spikes } from './bkit.js';

// Support / prestige structures: repair yard, starport, palace, House of IX.

export const BASE3_DEFS = {
  repairYard(b, st) {
    foundation(b, 3, 2);
    // service pad with hazard border
    b.cbox('concreteDark', 1.75, 0.05, 1.75, 0.02, 1.85, Y0 + 0.025, 1.0);
    b.torus('glowAmber', 0.62, 0.02, 1.85, Y0 + 0.055, 1.0, Math.PI / 2, 0, 0, 32, 4);
    b.torus('hazard', 0.7, 0.012, 1.85, Y0 + 0.055, 1.0, Math.PI / 2, 0, 0, 32, 4);
    for (let i = 0; i < 8; i++) b.box(i % 2 ? 'dark' : 'hazard', 0.2, 0.005, 0.05, 1.85 - 0.8 + i * 0.23, Y0 + 0.053, 1.0 + 0.82);
    for (let i = 0; i < 8; i++) b.box(i % 2 ? 'dark' : 'hazard', 0.2, 0.005, 0.05, 1.85 - 0.8 + i * 0.23, Y0 + 0.053, 1.0 - 0.82);
    // service hall
    b.cbox('hull', 0.78, 0.46, 1.62, 0.05, 0.5, Y0 + 0.23, 1.0);
    b.cbox('accent', 0.82, 0.045, 1.66, 0.01, 0.5, Y0 + 0.485, 1.0);
    windows(b, 0.25, 0.75, Y0 + 0.3, 1.806, 3);
    for (let i = 0; i < 4; i++) b.box('glowAmber', 0.012, 0.045, 0.22, 0.895, Y0 + 0.3, 0.45 + i * 0.35);
    roofUnit(b, 0.5, Y0 + 0.5, 0.5);
    roofUnit(b, 0.5, Y0 + 0.5, 1.5, 0.8);
    stack(b, 0.35, Y0 + 0.5, 1.0, 0.035, 0.2);
    // twin gantry portals with hydraulic arms
    for (const z of [0.3, 1.7]) {
      for (const x of [1.45, 2.25]) {
        b.cbox('dark', 0.07, 0.6, 0.07, 0.01, x, Y0 + 0.35, z);
        b.cbox('hazard', 0.075, 0.05, 0.075, 0.006, x, Y0 + 0.12, z);
      }
      b.cbox('accent', 0.86, 0.06, 0.07, 0.01, 1.85, Y0 + 0.66, z);
      b.beam('metal', [1.7, Y0 + 0.64, z], [1.85, Y0 + 0.35, z + (z < 1 ? 0.28 : -0.28)], 0.012, 6);
      b.beam('chrome', [2.0, Y0 + 0.64, z], [1.85, Y0 + 0.35, z + (z < 1 ? 0.28 : -0.28)], 0.012, 6);
      b.cbox('dark', 0.07, 0.07, 0.08, 0.01, 1.85, Y0 + 0.32, z + (z < 1 ? 0.28 : -0.28));
      b.sphere('glowCyan', 0.016, 1.85, Y0 + 0.27, z + (z < 1 ? 0.28 : -0.28), 6, 4);
    }
    b.cbox('accent', 0.07, 0.06, 1.46, 0.01, 1.45, Y0 + 0.66, 1.0);
    b.cbox('accent', 0.07, 0.06, 1.46, 0.01, 2.25, Y0 + 0.66, 1.0);
    // spark lamps
    for (const [x, z] of [[1.45, 1.0], [2.25, 1.0], [1.85, 1.0]]) b.sphere('glowAmber', 0.02, x, Y0 + 0.71, z, 6, 4);
    // wrench / cross emblem on the hall
    b.box('accent', 0.2, 0.05, 0.01, 0.5, Y0 + 0.4, 1.81);
    b.box('accent', 0.05, 0.2, 0.01, 0.5, Y0 + 0.4, 1.81);
    if (st === 'harkonnen') spikes(b, 'dark', [0.14, Y0 + 0.5, 1.78], [0.86, Y0 + 0.5, 1.78], 6, 0.08, 0.02, [0, 1, 0.2]);
  },

  starport(b, st) {
    foundation(b, 3, 3);
    // central landing disc with rings and perimeter lights
    b.cbox('concreteDark', 2.0, 0.05, 2.0, 0.04, 1.65, Y0 + 0.025, 1.5);
    b.cyl('concrete', 0.9, 0.95, 0.04, 36, 1.65, Y0 + 0.07, 1.5);
    b.torus('accent', 0.7, 0.025, 1.65, Y0 + 0.095, 1.5, Math.PI / 2, 0, 0, 40, 4);
    b.torus('hazard', 0.88, 0.014, 1.65, Y0 + 0.095, 1.5, Math.PI / 2, 0, 0, 40, 4);
    b.torus('glowAmber', 0.45, 0.012, 1.65, Y0 + 0.095, 1.5, Math.PI / 2, 0, 0, 32, 4);
    b.box('hazard', 0.6, 0.004, 0.06, 1.65, Y0 + 0.092, 1.5);
    b.box('hazard', 0.06, 0.004, 0.6, 1.65, Y0 + 0.092, 1.5);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.cyl('dark', 0.025, 0.03, 0.03, 6, 1.65 + Math.cos(a) * 0.9, Y0 + 0.1, 1.5 + Math.sin(a) * 0.9);
      b.sphere('glowAmber', 0.022, 1.65 + Math.cos(a) * 0.9, Y0 + 0.13, 1.5 + Math.sin(a) * 0.9, 6, 4);
    }
    // control tower
    b.cbox('hullLight', 0.55, 0.9, 0.55, 0.05, 0.42, Y0 + 0.45, 0.42);
    for (let i = 0; i < 4; i++) {
      b.cbox('accent', 0.58, 0.02, 0.58, 0.004, 0.42, Y0 + 0.1 + i * 0.2, 0.42);
      windows(b, 0.2, 0.64, Y0 + 0.22 + i * 0.2, 0.7, 3, 'glowAmber', 'z', 0.04, 1);
    }
    b.cbox('glass', 0.66, 0.2, 0.66, 0.04, 0.42, Y0 + 1.0, 0.42);
    b.cbox('accent', 0.7, 0.05, 0.7, 0.012, 0.42, Y0 + 1.13, 0.42);
    b.cbox('dark', 0.5, 0.04, 0.5, 0.01, 0.42, Y0 + 1.18, 0.42);
    b.part('beacon', [0.42, Y0 + 1.22, 0.42]);
    b.cyl('metal', 0.02, 0.02, 0.06, 6, 0.42, Y0 + 1.23, 0.42);
    b.cbox('glowRed', 0.09, 0.03, 0.03, 0.006, 0.42, Y0 + 1.28, 0.42);
    b.cbox('glowWhite', 0.03, 0.03, 0.09, 0.006, 0.42, Y0 + 1.28, 0.42);
    b.part('body');
    antenna(b, 0.25, Y0 + 1.2, 0.25, 0.3, 'metal', 'glowRed', 0);
    antenna(b, 0.6, Y0 + 1.2, 0.6, 0.22, 'metal', 'glowGreen', 0);
    // cargo hangars along two edges
    b.cbox('hull', 0.5, 0.32, 2.6, 0.04, 2.7, Y0 + 0.16, 1.5);
    b.cbox('accent', 0.54, 0.035, 2.64, 0.01, 2.7, Y0 + 0.335, 1.5);
    for (let i = 0; i < 4; i++) {
      b.cbox('dark', 0.03, 0.2, 0.45, 0.006, 2.43, Y0 + 0.11, 0.55 + i * 0.64);
      b.box('glowAmber', 0.012, 0.02, 0.4, 2.42, Y0 + 0.24, 0.55 + i * 0.64);
    }
    b.cbox('hull', 2.2, 0.32, 0.5, 0.04, 1.6, Y0 + 0.16, 2.7);
    b.cbox('accent', 2.24, 0.035, 0.54, 0.01, 1.6, Y0 + 0.335, 2.7);
    for (let i = 0; i < 4; i++) {
      b.cbox('dark', 0.45, 0.2, 0.03, 0.006, 0.8 + i * 0.52, Y0 + 0.11, 2.43);
      b.box('glowAmber', 0.4, 0.02, 0.012, 0.8 + i * 0.52, Y0 + 0.24, 2.42);
    }
    // fuel tanks + dish
    tankV(b, 0.45, Y0 + 0.0, 2.4, 0.2, 0.3, 'hullLight', 'accent', false);
    tankV(b, 0.9, Y0 + 0.0, 2.7, 0.2, 0.3, 'hullLight', 'accent', false);
    pipeRun(b, [[0.45, Y0 + 0.2, 2.4], [0.7, Y0 + 0.08, 2.55], [0.9, Y0 + 0.2, 2.7]], 0.022);
    b.cyl('metal', 0.02, 0.03, 0.2, 6, 2.7, Y0 + 0.45, 0.4);
    b.lathe('metal2', [[0.02, 0], [0.08, 0.02], [0.14, 0.07], [0.2, 0.14]], 16, 2.7, Y0 + 0.58, 0.4, 0, 0, -Math.PI / 3);
    b.sphere('glowRed', 0.016, 2.7 + 0.2 * 0.866, Y0 + 0.58 + 0.15 * 0.5, 0.4, 6, 4);
    if (st === 'harkonnen') {
      spikes(b, 'dark', [0.2, Y0 + 0.34, 2.46], [2.4, Y0 + 0.34, 2.46], 11, 0.09, 0.02, [0, 1, 0.2]);
    } else if (st === 'atreides') {
      b.hemi('trim', 0.14, 2.7, Y0 + 0.35, 2.9, 14, 0.8);
    }
  },

  palace(b, st) {
    foundation(b, 3, 3);
    const stone = st === 'harkonnen' ? 'hull' : 'sandstone';
    const trim = st === 'harkonnen' ? 'accent' : 'trim';
    // entrance stairs
    for (let i = 0; i < 4; i++) b.cbox('concrete', 0.9 - i * 0.04, 0.04, 0.16, 0.008, 1.5, Y0 + 0.02 + i * 0.04, 2.9 - i * 0.12);
    // base platform and main hall
    b.cbox(stone, 2.5, 0.3, 2.5, 0.07, 1.5, Y0 + 0.15, 1.5);
    b.cbox(trim, 2.54, 0.03, 2.54, 0.01, 1.5, Y0 + 0.315, 1.5);
    b.cbox(stone, 1.9, 0.34, 1.9, 0.06, 1.5, Y0 + 0.49, 1.5);
    b.cbox('accent', 1.94, 0.04, 1.94, 0.01, 1.5, Y0 + 0.68, 1.5);
    // grand portal
    b.cbox('dark', 0.6, 0.34, 0.06, 0.01, 1.5, Y0 + 0.17, 2.74);
    for (let i = 0; i < 6; i++) b.box('metal', 0.55, 0.014, 0.012, 1.5, Y0 + 0.04 + i * 0.05, 2.775);
    b.box(st === 'harkonnen' ? 'glowRed' : 'glowAmber', 0.5, 0.022, 0.012, 1.5, Y0 + 0.36, 2.775);
    for (const s of [-1, 1]) {
      b.cyl(stone, 0.05, 0.06, 0.3, 10, 1.5 + s * 0.38, Y0 + 0.47, 2.62);
      b.cyl(trim, 0.065, 0.065, 0.025, 10, 1.5 + s * 0.38, Y0 + 0.63, 2.62);
      b.cyl(trim, 0.065, 0.065, 0.025, 10, 1.5 + s * 0.38, Y0 + 0.33, 2.62);
    }
    windows(b, 0.65, 2.35, Y0 + 0.5, 2.456, 6, 'glowAmber', 'z', 0.1);
    for (const s of [-1, 1]) windows(b, 0.65, 2.35, Y0 + 0.5, 1.5 + s * 0.96, 6, 'glowAmber', 'x', 0.1, s);
    // corner towers
    for (const [x, z] of [[0.38, 0.38], [2.62, 0.38], [0.38, 2.62], [2.62, 2.62]]) {
      if (st === 'ordos') {
        b.cyl(stone, 0.2, 0.24, 0.9, 16, x, Y0 + 0.55, z);
        b.sphere('accent', 0.22, x, Y0 + 1.05, z, 18, 12, 1.1);
        b.torus('chrome', 0.21, 0.012, x, Y0 + 1.0, z, Math.PI / 2, 0, 0, 20, 4);
        b.cyl('chrome', 0.006, 0.01, 0.14, 6, x, Y0 + 1.34, z);
      } else if (st === 'harkonnen') {
        b.cbox(stone, 0.4, 1.0, 0.4, 0.04, x, Y0 + 0.6, z);
        b.cone('accent', 0.28, 0.4, 4, x, Y0 + 1.3, z, 0, Math.PI / 4, 0);
        b.cbox('dark', 0.44, 0.04, 0.44, 0.01, x, Y0 + 1.08, z);
        b.sphere('glowRed', 0.025, x, Y0 + 1.15, z + 0.2, 6, 4);
        spikes(b, 'dark', [x - 0.2, Y0 + 1.1, z - 0.2], [x + 0.2, Y0 + 1.1, z - 0.2], 3, 0.1, 0.02, [0, 1, 0]);
      } else {
        b.cyl(stone, 0.17, 0.2, 1.1, 14, x, Y0 + 0.6, z);
        b.cyl(trim, 0.2, 0.2, 0.04, 14, x, Y0 + 1.12, z);
        b.hemi('accent', 0.19, x, Y0 + 1.15, z, 14, 1.1);
        b.cyl('trim', 0.006, 0.008, 0.14, 6, x, Y0 + 1.46, z);
        b.torus(trim, 0.18, 0.01, x, Y0 + 0.5, z, Math.PI / 2, 0, 0, 16, 4);
      }
      b.box('glowAmber', 0.025, 0.1, 0.012, x, Y0 + 0.8, z + (st === 'harkonnen' ? 0.205 : 0.18));
    }
    // central dome / spire
    if (st === 'harkonnen') {
      b.cbox('hull', 1.1, 0.26, 1.1, 0.05, 1.5, Y0 + 0.83, 1.5);
      b.cbox('dark', 0.7, 0.2, 0.7, 0.04, 1.5, Y0 + 1.06, 1.5);
      b.cone('accent', 0.45, 0.55, 4, 1.5, Y0 + 1.45, 1.5, 0, Math.PI / 4, 0);
      b.cyl('metal', 0.01, 0.015, 0.3, 6, 1.5, Y0 + 1.85, 1.5);
      b.sphere('glowRed', 0.045, 1.5, Y0 + 2.0, 1.5, 8, 6);
      spikes(b, 'dark', [1.0, Y0 + 0.7, 1.0], [2.0, Y0 + 0.7, 1.0], 6, 0.12, 0.025, [0, 1, 0]);
      spikes(b, 'dark', [1.0, Y0 + 0.7, 2.0], [2.0, Y0 + 0.7, 2.0], 6, 0.12, 0.025, [0, 1, 0]);
    } else {
      b.cyl(stone, 0.52, 0.58, 0.2, 24, 1.5, Y0 + 0.8, 1.5);
      b.torus(trim, 0.55, 0.02, 1.5, Y0 + 0.82, 1.5, Math.PI / 2, 0, 0, 28, 4);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        b.cyl(trim, 0.012, 0.014, 0.18, 6, 1.5 + Math.cos(a) * 0.5, Y0 + 0.8, 1.5 + Math.sin(a) * 0.5);
        b.box('glowAmber', 0.03, 0.06, 0.012, 1.5 + Math.cos(a + 0.26) * 0.525, Y0 + 0.82, 1.5 + Math.sin(a + 0.26) * 0.525, 0, -a - 0.26 + Math.PI / 2, 0);
      }
      b.hemi('accent', 0.52, 1.5, Y0 + 0.9, 1.5, 28, 1.0);
      b.torus(trim, 0.5, 0.016, 1.5, Y0 + 1.05, 1.5, Math.PI / 2, 0, 0, 28, 4);
      b.torus(trim, 0.36, 0.014, 1.5, Y0 + 1.28, 1.5, Math.PI / 2, 0, 0, 24, 4);
      b.cyl(trim, 0.012, 0.02, 0.4, 8, 1.5, Y0 + 1.62, 1.5);
      b.sphere('glowAmber', 0.05, 1.5, Y0 + 1.88, 1.5, 8, 6);
    }
    // banners flanking the entrance + emblem
    flag(b, 0.95, Y0 + 0.69, 2.55, 0.42, 0.12);
    flag(b, 2.05, Y0 + 0.69, 2.55, 0.42, 0.12);
    emblemFront(b, st, 1.5, Y0 + 0.5, 2.476, 0.3, 1, st === 'harkonnen' ? 'accent' : null);
    if (st === 'atreides') crenellations(b, 'trim', 0.45, 2.55, Y0 + 0.32, 2.65, 14, 0.08, 0.05, 0.04);
  },

  ix(b, st) {
    foundation(b, 2, 2);
    // research lab base
    b.cbox('hull', 1.55, 0.46, 1.55, 0.09, 1.0, Y0 + 0.23, 1.0);
    b.cbox('accent', 1.59, 0.045, 1.59, 0.012, 1.0, Y0 + 0.485, 1.0);
    windows(b, 0.35, 1.65, Y0 + 0.26, 1.78, 5, 'glowCyan');
    b.cbox('dark', 0.28, 0.22, 0.03, 0.006, 1.0, Y0 + 0.12, 1.78);
    for (let i = 0; i < 3; i++) b.box('glowCyan', 0.04, 0.012, 0.012, 0.92 + i * 0.08, Y0 + 0.24, 1.8);
    // four tesla pylons
    for (const [x, z] of [[0.4, 0.4], [1.6, 0.4], [0.4, 1.6], [1.6, 1.6]]) {
      b.cyl('metal', 0.05, 0.08, 0.14, 8, x, Y0 + 0.57, z);
      b.cyl('dark', 0.045, 0.05, 0.5, 8, x, Y0 + 0.9, z);
      for (let i = 0; i < 3; i++) b.torus('trim', 0.06, 0.008, x, Y0 + 0.75 + i * 0.14, z, Math.PI / 2, 0, 0, 12, 4);
      b.sphere('glowCyan', 0.06, x, Y0 + 1.2, z, 10, 8);
      b.beam('chrome', [x, Y0 + 1.15, z], [1.0, Y0 + 1.05, 1.0], 0.0035, 4);
    }
    // central platform and the animated floating orb with rings
    b.cyl('dark', 0.34, 0.4, 0.1, 18, 1.0, Y0 + 0.55, 1.0);
    b.torus('glowCyan', 0.33, 0.012, 1.0, Y0 + 0.61, 1.0, Math.PI / 2, 0, 0, 28, 4);
    b.cyl('chrome', 0.08, 0.12, 0.2, 10, 1.0, Y0 + 0.65, 1.0);
    b.part('orb', [1.0, 1.05, 1.0]);
    b.sphere('glowCyan', 0.2, 1.0, 1.05, 1.0, 20, 14);
    b.sphere('glass', 0.24, 1.0, 1.05, 1.0, 20, 14);
    b.torus('chrome', 0.32, 0.016, 1.0, 1.05, 1.0, Math.PI / 2, 0, 0, 32, 5);
    b.torus('trim', 0.3, 0.014, 1.0, 1.05, 1.0, 0.7, 0.4, 0, 32, 5);
    b.torus('accent', 0.28, 0.012, 1.0, 1.05, 1.0, -0.6, 1.0, 0, 32, 5);
    b.part('body');
    roofUnit(b, 0.35, Y0 + 0.5, 1.0, 0.9);
    roofUnit(b, 1.65, Y0 + 0.5, 1.0, 0.9);
    emblemSide(b, st, 1.0, Y0 + 0.36, 1.78 + 0.01, 0.16, 1, st === 'harkonnen' ? 'dark' : null);
    if (st === 'harkonnen') spikes(b, 'dark', [0.25, Y0 + 0.5, 1.72], [1.75, Y0 + 0.5, 1.72], 7, 0.08, 0.02, [0, 1, 0.2]);
  },
};
