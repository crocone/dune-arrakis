import * as THREE from 'three';
import { Y0, antenna, emblemTop, spikes } from './bkit.js';
import { barrel, lamp } from './kit.js';

// Defensive structures: gun / rocket turrets and wall pieces.

function bunker(b, st) {
  const cx = 0.5, cz = 0.5;
  b.cbox('concrete', 0.94, 0.12, 0.94, 0.03, cx, 0.06, cz);
  for (const [x, z] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
    b.cyl('concreteDark', 0.05, 0.055, 0.08, 6, x, 0.16, z);
    b.cyl(st === 'ordos' ? 'accent' : 'hazard', 0.045, 0.045, 0.012, 6, x, 0.205, z);
  }
  if (st === 'harkonnen') {
    // angular octagonal bunker
    b.hull('hull', Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return [cx + Math.cos(a) * 0.4, 0.12, cz + Math.sin(a) * 0.4]; })
      .concat(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return [cx + Math.cos(a) * 0.31, 0.34, cz + Math.sin(a) * 0.31]; })));
    spikes(b, 'dark', [cx - 0.3, 0.34, cz - 0.3], [cx + 0.3, 0.34, cz - 0.3], 4, 0.07, 0.016, [0, 1, 0]);
    spikes(b, 'dark', [cx - 0.3, 0.34, cz + 0.3], [cx + 0.3, 0.34, cz + 0.3], 4, 0.07, 0.016, [0, 1, 0]);
    b.torus('accent', 0.33, 0.016, cx, 0.35, cz, Math.PI / 2, 0, 0, 8, 4);
  } else if (st === 'ordos') {
    b.cyl('hull', 0.3, 0.4, 0.24, 24, cx, 0.24, cz);
    b.torus('chrome', 0.31, 0.014, cx, 0.36, cz, Math.PI / 2, 0, 0, 28, 4);
    b.torus('glowGreen', 0.36, 0.01, cx, 0.2, cz, Math.PI / 2, 0, 0, 28, 4);
  } else {
    b.cyl('hullLight', 0.31, 0.38, 0.24, 20, cx, 0.24, cz);
    b.torus('trim', 0.32, 0.016, cx, 0.355, cz, Math.PI / 2, 0, 0, 24, 4);
    b.torus('accent', 0.37, 0.014, cx, 0.17, cz, Math.PI / 2, 0, 0, 24, 4);
  }
  // sandbag-ish ring / ammo crates
  b.cbox('dark', 0.1, 0.07, 0.14, 0.01, cx - 0.33, 0.17, cz + 0.2);
  b.cbox('hazard', 0.1, 0.012, 0.14, 0.004, cx - 0.33, 0.21, cz + 0.2);
}

export const DEFENSE_DEFS = {
  gunTurret(b, st) {
    bunker(b, st);
    const ox = 0.5, oy = 0.4, oz = 0.5;
    b.part('turret', [ox, oy, oz]);
    b.cyl('dark', 0.24, 0.26, 0.04, 16, ox, oy + 0.01, oz);
    if (st === 'harkonnen') {
      b.tapered('hull', [[-0.17, 0], [-0.17, 0.08], [-0.1, 0.17], [0.09, 0.17], [0.17, 0.1], [0.17, 0]], 0.34, 0.22, ox, oy + 0.03, oz);
      b.cbox('dark', 0.07, 0.12, 0.2, 0.01, ox + 0.17, oy + 0.1, oz);
      b.box('glowRed', 0.006, 0.014, 0.1, ox + 0.1, oy + 0.17, oz);
    } else if (st === 'ordos') {
      b.sphere('accent', 0.2, ox, oy + 0.06, oz, 18, 12, 0.6, 1.2, 1);
      b.rbox('hullLight', 0.07, 0.1, 0.16, 0.03, ox + 0.2, oy + 0.1, oz);
      b.sphere('glowGreen', 0.02, ox - 0.02, oy + 0.17, oz + 0.1, 8, 6);
    } else {
      b.lathe('hull', [[0, 0], [0.19, 0], [0.2, 0.04], [0.16, 0.1], [0.08, 0.145], [0, 0.155]], 18, ox, oy + 0.035, oz);
      b.rbox('hullLight', 0.07, 0.1, 0.18, 0.02, ox + 0.18, oy + 0.1, oz);
      b.torus('trim', 0.19, 0.008, ox, oy + 0.06, oz, Math.PI / 2, 0, 0, 20, 4);
    }
    emblemTop(b, st, ox - 0.08, oy + (st === 'harkonnen' ? 0.205 : 0.19), oz, 0.1);
    antenna(b, ox - 0.14, oy + 0.15, oz + 0.12, 0.17, 'metal', 'glowRed', 0.0);
    b.part('barrel', [ox + 0.2, oy + 0.1, oz], 'turret');
    barrel(b, ox + 0.2, 0.46, oy + 0.1, oz - 0.05, 0.026, st);
    barrel(b, ox + 0.2, 0.46, oy + 0.1, oz + 0.05, 0.026, st);
  },

  rocketTurret(b, st) {
    bunker(b, st);
    const ox = 0.5, oy = 0.4, oz = 0.5;
    b.part('turret', [ox, oy, oz]);
    b.cyl('dark', 0.24, 0.26, 0.04, 16, ox, oy + 0.01, oz);
    b.cbox(st === 'harkonnen' ? 'dark' : 'hull', 0.34, 0.1, 0.32, 0.03, ox - 0.02, oy + 0.09, oz);
    const a = 0.3;
    const ca = Math.cos(a), sa = Math.sin(a);
    const P = (x, y, z = 0) => [ox + 0.0 + x * ca - y * sa, oy + 0.26 + x * sa + y * ca, oz + z];
    b.add(st === 'harkonnen' ? 'dark' : 'hullLight', new THREE.BoxGeometry(0.36, 0.2, 0.34), ox + 0.0, oy + 0.26, oz, 0, 0, a);
    b.add('accent', new THREE.BoxGeometry(0.2, 0.014, 0.35), ...P(-0.05, 0.105), 0, 0, a);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const z = (i - 0.5) * 0.15, y = (j - 0.5) * 0.09;
        b.beam('dark', P(0.1, y, z), P(0.2, y, z), 0.036, 10);
        b.beam('metal', P(0.19, y, z), P(0.205, y, z), 0.04, 10);
        b.beam('rocket', P(0.17, y, z), P(0.22, y, z), 0.027, 8);
        const nose = P(0.24, y, z);
        b.cone(st === 'harkonnen' ? 'accent' : 'rocket', 0.027, 0.05, 8, nose[0], nose[1], nose[2], 0, 0, a - Math.PI / 2);
      }
    }
    // radar dish for target acquisition
    b.cyl('metal', 0.008, 0.01, 0.1, 6, ox - 0.14, oy + 0.38, oz - 0.12);
    b.lathe('metal2', [[0.01, 0], [0.04, 0.01], [0.07, 0.04]], 12, ox - 0.14, oy + 0.45, oz - 0.12, 0, 0, -Math.PI / 3);
    b.sphere('glowRed', 0.012, ox - 0.14, oy + 0.5, oz - 0.12, 6, 4);
    emblemTop(b, st, ox - 0.13, oy + 0.157, oz + 0.0, 0.09);
    b.part('barrel', [ox + 0.2, oy + 0.3, oz], 'turret');
    b.box('dark', 0.01, 0.01, 0.01, ox + 0.2, oy + 0.3, oz);
  },
};

// ---- walls: a centre post and four connectors toward neighbours -------------
function post(b, st, x, z, sx, sz, h = 0.36) {
  const m = st === 'harkonnen' ? 'concreteDark' : 'concrete';
  b.cbox(m, sx, h, sz, 0.03, x, h / 2, z);
  b.cbox(st === 'atreides' ? 'trim' : 'accent', sx + 0.016, 0.03, sz + 0.016, 0.006, x, h + 0.005, z);
  // vertical panel joints + base plinth
  b.cbox('concreteDark', sx + 0.03, 0.05, sz + 0.03, 0.01, x, 0.025, z);
}

export const WALL_DEFS = {
  wall(b, st) {
    post(b, st, 0.5, 0.5, 0.5, 0.5, 0.42);
    if (st === 'harkonnen') {
      b.cone('dark', 0.04, 0.12, 5, 0.5, 0.49, 0.5);
      for (const [x, z] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) b.cone('dark', 0.02, 0.07, 4, x, 0.46, z);
    } else if (st === 'atreides') {
      b.hemi('trim', 0.1, 0.5, 0.45, 0.5, 12, 0.9);
      b.sphere('trim', 0.018, 0.5, 0.57, 0.5, 6, 4);
    } else {
      b.hemi('accent', 0.17, 0.5, 0.435, 0.5, 14, 0.7);
      b.sphere('glowGreen', 0.02, 0.5, 0.54, 0.5, 6, 4);
    }
    b.bolts('metal', [[0.3, 0.44, 0.3], [0.7, 0.44, 0.3], [0.3, 0.44, 0.7], [0.7, 0.44, 0.7]], 0.014);
  },
  wallE(b, st) { post(b, st, 0.75, 0.5, 0.52, 0.38); b.box('dark', 0.5, 0.014, 0.02, 0.75, 0.2, 0.5 - 0.195); b.box('dark', 0.5, 0.014, 0.02, 0.75, 0.2, 0.5 + 0.195); if (st === 'harkonnen') spikes(b, 'dark', [0.58, 0.37, 0.5], [0.92, 0.37, 0.5], 3, 0.05, 0.012, [0, 1, 0]); },
  wallW(b, st) { post(b, st, 0.25, 0.5, 0.52, 0.38); b.box('dark', 0.5, 0.014, 0.02, 0.25, 0.2, 0.5 - 0.195); b.box('dark', 0.5, 0.014, 0.02, 0.25, 0.2, 0.5 + 0.195); if (st === 'harkonnen') spikes(b, 'dark', [0.08, 0.37, 0.5], [0.42, 0.37, 0.5], 3, 0.05, 0.012, [0, 1, 0]); },
  wallN(b, st) { post(b, st, 0.5, 0.25, 0.38, 0.52); b.box('dark', 0.02, 0.014, 0.5, 0.5 - 0.195, 0.2, 0.25); b.box('dark', 0.02, 0.014, 0.5, 0.5 + 0.195, 0.2, 0.25); if (st === 'harkonnen') spikes(b, 'dark', [0.5, 0.37, 0.08], [0.5, 0.37, 0.42], 3, 0.05, 0.012, [0, 1, 0]); },
  wallS(b, st) { post(b, st, 0.5, 0.75, 0.38, 0.52); b.box('dark', 0.02, 0.014, 0.5, 0.5 - 0.195, 0.2, 0.75); b.box('dark', 0.02, 0.014, 0.5, 0.5 + 0.195, 0.2, 0.75); if (st === 'harkonnen') spikes(b, 'dark', [0.5, 0.37, 0.58], [0.5, 0.37, 0.92], 3, 0.05, 0.012, [0, 1, 0]); },
};
