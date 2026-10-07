import { tracks, antenna, hatch, lamp, stack, spikes, grille, emblemSide, emblemTop, emblemFront } from './kit.js';

// Harvester + MCV: large civil / support vehicles.

function hazardStripes(b, x, y, z, w, h, n, face = 'x') {
  // alternating yellow / dark warning bars
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const mat = i % 2 ? 'dark' : 'hazard';
    if (face === 'x') b.box(mat, 0.006, h, w / n, x, y, z - w / 2 + t * w);
    else b.box(mat, w / n, h, 0.006, x - w / 2 + t * w, y, z);
  }
}

export const HEAVY_DEFS = {
  harvester(b, st) {
    tracks(b, { len: 0.78, h: 0.17, w: 0.15, gap: 0.24, wheels: 6, style: st });
    // low frame between the tracks
    b.cbox('dark', 0.74, 0.08, 0.34, 0.01, 0.0, 0.2, 0);
    // rear hopper (storage bin)
    if (st === 'harkonnen') {
      b.tapered('hullLight', [[-0.38, 0.22], [-0.38, 0.44], [-0.3, 0.47], [0.08, 0.47], [0.15, 0.36], [0.15, 0.22]], 0.5, 0.44, 0, 0, 0);
    } else if (st === 'ordos') {
      b.sphere('hullLight', 0.25, -0.1, 0.34, 0, 22, 12, 0.55, 1.5, 0.95);
      b.cbox('hullLight', 0.5, 0.1, 0.46, 0.04, -0.1, 0.27, 0);
    } else {
      b.tapered('hullLight', [[-0.38, 0.22], [-0.38, 0.42], [-0.33, 0.47], [0.05, 0.47], [0.15, 0.37], [0.15, 0.22]], 0.5, 0.42, 0, 0, 0);
    }
    for (const s of [-1, 1]) {
      // ribs + side panel
      for (let i = 0; i < 6; i++) b.cbox('hull', 0.016, 0.22, 0.02, 0.004, -0.34 + i * 0.075, 0.34, s * 0.235);
      b.cbox('accent', 0.4, 0.07, 0.014, 0.004, -0.12, 0.31, s * 0.24);
      emblemSide(b, st, -0.12, 0.31, s * 0.248, 0.05, s, st === 'harkonnen' ? 'dark' : null);
      // hopper rim
      b.cbox('accent', 0.5, 0.025, 0.03, 0.006, -0.12, 0.475, s * 0.2);
      // hydraulic arms to the intake drum
      b.beam('metal', [0.12, 0.3, s * 0.23], [0.4, 0.14, s * 0.25], 0.012, 6);
      b.beam('chrome', [0.2, 0.26, s * 0.23], [0.34, 0.17, s * 0.25], 0.008, 6);
      b.cbox('hull', 0.2, 0.1, 0.025, 0.006, 0.34, 0.17, s * 0.265);
    }
    b.cbox('accent', 0.025, 0.025, 0.46, 0.006, 0.0, 0.475, 0);
    b.cbox('accent', 0.025, 0.025, 0.46, 0.006, -0.3, 0.475, 0);
    hazardStripes(b, -0.395, 0.34, 0, 0.4, 0.08, 8);
    hazardStripes(b, -0.395, 0.22, 0, 0.4, 0.04, 8);
    // operator cab (front)
    b.tapered('hull', [[0.14, 0.24], [0.14, 0.36], [0.2, 0.4], [0.3, 0.4], [0.34, 0.32], [0.34, 0.24]], 0.32, 0.26);
    b.box('glass', 0.003, 0.07, 0.24, 0.331, 0.34, 0, 0, 0, -0.55);
    for (const s of [-1, 1]) b.box('glass', 0.1, 0.06, 0.003, 0.24, 0.345, s * 0.131, 0, 0, 0);
    b.cbox('accent', 0.2, 0.012, 0.3, 0.004, 0.24, 0.405, 0);
    b.cyl('dark', 0.018, 0.022, 0.02, 8, 0.2, 0.42, 0.08);
    b.sphere('glowAmber', 0.016, 0.2, 0.44, 0.08, 8, 6);
    stack(b, 0.12, 0.38, -0.12, 0.016, 0.1);
    stack(b, 0.12, 0.38, 0.12, 0.016, 0.1);
    antenna(b, 0.22, 0.4, -0.1, 0.14, 'metal', 'glowRed', 0);
    // ladder at the back
    b.beam('metal', [-0.4, 0.2, -0.16], [-0.4, 0.46, -0.16], 0.005, 5);
    b.beam('metal', [-0.4, 0.2, -0.12], [-0.4, 0.46, -0.12], 0.005, 5);
    for (let i = 0; i < 6; i++) b.beam('metal', [-0.4, 0.24 + i * 0.04, -0.16], [-0.4, 0.24 + i * 0.04, -0.12], 0.003, 4);
    // spice mound (scaled by cargo load)
    b.part('cargo', [-0.1, 0.46, 0]);
    b.sphere('spice', 0.21, -0.1, 0.46, 0, 16, 8, 0.5, 1.15, 0.95);
    for (let i = 0; i < 4; i++) b.sphere('spice', 0.07, -0.2 + i * 0.07, 0.505, ((i % 2) - 0.5) * 0.14, 8, 6, 0.7);
    // intake drum
    b.part('drum', [0.42, 0.11, 0]);
    b.cylZ('metal', 0.09, 0.46, 14, 0.42, 0.11, 0);
    b.cylZ('dark', 0.03, 0.5, 8, 0.42, 0.11, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box('dark', 0.02, 0.055, 0.46, 0.42 + Math.cos(a) * 0.095, 0.11 + Math.sin(a) * 0.095, 0, 0, 0, a);
      if (st === 'harkonnen') {
        for (const z of [-0.18, 0, 0.18]) b.cone('dark', 0.012, 0.04, 5, 0.42 + Math.cos(a) * 0.125, 0.11 + Math.sin(a) * 0.125, z, 0, 0, a - Math.PI / 2);
      }
    }
    b.part('body');
    // intake hood
    b.tapered('hull', [[0.3, 0.19], [0.5, 0.19], [0.53, 0.24], [0.3, 0.3]], 0.5, 0.5, 0, 0, 0);
    b.cbox('accent', 0.04, 0.04, 0.5, 0.01, 0.5, 0.22, 0);
    hazardStripes(b, 0.53, 0.23, 0, 0.44, 0.03, 8);
    lamp(b, 0.34, 0.23, 0.2, 'glowAmber', 0.016);
    lamp(b, 0.34, 0.23, -0.2, 'glowAmber', 0.016);
  },

  mcv(b, st) {
    tracks(b, { len: 0.8, h: 0.17, w: 0.15, gap: 0.25, wheels: 6, style: st });
    b.cbox('dark', 0.76, 0.08, 0.36, 0.01, 0, 0.2, 0);
    // chassis deck
    b.cbox('hullLight', 0.78, 0.09, 0.5, 0.012, 0, 0.28, 0);
    for (const s of [-1, 1]) {
      b.cbox('accent', 0.76, 0.012, 0.03, 0.004, 0, 0.33, s * 0.24);
      // outriggers (folded)
      for (const x of [-0.3, 0.1]) {
        b.cbox('dark', 0.05, 0.05, 0.05, 0.008, x, 0.26, s * 0.27);
        b.beam('metal', [x, 0.26, s * 0.27], [x, 0.14, s * 0.3], 0.01, 6);
        b.cyl('dark', 0.025, 0.025, 0.012, 8, x, 0.135, s * 0.3);
      }
    }
    // cab
    b.tapered('hull', [[0.18, 0.325], [0.18, 0.45], [0.26, 0.5], [0.34, 0.5], [0.39, 0.4], [0.39, 0.325]], 0.46, 0.38);
    b.box('glass', 0.003, 0.09, 0.34, 0.386, 0.43, 0, 0, 0, -0.55);
    for (const s of [-1, 1]) b.box('glass', 0.11, 0.07, 0.003, 0.28, 0.42, s * 0.19);
    b.cbox('accent', 0.22, 0.014, 0.4, 0.004, 0.285, 0.5, 0);
    for (const s of [-1, 1]) lamp(b, 0.395, 0.34, s * 0.15, 'glowAmber', 0.016);
    b.cbox('dark', 0.012, 0.06, 0.36, 0.003, 0.4, 0.34, 0);
    if (st === 'harkonnen') spikes(b, 'dark', [0.405, 0.3, -0.2], [0.405, 0.3, 0.2], 5, 0.05, 0.012, [1, 0.1, 0]);
    // folded construction module on the back
    if (st === 'harkonnen') {
      b.tapered('hull', [[-0.38, 0.325], [-0.38, 0.5], [-0.3, 0.56], [0.0, 0.56], [0.12, 0.5], [0.12, 0.325]], 0.46, 0.4);
    } else if (st === 'ordos') {
      b.cbox('hull', 0.5, 0.2, 0.44, 0.06, -0.14, 0.43, 0);
      b.hemi('hullLight', 0.16, -0.1, 0.52, 0, 16, 0.7);
    } else {
      b.cbox('hull', 0.5, 0.2, 0.44, 0.03, -0.14, 0.43, 0);
      b.cbox('hullLight', 0.4, 0.04, 0.34, 0.01, -0.14, 0.545, 0);
    }
    for (const s of [-1, 1]) {
      // fold-out panels (hinged flaps) and windows
      b.cbox('accent', 0.4, 0.14, 0.012, 0.004, -0.14, 0.43, s * 0.232);
      b.cbox('hullLight', 0.3, 0.015, 0.06, 0.004, -0.14, 0.51, s * 0.255, s * 0.35);
      for (let i = 0; i < 5; i++) b.box('glowAmber', 0.04, 0.026, 0.004, -0.27 + i * 0.065, 0.47, s * 0.241);
      emblemSide(b, st, -0.06, 0.4, s * 0.241, 0.06, s, st === 'harkonnen' ? 'dark' : null);
    }
    emblemTop(b, st, -0.15, 0.552, 0, 0.14);
    // roof crane + beacon + mast
    b.cyl('dark', 0.03, 0.035, 0.04, 8, -0.28, 0.58, -0.12);
    b.beam('metal', [-0.28, 0.6, -0.12], [-0.2, 0.7, -0.12], 0.012, 6);
    b.beam('metal', [-0.2, 0.7, -0.12], [-0.05, 0.64, -0.12], 0.01, 6);
    b.box('dark', 0.04, 0.03, 0.04, -0.04, 0.63, -0.12);
    b.beam('chrome', [-0.04, 0.63, -0.12], [-0.04, 0.55, -0.12], 0.003, 4);
    b.cyl('metal', 0.012, 0.012, 0.1, 6, 0.0, 0.62, 0.14);
    b.box('hullLight', 0.04, 0.003, 0.1, 0.0, 0.68, 0.14);
    b.sphere('glowAmber', 0.02, -0.34, 0.58, 0.14, 8, 6);
    antenna(b, 0.3, 0.5, 0.15, 0.16, 'metal', 'glowRed', 0.02);
    hazardStripes(b, -0.395, 0.4, 0, 0.36, 0.06, 8);
    stack(b, 0.2, 0.5, -0.17, 0.015, 0.09);
    // floodlights
    for (const s of [-1, 1]) {
      b.cbox('dark', 0.03, 0.025, 0.03, 0.004, 0.2, 0.52, s * 0.19);
      b.box('glowWhite', 0.004, 0.015, 0.022, 0.217, 0.52, s * 0.19);
    }
    b.cbox('dark', 0.012, 0.1, 0.4, 0.003, -0.4, 0.33, 0);
  },
};
