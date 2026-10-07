import * as THREE from 'three';
import { TILESIZE, T, CYCLE_MS } from '../core/constants.js';
import { RTSCamera } from '../render/camera.js';
import { TerrainRenderer } from '../render/terrain.js';
import { EntityRenderer } from '../render/entities.js';
import { Effects } from '../render/effects.js';
import { B } from '../game/bullets.js';
import { audio } from '../audio/audio.js';
import { Input } from './input.js';
import { Hud } from '../ui/hud.js';
import { fxRandom as R } from '../core/random.js';
import { itemName, itemDesc } from '../data/gamedata.js';

const HEIGHT_CLASS = (t) => (t === T.MOUNTAIN ? 3 : t === T.ROCK || t === T.SLAB ? 2 : t === T.DUNES ? 1 : 0);

// Runs one match: simulation stepping, rendering, input and HUD.
export class GameView {
  constructor(app, game, opts = {}) {
    this.app = app;
    this.game = game;
    this.opts = opts;
    this.sr = app.sceneRenderer;
    this.scene = this.sr.resetScene();
    this.speed = app.settings.gameSpeed ?? 1;
    this.accumulator = 0;
    this.paused = false;
    this.time = 0;
    this.ended = false;
    this.endTimer = 0;

    const map = game.map;
    this.terrain = new TerrainRenderer(map, { seed: opts.terrainSeed ?? 7 });
    this.scene.add(this.terrain.group);
    this.heightClass = new Uint8Array(map.width * map.height);
    for (let i = 0; i < map.width * map.height; i++) this.heightClass[i] = HEIGHT_CLASS(map.types[i]);
    this.terrain.updateOverlay();

    this.cam = new RTSCamera(window.innerWidth / window.innerHeight, map.width, map.height);
    this.cam.heightFn = (x, z) => this.terrain.heightAt(x, z);
    const sv = game.startView || [map.width / 2, map.height / 2];
    this.cam.lookAt(sv[0] + 0.5, sv[1] + 0.5);
    this.cam.distance = this.cam.targetDistance = 24;
    this.sr.setCamera(this.cam.camera);

    this.effects = new Effects(this.scene, this.cam.camera);
    this.effects.shakeCallback = (amount, x, z) => {
      const d = Math.hypot(x - this.cam.target.x, z - this.cam.target.z);
      if (d < 25) this.cam.addShake(amount * (1 - d / 25));
    };
    this.entities = new EntityRenderer(this.scene, this.terrain, this.effects, game);
    this.overlay = new THREE.Group();
    this.scene.add(this.overlay);

    this.fogFrame = 0;
    this.explored = new Uint8Array(map.width * map.height);
    this.visible = new Uint8Array(map.width * map.height);
    this.updateFog(true);

    this.hud = new Hud(this);
    this.input = new Input(this);
    this.bindEvents();
    this.resize();
    audio.startMusic('calm');
    audio.startAmbience();
    this.battleUntil = 0;
    this.hintsShown = new Set(game.structures.filter((st) => st.owner === game.player).map((st) => st.type));
    this.seenEnemies = new Set();
    this.lastApproachAlert = -99999;
    this.approachTimer = 0;
    setTimeout(() => {
      if (this.game.houses[this.player]?.getCount('refinery') === 0) this.hud.addMessage('Tip: build a Windtrap, then a Spice Refinery. A Harvester is delivered with it.', 'info');
    }, 4000);
  }

  // "Enemy approaching from the north" style warnings (Dune II feedback)
  checkApproach() {
    const g = this.game;
    const team = g.teamOf(this.player);
    const base = g.baseCenter(this.player);
    if (!base) return;
    for (const u of g.units) {
      if (!u.alive || u.hidden || u.team === team || u.isAir || u.type === 'sandworm' || this.seenEnemies.has(u.id)) continue;
      if (!g.isTileVisibleToTeam(team, u.x, u.y)) continue;
      const s = g.map.seen[team][g.map.idx(u.x, u.y)];
      if (g.cycle - s > 40) continue;
      const dx = u.x - base[0];
      const dy = u.y - base[1];
      if (Math.hypot(dx, dy) > 16) continue;
      this.seenEnemies.add(u.id);
      if (g.cycle - this.lastApproachAlert < 1800) continue;
      this.lastApproachAlert = g.cycle;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      const name = { n: 'north', s: 'south', e: 'east', w: 'west' }[dir];
      g.alert('approach', `Warning: enemy approaching from the ${name}!`, u.px, u.py, 60, true, 'approach_' + dir);
    }
  }

  get player() {
    return this.game.player;
  }

  bindEvents() {
    const g = this.game;
    const ev = g.events;
    ev.on('explosion', (e) => this.onExplosion(e));
    ev.on('fire', (e) => this.onFire(e));
    ev.on('message', (m) => {
      this.hud.addMessage(m.text, m.kind);
      if (m.speak) audio.announce(this.player, m.spoken || m.key, { text: m.text, key: m.key || m.spoken, cooldown: 3 });
    });
    ev.on('bloom', (e) => {
      const y = this.terrain.heightAt(e.x + 0.5, e.y + 0.5);
      this.effects.spiceBloom(e.x + 0.5, y, e.y + 0.5);
      audio.play('bloom', { x: e.x, z: e.y });
      this.effects.shakeCallback(0.4, e.x, e.y);
    });
    ev.on('crush', (e) => {
      const y = this.terrain.heightAt(e.x, e.y);
      this.effects.alpha.emit(e.x, y + 0.05, e.y, 0, 0.3, 0, 0.6, 0.15, 0.4, [0.5, 0.1, 0.08, 0.8], [0.3, 0.05, 0.05, 0], 1, 1);
      audio.play('crush', { x: e.x, z: e.y });
    });
    ev.on('wormAttack', (e) => {
      audio.play('worm', { x: e.x, z: e.y }, { volume: 1.2 });
    });
    ev.on('structurePlaced', (e) => {
      const s = e.structure;
      if (s.owner === this.player && this.game.cycle > 5 && !this.hintsShown.has(s.type)) {
        this.hintsShown.add(s.type);
        this.hud.addMessage(`${itemName(s.type)}: ${itemDesc(s.type)}`, 'info');
      }
      audio.play('place', { x: s.px, z: s.py });
      const y = this.terrain.heightAt(s.px, s.py);
      for (let i = 0; i < 12; i++) this.effects.dust(s.x + R.rand() * s.w, y, s.y + R.rand() * s.h, 2);
    });
    ev.on('buildComplete', (e) => {
      if (e.builder.owner === this.player) {
        this.hud.addMessage('Construction complete', 'good');
        audio.announce(this.player, 'construct', { cooldown: 2 });
        audio.play('complete');
        this.hud.dirty = true;
      }
    });
    ev.on('upgradeComplete', (e) => {
      if (e.structure.owner === this.player) {
        this.hud.addMessage('Upgrade complete', 'good');
        audio.announce(this.player, 'upgrade', { cooldown: 2 });
        this.hud.dirty = true;
      }
    });
    ev.on('unitDestroyed', (e) => {
      const u = e.unit;
      if (!e.visible || u.hidden) return;
      const y = this.terrain.heightAt(u.px, u.py);
      if (u.isInfantry) {
        if (!e.crushed) audio.play('infantryDie', { x: u.px, z: u.py }, { volume: 0.8 });
        this.effects.alpha.emit(u.px, y + 0.1, u.py, 0, 0.4, 0, 0.8, 0.1, 0.35, [0.45, 0.12, 0.08, 0.7], [0.3, 0.1, 0.05, 0], 1, 1);
      } else if (!u.isAir) {
        this.effects.explosion(u.px, y + 0.2, u.py, 1);
        audio.play('explMed', { x: u.px, z: u.py });
      }
    });
    ev.on('structureDestroyed', (e) => {
      const s = e.structure;
      const y = this.terrain.heightAt(s.px, s.py);
      for (let j = 0; j < s.h; j++) {
        for (let i = 0; i < s.w; i++) {
          setTimeout(() => this.effects.explosion(s.x + i + 0.5, y + 0.3, s.y + j + 0.5, s.w * s.h > 1 ? 2 : 1), (i + j) * 90);
        }
      }
      audio.play('explLarge', { x: s.px, z: s.py });
      this.terrain.updateOverlay();
    });
    ev.on('captured', () => (this.hud.dirty = true));
    ev.on('gameOver', (o) => this.onGameOver(o));
    ev.on('alert', () => {
      this.battleUntil = this.time + 30;
      audio.setMusicMood('battle');
    });
    ev.on('fremen', (e) => {
      this.effects.sandBurst(e.x + 0.5, this.terrain.heightAt(e.x, e.y), e.y + 0.5, 1.5);
    });
    ev.on('pickup', () => {});
    ev.on('drop', (e) => audio.play('place', { x: e.carryall.px, z: e.carryall.py }, { volume: 0.5 }));
  }

  onExplosion(e) {
    const x = e.x;
    const z = e.y;
    let y = this.terrain.heightAt(x, z);
    if (e.air) y += 1.3;
    const pos = { x, z };
    switch (e.kind) {
      case 'bullet':
        this.effects.impact(x, y, z, 'bullet');
        break;
      case 'shell':
        this.effects.explosion(x, y + 0.1, z, 0);
        audio.play('explSmall', pos, { volume: 0.7 });
        break;
      case 'shellLarge':
        this.effects.explosion(x, y + 0.1, z, 0);
        this.effects.explosion(x, y + 0.1, z, 0);
        audio.play('explSmall', pos);
        break;
      case 'rocket':
      case 'smallRocket':
        this.effects.explosion(x, y + 0.1, z, e.kind === 'rocket' ? 1 : 0);
        audio.play(e.kind === 'rocket' ? 'explMed' : 'explSmall', pos);
        break;
      case 'gas':
        this.effects.impact(x, y, z, 'gas');
        audio.play('gas', pos);
        break;
      case 'deathHand':
        this.effects.deathHand(x, y, z);
        audio.play('deathHand', pos, { volume: 1.5 });
        this.cam.addShake(1.2);
        break;
      case 'devastator':
        this.effects.explosion(x, y + 0.2, z, 3);
        audio.play('explLarge', pos, { volume: 1.4 });
        break;
      case 'harvester':
        this.effects.explosion(x, y + 0.2, z, 2);
        audio.play('explLarge', pos);
        break;
      case 'saboteur':
        this.effects.explosion(x, y + 0.2, z, 2);
        audio.play('explLarge', pos);
        break;
      case 'air':
        this.effects.explosion(x, y + 1.3, z, 1);
        audio.play('explMed', pos);
        break;
      default:
        this.effects.explosion(x, y, z, 0);
    }
    if (!e.air && e.kind !== 'bullet' && e.kind !== 'gas') {
      // the explosion may have changed overlay (craters / slab destroyed)
      this.overlayDirty = true;
    }
  }

  onFire(e) {
    const u = e.unit;
    const pos = { x: e.x, z: e.y };
    const team = this.game.teamOf(this.player);
    const tx = Math.floor(e.x);
    const ty = Math.floor(e.y);
    if (this.game.map.inBounds(tx, ty) && !this.game.isTileVisibleToTeam(team, tx, ty)) return;
    let dx = e.tx - e.x;
    let dz = e.ty - e.y;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    let y = this.terrain.heightAt(e.x, e.y);
    if (u.isAir) y += 1.35;
    else if (u.isInfantry) y += 0.25;
    else if (u.isStructure) y += 0.55;
    else y += 0.32;
    const off = u.isInfantry ? 0.12 : u.isStructure ? 0.45 : 0.4;
    const mx = e.x + dx * off;
    const mz = e.y + dz * off;
    switch (e.bullet) {
      case B.SHELL_SMALL:
        this.effects.muzzle(mx, y, mz, dx, dz, false);
        audio.play(u.isInfantry ? 'gun' : 'mg', pos, { volume: 0.6 });
        break;
      case B.SHELL_MEDIUM:
      case B.SHELL_TURRET:
        this.effects.muzzle(mx, y, mz, dx, dz, true);
        audio.play('cannon', pos);
        break;
      case B.SHELL_LARGE:
        this.effects.muzzle(mx, y, mz, dx, dz, true);
        audio.play('heavyCannon', pos);
        break;
      case B.ROCKET:
      case B.TURRET_ROCKET:
      case B.SMALL_ROCKET:
      case B.DROCKET:
      case B.LARGE_ROCKET:
        this.effects.muzzle(mx, y, mz, dx, dz, false);
        audio.play('rocket', pos, { volume: e.bullet === B.LARGE_ROCKET ? 1.6 : 0.8 });
        break;
      case B.SONIC:
        audio.play('sonic', pos);
        break;
      default:
        break;
    }
  }

  onGameOver(o) {
    this.endTimer = 3.5;
    if (o.won) {
      this.hud.showBanner('MISSION ACCOMPLISHED', false);
      audio.announce(this.player, 'won', { cooldown: 0 });
      audio.startMusic('victory');
    } else {
      this.hud.showBanner('MISSION FAILED', true);
      audio.announce(this.player, 'lost', { cooldown: 0 });
      audio.startMusic('defeat');
    }
  }

  setSpeed(s) {
    this.speed = s;
  }

  togglePause(v) {
    this.paused = v === undefined ? !this.paused : v;
    this.hud.setPaused(this.paused);
  }

  updateFog(force = false) {
    const g = this.game;
    const map = g.map;
    const team = g.teamOf(this.player);
    const seen = map.seen[team];
    const n = map.width * map.height;
    const fog = g.settings.fogOfWar;
    for (let i = 0; i < n; i++) {
      const s = seen[i];
      this.explored[i] = s >= 0 ? 1 : 0;
      this.visible[i] = s >= 0 && (!fog || g.cycle - s <= 625) ? 1 : 0;
    }
    this.terrain.updateFog(this.explored, this.visible);
  }

  processTerrainChanges() {
    const map = this.game.map;
    const dirty = map.takeDirtyTerrain();
    let rebuild = null;
    for (const [x, y] of dirty) {
      const i = map.idx(x, y);
      const hc = HEIGHT_CLASS(map.types[i]);
      if (hc !== this.heightClass[i]) {
        this.heightClass[i] = hc;
        if (!rebuild) rebuild = [x, y, x, y];
        else {
          rebuild[0] = Math.min(rebuild[0], x);
          rebuild[1] = Math.min(rebuild[1], y);
          rebuild[2] = Math.max(rebuild[2], x);
          rebuild[3] = Math.max(rebuild[3], y);
        }
      }
    }
    if (rebuild) this.terrain.rebuildRegion(...rebuild);
    if (dirty.length || map.spiceDirty || this.overlayDirty) {
      this.overlayTimer = (this.overlayTimer || 0) + 1;
      if (this.overlayTimer > 6 || dirty.length) {
        this.terrain.updateOverlay();
        map.spiceDirty = false;
        this.overlayDirty = false;
        this.overlayTimer = 0;
        this.hud.minimap.dirty = true;
      }
    }
  }

  update(dt) {
    this.time += dt;
    const g = this.game;
    // simulation
    if (!this.paused && !this.app.menuOpen) {
      this.accumulator += dt * 1000 * this.speed;
      let steps = 0;
      while (this.accumulator >= CYCLE_MS && steps < 12) {
        g.update();
        this.accumulator -= CYCLE_MS;
        steps++;
      }
      if (steps >= 12) this.accumulator = 0;
    }
    const alpha = Math.min(1, this.accumulator / CYCLE_MS);
    this.processTerrainChanges();
    if (++this.fogFrame % 4 === 0) this.updateFog();
    this.approachTimer += dt;
    if (this.approachTimer > 0.5) {
      this.approachTimer = 0;
      this.checkApproach();
    }
    // camera & world
    this.input.update(dt);
    this.cam.update(dt, window.innerWidth - this.hud.sidebarWidth(), window.innerHeight);
    this.sr.followTarget(this.cam.target, this.cam.distance);
    audio.setListener(this.cam.target.x, this.cam.target.z, this.cam.distance);
    this.terrain.update(this.time);
    this.entities.update(dt, alpha, this.cam.camera, g.selection);
    this.input.updateOverlay(dt);
    this.effects.update(dt);
    this.hud.update(dt);
    if (this.battleUntil && this.time > this.battleUntil) {
      this.battleUntil = 0;
      audio.setMusicMood('calm');
    }
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.ended) {
        this.ended = true;
        this.app.onGameFinished(this.game.over, this);
      }
    }
  }

  render() {
    this.sr.render(this.time);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.cam.setAspect(w / h);
    this.effects.setViewportHeight(h);
    this.hud.resize();
  }

  dispose() {
    this.input.dispose();
    this.hud.dispose();
    this.effects.clear();
    this.entities.dispose();
    this.terrain.dispose();
    this.game.events.clear();
    audio.stopAmbience();
  }
}
