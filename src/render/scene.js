import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Color grading + vignette + heat haze tint
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uWarmth: { value: 0.06 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uWarmth;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // warm desert grade
      c.rgb = mix(c.rgb, c.rgb * vec3(1.06, 0.98, 0.88), uWarmth * 4.0);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.08);
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.2;
      c.rgb *= clamp(v, 0.0, 1.0);
      gl_FragColor = c;
    }
  `,
};

export class SceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._buildScene();
    this.quality = 'high';
    this.composer = null;
    this.camera = null;
  }

  // fresh scene with lights (called for every new game)
  resetScene() {
    this._buildScene();
    if (this.renderPass) this.renderPass.scene = this.scene;
    return this.scene;
  }

  _buildScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd9a66b);
    this.scene.fog = new THREE.Fog(0xcf9a62, 45, 140);

    // Lights
    this.hemi = new THREE.HemisphereLight(0xffe2b8, 0x6a3f22, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    const sc = this.sun.shadow.camera;
    sc.near = 1;
    sc.far = 120;
    sc.left = -30;
    sc.right = 30;
    sc.top = 30;
    sc.bottom = -30;
    this.sunOffset = new THREE.Vector3(-30, 30, -20);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
    this.fill.position.set(30, 20, 40);
    this.scene.add(this.fill);
    if (this.quality) this.sun.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
  }

  setCamera(camera) {
    this.camera = camera;
    if (this.composer && this.renderPass) {
      this.renderPass.camera = camera;
      this.renderPass.scene = this.scene;
      return;
    }
    this._setupComposer();
  }

  _setupComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      type: THREE.HalfFloatType,
      samples: this.quality === 'low' ? 0 : 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.45, 0.95);
    this.bloom.enabled = this.quality !== 'low';
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
    if (this.camera) this._setupComposer();
    this.resize(this.width || window.innerWidth, this.height || window.innerHeight);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  // Keep sun shadow frustum centered on view target
  followTarget(target, distance) {
    const ext = Math.min(60, 10 + distance * 1.1);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - ext) > 0.5) {
      sc.left = -ext;
      sc.right = ext;
      sc.top = ext;
      sc.bottom = -ext;
      sc.updateProjectionMatrix();
    }
    // snap to texel grid to avoid shimmering
    const texel = (ext * 2) / this.sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx + this.sunOffset.x, this.sunOffset.y, tz + this.sunOffset.z);
    this.sun.target.updateMatrixWorld();
  }

  render(time) {
    this.grade.uniforms.uTime.value = time;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
