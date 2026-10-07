import { TILESIZE } from '../core/constants.js';
import { MODE, blockDistance, dirIndex } from './object.js';
import { Unit } from './unit.js';

// ---------------------------------------------------------------------------
// AirUnit: always moving along a continuous angle, never uses A*, does not reveal map
// ---------------------------------------------------------------------------
export class AirUnit extends Unit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.currentMaxSpeed = this.st.maxSpeed;
    this.altitude = 1;
  }

  canPass() {
    return true;
  }

  assignToMap(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return;
    if (!this.guardPoint) this.guardPoint = { x, y };
    map.air[map.idx(x, y)] = this.id;
  }

  unassignFromMap(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return;
    const i = map.idx(x, y);
    if (map.air[i] === this.id) map.air[i] = 0;
  }

  // place at world pixel position (may be off-map for couriers)
  placeAt(rx, ry) {
    this.rx = rx;
    this.ry = ry;
    this.prevRx = rx;
    this.prevRy = ry;
    this.x = Math.floor(rx / TILESIZE);
    this.y = Math.floor(ry / TILESIZE);
    this.assignToMap(this.x, this.y);
    this.hidden = false;
    this.active = true;
  }

  viewMap() {}

  navigate() {
    this.moving = true;
    this.justStoppedMoving = false;
  }

  maxSpeed() {
    return this.currentMaxSpeed;
  }

  move() {
    const rad = (this.angle * Math.PI * 2) / 8;
    const v = this.maxSpeed();
    this.rx += Math.cos(rad) * v;
    this.ry += -Math.sin(rad) * v;
    const nx = Math.floor(Math.round(this.rx) / TILESIZE);
    const ny = Math.floor(Math.round(this.ry) / TILESIZE);
    if (nx !== this.x || ny !== this.y) {
      this.unassignFromMap(this.x, this.y);
      this.assignToMap(nx, ny);
      this.x = nx;
      this.y = ny;
    }
    this.checkPos();
  }

  destinationAngle() {
    const d = this.destination;
    let a = Math.atan2(-(d.y * TILESIZE + 32 - this.ry), d.x * TILESIZE + 32 - this.rx);
    if (a < 0) a += Math.PI * 2;
    return (a * 8) / (Math.PI * 2);
  }

  turn() {
    const ts = this.st.turnSpeed;
    if (this.destination) {
      const da = this.destinationAngle();
      let left = 0;
      let right = 0;
      if (this.angle > da) {
        right = this.angle - da;
        left = Math.abs(8 - this.angle) + da;
      } else if (this.angle < da) {
        right = Math.abs(8 - da) + this.angle;
        left = da - this.angle;
      }
      if (left <= right) {
        this.angle += Math.min(ts, left);
        if (this.angle >= 8) this.angle -= 8;
      } else {
        this.angle -= Math.min(ts, right);
        if (this.angle < 0) this.angle += 8;
      }
    } else {
      this.angle -= ts / 8;
      if (this.angle < 0) this.angle += 8;
    }
    this.drawnAngle = Math.round(this.angle) % 8;
  }

  checkPos() {}

  destroy() {
    if (!this.alive) return;
    if (!this.hidden) this.game.events.emit('explosion', { x: this.px, y: this.py, kind: 'air', air: true });
    super.destroy();
  }

  isOffMap(margin) {
    const map = this.game.map;
    return this.rx < -margin || this.ry < -margin || this.rx > map.width * TILESIZE + margin || this.ry > map.height * TILESIZE + margin;
  }
}

// ---------------------------------------------------------------------------
// Carryall
// ---------------------------------------------------------------------------
export class Carryall extends AirUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.cargo = [];
    this.owned = true;
    this.dropOfferer = false;
    this.droppedOffCargo = false;
    this.respondable = false;
    this.currentMaxSpeed = 0;
    this.attackMode = MODE.GUARD;
  }

  canAttackAnything() {
    return false;
  }

  isBooked() {
    return !!this.target || this.cargo.length > 0;
  }

  hasCargo() {
    return this.cargo.length > 0;
  }

  setTarget(obj) {
    const old = this.target;
    if (old && this.targetFriendly && old.isUnit && old.bookedCarrier === this) old.bookCarrier(null);
    if (old && old.type === 'refinery' && old.alive) old.unbook();
    // bypass Unit.setTarget repair yard booking logic for carryalls
    this.attackPos = null;
    this.bFollow = false;
    this.targetAngle = -1;
    this.target = obj || null;
    this.targetFriendly = !!(obj && obj.team === this.team);
    if (obj && obj.type === 'refinery') obj.book();
    if (obj && this.targetFriendly && obj.isUnit && !obj.isAir) {
      obj.awaitingPickup = true;
      obj.bookedCarrier = this;
    }
  }

  releaseTarget() {
    if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
    this.setTarget(null);
  }

  giveCargo(unit) {
    if (!unit) return;
    this.cargo.push(unit);
    unit.setPickedUp(this);
    this.droppedOffCargo = false;
  }

  update() {
    const maxSpeed = this.st.maxSpeed;
    let dist = -1;
    const t = this.target;
    if (t && t.isUnit && t.alive) dist = Math.hypot(this.rx - t.rx, this.ry - t.ry);
    else if ((t && t.alive) || this.hasCargo()) {
      if (this.destination) dist = Math.hypot(this.rx - (this.destination.x * TILESIZE + 32), this.ry - (this.destination.y * TILESIZE + 32));
    }
    if (dist >= 0) {
      const minSpeed = 2;
      if (dist < 32) this.currentMaxSpeed = Math.min(dist, minSpeed);
      else if (dist >= 640) this.currentMaxSpeed = maxSpeed;
      else {
        const m = (maxSpeed - minSpeed) / (640 - 32);
        this.currentMaxSpeed = dist * m + (minSpeed - 32 * m);
      }
    } else if (this.dropOfferer) {
      this.currentMaxSpeed = Math.min(this.currentMaxSpeed + 0.2, maxSpeed);
    } else {
      // idle patrol: cruise slower so the circle stays near the base
      const cruise = this.destination ? maxSpeed : maxSpeed * 0.3;
      this.currentMaxSpeed = this.currentMaxSpeed > cruise ? Math.max(cruise, this.currentMaxSpeed - 0.4) : Math.min(this.currentMaxSpeed + 0.2, cruise);
    }
    if (!super.update()) return false;
    if (this.active && this.dropOfferer && this.droppedOffCargo && !this.hasCargo() && this.isOffMap(TILESIZE)) {
      if (this.target && this.target.type === 'refinery') this.target.unbook();
      for (const u of this.game.units) if (u.bookedCarrier === this) u.bookCarrier(null);
      this.hidden = true;
      this.removeSilently = true;
      this.setHealth(0);
      this.destroy();
      return false;
    }
    return true;
  }

  targeting() {
    if (this.target) this.engageTarget();
  }

  engageTarget() {
    const t = this.target;
    if (!t || !t.alive) {
      this.releaseTarget();
      return;
    }
    if (!t.active && !t.isStructure) {
      this.releaseTarget();
      return;
    }
    if (t.isUnit && !t.awaitingPickup && !this.hasCargo()) {
      this.releaseTarget();
      return;
    }
    if (t.team !== this.team) {
      this.releaseTarget();
      return;
    }
    let tx;
    let ty;
    if (t.type === 'refinery') {
      tx = t.x + 2;
      ty = t.y;
    } else if (t.isUnit) {
      tx = t.x;
      ty = t.y;
    } else {
      [tx, ty] = t.closestPoint(this.x, this.y);
    }
    const dx0 = tx * TILESIZE + 32;
    const dy0 = ty * TILESIZE + 32;
    let d = Math.hypot(this.rx - dx0, this.ry - dy0);
    if (d < 2 * TILESIZE && d > TILESIZE / 10) {
      const mx = Math.max(-16, Math.min(16, dx0 - this.rx));
      const my = Math.max(-16, Math.min(16, dy0 - this.ry));
      this.rx += mx;
      this.ry += my;
      const nx = Math.floor(Math.round(this.rx) / TILESIZE);
      const ny = Math.floor(Math.round(this.ry) / TILESIZE);
      if (nx !== this.x || ny !== this.y) {
        this.unassignFromMap(this.x, this.y);
        this.assignToMap(nx, ny);
        this.x = nx;
        this.y = ny;
      }
      d = Math.hypot(this.rx - dx0, this.ry - dy0);
    }
    if (d <= TILESIZE / 10) {
      if (this.hasCargo()) {
        if (t.isStructure) {
          while (this.cargo.length) this.deployUnit(this.cargo[0]);
          this.setTarget(null);
          if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
        }
      } else {
        this.pickupTarget();
      }
    } else {
      this.setDestination(tx, ty);
    }
  }

  pickupTarget() {
    this.currentMaxSpeed = 0;
    const t = this.target;
    const g = this.game;
    if (t.isUnit) {
      if (t.health <= 0) {
        this.setHealth(0);
        return;
      }
      const needs = t.target || (t.destination && (t.destination.x !== t.x || t.destination.y !== t.y)) || t.badlyDamaged || t.awaitingPickup;
      if (needs) {
        if (t.badlyDamaged || (!t.target && t.type !== 'harvester')) t.doRepair();
        const newTarget = t.target && t.target.alive ? t.target : null;
        this.cargo.push(t);
        t.setPickedUp(this);
        this.droppedOffCargo = false;
        if (newTarget && newTarget.type === 'refinery') {
          t.guardPoint = { x: t.x, y: t.y };
          t.target = newTarget;
          t.returning = true;
          this.setTarget(newTarget);
          this.setDestination(newTarget.x + 2, newTarget.y);
        } else if (newTarget && newTarget.type === 'repairYard') {
          t.guardPoint = { x: t.x, y: t.y };
          t.target = newTarget;
          t.goingToRepairYard = true;
          this.setTarget(newTarget);
          const [cx, cy] = newTarget.closestPoint(this.x, this.y);
          this.setDestination(cx, cy);
        } else if (t.destination) {
          this.target = null;
          this.setDestination(t.destination.x, t.destination.y);
        }
        this.clearPath();
        g.events.emit('pickup', { carryall: this, unit: t });
      } else {
        t.awaitingPickup = false;
        t.bookedCarrier = null;
        if (t.attackMode === MODE.CARRYALL) t.doSetAttackMode(MODE.STOP);
        this.releaseTarget();
      }
    } else if (t.type === 'refinery') {
      t.deployHarvester(this);
    } else if (t.type === 'repairYard') {
      t.deployRepairUnit(this);
    }
  }

  checkPos() {
    if (!this.active) return;
    if (this.hasCargo()) {
      if (this.destination && this.x === this.destination.x && this.y === this.destination.y && this.currentMaxSpeed <= 0.5) {
        let dropped = 0;
        do {
          const u = this.cargo[0];
          if (!u) break;
          if (!u.isInfantry && dropped > 0) break;
          this.deployUnit(u);
          dropped++;
          if (!u.isInfantry) break;
        } while (this.hasCargo() && dropped < 3);
        if (this.hasCargo()) {
          const g = this.game;
          for (let i = 8; i < 18; i++) {
            const r = g.rng.randInt(3, Math.floor(i / 2));
            const a = Math.PI * 2 * g.rng.rand();
            const x = this.x + Math.round(r * Math.sin(a));
            const y = this.y + Math.round(-r * Math.cos(a));
            if (g.map.inBounds(x, y) && !g.map.ground[g.map.idx(x, y)]) {
              this.setDestination(x, y);
              break;
            }
          }
        } else {
          this.setTarget(null);
          if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
        }
      }
    } else if (!this.isBooked()) {
      if (this.dropOfferer) return;
      const map = this.game.map;
      if (!this.destination && this.guardPoint && (this.x < 1 || this.y < 1 || this.x > map.width - 2 || this.y > map.height - 2)) {
        this.setDestination(this.guardPoint.x, this.guardPoint.y);
        return;
      }
      if (this.destination) {
        if (blockDistance(this.x, this.y, this.destination.x, this.destination.y) <= 2) this.destination = null;
      } else if (this.guardPoint && blockDistance(this.x, this.y, this.guardPoint.x, this.guardPoint.y) > 17) {
        this.setDestination(this.guardPoint.x, this.guardPoint.y);
      }
    }
  }

  deployUnit(u) {
    const i = this.cargo.indexOf(u);
    if (i < 0) return;
    this.cargo.splice(i, 1);
    const g = this.game;
    this.currentMaxSpeed = 0;
    g.events.emit('drop', { carryall: this, unit: u });
    if (!u.alive) {
      if (!this.hasCargo()) this._afterEmpty();
      return;
    }
    const map = g.map;
    const tx = Math.max(0, Math.min(map.width - 1, this.x));
    const ty = Math.max(0, Math.min(map.height - 1, this.y));
    const gid = map.inBounds(this.x, this.y) ? map.ground[map.idx(this.x, this.y)] : 0;
    const obj = gid ? g.objects.get(gid) : null;
    let unit = u;
    if (obj && obj.isStructure && obj.owner === this.owner) {
      if (obj.type === 'repairYard') {
        if (obj.isFree()) {
          unit.hidden = false;
          unit.alive = true;
          obj.book();
          obj.assignUnit(unit);
          unit.goingToRepairYard = false;
          unit.target = null;
          unit = null;
        } else obj.book();
      } else if (obj.type === 'refinery' && unit.type === 'harvester' && obj.isFree()) {
        unit.target = obj;
        unit.returning = true;
        obj.assignHarvester(unit);
        unit.returning = false;
        unit.target = null;
        unit = null;
      }
    }
    if (unit) {
      unit.angle = this.drawnAngle;
      unit.drawnAngle = this.drawnAngle;
      const spot = g.findDeploySpot(unit, tx, ty, 1, 1, tx, ty);
      unit.forced = false;
      if (spot) {
        unit.hidden = false;
        unit.active = true;
        unit.pickedUp = false;
        unit.respondable = unit.type !== 'sandworm';
        if (unit.goingToRepairYard) {
          // keep its booking on the repair yard; it will drive in
        }
        unit.deploy(spot[0], spot[1]);
        if (unit.type === 'saboteur') unit.doSetAttackMode(MODE.HUNT);
        else if (unit.type === 'harvester') {
          unit.attackMode = MODE.HARVEST;
          unit.harvestingMode = false;
          unit.spiceCheckCounter = 0;
          if (unit.guardPoint) {
            const found = g.findSpice(unit.guardPoint.x, unit.guardPoint.y);
            if (found) {
              unit.setDestination(found[0], found[1]);
              unit.harvestingMode = true;
            }
          }
        } else if (unit.goingToRepairYard && unit.target && unit.target.alive) {
          unit.doMove2Object(unit.target);
        } else {
          unit.doSetAttackMode(MODE.AREAGUARD);
          if (unit.destination && (unit.destination.x !== unit.x || unit.destination.y !== unit.y) && this.dropOfferer === false) {
            // continue to the original destination
          }
        }
      } else {
        unit.setHealth(0);
        unit.destroy();
      }
    }
    if (!this.hasCargo()) this._afterEmpty();
  }

  _afterEmpty() {
    if (!this.dropOfferer) {
      this.setTarget(null);
      if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
    }
    this.droppedOffCargo = true;
    this.clearPath();
  }

  turn() {
    const map = this.game.map;
    if (this.active && this.dropOfferer && this.droppedOffCargo && !this.hasCargo() &&
      (this.rx < 32 || this.rx > map.width * TILESIZE - 32 || this.ry < 32 || this.ry > map.height * TILESIZE - 32)) return;
    super.turn();
  }

  destroy() {
    if (!this.alive) return;
    if (this.target && this.target.type === 'refinery' && this.target.alive) this.target.unbook();
    if (this.target && this.target.isUnit && this.target.bookedCarrier === this) this.target.bookCarrier(null);
    for (const u of this.game.units) if (u.bookedCarrier === this) u.bookCarrier(null);
    // cargo dies with the carryall
    for (const u of this.cargo) {
      if (u.alive) {
        u.hidden = true;
        u.setHealth(0);
        u.destroy();
      }
    }
    this.cargo = [];
    if (this.removeSilently) {
      this.alive = false;
      this.unassignFromMap(this.x, this.y);
      this.game.onUnitDestroyed(this, false, true);
      return;
    }
    super.destroy();
  }
}

// ---------------------------------------------------------------------------
// Ornithopter: constant speed, attack runs
// ---------------------------------------------------------------------------
export class Ornithopter extends AirUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.timeLastShot = -9999;
    this.attackMode = MODE.AREAGUARD;
  }

  canAttackAnything() {
    return true;
  }

  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (!obj.isStructure && obj.isAir) return false;
    if (obj.type === 'sandworm') return true;
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }

  findTarget() {
    if (this.attackMode === MODE.STOP) return null;
    const hunt = this.attackMode === MODE.HUNT;
    return this.game.findClosestTarget(this, hunt ? Infinity : 12, hunt);
  }

  isInAttackRange() {
    return true;
  }

  engageTarget() {
    const t = this.target;
    const g = this.game;
    if (t && (!t.alive || t.hidden || (!this.targetFriendly && !this.canAttack(t)))) {
      this.setTarget(null);
      this.findTargetTimer = 0;
      return;
    }
    if (t) {
      const [tx, ty] = t.closestPoint(this.x, this.y);
      if (g.cycle - this.timeLastShot < 62) {
        // fly away from the target after a shot
        const ax = this.x + (this.x - tx) * 2;
        const ay = this.y + (this.y - ty) * 2;
        this.destination = { x: Math.max(0, Math.min(g.map.width - 1, ax)), y: Math.max(0, Math.min(g.map.height - 1, ay)) };
        return;
      }
      this.destination = { x: tx, y: ty };
      const d = blockDistance(this.x, this.y, tx, ty);
      if (d <= this.weaponRange()) {
        const a = dirIndex(this.x, this.y, tx, ty);
        if (a < 0 || a === this.drawnAngle) {
          if (this.attack()) this.timeLastShot = g.cycle;
        }
      }
    } else if (this.attackPos) {
      this.destination = { x: this.attackPos.x, y: this.attackPos.y };
      const d = blockDistance(this.x, this.y, this.attackPos.x, this.attackPos.y);
      if (d <= this.weaponRange() && g.cycle - this.timeLastShot >= 62) {
        const a = dirIndex(this.x, this.y, this.attackPos.x, this.attackPos.y);
        if (a < 0 || a === this.drawnAngle) {
          if (this.attack()) this.timeLastShot = g.cycle;
        }
      }
    } else {
      if (this.destination && blockDistance(this.x, this.y, this.destination.x, this.destination.y) < 2) this.destination = null;
      else if (!this.destination && this.guardPoint && blockDistance(this.x, this.y, this.guardPoint.x, this.guardPoint.y) > 17) {
        this.destination = { ...this.guardPoint };
      }
    }
  }

  targeting() {
    if (this.findTargetTimer === 0 && !this.target && !this.attackPos && this.attackMode !== MODE.STOP) {
      const t = this.findTarget();
      if (t) this.setTarget(t);
      this.findTargetTimer = 62;
    }
    this.engageTarget();
  }

  doMove2Pos(x, y, forced) {
    this.setTarget(null);
    this.attackPos = null;
    this.setDestination(x, y);
    this.setGuardPoint(x, y);
    this.forced = forced;
  }

  doAttackObject(obj, forced) {
    if (!obj) return;
    this.setTarget(obj);
    this.forced = forced;
  }
}

// ---------------------------------------------------------------------------
// Frigate: delivers starport orders
// ---------------------------------------------------------------------------
export class Frigate extends AirUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.respondable = false;
    this.droppedOffCargo = false;
    this.currentMaxSpeed = 0;
  }

  canAttackAnything() {
    return false;
  }

  targeting() {}

  update() {
    const maxSpeed = this.st.maxSpeed;
    let dist = -1;
    if (this.destination) dist = Math.hypot(this.rx - (this.destination.x * TILESIZE + 32), this.ry - (this.destination.y * TILESIZE + 32));
    if (dist >= 0 && !this.droppedOffCargo) {
      if (dist < 32) this.currentMaxSpeed = Math.min(dist, 2);
      else if (dist >= 640) this.currentMaxSpeed = maxSpeed;
      else {
        const m = (maxSpeed - 2) / (640 - 32);
        this.currentMaxSpeed = dist * m + (2 - 32 * m);
      }
    } else this.currentMaxSpeed = Math.min(this.currentMaxSpeed + 0.2, maxSpeed);
    if (!super.update()) return false;
    if (this.droppedOffCargo && this.isOffMap(TILESIZE)) {
      this.removeSilently = true;
      this.hidden = true;
      this.setHealth(0);
      this.destroy();
      return false;
    }
    return true;
  }

  checkPos() {
    if (this.droppedOffCargo) return;
    const t = this.target;
    if (!t || !t.alive) {
      // starport destroyed: fly away
      this.droppedOffCargo = true;
      this.destination = this.guardPoint ? { ...this.guardPoint } : null;
      return;
    }
    if (this.destination && this.x === this.destination.x && this.y === this.destination.y) {
      const d = Math.hypot(this.rx - (this.destination.x * TILESIZE + 32), this.ry - (this.destination.y * TILESIZE + 32));
      if (d < 8) {
        t.startDeploying();
        this.droppedOffCargo = true;
        this.destination = this.guardPoint ? { ...this.guardPoint } : null;
      }
    }
  }

  turn() {
    const map = this.game.map;
    if (this.droppedOffCargo && (this.rx < 32 || this.rx > map.width * TILESIZE - 32 || this.ry < 32 || this.ry > map.height * TILESIZE - 32)) return;
    super.turn();
  }

  destroy() {
    if (!this.alive) return;
    if (!this.droppedOffCargo && this.target && this.target.alive && this.target.informFrigateDestroyed) this.target.informFrigateDestroyed();
    if (this.removeSilently) {
      this.alive = false;
      this.unassignFromMap(this.x, this.y);
      this.game.onUnitDestroyed(this, false, true);
      return;
    }
    super.destroy();
  }
}
