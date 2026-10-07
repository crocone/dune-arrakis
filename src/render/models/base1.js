import { Y0, foundation, windows, garageDoor, roofUnit, tankV, railing, flag, lattice, pipeRun, crenellations, antenna, stack, emblemFront, emblemSide, emblemTop, spikes } from './bkit.js';

// Core economy structures: construction yard, windtrap, refinery, silo, radar outpost.

export const BASE1_DEFS = {
  constructionYard(b, st) {
    foundation(b, 2, 2);
    const top = Y0 + 0.46;
    const W = st === 'harkonnen' ? 'hull' : 'hullLight';
    b.cbox(W, 1.5, 0.46, 0.92, 0.04, 0.85, Y0 + 0.23, 0.74);
    b.cbox('accent', 1.54, 0.045, 0.96, 0.012, 0.85, top + 0.0225, 0.74);
    b.cbox(W, 1.2, 0.3, 0.6, 0.04, 0.7, Y0 + 0.15, 1.5);
    b.cbox('accent', 1.24, 0.04, 0.64, 0.012, 0.7, Y0 + 0.32, 1.5);
    garageDoor(b, 0.7, Y0, 1.8, 0.6, 0.22);
    windows(b, 0.25, 1.0, Y0 + 0.34, 1.206, 4);
    // generator annex
    b.cbox('concreteDark', 0.46, 0.2, 0.5, 0.02, 1.6, Y0 + 0.1, 1.5);
    roofUnit(b, 1.6, Y0 + 0.2, 1.5, 1.2);
    for (let i = 0; i < 4; i++) b.box('dark', 0.004, 0.14, 0.012, 1.832, Y0 + 0.1, 1.3 + i * 0.07);
    // rooftop equipment
    roofUnit(b, 1.3, top + 0.045, 0.5, 1.2);
    roofUnit(b, 1.0, top + 0.045, 0.45);
    roofUnit(b, 1.3, top + 0.045, 0.95);
    railing(b, 0.14, 1.19, 1.56, 1.19, top + 0.045, 0.07, 8);
    antenna(b, 0.25, top + 0.045, 0.4, 0.4, 'metal', 'glowRed', 0);
    // crane tower + rotating jib (animated part)
    lattice(b, 1.75, 0.5, Y0, 0.92, 0.18, 0.09, 0.011, 4);
    b.part('crane', [1.75, 0.96, 0.5]);
    b.cyl('dark', 0.07, 0.08, 0.05, 10, 1.75, 0.95, 0.5);
    b.cbox('accent', 0.12, 0.07, 0.1, 0.01, 1.78, 1.0, 0.5);
    b.beam('trim', [1.75, 1.0, 0.5], [0.62, 1.0, 0.5], 0.014, 6);
    b.beam('metal', [1.75, 1.0, 0.5], [1.98, 1.0, 0.5], 0.012, 6);
    b.cbox('dark', 0.1, 0.07, 0.09, 0.01, 1.96, 0.985, 0.5);
    b.beam('metal', [1.72, 1.0, 0.5], [1.72, 1.12, 0.5], 0.008, 5);
    b.beam('chrome', [1.72, 1.12, 0.5], [0.85, 1.0, 0.5], 0.004, 4);
    b.beam('chrome', [1.72, 1.12, 0.5], [1.96, 1.0, 0.5], 0.004, 4);
    b.beam('chrome', [0.7, 0.99, 0.5], [0.7, 0.74, 0.5], 0.003, 4);
    b.cbox('hazard', 0.05, 0.04, 0.05, 0.006, 0.7, 0.72, 0.5);
    b.cyl('dark', 0.004, 0.012, 0.03, 5, 0.7, 0.69, 0.5);
    b.part('body');
    // house dressing
    if (st === 'atreides') {
      b.cyl('hullLight', 0.28, 0.3, 0.1, 20, 0.5, top + 0.095, 0.62);
      b.hemi('trim', 0.28, 0.5, top + 0.145, 0.62, 22, 0.9);
      b.torus('accent', 0.29, 0.015, 0.5, top + 0.085, 0.62, Math.PI / 2, 0, 0, 24, 4);
      b.cyl('trim', 0.008, 0.01, 0.12, 6, 0.5, top + 0.4, 0.62);
      for (let i = 0; i < 6; i++) b.box('glass', 0.05, 0.06, 0.01, 0.5 + Math.cos(i * 1.047) * 0.295, top + 0.1, 0.62 + Math.sin(i * 1.047) * 0.295, 0, -i * 1.047, 0);
      emblemFront(b, st, 1.3, Y0 + 0.4, 1.206 + 0.004, 0.17, 1);
      crenellations(b, 'trim', 0.2, 1.5, top + 0.045, 1.17, 9, 0.06, 0.035, 0.03);
    } else if (st === 'harkonnen') {
      spikes(b, 'dark', [0.14, top + 0.045, 1.17], [1.56, top + 0.045, 1.17], 10, 0.1, 0.022, [0, 1, 0.25]);
      for (const x of [0.4, 0.75]) {
        stack(b, x, top + 0.045, 0.45, 0.04, 0.3);
        b.torus('glowRed', 0.04, 0.007, x, top + 0.2, 0.45, Math.PI / 2, 0, 0, 12, 4);
      }
      for (let i = 0; i < 7; i++) b.cbox('dark', 0.03, 0.14, 0.03, 0.004, 0.2 + i * 0.2, Y0 + 0.38, 1.22);
      emblemFront(b, st, 1.3, Y0 + 0.4, 1.206 + 0.004, 0.17, 1, 'dark');
    } else {
      for (const [x, z, r] of [[0.45, 0.55, 0.26], [1.0, 0.55, 0.18]]) {
        b.hemi('accent', r, x, top + 0.045, z, 22, 0.85);
        b.torus('chrome', r * 1.01, 0.012, x, top + 0.05, z, Math.PI / 2, 0, 0, 24, 4);
        b.sphere('glowGreen', 0.03, x, top + 0.045 + r * 0.85, z, 8, 6);
      }
      emblemFront(b, st, 1.3, Y0 + 0.4, 1.206 + 0.004, 0.17, 1);
    }
  },

  windtrap(b, st) {
    foundation(b, 2, 2);
    // low power base with condenser tanks
    b.cbox('hull', 1.7, 0.26, 1.7, 0.05, 1.0, Y0 + 0.13, 1.0);
    b.cbox('accent', 1.74, 0.04, 1.74, 0.01, 1.0, Y0 + 0.28, 1.0);
    for (const [x, z] of [[0.42, 0.44], [0.42, 1.56]]) {
      tankV(b, x, Y0 + 0.3, z, 0.17, 0.2, 'hullLight', 'accent', true);
    }
    // stepped wind catcher tower
    const tiers = [[0.95, 0.32, 0.62], [0.75, 0.62, 0.92], [0.55, 0.92, 1.2]];
    for (const [sz, y0, y1] of tiers) {
      if (st === 'ordos') {
        b.cyl('hull', sz / 2, sz / 2 + 0.03, y1 - y0, 20, 1.0, (y0 + y1) / 2, 1.0);
        b.torus('chrome', sz / 2 + 0.01, 0.015, 1.0, y1 - 0.02, 1.0, Math.PI / 2, 0, 0, 24, 4);
      } else {
        b.cbox('hull', sz, y1 - y0, sz, 0.03, 1.0, (y0 + y1) / 2, 1.0);
        b.box(st === 'atreides' ? 'trim' : 'accent', sz + 0.03, 0.025, sz + 0.03, 1.0, y1, 1.0);
      }
      // vertical wind slits on each face
      const n = Math.round(sz * 8);
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n - 0.5) * (sz - 0.12);
        const hh = (y1 - y0) * 0.72;
        const ym = (y0 + y1) / 2;
        if (st === 'ordos') {
          const a = (i / n) * Math.PI * 2;
          b.box('dark', 0.03, hh, 0.016, 1.0 + Math.cos(a) * (sz / 2 + 0.01), ym, 1.0 + Math.sin(a) * (sz / 2 + 0.01), 0, -a + Math.PI / 2, 0);
        } else {
          b.box('dark', 0.035, hh, 0.014, 1.0 + t, ym, 1.0 + sz / 2 + 0.005);
          b.box('dark', 0.035, hh, 0.014, 1.0 + t, ym, 1.0 - sz / 2 - 0.005);
          b.box('dark', 0.014, hh, 0.035, 1.0 + sz / 2 + 0.005, ym, 1.0 + t);
          b.box('dark', 0.014, hh, 0.035, 1.0 - sz / 2 - 0.005, ym, 1.0 + t);
        }
      }
    }
    // fan shroud + animated rotor
    b.cyl('dark', 0.26, 0.28, 0.08, 20, 1.0, 1.23, 1.0);
    b.torus('metal', 0.255, 0.018, 1.0, 1.27, 1.0, Math.PI / 2, 0, 0, 24, 5);
    b.torus('glowCyan', 0.2, 0.006, 1.0, 1.255, 1.0, Math.PI / 2, 0, 0, 24, 4);
    b.part('rotor', [1.0, 1.28, 1.0]);
    b.cyl('chrome', 0.04, 0.05, 0.05, 10, 1.0, 1.28, 1.0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const pts = [];
      for (const r of [0.05, 0.27]) for (const t of [-0.045, 0.045]) for (const th of [0, 0.008]) {
        pts.push([1.0 + c * r - sn * t, 1.29 + t * 0.55 + th, 1.0 + sn * r + c * t]);
      }
      b.hull('hullLight', pts);
    }
    b.part('body');
    // pipes & conduits
    pipeRun(b, [[0.58, Y0 + 0.4, 0.44], [0.7, Y0 + 0.5, 0.6], [0.85, Y0 + 0.5, 0.75]], 0.02);
    pipeRun(b, [[0.58, Y0 + 0.4, 1.56], [0.7, Y0 + 0.5, 1.4], [0.85, Y0 + 0.5, 1.25]], 0.02);
    for (const [x, z] of [[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]]) {
      b.cyl('trim', 0.03, 0.04, 0.05, 8, x + (x > 1 ? 0.1 : -0.0), Y0 + 0.32, z);
    }
    for (const s of [-1, 1]) {
      b.box('glowCyan', 0.012, 0.5, 0.012, 1.0 + s * 0.47 * 0.99, 0.62, 1.0 + 0.47);
      b.box('glowCyan', 0.012, 0.5, 0.012, 1.0 + 0.47, 0.62, 1.0 + s * 0.47);
    }
    windows(b, 0.3, 1.7, Y0 + 0.14, 1.855, 6, 'glowCyan');
    emblemFront(b, st, 1.0, Y0 + 0.2, 1.85, 0.12, 1, st === 'harkonnen' ? 'accent' : null);
    if (st === 'harkonnen') spikes(b, 'dark', [0.2, Y0 + 0.3, 0.2], [1.8, Y0 + 0.3, 0.2], 8, 0.09, 0.02, [0, 1, -0.2]);
    if (st === 'atreides') crenellations(b, 'trim', 0.25, 1.75, Y0 + 0.3, 1.85, 8, 0.07, 0.04, 0.04);
  },

  refinery(b, st) {
    foundation(b, 3, 2);
    // processing hall
    b.cbox('hullLight', 1.65, 0.42, 1.25, 0.05, 0.98, Y0 + 0.21, 0.95);
    b.cbox('accent', 1.69, 0.05, 1.29, 0.012, 0.98, Y0 + 0.445, 0.95);
    windows(b, 0.3, 1.65, Y0 + 0.26, 1.576, 6);
    garageDoor(b, 1.2, Y0, 1.575, 0.3, 0.2);
    // roof tanks with chimneys
    for (let i = 0; i < 3; i++) {
      const x = 0.42 + i * 0.4;
      tankV(b, x, Y0 + 0.47, 0.45, 0.17, 0.36, 'hull', 'accent', i === 0);
      if (st === 'ordos') b.torus('chrome', 0.178, 0.01, x, Y0 + 0.75, 0.45, Math.PI / 2, 0, 0, 20, 4);
    }
    if (st === 'harkonnen') {
      for (const x of [1.5, 1.65]) {
        stack(b, x, Y0 + 0.47, 0.5, 0.05, 0.55);
        b.torus('glowRed', 0.05, 0.007, x, Y0 + 0.9, 0.5, Math.PI / 2, 0, 0, 12, 4);
      }
    } else {
      stack(b, 1.55, Y0 + 0.47, 0.5, 0.05, 0.4);
    }
    roofUnit(b, 1.3, Y0 + 0.47, 1.15);
    roofUnit(b, 0.9, Y0 + 0.47, 1.2);
    pipeRun(b, [[0.42, Y0 + 0.5, 0.65], [0.42, Y0 + 0.58, 1.0], [1.4, Y0 + 0.58, 1.0], [1.4, Y0 + 0.5, 0.65]], 0.022);
    // spice intake funnel feeding the hall from the docking side
    b.hull('hull', [[1.8, Y0 + 0.5, 0.55], [1.8, Y0 + 0.5, 1.25], [1.95, Y0 + 0.5, 1.15], [1.95, Y0 + 0.5, 0.65], [1.72, Y0 + 0.18, 0.78], [1.72, Y0 + 0.18, 1.02], [1.8, Y0 + 0.18, 1.02], [1.8, Y0 + 0.18, 0.78]]);
    b.box('spice', 0.02, 0.01, 0.4, 1.9, Y0 + 0.52, 0.9);
    b.cbox('hazard', 0.05, 0.03, 0.7, 0.006, 1.97, Y0 + 0.5, 0.9);
    // docking pad with guide lines and gantry
    b.cbox('concreteDark', 1.0, 0.04, 1.7, 0.02, 2.4, Y0 + 0.02, 1.0);
    for (const x of [1.95, 2.85]) {
      for (let i = 0; i < 10; i++) b.box(i % 2 ? 'dark' : 'hazard', 0.04, 0.005, 0.17, x, Y0 + 0.045, 0.2 + i * 0.176);
    }
    for (let i = 0; i < 4; i++) b.box('glowAmber', 0.04, 0.012, 0.04, 2.4, Y0 + 0.05, 0.4 + i * 0.4);
    for (const z of [0.25, 1.75]) {
      b.cbox('dark', 0.05, 0.5, 0.05, 0.006, 2.1, Y0 + 0.25, z);
      b.cbox('dark', 0.05, 0.5, 0.05, 0.006, 2.7, Y0 + 0.25, z);
      b.cbox('accent', 0.65, 0.04, 0.05, 0.006, 2.4, Y0 + 0.5, z);
    }
    b.cbox('accent', 0.05, 0.04, 1.55, 0.006, 2.4, Y0 + 0.5, 1.0);
    b.cbox('dark', 0.16, 0.12, 0.2, 0.01, 2.4, Y0 + 0.42, 1.0);
    b.box('glowAmber', 0.02, 0.02, 0.15, 2.4, Y0 + 0.36, 1.0);
    // control booth on the pad corner
    b.cbox('hull', 0.3, 0.26, 0.3, 0.03, 2.75, Y0 + 0.17, 0.35);
    b.box('glass', 0.28, 0.08, 0.004, 2.75, Y0 + 0.22, 0.5);
    b.cbox('accent', 0.32, 0.03, 0.32, 0.01, 2.75, Y0 + 0.32, 0.35);
    emblemFront(b, st, 0.98, Y0 + 0.34, 1.576 + 0.004, 0.12, 1, st === 'harkonnen' ? 'dark' : null);
    if (st === 'atreides') crenellations(b, 'trim', 0.25, 1.75, Y0 + 0.47, 1.57, 9, 0.07, 0.04, 0.04);
    if (st === 'harkonnen') spikes(b, 'dark', [0.2, Y0 + 0.47, 1.55], [1.75, Y0 + 0.47, 1.55], 9, 0.1, 0.02, [0, 1, 0.2]);
  },

  silo(b, st) {
    foundation(b, 2, 2);
    const pos = [[0.52, 0.52], [1.48, 0.52], [0.52, 1.48], [1.48, 1.48]];
    // pump house between the tanks
    b.cbox('hullLight', 0.5, 0.26, 0.5, 0.04, 1.0, Y0 + 0.13, 1.0);
    b.cbox('accent', 0.54, 0.03, 0.54, 0.008, 1.0, Y0 + 0.275, 1.0);
    b.box('glowAmber', 0.02, 0.04, 0.14, 1.0, Y0 + 0.14, 1.26);
    stack(b, 1.0, Y0 + 0.29, 1.0, 0.03, 0.2);
    for (const [x, z] of pos) {
      if (st === 'ordos') {
        // spherical tank on a ring stand
        b.cyl('dark', 0.28, 0.32, 0.08, 14, x, Y0 + 0.04, z);
        b.sphere('hull', 0.3, x, Y0 + 0.34, z, 22, 14);
        b.torus('chrome', 0.3, 0.014, x, Y0 + 0.34, z, Math.PI / 2, 0, 0, 24, 4);
        b.torus('accent', 0.28, 0.012, x, Y0 + 0.52, z, Math.PI / 2, 0, 0, 24, 4);
        b.sphere('glowAmber', 0.03, x, Y0 + 0.64, z, 8, 6);
      } else if (st === 'harkonnen') {
        b.cyl('hull', 0.31, 0.33, 0.52, 16, x, Y0 + 0.26, z);
        b.cone('dark', 0.33, 0.22, 16, x, Y0 + 0.63, z);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          b.box('dark', 0.02, 0.5, 0.04, x + Math.cos(a) * 0.325, Y0 + 0.26, z + Math.sin(a) * 0.325, 0, -a, 0);
        }
        b.sphere('glowRed', 0.025, x, Y0 + 0.76, z, 6, 4);
        b.torus('accent', 0.325, 0.018, x, Y0 + 0.25, z, Math.PI / 2, 0, 0, 20, 4);
      } else {
        b.cyl('hullLight', 0.3, 0.33, 0.5, 20, x, Y0 + 0.25, z);
        b.hemi('trim', 0.3, x, Y0 + 0.5, z, 20, 0.5);
        b.torus('trim', 0.32, 0.016, x, Y0 + 0.4, z, Math.PI / 2, 0, 0, 24, 4);
        b.torus('accent', 0.335, 0.02, x, Y0 + 0.14, z, Math.PI / 2, 0, 0, 24, 4);
        b.sphere('trim', 0.022, x, Y0 + 0.66, z, 8, 6);
      }
      // fill-level gauge glow, ladder
      const dx = x < 1 ? 0.32 : -0.32;
      b.box('dark', 0.014, 0.4, 0.05, x + dx * 1.0, Y0 + 0.28, z + (z < 1 ? 0.0 : 0.0));
      b.box('glowAmber', 0.016, 0.26, 0.026, x + dx * 1.01, Y0 + 0.24, z);
      b.beam('metal', [x + 0.1, Y0 + 0.02, z + (z < 1 ? 0.3 : -0.3)], [x + 0.1, Y0 + 0.6, z + (z < 1 ? 0.3 : -0.3)], 0.005, 5);
    }
    // overhead catwalk joining the tanks
    for (const [a, c] of [[0, 1], [2, 3], [0, 2], [1, 3]]) {
      b.beam('metal', [pos[a][0], Y0 + 0.54, pos[a][1]], [pos[c][0], Y0 + 0.54, pos[c][1]], 0.012, 6);
    }
    pipeRun(b, [[0.52, Y0 + 0.1, 0.8], [0.8, Y0 + 0.1, 1.0]], 0.02);
    pipeRun(b, [[1.48, Y0 + 0.1, 0.8], [1.2, Y0 + 0.1, 1.0]], 0.02);
    emblemFront(b, st, 1.0, Y0 + 0.17, 1.256, 0.1, 1, st === 'harkonnen' ? 'dark' : null);
  },

  radar(b, st) {
    foundation(b, 2, 2);
    b.cbox('hullLight', 1.3, 0.36, 1.0, 0.05, 0.85, Y0 + 0.18, 1.25);
    b.cbox('accent', 1.34, 0.045, 1.04, 0.012, 0.85, Y0 + 0.385, 1.25);
    windows(b, 0.3, 1.4, Y0 + 0.26, 1.756, 5, 'glowCyan');
    b.cbox('dark', 0.26, 0.2, 0.03, 0.006, 0.85, Y0 + 0.1, 1.755);
    for (let i = 0; i < 3; i++) b.box('hazard', 0.05, 0.02, 0.012, 0.76 + i * 0.09, Y0 + 0.21, 1.775);
    roofUnit(b, 0.35, Y0 + 0.41, 1.2);
    roofUnit(b, 0.55, Y0 + 0.41, 1.5, 0.8);
    // lattice tower holding the rotating dish
    lattice(b, 1.35, 0.62, Y0, 0.98, 0.26, 0.1, 0.012, 5);
    b.cyl('dark', 0.09, 0.1, 0.05, 10, 1.35, 1.0, 0.62);
    b.cbox('hull', 0.2, 0.1, 0.18, 0.02, 1.0, 0.7, 1.0); // equipment room at tower base
    b.part('dish', [1.35, 1.06, 0.62]);
    b.cyl('chrome', 0.03, 0.04, 0.1, 8, 1.35, 1.04, 0.62);
    b.lathe('metal2', [[0.03, 0], [0.12, 0.03], [0.22, 0.09], [0.3, 0.17], [0.36, 0.26]], 26, 1.35, 1.1, 0.62, 0, 0, -Math.PI / 3);
    b.ring('trim', 0.36, 0.012, [1.35 + 0.26 * 0.866, 1.1 + 0.26 * 0.5, 0.62], [0.866, 0.5, 0], 24, 4);
    b.beam('metal', [1.35, 1.1, 0.62], [1.35 + 0.34 * 0.866, 1.1 + 0.34 * 0.5, 0.62], 0.006, 5);
    b.sphere('glowRed', 0.026, 1.35 + 0.36 * 0.866, 1.1 + 0.36 * 0.5, 0.62, 8, 6);
    for (const s of [-1, 1]) {
      b.beam('metal', [1.35 - 0.05, 1.06, 0.62 + s * 0.14], [1.35 + 0.2, 1.3, 0.62 + s * 0.25], 0.005, 4);
    }
    b.part('body');
    // comms masts
    antenna(b, 0.2, Y0 + 0.4, 0.8, 0.5, 'metal', 'glowRed', 0);
    antenna(b, 0.3, Y0 + 0.4, 0.8, 0.35, 'metal', 'glowGreen', 0);
    if (st === 'harkonnen') spikes(b, 'dark', [0.2, Y0 + 0.41, 1.72], [1.5, Y0 + 0.41, 1.72], 8, 0.09, 0.02, [0, 1, 0.2]);
    if (st === 'atreides') crenellations(b, 'trim', 0.25, 1.45, Y0 + 0.41, 1.74, 8, 0.07, 0.04, 0.04);
  },
};
