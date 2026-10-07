import * as THREE from 'three';
import { HOUSE_COLORS } from '../core/constants.js';
import { Random } from '../core/random.js';

// Animated planet Arrakis: used as main-menu backdrop and the campaign territory map.
// Regions are spherical Voronoi cells around seed points placed on the globe.

const PLANET_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vWN;
  void main(){
    vN = normalize(normalMatrix * normal);
    vP = position;
    vWN = normalize((modelMatrix * vec4(normal,0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform int uRegionCount;
  uniform vec3 uSeeds[40];
  uniform vec3 uOwnerColor[40];
  uniform float uOwnerAlpha[40];
  uniform float uHover;
  uniform float uSelectable[40];
  uniform float uShowRegions;
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vWN;

  vec3 hash3(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    float n = mix(mix(mix(hash3(i).x, hash3(i+vec3(1,0,0)).x, f.x), mix(hash3(i+vec3(0,1,0)).x, hash3(i+vec3(1,1,0)).x, f.x), f.y),
                  mix(mix(hash3(i+vec3(0,0,1)).x, hash3(i+vec3(1,0,1)).x, f.x), mix(hash3(i+vec3(0,1,1)).x, hash3(i+vec3(1,1,1)).x, f.x), f.y), f.z);
    return n;
  }
  float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*noise(p); p*=2.07; a*=0.5; } return s; }

  void main(){
    vec3 p = normalize(vP);
    float n = fbm(p * 3.2);
    float m = fbm(p * 9.0 + 7.0);
    float ridges = 1.0 - abs(fbm(p * 5.0 + 3.0) * 2.0 - 1.0);
    vec3 sand = mix(vec3(0.82, 0.55, 0.3), vec3(0.95, 0.72, 0.45), n);
    vec3 rock = mix(vec3(0.36, 0.24, 0.17), vec3(0.5, 0.36, 0.26), m);
    float rockMask = smoothstep(0.52, 0.62, n + ridges * 0.18);
    vec3 col = mix(sand, rock, rockMask);
    // dune bands
    col *= 0.96 + 0.04 * sin(p.y * 60.0 + n * 30.0 + m * 10.0);
    // polar caps lighter
    col = mix(col, vec3(0.9, 0.85, 0.78), smoothstep(0.88, 0.97, abs(p.y)) * 0.6);

    // regions
    if (uShowRegions > 0.5) {
      float d1 = 10.0, d2 = 10.0; int best = 0;
      for (int i = 0; i < 40; i++) {
        if (i >= uRegionCount) break;
        float d = 1.0 - dot(p, uSeeds[i]);
        if (d < d1) { d2 = d1; d1 = d; best = i; }
        else if (d < d2) { d2 = d; }
      }
      vec3 oc = vec3(0.0); float oa = 0.0; float sel = 0.0;
      for (int i = 0; i < 40; i++) {
        if (i == best) { oc = uOwnerColor[i]; oa = uOwnerAlpha[i]; sel = uSelectable[i]; }
      }
      float edge = smoothstep(0.0, 0.004, d2 - d1);
      col = mix(col, oc, oa * 0.55);
      if (sel > 0.5) {
        float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
        col = mix(col, vec3(1.0, 0.85, 0.5), 0.18 + 0.12 * pulse);
      }
      if (abs(float(best) - uHover) < 0.5) col = mix(col, vec3(1.0, 0.95, 0.8), 0.28);
      col = mix(vec3(0.12, 0.08, 0.05), col, mix(1.0, edge, 0.85));
    }

    float diff = max(dot(vWN, uSunDir), 0.0);
    float wrap = smoothstep(-0.25, 0.6, dot(vWN, uSunDir));
    vec3 lit = col * (0.06 + 1.15 * diff * wrap);
    // night side city lights? Arrakis: faint
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWN;
  void main(){
    vN = normalize(normalMatrix * normal);
    vWN = normalize((modelMatrix * vec4(normal,0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;
const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vN;
  varying vec3 vWN;
  void main(){
    float rim = pow(1.0 - abs(vN.z), 3.0);
    float sun = smoothstep(-0.3, 0.6, dot(vWN, uSunDir));
    vec3 c = vec3(1.0, 0.62, 0.32) * rim * (0.25 + 1.3 * sun);
    gl_FragColor = vec4(c, rim * (0.3 + sun));
  }
`;

export class PlanetView {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050302);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    this.camera.position.set(0, 0, 9);
    this.sunDir = new THREE.Vector3(-0.6, 0.35, 0.72).normalize();
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.uniforms = {
      uSunDir: { value: this.sunDir },
      uTime: { value: 0 },
      uRegionCount: { value: 0 },
      uSeeds: { value: Array.from({ length: 40 }, () => new THREE.Vector3(0, 1, 0)) },
      uOwnerColor: { value: Array.from({ length: 40 }, () => new THREE.Color(0, 0, 0)) },
      uOwnerAlpha: { value: new Array(40).fill(0) },
      uSelectable: { value: new Array(40).fill(0) },
      uHover: { value: -1 },
      uShowRegions: { value: 0 },
    };
    const planetMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(2.4, 128, 96), planetMat);
    this.group.add(this.planet);

    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: this.sunDir } },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(2.62, 64, 48), atmoMat);
    this.scene.add(this.atmo);

    // moons
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xb8aea0, roughness: 1 });
    this.moon1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), moonMat);
    this.moon2 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), moonMat);
    this.scene.add(this.moon1, this.moon2);
    const light = new THREE.DirectionalLight(0xfff0dd, 2.2);
    light.position.copy(this.sunDir).multiplyScalar(10);
    this.scene.add(light, new THREE.AmbientLight(0x221510, 0.6));

    // stars
    const rng = new Random(42);
    const starPos = new Float32Array(2500 * 3);
    for (let i = 0; i < 2500; i++) {
      const v = new THREE.Vector3(rng.rand() * 2 - 1, rng.rand() * 2 - 1, rng.rand() * 2 - 1).normalize().multiplyScalar(80 + rng.rand() * 20);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff4e0, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
    this.scene.add(this.stars);

    this.regions = [];
    this.spin = true;
    this.targetQuat = null;
    this.offsetX = 0;
    this._ray = new THREE.Raycaster();
    this.time = 0;
  }

  // regions: [{ id, dir: [x,y,z], owner: houseIndex|-1, selectable: bool }]
  setRegions(regions) {
    this.regions = regions;
    const u = this.uniforms;
    u.uRegionCount.value = regions.length;
    regions.forEach((r, i) => {
      u.uSeeds.value[i].set(...r.dir).normalize();
      if (r.owner >= 0) {
        u.uOwnerColor.value[i].setHex(HOUSE_COLORS[r.owner]);
        u.uOwnerAlpha.value[i] = 1;
      } else {
        u.uOwnerColor.value[i].setRGB(0, 0, 0);
        u.uOwnerAlpha.value[i] = 0;
      }
      u.uSelectable.value[i] = r.selectable ? 1 : 0;
    });
    u.uShowRegions.value = regions.length ? 1 : 0;
  }

  showRegions(v) {
    this.uniforms.uShowRegions.value = v ? 1 : 0;
  }

  // rotate globe so that the given direction faces the camera
  focus(dir) {
    const from = new THREE.Vector3(...dir).normalize();
    const to = new THREE.Vector3(0, 0.25, 1).normalize();
    this.targetQuat = new THREE.Quaternion().setFromUnitVectors(from, to);
    this.spin = false;
  }

  setAspect(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  pick(ndcX, ndcY) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this._ray.intersectObject(this.planet)[0];
    if (!hit) return -1;
    const local = this.planet.worldToLocal(hit.point.clone()).normalize();
    let best = -1;
    let bd = -2;
    this.regions.forEach((r, i) => {
      const d = local.dot(this.uniforms.uSeeds.value[i]);
      if (d > bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  setHover(i) {
    this.uniforms.uHover.value = i;
  }

  update(dt) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (this.spin) this.group.rotation.y += dt * 0.05;
    else if (this.targetQuat) this.group.quaternion.slerp(this.targetQuat, Math.min(1, dt * 2.5));
    this.group.position.x += (this.offsetX - this.group.position.x) * Math.min(1, dt * 3);
    this.atmo.position.copy(this.group.position);
    const t = this.time;
    this.moon1.position.set(this.group.position.x + Math.cos(t * 0.11) * 5.2, 1.2 + Math.sin(t * 0.07) * 0.5, Math.sin(t * 0.11) * 5.2 - 2);
    this.moon2.position.set(this.group.position.x + Math.cos(t * 0.17 + 2) * 4.0, -0.8, Math.sin(t * 0.17 + 2) * 4.0 - 1);
    this.stars.rotation.y = t * 0.003;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
