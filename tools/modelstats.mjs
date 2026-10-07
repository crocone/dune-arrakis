// Triangle / draw-call budget per model: node tools/modelstats.mjs
import { createModel } from '../src/render/models.js';

const units = ['trike', 'raider', 'quad', 'tank', 'siegeTank', 'launcher', 'sonicTank', 'deviator', 'devastator', 'harvester', 'mcv', 'carryall', 'ornithopter', 'frigate', 'soldier', 'trooper', 'saboteur', 'fremen', 'sandworm'];
const structs = ['constructionYard', 'windtrap', 'refinery', 'silo', 'radar', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'repairYard', 'starport', 'palace', 'ix', 'gunTurret', 'rocketTurret', 'wall', 'wallE', 'wallW', 'wallN', 'wallS'];

function stats(kind, name, house) {
  const { root } = createModel(kind, name, house);
  let tris = 0, calls = 0;
  root.traverse((o) => {
    if (o.isMesh) {
      calls++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return { tris, calls };
}

for (const house of [0, 1, 2]) {
  console.log('--- house', house);
  let tu = 0, ts = 0;
  for (const [kind, list] of [['unit', units], ['structure', structs]]) {
    for (const n of list) {
      try {
        const s = stats(kind, n, house);
        console.log(kind.padEnd(10), n.padEnd(18), String(Math.round(s.tris)).padStart(7), 'tris', String(s.calls).padStart(4), 'meshes');
      } catch (e) {
        console.log(kind, n, 'ERROR', e.message);
      }
    }
  }
}
