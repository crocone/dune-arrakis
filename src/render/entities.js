import * as THREE from 'three';
import { TILESIZE, HOUSE_COLORS } from '../core/constants.js';
import { createModel, getMaterial } from './models.js';
import { B } from '../game/bullets.js';
import { fxRandom as R } from '../core/random.js';

const AIR_ALT = { carryall: 1.7, ornithopter: 1.35, frigate: 3.2 };
const INFANTRY_SCALE = 1.7;
const VEHICLE_SCALE = 1.2;

function makeBar() {
  const g = new THREE.Group();
  const bgMat = new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
  const fgMat = new THREE.SpriteMaterial({ color: 0x40ff40, depthTest: false });
  const bg = new THREE.Sprite(bgMat);
  const fg = new THREE.Sprite(fgMat);
  bg.center.set(0, 0.5);
  fg.center.set(0, 0.5);
  bg.renderOrder = 30;
  fg.renderOrder = 31;
  g.add(bg, fg);
  g.userData = { bg, fg };
  return g;
}

function setBar(bar, frac, width, color) {
  const { bg, fg } = bar.userData;
  bg.scale.set(width + 0.04, 0.09, 1);
  bg.position.x = -width / 2 - 0.02;
  fg.scale.set(Math.max(0.001, width * frac), 0.06, 1);
  fg.position.x = -width / 2;
  fg.material.color.setHex(color);
}

function healthColor(f) {
  return f >= 0.5 ? 0x46e04a : f >= 0.25 ? 0xf0c030 : 0xf03a2a;
}

export class EntityRenderer {
  constructor(scene, terrain, effects, game) {
    this.scene = scene;
    this.terrain = terrain;
    this.effects = effects;
    this.game = game;
    this.views = new Map();
    this.bulletViews = new Map();
    this.root = new THREE.Group();
    this.root.name = 'entities';
    scene.add(this.root);
    this.ringGeo = new THREE.RingGeometry(0.36, 0.42, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x7dff7d, transparent: true, opacity: 0.85, depthWrite: false });
    this.enemyRingMat = new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.85, depthWrite: false });
    this.shadowGeo = new THREE.CircleGeometry(0.4, 20);
    this.shadowGeo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.bulletGeo = {
      bullet: new THREE.SphereGeometry(0.03, 6, 4),
      shell: new THREE.CapsuleGeometry(0.035, 0.12, 4, 6),
      rocket: new THREE.ConeGeometry(0.045, 0.2, 6),
      bigRocket: new THREE.ConeGeometry(0.16, 0.7, 10),
    };
    this.bulletGeo.shell.rotateZ(Math.PI / 2);
    this.bulletGeo.rocket.rotateZ(-Math.PI / 2);
    this.bulletGeo.bigRocket.rotateZ(-Math.PI / 2);
    this.bulletMat = {
      bullet: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.5) }),
      shell: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3, 1.2) }),
      rocket: new THREE.MeshStandardMaterial({ color: 0xe0d8c8, emissive: 0x552200, metalness: 0.4, roughness: 0.4 }),
      gasRocket: new THREE.MeshStandardMaterial({ color: 0x8cff70, emissive: 0x2a8a10, emissiveIntensity: 1.5 }),
      bigRocket: new THREE.MeshStandardMaterial({ color: 0xd2c8b8, emissive: 0x401000, metalness: 0.5, roughness: 0.35 }),
    };
    this.wormSegGeo = new THREE.SphereGeometry(0.42, 14, 10);
    this.player = game.player;
    this.time = 0;
    this.showAllHealth = false;
    this.hovered = null;
  }

  dispose() {
    this.scene.remove(this.root);
    this.views.clear();
  }

  heightAt(x, z) {
    return this.terrain.heightAt(x, z);
  }

  // is an object visible for the local player (fog/shroud rules)
  isShown(o) {
    const g = this.game;
    const team = g.teamOf(this.player);
    if (o.hidden) return false;
    if (o.isStructure) return o.team === team || o.isExploredBy(team);
    if (o.team === team) return true;
    if (o.cloaked && !o.isVisibleTo(team)) return false;
    if (o.type === 'sandworm') return g.isTileVisibleToTeam(team, o.x, o.y);
    if (o.isAir) return g.isTileVisibleToTeam(team, o.x, o.y) || g.map.inBounds(o.x, o.y) === false;
    return g.isTileVisibleToTeam(team, o.x, o.y);
  }

  createView(o) {
    let view;
    if (o.isStructure) {
      const { root, parts } = createModel('structure', o.type, o.owner);
      view = { obj: o, root, parts, owner: o.owner };
      if (o.type === 'wall') {
        view.wallPieces = {};
        view.wallKey = '';
      }
    } else if (o.type === 'sandworm') {
      view = this.createWormView(o);
    } else {
      const modelName = o.fremen ? 'fremen' : o.type;
      const { root, parts } = createModel('unit', modelName, o.owner);
      if (o.isInfantry) root.scale.setScalar(INFANTRY_SCALE);
      else if (o.type !== 'frigate') root.scale.setScalar(VEHICLE_SCALE);
      view = { obj: o, root, parts, owner: o.owner };
      if (o.isAir) {
        const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
        sh.scale.setScalar(o.type === 'frigate' ? 3 : o.type === 'carryall' ? 1.4 : 1);
        this.root.add(sh);
        view.shadow = sh;
      }
    }
    view.bar = makeBar();
    view.bar.visible = false;
    this.root.add(view.bar);
    this.root.add(view.root);
    this.views.set(o.id, view);
    return view;
  }

  createWormView(o) {
    const root = new THREE.Group();
    const mat = getMaterial('worm', 0);
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(this.wormSegGeo, mat);
      m.scale.set(1 - i * 0.08, 0.6 - i * 0.04, 1 - i * 0.08);
      m.castShadow = true;
      root.add(m);
      segs.push(m);
    }
    const head = createModel('unit', 'sandworm', 0);
    head.root.scale.setScalar(1.6);
    root.add(head.root);
    return { obj: o, root, parts: {}, segs, head: head.root, owner: o.owner, rise: 0, trailPos: [] };
  }

  removeView(id) {
    const v = this.views.get(id);
    if (!v) return;
    this.root.remove(v.root);
    this.root.remove(v.bar);
    if (v.shadow) this.root.remove(v.shadow);
    if (v.ring) this.root.remove(v.ring);
    if (v.wallPieces) for (const p of Object.values(v.wallPieces)) this.root.remove(p);
    this.views.delete(id);
  }

  // rebuild model when ownership changes (deviation / capture)
  refreshOwner(v) {
    const o = v.obj;
    this.removeView(o.id);
    return this.createView(o);
  }

  update(dt, alpha, camera, selection) {
    this.time += dt;
    const g = this.game;
    const seen = new Set();
    const all = [g.structures, g.units];
    for (const list of all) {
      for (const o of list) {
        if (!o.alive) continue;
        seen.add(o.id);
        let v = this.views.get(o.id);
        if (!v) v = this.createView(o);
        else if (v.owner !== o.owner || (o.fremen && !v.fremen && false)) v = this.refreshOwner(v);
        const shown = this.isShown(o);
        v.root.visible = shown;
        if (v.shadow) v.shadow.visible = shown;
        if (!shown) {
          v.bar.visible = false;
          if (v.ring) v.ring.visible = false;
          continue;
        }
        if (o.isStructure) this.updateStructure(v, o, dt);
        else if (o.type === 'sandworm') this.updateWorm(v, o, dt, alpha);
        else this.updateUnit(v, o, dt, alpha);
        // selection ring & health bar
        const sel = selection.has(o);
        const hov = this.hovered === o;
        const frac = o.health / o.maxHealth;
        const showBar = sel || hov || (this.showAllHealth && frac < 1);
        v.bar.visible = showBar;
        if (showBar) {
          const w = o.isStructure ? o.w * 0.8 : o.isInfantry ? 0.3 : 0.6;
          setBar(v.bar, frac, w, healthColor(frac));
          const p = v.root.position;
          if (o.isStructure) v.bar.position.set(o.x + o.w / 2, p.y + 1.25, o.y + o.h / 2 - 0.1);
          else v.bar.position.set(p.x, p.y + (o.isInfantry ? 0.45 : 0.6), p.z);
        }
        if (sel) {
          if (!v.ring) {
            v.ring = new THREE.Mesh(this.ringGeo, o.owner === this.player ? this.ringMat : this.enemyRingMat);
            v.ring.renderOrder = 5;
            this.root.add(v.ring);
          }
          v.ring.visible = true;
          if (o.isStructure) {
            v.ring.scale.set(o.w * 1.25, 1, o.h * 1.25);
            v.ring.position.set(o.x + o.w / 2, v.root.position.y + 0.08, o.y + o.h / 2);
          } else {
            const s = o.isInfantry ? 0.5 : o.type === 'frigate' ? 3 : o.type === 'harvester' || o.type === 'mcv' || o.type === 'devastator' ? 1.35 : 1;
            v.ring.scale.set(s, 1, s);
            const gy = o.isAir ? this.heightAt(v.root.position.x, v.root.position.z) : v.root.position.y;
            v.ring.position.set(v.root.position.x, gy + 0.04, v.root.position.z);
          }
        } else if (v.ring) v.ring.visible = false;
      }
    }
    for (const id of [...this.views.keys()]) if (!seen.has(id)) this.removeView(id);
    this.updateBullets(alpha);
  }

  updateStructure(v, o, dt) {
    const cx = o.x + o.w / 2;
    const cz = o.y + o.h / 2;
    const y = this.heightAt(cx, cz);
    v.root.position.set(o.x, y, o.y);
    // construction rise animation
    if (o.justPlacedTimer > 0) {
      const t = 1 - o.justPlacedTimer / 80;
      v.root.scale.set(1, 0.2 + 0.8 * t, 1);
    } else v.root.scale.set(1, 1, 1);
    const p = v.parts;
    if (p.rotor) p.rotor.rotation.y += dt * 2.5 * (o.health / o.maxHealth);
    if (p.dish) {
      const house = this.game.houses[o.owner];
      if (house && house.hasPower()) p.dish.rotation.y += dt * 1.2;
    }
    if (p.beacon) p.beacon.rotation.y += dt * 3.5;
    if (p.orb) {
      p.orb.rotation.y += dt * 0.8;
      p.orb.position.y = 1.05 + Math.sin(this.time * 2) * 0.05;
    }
    if (p.crane) p.crane.rotation.y = Math.sin(this.time * 0.3 + o.id) * 0.8;
    if (p.turret && o.angle !== undefined) {
      p.turret.rotation.y = smoothAngle(p.turret.rotation.y, (o.angle * Math.PI) / 4, dt * 12);
    }
    if (o.type === 'wall') this.updateWall(v, o);
    // damage smoke / fire
    const frac = o.health / o.maxHealth;
    if (frac < 0.5 && R.rand() < dt * (frac < 0.25 ? 10 : 4)) {
      const sx = o.x + 0.3 + R.rand() * (o.w - 0.6);
      const sz = o.y + 0.3 + R.rand() * (o.h - 0.6);
      this.effects.smoke(sx, y + 0.5, sz, 1.2, frac < 0.3);
    }
    if (o.type === 'refinery' && o.extracting && R.rand() < dt * 3) {
      this.effects.smoke(o.x + 0.4 + R.rand() * 1.2, y + 0.9, o.y + 0.45, 0.6, false);
    }
  }

  updateWall(v, o) {
    const g = this.game;
    const map = g.map;
    const isWall = (x, y) => {
      if (!map.inBounds(x, y)) return false;
      const id = map.ground[map.idx(x, y)];
      const w = id ? g.objects.get(id) : null;
      return !!(w && w.type === 'wall');
    };
    const key = `${+isWall(o.x + 1, o.y)}${+isWall(o.x - 1, o.y)}${+isWall(o.x, o.y - 1)}${+isWall(o.x, o.y + 1)}`;
    if (key === v.wallKey) return;
    v.wallKey = key;
    for (const p of Object.values(v.wallPieces)) v.root.remove(p);
    v.wallPieces = {};
    const dirs = ['wallE', 'wallW', 'wallN', 'wallS'];
    for (let i = 0; i < 4; i++) {
      if (key[i] === '1') {
        const m = createModel('structure', dirs[i], o.owner).root;
        v.root.add(m);
        v.wallPieces[dirs[i]] = m;
      }
    }
  }

  updateUnit(v, o, dt, alpha) {
    const x = (o.prevRx + (o.rx - o.prevRx) * alpha) / TILESIZE;
    const z = (o.prevRy + (o.ry - o.prevRy) * alpha) / TILESIZE;
    const ground = this.heightAt(x, z);
    let y = ground;
    const r = v.root;
    if (o.isAir) {
      let alt = AIR_ALT[o.type] || 1.4;
      if (o.type === 'carryall') {
        // descend while picking up / dropping
        const slow = Math.min(1, (o.currentMaxSpeed || 0) / 6);
        alt = 0.9 + 0.8 * slow;
      }
      v.alt = v.alt === undefined ? alt : v.alt + (alt - v.alt) * Math.min(1, dt * 3);
      y = ground + v.alt + Math.sin(this.time * 2 + o.id) * 0.03;
      if (v.shadow) {
        v.shadow.position.set(x + 0.35, ground + 0.03, z + 0.25);
      }
      // banking
      const targetBank = clampN(angleDelta(v.prevAngle ?? o.angle, o.angle) * 25, -0.5, 0.5);
      v.bank = (v.bank || 0) + (targetBank - (v.bank || 0)) * Math.min(1, dt * 4);
      v.prevAngle = o.angle;
      r.rotation.set(0, 0, 0);
      r.rotation.y = (o.angle * Math.PI) / 4;
      r.rotation.x = v.bank;
      if (o.type === 'ornithopter' && v.parts.wingL) {
        const f = Math.sin(this.time * 30 + o.id) * 0.35;
        v.parts.wingL.rotation.x = f;
        v.parts.wingR.rotation.x = -f;
      }
      if ((o.type === 'carryall' || o.type === 'frigate') && R.rand() < dt * 20) {
        const back = o.type === 'frigate' ? 1.0 : 0.4;
        const a = (o.angle * Math.PI) / 4;
        this.effects.thruster(x - Math.cos(a) * back, y, z + Math.sin(a) * back);
      }
      // carried unit hangs below carryall
      if (o.type === 'carryall') this.updateCargo(v, o);
    } else {
      // body orientation: continuous angle in eighths -> radians
      const target = (o.angle * Math.PI) / 4;
      r.rotation.y = target;
      if (o.isInfantry) {
        const walking = o.moving;
        y += walking ? Math.abs(Math.sin(this.time * 14 + o.id)) * 0.025 : 0;
      } else if (o.moving && (o.moveClass === 'wheeled' || o.moveClass === 'tracked')) {
        // slight bumpiness on rock
        const t = this.game.map.isRock(o.x, o.y);
        if (t) y += Math.sin(this.time * 25 + o.id) * 0.012;
        if (R.rand() < dt * (o.moveClass === 'wheeled' ? 18 : 10) && this.game.map.isSand(o.x, o.y)) {
          const a = target;
          this.effects.dust(x - Math.cos(a) * 0.25, ground, z + Math.sin(a) * 0.25, o.type === 'harvester' ? 1.6 : 1);
        }
      }
      // terrain tilt
      const e = 0.25;
      const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
      const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
      const tiltX = clampN(-hz / (2 * e), -0.35, 0.35);
      const tiltZ = clampN(hx / (2 * e), -0.35, 0.35);
      if (!o.isInfantry) {
        r.rotation.x = tiltX * Math.cos(target) * 0 + tiltX;
        r.rotation.z = tiltZ;
        r.rotation.order = 'YXZ';
      }
      if (v.parts.turret && o.turretAngle !== undefined) {
        v.parts.turret.rotation.y = ((o.turretAngle - o.angle) * Math.PI) / 4;
      }
      if (v.parts.drum) {
        if (o.type === 'harvester' && o.isHarvesting && o.isHarvesting()) {
          v.parts.drum.rotation.z -= dt * 8;
          if (R.rand() < dt * 12) this.effects.dust(x + Math.cos(target) * 0.45, ground, z - Math.sin(target) * 0.45, 1.4);
        }
      }
      if (v.parts.cargo && o.type === 'harvester') {
        const f = o.spice / 700;
        v.parts.cargo.visible = f > 0.02;
        v.parts.cargo.scale.y = Math.max(0.05, f);
      }
      // recoil
      if (o.visualFire !== v.lastFire) {
        v.lastFire = o.visualFire;
        v.recoil = 1;
      }
      if (v.recoil > 0) {
        v.recoil = Math.max(0, v.recoil - dt * 6);
        // the barrel (nested in the turret) slides back; fall back to the whole turret
        const rp = v.parts.barrel || v.parts.turret;
        if (rp) rp.position.x = (rp.userData.baseX ??= rp.position.x) - v.recoil * 0.04;
      }
    }
    r.position.set(x, y, z);
    // deviated: green glow pulse
    if (o.deviationTimer > 0 && R.rand() < dt * 6) {
      this.effects.alpha.emit(x + (R.rand() - 0.5) * 0.3, y + 0.35, z + (R.rand() - 0.5) * 0.3, 0, 0.25, 0, 0.8, 0.1, 0.3, [0.45, 0.95, 0.35, 0.55], [0.3, 0.7, 0.2, 0], 0, 1);
    }
    // damage smoke
    const frac = o.health / o.maxHealth;
    if (frac < 0.5 && !o.isInfantry && R.rand() < dt * 5) this.effects.smoke(x, y + (o.isAir ? 0.1 : 0.3), z, 0.6, frac < 0.25);
  }

  updateCargo(v, o) {
    const cargo = o.cargo && o.cargo[0];
    if (cargo && cargo.alive) {
      if (!v.cargoView || v.cargoId !== cargo.id || v.cargoOwner !== cargo.owner) {
        if (v.cargoView) v.root.remove(v.cargoView);
        const m = createModel('unit', cargo.fremen ? 'fremen' : cargo.type, cargo.owner).root;
        if (cargo.isInfantry) m.scale.setScalar(INFANTRY_SCALE / VEHICLE_SCALE);
        m.position.set(0, -0.36, 0);
        v.root.add(m);
        v.cargoView = m;
        v.cargoId = cargo.id;
        v.cargoOwner = cargo.owner;
      }
    } else if (v.cargoView) {
      v.root.remove(v.cargoView);
      v.cargoView = null;
      v.cargoId = null;
    }
  }

  updateWorm(v, o, dt, alpha) {
    const x = (o.prevRx + (o.rx - o.prevRx) * alpha) / TILESIZE;
    const z = (o.prevRy + (o.ry - o.prevRy) * alpha) / TILESIZE;
    const ground = this.heightAt(x, z);
    // trail positions (smooth)
    v.trailPos.unshift([x, z]);
    if (v.trailPos.length > 40) v.trailPos.pop();
    const eating = o.isEating && o.isEating();
    const wantRise = eating ? 1 : 0;
    v.rise += (wantRise - v.rise) * Math.min(1, dt * (eating ? 6 : 2));
    v.root.position.set(0, 0, 0);
    for (let i = 0; i < v.segs.length; i++) {
      const p = v.trailPos[Math.min(v.trailPos.length - 1, i * 5)];
      const s = v.segs[i];
      const sink = o.moving ? -0.28 - i * 0.03 : -0.6;
      s.position.set(p[0], this.heightAt(p[0], p[1]) + sink + v.rise * (0.9 - i * 0.12), p[1]);
      s.visible = true;
    }
    // head rises out of the sand when attacking
    v.head.visible = v.rise > 0.05;
    v.head.position.set(x, ground - 0.6 + v.rise * 1.5, z);
    v.head.rotation.set(0, 0, Math.PI / 2 * v.rise);
    v.head.scale.setScalar(1.6 * Math.max(0.3, v.rise));
    if (o.moving && R.rand() < dt * 12) this.effects.wormTrail(x, ground, z);
    if (eating && !v.burst) {
      v.burst = true;
      this.effects.sandBurst(x, ground, z, 1.1);
    }
    if (!eating) v.burst = false;
    v.bar.visible = false;
  }

  // ---------------------------------------------------------------------------
  updateBullets(alpha) {
    const g = this.game;
    const seen = new Set();
    for (const b of g.bullets) {
      if (!b.alive) continue;
      seen.add(b.id);
      let bv = this.bulletViews.get(b.id);
      if (!bv) {
        bv = this.createBulletView(b);
        this.bulletViews.set(b.id, bv);
      }
      const x = (b.px + (b.x - b.px) * alpha) / TILESIZE;
      const z = (b.py + (b.y - b.py) * alpha) / TILESIZE;
      const team = g.teamOf(this.player);
      const tx = Math.floor(x);
      const tz = Math.floor(z);
      const visible = g.map.inBounds(tx, tz) ? g.isTileVisibleToTeam(team, tx, tz) : true;
      // flight height: interpolate from muzzle to target, with an arc for rockets
      const total = Math.hypot(b.dx - b.sx, b.dy - b.sy) || 1;
      const done = Math.min(1, Math.hypot(b.x - b.sx, b.y - b.sy) / total);
      const h0 = bv.h0;
      const h1 = b.air ? this.heightAt(b.dx / TILESIZE, b.dy / TILESIZE) + 1.4 : this.heightAt(b.dx / TILESIZE, b.dy / TILESIZE) + 0.15;
      let arc = 0;
      if (b.type === B.LARGE_ROCKET) arc = Math.sin(done * Math.PI) * Math.min(8, total / TILESIZE * 0.6);
      else if (b.type === B.ROCKET || b.type === B.DROCKET || b.type === B.SMALL_ROCKET || b.type === B.TURRET_ROCKET) arc = Math.sin(done * Math.PI) * Math.min(1.2, total / TILESIZE * 0.12);
      const y = h0 + (h1 - h0) * done + arc;
      if (bv.mesh) {
        bv.mesh.visible = visible;
        bv.mesh.position.set(x, y, z);
        const ang = Math.atan2(-(b.vy), b.vx);
        bv.mesh.rotation.set(0, ang, 0);
        if (b.type === B.LARGE_ROCKET) bv.mesh.rotation.z = Math.cos(done * Math.PI) * 0.9;
      }
      if (visible) {
        if (b.type === B.ROCKET || b.type === B.TURRET_ROCKET || b.type === B.SMALL_ROCKET || b.type === B.LARGE_ROCKET) {
          this.effects.trail(x, y, z);
          if (b.type === B.LARGE_ROCKET) {
            this.effects.trail(x, y, z);
            this.effects.trail(x, y, z);
          }
        } else if (b.type === B.DROCKET) {
          this.effects.alpha.emit(x, y, z, 0, 0.1, 0, 0.6, 0.08, 0.35, [0.5, 0.9, 0.35, 0.5], [0.4, 0.7, 0.3, 0], 0, 1);
        } else if (b.type === B.SONIC) {
          this.effects.sonicWave(x, y, z);
        }
      }
    }
    for (const [id, bv] of this.bulletViews) {
      if (!seen.has(id)) {
        if (bv.mesh) this.root.remove(bv.mesh);
        this.bulletViews.delete(id);
      }
    }
  }

  createBulletView(b) {
    let geo = null;
    let mat = null;
    switch (b.type) {
      case B.SHELL_SMALL: geo = this.bulletGeo.bullet; mat = this.bulletMat.bullet; break;
      case B.SHELL_MEDIUM:
      case B.SHELL_LARGE:
      case B.SHELL_TURRET: geo = this.bulletGeo.shell; mat = this.bulletMat.shell; break;
      case B.ROCKET:
      case B.TURRET_ROCKET:
      case B.SMALL_ROCKET: geo = this.bulletGeo.rocket; mat = this.bulletMat.rocket; break;
      case B.DROCKET: geo = this.bulletGeo.rocket; mat = this.bulletMat.gasRocket; break;
      case B.LARGE_ROCKET: geo = this.bulletGeo.bigRocket; mat = this.bulletMat.bigRocket; break;
      default: break;
    }
    const sx = b.sx / TILESIZE;
    const sz = b.sy / TILESIZE;
    const shooter = this.game.objects.get(b.shooterId);
    let h0 = this.heightAt(sx, sz) + 0.3;
    if (shooter && shooter.isAir) h0 = this.heightAt(sx, sz) + (AIR_ALT[shooter.type] || 1.3);
    else if (shooter && shooter.isStructure) h0 = this.heightAt(sx, sz) + (b.type === B.LARGE_ROCKET ? 1.0 : 0.5);
    else if (shooter && shooter.isInfantry) h0 = this.heightAt(sx, sz) + 0.25;
    const bv = { h0, mesh: null };
    if (geo) {
      const m = new THREE.Mesh(geo, mat);
      if (b.type === B.SHELL_SMALL) m.scale.setScalar(1);
      this.root.add(m);
      bv.mesh = m;
    }
    return bv;
  }

  // world position of a unit (for effects)
  objectPosition(o) {
    const v = this.views.get(o.id);
    if (v) return v.root.position;
    return new THREE.Vector3(o.px, this.heightAt(o.px, o.py), o.py);
  }
}

function clampN(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function angleDelta(a, b) {
  let d = (b - a) % 8;
  if (d > 4) d -= 8;
  if (d < -4) d += 8;
  return d;
}

function smoothAngle(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
