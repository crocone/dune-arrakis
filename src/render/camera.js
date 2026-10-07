import * as THREE from 'three';
import { clamp, lerp } from '../core/mathutil.js';

// RTS camera: orbits a ground target with fixed-ish pitch, supports pan/zoom/rotate.
export class RTSCamera {
  constructor(aspect, mapW, mapH) {
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 600);
    this.mapW = mapW;
    this.mapH = mapH;
    this.target = new THREE.Vector3(mapW / 2, 0, mapH / 2);
    this.distance = 22;
    this.targetDistance = 22;
    this.minDistance = 7;
    this.maxDistance = 60;
    this.yaw = 0; // 0 = looking north (towards -z)
    this.targetYaw = 0;
    this.pitch = 0.95;
    this.heightFn = null;
    this.keys = new Set();
    this.edgeScroll = true;
    this.scrollSpeed = 1;
    this.mouse = { x: -1, y: -1, inside: false };
    this._ray = new THREE.Raycaster();
    this.shake = 0;
    this.update(0);
  }

  setMapSize(w, h) {
    this.mapW = w;
    this.mapH = h;
  }

  lookAt(x, z, instant = true) {
    this.target.x = clamp(x, 0, this.mapW);
    this.target.z = clamp(z, 0, this.mapH);
    if (instant) this.update(0);
  }

  zoom(delta) {
    this.targetDistance = clamp(this.targetDistance * Math.pow(1.0015, delta), this.minDistance, this.maxDistance);
  }

  rotate(delta) {
    this.targetYaw += delta;
  }

  resetRotation() {
    this.targetYaw = Math.round(this.targetYaw / (Math.PI * 2)) * Math.PI * 2;
  }

  pan(dxScreen, dyScreen) {
    // pan in camera-aligned ground directions, scaled by distance
    const s = this.distance * 0.0016;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const rightX = cos;
    const rightZ = -sin;
    const fwdX = -sin;
    const fwdZ = -cos;
    this.target.x -= (dxScreen * rightX - dyScreen * fwdX) * s;
    this.target.z -= (dxScreen * rightZ - dyScreen * fwdZ) * s;
    this._clamp();
  }

  _clamp() {
    this.target.x = clamp(this.target.x, 0, this.mapW);
    this.target.z = clamp(this.target.z, 0, this.mapH);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt, viewportW = 1, viewportH = 1) {
    // keyboard / edge pan
    let mx = 0;
    let mz = 0;
    if (this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('ArrowDown')) mz += 1;
    if (this.edgeScroll && this.mouse.inside && this.mouse.x >= 0) {
      const m = 6;
      if (this.mouse.x <= m) mx -= 1;
      if (this.mouse.x >= viewportW - m) mx += 1;
      if (this.mouse.y <= m) mz -= 1;
      if (this.mouse.y >= viewportH - m) mz += 1;
    }
    if (mx || mz) {
      const speed = (8 + this.distance * 0.9) * this.scrollSpeed * dt;
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      // right vector (cos, -sin), forward (-sin, -cos)
      this.target.x += (mx * cos + mz * sin) * speed;
      this.target.z += (-mx * sin + mz * cos) * speed;
      this._clamp();
    }
    if (this.keys.has('KeyQ')) this.targetYaw += dt * 1.6;
    if (this.keys.has('KeyE')) this.targetYaw -= dt * 1.6;

    const k = dt > 0 ? 1 - Math.pow(0.0001, dt) : 1;
    this.distance = lerp(this.distance, this.targetDistance, k);
    this.yaw = lerp(this.yaw, this.targetYaw, k);

    const groundY = this.heightFn ? this.heightFn(this.target.x, this.target.z) : 0;
    this.target.y = lerp(this.target.y, groundY, dt > 0 ? Math.min(1, dt * 5) : 1);

    // pitch flattens slightly when zoomed in
    const zt = (this.distance - this.minDistance) / (this.maxDistance - this.minDistance);
    this.pitch = lerp(0.78, 1.05, zt);
    const horiz = Math.cos(this.pitch) * this.distance;
    const vert = Math.sin(this.pitch) * this.distance;
    const cam = this.camera;
    cam.position.set(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + vert,
      this.target.z + Math.cos(this.yaw) * horiz
    );
    if (this.shake > 0.001) {
      const s = this.shake * 0.25;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake *= Math.pow(0.02, dt);
    }
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
  }

  setAspect(a) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  // Screen (NDC) to ground intersection using height field ray marching.
  ndcToGround(ndcX, ndcY, out = new THREE.Vector3()) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const o = this._ray.ray.origin;
    const d = this._ray.ray.direction;
    if (!this.heightFn) {
      const t = -o.y / d.y;
      return out.set(o.x + d.x * t, 0, o.z + d.z * t);
    }
    // march until below the terrain
    let t = 0;
    const maxT = 800;
    let step = 0.5;
    let prevT = 0;
    // fast-forward to approx y = 2.5 plane
    if (d.y < 0 && o.y > 3) t = (o.y - 3) / -d.y;
    for (let i = 0; i < 400 && t < maxT; i++) {
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      const h = this.heightFn(x, z);
      if (y <= h) {
        // refine by bisection
        let a = prevT;
        let b = t;
        for (let k = 0; k < 10; k++) {
          const m = (a + b) / 2;
          const yy = o.y + d.y * m;
          const hh = this.heightFn(o.x + d.x * m, o.z + d.z * m);
          if (yy <= hh) b = m;
          else a = m;
        }
        return out.set(o.x + d.x * b, this.heightFn(o.x + d.x * b, o.z + d.z * b), o.z + d.z * b);
      }
      prevT = t;
      t += step;
    }
    const tt = -o.y / d.y;
    return out.set(o.x + d.x * tt, 0, o.z + d.z * tt);
  }

  // Ground-plane corners of the view for minimap frustum drawing
  viewCorners() {
    const pts = [];
    for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      this._ray.setFromCamera({ x, y }, this.camera);
      const o = this._ray.ray.origin;
      const d = this._ray.ray.direction;
      let t = d.y < -0.01 ? (o.y - 0.2) / -d.y : 200;
      t = Math.min(t, 300);
      pts.push([o.x + d.x * t, o.z + d.z * t]);
    }
    return pts;
  }
}
