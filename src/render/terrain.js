import * as THREE from 'three';
import { T } from '../core/constants.js';
import { fbm, valueNoise, smoothstep, clamp, lerp } from '../core/mathutil.js';

// Visual parameters per terrain type
const srgb = (hex) => {
  const c = new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
};
const TYPE_STYLE = {
  [T.SAND]: { h: 0.0, amp: 0.035, color: srgb(0xd29a5c) },
  [T.DUNES]: { h: 0.1, amp: 0.38, color: srgb(0xe2ad6c) },
  [T.ROCK]: { h: 0.32, amp: 0.05, color: srgb(0x6e5545) },
  [T.MOUNTAIN]: { h: 1.05, amp: 1.0, color: srgb(0x543a2c) },
  [T.SPICE]: { h: 0.0, amp: 0.035, color: srgb(0xd0955a) },
  [T.THICK_SPICE]: { h: 0.0, amp: 0.035, color: srgb(0xcc9058) },
  [T.SPICE_BLOOM]: { h: 0.0, amp: 0.035, color: srgb(0xd0955a) },
  [T.SPECIAL_BLOOM]: { h: 0.0, amp: 0.035, color: srgb(0xd0955a) },
  [T.SLAB]: { h: 0.32, amp: 0.0, color: srgb(0x6e5545) },
};

export const ROCK_HEIGHT = 0.32;

// Builds and maintains the terrain mesh, spice/shroud overlays.
export class TerrainRenderer {
  constructor(map, opts = {}) {
    this.map = map;
    this.W = map.width;
    this.H = map.height;
    this.res = opts.res ?? (Math.max(this.W, this.H) > 96 ? 3 : 5);
    this.seed = opts.seed ?? 1;
    this.group = new THREE.Group();
    this.heights = null; // Float32Array of vertex heights
    this.vw = this.W * this.res + 1;
    this.vh = this.H * this.res + 1;
    this._createTextures();
    this._build();
  }

  _createTextures() {
    const W = this.W;
    const H = this.H;
    this.spiceData = new Uint8Array(W * H * 4);
    this.spiceTex = new THREE.DataTexture(this.spiceData, W, H, THREE.RGBAFormat);
    this.spiceTex.magFilter = THREE.LinearFilter;
    this.spiceTex.minFilter = THREE.LinearFilter;
    this.spiceTex.needsUpdate = true;

    this.fogData = new Uint8Array(W * H * 4);
    this.fogTex = new THREE.DataTexture(this.fogData, W, H, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.minFilter = THREE.LinearFilter;
    this.fogTex.needsUpdate = true;
  }

  tileStyle(x, y) {
    x = clamp(x, 0, this.W - 1);
    y = clamp(y, 0, this.H - 1);
    return TYPE_STYLE[this.map.getType(x, y)] || TYPE_STYLE[T.SAND];
  }

  // Compute vertex height and color at vertex (i,j) in vertex grid
  _vertex(i, j, outColor, outMat) {
    const res = this.res;
    const wx = i / res; // world tile coords
    const wy = j / res;
    // bilinear blending between tile centers, sharpened; domain-warped so tile edges look organic
    const warpX = (valueNoise(wx * 1.7, wy * 1.7, this.seed + 77) - 0.5) * 0.6;
    const warpY = (valueNoise(wx * 1.7 + 31.7, wy * 1.7 - 11.3, this.seed + 78) - 0.5) * 0.6;
    const fx = wx - 0.5 + warpX;
    const fy = wy - 0.5 + warpY;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    let u = fx - x0;
    let v = fy - y0;
    u = smoothstep(0.18, 0.82, u);
    v = smoothstep(0.18, 0.82, v);
    const s00 = this.tileStyle(x0, y0);
    const s10 = this.tileStyle(x0 + 1, y0);
    const s01 = this.tileStyle(x0, y0 + 1);
    const s11 = this.tileStyle(x0 + 1, y0 + 1);
    const w00 = (1 - u) * (1 - v);
    const w10 = u * (1 - v);
    const w01 = (1 - u) * v;
    const w11 = u * v;
    const base = s00.h * w00 + s10.h * w10 + s01.h * w01 + s11.h * w11;
    const amp = s00.amp * w00 + s10.amp * w10 + s01.amp * w01 + s11.amp * w11;

    // mountain: ridged noise; dunes: elongated waves; others: gentle noise
    const mountainW =
      (s00 === TYPE_STYLE[T.MOUNTAIN] ? w00 : 0) +
      (s10 === TYPE_STYLE[T.MOUNTAIN] ? w10 : 0) +
      (s01 === TYPE_STYLE[T.MOUNTAIN] ? w01 : 0) +
      (s11 === TYPE_STYLE[T.MOUNTAIN] ? w11 : 0);
    const duneW =
      (s00 === TYPE_STYLE[T.DUNES] ? w00 : 0) +
      (s10 === TYPE_STYLE[T.DUNES] ? w10 : 0) +
      (s01 === TYPE_STYLE[T.DUNES] ? w01 : 0) +
      (s11 === TYPE_STYLE[T.DUNES] ? w11 : 0);

    const n = fbm(wx * 0.9, wy * 0.9, 4, this.seed);
    const ridge = 1 - Math.abs(fbm(wx * 0.55 + 13.1, wy * 0.55 - 7.3, 5, this.seed + 3) * 2 - 1);
    const warpD = fbm(wx * 0.18, wy * 0.18, 3, this.seed + 9);
    const duneWave = Math.pow(0.5 + 0.5 * Math.sin(wx * 0.62 + wy * 0.28 + warpD * 9.0), 1.6) * (0.55 + 0.45 * fbm(wx * 0.4 + 3, wy * 0.4, 2, this.seed + 11));

    let h = base;
    h += amp * (1 - mountainW - duneW) * (n - 0.5) * 2;
    h += mountainW * (ridge * ridge * 1.25 + n * 0.35);
    h += duneW * duneWave * 0.32;

    if (outMat) {
      const rockStyle = (st) => (st === TYPE_STYLE[T.ROCK] || st === TYPE_STYLE[T.SLAB] ? 1 : 0);
      outMat[0] = rockStyle(s00) * w00 + rockStyle(s10) * w10 + rockStyle(s01) * w01 + rockStyle(s11) * w11;
      outMat[1] = duneW;
      outMat[2] = mountainW;
    }
    if (outColor) {
      let r = s00.color[0] * w00 + s10.color[0] * w10 + s01.color[0] * w01 + s11.color[0] * w11;
      let g = s00.color[1] * w00 + s10.color[1] * w10 + s01.color[1] * w01 + s11.color[1] * w11;
      let b = s00.color[2] * w00 + s10.color[2] * w10 + s01.color[2] * w01 + s11.color[2] * w11;
      const shade = 0.88 + 0.24 * fbm(wx * 2.3 + 5, wy * 2.3 + 5, 3, this.seed + 21);
      const hiTint = mountainW * clamp(ridge, 0, 1) * 0.12;
      r = r * shade + hiTint;
      g = g * shade + hiTint * 0.7;
      b = b * shade + hiTint * 0.5;
      outColor[0] = r;
      outColor[1] = g;
      outColor[2] = b;
    }
    return h;
  }

  _build() {
    const { vw, vh, res } = this;
    const count = vw * vh;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const mats = new Float32Array(count * 3);
    this.heights = new Float32Array(count);
    const col = [0, 0, 0];
    const mt = [0, 0, 0];
    for (let j = 0; j < vh; j++) {
      for (let i = 0; i < vw; i++) {
        const idx = j * vw + i;
        const h = this._vertex(i, j, col, mt);
        mats[idx * 3] = mt[0];
        mats[idx * 3 + 1] = mt[1];
        mats[idx * 3 + 2] = mt[2];
        this.heights[idx] = h;
        positions[idx * 3] = i / res;
        positions[idx * 3 + 1] = h;
        positions[idx * 3 + 2] = j / res;
        colors[idx * 3] = col[0];
        colors[idx * 3 + 1] = col[1];
        colors[idx * 3 + 2] = col[2];
      }
    }
    const indices = new Uint32Array((vw - 1) * (vh - 1) * 6);
    let k = 0;
    for (let j = 0; j < vh - 1; j++) {
      for (let i = 0; i < vw - 1; i++) {
        const a = j * vw + i;
        const b = a + 1;
        const c = a + vw;
        const d = c + 1;
        // alternate diagonal for nicer shading
        if ((i + j) & 1) {
          indices[k++] = a; indices[k++] = c; indices[k++] = b;
          indices[k++] = b; indices[k++] = c; indices[k++] = d;
        } else {
          indices[k++] = a; indices[k++] = c; indices[k++] = d;
          indices[k++] = a; indices[k++] = d; indices[k++] = b;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aMat', new THREE.BufferAttribute(mats, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    this.geometry = geo;

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.uniforms = {
      uSpice: { value: this.spiceTex },
      uFog: { value: this.fogTex },
      uMapSize: { value: new THREE.Vector2(this.W, this.H) },
      uTime: { value: 0 },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vMat;\nvarying vec3 vWN;\nattribute vec3 aMat;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvMat = aMat;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWPos;
          varying vec3 vMat;
          varying vec3 vWN;
          uniform sampler2D uSpice;
          uniform sampler2D uFog;
          uniform vec2 uMapSize;
          uniform float uTime;
          float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
          float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
          float fbm2(vec2 p){ float s=0.0; float a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
          float ripple(vec2 p){ float w = fbm2(p*0.5)*7.0; return sin(dot(p, vec2(9.5, 4.1)) + w) * (0.6 + 0.4 * vnoise(p * 0.8)); }
          `
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            float rockness = clamp(vMat.x + vMat.z, 0.0, 1.0);
            float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
            float cliff = smoothstep(0.18, 0.45, slope);
            // layered sandstone on cliffs
            float strata = 0.5 + 0.5 * sin(vWPos.y * 38.0 + fbm2(vWPos.xz * 1.3) * 6.0);
            vec3 cliffCol = mix(vec3(0.17, 0.11, 0.08), vec3(0.36, 0.24, 0.16), strata);
            diffuseColor.rgb = mix(diffuseColor.rgb, cliffCol, cliff * 0.85);
            // rock surface: cracks and lichen-like darkening
            float crack = 1.0 - smoothstep(0.0, 0.06, abs(vnoise(vWPos.xz * 2.2) - 0.5));
            float rn = fbm2(vWPos.xz * 4.5);
            diffuseColor.rgb *= mix(1.0, (0.8 + 0.35 * rn) * (1.0 - crack * 0.35), rockness);
            // sand grain speckle
            float sg = vnoise(vWPos.xz * 46.0);
            diffuseColor.rgb *= mix(1.0, 0.93 + 0.12 * sg, 1.0 - rockness);
            // wind-swept lighter crests on dunes
            diffuseColor.rgb += vec3(0.08, 0.06, 0.03) * vMat.y * smoothstep(0.2, 0.45, vWPos.y);
          }
          {
            vec2 uv = vWPos.xz / uMapSize;
            vec4 sp = texture2D(uSpice, uv);
            float grain = fbm2(vWPos.xz * 7.0);
            float spiceAmt = sp.r;
            float spiceMask = smoothstep(0.12, 0.45, spiceAmt + (grain - 0.5) * 0.5);
            vec3 spiceCol = mix(vec3(0.62, 0.2, 0.06), vec3(0.36, 0.08, 0.03), smoothstep(0.5, 0.95, spiceAmt));
            spiceCol *= 0.8 + grain * 0.4;
            // sparkle of melange grains
            float sp2 = step(0.985, h21(floor(vWPos.xz * 22.0)));
            spiceCol += vec3(0.5, 0.25, 0.08) * sp2 * spiceMask;
            diffuseColor.rgb = mix(diffuseColor.rgb, spiceCol, spiceMask * 0.95);
            // bloom glow marker (green channel)
            float bloomMark = sp.g;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.55, 0.25), bloomMark * 0.6 * (0.6 + 0.4 * sin(uTime * 3.0)));
            // fine detail
            float d = fbm2(vWPos.xz * 3.1);
            diffuseColor.rgb *= 0.9 + 0.2 * d;
            // concrete tint (blue channel = slab)
            float slab = sp.b;
            vec2 cell = fract(vWPos.xz);
            float seam = smoothstep(0.0, 0.05, cell.x) * smoothstep(0.0, 0.05, cell.y) * smoothstep(1.0, 0.95, cell.x) * smoothstep(1.0, 0.95, cell.y);
            vec3 slabCol = vec3(0.56, 0.54, 0.5) * (0.82 + 0.18 * seam) * (0.92 + 0.12 * d);
            diffuseColor.rgb = mix(diffuseColor.rgb, slabCol, step(0.5, slab));
            // crater / scorch (alpha channel = damage)
            float dmg = 1.0 - sp.a;
            diffuseColor.rgb *= 1.0 - dmg * 0.55 * (0.6 + 0.4 * grain);
          }`
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
          {
            // sand ripples: perturb normal in view space
            vec2 p = vWPos.xz;
            float e = 0.03;
            float r0 = ripple(p);
            float rx = ripple(p + vec2(e, 0.0));
            float rz = ripple(p + vec2(0.0, e));
            float rockness = clamp(vMat.x + vMat.z, 0.0, 1.0);
            float sandness = 1.0 - rockness;
            vec3 g = vec3(-(rx - r0) / e, 0.0, -(rz - r0) / e) * 0.03 * sandness;
            // rocky bumps
            float b0 = fbm2(p * 3.0);
            float bx = fbm2((p + vec2(e, 0.0)) * 3.0);
            float bz = fbm2((p + vec2(0.0, e)) * 3.0);
            g += vec3(-(bx - b0) / e, 0.0, -(bz - b0) / e) * (0.35 * vMat.x + 0.6 * vMat.z);
            normal = normalize(normal + (viewMatrix * vec4(g, 0.0)).xyz);
          }`
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          {
            vec2 uv = vWPos.xz / uMapSize;
            vec4 f = texture2D(uFog, uv);
            float n = fbm2(vWPos.xz * 1.7 + uTime * 0.05);
            float explored = smoothstep(0.25, 0.75, f.r + (n - 0.5) * 0.35);
            float visible = smoothstep(0.25, 0.75, f.g + (n - 0.5) * 0.25);
            float k = explored * mix(0.55, 1.0, visible);
            gl_FragColor.rgb *= k;
          }`
        );
    };
    mat.customProgramCacheKey = () => 'dune-terrain-v2';
    this.material = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    this.mesh = mesh;
    this.group.add(mesh);

    // Skirt around the map so edges do not look like paper
    this._buildSkirt();
  }

  _buildSkirt() {
    const W = this.W;
    const H = this.H;
    const geo = new THREE.PlaneGeometry(W * 6, H * 6, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 });
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(W / 2, -0.4, H / 2);
    plane.receiveShadow = false;
    this.group.add(plane);
  }

  // Bilinear height sample in world tile coordinates (x east, z south)
  heightAt(x, z) {
    const res = this.res;
    const fx = clamp(x * res, 0, this.vw - 1.001);
    const fz = clamp(z * res, 0, this.vh - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const vw = this.vw;
    const h00 = this.heights[j * vw + i];
    const h10 = this.heights[j * vw + i + 1];
    const h01 = this.heights[(j + 1) * vw + i];
    const h11 = this.heights[(j + 1) * vw + i + 1];
    return lerp(lerp(h00, h10, u), lerp(h01, h11, u), v);
  }

  // Rebuild vertices in rectangular tile region (after terrain type change)
  rebuildRegion(tx0, ty0, tx1, ty1) {
    const res = this.res;
    const i0 = Math.max(0, (tx0 - 1) * res);
    const j0 = Math.max(0, (ty0 - 1) * res);
    const i1 = Math.min(this.vw - 1, (tx1 + 2) * res);
    const j1 = Math.min(this.vh - 1, (ty1 + 2) * res);
    const pos = this.geometry.attributes.position.array;
    const colAttr = this.geometry.attributes.color.array;
    const matAttr = this.geometry.attributes.aMat.array;
    const col = [0, 0, 0];
    const mt = [0, 0, 0];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const idx = j * this.vw + i;
        const h = this._vertex(i, j, col, mt);
        matAttr[idx * 3] = mt[0];
        matAttr[idx * 3 + 1] = mt[1];
        matAttr[idx * 3 + 2] = mt[2];
        this.heights[idx] = h;
        pos[idx * 3 + 1] = h;
        colAttr[idx * 3] = col[0];
        colAttr[idx * 3 + 1] = col[1];
        colAttr[idx * 3 + 2] = col[2];
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.aMat.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  // Pull per-tile overlay data (spice amount, slabs, damage, blooms) from map
  updateOverlay() {
    const map = this.map;
    const d = this.spiceData;
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const i = y * this.W + x;
        const t = map.getType(x, y);
        let s = 0;
        if (t === T.SPICE || t === T.THICK_SPICE) {
          s = clamp(map.spice[i] / 500, 0, 1);
          if (t === T.THICK_SPICE) s = Math.max(s, 0.75);
          else s = Math.min(Math.max(s, 0.3), 0.7);
        }
        // texture rows: DataTexture row 0 = v 0 => z=0 at map top. matches uv = xz/size.
        d[i * 4] = Math.round(s * 255);
        d[i * 4 + 1] = t === T.SPICE_BLOOM || t === T.SPECIAL_BLOOM ? 255 : 0;
        d[i * 4 + 2] = t === T.SLAB ? 255 : 0;
        d[i * 4 + 3] = 255 - Math.min(255, (map.damage ? map.damage[i] : 0) * 60);
      }
    }
    this.spiceTex.needsUpdate = true;
  }

  // fog: explored(Uint8 0/1) and visible(Uint8 0/1) arrays
  updateFog(explored, visible) {
    const d = this.fogData;
    const n = this.W * this.H;
    for (let i = 0; i < n; i++) {
      d[i * 4] = explored[i] ? 255 : 0;
      d[i * 4 + 1] = visible ? (visible[i] ? 255 : 0) : 255;
    }
    this.fogTex.needsUpdate = true;
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.spiceTex.dispose();
    this.fogTex.dispose();
  }
}

// Cosmetic helper to sample noise for decoration placement
export function decoNoise(x, y, seed) {
  return valueNoise(x * 0.7, y * 0.7, seed);
}
