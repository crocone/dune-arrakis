import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { UV_SCALE, NO_AO } from './materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Builder: collects primitives per (part, material), then merges them.
// Model space: +X forward, +Y up, Z side. 1 unit = 1 tile.
// ---------------------------------------------------------------------------
export class Builder {
  constructor(opts = {}) {
    this.style = opts.style || 'generic'; // 'harkonnen' | 'atreides' | 'ordos' | 'generic'
    this.aoHeight = opts.aoHeight ?? 0.14;
    this.parts = new Map();
    this.partDefs = new Map();
    this.part('body');
  }

  // select (create) a named part. pivot is in body coordinates. Nested parts: pass parent.
  part(name, pivot = [0, 0, 0], parent = 'body') {
    if (!this.partDefs.has(name)) {
      this.partDefs.set(name, { pivot, parent: name === 'body' ? null : parent });
      this.parts.set(name, new Map());
    }
    this.cur = name;
    return this;
  }

  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _s.set(sx, sy, sz);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    geo.applyMatrix4(_m);
    const bucket = this.parts.get(this.cur);
    if (!bucket.has(mat)) bucket.set(mat, []);
    bucket.get(mat).push(geo);
    return this;
  }

  // ---- primitives --------------------------------------------------------
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  }

  rbox(mat, w, h, d, r, x, y, z, rx = 0, ry = 0, rz = 0) {
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    return this.add(mat, new RoundedBoxGeometry(w, h, d, 2, Math.max(0.002, rr)), x, y, z, rx, ry, rz);
  }

  // chamfered box: flat faceted bevels that catch light (cheaper + crisper than rounded)
  cbox(mat, w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0) {
    const cc = Math.min(c, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const pts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      pts.push(new THREE.Vector3(sx * hw, sy * (hh - cc), sz * (hd - cc)));
      pts.push(new THREE.Vector3(sx * (hw - cc), sy * hh, sz * (hd - cc)));
      pts.push(new THREE.Vector3(sx * (hw - cc), sy * (hh - cc), sz * hd));
    }
    return this.add(mat, new ConvexGeometry(pts), x, y, z, rx, ry, rz);
  }

  // arbitrary convex solid from points [[x,y,z],...] (flat shaded)
  hull(mat, pts, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return this.add(mat, new ConvexGeometry(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), x, y, z, rx, ry, rz, sx, sy, sz);
  }

  // Side-profile solid: profile = [[x,y],...] (convex polygon in the XY plane),
  // width at the lowest y = wBot, at the highest y = wTop. Gives sloped sides + glacis plates.
  tapered(mat, profile, wBot, wTop, x = 0, y = 0, z = 0, ry = 0) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, py] of profile) { y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const pts = [];
    for (const [px, py] of profile) {
      const t = y1 === y0 ? 0 : (py - y0) / (y1 - y0);
      const hw = (wBot + (wTop - wBot) * t) / 2;
      pts.push([px, py, hw], [px, py, -hw]);
    }
    return this.hull(mat, pts, x, y, z, 0, ry, 0);
  }

  // plan-view solid: outline [[x,z],...] at the bottom (y0) and a scaled outline at the top (y1)
  frustum(mat, outline, y0, y1, topScale = 1, cx = 0, cz = 0) {
    const pts = [];
    for (const [px, pz] of outline) pts.push([px, y0, pz]);
    let mx = 0, mz = 0;
    for (const [px, pz] of outline) { mx += px; mz += pz; }
    mx /= outline.length; mz /= outline.length;
    for (const [px, pz] of outline) pts.push([mx + (px - mx) * topScale, y1, mz + (pz - mz) * topScale]);
    return this.hull(mat, pts, cx, 0, cz);
  }

  cyl(mat, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(mat, new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
  }

  cylX(mat, r, len, seg, x, y, z) {
    return this.cyl(mat, r, r, len, seg, x, y, z, 0, 0, Math.PI / 2);
  }

  cylZ(mat, r, len, seg, x, y, z) {
    return this.cyl(mat, r, r, len, seg, x, y, z, Math.PI / 2, 0, 0);
  }

  sphere(mat, r, x, y, z, ws = 12, hs = 8, sy = 1, sx = 1, sz = 1) {
    return this.add(mat, new THREE.SphereGeometry(r, ws, hs), x, y, z, 0, 0, 0, sx, sy, sz);
  }

  hemi(mat, r, x, y, z, seg = 14, sy = 1) {
    return this.add(mat, new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, y, z, 0, 0, 0, 1, sy, 1);
  }

  cone(mat, r, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(mat, new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz);
  }

  torus(mat, r, tube, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16, tseg = 6) {
    return this.add(mat, new THREE.TorusGeometry(r, tube, tseg, seg), x, y, z, rx, ry, rz);
  }

  // torus whose axis points along dir ([dx,dy,dz]) centred at pos
  ring(mat, r, tube, pos, dir, seg = 20, tseg = 5) {
    _c.set(dir[0], dir[1], dir[2]).normalize();
    const geo = new THREE.TorusGeometry(r, tube, tseg, seg);
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _c);
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(1, 1, 1));
    geo.applyMatrix4(_m);
    const bucket = this.parts.get(this.cur);
    if (!bucket.has(mat)) bucket.set(mat, []);
    bucket.get(mat).push(geo);
    return this;
  }

  // surface of revolution about the local Y axis. profile = [[radius, y], ...]
  lathe(mat, profile, seg, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
    return this.add(mat, new THREE.LatheGeometry(pts, seg), x, y, z, rx, ry, rz, sx, sy, sz);
  }

  // lathe about the X axis (barrels, nozzles). profile = [[radius, xOffset], ...]
  latheX(mat, profile, seg, x, y, z) {
    return this.lathe(mat, profile.map(([r, p]) => [r, p]), seg, x, y, z, 0, 0, -Math.PI / 2);
  }

  // extruded polygon in the XZ plane (points [[x,z],...]) with height h starting at y
  prism(mat, pts, h, y = 0, bevel = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
    shape.closePath();
    const opts = { depth: bevel ? Math.max(0.001, h - bevel * 2) : h, bevelEnabled: !!bevel };
    if (bevel) Object.assign(opts, { bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, bevelOffset: -bevel });
    const geo = new THREE.ExtrudeGeometry(shape, opts);
    geo.rotateX(-Math.PI / 2);
    return this.add(mat, geo, 0, y + (bevel ? bevel : 0), 0);
  }

  // extruded polygon in the XY plane (side profile, e.g. an emblem) with thickness t centred on z
  plate(mat, pts, t, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
    geo.translate(0, 0, -t / 2);
    return this.add(mat, geo, x, y, z, rx, ry, rz, s, s, s);
  }

  // cylinder / square beam between two points
  beam(mat, p0, p1, r, seg = 6, r1 = r) {
    _a.set(p0[0], p0[1], p0[2]);
    _b.set(p1[0], p1[1], p1[2]);
    const len = _a.distanceTo(_b);
    if (len < 1e-5) return this;
    _c.copy(_b).sub(_a).normalize();
    // r = radius at p0, r1 = radius at p1 (cylinder top is toward p1)
    const geo = new THREE.CylinderGeometry(r1, r, len, seg);
    _q.setFromUnitVectors(_up, _c);
    _m.compose(_p.copy(_a).add(_b).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
    geo.applyMatrix4(_m);
    const bucket = this.parts.get(this.cur);
    if (!bucket.has(mat)) bucket.set(mat, []);
    bucket.get(mat).push(geo);
    return this;
  }

  // polyline pipe with joint balls
  pipe(mat, pts, r, seg = 6) {
    for (let i = 0; i < pts.length - 1; i++) this.beam(mat, pts[i], pts[i + 1], r, seg);
    for (let i = 1; i < pts.length - 1; i++) this.sphere(mat, r * 1.02, pts[i][0], pts[i][1], pts[i][2], seg, 4);
    return this;
  }

  // row of identical things: fn(i, t) for i in [0,n), t in [0,1]
  row(n, fn) {
    for (let i = 0; i < n; i++) fn(i, n === 1 ? 0.5 : i / (n - 1));
    return this;
  }

  // small rivet / bolt heads
  bolts(mat, pts, r = 0.006, axis = 'y') {
    for (const [x, y, z] of pts) {
      if (axis === 'y') this.cyl(mat, r, r, r * 0.9, 6, x, y, z);
      else if (axis === 'x') this.cyl(mat, r, r, r * 0.9, 6, x, y, z, 0, 0, Math.PI / 2);
      else this.cyl(mat, r, r, r * 0.9, 6, x, y, z, Math.PI / 2, 0, 0);
    }
    return this;
  }

  // ---- finalise ----------------------------------------------------------
  build() {
    const out = {};
    for (const [name, bucket] of this.parts) {
      const meshes = [];
      for (const [mat, geos] of bucket) {
        const uvScale = UV_SCALE[mat] ?? UV_SCALE.default;
        const noAO = NO_AO.has(mat);
        const norm = geos.map((g) => {
          const gg = g.index ? g.toNonIndexed() : g;
          for (const k of Object.keys(gg.attributes)) {
            if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
          }
          if (!gg.attributes.normal) gg.computeVertexNormals();
          this._bake(gg, uvScale, noAO);
          return gg;
        });
        const merged = mergeGeometries(norm, false);
        merged.computeBoundingSphere();
        meshes.push({ mat, geo: merged });
      }
      out[name] = { meshes, ...this.partDefs.get(name) };
    }
    return out;
  }

  // box-projected world-scale UVs + baked ambient occlusion / dust vertex colours
  _bake(g, uvScale, noAO) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const n = pos.count;
    const uv = new Float32Array(n * 2);
    const col = new Float32Array(n * 3);
    const aoH = this.aoHeight;
    for (let i = 0; i < n; i += 3) {
      // face normal decides the projection axis
      const nx = Math.abs(nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2));
      const ny = Math.abs(nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2));
      const nz = Math.abs(nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2));
      const axis = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
      for (let k = 0; k < 3; k++) {
        const j = i + k;
        const px = pos.getX(j), py = pos.getY(j), pz = pos.getZ(j);
        let u, v;
        if (axis === 0) { u = pz; v = py; } else if (axis === 1) { u = px; v = pz; } else { u = px; v = py; }
        uv[j * 2] = u * uvScale;
        uv[j * 2 + 1] = v * uvScale;
        if (noAO) {
          col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = 1;
        } else {
          const ny2 = nor.getY(j);
          // contact darkening near the ground, darker undersides, sandy dust on top faces
          let ao = 0.58 + 0.42 * smooth(-0.02, aoH, py);
          ao *= 0.8 + 0.2 * (ny2 * 0.5 + 0.5);
          const up = Math.max(0, ny2);
          col[j * 3] = ao;
          col[j * 3 + 1] = ao * (1 - 0.05 * up);
          col[j * 3 + 2] = ao * (1 - 0.14 * up);
        }
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
}
