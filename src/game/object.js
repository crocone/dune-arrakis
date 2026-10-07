import { TILESIZE } from '../core/constants.js';

export const MODE = {
  GUARD: 'guard',
  AREAGUARD: 'areaguard',
  AMBUSH: 'ambush',
  HUNT: 'hunt',
  STOP: 'stop',
  HARVEST: 'harvest',
  SABOTAGE: 'sabotage',
  CAPTURE: 'capture',
  RETREAT: 'retreat',
  CARRYALL: 'carryallRequested',
};

export const MODE_NAMES = {
  guard: 'Guard',
  areaguard: 'Area guard',
  ambush: 'Ambush',
  hunt: 'Hunt',
  stop: 'Stop',
  harvest: 'Harvest',
  sabotage: 'Sabotage',
  capture: 'Capture',
  retreat: 'Retreat',
  carryallRequested: 'Awaiting Carryall',
};

export function modeFromIni(s) {
  const n = String(s || '').trim().toLowerCase();
  switch (n) {
    case 'guard': return MODE.GUARD;
    case 'area guard': case 'areaguard': return MODE.AREAGUARD;
    case 'ambush': return MODE.AMBUSH;
    case 'hunt': return MODE.HUNT;
    case 'harvest': return MODE.HARVEST;
    case 'sabotage': return MODE.SABOTAGE;
    case 'stop': case 'sticky': return MODE.STOP;
    case 'retreat': return MODE.RETREAT;
    case 'capture': return MODE.CAPTURE;
    default: return MODE.GUARD;
  }
}

// octile distance in tiles between tile coords
export function blockDistance(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

// 8-way direction index from (x1,y1) to (x2,y2): 0 = east, counter-clockwise (screen Y down)
export function dirIndex(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return -1;
  let a = Math.atan2(-dy, dx);
  if (a < 0) a += Math.PI * 2;
  return Math.round(a / (Math.PI / 4)) & 7;
}

export class GameObject {
  constructor(game, type, owner) {
    this.game = game;
    this.id = game.allocId();
    this.type = type;
    this.owner = owner;
    this.originalOwner = owner;
    this.st = game.stats(type, owner);
    this.maxHealth = this.st.hitPoints || 1;
    this.health = this.maxHealth;
    this.alive = true;
    this.active = true;
    this.target = null;
    this.targetFriendly = false;
    this.forced = false;
    this.attackPos = null;
    this.attackMode = MODE.GUARD;
    this.x = -1;
    this.y = -1;
    this.isUnit = false;
    this.isStructure = false;
    this.isAir = false;
    this.isInfantry = false;
    this.selected = false;
    this.lastDamagedCycle = -9999;
    this.respondable = true;
  }

  get team() {
    return this.game.teamOf(this.owner);
  }

  get badlyDamaged() {
    return this.health < this.maxHealth * 0.5;
  }

  // "red" health: capture threshold (intended Dune II value 25%)
  get heavilyDamaged() {
    return this.health < this.maxHealth * 0.25;
  }

  weaponRange() {
    return this.st.weaponRange || 0;
  }

  viewRange() {
    return this.st.viewRange || 0;
  }

  reloadTime() {
    return this.st.weaponReloadTime || 0;
  }

  weaponDamage() {
    return this.st.weaponDamage || 0;
  }

  // object can attack at all
  canAttackAnything() {
    return false;
  }

  centerPoint() {
    return [this.x * TILESIZE + TILESIZE / 2, this.y * TILESIZE + TILESIZE / 2];
  }

  closestPoint(tx, ty) {
    return [this.x, this.y];
  }

  closestCenterPoint(tx, ty) {
    const [x, y] = this.closestPoint(tx, ty);
    return [x * TILESIZE + TILESIZE / 2, y * TILESIZE + TILESIZE / 2];
  }

  // ObjectBase::isVisible(team): the object is present on the map (cloaked saboteurs override this).
  // Fog / exploration is checked separately when searching for targets.
  isVisibleTo(team) {
    return this.alive && !this.hidden;
  }

  // ObjectBase::canAttack
  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active) return false;
    if (!this.canAttackAnything()) return false;
    if (!obj.isStructure && obj.isAir) return false;
    if (obj.type === 'sandworm') return true;
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }

  setTarget(obj) {
    this.target = obj || null;
    this.targetFriendly = !!(obj && obj.team === this.team && this.type !== 'sandworm' && obj.type !== 'sandworm');
  }

  setHealth(h) {
    this.health = Math.max(0, Math.min(this.maxHealth, h));
  }

  // generic damage handling (ObjectBase::handleDamage)
  handleDamage(damage, damager, damagerOwner) {
    if (damage >= 0) {
      const g = this.game;
      if (g.settings.immortalPlayer && this.owner === g.player && damage > 0) damage = 0;
      const before = this.health;
      this.health -= damage;
      if (this.health <= 0) {
        this.health = 0;
        if (before > 0 && damagerOwner !== undefined && damagerOwner !== null && damagerOwner >= 0) {
          g.informKilled(damagerOwner, this);
        }
      }
      if (damage > 0) {
        this.lastDamagedCycle = g.cycle;
        if (damagerOwner !== undefined && damagerOwner >= 0) {
          const h = g.houses[damagerOwner];
          if (h) h.stats.damageDealt += damagerOwner === this.owner ? 0 : damage;
        }
        g.onObjectDamaged(this, damage, damager);
      }
    }
  }

  findTarget() {
    return null;
  }

  update() {
    return true;
  }
}
