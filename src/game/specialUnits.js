import { TILESIZE, T, isSandLike } from '../core/constants.js';
import { MODE, blockDistance } from './object.js';
import { GroundUnit, TrackedUnit, InfantryUnit, TankUnit, MIN_CARRYALL_LIFT_DISTANCE } from './unit.js';
import { B } from './bullets.js';

export const HARVESTER_MAX_SPICE = 700;
const HARVEST_SPEED = 0.1344;
const MAX_HARVESTER_SLOWDOWN = 0.4;

// ---------------------------------------------------------------------------
// Infantry types
// ---------------------------------------------------------------------------
export class Soldier extends InfantryUnit {}

export class Trooper extends InfantryUnit {
  // Troopers can engage air units too
  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (obj.type === 'sandworm') return true;
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }
}

export class Saboteur extends InfantryUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.attackMode = MODE.GUARD;
    this.cloaked = true;
  }

  canAttackAnything() {
    return true;
  }

  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (obj.team === this.team || obj.type === 'sandworm' || obj.isAir || obj.isInfantry) return false;
    return obj.isVisibleTo(this.team);
  }

  // invisible unless an object of the observing team is within +-2 tiles
  isVisibleTo(team) {
    if (!this.alive || this.hidden) return false;
    if (this.team === team) return true;
    return this.game.teamHasObjectNear(team, this.x, this.y, 2);
  }

  update() {
    if (!super.update()) return false;
    const t = this.target;
    if (this.active && t && t.alive && !this.moving && !this.justStoppedMoving && t.team !== this.team) {
      const [cx, cy] = t.closestPoint(this.x, this.y);
      if (blockDistance(this.x, this.y, cx, cy) <= 1.5) {
        const g = this.game;
        if (t.isStructure || (t.isUnit && !t.isInfantry)) {
          g.events.emit('explosion', { x: this.px, y: this.py, kind: 'saboteur' });
          t.handleDamage(t.health + 1, this, this.owner);
          if (t.isUnit) t.setHealth(0);
          this.hidden = true;
          this.setHealth(0);
          this.destroy();
          return false;
        }
      }
    }
    return true;
  }

  attack() {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Wheeled
// ---------------------------------------------------------------------------
export class Trike extends GroundUnit {}
export class RaiderTrike extends GroundUnit {}
export class Quad extends GroundUnit {}

export class MCV extends GroundUnit {
  canAttackAnything() {
    return false;
  }

  // MCV::canDeploy — all 4 tiles rock/slab/mountain; the 3 others not blocked
  canDeploy() {
    const map = this.game.map;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = this.x + i;
        const y = this.y + j;
        if (!map.inBounds(x, y)) return false;
        if (!map.isRock(x, y)) return false;
        if (i === 0 && j === 0) continue;
        const k = map.idx(x, y);
        if (map.types[k] === T.MOUNTAIN || map.ground[k] || map.infantryCount(x, y) > 0) return false;
      }
    }
    return true;
  }

  doDeploy() {
    if (this.moving || !this.canDeploy()) return false;
    const g = this.game;
    const x = this.x;
    const y = this.y;
    this.unassignFromMap(this.x, this.y);
    this.hidden = true;
    this.alive = false;
    g.onUnitDestroyed(this, false, true);
    const s = g.placeStructure(this.owner, 'constructionYard', x, y, { byPlayer: true });
    if (s) g.events.emit('structureBuilt', { structure: s });
    return true;
  }
}

// ---------------------------------------------------------------------------
// Tracked specials
// ---------------------------------------------------------------------------
export class Tank extends TankUnit {}
export class SiegeTank extends TankUnit {}

export class Launcher extends TrackedUnit {
  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (obj.type === 'sandworm') return true;
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }
}

export class Deviator extends TrackedUnit {
  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (!obj.isUnit || obj.isAir || obj.type === 'sandworm') return false;
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }
}

export class SonicTank extends TrackedUnit {
  canAttack(obj) {
    if (obj && obj.type === 'sonicTank') return false;
    return super.canAttack(obj);
  }

  handleDamage(damage, damager, owner) {
    if (damager && damager.isBullet && damager.type === B.SONIC) return;
    super.handleDamage(damage, damager, owner);
  }
}

export class Devastator extends TrackedUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.devastateTimer = 0;
  }

  doStartDevastate() {
    if (this.devastateTimer <= 0) this.devastateTimer = 200;
  }

  update() {
    if (this.active && this.devastateTimer > 0) {
      if (--this.devastateTimer === 0) {
        this.setHealth(0);
      }
    }
    return super.update();
  }

  destroy() {
    if (!this.alive) return;
    const g = this.game;
    if (!this.hidden && g.isObjectVisibleToAny(this)) {
      const cx = this.x * TILESIZE + 32;
      const cy = this.y * TILESIZE + 32;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          g.damageArea({ id: this.id, owner: this.owner, type: -1, isBullet: false }, cx + i * TILESIZE, cy + j * TILESIZE, 150, 16, false);
        }
      }
      g.events.emit('explosion', { x: this.x + 0.5, y: this.y + 0.5, kind: 'devastator' });
    }
    super.destroy();
  }
}

// ---------------------------------------------------------------------------
// Harvester
// ---------------------------------------------------------------------------
export class Harvester extends TrackedUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.spice = 0;
    this.harvestingMode = false;
    this.returning = false;
    this.spiceCheckCounter = 0;
    this.pathFailCounter = 0;
    this.returnPathFailCounter = 0;
    this.attackMode = MODE.HARVEST;
  }

  canAttackAnything() {
    return false;
  }

  canAttack(obj) {
    return !!(obj && obj.alive && obj.isInfantry && obj.team !== this.team && obj.isVisibleTo(this.team));
  }

  currentSpeed() {
    let v = this.maxSpeed();
    if (this.badlyDamaged) v *= 0.75;
    v *= 1 - MAX_HARVESTER_SLOWDOWN * (this.spice / HARVESTER_MAX_SPICE);
    return v;
  }

  setDestination(x, y) {
    super.setDestination(x, y);
    const map = this.game.map;
    this.harvestingMode = this.attackMode !== MODE.STOP && x !== null && x !== undefined && map.inBounds(x, y) && isSpiceTile(map.getType(x, y));
  }

  setGuardPoint(x, y) {
    super.setGuardPoint(x, y);
    if (x === null || x === undefined) return;
    const map = this.game.map;
    if (!map.inBounds(x, y)) return;
    if (isSpiceTile(map.getType(x, y))) {
      if (this.attackMode === MODE.STOP) this.attackMode = MODE.GUARD;
    } else if (this.attackMode !== MODE.STOP) {
      this.attackMode = MODE.STOP;
    }
  }

  setTarget(obj) {
    if (this.returning && this.target && this.target.type === 'refinery' && this.target.alive) {
      this.target.unbook();
      this.returning = false;
    }
    super.setTarget(obj);
    if (obj && obj.owner === this.owner && obj.type === 'refinery') {
      obj.book();
      this.returning = true;
    }
  }

  doReturn() {
    if (!this.returning && this.active) {
      this.returning = true;
      this.harvestingMode = false;
      if (this.attackMode === MODE.STOP) this.guardPoint = null;
    }
  }

  handleDamage(damage, damager, owner) {
    super.handleDamage(damage, damager, owner);
    if (!this.target && !this.forced && damager && damager.isUnit && this.canAttack(damager) && this.attackMode !== MODE.STOP) {
      this.setTarget(damager);
    }
  }

  setReturned() {
    const g = this.game;
    const ref = this.target;
    g.deselect(this);
    this.unassignFromMap(this.x, this.y);
    ref.assignHarvester(this);
    this.returning = false;
    this.moving = false;
    this.respondable = false;
    this.active = false;
    this.hidden = true;
    this.target = null;
  }

  deploy(x, y) {
    super.deploy(x, y);
    if (this.spice === 0) {
      const gp = this.guardPoint || { x, y };
      const found = this.attackMode !== MODE.STOP ? this.game.findSpice(gp.x, gp.y) : null;
      if (found) {
        this.harvestingMode = true;
        this.setDestination(found[0], found[1]);
        this.setGuardPoint(found[0], found[1]);
      } else this.harvestingMode = false;
    }
  }

  extractSpice(amount) {
    const old = this.spice;
    this.spice = Math.max(0, this.spice - amount);
    return old - this.spice;
  }

  isHarvesting() {
    const map = this.game.map;
    return this.harvestingMode && this.spice < HARVESTER_MAX_SPICE && this.destination &&
      blockDistance(this.x, this.y, this.destination.x, this.destination.y) <= Math.SQRT2 && isSpiceTile(map.getType(this.x, this.y));
  }

  move() {
    super.move();
    if (!this.alive || !this.active || this.moving || this.justStoppedMoving) return;
    const g = this.game;
    const map = g.map;
    if (this.harvestingMode && this.destination) {
      if (this.x === this.destination.x && this.y === this.destination.y) {
        if (this.spice < HARVESTER_MAX_SPICE) {
          const t = map.getType(this.x, this.y);
          if (isSpiceTile(t)) {
            this.spice += map.harvestSpice(this.x, this.y, HARVEST_SPEED);
            if (this.spice > HARVESTER_MAX_SPICE) this.spice = HARVESTER_MAX_SPICE;
            const after = map.getType(this.x, this.y);
            if (after !== t) {
              const found = g.findSpice(this.x, this.y);
              if (!found) this.doReturn();
              else this.doMove2Pos(found[0], found[1], false);
            }
          } else {
            const found = g.findSpice(this.x, this.y);
            if (!found) {
              if (this.spice > 0) this.doReturn();
              else this.harvestingMode = false;
            } else this.doMove2Pos(found[0], found[1], false);
          }
        } else {
          this.doReturn();
        }
      } else if (this.path.length === 0 && this.recalculatePathTimer > 0 && !this.nextSpotFound) {
        // could not find a way to the spice field
        this.harvestingMode = false;
      }
    }
  }

  checkPos() {
    super.checkPos();
    if (!this.alive || this.health <= 0) return;
    const g = this.game;
    const map = g.map;
    const house = g.houses[this.owner];
    if (this.attackMode === MODE.STOP) {
      this.harvestingMode = false;
      if (house && !house.isHuman) this.doSetAttackMode(MODE.HARVEST);
    }
    if (!this.active) return;
    if (this.returning) {
      const ref = this.target;
      if (ref && ref.alive && ref.type === 'refinery') {
        const onRef = map.ground[map.idx(this.x, this.y)] === ref.id;
        if (this.justStoppedMoving && onRef) {
          if (ref.isFree()) {
            this.awaitingPickup = false;
            this.setReturned();
            return;
          }
          const spot = g.findDeploySpot(this, ref.x, ref.y, ref.w, ref.h, this.x, this.y);
          if (spot) this.doMove2Pos(spot[0], spot[1], true);
          this.requestCarryall();
        } else if (!this.awaitingPickup && g.hasCarryalls(this.owner) && ref.isFree()) {
          const [cx, cy] = ref.closestPoint(this.x, this.y);
          if (blockDistance(this.x, this.y, cx, cy) >= MIN_CARRYALL_LIFT_DISTANCE) this.requestCarryall();
        }
        if (!this.awaitingPickup && !this.moving && this.path.length === 0 && this.destination && (this.destination.x !== this.x || this.destination.y !== this.y)) {
          if (++this.returnPathFailCounter >= 300) {
            if (ref.isFree() && g.hasCarryalls(this.owner)) this.requestCarryall();
            else if (!ref.isFree()) {
              let alt = null;
              let bd = Infinity;
              for (const s of g.structures) {
                if (s.alive && s.type === 'refinery' && s.owner === this.owner && s !== ref && s.isFree()) {
                  const [cx, cy] = s.closestPoint(this.x, this.y);
                  const d = blockDistance(this.x, this.y, cx, cy);
                  if (d < bd) {
                    bd = d;
                    alt = s;
                  }
                }
              }
              if (alt) this.doMove2Object(alt);
            }
            this.returnPathFailCounter = 0;
          }
        } else if (this.moving || this.path.length) this.returnPathFailCounter = 0;
      } else {
        // pick least booked, then closest refinery
        let best = null;
        let leastBookings = Infinity;
        let bd = Infinity;
        for (const s of g.structures) {
          if (!s.alive || s.type !== 'refinery' || s.owner !== this.owner) continue;
          const [cx, cy] = s.closestPoint(this.x, this.y);
          const d = blockDistance(this.x, this.y, cx, cy);
          if (s.bookings < leastBookings || (s.bookings === leastBookings && d < bd)) {
            leastBookings = s.bookings;
            bd = d;
            best = s;
          }
        }
        if (best) this.doMove2Object(best);
        else {
          this.returning = false;
          this.setDestination(this.x, this.y);
        }
      }
    } else if (this.harvestingMode && !this.hasBookedCarrier() && this.destination && blockDistance(this.x, this.y, this.destination.x, this.destination.y) >= MIN_CARRYALL_LIFT_DISTANCE && g.hasCarryalls(this.owner)) {
      this.requestCarryall();
    } else if (this.respondable && !this.harvestingMode && this.attackMode !== MODE.STOP) {
      if (this.spiceCheckCounter === 0) {
        if (this.destination && (this.destination.x !== this.x || this.destination.y !== this.y) && this.path.length === 0) {
          this.setGuardPointRaw(this.x, this.y);
        }
        const gp = this.guardPoint || { x: this.x, y: this.y };
        const found = g.findSpice(gp.x, gp.y);
        if (found) {
          this.setDestination(found[0], found[1]);
          this.setGuardPointRaw(found[0], found[1]);
          this.harvestingMode = true;
        } else {
          this.setDestination(this.x, this.y);
          this.setGuardPointRaw(this.x, this.y);
          this.harvestingMode = false;
        }
        this.spiceCheckCounter = 100;
      } else this.spiceCheckCounter--;
    }
  }

  setGuardPointRaw(x, y) {
    this.guardPoint = { x, y };
  }

  destroy() {
    if (!this.alive) return;
    const g = this.game;
    const map = g.map;
    if (!this.hidden && this.spice > 0 && map.inBounds(this.x, this.y)) {
      const spread = this.spice * 0.75;
      const r = Math.round(this.spice / 210);
      const tiles = [];
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          const x = this.x + i;
          const y = this.y + j;
          if (!map.inBounds(x, y)) continue;
          if (Math.hypot(i, j) + 0.0005 > r) continue;
          const t = map.getType(x, y);
          if (t === T.SAND || t === T.SPICE || t === T.THICK_SPICE || t === T.DUNES) tiles.push([x, y]);
        }
      }
      for (const [x, y] of tiles) {
        const k = map.idx(x, y);
        const t = map.types[k];
        if (t !== T.SPICE && t !== T.THICK_SPICE) map.setType(x, y, T.SPICE);
        map.spice[k] += spread / tiles.length;
      }
      map.spiceDirty = true;
    }
    if (!this.hidden) g.events.emit('explosion', { x: this.px, y: this.py, kind: 'harvester' });
    super.destroy();
  }
}

export function isSpiceTile(t) {
  return t === T.SPICE || t === T.THICK_SPICE;
}

// ---------------------------------------------------------------------------
// Sandworm
// ---------------------------------------------------------------------------
export class Sandworm extends GroundUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.attackMode = MODE.AMBUSH;
    this.kills = 0;
    this.attackFrame = -1; // >=0 while eating animation runs
    this.attackFrameTimer = 0;
    this.respondable = false;
    this.warned = false;
    this.sleepTimer = 0;
    this.trail = []; // recent tiles for ripple visual
    this.region = -1;
  }

  canAttackAnything() {
    return true;
  }

  canPass(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return false;
    const t = map.getType(x, y);
    if (!isSandLike(t)) return false;
    const u = map.underground[map.idx(x, y)];
    return !u || u === this.id;
  }

  stepCost(x, y) {
    return 1;
  }

  currentSpeed() {
    return this.maxSpeed() * 0.75;
  }

  // Sandworm::canAttack — any ground unit on sand in the same sand region (no team check)
  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (!obj.isUnit || obj.isAir || obj.type === 'sandworm') return false;
    const map = this.game.map;
    if (!this.canPassForTarget(obj.x, obj.y)) return false;
    return this.game.sandRegion(obj.x, obj.y) === this.game.sandRegion(this.x, this.y);
  }

  canPassForTarget(x, y) {
    const map = this.game.map;
    return map.inBounds(x, y) && isSandLike(map.getType(x, y));
  }

  findTarget() {
    if (this.attackMode === MODE.STOP) return null;
    let maxDist;
    switch (this.attackMode) {
      case MODE.GUARD:
      case MODE.AMBUSH: maxDist = this.viewRange(); break;
      case MODE.HUNT: maxDist = this.viewRange() * 2; break;
      default: maxDist = Infinity;
    }
    if (this.forced) maxDist = Infinity;
    const g = this.game;
    let best = null;
    let bestPrio = -1;
    for (const u of g.units) {
      if (!this.canAttack(u)) continue;
      const d = blockDistance(this.x, this.y, u.x, u.y);
      if (d > maxDist) continue;
      let base = u.isInfantry ? 100 : u.type === 'harvester' || u.isTracked ? 1000 : 5000;
      if (u.moving || u.target) base *= 4;
      const dd = Math.max(1, Math.round(d));
      let prio = Math.floor(base / dd);
      if (dd < 2) prio *= 2;
      if (prio > bestPrio) {
        bestPrio = prio;
        best = u;
      }
    }
    return best;
  }

  engageTarget() {
    const t = this.target;
    if (t && (!t.alive || t.hidden || !this.canAttack(t))) {
      this.setTarget(null);
      if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
      return;
    }
    if (t) {
      const d = blockDistance(this.x, this.y, t.x, t.y);
      if (!this.forced && d > this.viewRange() * 2) {
        this.setTarget(null);
        this.attackMode = MODE.AMBUSH;
        if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
        return;
      }
      if (this.x !== t.x || this.y !== t.y) {
        if (!this.destination || this.destination.x !== t.x || this.destination.y !== t.y) {
          this.setDestination(t.x, t.y);
          this.clearPath();
        }
      } else if (!this.moving) {
        this.attack();
      }
    }
  }

  attack() {
    if (this.primaryWeaponTimer > 0 || this.attackFrame >= 0) return false;
    this.attackFrame = 0;
    this.attackFrameTimer = 0;
    this.primaryWeaponTimer = this.reloadTime();
    this.game.events.emit('wormAttack', { worm: this, x: this.px, y: this.py });
    if (!this.warned && this.target && this.target.owner === this.game.player) {
      this.warned = true;
      this.game.warn('Wormsign detected!', 'worm', { x: this.px, y: this.py });
    }
    return true;
  }

  handleDamage(damage, damager, owner) {
    super.handleDamage(damage, damager, owner);
    if (damage > 0 && this.health > 0) {
      this.attackMode = MODE.HUNT;
      if (damager && damager.isUnit && !damager.isAir && damager.alive && this.canPassForTarget(damager.x, damager.y)) {
        this.doAttackObject(damager, true);
      }
    }
  }

  update() {
    if (this.sleepTimer > 0) {
      if (--this.sleepTimer === 0) this.respawn();
      return true;
    }
    if (this.attackFrame >= 0 && this.active) {
      this.attackFrameTimer++;
      if (this.attackFrameTimer >= 10) {
        this.attackFrameTimer = 0;
        this.attackFrame++;
        if (this.attackFrame === 1) {
          // the bite: kill every ground unit in this tile
          const g = this.game;
          const prevTarget = this.target;
          g.damageArea({ id: this.id, owner: this.owner, type: B.SANDWORM, isBullet: false, worm: this }, this.x * TILESIZE + 32, this.y * TILESIZE + 32, 5000, 0, false);
          if (prevTarget && !prevTarget.alive) this.kills++;
          else if (prevTarget && prevTarget.health <= 0) this.kills++;
        }
        if (this.attackFrame >= 9) {
          this.attackFrame = -1;
          if (this.kills >= 3) {
            this.sleepOrDie();
            return this.alive;
          }
        }
      }
    }
    if (this.moving) {
      const last = this.trail[this.trail.length - 1];
      if (!last || last[0] !== this.x || last[1] !== this.y) {
        this.trail.push([this.x, this.y]);
        if (this.trail.length > 6) this.trail.shift();
      }
    }
    const r = super.update();
    if (r && this.alive && this.health <= this.maxHealth / 2 && this.attackFrame < 0) {
      this.sleepOrDie();
    }
    return this.alive;
  }

  checkPos() {
    // worms don't trigger blooms
    if (this.justStoppedMoving) {
      this.rx = this.x * TILESIZE + 32;
      this.ry = this.y * TILESIZE + 32;
    }
  }

  sleepOrDie() {
    const g = this.game;
    if (g.settings.killedWormsDropSpice) g.spiceField(this.x, this.y, 4);
    if (g.settings.wormsRespawn) {
      g.events.emit('wormSubmerge', { x: this.px, y: this.py });
      this.unassignFromMap(this.x, this.y);
      this.hidden = true;
      this.active = false;
      this.health = this.maxHealth;
      this.kills = 0;
      this.setTarget(null);
      this.clearPath();
      this.moving = false;
      this.trail = [];
      this.sleepTimer = g.rng.randInt(10000, 50000);
    } else {
      g.events.emit('wormSubmerge', { x: this.px, y: this.py });
      this.hidden = true;
      this.setHealth(0);
      this.destroy();
    }
  }

  respawn() {
    const g = this.game;
    const map = g.map;
    for (let i = 0; i < 1000; i++) {
      const x = g.rng.randInt(0, map.width - 1);
      const y = g.rng.randInt(0, map.height - 1);
      if (this.canPass(x, y)) {
        this.hidden = false;
        this.active = true;
        this.setLocation(x, y);
        this.attackMode = MODE.AMBUSH;
        this.guardPoint = { x, y };
        this.destination = { x, y };
        return;
      }
    }
    this.sleepTimer = g.rng.randInt(10000, 50000);
  }

  isEating() {
    return this.attackFrame >= 0;
  }

  destroy() {
    super.destroy();
  }
}
