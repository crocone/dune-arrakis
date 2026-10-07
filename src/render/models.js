import * as THREE from 'three';
import { Builder } from './models/builder.js';
import { getMaterial } from './models/materials.js';
import { UNIT_DEFS } from './models/units.js';
import { STRUCT_DEFS } from './models/structures.js';

// ---------------------------------------------------------------------------
// Procedural PBR models for every unit and structure (see ./models/*).
// Model space: +X = forward (facing), +Y = up, Z = side. 1 unit = 1 tile.
// Structures: origin at the top-left corner of their footprint, extending +X/+Z.
// Each model is built in a house "style" (Harkonnen / Atreides / Ordos silhouette).
// ---------------------------------------------------------------------------
export { getMaterial };

// house id -> design language
const STYLE_OF_HOUSE = ['harkonnen', 'atreides', 'ordos', 'atreides', 'harkonnen', 'ordos'];

const templateCache = new Map();

function getTemplate(kind, name, style) {
  const key = kind + ':' + name + ':' + style;
  if (templateCache.has(key)) return templateCache.get(key);
  const defs = kind === 'unit' ? UNIT_DEFS : STRUCT_DEFS;
  const fn = defs[name];
  if (!fn) {
    console.warn('No model for', key);
    templateCache.set(key, null);
    return null;
  }
  const b = new Builder({ style, aoHeight: kind === 'unit' ? 0.14 : 0.3 });
  fn(b, style);
  const t = b.build();
  templateCache.set(key, t);
  return t;
}

export function hasModel(kind, name) {
  return !!(kind === 'unit' ? UNIT_DEFS[name] : STRUCT_DEFS[name]);
}

// Returns { root: Group, parts: {name: Object3D} }
export function createModel(kind, name, house, opts = {}) {
  const style = STYLE_OF_HOUSE[house] || 'generic';
  const t = getTemplate(kind, name, style);
  const root = new THREE.Group();
  const parts = {};
  if (!t) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), getMaterial('accent', house));
    m.position.y = 0.15;
    root.add(m);
    return { root, parts };
  }
  // create part groups; nested parts are positioned relative to their parent's pivot
  for (const [pname, pdef] of Object.entries(t)) {
    parts[pname] = pname === 'body' ? root : new THREE.Group();
  }
  for (const [pname, pdef] of Object.entries(t)) {
    const g = parts[pname];
    if (pname !== 'body') {
      const parent = parts[pdef.parent] || root;
      const pp = t[pdef.parent]?.pivot || [0, 0, 0];
      const pv = pdef.pivot;
      g.position.set(pv[0] - (pdef.parent === 'body' ? 0 : pp[0]), pv[1] - (pdef.parent === 'body' ? 0 : pp[1]), pv[2] - (pdef.parent === 'body' ? 0 : pp[2]));
      parent.add(g);
    }
    for (const { mat, geo } of pdef.meshes) {
      const mesh = new THREE.Mesh(geo, getMaterial(mat, house));
      if (pname !== 'body') mesh.position.set(-pdef.pivot[0], -pdef.pivot[1], -pdef.pivot[2]);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      g.add(mesh);
    }
  }
  return { root, parts };
}
