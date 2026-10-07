import * as THREE from 'three';
import { fxRandom as R } from '../core/random.js';

// GPU point-sprite particle pool. Two pools: additive (fire, glow) and alpha (smoke, dust).
class ParticlePool {
  constructor(max, additive) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); // current color + alpha
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.rot = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.rotAttr = new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('pcolor', this.colAttr);
    geo.setAttribute('psize', this.sizeAttr);
    geo.setAttribute('prot', this.rotAttr);
    geo.setDrawRange(0, 0);
    this.geo = geo;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 400 },
        uSoft: { value: additive ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 pcolor;
        attribute float psize;
        attribute float prot;
        varying vec4 vCol;
        varying float vRot;
        uniform float uScale;
        void main(){
          vCol = pcolor;
          vRot = prot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vCol;
        varying float vRot;
        uniform float uSoft;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float c = cos(vRot), s = sin(vRot);
          p = mat2(c, -s, s, c) * p;
          float r = length(p);
          if (r > 1.0) discard;
          float a;
          if (uSoft > 0.5) {
            a = pow(1.0 - r, 1.6);
          } else {
            float n = 0.75 + 0.25 * sin(p.x * 5.0 + vRot * 3.0) * sin(p.y * 4.0 - vRot * 2.0);
            a = smoothstep(1.0, 0.35, r) * n;
          }
          gl_FragColor = vec4(vCol.rgb, vCol.a * a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 10;
    this.mat = mat;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav = 0, drag = 0) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = 0;
    this.maxLife[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.size[i] = s0;
    for (let k = 0; k < 4; k++) {
      this.c0[i * 4 + k] = c0[k];
      this.c1[i * 4 + k] = c1[k];
      this.col[i * 4 + k] = c0[k];
    }
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.rot[i] = R.rand() * 6.28;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        // swap with last
        const last = --this.count;
        if (i !== last) this._copy(last, i);
        continue;
      }
      const t = this.life[i] / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * t;
      this.rot[i] += dt * 0.6;
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.rotAttr.needsUpdate = true;
  }

  _copy(from, to) {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
    }
    for (let k = 0; k < 4; k++) {
      this.col[to * 4 + k] = this.col[from * 4 + k];
      this.c0[to * 4 + k] = this.c0[from * 4 + k];
      this.c1[to * 4 + k] = this.c1[from * 4 + k];
    }
    this.size[to] = this.size[from];
    this.s0[to] = this.s0[from];
    this.s1[to] = this.s1[from];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
    this.rot[to] = this.rot[from];
  }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }
}

const FIRE0 = [3.2, 1.9, 0.7, 1];
const FIRE1 = [1.2, 0.25, 0.05, 0];
const FLASH0 = [4, 3.2, 2.2, 1];
const FLASH1 = [2, 0.8, 0.2, 0];
const SMOKE0 = [0.22, 0.19, 0.16, 0.75];
const SMOKE1 = [0.35, 0.31, 0.27, 0];
const DUST0 = [0.78, 0.6, 0.4, 0.45];
const DUST1 = [0.82, 0.66, 0.46, 0];
const SPARK0 = [4, 2.6, 1.0, 1];
const SPARK1 = [1.5, 0.4, 0.05, 0];

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.add = new ParticlePool(6000, true);
    this.alpha = new ParticlePool(6000, false);
    scene.add(this.alpha.points);
    scene.add(this.add.points);
    this.lights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffa050, 0, 6, 1.6);
      l.userData = { life: 0, max: 1, power: 0 };
      scene.add(l);
      this.lights.push(l);
    }
    this.rings = []; // expanding shock rings (meshes)
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.shakeCallback = null;
    this.heightFn = null;
  }

  setViewportHeight(h) {
    // point size scale relative to viewport and fov
    const s = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.add.mat.uniforms.uScale.value = s;
    this.alpha.mat.uniforms.uScale.value = s;
  }

  flashLight(x, y, z, power, radius, color = 0xffa050, life = 0.35) {
    let best = this.lights[0];
    for (const l of this.lights) {
      if (l.userData.life >= l.userData.max) { best = l; break; }
      if (l.intensity < best.intensity) best = l;
    }
    best.position.set(x, y + 0.6, z);
    best.color.setHex(color);
    best.distance = radius;
    best.userData = { life: 0, max: life, power };
    best.intensity = power;
  }

  ring(x, y, z, radius, color = 0xffc080, life = 0.5, opacity = 0.7) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(x, y + 0.05, z);
    m.scale.setScalar(0.01);
    m.userData = { life: 0, max: life, radius, opacity };
    this.scene.add(m);
    this.rings.push(m);
  }

  // size: 0 = small (bullet hit), 1 = medium (unit), 2 = large (structure), 3 = huge (death hand)
  explosion(x, y, z, size = 1) {
    const sc = [0.35, 0.8, 1.5, 3.2][size] ?? 1;
    const nFire = [6, 18, 40, 90][size] ?? 18;
    for (let i = 0; i < nFire; i++) {
      const a = R.rand() * Math.PI * 2;
      const sp = R.rand() * 1.6 * sc;
      this.add.emit(x, y + 0.1, z, Math.cos(a) * sp, R.rand() * 2.2 * sc + 0.3, Math.sin(a) * sp, 0.35 + R.rand() * 0.45, 0.25 * sc + R.rand() * 0.2 * sc, 0.9 * sc, FIRE0, FIRE1, -0.5, 2.5);
    }
    this.add.emit(x, y + 0.2, z, 0, 0.2, 0, 0.18, 1.6 * sc, 2.6 * sc, FLASH0, FLASH1);
    const nSmoke = [3, 10, 26, 60][size] ?? 10;
    for (let i = 0; i < nSmoke; i++) {
      const a = R.rand() * Math.PI * 2;
      const sp = R.rand() * 0.9 * sc;
      this.alpha.emit(x + Math.cos(a) * 0.2 * sc, y + 0.2, z + Math.sin(a) * 0.2 * sc, Math.cos(a) * sp, 0.5 + R.rand() * 0.9 * sc, Math.sin(a) * sp, 1.2 + R.rand() * 1.6, 0.5 * sc, 1.8 * sc, SMOKE0, SMOKE1, -0.1, 0.9);
    }
    if (size >= 1) {
      const nS = [0, 12, 26, 40][size];
      for (let i = 0; i < nS; i++) {
        const a = R.rand() * Math.PI * 2;
        const sp = 2 + R.rand() * 3 * sc;
        this.add.emit(x, y + 0.15, z, Math.cos(a) * sp, 1.5 + R.rand() * 3, Math.sin(a) * sp, 0.4 + R.rand() * 0.6, 0.06, 0.02, SPARK0, SPARK1, 9, 0.5);
      }
      // sand kicked up
      for (let i = 0; i < nS; i++) {
        const a = R.rand() * Math.PI * 2;
        const sp = 0.5 + R.rand() * 1.5 * sc;
        this.alpha.emit(x, y + 0.05, z, Math.cos(a) * sp, 0.3 + R.rand(), Math.sin(a) * sp, 0.8 + R.rand(), 0.3 * sc, 1.2 * sc, DUST0, DUST1, 0.5, 1.5);
      }
      this.ring(x, y, z, 1.2 * sc, 0xffb070, 0.45, 0.5);
    }
    this.flashLight(x, y, z, [3, 12, 30, 80][size], [2.5, 5, 9, 18][size], 0xff9a40, [0.2, 0.35, 0.6, 1.0][size]);
    if (this.shakeCallback && size >= 2) this.shakeCallback(size === 3 ? 1 : 0.35, x, z);
  }

  muzzle(x, y, z, dirX, dirZ, big = false) {
    const s = big ? 1.6 : 1;
    this.add.emit(x, y, z, dirX * 1.5, 0.1, dirZ * 1.5, 0.08, 0.25 * s, 0.45 * s, FLASH0, FLASH1);
    for (let i = 0; i < 3; i++) {
      this.alpha.emit(x, y, z, dirX * (0.6 + R.rand()) + (R.rand() - 0.5) * 0.3, 0.3 + R.rand() * 0.3, dirZ * (0.6 + R.rand()) + (R.rand() - 0.5) * 0.3, 0.5 + R.rand() * 0.4, 0.12 * s, 0.45 * s, [0.5, 0.47, 0.42, 0.45], [0.6, 0.57, 0.52, 0], 0, 2);
    }
    this.flashLight(x, y, z, big ? 6 : 3, big ? 4 : 2.5, 0xffc070, 0.08);
  }

  impact(x, y, z, kind = 'shell') {
    if (kind === 'bullet') {
      for (let i = 0; i < 4; i++) {
        const a = R.rand() * Math.PI * 2;
        this.alpha.emit(x, y + 0.03, z, Math.cos(a) * 0.4, 0.5 + R.rand() * 0.6, Math.sin(a) * 0.4, 0.4 + R.rand() * 0.3, 0.08, 0.25, DUST0, DUST1, 1.5, 1);
      }
      this.add.emit(x, y + 0.05, z, 0, 0, 0, 0.06, 0.15, 0.2, SPARK0, SPARK1);
    } else if (kind === 'gas') {
      for (let i = 0; i < 18; i++) {
        const a = R.rand() * Math.PI * 2;
        const sp = R.rand() * 0.8;
        this.alpha.emit(x, y + 0.1, z, Math.cos(a) * sp, 0.15 + R.rand() * 0.3, Math.sin(a) * sp, 1.6 + R.rand(), 0.5, 1.6, [0.45, 0.85, 0.3, 0.6], [0.3, 0.6, 0.2, 0], -0.05, 0.6);
      }
    } else {
      this.explosion(x, y, z, 0);
    }
  }

  sonicWave(x, y, z) {
    this.add.emit(x, y + 0.25, z, 0, 0, 0, 0.12, 0.5, 0.9, [0.6, 1.2, 1.6, 0.5], [0.2, 0.5, 0.9, 0]);
    this.alpha.emit(x, y + 0.2, z, (R.rand() - 0.5) * 0.4, 0.2, (R.rand() - 0.5) * 0.4, 0.6, 0.3, 0.9, [0.85, 0.75, 0.55, 0.25], [0.85, 0.75, 0.55, 0], 0, 1);
  }

  smoke(x, y, z, intensity = 1, fire = false) {
    this.alpha.emit(x + (R.rand() - 0.5) * 0.2, y, z + (R.rand() - 0.5) * 0.2, (R.rand() - 0.5) * 0.15 + 0.15, 0.5 + R.rand() * 0.4, (R.rand() - 0.5) * 0.15 + 0.08, 1.8 + R.rand(), 0.2 * intensity, 1.0 * intensity, [0.12, 0.1, 0.09, 0.6], [0.3, 0.28, 0.25, 0], -0.08, 0.3);
    if (fire && R.rand() < 0.6) {
      this.add.emit(x + (R.rand() - 0.5) * 0.15, y - 0.05, z + (R.rand() - 0.5) * 0.15, 0, 0.6 + R.rand() * 0.4, 0, 0.3 + R.rand() * 0.2, 0.18 * intensity, 0.05, FIRE0, FIRE1);
    }
  }

  dust(x, y, z, amount = 1) {
    this.alpha.emit(x + (R.rand() - 0.5) * 0.2, y + 0.04, z + (R.rand() - 0.5) * 0.2, (R.rand() - 0.5) * 0.3, 0.15 + R.rand() * 0.2, (R.rand() - 0.5) * 0.3, 0.9 + R.rand() * 0.6, 0.12 * amount, 0.6 * amount, DUST0, DUST1, 0.05, 1.2);
  }

  trail(x, y, z) {
    this.alpha.emit(x, y, z, (R.rand() - 0.5) * 0.1, 0.05 + R.rand() * 0.1, (R.rand() - 0.5) * 0.1, 0.7 + R.rand() * 0.5, 0.08, 0.45, [0.75, 0.72, 0.68, 0.5], [0.7, 0.68, 0.64, 0], -0.05, 0.6);
    this.add.emit(x, y, z, 0, 0, 0, 0.08, 0.12, 0.05, [3, 1.8, 0.6, 1], [1, 0.3, 0.05, 0]);
  }

  thruster(x, y, z) {
    this.add.emit(x, y, z, 0, -0.5, 0, 0.12, 0.12, 0.04, [2.5, 1.5, 0.6, 0.8], [1, 0.3, 0.05, 0]);
  }

  sandBurst(x, y, z, scale = 1) {
    for (let i = 0; i < 16 * scale; i++) {
      const a = R.rand() * Math.PI * 2;
      const sp = 0.3 + R.rand() * 1.1 * scale;
      this.alpha.emit(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, Math.cos(a) * sp, 1.0 + R.rand() * 1.8 * scale, Math.sin(a) * sp, 0.8 + R.rand() * 0.7, 0.18 * scale, 0.7 * scale, [0.84, 0.64, 0.42, 0.6], [0.84, 0.66, 0.46, 0], 3.2, 0.6);
    }
  }

  wormTrail(x, y, z) {
    this.alpha.emit(x + (R.rand() - 0.5) * 0.6, y + 0.03, z + (R.rand() - 0.5) * 0.6, (R.rand() - 0.5) * 0.3, 0.15 + R.rand() * 0.3, (R.rand() - 0.5) * 0.3, 0.7 + R.rand() * 0.4, 0.12, 0.45, [0.82, 0.62, 0.4, 0.35], [0.84, 0.66, 0.46, 0], 0.6, 1);
  }

  spiceBloom(x, y, z) {
    for (let i = 0; i < 70; i++) {
      const a = R.rand() * Math.PI * 2;
      const sp = 0.5 + R.rand() * 2.5;
      this.alpha.emit(x, y + 0.1, z, Math.cos(a) * sp, 1.5 + R.rand() * 3.5, Math.sin(a) * sp, 1.5 + R.rand() * 1.5, 0.35, 1.6, [0.85, 0.42, 0.16, 0.9], [0.8, 0.45, 0.2, 0], 2.2, 0.5);
    }
    this.flashLight(x, y, z, 8, 6, 0xff8040, 0.6);
    this.ring(x, y, z, 2.5, 0xff8a40, 0.8, 0.6);
  }

  deathHand(x, y, z) {
    this.explosion(x, y, z, 3);
    for (let i = 0; i < 10; i++) {
      const a = R.rand() * Math.PI * 2;
      const r = R.rand() * 2.5;
      setTimeout(() => this.explosion(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 1), i * 70);
    }
    this.ring(x, y, z, 5, 0xffd090, 1.1, 0.8);
  }

  update(dt) {
    this.add.update(dt);
    this.alpha.update(dt);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.life < u.max) {
        u.life += dt;
        const t = Math.min(1, u.life / u.max);
        l.intensity = u.power * (1 - t) * (1 - t);
      } else l.intensity = 0;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const m = this.rings[i];
      const u = m.userData;
      u.life += dt;
      const t = u.life / u.max;
      if (t >= 1) {
        this.scene.remove(m);
        m.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - t, 3);
      m.scale.setScalar(Math.max(0.01, e * u.radius));
      m.material.opacity = u.opacity * (1 - t);
    }
  }

  clear() {
    this.add.clear();
    this.alpha.clear();
    for (const m of this.rings) {
      this.scene.remove(m);
      m.material.dispose();
    }
    this.rings = [];
  }
}
