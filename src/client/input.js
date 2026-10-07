import * as THREE from 'three';
import { TILESIZE, T } from '../core/constants.js';
import { STRUCTURE_SIZE, itemName } from '../data/gamedata.js';
import { MODE } from '../game/object.js';
import { audio } from '../audio/audio.js';

const SPIRAL = (() => {
  const out = [[0, 0]];
  for (let r = 1; r <= 6; r++) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.max(Math.abs(x), Math.abs(y)) === r) out.push([x, y]);
  }
  return out;
})();

// Mouse & keyboard handling for a running match
export class Input {
  constructor(view) {
    this.view = view;
    this.game = view.game;
    this.canvas = view.app.canvas;
    this.cam = view.cam;
    this.mode = null; // null | 'move' | 'attack' | 'capture' | 'place' | 'deathHand' | 'rally' | 'drop'
    this.placeItem = null;
    this.placeBuilder = null;
    this.mouse = { x: 0, y: 0, down: false, button: -1, startX: 0, startY: 0, dragging: false };
    this.groups = new Map();
    this.lastGroupKey = { key: null, t: 0 };
    this.lastClick = { t: 0, id: null };
    this.ground = new THREE.Vector3();
    this.hoverTile = null;
    this.boxEl = document.createElement('div');
    this.boxEl.className = 'select-box';
    this.boxEl.style.display = 'none';
    document.getElementById('ui-root').appendChild(this.boxEl);

    // placement ghost
    this.ghost = new THREE.Group();
    this.ghostTiles = [];
    const tileGeo = new THREE.PlaneGeometry(0.94, 0.94);
    tileGeo.rotateX(-Math.PI / 2);
    this.okMat = new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0.45, depthWrite: false });
    this.badMat = new THREE.MeshBasicMaterial({ color: 0xff3a30, transparent: true, opacity: 0.5, depthWrite: false });
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0xc8ff50, transparent: true, opacity: 0.45, depthWrite: false });
    this.blockMat = new THREE.MeshBasicMaterial({ color: 0xffc030, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(tileGeo, this.okMat);
      m.renderOrder = 40;
      this.ghost.add(m);
      this.ghostTiles.push(m);
    }
    this.ghost.visible = false;
    view.overlay.add(this.ghost);
    // rally / move markers
    this.markers = [];
    this.markerGeo = new THREE.RingGeometry(0.15, 0.3, 20);
    this.markerGeo.rotateX(-Math.PI / 2);
    // rally line
    this.rallyLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x9cff9c, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.8 }));
    this.rallyLine.visible = false;
    view.overlay.add(this.rallyLine);

    this.handlers = {
      mousedown: (e) => this.onMouseDown(e),
      mouseup: (e) => this.onMouseUp(e),
      mousemove: (e) => this.onMouseMove(e),
      wheel: (e) => this.onWheel(e),
      contextmenu: (e) => e.preventDefault(),
      keydown: (e) => this.onKeyDown(e),
      keyup: (e) => this.onKeyUp(e),
      mouseleave: () => (this.cam.mouse.inside = false),
      mouseenter: (e) => {
        this.cam.mouse.x = e.clientX;
        this.cam.mouse.y = e.clientY;
        this.cam.mouse.inside = true;
      },
      blur: () => this.cam.keys.clear(),
    };
    this.canvas.addEventListener('mousedown', this.handlers.mousedown);
    window.addEventListener('mouseup', this.handlers.mouseup);
    window.addEventListener('mousemove', this.handlers.mousemove);
    this.canvas.addEventListener('wheel', this.handlers.wheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.handlers.contextmenu);
    window.addEventListener('keydown', this.handlers.keydown);
    window.addEventListener('keyup', this.handlers.keyup);
    this.canvas.addEventListener('mouseleave', this.handlers.mouseleave);
    this.canvas.addEventListener('mouseenter', this.handlers.mouseenter);
    window.addEventListener('blur', this.handlers.blur);
    this.cam.mouse.inside = false; // enabled after the first mouse move over the map
  }

  dispose() {
    this.canvas.removeEventListener('mousedown', this.handlers.mousedown);
    window.removeEventListener('mouseup', this.handlers.mouseup);
    window.removeEventListener('mousemove', this.handlers.mousemove);
    this.canvas.removeEventListener('wheel', this.handlers.wheel);
    this.canvas.removeEventListener('contextmenu', this.handlers.contextmenu);
    window.removeEventListener('keydown', this.handlers.keydown);
    window.removeEventListener('keyup', this.handlers.keyup);
    this.canvas.removeEventListener('mouseleave', this.handlers.mouseleave);
    this.canvas.removeEventListener('mouseenter', this.handlers.mouseenter);
    window.removeEventListener('blur', this.handlers.blur);
    this.boxEl.remove();
  }

  get selection() {
    return this.game.selection;
  }

  ndc(x, y) {
    return [(x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1];
  }

  groundAt(x, y) {
    const [nx, ny] = this.ndc(x, y);
    return this.cam.ndcToGround(nx, ny, this.ground);
  }

  tileAt(x, y) {
    const p = this.groundAt(x, y);
    return [Math.floor(p.x), Math.floor(p.z), p];
  }

  // screen position of a world point
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.cam.camera);
    return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight, v.z];
  }

  // pick the object under the cursor (units by screen distance, structures by tile)
  pickObject(sx, sy) {
    const g = this.game;
    const view = this.view;
    let best = null;
    let bd = Infinity;
    for (const u of g.units) {
      if (!u.alive || u.hidden) continue;
      const v = view.entities.views.get(u.id);
      if (!v || !v.root.visible) continue;
      const p = v.root.position;
      const [px, py, pz] = this.project(p.x, p.y + (u.isInfantry ? 0.15 : 0.2), p.z);
      if (pz > 1) continue;
      const depth = this.cam.camera.position.distanceTo(p);
      const ppu = window.innerHeight / (2 * Math.tan((this.cam.camera.fov * Math.PI) / 360) * Math.max(1, depth));
      const r = (u.isInfantry ? 0.2 : u.type === 'frigate' ? 1.2 : u.isAir ? 0.5 : 0.4) * ppu + 4;
      const d = Math.hypot(px - sx, py - sy);
      if (d < r && d < bd) {
        bd = d;
        best = u;
      }
    }
    if (best) return best;
    const [tx, ty] = this.tileAt(sx, sy);
    if (g.map.inBounds(tx, ty)) {
      const gid = g.map.ground[g.map.idx(tx, ty)];
      const o = gid ? g.objects.get(gid) : null;
      if (o && o.isStructure && view.entities.isShown(o)) return o;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  onMouseDown(e) {
    audio.init();
    if (e.target !== this.canvas) return;
    this.mouse.down = true;
    this.mouse.button = e.button;
    this.mouse.startX = e.clientX;
    this.mouse.startY = e.clientY;
    this.mouse.dragging = false;
    if (e.button === 1) {
      e.preventDefault();
      this.panning = { x: e.clientX, y: e.clientY };
    }
  }

  onMouseMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.cam.mouse.x = e.clientX;
    this.cam.mouse.y = e.clientY;
    this.cam.mouse.inside = e.target === this.canvas || this.mouse.down;
    if (this.panning) {
      this.cam.pan(e.clientX - this.panning.x, e.clientY - this.panning.y);
      this.panning.x = e.clientX;
      this.panning.y = e.clientY;
      return;
    }
    if (this.mouse.down && this.mouse.button === 0 && !this.mode) {
      const dx = e.clientX - this.mouse.startX;
      const dy = e.clientY - this.mouse.startY;
      if (!this.mouse.dragging && Math.hypot(dx, dy) > 6) this.mouse.dragging = true;
      if (this.mouse.dragging) {
        const x0 = Math.min(e.clientX, this.mouse.startX);
        const y0 = Math.min(e.clientY, this.mouse.startY);
        Object.assign(this.boxEl.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', width: Math.abs(dx) + 'px', height: Math.abs(dy) + 'px' });
      }
    }
  }

  onMouseUp(e) {
    if (this.panning && e.button === 1) {
      this.panning = null;
      this.mouse.down = false;
      return;
    }
    if (!this.mouse.down) return;
    this.mouse.down = false;
    this.boxEl.style.display = 'none';
    if (e.button === 0) {
      if (!this.mode && Math.hypot(e.clientX - this.mouse.startX, e.clientY - this.mouse.startY) > 6) this.mouse.dragging = true;
      if (this.mouse.dragging) {
        this.boxSelect(this.mouse.startX, this.mouse.startY, e.clientX, e.clientY, e.shiftKey);
      } else if (e.target === this.canvas) {
        this.leftClick(e.clientX, e.clientY, e.shiftKey, e.ctrlKey);
      }
    } else if (e.button === 2 && e.target === this.canvas) {
      if (this.mode) {
        this.cancelMode();
      } else {
        this.rightClick(e.clientX, e.clientY, e.shiftKey);
      }
    }
    this.mouse.dragging = false;
  }

  onWheel(e) {
    e.preventDefault();
    this.cam.zoom(e.deltaY);
  }

  // ---------------------------------------------------------------------------
  leftClick(sx, sy, shift, ctrl) {
    const g = this.game;
    const [tx, ty] = this.tileAt(sx, sy);
    if (this.mode) {
      this.executeMode(tx, ty, sx, sy, shift);
      return;
    }
    const obj = this.pickObject(sx, sy);
    const now = performance.now();
    if (obj) {
      if (obj.owner === g.player && obj.isUnit && (now - this.lastClick.t < 350 && this.lastClick.id === obj.id || ctrl)) {
        // double click: select all units of this type on screen
        this.selectAllOfTypeOnScreen(obj.type, shift);
      } else if (shift && obj.owner === g.player) {
        if (this.selection.has(obj)) this.selection.delete(obj);
        else if (obj.isUnit && ![...this.selection].some((s) => s.isStructure)) this.selection.add(obj);
      } else {
        this.selection.clear();
        this.selection.add(obj);
        if (obj.owner === g.player) {
          audio.play('select');
          this.acknowledge(obj, 'select');
        }
      }
      this.lastClick = { t: now, id: obj.id };
    } else if (!shift) {
      this.selection.clear();
    }
    this.view.hud.dirty = true;
  }

  selectAllOfTypeOnScreen(type, add) {
    const g = this.game;
    if (!add) this.selection.clear();
    for (const u of g.units) {
      if (!u.alive || u.hidden || u.owner !== g.player || u.type !== type || u.respondable === false) continue;
      const v = this.view.entities.views.get(u.id);
      if (!v) continue;
      const [px, py, pz] = this.project(v.root.position.x, v.root.position.y, v.root.position.z);
      if (pz < 1 && px >= 0 && py >= 0 && px <= window.innerWidth - this.view.hud.sidebarWidth() && py <= window.innerHeight) this.selection.add(u);
    }
    audio.play('select');
    this.acknowledge([...this.selection][0], 'select');
  }

  boxSelect(x0, y0, x1, y1, add) {
    const g = this.game;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const picked = [];
    for (const u of g.units) {
      if (!u.alive || u.hidden || u.owner !== g.player || u.respondable === false) continue;
      const v = this.view.entities.views.get(u.id);
      if (!v || !v.root.visible) continue;
      const [px, py, pz] = this.project(v.root.position.x, v.root.position.y + 0.1, v.root.position.z);
      if (pz > 1) continue;
      if (px >= minX && px <= maxX && py >= minY && py <= maxY) picked.push(u);
    }
    if (!add) this.selection.clear();
    // prefer combat units over harvesters when mixed
    const combat = picked.filter((u) => u.type !== 'harvester' && u.type !== 'mcv' && u.type !== 'carryall');
    for (const u of combat.length ? combat : picked) this.selection.add(u);
    for (const s of [...this.selection]) if (s.isStructure && this.selection.size > 1) this.selection.delete(s);
    if (picked.length) {
      audio.play('select');
      this.acknowledge(picked[0], 'select');
    }
    this.view.hud.dirty = true;
  }

  ownSelectedUnits() {
    const g = this.game;
    return [...this.selection].filter((o) => o.alive && o.isUnit && o.owner === g.player && o.respondable !== false);
  }

  selectedStructure() {
    const g = this.game;
    const arr = [...this.selection];
    if (arr.length === 1 && arr[0].isStructure && arr[0].owner === g.player && arr[0].alive) return arr[0];
    return null;
  }

  // radio acknowledgement from the unit's crew: select | move | attack | harvest
  acknowledge(u, kind) {
    if (!u || !u.isUnit || u.owner !== this.game.player || u.respondable === false) return;
    if (u.type === 'carryall' || u.type === 'frigate' || u.type === 'sandworm') return;
    audio.unitBark(u.owner, kind);
  }

  // contextual command (right click) — Dune Legacy style
  rightClick(sx, sy, shift) {
    const g = this.game;
    const [tx, ty] = this.tileAt(sx, sy);
    if (!g.map.inBounds(tx, ty)) return;
    const units = this.ownSelectedUnits();
    const struct = this.selectedStructure();
    const obj = this.pickObject(sx, sy);
    if (units.length) {
      this.commandUnits(units, tx, ty, obj, 'auto');
      return;
    }
    if (struct) {
      if (struct.isBuilder || struct.type === 'refinery' || struct.type === 'repairYard' || struct.type === 'palace') {
        if (obj === struct) struct.rally = null;
        else {
          struct.rally = { x: tx, y: ty };
          this.addMarker(tx, ty, 0x9cff9c);
          this.game.message('Rally point set', 'info', 'rally');
        }
        audio.play('click');
      } else if ((struct.type === 'gunTurret' || struct.type === 'rocketTurret') && obj && obj.team !== struct.team) {
        struct.doAttackObject(obj);
        audio.play('ack');
      }
    }
  }

  commandUnits(units, tx, ty, obj, kind) {
    const g = this.game;
    const team = g.teamOf(g.player);
    let issued = false;
    const enemyTarget = obj && obj.alive && obj.team !== team ? obj : null;
    const friendlyTarget = obj && obj.alive && obj.team === team ? obj : null;
    let spiralIdx = 0;
    const takeSpot = (u) => {
      // spread group move destinations around the clicked tile
      if (units.length === 1) return [tx, ty];
      for (; spiralIdx < SPIRAL.length; spiralIdx++) {
        const [dx, dy] = SPIRAL[spiralIdx];
        const x = tx + dx;
        const y = ty + dy;
        if (!g.map.inBounds(x, y)) continue;
        const t = g.map.getType(x, y);
        if (t === T.MOUNTAIN && !u.isInfantry) continue;
        spiralIdx++;
        return [x, y];
      }
      return [tx, ty];
    };
    for (const u of units) {
      if (kind === 'attack') {
        if (enemyTarget || friendlyTarget) {
          if (u.canAttackAnything() || u.type === 'harvester') u.doAttackObject(obj, true);
        } else if (u.canAttackAnything()) {
          u.doAttackPos(tx, ty, true);
        }
        issued = true;
        continue;
      }
      if (kind === 'capture') {
        if (u.isInfantry && u.doCaptureStructure && enemyTarget && enemyTarget.isStructure) {
          u.doCaptureStructure(enemyTarget);
          issued = true;
        }
        continue;
      }
      if (kind === 'move') {
        const [mx, my] = takeSpot(u);
        if (u.type === 'harvester') u.harvestingMode = false;
        u.doMove2Pos(mx, my, true);
        issued = true;
        continue;
      }
      // auto
      if (enemyTarget) {
        if (u.isInfantry && enemyTarget.isStructure && enemyTarget.canBeCaptured() && enemyTarget.heavilyDamaged && u.type !== 'saboteur') {
          u.doCaptureStructure(enemyTarget);
        } else if (u.type === 'saboteur') {
          u.doAttackObject(enemyTarget, true);
        } else if (u.canAttackAnything() && u.canAttack(enemyTarget)) {
          u.doAttackObject(enemyTarget, true);
        } else if (u.type === 'harvester' && enemyTarget.isInfantry) {
          u.doAttackObject(enemyTarget, true);
        } else {
          u.doMove2Pos(tx, ty, true);
        }
        issued = true;
        continue;
      }
      if (friendlyTarget && friendlyTarget.owner === g.player && friendlyTarget !== u) {
        if (friendlyTarget.type === 'refinery' && u.type === 'harvester') {
          u.doReturn();
          u.doMove2Object(friendlyTarget);
          issued = true;
          continue;
        }
        if (friendlyTarget.type === 'repairYard' && !u.isInfantry && !u.isAir && u.health < u.maxHealth) {
          u.doMove2Object(friendlyTarget);
          issued = true;
          continue;
        }
      }
      if (u.type === 'harvester') {
        const t = g.map.getType(tx, ty);
        u.returning = false;
        u.doMove2Pos(tx, ty, true);
        if (t === T.SPICE || t === T.THICK_SPICE) {
          u.attackMode = MODE.HARVEST;
          u.harvestingMode = true;
        }
        issued = true;
        continue;
      }
      const [mx, my] = takeSpot(u);
      u.doMove2Pos(mx, my, true);
      issued = true;
    }
    if (issued) {
      this.addMarker(tx, ty, enemyTarget || kind === 'attack' ? 0xff5040 : 0x80ff80);
      audio.play('ack', null, { volume: 0.5 });
      const lead = units[0];
      const toSpice = lead.type === 'harvester' && lead.harvestingMode;
      this.acknowledge(lead, enemyTarget || kind === 'attack' ? 'attack' : toSpice ? 'harvest' : 'move');
    }
  }

  // ---------------------------------------------------------------------------
  setMode(mode, data = null) {
    this.mode = mode;
    this.modeData = data;
    if (mode === 'place') {
      this.placeItem = data.item;
      this.placeBuilder = data.builder;
    }
    this.canvas.classList.toggle('cursor-attack', mode === 'attack' || mode === 'deathHand' || mode === 'capture');
    this.canvas.style.cursor = mode === 'move' || mode === 'rally' ? 'cell' : mode === 'place' ? 'copy' : '';
    this.view.hud.dirty = true;
  }

  cancelMode() {
    this.mode = null;
    this.placeItem = null;
    this.placeBuilder = null;
    this.ghost.visible = false;
    this.canvas.classList.remove('cursor-attack');
    this.canvas.style.cursor = '';
    this.view.hud.dirty = true;
  }

  executeMode(tx, ty, sx, sy, shift) {
    const g = this.game;
    if (!g.map.inBounds(tx, ty)) return;
    const mode = this.mode;
    if (mode === 'place') {
      this.tryPlace(tx, ty, shift);
      return;
    }
    if (mode === 'deathHand') {
      const p = this.modeData;
      if (p && p.alive && p.doLaunchDeathHand(tx, ty)) {
        g.message('Death Hand launched!', 'good', 'dh', true, 'deathHand');
      }
      this.cancelMode();
      return;
    }
    const obj = this.pickObject(sx, sy);
    const units = this.ownSelectedUnits();
    if (mode === 'move') this.commandUnits(units, tx, ty, null, 'move');
    else if (mode === 'attack') this.commandUnits(units, tx, ty, obj, 'attack');
    else if (mode === 'capture') this.commandUnits(units, tx, ty, obj, 'capture');
    else if (mode === 'drop') {
      for (const u of units) if (!u.isAir && !u.isInfantry) {
        u.doMove2Pos(tx, ty, true);
        u.requestCarryall();
      }
    }
    if (!shift) this.cancelMode();
  }

  // placement position: structure footprint centered under the cursor
  placementOrigin(tx, ty, item) {
    const [w, h] = STRUCTURE_SIZE[item] || [1, 1];
    const p = this.ground;
    const ox = Math.round(p.x - w / 2);
    const oy = Math.round(p.z - h / 2);
    return [ox, oy];
  }

  tryPlace(tx, ty, keep) {
    const g = this.game;
    const b = this.placeBuilder;
    const item = this.placeItem;
    if (!b || !b.alive || !b.waitingToPlace || b.currentItem !== item) {
      this.cancelMode();
      return;
    }
    const [ox, oy] = this.placementOrigin(tx, ty, item);
    const res = g.canPlaceStructure(g.player, item, ox, oy);
    if (!res.ok) {
      if (res.blockers && res.blockers.length) {
        // ask own units to move away
        for (const u of res.blockers) {
          const spot = g.map.findNearest(u.x, u.y, 6, (x, y) => !(x >= ox && y >= oy && x < ox + (STRUCTURE_SIZE[item]?.[0] || 1) && y < oy + (STRUCTURE_SIZE[item]?.[1] || 1)) && u.canPass(x, y));
          if (spot) u.doMove2Pos(spot[0], spot[1], true);
        }
        g.message('Units are clearing the site', 'info', 'clear');
      } else {
        g.message(res.reason === 'range' ? 'Too far from the base' : `Cannot place ${itemName(item)} here`, 'warn', 'cantplace');
        audio.play('error');
      }
      return;
    }
    g.placeStructure(g.player, item, ox, oy, { builder: b, byPlayer: true });
    b.onPlaced();
    this.cancelMode();
    this.view.hud.dirty = true;
  }

  // ---------------------------------------------------------------------------
  onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    const g = this.game;
    const view = this.view;
    if (this.view.app.menuOpen) {
      if (e.code === 'Escape') view.app.closeGameMenu();
      return;
    }
    const code = e.code;
    if (code.startsWith('Arrow')) {
      this.cam.keys.add(code);
      e.preventDefault();
      return;
    }
    if (code === 'KeyQ' || code === 'KeyE') {
      this.cam.keys.add(code);
      return;
    }
    if (code === 'Escape') {
      if (this.mode) this.cancelMode();
      else view.app.openGameMenu();
      return;
    }
    if (code === 'Space' || code === 'Pause') {
      e.preventDefault();
      view.togglePause();
      return;
    }
    // control groups
    if (/^Digit[0-9]$/.test(code)) {
      const n = parseInt(code.slice(5), 10);
      if (e.ctrlKey) {
        e.preventDefault();
        if (n === 0) {
          for (const [k, set] of this.groups) for (const o of this.selection) set.delete(o);
        } else this.groups.set(n, new Set([...this.selection].filter((o) => o.owner === g.player)));
        g.message(`Group ${n} assigned`, 'info', 'group');
        return;
      }
      if (n === 0) {
        this.selection.clear();
        view.hud.dirty = true;
        return;
      }
      const set = this.groups.get(n);
      if (!set) return;
      for (const o of [...set]) if (!o.alive || o.owner !== g.player) set.delete(o);
      const now = performance.now();
      if (!e.shiftKey) this.selection.clear();
      for (const o of set) this.selection.add(o);
      if (this.lastGroupKey.key === n && now - this.lastGroupKey.t < 400) this.centerOnSelection();
      this.lastGroupKey = { key: n, t: now };
      view.hud.dirty = true;
      return;
    }
    const units = this.ownSelectedUnits();
    const st = this.selectedStructure();
    switch (code) {
      case 'KeyM':
        if (units.length) this.setMode('move');
        break;
      case 'KeyA':
        if (e.ctrlKey) {
          e.preventDefault();
          this.selection.clear();
          for (const u of g.units) if (u.alive && !u.hidden && u.owner === g.player && u.respondable !== false && u.canAttackAnything() && u.type !== 'carryall') this.selection.add(u);
          view.hud.dirty = true;
        } else if (units.length) this.setMode('attack');
        break;
      case 'KeyC':
        if (units.some((u) => u.isInfantry)) this.setMode('capture');
        break;
      case 'KeyD':
        if (units.length && g.hasCarryalls(g.player)) this.setMode('drop');
        break;
      case 'KeyH':
        for (const u of units) if (u.type === 'harvester') u.doReturn();
        break;
      case 'KeyR':
        if (st) st.doRepair();
        else for (const u of units) if (!u.isInfantry) u.doRepair();
        break;
      case 'KeyU':
        if (st && st.isBuilder && st.canUpgrade()) st.doUpgrade();
        break;
      case 'KeyP':
        this.placeReady();
        break;
      case 'KeyG':
        this.cycleStructures(['constructionYard']);
        break;
      case 'KeyF':
        this.cycleStructures(['barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'starport']);
        break;
      case 'KeyS':
        for (const u of units) u.doSetAttackMode(MODE.STOP);
        break;
      case 'KeyX':
        for (const u of units) if (u.type === 'devastator') u.doStartDevastate();
        for (const u of units) if (u.type === 'mcv') u.doDeploy();
        break;
      case 'KeyO':
        this.selection.clear();
        for (const u of g.units) if (u.alive && u.owner === g.player && u.type === 'ornithopter') this.selection.add(u);
        view.hud.dirty = true;
        break;
      case 'Home':
        this.cam.resetRotation();
        break;
      case 'Minus':
      case 'NumpadSubtract':
        view.app.changeSpeed(-1);
        break;
      case 'Equal':
      case 'NumpadAdd':
        view.app.changeSpeed(1);
        break;
      case 'F1':
        e.preventDefault();
        this.cam.targetDistance = 12;
        break;
      case 'F2':
        e.preventDefault();
        this.cam.targetDistance = 24;
        break;
      case 'F3':
        e.preventDefault();
        this.cam.targetDistance = 42;
        break;
      case 'Tab':
        e.preventDefault();
        view.entities.showAllHealth = !view.entities.showAllHealth;
        break;
      case 'Backspace':
        this.centerOnBase();
        break;
      default:
        break;
    }
    view.hud.dirty = true;
  }

  onKeyUp(e) {
    this.cam.keys.delete(e.code);
  }

  placeReady() {
    const g = this.game;
    for (const s of g.structures) {
      if (s.alive && s.owner === g.player && s.type === 'constructionYard' && s.waitingToPlace) {
        this.setMode('place', { item: s.currentItem, builder: s });
        return;
      }
    }
  }

  cycleStructures(types) {
    const g = this.game;
    const list = g.structures.filter((s) => s.alive && s.owner === g.player && types.includes(s.type));
    if (!list.length) return;
    const cur = this.selectedStructure();
    let i = cur ? list.indexOf(cur) : -1;
    const next = list[(i + 1) % list.length];
    this.selection.clear();
    this.selection.add(next);
    this.cam.lookAt(next.px, next.py, false);
    this.view.hud.dirty = true;
  }

  centerOnSelection() {
    const arr = [...this.selection];
    if (!arr.length) return;
    let x = 0;
    let y = 0;
    for (const o of arr) {
      x += o.px;
      y += o.py;
    }
    this.cam.lookAt(x / arr.length, y / arr.length, false);
  }

  centerOnBase() {
    const c = this.game.baseCenter(this.game.player);
    if (c) this.cam.lookAt(c[0] + 1, c[1] + 1, false);
  }

  addMarker(x, y, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const m = new THREE.Mesh(this.markerGeo, mat);
    m.position.set(x + 0.5, this.view.terrain.heightAt(x + 0.5, y + 0.5) + 0.06, y + 0.5);
    m.renderOrder = 45;
    m.userData.life = 0;
    this.view.overlay.add(m);
    this.markers.push(m);
  }

  // per-frame: edge scroll handled by camera; ghost & markers here
  update(dt) {}

  updateOverlay(dt) {
    const g = this.game;
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.userData.life += dt;
      const t = m.userData.life / 0.7;
      m.scale.setScalar(1 + t * 1.5);
      m.material.opacity = 0.9 * (1 - t);
      if (t >= 1) {
        this.view.overlay.remove(m);
        m.material.dispose();
        this.markers.splice(i, 1);
      }
    }
    // placement ghost
    if (this.mode === 'place' && this.placeItem) {
      const [tx, ty] = this.tileAt(this.mouse.x, this.mouse.y);
      const item = this.placeItem;
      const [w, h] = STRUCTURE_SIZE[item] || [1, 1];
      const [ox, oy] = this.placementOrigin(tx, ty, item);
      const res = g.canPlaceStructure(g.player, item, ox, oy);
      this.ghost.visible = true;
      let k = 0;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const m = this.ghostTiles[k++];
          const x = ox + i;
          const y = oy + j;
          m.visible = true;
          let ok = g.map.inBounds(x, y);
          let slab = false;
          if (ok) {
            const t = g.map.getType(x, y);
            ok = (t === T.ROCK || t === T.SLAB) && !g.map.ground[g.map.idx(x, y)];
            slab = t === T.SLAB;
          }
          m.material = !res.ok ? (res.blockers ? this.blockMat : this.badMat) : ok && !slab && item !== 'slab1' && item !== 'slab4' && item !== 'wall' && item !== 'constructionYard' ? this.warnMat : this.okMat;
          if (!ok) m.material = this.badMat;
          m.position.set(x + 0.5, this.view.terrain.heightAt(x + 0.5, y + 0.5) + 0.05, y + 0.5);
        }
      }
      for (; k < this.ghostTiles.length; k++) this.ghostTiles[k].visible = false;
    } else {
      this.ghost.visible = false;
    }
    // rally line for selected builder
    const st = this.selectedStructure();
    if (st && st.rally) {
      const a = new THREE.Vector3(st.px, this.view.terrain.heightAt(st.px, st.py) + 0.5, st.py);
      const b = new THREE.Vector3(st.rally.x + 0.5, this.view.terrain.heightAt(st.rally.x + 0.5, st.rally.y + 0.5) + 0.1, st.rally.y + 0.5);
      this.rallyLine.geometry.setFromPoints([a, b]);
      this.rallyLine.computeLineDistances();
      this.rallyLine.visible = true;
    } else this.rallyLine.visible = false;
    // hover info
    if (!this.mouse.down) {
      const obj = this.pickObject(this.mouse.x, this.mouse.y);
      this.view.entities.hovered = obj;
      if (!this.mode) this.canvas.style.cursor = obj && obj.team !== g.teamOf(g.player) && this.ownSelectedUnits().length ? 'crosshair' : obj ? 'pointer' : '';
    }
  }
}
