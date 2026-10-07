import { TILESIZE, T } from '../core/constants.js';
import { GameObject, MODE, blockDistance, dirIndex } from './object.js';
import { terrainDifficulty, INFANTRY_SLOTS } from './map.js';
import { Bullet, B } from './bullets.js';
import { UNIT_CLASS } from '../data/gamedata.js';

export const DIAG = Math.SQRT1_2;
const UNIT_IDLE_TIMER = 315;
export const MIN_CARRYALL_LIFT_DISTANCE = 6;
export const DEVIATION_TIME = 7500;

// direction index -> unit vector in map space (x east, y south)
export const DIR_VEC = [
  [1, 0], [DIAG, -DIAG], [0, -1], [-DIAG, -DIAG], [-1, 0], [-DIAG, DIAG], [0, 1], [DIAG, DIAG],
];
const DIR_STEP = [
  [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1],
];

// Weapons by unit type: bullet type and number of barrels (UnitBase::numWeapons)
export const WEAPONS = {
  soldier: { bullet: B.SHELL_SMALL, n: 1 },
  trooper: { bullet: B.SMALL_ROCKET, n: 1 },
  trike: { bullet: B.SHELL_SMALL, n: 2 },
  raider: { bullet: B.SHELL_SMALL, n: 2 },
  quad: { bullet: B.SHELL_SMALL, n: 2 },
  tank: { bullet: B.SHELL_MEDIUM, n: 1 },
  siegeTank: { bullet: B.SHELL_LARGE, n: 2 },
  devastator: { bullet: B.SHELL_LARGE, n: 2 },
  launcher: { bullet: B.ROCKET, n: 2 },
  deviator: { bullet: B.DROCKET, n: 1 },
  sonicTank: { bullet: B.SONIC, n: 1 },
  ornithopter: { bullet: B.SMALL_ROCKET, n: 1 },
};

// Infantry sub-tile offsets in pixels (slot 0 = center)
export const INF_OFFSET = [
  [32, 32], [16, 16], [48, 16], [16, 48], [48, 48],
];

function angleDiff8(from, to) {
  // shortest signed diff in eighths
  let d = (to - from) % 8;
  if (d > 4) d -= 8;
  if (d < -4) d += 8;
  return d;
}

export class Unit extends GameObject {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.isUnit = true;
    this.moveClass = UNIT_CLASS[type] || 'tracked';
    this.isInfantry = this.moveClass === 'infantry';
    this.isAir = this.moveClass === 'air';
    this.isTracked = this.moveClass === 'tracked';
    const a = game.rng.randInt(0, 7);
    this.angle = a; // continuous, in eighths of a full turn
    this.drawnAngle = a;
    this.rx = 0; // world pixels (center)
    this.ry = 0;
    this.prevRx = 0;
    this.prevRy = 0;
    this.moving = false;
    this.justStoppedMoving = false;
    this.nextSpot = null;
    this.nextSpotFound = false;
    this.nextSpotAngle = -1;
    this.targetAngle = -1;
    this.destination = null;
    this.guardPoint = null;
    this.oldLocation = null;
    this.path = [];
    this.recalculatePathTimer = 0;
    this.findTargetTimer = 0;
    this.primaryWeaponTimer = 0;
    this.secondaryWeaponTimer = -1;
    this.carryallRequestCooldown = 0;
    this.deviationTimer = -1;
    this.noCloserPointCount = 0;
    this.noProgressCount = 0;
    this.lastDistanceToDestination = -1;
    this.goingToRepairYard = false;
    this.bFollow = false;
    this.pickedUp = false;
    this.awaitingPickup = false;
    this.bookedCarrier = null;
    this.infSlot = 0;
    this.stepFromX = 0;
    this.stepFromY = 0;
    this.stepToX = 0;
    this.stepToY = 0;
    this.stepLen = 0;
    this.stepDone = 0;
    this.stepSwitched = false;
    this.speed = 0;
    this.weapon = WEAPONS[type] || null;
    this.numWeapons = this.weapon ? this.weapon.n : 0;
    this.hidden = false; // not on map (inside carryall/structure)
    this.lastFireCycle = -999;
    this.kills = 0;
    this.visualFire = 0; // render recoil counter
  }

  get px() {
    return this.rx / TILESIZE;
  }

  get py() {
    return this.ry / TILESIZE;
  }

  canAttackAnything() {
    return this.numWeapons > 0;
  }

  centerPoint() {
    return [this.rx, this.ry];
  }

  closestCenterPoint() {
    return [this.rx, this.ry];
  }

  maxSpeed() {
    return this.st.maxSpeed;
  }

  // ---------------------------------------------------------------------------
  // map assignment
  assignToMap(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return;
    const i = map.idx(x, y);
    if (this.isInfantry) {
      let slot = -1;
      const base = i * INFANTRY_SLOTS;
      for (let k = 0; k < INFANTRY_SLOTS; k++) {
        if (map.infantry[base + k] === this.id) {
          slot = k;
          break;
        }
      }
      if (slot < 0) {
        for (let k = 0; k < INFANTRY_SLOTS; k++) {
          if (!map.infantry[base + k]) {
            slot = k;
            break;
          }
        }
      }
      if (slot < 0) slot = 0;
      map.infantry[base + slot] = this.id;
      this.infSlot = slot;
    } else if (this.isAir) {
      map.air[i] = this.id;
    } else if (this.type === 'sandworm') {
      map.underground[i] = this.id;
    } else {
      // never overwrite a structure (harvester entering a refinery, unit entering a repair yard)
      const cur = map.ground[i];
      const o = cur ? this.game.objects.get(cur) : null;
      if (!(o && o.isStructure)) map.ground[i] = this.id;
    }
    map.pathRevision++;
  }

  unassignFromMap(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return;
    const i = map.idx(x, y);
    if (this.isInfantry) {
      const base = i * INFANTRY_SLOTS;
      for (let k = 0; k < INFANTRY_SLOTS; k++) if (map.infantry[base + k] === this.id) map.infantry[base + k] = 0;
    } else if (this.isAir) {
      if (map.air[i] === this.id) map.air[i] = 0;
    } else if (this.type === 'sandworm') {
      if (map.underground[i] === this.id) map.underground[i] = 0;
    } else if (map.ground[i] === this.id) {
      map.ground[i] = 0;
    }
    map.pathRevision++;
  }

  // place unit on tile (scenario / deploy)
  setLocation(x, y) {
    if (this.x >= 0) this.unassignFromMap(this.x, this.y);
    if (this.nextSpot && this.moving) this.unassignFromMap(this.nextSpot.x, this.nextSpot.y);
    this.x = x;
    this.y = y;
    this.assignToMap(x, y);
    if (this.isInfantry) {
      this.rx = x * TILESIZE + INF_OFFSET[this.infSlot][0];
      this.ry = y * TILESIZE + INF_OFFSET[this.infSlot][1];
    } else {
      this.rx = x * TILESIZE + TILESIZE / 2;
      this.ry = y * TILESIZE + TILESIZE / 2;
    }
    this.prevRx = this.rx;
    this.prevRy = this.ry;
    this.moving = false;
    this.justStoppedMoving = false;
    this.nextSpot = null;
    this.nextSpotFound = false;
    this.pickedUp = false;
    this.hidden = false;
    this.setTarget(null);
    this.clearPath();
  }

  // UnitBase::deploy — place unit coming out of a factory/carryall
  deploy(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return;
    this.setLocation(x, y);
    if (!this.destination) this.destination = { x, y };
    if (!this.guardPoint) this.guardPoint = { x, y };
    this.active = true;
    this.respondable = true;
    this.viewMap();
    const t = map.getType(x, y);
    if (!this.isAir && this.type !== 'sandworm' && (t === T.SPICE_BLOOM || t === T.SPECIAL_BLOOM)) {
      this.game.triggerBloom(x, y, this.owner, t === T.SPECIAL_BLOOM);
      if (t === T.SPICE_BLOOM) {
        this.hidden = true;
        this.setHealth(0);
      }
    }
  }

  viewMap() {
    if (this.isAir || this.type === 'sandworm' || this.x < 0) return;
    this.game.viewMapForHouse(this.owner, this.x, this.y, this.viewRange());
  }

  clearPath() {
    this.path = [];
    this.nextSpotFound = false;
    this.recalculatePathTimer = 0;
  }

  setDestination(x, y) {
    if (x === null || x === undefined) {
      this.destination = null;
      return;
    }
    if (this.game.map.inBounds(x, y)) this.destination = { x, y };
  }

  setGuardPoint(x, y) {
    if (x === null || x === undefined) {
      this.guardPoint = null;
      return;
    }
    if (this.game.map.inBounds(x, y)) this.guardPoint = { x, y };
  }

  setTarget(obj) {
    this.attackPos = null;
    this.bFollow = false;
    this.targetAngle = -1;
    if (this.goingToRepairYard && this.target && this.target.type === 'repairYard' && this.target.unbook) {
      this.target.unbook();
      this.goingToRepairYard = false;
    }
    super.setTarget(obj);
    if (obj && obj.owner === this.owner && obj.type === 'repairYard' && obj.book) {
      obj.book();
      this.goingToRepairYard = true;
    }
  }

  releaseTarget() {
    if (this.forced) this.guardPoint = { x: this.x, y: this.y };
    if (this.guardPoint) this.setDestination(this.guardPoint.x, this.guardPoint.y);
    this.findTargetTimer = 0;
    this.forced = false;
    this.setTarget(null);
  }

  // ---------------------------------------------------------------------------
  // Commands
  doMove2Pos(x, y, forced) {
    if (this.attackMode === MODE.CAPTURE || this.attackMode === MODE.HUNT) this.doSetAttackMode(MODE.GUARD);
    if (this.game.map.inBounds(x, y)) {
      if (!this.destination || x !== this.destination.x || y !== this.destination.y) {
        this.clearPath();
        this.findTargetTimer = 0;
      }
      this.setTarget(null);
      this.setDestination(x, y);
      this.forced = forced;
      this.setGuardPoint(x, y);
    } else {
      this.setTarget(null);
      this.setDestination(this.x, this.y);
      this.forced = forced;
      this.setGuardPoint(this.x, this.y);
    }
  }

  doMove2Object(obj) {
    if (!obj || obj === this) return;
    if (this.attackMode === MODE.CAPTURE || this.attackMode === MODE.HUNT) this.doSetAttackMode(MODE.GUARD);
    this.destination = null;
    this.setTarget(obj);
    this.forced = true;
    this.bFollow = true;
    this.clearPath();
    this.findTargetTimer = 0;
  }

  doAttackPos(x, y, forced) {
    if (!this.game.map.inBounds(x, y)) return;
    if (this.attackMode === MODE.CAPTURE) this.doSetAttackMode(MODE.GUARD);
    this.setDestination(x, y);
    this.setTarget(null);
    this.forced = forced;
    this.attackPos = { x, y };
    this.clearPath();
    this.findTargetTimer = 0;
  }

  doAttackObject(obj, forced) {
    if (!obj || obj === this) return;
    if (!this.canAttackAnything() && this.type !== 'harvester') return;
    if (this.attackMode === MODE.CAPTURE) this.doSetAttackMode(MODE.GUARD);
    this.destination = null;
    this.setTarget(obj);
    if (this.goingToRepairYard && this.target && this.target.type === 'repairYard') {
      this.target.unbook();
      this.goingToRepairYard = false;
    }
    this.forced = forced;
    this.clearPath();
    this.findTargetTimer = 0;
  }

  doSetAttackMode(mode) {
    this.attackMode = mode;
    if (mode === MODE.GUARD || mode === MODE.STOP) {
      if (this.moving && !this.justStoppedMoving && this.nextSpot) this.doMove2Pos(this.nextSpot.x, this.nextSpot.y, false);
      else this.doMove2Pos(this.x, this.y, false);
    }
    if (mode === MODE.HUNT && !this.target) this.findTargetTimer = 0;
  }

  // ---------------------------------------------------------------------------
  update() {
    if (this.active) {
      this.prevRx = this.rx;
      this.prevRy = this.ry;
      this.targeting();
      this.navigate();
      this.move();
      if (this.active) this.turn();
    }
    if (this.health <= 0) {
      this.destroy();
      return false;
    }
    if (this.recalculatePathTimer > 0) this.recalculatePathTimer--;
    if (this.findTargetTimer > 0) this.findTargetTimer--;
    if (this.primaryWeaponTimer > 0) this.primaryWeaponTimer--;
    if (this.carryallRequestCooldown > 0) this.carryallRequestCooldown--;
    if (this.secondaryWeaponTimer > 0) this.secondaryWeaponTimer--;
    if (this.deviationTimer > 0) {
      if (--this.deviationTimer <= 0) this.quitDeviation();
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Targeting (UnitBase::targeting)
  targeting() {
    if (this.findTargetTimer === 0) {
      const m = this.attackMode;
      if (m !== MODE.STOP && m !== MODE.CARRYALL) {
        if (this.target && !this.attackPos && !this.forced && (m === MODE.GUARD || m === MODE.AREAGUARD || m === MODE.AMBUSH || m === MODE.HUNT)) {
          if (!this.isInWeaponRange(this.target)) {
            const t = this.findTarget();
            if (t) {
              this.doAttackObject(t, this.type === 'saboteur');
              this.findTargetTimer = 500;
            }
          }
        }
        if (!this.target && !this.attackPos && !this.moving && !this.justStoppedMoving && !this.forced) {
          const t = this.findTarget();
          if (t) {
            let inRange = this.isInGuardRange(t);
            if (this.attackMode === MODE.AMBUSH) {
              const c = t.centerPoint();
              const d = blockDistance(this.x * TILESIZE + 32, this.y * TILESIZE + 32, c[0], c[1]);
              if (d <= this.viewRange() * TILESIZE) {
                this.doSetAttackMode(MODE.HUNT);
                inRange = true;
              }
            }
            if (inRange) {
              this.doAttackObject(t, this.type === 'saboteur');
              if (this.type === 'sandworm') this.attackMode = MODE.HUNT;
            }
          } else if (this.attackMode === MODE.HUNT) {
            this.setGuardPoint(this.x, this.y);
            this.doSetAttackMode(MODE.GUARD);
          }
          this.findTargetTimer = 62;
        }
      }
    }
    this.engageTarget();
  }

  guardCheckRange() {
    switch (this.attackMode) {
      case MODE.GUARD: return this.weaponRange();
      case MODE.AREAGUARD: return this.type === 'launcher' ? 12 : 10;
      case MODE.AMBUSH: return this.viewRange();
      default: return 0;
    }
  }

  isInGuardRange(obj) {
    let range;
    let fx;
    let fy;
    const gp = this.guardPoint || { x: this.x, y: this.y };
    switch (this.attackMode) {
      case MODE.GUARD: range = this.weaponRange(); fx = gp.x * TILESIZE + 32; fy = gp.y * TILESIZE + 32; break;
      case MODE.AREAGUARD: range = this.type === 'launcher' ? 12 : 10; [fx, fy] = this.centerPoint(); break;
      case MODE.AMBUSH: range = this.viewRange(); fx = gp.x * TILESIZE + 32; fy = gp.y * TILESIZE + 32; break;
      case MODE.HUNT: return true;
      default: return false;
    }
    if (this.type === 'sandworm') range = this.viewRange();
    const c = obj.centerPoint();
    return blockDistance(fx, fy, c[0], c[1]) <= range * TILESIZE;
  }

  isInAttackRange(obj) {
    let range;
    let fx;
    let fy;
    const gp = this.guardPoint || { x: this.x, y: this.y };
    switch (this.attackMode) {
      case MODE.GUARD: range = this.weaponRange(); fx = gp.x * TILESIZE + 32; fy = gp.y * TILESIZE + 32; break;
      case MODE.AREAGUARD: range = this.type === 'launcher' ? 12 : 10; [fx, fy] = this.centerPoint(); break;
      case MODE.AMBUSH: range = this.viewRange() + 1; fx = gp.x * TILESIZE + 32; fy = gp.y * TILESIZE + 32; break;
      case MODE.HUNT: return true;
      default: return false;
    }
    if (this.type === 'sandworm') range = this.viewRange() + 1;
    const c = obj.centerPoint();
    return blockDistance(fx, fy, c[0], c[1]) <= range * TILESIZE;
  }

  isInWeaponRange(obj) {
    if (!obj) return false;
    const [cx, cy] = obj.closestPoint(this.x, this.y);
    return blockDistance(this.x, this.y, cx, cy) <= this.weaponRange();
  }

  // ObjectBase::findTarget — closest attackable, visible object within mode range
  findTarget() {
    let range = 0;
    let hunt = false;
    switch (this.attackMode) {
      case MODE.GUARD: range = this.weaponRange(); break;
      case MODE.AREAGUARD: range = this.type === 'launcher' ? 12 : 10; break;
      case MODE.AMBUSH: range = this.viewRange(); break;
      case MODE.HUNT: hunt = true; break;
      default: return null;
    }
    return this.game.findClosestTarget(this, hunt ? Infinity : range, hunt);
  }

  // ---------------------------------------------------------------------------
  // UnitBase::engageTarget
  engageTarget() {
    const t = this.target;
    if (t && (!t.alive || !t.active || t.hidden)) {
      this.releaseTarget();
      return;
    }
    if (t && !this.targetFriendly && !this.canAttack(t) && !(this.type === 'harvester' || this.type === 'mcv')) {
      this.releaseTarget();
      return;
    }
    if (t && !this.targetFriendly && !this.forced && !this.isInAttackRange(t)) {
      this.releaseTarget();
      return;
    }
    if (t) {
      const [tlx, tly] = t.closestPoint(this.x, this.y);
      if (!this.destination || this.destination.x !== tlx || this.destination.y !== tly) {
        const moveDist = this.destination ? blockDistance(this.destination.x, this.destination.y, tlx, tly) : 99;
        const distToTarget = blockDistance(this.x, this.y, tlx, tly);
        if (moveDist > 1 && distToTarget <= 10) this.clearPath();
        this.destination = { x: tlx, y: tly };
      }
      this.targetDistance = blockDistance(this.x, this.y, tlx, tly);
      const newTargetAngle = dirIndex(this.x, this.y, tlx, tly);
      if (this.bFollow) {
        this.setDestination(tlx, tly);
        return;
      }
      if (this.targetDistance > this.weaponRange()) {
        if (t.isAir) {
          this.releaseTarget();
          return;
        }
        this.setDestination(tlx, tly);
        return;
      }
      if (this.targetFriendly && !this.forced) return;
      if (this.goingToRepairYard) {
        this.targetAngle = -1;
      } else if (this.attackMode === MODE.CAPTURE) {
        this.setDestination(tlx, tly);
        this.targetAngle = -1;
      } else if (this.isTracked && t.isInfantry && !this.targetFriendly && this.game.map.getType(tlx, tly) !== T.MOUNTAIN && this.forced) {
        this.setDestination(tlx, tly);
        this.targetAngle = -1;
      } else if (!this.isAir) {
        this.setDestination(this.x, this.y);
        this.targetAngle = newTargetAngle;
      }
      if (newTargetAngle < 0 || this.attackAngle() === newTargetAngle) this.attack();
    } else if (this.attackPos) {
      const ap = this.attackPos;
      this.targetDistance = blockDistance(this.x, this.y, ap.x, ap.y);
      const newTargetAngle = dirIndex(this.x, this.y, ap.x, ap.y);
      if (this.targetDistance <= this.weaponRange()) {
        if (!this.isAir) {
          this.setDestination(this.x, this.y);
          this.targetAngle = newTargetAngle;
        }
        if (newTargetAngle < 0 || this.attackAngle() === newTargetAngle) this.attack();
      } else {
        this.targetAngle = -1;
      }
    }
  }

  attackAngle() {
    return this.drawnAngle;
  }

  // UnitBase::attack
  attack() {
    if (!this.numWeapons) return false;
    const canPrimary = this.primaryWeaponTimer === 0;
    const canSecondary = this.numWeapons === 2 && this.secondaryWeaponTimer === 0 && !this.badlyDamaged;
    if (!canPrimary && !canSecondary) return false;
    const g = this.game;
    const t = this.target;
    let tx;
    let ty;
    let air = false;
    if (t) {
      [tx, ty] = t.closestCenterPoint(this.x, this.y);
      air = !!t.isAir;
    } else if (this.attackPos) {
      tx = this.attackPos.x * TILESIZE + 32;
      ty = this.attackPos.y * TILESIZE + 32;
    } else return false;
    const [cx, cy] = this.centerPoint();
    let bullet = this.weapon.bullet;
    let damage = this.weaponDamage();
    if (this.type === 'trooper' && !air) {
      if (Math.hypot(tx - cx, ty - cy) <= 2 * TILESIZE) {
        bullet = B.SHELL_SMALL;
        damage -= Math.floor(damage / 4);
      }
    }
    const fire = () => {
      g.addBullet(new Bullet(g, this, cx, cy, tx, ty, bullet, damage, air, t));
      if (t) g.viewMapForHouse(t.owner, this.x, this.y, 2);
      this.lastFireCycle = g.cycle;
      this.visualFire++;
      g.events.emit('fire', { unit: this, bullet, x: cx / TILESIZE, y: cy / TILESIZE, tx: tx / TILESIZE, ty: ty / TILESIZE });
      if (this.attackPos && this.type !== 'sonicTank') {
        const tt = g.map.getType(this.attackPos.x, this.attackPos.y);
        if (tt === T.SPICE_BLOOM || tt === T.SPECIAL_BLOOM) {
          this.setDestination(this.x, this.y);
          this.forced = false;
          this.attackPos = null;
        }
      }
      if (this.deviationTimer > 0) this.deviationTimer = Math.max(0, this.deviationTimer - 1250);
    };
    if (canPrimary) {
      fire();
      this.primaryWeaponTimer = this.reloadTime();
      this.secondaryWeaponTimer = 15;
    }
    if (this.numWeapons === 2 && this.secondaryWeaponTimer === 0 && !this.badlyDamaged) {
      fire();
      this.secondaryWeaponTimer = -1;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Movement
  canPass(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return false;
    const i = map.idx(x, y);
    if (map.types[i] === T.MOUNTAIN) return false;
    const gid = map.ground[i];
    if (gid && gid !== this.id) {
      const o = this.game.objects.get(gid);
      if (o && o === this.target && this.targetFriendly && o.isStructure && o.team === this.team) {
        return this.goingToRepairYard && o.type === 'repairYard' && o.isFree();
      }
      return false;
    }
    // infantry on tile blocks vehicles
    if (map.infantryCount(x, y) > 0) return false;
    return true;
  }

  pathDestination() {
    if (this.target && this.target.alive) {
      return this.target.closestPoint(this.x, this.y);
    }
    return this.destination ? [this.destination.x, this.destination.y] : null;
  }

  stepCost(x, y, fromX, fromY, prevDir) {
    let c = terrainDifficulty(this.game.map.getType(x, y), this.moveClass);
    return c;
  }

  searchPath() {
    const g = this.game;
    const dest = this.pathDestination();
    if (!dest) return false;
    const [tx, ty] = dest;
    this.recalculatePathTimer = 125;
    // adjacent but blocked target => no search
    if (blockDistance(this.x, this.y, tx, ty) <= 1.5 && !this.canPass(tx, ty) && !(this.target && this.target.isStructure)) {
      this.path = [];
      return false;
    }
    const path = g.pathfinder.find(this.x, this.y, tx, ty, (x, y) => this.canPass(x, y), {
      cost: (x, y) => this.stepCost(x, y),
      maxNodes: 5000,
    });
    this.path = path;
    // progress / stuck detection
    const curDist = blockDistance(this.x, this.y, this.destination ? this.destination.x : tx, this.destination ? this.destination.y : ty);
    if (this.lastDistanceToDestination >= 0) {
      if (curDist < this.lastDistanceToDestination - 0.5) this.noProgressCount = 0;
      else {
        this.noProgressCount++;
        if (this.noProgressCount >= 3 && this.carryallRequestCooldown <= 0 && !this.isInfantry && !this.isAir) {
          const house = g.houses[this.owner];
          if (house && g.hasCarryalls(this.owner) && !this.bookedCarrier && !house.isHuman && curDist >= MIN_CARRYALL_LIFT_DISTANCE) {
            this.requestCarryall();
            this.noProgressCount = 0;
            this.carryallRequestCooldown = 125;
          }
        }
      }
    }
    this.lastDistanceToDestination = curDist;
    if (path.length === 0) {
      if (++this.noCloserPointCount >= 3) this.onPathFailed();
      return false;
    }
    return true;
  }

  onPathFailed() {
    const g = this.game;
    if (this.target && this.targetFriendly && this.target.type !== 'repairYard' && !(this.target.type === 'refinery' && this.type === 'harvester')) {
      this.setTarget(null);
    }
    const house = g.houses[this.owner];
    if (!this.isInfantry && !this.isAir && g.hasCarryalls(this.owner) && !this.bookedCarrier && house && !house.isHuman && this.destination && blockDistance(this.x, this.y, this.destination.x, this.destination.y) >= MIN_CARRYALL_LIFT_DISTANCE) {
      this.requestCarryall();
    } else {
      this.setDestination(this.x, this.y);
      this.forced = false;
    }
    this.noCloserPointCount = 0;
  }

  navigationPhase() {
    return (this.game.cycle + this.id * 1337) % 5 === 0;
  }

  navigate() {
    if (this.awaitingPickup) return;
    if (!this.isAir && !this.navigationPhase()) return;
    if (this.moving || this.justStoppedMoving) return;
    const dest = this.destination;
    if (dest && (this.x !== dest.x || this.y !== dest.y)) {
      if (!this.nextSpotFound) {
        if (this.path.length === 0 && this.recalculatePathTimer === 0) this.searchPath();
        if (this.path.length > 0) {
          const [nx, ny] = this.path.shift();
          this.nextSpot = { x: nx, y: ny };
          this.nextSpotFound = true;
          this.recalculatePathTimer = 0;
          this.noCloserPointCount = 0;
        }
      } else {
        const ns = this.nextSpot;
        const a = dirIndex(this.x, this.y, ns.x, ns.y);
        if (a >= 0) this.nextSpotAngle = a;
        // next spot must be adjacent
        if (Math.abs(ns.x - this.x) > 1 || Math.abs(ns.y - this.y) > 1) {
          this.clearPath();
          return;
        }
        if (!this.canPass(ns.x, ns.y)) {
          const map = this.game.map;
          const gid = map.ground[map.idx(ns.x, ns.y)];
          const blocker = gid ? this.game.objects.get(gid) : null;
          if (blocker && blocker.isUnit && blocker.moving) return; // wait for it
          this.clearPath();
        } else if (this.drawnAngle === this.nextSpotAngle) {
          this.startStep(ns.x, ns.y);
        }
      }
    } else if (!this.target && !this.attackPos) {
      if ((this.game.cycle + this.id * 1337) % UNIT_IDLE_TIMER === 0) this.idleAction();
    }
  }

  idleAction() {
    if (!this.isAir && this.type !== 'harvester' && this.attackMode === MODE.GUARD && !this.isInfantry) {
      if (this.game.rng.randInt(0, 4) === 0) this.nextSpotAngle = this.game.rng.randInt(0, 7);
    }
  }

  currentSpeed() {
    let v = this.maxSpeed();
    const map = this.game.map;
    v *= 2 - terrainDifficulty(map.getType(this.x, this.y), this.moveClass);
    if (this.badlyDamaged) v *= 0.75;
    return v;
  }

  startStep(nx, ny) {
    this.moving = true;
    this.nextSpotFound = false;
    this.assignToMap(nx, ny);
    this.angle = this.drawnAngle;
    this.stepFromX = this.rx;
    this.stepFromY = this.ry;
    if (this.isInfantry) {
      const off = INF_OFFSET[this.infSlotFor(nx, ny)];
      this.stepToX = nx * TILESIZE + off[0];
      this.stepToY = ny * TILESIZE + off[1];
    } else {
      this.stepToX = nx * TILESIZE + 32;
      this.stepToY = ny * TILESIZE + 32;
    }
    this.stepLen = Math.hypot(this.stepToX - this.stepFromX, this.stepToY - this.stepFromY) || 1;
    this.stepDone = 0;
    this.stepSwitched = false;
    this.speed = this.currentSpeed();
  }

  infSlotFor(nx, ny) {
    const map = this.game.map;
    const base = map.idx(nx, ny) * INFANTRY_SLOTS;
    for (let k = 0; k < INFANTRY_SLOTS; k++) if (map.infantry[base + k] === this.id) return k;
    return 0;
  }

  move() {
    if (this.moving && !this.justStoppedMoving) {
      let v = this.speed;
      if (this.badlyDamaged && !this.isAir && !this.isInfantry) v *= 0.5;
      this.stepDone += v;
      const t = Math.min(1, this.stepDone / this.stepLen);
      this.rx = this.stepFromX + (this.stepToX - this.stepFromX) * t;
      this.ry = this.stepFromY + (this.stepToY - this.stepFromY) * t;
      if (!this.stepSwitched && this.stepDone >= this.stepLen / 2) {
        this.stepSwitched = true;
        this.unassignFromMap(this.x, this.y);
        this.oldLocation = { x: this.x, y: this.y };
        this.x = this.nextSpot.x;
        this.y = this.nextSpot.y;
        if (this.isInfantry) this.infSlot = this.infSlotFor(this.x, this.y);
        if (!this.isAir && this.type !== 'sandworm') this.viewMap();
      }
      if (this.stepDone >= this.stepLen) {
        if (this.forced && this.destination && this.x === this.destination.x && this.y === this.destination.y && !this.target) {
          this.forced = false;
          if (this.attackMode === MODE.CARRYALL) this.doSetAttackMode(MODE.GUARD);
        }
        this.moving = false;
        this.justStoppedMoving = true;
        this.rx = this.stepToX;
        this.ry = this.stepToY;
        this.oldLocation = null;
        this.game.map.tracks[this.game.map.idx(this.x, this.y)] = this.game.cycle & 0xffff;
      }
    } else {
      this.justStoppedMoving = false;
    }
    this.checkPos();
  }

  turn() {
    if (this.moving || this.justStoppedMoving) return;
    let wanted = -1;
    if (this.nextSpotAngle >= 0) wanted = this.nextSpotAngle;
    else if (this.targetAngle >= 0) wanted = this.targetAngle;
    if (wanted < 0) return;
    if (this.drawnAngle === wanted && Math.abs(angleDiff8(this.angle, wanted)) < 0.01) {
      if (wanted === this.nextSpotAngle && !this.nextSpotFound) this.nextSpotAngle = -1;
      return;
    }
    const ts = this.st.turnSpeed || 0.0625;
    const d = angleDiff8(this.angle, wanted);
    if (Math.abs(d) <= ts) this.angle = wanted;
    else this.angle += Math.sign(d) * ts;
    this.angle = ((this.angle % 8) + 8) % 8;
    this.drawnAngle = Math.round(this.angle) & 7;
  }

  checkPos() {
    // overridden in ground units
  }

  // ---------------------------------------------------------------------------
  handleDamage(damage, damager, damagerOwner) {
    if (this.deviationTimer > 0) this.deviationTimer = Math.max(0, this.deviationTimer - damage * 1250);
    super.handleDamage(damage, damager, damagerOwner);
    if (damager && damager.alive && damager.isUnit !== undefined) {
      if (this.attackMode === MODE.HUNT && !this.forced) {
        if (this.canAttack(damager)) {
          if (!this.target || !this.isInWeaponRange(this.target)) this.doAttackObject(damager, false);
        }
      }
      if (damage > 0 && this.attackMode === MODE.AMBUSH && this.type !== 'harvester') {
        this.doSetAttackMode(MODE.HUNT);
        this.findTargetTimer = 0;
      }
      if (damage > 0 && this.canAttack(damager) && (this.attackMode === MODE.GUARD || this.attackMode === MODE.AREAGUARD || this.attackMode === MODE.HUNT)) {
        this.findTargetTimer = 0;
      }
    }
  }

  // UnitBase::deviate
  deviate(newOwner) {
    if (newOwner === this.owner) return;
    const g = this.game;
    g.deselect(this);
    this.setTarget(null);
    this.setGuardPoint(this.x, this.y);
    this.setDestination(this.x, this.y);
    this.clearPath();
    this.attackMode = MODE.GUARD;
    g.changeOwner(this, newOwner);
    this.deviationTimer = DEVIATION_TIME;
    g.events.emit('deviated', { unit: this });
  }

  quitDeviation() {
    if (this.owner === this.originalOwner) return;
    const g = this.game;
    g.deselect(this);
    this.setTarget(null);
    this.setGuardPoint(this.x, this.y);
    this.setDestination(this.x, this.y);
    g.changeOwner(this, this.originalOwner);
    this.deviationTimer = -1;
  }

  wasDeviated() {
    return this.owner !== this.originalOwner;
  }

  // ---------------------------------------------------------------------------
  // Carryall support
  requestCarryall() {
    const g = this.game;
    if (!g.hasCarryalls(this.owner) || this.awaitingPickup) return false;
    this.doSetAttackModeRaw(MODE.CARRYALL);
    for (const u of g.units) {
      if (u.alive && u.owner === this.owner && u.type === 'carryall' && !u.isBooked() && u.owned !== false) {
        u.setTarget(this);
        u.clearPath();
        this.bookCarrier(u);
        return true;
      }
    }
    return false;
  }

  doSetAttackModeRaw(mode) {
    this.attackMode = mode;
  }

  bookCarrier(c) {
    if (!c) {
      this.bookedCarrier = null;
      this.awaitingPickup = false;
    } else {
      this.bookedCarrier = c;
      this.awaitingPickup = true;
    }
  }

  hasBookedCarrier() {
    return !!(this.bookedCarrier && this.bookedCarrier.alive);
  }

  setPickedUp(carrier) {
    const g = this.game;
    g.deselect(this);
    this.unassignFromMap(this.x, this.y);
    if (this.moving && this.nextSpot) this.unassignFromMap(this.nextSpot.x, this.nextSpot.y);
    if (this.goingToRepairYard && this.target && this.target.unbook) this.target.unbook();
    if (this.type === 'harvester' && this.returning && this.target && this.target.type === 'refinery') this.target.unbook();
    this.target = carrier;
    this.goingToRepairYard = false;
    this.forced = false;
    this.moving = false;
    this.justStoppedMoving = false;
    this.pickedUp = true;
    this.respondable = false;
    this.active = false;
    this.hidden = true;
    this.awaitingPickup = false;
    this.bookedCarrier = null;
    this.clearPath();
  }

  doRepair() {
    if (this.health >= this.maxHealth) return;
    const g = this.game;
    let best = null;
    let bd = Infinity;
    for (const s of g.structures) {
      if (s.alive && s.type === 'repairYard' && s.owner === this.owner && s.bookings === 0) {
        const [cx, cy] = s.closestPoint(this.x, this.y);
        const d = blockDistance(this.x, this.y, cx, cy);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
    }
    if (best) {
      this.requestCarryall();
      this.doMove2Object(best);
    }
  }

  setGettingRepaired() {
    const t = this.target;
    if (t && t.type === 'repairYard' && t.isFree()) {
      this.game.deselect(this);
      this.unassignFromMap(this.x, this.y);
      t.assignUnit(this);
      this.moving = false;
      this.active = false;
      this.hidden = true;
      this.respondable = false;
      this.goingToRepairYard = false;
      this.setTarget(null);
      this.clearPath();
    }
  }

  // ---------------------------------------------------------------------------
  destroy() {
    if (!this.alive) return;
    const g = this.game;
    this.alive = false;
    if (this.x >= 0 && !this.hidden) this.unassignFromMap(this.x, this.y);
    if (this.moving && this.nextSpot) this.unassignFromMap(this.nextSpot.x, this.nextSpot.y);
    if (this.goingToRepairYard && this.target && this.target.unbook) this.target.unbook();
    if (this.bookedCarrier && this.bookedCarrier.alive && this.bookedCarrier.target === this) {
      this.bookedCarrier.setTarget(null);
    }
    const visible = !this.hidden && g.isObjectVisibleToAny(this);
    if (visible && !this.isInfantry && !this.isAir && this.type !== 'sandworm') {
      const prop = this.st.infSpawnProp || 0;
      if (prop > 0 && g.rng.randInt(1, 100) <= prop) {
        g.spawnSurvivor(this);
      }
    }
    g.onUnitDestroyed(this, visible);
  }
}

// ---------------------------------------------------------------------------
// GroundUnit: carryall pickup, auto repair, spice bloom
// ---------------------------------------------------------------------------
export class GroundUnit extends Unit {
  checkPos() {
    const g = this.game;
    const map = g.map;
    if (this.awaitingPickup && !this.hasBookedCarrier()) {
      this.awaitingPickup = false;
      this.bookedCarrier = null;
    }
    if (this.justStoppedMoving) {
      if (!this.isInfantry) {
        this.rx = this.x * TILESIZE + 32;
        this.ry = this.y * TILESIZE + 32;
      }
      const t = map.getType(this.x, this.y);
      if (t === T.SPICE_BLOOM) {
        g.triggerBloom(this.x, this.y, this.owner, false);
        if (!(g.settings.immortalPlayer && this.owner === g.player)) {
          this.hidden = true;
          this.setHealth(0);
          return;
        }
      } else if (t === T.SPECIAL_BLOOM) {
        g.triggerBloom(this.x, this.y, this.owner, true);
      }
    }
    // automatic return to repair yard
    if (this.active && this.health < this.maxHealth / 2 && !this.goingToRepairYard && !this.pickedUp && !this.isInfantry && !this.forced &&
        this.owner === this.originalOwner && g.hasStructure(this.owner, 'repairYard') && g.hasCarryalls(this.owner)) {
      this.doRepair();
    }
    if (this.goingToRepairYard) {
      const t = this.target;
      if (!t || !t.alive) {
        this.goingToRepairYard = false;
        this.awaitingPickup = false;
        this.bookedCarrier = null;
        this.clearPath();
      } else if (this.justStoppedMoving && t.type === 'repairYard' && map.ground[map.idx(this.x, this.y)] === t.id) {
        if (t.isFree()) this.setGettingRepaired();
        else {
          const spot = g.findDeploySpot(this, t.x, t.y, t.w, t.h, this.x, this.y);
          if (spot) this.doMove2Pos(spot[0], spot[1], true);
        }
      }
    }
    if (!this.pickedUp && this.attackMode === MODE.CARRYALL && !this.bookedCarrier) {
      if (g.hasCarryalls(this.owner) && (this.target || (this.destination && (this.destination.x !== this.x || this.destination.y !== this.y)))) {
        this.requestCarryall();
      } else {
        this.doSetAttackMode(this.type === 'harvester' ? MODE.HARVEST : MODE.GUARD);
      }
    }
    // stationary units refresh their view every 512 cycles
    if (!this.moving && !this.justStoppedMoving && (g.cycle + this.id) % 512 === 0) this.viewMap();
  }
}

// ---------------------------------------------------------------------------
// Tracked units: crush infantry, may enter enemy infantry tiles
// ---------------------------------------------------------------------------
export class TrackedUnit extends GroundUnit {
  canPass(x, y) {
    const g = this.game;
    const map = g.map;
    if (!map.inBounds(x, y)) return false;
    const i = map.idx(x, y);
    if (map.types[i] === T.MOUNTAIN) return false;
    if (x === this.x && y === this.y) return true;
    const gid = map.ground[i];
    if (gid && gid !== this.id) {
      const o = g.objects.get(gid);
      if (o && o.isStructure && o === this.target && o.owner === this.owner) {
        if (this.goingToRepairYard && o.type === 'repairYard' && o.isFree()) return true;
        if (this.type === 'harvester' && this.returning && o.type === 'refinery' && o.isFree()) return true;
      }
      return false;
    }
    // tile with infantry: passable only if all of them are enemies (they get crushed)
    const ids = map.infantryIds(x, y);
    for (const id of ids) {
      const o = g.objects.get(id);
      if (o && o.team === this.team) return false;
    }
    return true;
  }

  checkPos() {
    if (this.justStoppedMoving) {
      // crush all infantry on our tile
      const g = this.game;
      const ids = g.map.infantryIds(this.x, this.y);
      for (const id of ids) {
        const o = g.objects.get(id);
        if (o && o.alive && o.isInfantry) {
          o.squashed = true;
          o.setHealth(0);
          g.events.emit('crush', { x: o.px, y: o.py });
        }
      }
    }
    super.checkPos();
  }
}

// ---------------------------------------------------------------------------
// Infantry: 5 per tile, can enter mountains, capture buildings
// ---------------------------------------------------------------------------
export class InfantryUnit extends GroundUnit {
  canAttack(obj) {
    if (!obj || !obj.alive) return false;
    return super.canAttack(obj);
  }

  canPass(x, y) {
    const g = this.game;
    const map = g.map;
    if (!map.inBounds(x, y)) return false;
    const i = map.idx(x, y);
    const gid = map.ground[i];
    if (gid) {
      const o = g.objects.get(gid);
      // capturing: may enter enemy structure that is the target
      if (o && o.isStructure && o === this.target && o.team !== this.team) return true;
      return false;
    }
    const ids = map.infantryIds(x, y);
    if (ids.length >= INFANTRY_SLOTS && !ids.includes(this.id)) return false;
    for (const id of ids) {
      const o = g.objects.get(id);
      if (o && o.team !== this.team) return false;
    }
    return true;
  }

  stepCost(x, y) {
    return terrainDifficulty(this.game.map.getType(x, y), 'infantry');
  }

  currentSpeed() {
    // InfantryBase::setSpeeds: changing sub-position => plain MaxSpeed, no terrain
    const map = this.game.map;
    const ns = this.nextSpot;
    const newSlot = ns ? this.infSlotFor(ns.x, ns.y) : this.infSlot;
    if (newSlot !== this.infSlot) return this.maxSpeed();
    return this.maxSpeed() * (2 - terrainDifficulty(map.getType(this.x, this.y), 'infantry'));
  }

  assignToMap(x, y) {
    if (this.isCapturingInto(x, y)) return; // entering structure tile for capture
    super.assignToMap(x, y);
  }

  isCapturingInto(x, y) {
    const map = this.game.map;
    if (!map.inBounds(x, y)) return false;
    const gid = map.ground[map.idx(x, y)];
    return !!(gid && this.target && this.target.id === gid);
  }

  checkPos() {
    super.checkPos();
    if (!this.alive || this.health <= 0) return;
    const g = this.game;
    // capture / damage structure when standing on its tile
    const t = this.target;
    if (this.justStoppedMoving && t && t.alive && t.isStructure && t.team !== this.team) {
      const map = g.map;
      if (map.ground[map.idx(this.x, this.y)] === t.id) {
        if (t.heavilyDamaged && t.canBeCaptured()) {
          g.captureStructure(t, this.owner);
        } else {
          const dmg = Math.min(t.health / 2, this.health * 2);
          t.handleDamage(dmg, this, this.owner);
        }
        this.hidden = true;
        this.setHealth(0);
      }
    }
  }

  doCaptureStructure(s) {
    if (!s || !s.isStructure || s.team === this.team || !s.canBeCaptured()) return;
    this.doAttackObject(s, true);
    this.attackMode = MODE.CAPTURE;
  }
}

// ---------------------------------------------------------------------------
// TankBase: rotating turret, close target
// ---------------------------------------------------------------------------
export class TankUnit extends TrackedUnit {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.turretAngle = this.angle;
    this.drawnTurretAngle = this.drawnAngle;
    this.closeTarget = null;
  }

  attackAngle() {
    return this.drawnTurretAngle;
  }

  turn() {
    super.turn();
    // turret turns even while moving
    let wanted = -1;
    if (this.target && this.target.alive) {
      const [tx, ty] = this.target.closestPoint(this.x, this.y);
      wanted = dirIndex(this.x, this.y, tx, ty);
    } else if (this.attackPos) {
      wanted = dirIndex(this.x, this.y, this.attackPos.x, this.attackPos.y);
    } else if (this.closeTarget && this.closeTarget.alive) {
      const [tx, ty] = this.closeTarget.closestPoint(this.x, this.y);
      wanted = dirIndex(this.x, this.y, tx, ty);
    } else if (this.moving && this.destination) {
      wanted = dirIndex(this.x, this.y, this.destination.x, this.destination.y);
    }
    if (wanted < 0) return;
    const ts = 0.0625;
    const d = angleDiff8(this.turretAngle, wanted);
    if (Math.abs(d) <= ts) this.turretAngle = wanted;
    else this.turretAngle += Math.sign(d) * ts;
    this.turretAngle = ((this.turretAngle % 8) + 8) % 8;
    this.drawnTurretAngle = Math.round(this.turretAngle) & 7;
  }

  // TankBase::engageTarget: keep firing at close targets while main target is out of range
  engageTarget() {
    super.engageTarget();
    if (this.moving) return;
    if (this.closeTarget && (!this.closeTarget.alive || !this.canAttack(this.closeTarget) || !this.isInWeaponRange(this.closeTarget))) {
      this.closeTarget = null;
    }
    const mainOk = this.target && this.target.alive && this.isInWeaponRange(this.target);
    if (!mainOk && !this.attackPos) {
      if (!this.closeTarget && this.findTargetTimer === 0 && this.attackMode !== MODE.STOP && this.attackMode !== MODE.CARRYALL) {
        const t = this.game.findClosestTarget(this, this.weaponRange(), false);
        if (t && this.isInWeaponRange(t)) this.closeTarget = t;
      }
      if (this.closeTarget) {
        const [tx, ty] = this.closeTarget.closestPoint(this.x, this.y);
        const a = dirIndex(this.x, this.y, tx, ty);
        if (a === this.drawnTurretAngle) {
          const saved = this.target;
          const savedFriendly = this.targetFriendly;
          this.target = this.closeTarget;
          this.attack();
          this.target = saved;
          this.targetFriendly = savedFriendly;
        }
      }
    }
  }

  idleAction() {
    if (this.attackMode === MODE.GUARD) {
      const r = this.game.rng.randInt(0, 9);
      if (r === 0) this.nextSpotAngle = this.game.rng.randInt(0, 7);
      else if (r === 1) this.turretAngle = (this.turretAngle + this.game.rng.randInt(-1, 1) + 8) % 8;
    }
  }
}
