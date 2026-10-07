// Dev-only model gallery. Open /tools/viewer.html?set=vehicles&house=1
//   set   = vehicles | air | infantry | base | defense | all | <modelName>
//   house = 0..5   (default 1)
//   view  = iso | front | top | side   (default iso)
//   anim  = 1 to spin turrets/rotors
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createModel, hasModel } from '../src/render/models.js';
import { STRUCTURE_SIZE } from '../src/data/gamedata.js';

const q = new URLSearchParams(location.search);
const set = q.get('set') || 'vehicles';
const house = +(q.get('house') ?? 1);
const view = q.get('view') || 'iso';
const anim = q.get('anim') === '1';

const SETS = {
  vehicles: ['trike', 'raider', 'quad', 'tank', 'siegeTank', 'launcher', 'sonicTank', 'deviator', 'devastator', 'harvester', 'mcv'],
  air: ['carryall', 'ornithopter', 'frigate'],
  infantry: ['soldier', 'trooper', 'saboteur', 'fremen', 'sandworm'],
  base: ['constructionYard', 'windtrap', 'refinery', 'silo', 'radar', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'repairYard', 'starport', 'palace', 'ix'],
  defense: ['gunTurret', 'rocketTurret', 'wall', 'wallE', 'wallN'],
};
SETS.all = [...SETS.vehicles, ...SETS.air, ...SETS.infantry, ...SETS.base, ...SETS.defense];
const names = (SETS[set] || set.split(',')).filter(Boolean);

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9a66b);
scene.add(new THREE.HemisphereLight(0xffe2b8, 0x6a3f22, 0.85));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
fill.position.set(30, 20, 40);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xc99a62, roughness: 1 }),
);
ground.receiveShadow = true;
scene.add(ground);

// layout
const items = [];
let cursor = 0;
let rowZ = 0;
const maxRow = set === 'all' ? 16 : 14;
let rowMax = 0;
for (const name of names) {
  const isStruct = !!STRUCTURE_SIZE[name] || name.startsWith('wall');
  const kind = hasModel('structure', name) && isStruct ? 'structure' : 'unit';
  if (!hasModel(kind, name)) continue;
  const [w, h] = kind === 'structure' ? STRUCTURE_SIZE[name] || [1, 1] : [1, 1];
  const scale = kind === 'unit' ? (['soldier', 'trooper', 'saboteur', 'fremen'].includes(name) ? 1.7 : name === 'frigate' ? 1 : 1.2) : 1;
  const span = kind === 'structure' ? Math.max(w, h) + 0.6 : name === 'frigate' ? 3 : name === 'sandworm' ? 1.6 : 1.3;
  if (cursor + span > maxRow) {
    cursor = 0;
    rowZ += rowMax + 0.4;
    rowMax = 0;
  }
  const m = createModel(kind, name, house);
  m.root.scale.setScalar(scale * (name === 'sandworm' ? 1.6 : 1));
  if (name === 'sandworm') { m.root.rotation.z = Math.PI / 2 * 0.75; m.root.position.y = 0.2; }
  const holder = new THREE.Group();
  holder.add(m.root);
  if (kind === 'structure') {
    // lay a slab under the structure like in the game
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.04, h),
      new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.9 }),
    );
    slab.position.set(w / 2, -0.01, h / 2);
    slab.receiveShadow = true;
    holder.add(slab);
    holder.position.set(cursor, 0.02, rowZ);
    rowMax = Math.max(rowMax, h);
  } else {
    const alt = name === 'carryall' ? 1.0 : name === 'ornithopter' ? 0.8 : name === 'frigate' ? 1.2 : 0;
    holder.position.set(cursor + span / 2, alt, rowZ + 0.65);
    rowMax = Math.max(rowMax, name === 'frigate' ? 2.6 : 1.3);
    if (alt) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.4 * (name === 'frigate' ? 3 : 1), 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3 }));
      sh.position.set(cursor + span / 2 + 0.3, 0.03, rowZ + 0.9);
      scene.add(sh);
    }
  }
  scene.add(holder);
  items.push({ name, kind, parts: m.parts, holder });
  cursor += span;
}
const bounds = new THREE.Box3();
for (const it of items) bounds.union(new THREE.Box3().setFromObject(it.holder));
const bsize = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
const widthUsed = bsize.x;
const totalDepth = bsize.z;

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
const aspect0 = innerWidth > 10 && innerHeight > 10 ? innerWidth / innerHeight : 16 / 9;
const radius = Math.max((bsize.x * 0.56) / Math.min(aspect0, 2), bsize.z * 0.75, bsize.y * 1.1) + 0.12;
const dirs = {
  iso: new THREE.Vector3(0.0, 0.85, 1.05),
  front: new THREE.Vector3(0.0, 0.25, 1.0),
  side: new THREE.Vector3(1.0, 0.25, 0.0),
  top: new THREE.Vector3(0.0, 1.0, 0.02),
  iso2: new THREE.Vector3(-0.8, 0.7, 0.8),
  iso3: new THREE.Vector3(0.8, 0.7, -0.8),
};
const dir = (dirs[view] || dirs.iso).clone().normalize();
const dist = radius / Math.sin((camera.fov * Math.PI) / 360);
camera.position.copy(center).addScaledVector(dir, dist * (q.get('zoom') ? +q.get('zoom') : 1));
const controls = new OrbitControls(camera, canvas);
controls.target.copy(center);
controls.update();

sun.position.set(center.x - 30, 30, center.z - 20);
sun.target.position.copy(center);
const sc = sun.shadow.camera;
const ext = Math.max(widthUsed, totalDepth) * 0.8 + 3;
sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 120;
sc.updateProjectionMatrix();

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const hud = document.getElementById('hud');
hud.innerHTML = ['vehicles', 'air', 'infantry', 'base', 'defense']
  .map((s) => `<a class="${s === set ? 'on' : ''}" href="?set=${s}&house=${house}&view=${view}">${s}</a>`)
  .join('') + ' | house: ' + [0, 1, 2, 3, 4, 5].map((h) => `<a class="${h === house ? 'on' : ''}" href="?set=${set}&house=${h}&view=${view}">${h}</a>`).join('');

let t = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  if (anim) {
    for (const it of items) {
      const p = it.parts;
      if (p.turret) p.turret.rotation.y = Math.sin(t) * 0.8;
      if (p.rotor) p.rotor.rotation.y += dt * 3;
      if (p.dish) p.dish.rotation.y += dt * 1.2;
      if (p.orb) p.orb.rotation.y += dt;
      if (p.drum) p.drum.rotation.z -= dt * 6;
      if (p.crane) p.crane.rotation.y = Math.sin(t * 0.5) * 0.8;
      if (p.wingL) { p.wingL.rotation.x = Math.sin(t * 30) * 0.35; p.wingR.rotation.x = -Math.sin(t * 30) * 0.35; }
    }
  }
  controls.update();
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready = true;
window.__v = { camera, controls, center, bounds, items, scene };
