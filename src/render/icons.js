import * as THREE from 'three';
import { createModel } from './models.js';
import { STRUCTURE_SIZE, isStructureType } from '../data/gamedata.js';

// Renders item models into small PNG thumbnails (data URLs) for the build menu.
export class IconFactory {
  constructor(renderer) {
    this.renderer = renderer;
    this.size = 128;
    this.cache = new Map();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const hemi = new THREE.HemisphereLight(0xfff0dd, 0x553322, 1.4);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-3, 5, 2);
    const rim = new THREE.DirectionalLight(0xffc48a, 1.2);
    rim.position.set(3, 2, -4);
    this.scene.add(hemi, key, rim);
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { samples: 4 });
    this.pixels = new Uint8Array(this.size * this.size * 4);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx2d = this.canvas.getContext('2d');
  }

  get(id, house) {
    const key = id + ':' + house;
    if (this.cache.has(key)) return this.cache.get(key);
    const url = this._render(id, house);
    this.cache.set(key, url);
    return url;
  }

  _render(id, house) {
    const isStruct = isStructureType(id);
    let modelName = id;
    if (id === 'slab1' || id === 'slab4') modelName = null;
    let root;
    if (modelName) {
      root = createModel(isStruct ? 'structure' : 'unit', modelName === 'soldier' && house === 3 ? 'fremen' : modelName, house, { castShadow: false }).root;
    } else {
      root = new THREE.Group();
      const n = id === 'slab4' ? 2 : 1;
      const mat = new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.9 });
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), mat);
          m.position.set(i + 0.5, 0.04, j + 0.5);
          root.add(m);
        }
      }
    }
    const holder = new THREE.Group();
    holder.add(root);
    if (isStruct) {
      const [w, h] = STRUCTURE_SIZE[id] || [1, 1];
      root.position.set(-w / 2, 0, -h / 2);
    }
    this.scene.add(holder);
    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const radius = Math.max(sz.x, sz.y * 1.2, sz.z) * 0.62 + 0.05;
    const dir = new THREE.Vector3(1.0, 0.85, 1.1).normalize();
    const dist = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.lookAt(center);
    this.camera.updateMatrixWorld();

    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevTone = r.toneMapping;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.pixels);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    r.toneMapping = prevTone;
    this.scene.remove(holder);

    // flip Y and convert linear -> sRGB-ish (render target holds linear values)
    const img = this.ctx2d.createImageData(this.size, this.size);
    const s = this.size;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const si = ((s - 1 - y) * s + x) * 4;
        const di = (y * s + x) * 4;
        img.data[di] = toSRGB(this.pixels[si]);
        img.data[di + 1] = toSRGB(this.pixels[si + 1]);
        img.data[di + 2] = toSRGB(this.pixels[si + 2]);
        img.data[di + 3] = this.pixels[si + 3];
      }
    }
    this.ctx2d.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}

const SRGB_LUT = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  SRGB_LUT[i] = Math.round(Math.min(1, v) * 255);
}
function toSRGB(v) {
  return SRGB_LUT[v];
}
