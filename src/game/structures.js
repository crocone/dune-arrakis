import { TILESIZE, H, T } from '../core/constants.js';
import { GameObject, MODE, blockDistance, dirIndex } from './object.js';
import { stats, STRUCTURE_SIZE, isStructureType } from '../data/gamedata.js';
import { Bullet, B } from './bullets.js';
import { MIN_CARRYALL_LIFT_DISTANCE } from './unit.js';

export const UNIT_REPAIR_COST = 0.1;
export const DEPLOY_TIME = 47; // 750 ms
const UPGRADE_CYCLES = 600;
const STARPORT_ARRIVE_TIME = 1875;

// Order of items in build lists (BuilderBase::itemOrder)
export const ITEM_ORDER = [
  'slab4', 'slab1', 'ix', 'starport', 'highTechFactory', 'heavyFactory', 'rocketTurret', 'repairYard', 'gunTurret', 'wor', 'barracks',
  'wall', 'lightFactory', 'silo', 'radar', 'refinery', 'windtrap', 'palace',
  'sonicTank', 'devastator', 'deviator', 'launcher', 'siegeTank', 'tank', 'mcv', 'harvester', 'ornithopter', 'carryall',
  'quad', 'raider', 'trike', 'trooper', 'soldier', 'saboteur',
];

// Player-facing order (structures in tech order)
export const DISPLAY_ORDER = [
  'slab1', 'slab4', 'windtrap', 'refinery', 'silo', 'radar', 'barracks', 'wor', 'lightFactory', 'wall', 'gunTurret', 'heavyFactory',
  'highTechFactory', 'repairYard', 'rocketTurret', 'starport', 'ix', 'palace',
  'soldier', 'trooper', 'saboteur', 'trike', 'raider', 'quad', 'tank', 'harvester', 'launcher', 'siegeTank', 'mcv', 'sonicTank',
  'devastator', 'deviator', 'carryall', 'ornithopter',
];

const DEGRADE_MULT = { [H.HARKONNEN]: 3, [H.SARDAUKAR]: 3, [H.ORDOS]: 2, [H.MERCENARY]: 5 };

export class Structure extends GameObject {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.isStructure = true;
    const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
    this.w = w;
    this.h = h;
    this.repairing = false;
    this.degradeTimer = 937;
    this.justPlacedTimer = 0;
    this.rally = null;
    this.byScenario = false;
    this.lastViewCycle = 0;
    this.smoke = [];
    this.anim = 0;
    this.isBuilder = false;
    this.attackMode = MODE.GUARD;
  }

  get px() {
    return this.x + this.w / 2;
  }

  get py() {
    return this.y + this.h / 2;
  }

  canBeCaptured() {
    return true;
  }

  centerPoint() {
    return [this.x * TILESIZE + (this.w * TILESIZE) / 2, this.y * TILESIZE + (this.h * TILESIZE) / 2];
  }

  closestPoint(tx, ty) {
    return [Math.max(this.x, Math.min(this.x + this.w - 1, tx)), Math.max(this.y, Math.min(this.y + this.h - 1, ty))];
  }

  containsTile(tx, ty) {
    return tx >= this.x && ty >= this.y && tx < this.x + this.w && ty < this.y + this.h;
  }

  containsPx(px, py) {
    return px >= this.x * TILESIZE && py >= this.y * TILESIZE && px < (this.x + this.w) * TILESIZE && py < (this.y + this.h) * TILESIZE;
  }

  // is any tile of the structure explored by the team (structures stay visible as last seen)
  isExploredBy(team) {
    if (!this.alive) return false;
    if (this.team === team) return true;
    const map = this.game.map;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        if (map.inBounds(this.x + i, this.y + j) && map.isExplored(team, this.x + i, this.y + j)) return true;
      }
    }
    return false;
  }

  // place on map; applies concrete damage rule (StructureBase::assignToMap)
  place(x, y, opts = {}) {
    const g = this.game;
    const map = g.map;
    this.x = x;
    this.y = y;
    this.byScenario = !!opts.byScenario;
    let missingSlab = 0;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (!map.inBounds(tx, ty)) continue;
        const k = map.idx(tx, ty);
        map.ground[k] = this.id;
        if (map.types[k] !== T.SLAB) missingSlab++;
        // the tile under a building becomes plain rock
        if (map.types[k] === T.SLAB || isSpiceOrSand(map.types[k])) {
          if (map.types[k] !== T.ROCK) map.setType(tx, ty, T.ROCK);
        }
        map.tileOwner[k] = this.owner;
      }
    }
    map.pathRevision++;
    if (!this.byScenario && this.type !== 'wall' && this.type !== 'constructionYard' && g.settings.concreteRequired) {
      const loss = (this.maxHealth / (2 * this.w * this.h)) * missingSlab;
      this.health = Math.max(1, this.health - loss);
    }
    this.justPlacedTimer = opts.byScenario ? 0 : 80;
    this.viewMap();
  }

  viewMap() {
    const cx = this.x + Math.floor(this.w / 2);
    const cy = this.y + Math.floor(this.h / 2);
    this.game.viewMapForHouse(this.owner, cx, cy, this.viewRange() + Math.floor(Math.max(this.w, this.h) / 2));
  }

  doRepair() {
    if (this.health < this.maxHealth) this.repairing = true;
  }

  update() {
    const g = this.game;
    const house = g.houses[this.owner];
    if (this.justPlacedTimer > 0) this.justPlacedTimer--;
    this.anim++;
    // degradation while the house lacks power
    if (g.settings.concreteRequired && house && house.powerRequirement > house.producedPower && this.type !== 'wall') {
      if (--this.degradeTimer <= 0) {
        this.degradeTimer = 937;
        if (this.health > this.maxHealth / 2) {
          const mult = DEGRADE_MULT[this.owner] ?? 1;
          this.health = Math.max(this.maxHealth / 2, this.health - (mult / 100) * this.maxHealth);
          this.onHealthChanged();
        }
      }
    }
    // repair
    if (this.repairing) {
      if (house && house.credits >= 5 && this.health < this.maxHealth) {
        const fraction = Math.floor(512 / this.maxHealth);
        const price = (fraction * this.st.price) / 256;
        house.takeCredits(price / 30);
        this.health = Math.min(this.maxHealth, this.health + 5 / 30);
        this.onHealthChanged();
      }
      if (this.health >= this.maxHealth || !house || house.credits < 5) this.repairing = false;
    } else if (house && !house.isHuman && this.health < this.maxHealth / 2 && house.ai && house.ai.active) {
      this.repairing = true;
    }
    if ((g.cycle + this.id) % 512 === 0) this.viewMap();
    this.updateSpecific();
    if (this.health <= 0) {
      this.destroy();
      return false;
    }
    return true;
  }

  updateSpecific() {}

  onHealthChanged() {
    if (this.type === 'windtrap') this.game.houses[this.owner]?.recalcPowerAndStorage();
  }

  handleDamage(damage, damager, damagerOwner) {
    super.handleDamage(damage, damager, damagerOwner);
    this.onHealthChanged();
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    const g = this.game;
    const map = g.map;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const tx = this.x + i;
        const ty = this.y + j;
        if (!map.inBounds(tx, ty)) continue;
        const k = map.idx(tx, ty);
        if (map.ground[k] === this.id) map.ground[k] = 0;
        map.damage[k] = Math.min(4, map.damage[k] + 3);
      }
    }
    map.pathRevision++;
    map.spiceDirty = true;
    this.onDestroyContents();
    g.onStructureDestroyed(this);
    // infantry from the ruins
    const prop = this.st.infSpawnProp || 0;
    if (prop > 0) {
      for (let j = 0; j < this.h; j++) {
        for (let i = 0; i < this.w; i++) {
          if (g.rng.randInt(1, 100) <= prop) g.spawnSoldierAt(this.owner, this.x + i, this.y + j, 0.5);
        }
      }
    }
  }

  onDestroyContents() {}
}

function isSpiceOrSand(t) {
  return t === T.SAND || t === T.DUNES || t === T.SPICE || t === T.THICK_SPICE || t === T.SPICE_BLOOM || t === T.SPECIAL_BLOOM;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------
export class Builder extends Structure {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.isBuilder = true;
    this.buildList = [];
    this.queue = []; // array of item ids
    this.currentItem = null;
    this.progress = 0;
    this.onHold = false;
    this.deployTimer = 0;
    this.waitingToPlace = false;
    this.upgradeLevel = 0;
    this.upgrading = false;
    this.upgradeProgress = 0;
    this.buildSpeedLimit = 1;
    this.noMoneyNotified = 0;
  }

  maxUpgradeLevel() {
    const g = this.game;
    let max = 0;
    for (const id of ITEM_ORDER) {
      const st = stats(id, this.originalOwner);
      if (st.enabled && st.builder === this.type && st.techLevel <= g.techLevel && st.techLevel >= 0) max = Math.max(max, st.upgradeLevel || 0);
    }
    return max;
  }

  canUpgrade() {
    return !this.upgrading && this.upgradeLevel < this.maxUpgradeLevel();
  }

  upgradePrice() {
    return this.st.price / 2;
  }

  doUpgrade() {
    const house = this.game.houses[this.owner];
    if (!this.canUpgrade() || !house || house.credits < this.upgradePrice()) return false;
    this.upgrading = true;
    this.upgradeProgress = 0;
    return true;
  }

  isAvailable(id) {
    const g = this.game;
    const house = g.houses[this.owner];
    const st = stats(id, this.originalOwner);
    if (!st.enabled || st.builder !== this.type) return false;
    if ((st.upgradeLevel || 0) > this.upgradeLevel) return false;
    if (st.techLevel < 0 || st.techLevel > g.techLevel) return false;
    for (const p of st.prerequisite || []) if (!house || house.getCount(p) <= 0) return false;
    if (g.disabledItems && g.disabledItems.has(id)) return false;
    return true;
  }

  // items that could become available with upgrades / prerequisites (for UI hints)
  potentialItems() {
    const out = [];
    for (const id of DISPLAY_ORDER) {
      const st = stats(id, this.originalOwner);
      if (!st.enabled || st.builder !== this.type) continue;
      if (st.techLevel < 0 || st.techLevel > this.game.techLevel) continue;
      out.push(id);
    }
    return out;
  }

  updateBuildList() {
    const list = [];
    for (const id of DISPLAY_ORDER) if (this.isAvailable(id)) list.push(id);
    // items that vanished: refund & remove from queue
    for (const id of this.buildList) {
      if (!list.includes(id)) this.removeItemFromQueue(id);
    }
    this.buildList = list;
  }

  removeItemFromQueue(id) {
    const house = this.game.houses[this.owner];
    if (this.currentItem === id) {
      if (house) house.returnCredits(this.progress);
      this.progress = 0;
      this.currentItem = null;
      this.waitingToPlace = false;
      this.deployTimer = 0;
    }
    this.queue = this.queue.filter((q) => q !== id);
    this.startNext();
  }

  countInQueue(id) {
    let n = 0;
    for (const q of this.queue) if (q === id) n++;
    return n;
  }

  doProduceItem(id, count = 1) {
    if (!this.buildList.includes(id)) return false;
    for (let i = 0; i < count; i++) this.queue.push(id);
    if (!this.currentItem) this.startNext();
    return true;
  }

  doCancelItem(id) {
    const idx = this.queue.lastIndexOf(id);
    if (idx < 0) return;
    const house = this.game.houses[this.owner];
    const isCurrent = idx === 0 && this.currentItem === id && this.countInQueue(id) === 1;
    this.queue.splice(idx, 1);
    if (isCurrent || (this.currentItem === id && !this.queue.includes(id))) {
      if (house) house.returnCredits(this.progress);
      this.progress = 0;
      this.currentItem = null;
      this.waitingToPlace = false;
      this.onHold = false;
      this.startNext();
    }
  }

  setOnHold(v) {
    this.onHold = v;
  }

  startNext() {
    if (this.currentItem) return;
    if (this.queue.length) {
      this.currentItem = this.queue[0];
      this.progress = 0;
      this.onHold = false;
      this.waitingToPlace = false;
    }
  }

  itemPrice(id) {
    return stats(id, this.originalOwner).price;
  }

  buildCyclesFor(id) {
    return stats(id, this.originalOwner).buildTime * 15;
  }

  unitLimitReached(id) {
    return this.game.unitLimitReached(this.owner, id);
  }

  updateSpecific() {
    const g = this.game;
    const house = g.houses[this.owner];
    if (!house) return;
    if (this.upgrading) {
      const price = this.upgradePrice();
      if (this.upgradeProgress < price) {
        this.upgradeProgress += house.takeCredits(price / UPGRADE_CYCLES);
      }
      if (this.upgradeProgress >= price - 1e-6) {
        this.upgrading = false;
        this.upgradeLevel++;
        this.upgradeProgress = 0;
        this.updateBuildList();
        g.events.emit('upgradeComplete', { structure: this });
      }
      return;
    }
    if (!this.currentItem) return;
    const id = this.currentItem;
    const price = this.itemPrice(id);
    if (this.waitingToPlace) return;
    if (this.deployTimer > 0) {
      if (--this.deployTimer === 0) this.finishUnit(id);
      return;
    }
    if (this.progress < price) {
      if (this.onHold) return;
      if (!isStructureType(id) && this.unitLimitReached(id)) return;
      if (house.credits <= 0) {
        if (house.isHuman && g.cycle - this.noMoneyNotified > 400) {
          this.noMoneyNotified = g.cycle;
          g.message('Insufficient funds', 'warn', 'nomoney', true, 'nomoney');
        }
        return;
      }
      const speed = Math.min(this.health / this.maxHealth, this.buildSpeedLimit) * (g.settings.buildSpeed || 1);
      const perCycle = price / this.buildCyclesFor(id);
      this.progress += house.takeCredits(Math.min(price - this.progress, perCycle * speed));
      if (this.progress >= price - 1e-6) {
        this.progress = price;
        if (isStructureType(id)) {
          this.waitingToPlace = true;
          g.events.emit('buildComplete', { builder: this, item: id });
        } else {
          this.deployTimer = DEPLOY_TIME;
        }
      }
    }
  }

  finishUnit(id) {
    const g = this.game;
    g.produceUnitFromBuilder(this, id);
    this.queue.shift();
    this.currentItem = null;
    this.progress = 0;
    this.startNext();
  }

  // called by the game after successful placement of the produced structure
  onPlaced() {
    this.queue.shift();
    this.currentItem = null;
    this.progress = 0;
    this.waitingToPlace = false;
    this.startNext();
  }

  productionFraction() {
    if (!this.currentItem) return 0;
    return this.progress / this.itemPrice(this.currentItem);
  }

  onDestroyContents() {
    this.queue = [];
    this.currentItem = null;
  }
}

export class ConstructionYard extends Builder {}
export class Barracks extends Builder {
  canBeCaptured() {
    return false;
  }
}
export class WOR extends Builder {
  canBeCaptured() {
    return false;
  }
}
export class LightFactory extends Builder {}
export class HeavyFactory extends Builder {}
export class HighTechFactory extends Builder {}

// ---------------------------------------------------------------------------
// Starport + CHOAM
// ---------------------------------------------------------------------------
export class Starport extends Builder {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.arrivalTimer = -1;
    this.deploying = false;
    this.orders = []; // [{id, price}]
  }

  maxUpgradeLevel() {
    return 0;
  }

  isAvailable(id) {
    const choam = this.game.houses[this.owner]?.choam;
    if (!choam || !choam.has(id)) return false;
    if (id === 'ornithopter' && this.game.isCampaign) return false;
    return stats(id, this.originalOwner).enabled;
  }

  updateBuildList() {
    const list = [];
    for (const id of DISPLAY_ORDER) if (this.isAvailable(id)) list.push(id);
    this.buildList = list;
  }

  itemPrice(id) {
    return this.game.houses[this.owner].choam.price(id);
  }

  okToOrder() {
    return this.arrivalTimer < 0 && !this.deploying;
  }

  doProduceItem(id, count = 1) {
    const g = this.game;
    const house = g.houses[this.owner];
    const choam = house.choam;
    if (!this.okToOrder()) return false;
    for (let i = 0; i < count; i++) {
      if (choam.num(id) <= 0) {
        if (house.isHuman) g.message('This unit is sold out', 'warn', 'soldout');
        return i > 0;
      }
      const price = choam.price(id);
      if (house.credits < price) {
        if (house.isHuman) g.message('Insufficient funds', 'warn', 'nomoney', true, 'nomoney');
        return i > 0;
      }
      house.takeCredits(price);
      choam.take(id);
      this.orders.push({ id, price });
    }
    return true;
  }

  doCancelItem(id) {
    if (!this.okToOrder()) return;
    let best = -1;
    for (let i = 0; i < this.orders.length; i++) {
      if (this.orders[i].id === id && (best < 0 || this.orders[i].price > this.orders[best].price)) best = i;
    }
    if (best < 0) return;
    const house = this.game.houses[this.owner];
    house.returnCredits(this.orders[best].price);
    house.choam.give(id);
    this.orders.splice(best, 1);
  }

  countInQueue(id) {
    return this.orders.filter((o) => o.id === id).length;
  }

  doPlaceOrder() {
    if (this.orders.length && this.okToOrder()) {
      this.arrivalTimer = this.game.settings.instantBuild ? 1 : STARPORT_ARRIVE_TIME;
      return true;
    }
    return false;
  }

  doCancelOrder() {
    if (!this.okToOrder()) return;
    while (this.orders.length) this.doCancelItem(this.orders[this.orders.length - 1].id);
  }

  updateSpecific() {
    this.updateBuildList();
    const g = this.game;
    if (this.arrivalTimer > 0) {
      if (--this.arrivalTimer === 0) {
        g.spawnFrigate(this);
        this.deployTimer = 125;
        if (this.owner === g.player) g.message('Frigate has arrived', 'good', 'frigate', true, 'frigate');
      }
    } else if (this.deploying) {
      if (--this.deployTimer <= 0) {
        if (this.orders.length) {
          const o = this.orders.shift();
          g.produceUnitFromBuilder(this, o.id, true);
        }
        if (!this.orders.length) {
          this.arrivalTimer = -1;
          this.deploying = false;
        } else this.deployTimer = 125;
      }
    }
  }

  startDeploying() {
    this.deploying = true;
    this.deployTimer = 125;
  }

  informFrigateDestroyed() {
    this.orders = [];
    this.arrivalTimer = -1;
    this.deployTimer = 0;
    this.deploying = false;
  }

  productionFraction() {
    if (this.arrivalTimer > 0) return 1 - this.arrivalTimer / STARPORT_ARRIVE_TIME;
    return 0;
  }
}

export class Choam {
  constructor(game, house) {
    this.game = game;
    this.house = house;
    this.items = new Map(); // id -> {num, price}
  }

  addItem(id, num) {
    const base = stats(id, this.house).price;
    this.items.set(id, { num: Math.max(0, num), price: base, base });
  }

  has(id) {
    return this.items.has(id);
  }

  num(id) {
    return this.items.get(id)?.num ?? 0;
  }

  price(id) {
    return this.items.get(id)?.price ?? stats(id, this.house).price;
  }

  take(id) {
    const it = this.items.get(id);
    if (it && it.num > 0) it.num--;
  }

  give(id) {
    const it = this.items.get(id);
    if (it) it.num++;
  }

  isCheap(id) {
    const it = this.items.get(id);
    return it ? it.price < it.base * 1.3 : false;
  }

  update(cycle) {
    if (!this.items.size) return;
    const rng = this.game.rng;
    if (cycle % 1875 === 0 && cycle > 0) {
      const keys = [...this.items.keys()];
      const it = this.items.get(keys[rng.randInt(0, keys.length - 1)]);
      it.num = Math.min(it.num + 1, 10);
    }
    if (cycle % 3750 === 0) {
      for (const it of this.items.values()) {
        it.price = Math.min((rng.randInt(2, 8) + rng.randInt(2, 8)) * Math.floor(it.base / 10), 999);
      }
      const g = this.game;
      if (this.house === g.player && cycle > 0 && g.hasStructure(this.house, 'starport')) g.message('New prices at the Starport', 'info', 'choam');
    }
  }
}

// ---------------------------------------------------------------------------
// Refinery
// ---------------------------------------------------------------------------
export class Refinery extends Structure {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.bookings = 0;
    this.harvester = null;
    this.extracting = false;
    this.firstRun = true;
  }

  book() {
    this.bookings++;
  }

  unbook() {
    if (this.bookings > 0) this.bookings--;
  }

  isFree() {
    return !this.extracting;
  }

  assignHarvester(h) {
    this.extracting = true;
    this.harvester = h;
  }

  deployHarvester(carryall = null) {
    const g = this.game;
    this.unbook();
    this.extracting = false;
    const h = this.harvester;
    this.harvester = null;
    if (!h || !h.alive) return;
    if (this.firstRun && this.owner === g.player) g.message('Harvester deployed', 'good', 'harvesterDeployed', true, 'harvesterDeployed');
    this.firstRun = false;
    if (carryall && h.guardPoint) {
      carryall.giveCargo(h);
      carryall.setTarget(null);
      carryall.setDestination(h.guardPoint.x, h.guardPoint.y);
    } else {
      const spot = g.findDeploySpot(h, this.x, this.y, this.w, this.h, this.rally ? this.rally.x : this.x + 1, this.rally ? this.rally.y : this.y + 2);
      h.hidden = false;
      h.respondable = true;
      if (spot) {
        h.deploy(spot[0], spot[1]);
        h.attackMode = h.attackMode === MODE.STOP ? MODE.STOP : MODE.HARVEST;
        h.harvestingMode = false;
        h.spiceCheckCounter = 0;
        if (h.guardPoint) {
          const found = g.findSpice(h.guardPoint.x, h.guardPoint.y);
          if (found && h.attackMode !== MODE.STOP) {
            h.setDestination(found[0], found[1]);
            h.harvestingMode = true;
          }
        }
      } else {
        h.hidden = true;
        h.setHealth(0);
        h.destroy();
      }
    }
  }

  updateSpecific() {
    if (!this.extracting) return;
    const g = this.game;
    const h = this.harvester;
    if (!h || !h.alive) {
      this.extracting = false;
      this.harvester = null;
      return;
    }
    if (h.spice > 0) {
      let scale = Math.floor((5 * this.health) / this.maxHealth);
      if (scale === 0) scale = 1;
      const amt = h.extractSpice((0.625 * scale) / 5);
      g.houses[this.owner].addCredits(amt, true);
    } else if (!h.awaitingPickup && h.guardPoint) {
      let carry = null;
      if (g.hasCarryalls(this.owner)) {
        for (const u of g.units) {
          if (u.alive && u.owner === this.owner && u.type === 'carryall' && !u.isBooked() && u.owned !== false) {
            carry = u;
            break;
          }
        }
      }
      if (carry && blockDistance(this.x, this.y, h.guardPoint.x, h.guardPoint.y) >= MIN_CARRYALL_LIFT_DISTANCE) {
        carry.setTarget(this);
        carry.clearPath();
        h.bookCarrier(carry);
        h.target = null;
        h.destination = { ...h.guardPoint };
      } else this.deployHarvester();
    } else if (!h.hasBookedCarrier()) {
      this.deployHarvester();
    }
  }

  onDestroyContents() {
    if (this.harvester && this.harvester.alive) {
      this.harvester.hidden = true;
      this.harvester.setHealth(0);
      this.harvester.destroy();
    }
  }
}

export class Silo extends Structure {}
export class Windtrap extends Structure {}
export class Radar extends Structure {
  canBeCaptured() {
    return false;
  }
}
export class IX extends Structure {
  canBeCaptured() {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Repair yard
// ---------------------------------------------------------------------------
export class RepairYard extends Structure {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.bookings = 0;
    this.unit = null;
  }

  book() {
    this.bookings++;
  }

  unbook() {
    if (this.bookings > 0) this.bookings--;
  }

  isFree() {
    return !this.unit;
  }

  assignUnit(u) {
    this.unit = u;
    u.hidden = true;
    u.active = false;
    u.respondable = false;
    u.moving = false;
  }

  deployRepairUnit(carryall = null) {
    const g = this.game;
    this.unbook();
    const u = this.unit;
    this.unit = null;
    if (!u || !u.alive) return;
    if (carryall) {
      carryall.giveCargo(u);
      carryall.setTarget(null);
      if (u.guardPoint) carryall.setDestination(u.guardPoint.x, u.guardPoint.y);
    } else {
      const spot = g.findDeploySpot(u, this.x, this.y, this.w, this.h, this.rally ? this.rally.x : this.x + 1, this.rally ? this.rally.y : this.y + 2);
      u.hidden = false;
      u.active = true;
      u.respondable = true;
      u.forced = false;
      if (spot) {
        u.deploy(spot[0], spot[1]);
        u.attackMode = u.type === 'harvester' ? MODE.HARVEST : MODE.GUARD;
        u.setTarget(null);
        u.setDestination(u.x, u.y);
        if (u.type === 'harvester') {
          u.harvestingMode = false;
          u.spiceCheckCounter = 0;
        }
      } else {
        u.setHealth(0);
        u.destroy();
      }
    }
    if (this.owner === g.player) g.message('Vehicle repaired', 'good', 'repaired', true, 'repaired');
  }

  updateSpecific() {
    const u = this.unit;
    if (!u) return;
    if (!u.alive) {
      this.unit = null;
      return;
    }
    const g = this.game;
    if (u.health < u.maxHealth) {
      if (g.houses[this.owner].takeCredits(0.1) > 0) u.health = Math.min(u.maxHealth, u.health + 1);
    } else {
      if (u.hasBookedCarrier && u.hasBookedCarrier()) return;
      this.deployRepairUnit();
    }
  }

  onDestroyContents() {
    if (this.unit && this.unit.alive) {
      this.unit.setHealth(0);
      this.unit.destroy();
    }
  }
}

// ---------------------------------------------------------------------------
// Palace: house special weapon
// ---------------------------------------------------------------------------
export class Palace extends Structure {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.specialTimer = this.maxSpecialTimer();
  }

  canBeCaptured() {
    return false;
  }

  weaponKind() {
    switch (this.originalOwner) {
      case H.HARKONNEN:
      case H.SARDAUKAR: return 'deathHand';
      case H.ATREIDES:
      case H.FREMEN: return 'fremen';
      default: return 'saboteur';
    }
  }

  maxSpecialTimer() {
    const k = this.originalOwner;
    return k === H.HARKONNEN || k === H.SARDAUKAR ? 37500 : 18750;
  }

  isReady() {
    return this.specialTimer <= 0;
  }

  updateSpecific() {
    if (this.specialTimer > 0) {
      if (--this.specialTimer <= 0) {
        this.specialTimer = 0;
        const g = this.game;
        if (this.owner === g.player) g.message('Palace ready: special weapon available', 'good', 'palace', true, 'palace');
      }
    }
  }

  doSpecialWeapon() {
    if (!this.isReady()) return false;
    const kind = this.weaponKind();
    const g = this.game;
    let ok = false;
    if (kind === 'fremen') ok = this.callFremen();
    else if (kind === 'saboteur') ok = this.spawnSaboteur();
    if (ok) this.specialTimer = this.maxSpecialTimer();
    return ok;
  }

  doLaunchDeathHand(x, y) {
    if (!this.isReady() || this.weaponKind() !== 'deathHand') return false;
    const g = this.game;
    let s = g.rng.randInt(0, 255);
    while (s > 160) s = Math.floor(s / 2);
    const r = s * 2;
    const a = Math.PI * 2 * g.rng.rand();
    const [cx, cy] = this.centerPoint();
    const dx = x * TILESIZE + 32 + Math.round(Math.sin(a) * r);
    const dy = y * TILESIZE + 32 + Math.round(Math.cos(a) * r);
    g.addBullet(new Bullet(g, this, cx, cy, dx, dy, B.LARGE_ROCKET, 100, false, null));
    g.events.emit('fire', { unit: this, bullet: B.LARGE_ROCKET, x: cx / TILESIZE, y: cy / TILESIZE, tx: dx / TILESIZE, ty: dy / TILESIZE });
    if (this.owner !== g.player) g.warn('Missile approaching!', 'missile');
    this.specialTimer = this.maxSpecialTimer();
    return true;
  }

  callFremen() {
    const g = this.game;
    const map = g.map;
    let x;
    let y;
    let count = 0;
    let ok = false;
    while (count++ <= 1000) {
      x = g.rng.randInt(1, map.width - 2);
      y = g.rng.randInt(1, map.height - 2);
      let free = true;
      for (let j = -1; j <= 1 && free; j++) {
        for (let i = -1; i <= 1; i++) {
          if (map.ground[map.idx(x + i, y + j)] || map.infantryCount(x + i, y + j) > 0) {
            free = false;
            break;
          }
        }
      }
      if (free) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      if (this.owner === g.player) g.message('Unable to summon the Fremen', 'warn');
      return false;
    }
    for (let n = 0; n < 15; n++) {
      if (g.rng.randInt(0, 5) === 0) continue;
      let i;
      let j;
      let tries = 0;
      do {
        i = g.rng.randInt(-1, 1);
        j = g.rng.randInt(-1, 1);
      } while (map.infantryCount(x + i, y + j) >= 5 && tries++ < 50);
      const u = g.createUnit('trooper', this.owner);
      u.fremen = true;
      u.deploy(x + i, y + j);
      u.attackMode = MODE.HUNT;
      u.respondable = false;
      const s = g.findClosestEnemyStructure(u);
      if (s) {
        const [cx, cy] = s.closestPoint(u.x, u.y);
        u.setGuardPoint(cx, cy);
        u.setDestination(cx, cy);
      }
    }
    g.events.emit('fremen', { x, y, owner: this.owner });
    if (this.owner === g.player) g.message('The Fremen are joining the battle!', 'good', 'fremen', true, 'fremen');
    return true;
  }

  spawnSaboteur() {
    const g = this.game;
    const u = g.createUnit('saboteur', this.owner);
    const spot = g.findDeploySpot(u, this.x, this.y, this.w, this.h, this.rally ? this.rally.x : this.x + 1, this.rally ? this.rally.y : this.y + 3);
    if (!spot) return false;
    u.deploy(spot[0], spot[1]);
    const house = g.houses[this.owner];
    if (house && !house.isHuman) {
      u.doSetAttackMode(MODE.HUNT);
      g.warn('Saboteur approaching!', 'saboteur');
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Turrets
// ---------------------------------------------------------------------------
export class Turret extends Structure {
  constructor(game, type, owner) {
    super(game, type, owner);
    this.angle = game.rng.randInt(0, 7);
    this.drawnAngle = Math.round(this.angle) & 7;
    this.weaponTimer = 0;
    this.findTargetTimer = 0;
    this.bulletType = type === 'rocketTurret' ? B.TURRET_ROCKET : B.SHELL_TURRET;
    this.lastFireCycle = -999;
  }

  canAttackAnything() {
    return true;
  }

  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (!obj.isStructure && obj.isAir) return false;
    if (obj.type === 'sandworm') return obj.isVisibleTo(this.team);
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }

  targetInWeaponRange() {
    if (!this.target) return false;
    const [cx, cy] = this.target.closestPoint(this.x, this.y);
    return blockDistance(this.x, this.y, cx, cy) <= this.weaponRange();
  }

  turnTowards(wanted) {
    const ts = this.st.turnSpeed || 0.0625;
    let d = (wanted - this.angle) % 8;
    if (d > 4) d -= 8;
    if (d < -4) d += 8;
    if (Math.abs(d) <= ts) this.angle = wanted;
    else this.angle += Math.sign(d) * ts;
    this.angle = ((this.angle % 8) + 8) % 8;
    this.drawnAngle = Math.round(this.angle) & 7;
  }

  isPowered() {
    return true;
  }

  updateSpecific() {
    if (!this.isPowered()) return;
    const t = this.target;
    if (t) {
      if (!t.alive || !this.canAttack(t) || !this.targetInWeaponRange()) {
        this.setTarget(null);
        if (this.findTargetTimer < 25) this.findTargetTimer = 25 + (this.id % 15);
      } else {
        const [cx, cy] = t.closestPoint(this.x, this.y);
        const wanted = dirIndex(this.x, this.y, cx, cy);
        if (wanted >= 0 && this.drawnAngle !== wanted) this.turnTowards(wanted);
        let shouldFire = false;
        if (this.bulletType === B.TURRET_ROCKET) {
          let d = Math.abs(this.angle - wanted);
          if (d > 4) d = 8 - d;
          shouldFire = wanted < 0 || d <= 1 / 3;
        } else shouldFire = wanted < 0 || this.drawnAngle === wanted;
        if (shouldFire) this.attack();
      }
    } else if (this.findTargetTimer === 0) {
      this.setTarget(this.game.findClosestTarget(this, this.weaponRange(), false));
      this.findTargetTimer = 50 + (this.id % 20);
    }
    if (this.findTargetTimer > 0) this.findTargetTimer--;
    if (this.weaponTimer > 0) this.weaponTimer--;
  }

  attack() {
    if (this.weaponTimer !== 0 || !this.target) return;
    const g = this.game;
    const t = this.target;
    const [cx, cy] = this.centerPoint();
    const [tx, ty] = t.closestCenterPoint(this.x, this.y);
    this.fireBullet(cx, cy, tx, ty, this.bulletType, this.weaponDamage(), this.reloadTime());
  }

  fireBullet(cx, cy, tx, ty, type, damage, reload) {
    const g = this.game;
    const t = this.target;
    g.addBullet(new Bullet(g, this, cx, cy, tx, ty, type, damage, !!t.isAir, t));
    g.viewMapForHouse(t.owner, this.x, this.y, 2);
    this.weaponTimer = reload;
    this.lastFireCycle = g.cycle;
    g.events.emit('fire', { unit: this, bullet: type, x: cx / TILESIZE, y: cy / TILESIZE, tx: tx / TILESIZE, ty: ty / TILESIZE });
  }

  handleDamage(damage, damager, owner) {
    super.handleDamage(damage, damager, owner);
    if (!this.target && this.findTargetTimer > 10) this.findTargetTimer = 10;
  }

  doAttackObject(obj) {
    if (!obj) return;
    this.setTarget(obj);
    this.forced = true;
  }
}

export class GunTurret extends Turret {}

export class RocketTurret extends Turret {
  canAttack(obj) {
    if (!obj || !obj.alive || !obj.active || obj.hidden) return false;
    if (obj.type === 'sandworm') return obj.isVisibleTo(this.team);
    return obj.team !== this.team && obj.isVisibleTo(this.team);
  }

  isPowered() {
    const g = this.game;
    const house = g.houses[this.owner];
    if (!g.settings.rocketTurretsNeedPower) return true;
    if (house && !house.isHuman) return true;
    return house ? house.hasPower() : false;
  }

  attack() {
    if (this.weaponTimer !== 0 || !this.target) return;
    const t = this.target;
    const [cx, cy] = this.centerPoint();
    const [tx, ty] = t.closestCenterPoint(this.x, this.y);
    if (Math.hypot(tx - cx, ty - cy) < 3 * TILESIZE) {
      if (!t.isAir) {
        const gs = stats('gunTurret', this.originalOwner);
        this.fireBullet(cx, cy, tx, ty, B.SHELL_TURRET, gs.weaponDamage, gs.weaponReloadTime);
      }
    } else {
      this.fireBullet(cx, cy, tx, ty, B.TURRET_ROCKET, this.weaponDamage(), this.reloadTime());
    }
  }
}

export class Wall extends Structure {
  canBeCaptured() {
    return false;
  }
}
