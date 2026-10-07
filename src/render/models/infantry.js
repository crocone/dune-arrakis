import * as THREE from 'three';
import { emblemSide, emblemFront } from './kit.js';

// Infantry (about 0.2 tall, facing +X) and the sandworm head.

function legs(b, mat, bootMat = 'dark', stride = 0.008) {
  for (const s of [-1, 1]) {
    const dx = s * stride;
    b.cbox(mat, 0.036, 0.058, 0.032, 0.008, dx, 0.052, s * 0.022);
    b.cbox('dark', 0.026, 0.012, 0.034, 0.003, dx, 0.03, s * 0.022); // knee guard strip
    b.cbox(bootMat, 0.054, 0.026, 0.036, 0.008, dx + 0.006, 0.013, s * 0.022);
  }
  b.cbox('dark', 0.052, 0.012, 0.09, 0.004, 0, 0.085, 0); // belt
  b.box('brass', 0.012, 0.012, 0.012, 0.027, 0.085, 0);
}

function arms(b, mat, to, z = 0.052, y = 0.125) {
  for (const s of [-1, 1]) {
    b.beam(mat, [0, y, s * z], [to[0], to[1], s * to[2]], 0.011, 6);
    b.sphere('skin', 0.0095, to[0], to[1], s * to[2], 6, 4);
  }
}

function rifle(b, x = 0.06, y = 0.115, z = 0) {
  b.cbox('dark', 0.1, 0.02, 0.018, 0.004, x, y, z);
  b.cbox('dark', 0.04, 0.03, 0.02, 0.004, x - 0.045, y - 0.004, z);
  b.cylX('metal', 0.0045, 0.06, 5, x + 0.075, y + 0.002, z);
  b.cbox('dark', 0.03, 0.02, 0.012, 0.003, x - 0.005, y - 0.022, z);
}

function helmet(b, st, x, y, z = 0) {
  if (st === 'harkonnen') {
    // elongated "ant head" helm with lens eyes and mandible respirator
    b.sphere('dark', 0.032, x, y + 0.005, z, 10, 8, 0.95, 1.3, 1.0);
    for (const s of [-1, 1]) b.sphere('glowRed', 0.011, x + 0.028, y + 0.007, s * 0.016, 6, 4);
    b.cbox('metal', 0.016, 0.018, 0.024, 0.004, x + 0.035, y - 0.012, 0);
    for (const s of [-1, 1]) b.cone('dark', 0.004, 0.02, 4, x + 0.045, y - 0.018, s * 0.009, 0, 0, -Math.PI / 2 + s * 0.25);
  } else if (st === 'ordos') {
    b.sphere('hull', 0.032, x, y + 0.004, z, 10, 8, 0.95, 1.2, 0.92);
    b.box('glowGreen', 0.008, 0.012, 0.042, x + 0.027, y + 0.005, z);
    b.cbox('chrome', 0.04, 0.008, 0.012, 0.003, x - 0.004, y + 0.03, z);
  } else {
    b.sphere('skin', 0.022, x + 0.006, y - 0.004, z, 8, 6);
    b.hemi('hull', 0.031, x, y + 0.003, z, 10);
    b.torus('trim', 0.031, 0.004, x, y + 0.004, 0, Math.PI / 2, 0, 0, 10, 4);
    b.box('trim', 0.05, 0.005, 0.006, x, y + 0.033, z);
  }
}

export const INFANTRY_DEFS = {
  soldier(b, st) {
    legs(b, st === 'harkonnen' ? 'dark' : 'cloth');
    b.cbox(st === 'harkonnen' ? 'dark' : 'accent', 0.058, 0.07, 0.092, 0.014, 0, 0.123, 0);
    b.cbox('hull', 0.03, 0.05, 0.07, 0.008, 0.013, 0.125, 0); // chest rig
    for (const s of [-1, 1]) {
      b.cbox(st === 'harkonnen' ? 'accent' : 'trim', 0.034, 0.016, 0.034, 0.006, 0, 0.158, s * 0.052); // shoulder pads
      if (st === 'harkonnen') b.cone('dark', 0.006, 0.022, 5, 0, 0.175, s * 0.054);
    }
    b.cbox('dark', 0.03, 0.06, 0.06, 0.008, -0.04, 0.125, 0); // backpack
    b.cyl('metal', 0.008, 0.008, 0.06, 6, -0.058, 0.13, 0.025, 0, 0, 0);
    helmet(b, st, 0.003, 0.18);
    rifle(b, 0.065, 0.118, -0.005);
    arms(b, st === 'harkonnen' ? 'dark' : 'accent', [0.09, 0.12, 0.0], 0.052, 0.14);
    b.sphere('skin', 0.0095, 0.025, 0.12, 0.012, 6, 4);
  },

  trooper(b, st) {
    legs(b, 'dark', 'dark', 0.01);
    b.cbox('hull', 0.066, 0.078, 0.1, 0.016, 0, 0.126, 0);
    b.cbox('accent', 0.036, 0.05, 0.1, 0.01, 0.014, 0.13, 0);
    for (const s of [-1, 1]) {
      b.cbox('accent', 0.044, 0.024, 0.044, 0.01, 0, 0.162, s * 0.058);
      if (st === 'harkonnen') b.cone('dark', 0.008, 0.03, 5, 0, 0.185, s * 0.06);
      if (st === 'atreides') b.box('trim', 0.044, 0.005, 0.046, 0, 0.176, s * 0.058);
    }
    b.cbox('dark', 0.042, 0.075, 0.075, 0.01, -0.048, 0.13, 0);
    b.cyl('metal', 0.012, 0.012, 0.07, 8, -0.055, 0.135, 0.035);
    helmet(b, st, 0.004, 0.188);
    // shoulder-mounted rocket launcher
    b.cylX('dark', 0.0235, 0.17, 10, 0.03, 0.172, -0.058);
    b.cylX('metal', 0.028, 0.025, 10, 0.1, 0.172, -0.058);
    b.cylX('accent', 0.026, 0.012, 10, -0.05, 0.172, -0.058);
    b.cone('rocket', 0.02, 0.035, 8, 0.12, 0.172, -0.058, 0, 0, -Math.PI / 2);
    b.cbox('dark', 0.03, 0.03, 0.022, 0.006, 0.03, 0.15, -0.048);
    arms(b, 'cloth', [0.035, 0.145, 0], 0.058, 0.15);
  },

  saboteur(b, st) {
    // dark skin-tight suit, hooded, crouched forward
    for (const s of [-1, 1]) {
      b.cbox('dark', 0.036, 0.055, 0.03, 0.008, 0.01, 0.05, s * 0.022, 0, 0, -0.1);
      b.cbox('dark', 0.052, 0.024, 0.034, 0.008, 0.02, 0.013, s * 0.022);
    }
    b.cbox('dark', 0.056, 0.07, 0.085, 0.014, 0.012, 0.115, 0, 0, 0, -0.22);
    b.cbox('accent', 0.058, 0.007, 0.087, 0.002, 0.012, 0.115, 0, 0, 0, -0.22);
    b.cbox('dark', 0.036, 0.062, 0.07, 0.012, -0.03, 0.12, 0);
    b.box('glowGreen', 0.006, 0.05, 0.008, -0.02, 0.12, 0.034);
    b.sphere('dark', 0.03, 0.03, 0.165, 0, 10, 8, 1.0, 1.1, 0.95);
    b.hemi('dark', 0.034, 0.024, 0.165, 0, 10);
    b.box('accentGlow', 0.006, 0.01, 0.04, 0.055, 0.168, 0);
    // satchel charge with a glowing fuse
    b.cbox('hull', 0.05, 0.05, 0.034, 0.008, -0.07, 0.1, 0.02);
    b.sphere('glowRed', 0.008, -0.07, 0.132, 0.02, 6, 4);
    b.beam('dark', [0.0, 0.14, 0.04], [0.06, 0.1, 0.03], 0.01, 5);
    b.beam('dark', [0.0, 0.14, -0.04], [0.06, 0.1, -0.03], 0.01, 5);
    b.cbox('dark', 0.03, 0.012, 0.012, 0.003, 0.07, 0.105, 0);
  },

  fremen(b, st) {
    // robe + stillsuit, hooded, mask with piping and a crysknife
    b.cone('cloth', 0.058, 0.13, 10, -0.008, 0.07, 0);
    for (const s of [-1, 1]) b.cbox('clothDark', 0.036, 0.04, 0.032, 0.008, 0.012, 0.03, s * 0.02);
    b.cbox('cloth', 0.058, 0.08, 0.09, 0.016, 0, 0.125, 0);
    b.cbox('clothDark', 0.03, 0.06, 0.07, 0.01, 0.012, 0.125, 0);
    b.cbox('leather', 0.056, 0.012, 0.094, 0.004, 0, 0.09, 0);
    // shoulder mantle and the hood draping down the back
    b.cyl('cloth', 0.036, 0.064, 0.04, 12, 0.0, 0.14, 0);
    b.sphere('cloth', 0.04, -0.028, 0.155, 0, 8, 6, 1.1, 0.8, 1.15);
    b.cone('clothDark', 0.04, 0.09, 8, -0.05, 0.09, 0, 0, 0, 0.35);
    // hood + mask
    b.hemi('cloth', 0.037, 0.0, 0.17, 0, 10);
    b.sphere('skin', 0.025, 0.007, 0.168, 0, 8, 6);
    b.cbox('dark', 0.014, 0.022, 0.042, 0.005, 0.026, 0.158, 0);
    b.box('glowCyan', 0.008, 0.008, 0.035, 0.028, 0.176, 0);
    b.box('clothDark', 0.012, 0.012, 0.048, 0.025, 0.188, 0);
    // stillsuit pipes
    b.pipe('chrome', [[0.027, 0.15, 0.008], [0.032, 0.135, 0.02], [0.03, 0.115, 0.03]], 0.0035);
    b.pipe('chrome', [[0.027, 0.15, -0.008], [0.032, 0.135, -0.02], [0.03, 0.11, -0.03]], 0.0035);
    b.sphere('brass', 0.007, 0.03, 0.112, 0.03, 6, 4);
    // arms + weapon (crysknife held forward) + maula pistol on the belt
    arms(b, 'cloth', [0.05, 0.12, 0.0], 0.054, 0.145);
    b.cbox('dark', 0.016, 0.014, 0.014, 0.004, 0.055, 0.12, 0);
    b.add('teeth', new THREE.ConeGeometry(0.0085, 0.085, 4), 0.1, 0.13, 0, 0, 0, -Math.PI / 2 + 0.25, 1, 1, 0.5);
    b.cbox('leather', 0.02, 0.026, 0.014, 0.004, 0.0, 0.088, -0.05);
  },
};

// ---------------------------------------------------------------------------
// Sandworm head: layered maw with radial lip petals and rings of teeth.
// Faces +X (mouth), body trails along -X. Segments are built by the renderer.
// ---------------------------------------------------------------------------
INFANTRY_DEFS.sandworm = function (b) {
  // throat / head shell (revolve about X)
  b.lathe('worm', [[0.27, -0.42], [0.31, -0.28], [0.335, -0.1], [0.34, 0.04], [0.32, 0.12]], 28, 0, 0, 0, 0, 0, -Math.PI / 2);
  // armoured ridge rings
  for (const x of [-0.34, -0.22, -0.1, 0.0]) b.torus('worm', 0.3 + (x + 0.34) * 0.045, 0.028, x, 0, 0, 0, Math.PI / 2, 0, 24, 6);
  b.part('mouth', [0.2, 0, 0]);
  // lip petals: slices of a flared bell, splayed like a flower
  const petals = 5;
  const bell = [[0.31, 0.1], [0.35, 0.16], [0.43, 0.24], [0.52, 0.3], [0.6, 0.33]].map(([r, y]) => new THREE.Vector2(r, y));
  for (let i = 0; i < petals; i++) {
    const g = new THREE.LatheGeometry(bell, 8, (i / petals) * Math.PI * 2 + 0.12, (Math.PI * 2) / petals - 0.24);
    g.rotateZ(-Math.PI / 2);
    b.add('worm', g);
    // teeth along both inner edges of each petal
    for (const e of [0.0, 1.0]) {
      const a = (i / petals) * Math.PI * 2 + 0.12 + e * ((Math.PI * 2) / petals - 0.24);
      for (let t = 0; t < 5; t++) {
        const r = 0.33 + t * 0.055;
        const x = 0.16 + t * 0.045;
        b.cone('teeth', 0.013 - t * 0.001, 0.075 - t * 0.006, 5, x, Math.cos(a) * (r - 0.035), Math.sin(a) * (r - 0.035), 0, 0, -Math.PI / 2 + 0.5 * (e ? 1 : -1));
      }
    }
  }
  // deep glowing throat and spiral teeth rings
  b.lathe('wormInner', [[0.3, 0.16], [0.22, 0.04], [0.13, -0.1], [0.05, -0.26], [0.0, -0.34]], 20, 0, 0, 0, 0, 0, -Math.PI / 2);
  for (const [r, n, px] of [[0.27, 22, 0.13], [0.2, 16, 0.07], [0.13, 10, -0.02]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.cone('teeth', 0.014, 0.085, 5, px + 0.03, Math.cos(a) * r, Math.sin(a) * r, 0, 0, -Math.PI / 2 + Math.cos(a) * 0.18);
    }
  }
};
