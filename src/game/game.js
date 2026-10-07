import { TILESIZE, T, H, HOUSE_NAMES, isSandLike } from '../core/constants.js';
import { EventBus } from '../core/events.js';
import { Random } from '../core/random.js';
import { stats, isStructureType, isUnitType, DEVIATE_WEAKNESS, MAP_SETTINGS, itemName, STRUCTURE_SIZE } from '../data/gamedata.js';
import { GameMap, INFANTRY_SLOTS, FOGTIME, MAX_TEAMS, RANDOM_SPICE_MIN, RANDOM_SPICE_MAX } from './map.js';
import { PathFinder } from './pathfinding.js';
import { House } from './house.js';
import { MODE, blockDistance } from './object.js';
import { B } from './bullets.js';
import { Unit } from './unit.js';
import { Soldier, Trooper, Saboteur, Trike, RaiderTrike, Quad, MCV, Tank, SiegeTank, Launcher, Deviator, SonicTank, Devastator, Harvester, Sandworm } from './specialUnits.js';
import { Carryall, Ornithopter, Frigate } from './air.js';
import {
  Structure, ConstructionYard, Barracks, WOR, LightFactory, HeavyFactory, HighTechFactory, Starport, Refinery, Silo, Windtrap, Radar, IX,
  RepairYard, Palace, GunTurret, RocketTurret, Wall, Choam,
} from './structures.js';

export const UNIT_CLASSES = {
  soldier: Soldier, trooper: Trooper, saboteur: Saboteur, trike: Trike, raider: RaiderTrike, quad: Quad, mcv: MCV, tank: Tank,
  siegeTank: SiegeTank, launcher: Launcher, deviator: Deviator, sonicTank: SonicTank, devastator: Devastator, harvester: Harvester,
  sandworm: Sandworm, carryall: Carryall, ornithopter: Ornithopter, frigate: Frigate,
};
export const STRUCT_CLASSES = {
  constructionYard: ConstructionYard, barracks: Barracks, wor: WOR, lightFactory: LightFactory, heavyFactory: HeavyFactory,
  highTechFactory: HighTechFactory, starport: Starport, refinery: Refinery, silo: Silo, windtrap: Windtrap, radar: Radar, ix: IX,
  repairYard: RepairYard, palace: Palace, gunTurret: GunTurret, rocketTurret: RocketTurret, wall: Wall,
};

export const WIN = { AI_NO_BUILDINGS: 1, HUMAN_HAS_BUILDINGS: 2, QUOTA: 4, TIMEOUT: 8 };

export const DEFAULT_SETTINGS = {
  fogOfWar: false,
  concreteRequired: true,
  rocketTurretsNeedPower: false,
  wormsRespawn: false,
  killedWormsDropSpice: false,
  immortalPlayer: false,
  instantBuild: false,
  buildSpeed: 1,
  difficulty: 1,
};

export class Game {
  constructor(opts = {}) {
    this.events = new EventBus();
    this.rng = new Random(opts.seed ?? 12345);
    this.settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
    this.cycle = 0;
    this.nextId = 1;
    this.objects = new Map();
    this.units = [];
    this.structures = [];
    this.bullets = [];
    this.houses = new Array(6).fill(null);
    this.player = opts.player ?? H.ATREIDES;
    this.techLevel = opts.techLevel ?? 8;
    this.isCampaign = !!opts.campaign;
    this.scenario = { winFlags: 3, loseFlags: 1, timeout: 0, name: '', ...(opts.scenario || {}) };
    this.triggers = [];
    this.over = null; // { won: boolean, reason }
    this.overCycle = 0;
    this.selection = new Set();
    this.messages = [];
    this.pings = [];
    this.disabledItems = null;
    this.lastAlert = new Map();
    this.aiContactCheck = 0;
    this.paused = false;
  }

  // ---------------------------------------------------------------------------
  // setup
  initMap(width, height) {
    this.map = new GameMap(width, height);
    this.pathfinder = new PathFinder(width, height);
  }

  addHouse(id, opts = {}) {
    const h = new House(this, id, { techLevel: this.techLevel, ...opts });
    h.choam = new Choam(this, id);
    this.houses[id] = h;
    return h;
  }

  allocId() {
    return this.nextId++;
  }

  stats(type, owner) {
    return stats(type, owner ?? 0);
  }

  teamOf(house) {
    const h = this.houses[house];
    return h ? h.team : house + 1;
  }

  // ---------------------------------------------------------------------------
  // object creation
  createUnit(type, owner) {
    const Cls = UNIT_CLASSES[type] || Unit;
    const u = new Cls(this, type, owner);
    this.objects.set(u.id, u);
    this.units.push(u);
    const h = this.houses[owner];
    if (h) h.inc(type, true);
    return u;
  }

  createStructure(type, owner) {
    const Cls = STRUCT_CLASSES[type] || Structure;
    const s = new Cls(this, type, owner);
    return s;
  }

  // place a unit near (x,y) on a passable tile
  placeUnit(type, owner, x, y, opts = {}) {
    const u = this.createUnit(type, owner);
    if (opts.health !== undefined) u.health = Math.max(1, Math.round(u.maxHealth * opts.health));
    if (opts.angle !== undefined) {
      u.angle = opts.angle;
      u.drawnAngle = opts.angle;
      if (u.turretAngle !== undefined) {
        u.turretAngle = opts.angle;
        u.drawnTurretAngle = opts.angle;
      }
    }
    if (u.isAir) {
      u.placeAt(x * TILESIZE + 32, y * TILESIZE + 32);
      u.guardPoint = { x, y };
      if (opts.mode) u.attackMode = opts.mode;
      return u;
    }
    const spot = this.map.findNearest(x, y, 6, (tx, ty) => u.canPass(tx, ty) && !(u.isTracked && this.map.infantryCount(tx, ty) > 0) && (type !== 'sandworm' || isSandLike(this.map.getType(tx, ty))));
    if (!spot) {
      this.removeObject(u);
      return null;
    }
    u.setLocation(spot[0], spot[1]);
    u.destination = { x: spot[0], y: spot[1] };
    u.guardPoint = { x: spot[0], y: spot[1] };
    if (opts.mode) u.attackMode = opts.mode;
    if (opts.byScenario) u.byScenario = true;
    if (type === 'harvester') {
      u.attackMode = opts.mode === MODE.STOP ? MODE.STOP : MODE.HARVEST;
    }
    if (type !== 'sandworm') u.viewMap();
    return u;
  }

  removeObject(o) {
    this.objects.delete(o.id);
    if (o.isUnit) {
      const i = this.units.indexOf(o);
      if (i >= 0) this.units.splice(i, 1);
      const h = this.houses[o.owner];
      if (h) h.dec(o.type, true);
    }
  }

  // validation of a structure placement by a house (Map::okayToPlaceStructure + build range)
  canPlaceStructure(owner, type, x, y, ignoreRange = false) {
    const map = this.map;
    const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
    let inRange = ignoreRange;
    let anyOk = false;
    const blockers = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (!map.inBounds(tx, ty)) return { ok: false };
        const k = map.idx(tx, ty);
        const t = map.types[k];
        const rockOk = t === T.ROCK || t === T.SLAB;
        if (type === 'slab4') {
          if (rockOk && !map.ground[k] && map.infantryCount(tx, ty) === 0) anyOk = true;
        } else {
          if (!rockOk) return { ok: false };
          if (type === 'slab1' && t === T.SLAB) return { ok: false };
          if (map.ground[k] || map.infantryCount(tx, ty) > 0) {
            const gid = map.ground[k];
            const o = gid ? this.objects.get(gid) : null;
            if (o && o.isUnit && o.owner === owner) blockers.push(o);
            else if (!gid) for (const id of map.infantryIds(tx, ty)) {
              const io = this.objects.get(id);
              if (io && io.owner === owner) blockers.push(io);
              else return { ok: false };
            }
            else return { ok: false };
          }
        }
        if (!inRange) {
          for (let dy = -2; dy <= 2 && !inRange; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = tx + dx;
              const ny = ty + dy;
              if (map.inBounds(nx, ny) && map.tileOwner[map.idx(nx, ny)] === owner) {
                inRange = true;
                break;
              }
            }
          }
        }
      }
    }
    if (type === 'slab4' && !anyOk) return { ok: false };
    if (!inRange) return { ok: false, reason: 'range' };
    if (blockers.length) return { ok: false, blockers };
    return { ok: true };
  }

  placeStructure(owner, type, x, y, opts = {}) {
    const map = this.map;
    const house = this.houses[owner];
    if (type === 'slab1' || type === 'slab4') {
      const n = type === 'slab4' ? 2 : 1;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const tx = x + i;
          const ty = y + j;
          if (!map.inBounds(tx, ty)) continue;
          const k = map.idx(tx, ty);
          if (map.ground[k] || map.types[k] !== T.ROCK) continue;
          map.setType(tx, ty, T.SLAB);
          map.tileOwner[k] = owner;
          this.viewMapForHouse(owner, tx, ty, 1);
        }
      }
      this.events.emit('slabPlaced', { x, y, n });
      return null;
    }
    if (type === 'wall' && opts.byScenario) {
      // fallthrough to normal creation
    }
    const s = this.createStructure(type, owner);
    s.place(x, y, opts);
    if (opts.health !== undefined) s.health = Math.max(1, Math.round(s.maxHealth * opts.health));
    this.objects.set(s.id, s);
    this.structures.push(s);
    if (house) {
      house.inc(type, false);
      house.recalcPowerAndStorage();
      if (opts.byPlayer || opts.builder) {
        house.stats.structuresBuilt++;
      }
    }
    if (type === 'refinery' && (opts.builder || (opts.byScenario && house && house.getCount('harvester') <= 0 && opts.freeHarvester))) {
      this.freeHarvester(s);
    }
    if (type === 'palace' && opts.builder) {
      for (const st of this.structures) {
        if (st !== opts.builder && st.alive && st.owner === owner && st.type === 'constructionYard') st.removeItemFromQueue && st.queue.includes('palace') && st.doCancelItem('palace');
      }
    }
    this.updateBuildLists(owner);
    if (s.isBuilder) s.updateBuildList();
    this.events.emit('structurePlaced', { structure: s });
    return s;
  }

  updateBuildLists(owner) {
    for (const s of this.structures) if (s.alive && s.owner === owner && s.isBuilder) s.updateBuildList();
  }

  // A unit has been finished by a factory (or delivered by the starport)
  produceUnitFromBuilder(builder, id, fromStarport = false) {
    const house = this.houses[builder.owner];
    const num = id === 'infantry' ? 3 : id === 'troopers' ? 3 : 1;
    const type = id === 'infantry' ? 'soldier' : id === 'troopers' ? 'trooper' : id;
    let last = null;
    for (let n = 0; n < num; n++) {
      const u = this.createUnit(type, builder.owner);
      // units are built by the builder's original house tech
      if (builder.originalOwner !== builder.owner) {
        u.originalOwner = builder.originalOwner;
        u.st = stats(type, builder.originalOwner);
      }
      const ai = house && !house.isHuman;
      const dest = ai && (type === 'carryall' || type === 'harvester' || type === 'mcv') ? null : builder.rally;
      if (u.isAir) {
        u.placeAt((builder.x + 1) * TILESIZE + 32, (builder.y + 1) * TILESIZE + 32);
        u.guardPoint = { x: builder.x + 1, y: builder.y + 1 };
        if (dest && type === 'ornithopter') u.doMove2Pos(dest.x, dest.y, false);
      } else {
        const spot = this.findDeploySpot(u, builder.x, builder.y, builder.w, builder.h, dest ? dest.x : builder.x + Math.floor(builder.w / 2), dest ? dest.y : builder.y + builder.h);
        if (!spot) {
          this.removeObject(u);
          continue;
        }
        u.guardPoint = dest ? { x: dest.x, y: dest.y } : { x: spot[0], y: spot[1] };
        u.deploy(spot[0], spot[1]);
        if (dest) {
          u.setGuardPoint(dest.x, dest.y);
          u.setDestination(dest.x, dest.y);
        } else {
          u.setDestination(spot[0], spot[1]);
        }
        if (type === 'harvester') {
          u.attackMode = MODE.HARVEST;
          u.spiceCheckCounter = 0;
          if (!dest) u.harvestingMode = false;
        }
      }
      if (house) house.stats.unitsBuilt++;
      last = u;
    }
    if (last && builder.owner === this.player) {
      const t = last.isAir ? 'Aircraft launched' : type === 'harvester' ? 'Harvester deployed' : 'Unit ready';
      const v = last.isAir ? 'aircraftReady' : type === 'harvester' ? 'harvesterDeployed' : 'unitReady';
      this.message(`${t}: ${itemName(type)}`, 'good', 'unitReady', true, v);
    }
    if (last) this.events.emit('unitProduced', { unit: last, builder });
    return last;
  }

  // free harvester delivered by an unowned carryall from the nearest map edge (House::freeHarvester)
  freeHarvester(refinery) {
    if (this.unitLimitReached(refinery.owner, 'harvester')) return;
    const [ex, ey] = this.closestEdgePoint(refinery.x + 2, refinery.y);
    const carry = this.createUnit('carryall', refinery.owner);
    carry.owned = false;
    carry.dropOfferer = true;
    carry.respondable = false;
    const harv = this.createUnit('harvester', refinery.owner);
    harv.spice = 5;
    carry.placeAt(ex * TILESIZE + 32, ey * TILESIZE + 32);
    carry.guardPoint = { x: ex, y: ey };
    carry.angle = this.edgeInwardAngle(ex, ey);
    carry.drawnAngle = Math.round(carry.angle) % 8;
    carry.currentMaxSpeed = carry.st.maxSpeed;
    harv.x = ex;
    harv.y = ey;
    carry.cargo.push(harv);
    harv.pickedUp = true;
    harv.hidden = true;
    harv.active = false;
    harv.respondable = false;
    harv.target = refinery;
    harv.returning = true;
    carry.setTarget(refinery);
  }

  closestEdgePoint(x, y) {
    const map = this.map;
    const dl = x;
    const dr = map.width - 1 - x;
    const dt = y;
    const db = map.height - 1 - y;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) return [0, y];
    if (m === dr) return [map.width - 1, y];
    if (m === dt) return [x, 0];
    return [x, map.height - 1];
  }

  edgeInwardAngle(ex, ey) {
    const map = this.map;
    if (ex === 0) return 0;
    if (ex === map.width - 1) return 4;
    if (ey === 0) return 6;
    return 2;
  }

  spawnFrigate(starport) {
    const [ex, ey] = this.closestEdgePoint(starport.x + 1, starport.y + 1);
    const f = this.createUnit('frigate', starport.owner);
    f.placeAt(ex * TILESIZE + 32, ey * TILESIZE + 32);
    f.guardPoint = { x: ex, y: ey };
    f.angle = this.edgeInwardAngle(ex, ey);
    f.drawnAngle = Math.round(f.angle) % 8;
    f.target = starport;
    const [cx, cy] = starport.closestPoint(ex, ey);
    f.destination = { x: cx, y: cy };
    // aim for the center tile of the starport
    f.destination = { x: starport.x + 1, y: starport.y + 1 };
    return f;
  }

  // Map::findDeploySpot — free tile around a rectangle, closest to gather point
  findDeploySpot(unit, sx, sy, w, h, gx, gy) {
    const map = this.map;
    const maxR = Math.max(map.width, map.height);
    for (let r = 1; r < maxR; r++) {
      let best = null;
      let bd = Infinity;
      for (let y = sy - r; y < sy + h + r; y++) {
        for (let x = sx - r; x < sx + w + r; x++) {
          const onRing = x === sx - r || x === sx + w + r - 1 || y === sy - r || y === sy + h + r - 1;
          if (!onRing || !map.inBounds(x, y)) continue;
          if (!unit.canPass(x, y)) continue;
          if (unit.isTracked && map.infantryCount(x, y) > 0) continue;
          if (map.getType(x, y) === T.SPICE_BLOOM) continue;
          const d = (x - gx) * (x - gx) + (y - gy) * (y - gy) + this.rng.rand() * 0.5;
          if (d < bd) {
            bd = d;
            best = [x, y];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // Map::findSpice — random search on growing rings around origin
  findSpice(ox, oy) {
    const map = this.map;
    if (map.inBounds(ox, oy) && isSpiceType(map.getType(ox, oy))) return [ox, oy];
    const maxDepth = Math.max(map.width, map.height);
    for (let depth = 1; depth <= maxDepth; depth++) {
      // collect candidates on this ring, choose randomly among them
      const cands = [];
      for (let y = oy - depth; y <= oy + depth; y++) {
        for (let x = ox - depth; x <= ox + depth; x++) {
          if (Math.max(Math.abs(x - ox), Math.abs(y - oy)) !== depth) continue;
          if (!map.inBounds(x, y)) continue;
          const k = map.idx(x, y);
          if (map.ground[k]) continue;
          if (isSpiceType(map.types[k])) cands.push([x, y]);
        }
      }
      if (cands.length) return cands[this.rng.randInt(0, cands.length - 1)];
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // visibility
  viewMapForHouse(house, x, y, range) {
    const team = this.teamOf(house);
    this.map.viewMap(team, x, y, range);
  }

  isTileVisibleToTeam(team, x, y) {
    const map = this.map;
    if (!map.inBounds(x, y)) return false;
    const s = map.seen[team][map.idx(x, y)];
    if (s < 0) return false;
    if (this.settings.fogOfWar && this.cycle - s > FOGTIME) return false;
    return true;
  }

  isObjectVisibleToAny(obj) {
    for (const h of this.houses) {
      if (!h) continue;
      if (obj.isVisibleTo(h.team)) return true;
    }
    return false;
  }

  teamHasObjectNear(team, x, y, r) {
    const map = this.map;
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const tx = x + i;
        const ty = y + j;
        if (!map.inBounds(tx, ty)) continue;
        const k = map.idx(tx, ty);
        const gid = map.ground[k];
        if (gid) {
          const o = this.objects.get(gid);
          if (o && o.team === team) return true;
        }
        const base = k * INFANTRY_SLOTS;
        for (let s = 0; s < INFANTRY_SLOTS; s++) {
          const id = map.infantry[base + s];
          if (id) {
            const o = this.objects.get(id);
            if (o && o.team === team) return true;
          }
        }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // queries
  hasCarryalls(house) {
    for (const u of this.units) if (u.alive && u.owner === house && u.type === 'carryall' && u.owned !== false) return true;
    return false;
  }

  hasStructure(house, type) {
    const h = this.houses[house];
    return !!h && h.getCount(type) > 0;
  }

  unitLimitReached(house, id) {
    const h = this.houses[house];
    if (!h) return false;
    if (id === 'harvester') {
      const area = this.map.width * this.map.height;
      const lim = area <= 1024 ? MAP_SETTINGS.harvesterLimitSmallMap : area <= 4096 ? MAP_SETTINGS.harvesterLimitMediumMap : area <= 16384 ? MAP_SETTINGS.harvesterLimitLargeMap : MAP_SETTINGS.harvesterLimitHugeMap;
      if (h.getCount('harvester') >= lim) return true;
    }
    const max = h.maxUnits;
    if (!max) return false;
    const soldiers = h.getCount('soldier');
    const troopers = h.getCount('trooper');
    const air = h.getCount('carryall') + h.getCount('ornithopter');
    const ground = h.numUnits - soldiers - troopers - air - h.getCount('frigate') - h.getCount('sandworm');
    if (id === 'carryall' || id === 'ornithopter') return air >= Math.floor((11 * Math.max(max, 25)) / 25);
    if (id === 'soldier' || id === 'trooper') return ground + Math.floor(soldiers / 3) + Math.floor(troopers / 3) >= max;
    return ground + Math.ceil(soldiers / 3) + Math.ceil(troopers / 3) >= max;
  }

  // closest attackable target within range (ObjectBase::findTarget)
  findClosestTarget(seeker, range, hunt) {
    const team = seeker.team;
    let best = null;
    let bd = Infinity;
    let bestDep = false;
    const sx = seeker.x;
    const sy = seeker.y;
    const consider = (o) => {
      if (o === seeker || !o.alive || o.hidden) return;
      if (!seeker.canAttack(o)) return;
      const [cx, cy] = o.closestPoint(sx, sy);
      if (!this.isTileVisibleToTeam(team, cx, cy)) return;
      const d = blockDistance(sx, sy, cx, cy);
      if (!hunt && d > range) return;
      const dep = o.type === 'wall' || o.type === 'carryall';
      if (best && dep && !bestDep) return;
      if (d < bd || (bestDep && !dep)) {
        best = o;
        bd = d;
        bestDep = dep;
      }
    };
    for (const u of this.units) consider(u);
    for (const s of this.structures) consider(s);
    if (!best && hunt) {
      // findClosestTargetLegacy: nearest attackable object anywhere, ignoring exploration
      for (const list of [this.units, this.structures]) {
        for (const o of list) {
          if (o === seeker || !o.alive || o.hidden || !seeker.canAttack(o)) continue;
          const [cx, cy] = o.closestPoint(sx, sy);
          const d = Math.max(Math.abs(cx - sx), Math.abs(cy - sy));
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
      }
    }
    return best;
  }

  findClosestEnemyStructure(unit) {
    let best = null;
    let bd = Infinity;
    for (const s of this.structures) {
      if (!s.alive || s.team === unit.team) continue;
      const [cx, cy] = s.closestPoint(unit.x, unit.y);
      let d = blockDistance(unit.x, unit.y, cx, cy);
      if (s.type === 'wall') d += 2e7;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Map::damage
  damageArea(source, px, py, damage, radius, air) {
    const map = this.map;
    const tcx = Math.floor(px / TILESIZE);
    const tcy = Math.floor(py / TILESIZE);
    // source: a Bullet (numeric .type, .shooterId) or a pseudo source { id, owner, type } (devastator, sandworm)
    const btype = typeof source.type === 'number' ? source.type : -1;
    const isWorm = btype === B.SANDWORM;
    const ownerHouse = source.owner;
    const shooter = source.shooterId ? this.objects.get(source.shooterId) : source.id ? this.objects.get(source.id) : null;
    const ground = new Set();
    const airSet = [];
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const tx = tcx + i;
        const ty = tcy + j;
        if (!map.inBounds(tx, ty)) continue;
        const k = map.idx(tx, ty);
        if (map.ground[k]) ground.add(map.ground[k]);
        if (map.underground[k]) ground.add(map.underground[k]);
        const base = k * INFANTRY_SLOTS;
        for (let s = 0; s < INFANTRY_SLOTS; s++) if (map.infantry[base + s]) ground.add(map.infantry[base + s]);
      }
    }
    if (air) {
      for (const u of this.units) {
        if (u.alive && u.isAir && !u.hidden && Math.abs(u.x - tcx) <= 2 && Math.abs(u.y - tcy) <= 2) airSet.push(u);
      }
    }
    if (isWorm) {
      for (const id of ground) {
        const o = this.objects.get(id);
        if (!o || !o.alive || !o.isUnit || o.type === 'sandworm' || o.isAir) continue;
        if (o.x === tcx && o.y === tcy) {
          o.hidden = true;
          o.eaten = true;
          o.handleDamage(Math.round(damage), source.worm || null, ownerHouse);
        }
      }
      return;
    }
    if (air) {
      if (btype === B.DROCKET || btype === B.ROCKET || btype === B.TURRET_ROCKET || btype === B.SMALL_ROCKET) {
        for (const a of airSet) {
          const d = Math.round(Math.hypot(a.rx - px, a.ry - py));
          if (d > radius) continue;
          if (btype === B.DROCKET) {
            if (a.type !== 'carryall' && a.type !== 'frigate' && this.rng.rand() < this.deviateWeakness(a.originalOwner)) a.deviate(ownerHouse);
          } else if (a.type === 'ornithopter') {
            a.handleDamage(Math.round(damage), shooter, ownerHouse);
          } else {
            a.handleDamage(Math.round(damage) >> (Math.floor(d / 16) + 1), shooter, ownerHouse);
          }
        }
      }
    } else {
      for (const id of ground) {
        const o = this.objects.get(id);
        if (!o || !o.alive) continue;
        if (o.isStructure) {
          if (o.containsPx(px, py)) {
            if (btype === B.DROCKET) continue;
            o.handleDamage(Math.round(damage), shooter, ownerHouse);
            if ((btype === B.ROCKET || btype === B.TURRET_ROCKET || btype === B.SMALL_ROCKET || btype === B.LARGE_ROCKET) && o.badlyDamaged && o.smoke.length < 5) {
              o.smoke.push({ x: px / TILESIZE, y: py / TILESIZE, t: this.cycle });
            }
          }
        } else {
          if (o.hidden) continue;
          const d = Math.round(Math.hypot(o.rx - px, o.ry - py));
          if (d > radius) continue;
          if (btype === B.DROCKET) {
            if (o.type !== 'sandworm' && this.rng.rand() < this.deviateWeakness(o.originalOwner)) o.deviate(ownerHouse);
          } else if (btype === B.SONIC) {
            if (o.type === 'sonicTank') continue;
            o.handleDamage(Math.round(damage), shooter, ownerHouse);
          } else {
            o.handleDamage(Math.round(damage) >> (Math.floor(d / 16) + 1), shooter, ownerHouse);
          }
        }
      }
      // terraforming by rockets
      if (map.inBounds(tcx, tcy) && (btype === B.ROCKET || btype === B.TURRET_ROCKET || btype === B.SMALL_ROCKET || btype === B.LARGE_ROCKET)) {
        const k = map.idx(tcx, tcy);
        const gid = map.ground[k];
        const o = gid ? this.objects.get(gid) : null;
        if (!o || !o.isStructure) {
          if (map.types[k] === T.SLAB) {
            map.setType(tcx, tcy, T.ROCK);
            map.tileOwner[k] = -1;
          }
          if (map.damage[k] < 4) {
            map.damage[k]++;
            map.spiceDirty = true;
          }
        }
      }
    }
    if (btype !== B.SONIC && map.inBounds(tcx, tcy)) {
      const t = map.getType(tcx, tcy);
      if (t === T.SPICE_BLOOM) this.triggerBloom(tcx, tcy, ownerHouse, false);
      else if (t === T.SPECIAL_BLOOM) this.triggerBloom(tcx, tcy, ownerHouse, true);
    }
  }

  deviateWeakness(house) {
    return this.isCampaign ? DEVIATE_WEAKNESS[house] ?? 0.5 : 1;
  }

  // Tile::triggerSpiceBloom / triggerSpecialBloom
  triggerBloom(x, y, house, special) {
    const map = this.map;
    if (!special) {
      map.setType(x, y, T.SPICE);
      map.spice[map.idx(x, y)] = this.rng.randInt(RANDOM_SPICE_MIN, RANDOM_SPICE_MAX);
      this.spiceField(x, y, 5, false, true);
      this.events.emit('bloom', { x, y });
      if (this.isTileVisibleToTeam(this.teamOf(this.player), x, y)) this.message('A spice bloom has erupted', 'info', 'bloom');
    } else {
      map.setType(x, y, T.SAND);
      const r = this.rng.randInt(0, 3);
      const h = this.houses[house];
      if (r === 0) {
        if (h) h.returnCredits(this.rng.randInt(150, 400));
        if (house === this.player) this.message('Hidden cache found: credits received!', 'good');
      } else if (r === 1) {
        this.placeUnit('trike', house, x, y);
        if (house === this.player) this.message('A Trike has been found!', 'good');
      } else {
        const enemies = this.houses.filter((hh) => hh && hh.team !== this.teamOf(house) && hh.numUnits > 0);
        if (enemies.length) {
          const e = enemies[this.rng.randInt(0, enemies.length - 1)];
          if (r === 2) this.placeUnit('trike', e.id, x, y, { mode: MODE.HUNT });
          else for (let i = 0; i < 3; i++) this.placeUnit('soldier', e.id, x, y, { mode: MODE.HUNT });
          if (house === this.player) this.message('It’s a trap! Enemy nearby.', 'warn');
        }
      }
      this.events.emit('bloom', { x, y, special: true });
    }
  }

  // Map::createSpiceField: sand tiles in euclidean radius become spice
  spiceField(cx, cy, r, centerThick = false, sandOnly = true) {
    const map = this.map;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!map.inBounds(x, y)) continue;
        if (Math.hypot(x - cx, y - cy) > r) continue;
        const t = map.getType(x, y);
        if (x === cx && y === cy && centerThick) {
          if (isSandLike(t) && t !== T.SPICE_BLOOM && t !== T.SPECIAL_BLOOM) map.setSpice(x, y, true, this.rng);
          continue;
        }
        if (t === T.SAND || (!sandOnly && t === T.DUNES)) map.setSpice(x, y, false, this.rng);
      }
    }
  }

  computeSandRegions() {
    const map = this.map;
    map.sandRegion.fill(-1);
    let region = 0;
    const stack = [];
    for (let i = 0; i < map.width * map.height; i++) {
      if (map.sandRegion[i] >= 0 || !isSandLike(map.types[i])) continue;
      stack.push(i);
      map.sandRegion[i] = region;
      while (stack.length) {
        const k = stack.pop();
        const x = k % map.width;
        const y = (k / map.width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (!map.inBounds(nx, ny)) continue;
            const nk = map.idx(nx, ny);
            if (map.sandRegion[nk] < 0 && isSandLike(map.types[nk])) {
              map.sandRegion[nk] = region;
              stack.push(nk);
            }
          }
        }
      }
      region++;
    }
  }

  sandRegion(x, y) {
    const map = this.map;
    if (!map.inBounds(x, y)) return -2;
    return map.sandRegion[map.idx(x, y)];
  }

  // ---------------------------------------------------------------------------
  // lifecycle events
  onObjectDamaged(obj, damage, damager) {
    const house = this.houses[obj.owner];
    if (house && house.ai) house.ai.onDamage(obj, damage, damager);
    if (obj.owner === this.player && damager && damager.owner !== this.player) {
      if (obj.isStructure) {
        this.alert('baseAttack', 'Our base is under attack!', obj.px, obj.py, 900);
      } else if (obj.type === 'harvester') {
        this.alert('harvAttack', 'Harvester under attack!', obj.px, obj.py, 900);
      } else if (!obj.isAir) {
        this.alert('unitAttack', 'Our forces are under attack', obj.px, obj.py, 1500, false);
      }
    }
  }

  alert(key, text, x, y, cooldown = 900, speak = true, voice = key) {
    const last = this.lastAlert.get(key) ?? -99999;
    if (this.cycle - last < cooldown) return;
    this.lastAlert.set(key, this.cycle);
    this.pings.push({ x, y, t: performance.now() });
    if (this.pings.length > 10) this.pings.shift();
    this.message(text, 'warn', key, speak, voice);
    this.events.emit('alert', { key, x, y });
  }

  informKilled(killerHouse, obj) {
    const h = this.houses[killerHouse];
    if (!h || killerHouse === obj.owner) return;
    if (obj.isStructure) h.stats.structuresKilled++;
    else h.stats.unitsKilled++;
    h.stats.destroyedValue = (h.stats.destroyedValue || 0) + Math.max(1, Math.floor((obj.st.price || 0) / 100));
  }

  onUnitDestroyed(u, visible, silent = false) {
    this.objects.delete(u.id);
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    this.selection.delete(u);
    const house = this.houses[u.owner];
    if (house) {
      house.dec(u.type, true);
      if (!silent) house.stats.unitsLost++;
      if (u.type === 'harvester' && !silent) this.onHarvesterLost(house);
      if (house.ai) house.ai.onUnitLost && house.ai.onUnitLost(u);
    }
    if (!silent) {
      this.events.emit('unitDestroyed', { unit: u, visible, x: u.px, y: u.py });
      if (u.owner === this.player && visible && !u.eaten && u.type !== 'sandworm') {
        if (u.type === 'harvester') this.message('Harvester destroyed', 'warn', 'harvLost', true, 'harvLost');
        else this.message('Unit lost', 'warn', 'unitLost', true, 'unitLost');
      }
    }
    this.checkHouseAlive(u.owner);
  }

  onHarvesterLost(house) {
    // free replacement when the last harvester is gone (House::decrementHarvesters)
    if (house.getCount('harvester') > 0) return;
    const ref = this.structures.find((s) => s.alive && s.owner === house.id && s.type === 'refinery');
    if (ref && !this.over) this.freeHarvester(ref);
  }

  onStructureDestroyed(s) {
    this.objects.delete(s.id);
    const i = this.structures.indexOf(s);
    if (i >= 0) this.structures.splice(i, 1);
    this.selection.delete(s);
    const house = this.houses[s.owner];
    if (house) {
      house.dec(s.type, false);
      house.stats.structuresLost++;
      house.recalcPowerAndStorage();
      this.updateBuildLists(s.owner);
      if (house.ai) house.ai.onStructureLost && house.ai.onStructureLost(s);
    }
    this.events.emit('structureDestroyed', { structure: s, x: s.px, y: s.py });
    if (s.owner === this.player) this.message(`Structure destroyed: ${itemName(s.type)}`, 'warn', 'structLost', true, 'structLost');
    this.checkHouseAlive(s.owner);
  }

  spawnSurvivor(u) {
    const s = this.spawnSoldierAt(u.owner, u.x, u.y, 0.5);
    if (s && u.deviationTimer > 0 && u.owner !== u.originalOwner) {
      s.originalOwner = u.originalOwner;
      s.deviationTimer = u.deviationTimer;
    }
  }

  spawnSoldierAt(owner, x, y, healthFrac = 1) {
    const map = this.map;
    if (!map.inBounds(x, y)) return null;
    const u = this.createUnit('soldier', owner);
    const spot = map.findNearest(x, y, 2, (tx, ty) => u.canPass(tx, ty));
    if (!spot) {
      this.removeObject(u);
      return null;
    }
    u.health = Math.max(1, Math.round(u.maxHealth * healthFrac));
    u.setLocation(spot[0], spot[1]);
    u.destination = { x: spot[0], y: spot[1] };
    u.guardPoint = { x: spot[0], y: spot[1] };
    u.viewMap();
    return u;
  }

  // InfantryBase capture
  captureStructure(s, newOwner) {
    const g = this;
    const oldOwner = s.owner;
    const oldHouse = this.houses[oldOwner];
    const newHouse = this.houses[newOwner];
    // kill other infantry on structure tiles
    // steal spice from silos/refineries
    if ((s.type === 'silo' || s.type === 'refinery') && oldHouse && newHouse && oldHouse.capacity > 0) {
      const stolen = (1000 * oldHouse.storedCredits) / oldHouse.capacity;
      const take = Math.min(stolen, oldHouse.storedCredits);
      oldHouse.storedCredits -= take;
      newHouse.storedCredits += take;
    }
    if (oldHouse) oldHouse.dec(s.type, false);
    s.owner = newOwner;
    s.st = stats(s.type, s.originalOwner);
    s.repairing = false;
    if (s.isBuilder) {
      s.queue = [];
      s.currentItem = null;
      s.progress = 0;
      s.upgrading = false;
    }
    if (s.target) s.setTarget(null);
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const k = this.map.idx(s.x + i, s.y + j);
        this.map.tileOwner[k] = newOwner;
      }
    }
    if (s.type === 'refinery' && s.harvester) this.changeOwner(s.harvester, newOwner, true);
    if (s.type === 'repairYard' && s.unit) this.changeOwner(s.unit, newOwner, true);
    if (newHouse) newHouse.inc(s.type, false);
    oldHouse?.recalcPowerAndStorage();
    newHouse?.recalcPowerAndStorage();
    this.updateBuildLists(oldOwner);
    this.updateBuildLists(newOwner);
    this.selection.delete(s);
    this.events.emit('captured', { structure: s, from: oldOwner, to: newOwner });
    if (newOwner === this.player) this.message(`Structure captured: ${itemName(s.type)}`, 'good', 'captured', true, 'captured');
    else if (oldOwner === this.player) this.message(`The enemy has captured our ${itemName(s.type)}`, 'warn', 'lostCapture', true, 'lostCapture');
    this.checkHouseAlive(oldOwner);
  }

  changeOwner(u, newOwner, permanent = false) {
    const oldH = this.houses[u.owner];
    const newH = this.houses[newOwner];
    if (oldH) oldH.dec(u.type, !u.isStructure);
    u.owner = newOwner;
    if (permanent) u.originalOwner = newOwner;
    if (newH) newH.inc(u.type, !u.isStructure);
    this.events.emit('ownerChanged', { object: u });
    if (oldH) this.checkHouseAlive(oldH.id);
  }

  deselect(o) {
    this.selection.delete(o);
  }

  checkHouseAlive(houseId) {
    const h = this.houses[houseId];
    if (!h || this.over) return;
    if (h.checkAlive()) {
      h.defeated = false;
      return;
    }
    if (h.defeated) return;
    h.defeated = true;
    if (this.cycle > 0) this.message(`${['Fremen', 'Sardaukar', 'Mercenaries'].includes(h.name) ? 'The ' + h.name + ' have' : 'House ' + h.name + ' has'} been defeated.`, houseId === this.player ? 'warn' : 'good', 'defeated_' + houseId);
    this.events.emit('houseDefeated', { house: houseId });
    this.checkWinLose();
  }

  // ---------------------------------------------------------------------------
  // win / lose
  checkWinLose() {
    if (this.over) return;
    const sc = this.scenario;
    const playerTeam = this.teamOf(this.player);
    if (sc.winFlags & WIN.HUMAN_HAS_BUILDINGS) {
      const anyAlive = this.houses.some((h) => h && h.team === playerTeam && h.alive);
      if (!anyAlive) {
        this.endGame(!!(sc.loseFlags & WIN.HUMAN_HAS_BUILDINGS), 'player-destroyed');
        return;
      }
    }
    if (sc.winFlags & WIN.AI_NO_BUILDINGS) {
      const enemyAlive = this.houses.some((h) => h && h.team !== playerTeam && h.team !== 0 && h.alive);
      if (!enemyAlive) {
        this.endGame(!!(sc.loseFlags & WIN.AI_NO_BUILDINGS), 'enemies-destroyed');
      }
    }
  }

  declareWinner(team) {
    if (this.over) return;
    this.endGame(team === this.teamOf(this.player), 'quota');
  }

  endGame(won, reason) {
    if (this.over) return;
    this.over = { won, reason };
    this.overCycle = this.cycle;
    this.events.emit('gameOver', this.over);
  }

  // ---------------------------------------------------------------------------
  // messages
  message(text, kind = 'info', key = null, speak = false, spoken = null) {
    if (key) {
      const last = this.lastAlert.get('msg_' + key) ?? -99999;
      if (this.cycle - last < 60 && kind !== 'warn') return;
      this.lastAlert.set('msg_' + key, this.cycle);
    }
    const m = { text, kind, t: performance.now(), cycle: this.cycle };
    this.messages.push(m);
    if (this.messages.length > 50) this.messages.shift();
    this.events.emit('message', { ...m, speak, spoken: spoken || text, key });
  }

  warn(text, key, pos) {
    if (pos) this.pings.push({ x: pos.x, y: pos.y, t: performance.now() });
    this.message(text, 'warn', key, true, key);
  }

  addBullet(b) {
    this.bullets.push(b);
  }

  // ---------------------------------------------------------------------------
  // triggers (reinforcements / timeout)
  addReinforcement(t) {
    this.triggers.push({ kind: 'reinforce', ...t, next: t.cycle });
  }

  runTriggers() {
    for (const t of this.triggers) {
      if (t.done) continue;
      if (this.cycle >= t.next) {
        if (t.kind === 'reinforce') this.doReinforcement(t);
        else if (t.kind === 'timeout') {
          t.done = true;
          this.endGame(!!(this.scenario.loseFlags & WIN.TIMEOUT), 'timeout');
        }
        if (t.repeat && t.kind === 'reinforce') t.next = this.cycle + t.repeat;
        else t.done = true;
      }
    }
  }

  doReinforcement(t) {
    const map = this.map;
    const house = this.houses[t.house];
    if (!house) return;
    // a house that was defeated (no buildings and no army) gets no more reinforcements, unless it never had a base
    if (house.defeated && house.everHadStructures) return;
    const where = (t.where || 'enemybase').toLowerCase();
    const types = [];
    for (const u of t.units) {
      if (u === 'infantry') types.push('soldier', 'soldier', 'soldier');
      else if (u === 'troopers') types.push('trooper', 'trooper', 'trooper');
      else types.push(u);
    }
    if (where === 'north' || where === 'south' || where === 'east' || where === 'west') {
      for (const type of types) {
        let x;
        let y;
        for (let tries = 0; tries < 63; tries++) {
          const along = this.rng.randInt(0, (where === 'north' || where === 'south' ? map.width : map.height) - 1);
          if (where === 'north') { x = along; y = 0; }
          else if (where === 'south') { x = along; y = map.height - 1; }
          else if (where === 'west') { x = 0; y = along; }
          else { x = map.width - 1; y = along; }
          if (type !== 'sandworm' || isSandLike(map.getType(x, y))) break;
        }
        const u = this.placeUnit(type, t.house, x, y, { mode: type === 'sandworm' ? MODE.AMBUSH : MODE.HUNT });
        if (u && type === 'harvester') u.attackMode = MODE.HARVEST;
      }
      return;
    }
    // carryall drop
    let target = null;
    if (where === 'air') target = [this.rng.randInt(2, map.width - 3), this.rng.randInt(2, map.height - 3)];
    else if (where === 'visible') target = [Math.floor(map.width / 2), Math.floor(map.height / 2)];
    else if (where === 'homebase') target = this.baseCenter(t.house);
    else {
      const enemy = this.houses.find((h) => h && h.alive && h.team !== house.team && h.team !== 0 && h.numStructures > 0);
      target = enemy ? this.baseCenter(enemy.id) : null;
    }
    if (!target) target = [this.rng.randInt(2, map.width - 3), this.rng.randInt(2, map.height - 3)];
    let [dx, dy] = target;
    for (let i = 0; i < 32; i++) {
      const nx = dx + this.rng.randInt(-7, 7);
      const ny = dy + this.rng.randInt(-7, 7);
      if (map.inBounds(nx, ny) && !map.ground[map.idx(nx, ny)] && map.getType(nx, ny) !== T.MOUNTAIN) {
        dx = nx;
        dy = ny;
        break;
      }
    }
    const [ex, ey] = this.closestEdgePoint(dx, dy);
    const carry = this.createUnit('carryall', t.house);
    carry.owned = false;
    carry.dropOfferer = true;
    carry.placeAt(ex * TILESIZE + 32, ey * TILESIZE + 32);
    carry.guardPoint = { x: ex, y: ey };
    carry.angle = this.edgeInwardAngle(ex, ey);
    carry.currentMaxSpeed = carry.st.maxSpeed;
    for (const type of types) {
      const u = this.createUnit(type, t.house);
      u.x = ex;
      u.y = ey;
      u.hidden = true;
      u.active = false;
      u.pickedUp = true;
      u.respondable = false;
      u.destination = { x: dx, y: dy };
      carry.cargo.push(u);
    }
    carry.destination = { x: dx, y: dy };
    if (t.house !== this.player && this.teamOf(t.house) !== this.teamOf(this.player)) {
      // nothing; enemy reinforcements arrive silently
    } else if (t.house === this.player) {
      this.message('Reinforcements have arrived', 'good', 'reinf', true, 'reinf');
    }
  }

  // House::getCenterOfMainBase
  baseCenter(houseId) {
    const list = this.structures.filter((s) => s.alive && s.owner === houseId);
    if (!list.length) {
      let best = null;
      for (const u of this.units) if (u.alive && u.owner === houseId && !u.isAir && (!best || u.st.price > best.st.price)) best = u;
      return best ? [best.x, best.y] : null;
    }
    let ax = 0;
    let ay = 0;
    for (const s of list) {
      ax += s.x + s.w / 2;
      ay += s.y + s.h / 2;
    }
    ax /= list.length;
    ay /= list.length;
    let best = list[0];
    let bd = Infinity;
    for (const s of list) {
      const d = Math.hypot(s.x - ax, s.y - ay);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return [best.x, best.y];
  }

  // ---------------------------------------------------------------------------
  // main simulation step
  update() {
    if (this.over && this.cycle - this.overCycle > 375) return;
    this.map.cycle = this.cycle;
    for (const h of this.houses) {
      if (!h) continue;
      h.update();
      h.choam.update(this.cycle);
    }
    this.runTriggers();
    // AI activation on visual contact (CampaignAIPlayer sleeps until then)
    if (this.cycle % 31 === 0) this.checkContact();
    for (let i = 0; i < this.structures.length; i++) {
      const s = this.structures[i];
      if (s.alive) s.update();
    }
    const units = this.units.slice();
    for (const u of units) {
      if (u.alive) u.update();
    }
    for (const b of this.bullets) if (b.alive) b.update();
    this.bullets = this.bullets.filter((b) => b.alive);
    // cleanup any dead units not removed
    for (const u of this.units) if (!u.alive) this.onUnitDestroyed(u, false, true);
    this.cycle++;
  }

  checkContact() {
    for (const u of this.units) {
      if (!u.alive || u.hidden || u.isAir || u.type === 'sandworm') continue;
      const h = this.houses[u.owner];
      if (!h) continue;
      for (const other of this.houses) {
        if (!other || other.team === h.team) continue;
        if (this.isTileVisibleToTeam(other.team, u.x, u.y)) {
          // only counts if the other team really sees it right now (recently viewed)
          const s = this.map.seen[other.team][this.map.idx(u.x, u.y)];
          if (this.cycle - s < 40) {
            if (h.ai) h.ai.activate();
            if (other.ai) other.ai.activate();
          }
        }
      }
    }
  }

  // score for statistics screen (CampaignStatsMenu)
  computeScore(level) {
    const p = this.houses[this.player];
    let score = level * 45;
    for (const h of this.houses) {
      if (!h) continue;
      const v = h.stats.destroyedValue || 0;
      score += h.team === p.team ? v : -v;
    }
    score += Math.floor(p.credits / 100);
    for (const s of this.structures) if (s.alive && s.owner === this.player) score += Math.floor((s.st.price || 0) / 100);
    score -= Math.floor((this.cycle * 16) / 1000 / 60) + 1;
    return Math.max(0, score);
  }
}

function isSpiceType(t) {
  return t === T.SPICE || t === T.THICK_SPICE;
}

export const RANKS = [
  [1400, 'Emperor'], [1000, 'Ruler of Arrakis'], [700, 'Supreme Warlord'], [500, 'Warlord'],
  [400, 'Base Commander'], [300, 'Outpost Commander'], [200, 'Squad Leader'], [150, 'Desert Trooper'],
  [100, 'Sand Warrior'], [50, 'Desert Mongoose'], [25, 'Sand Snake'], [0, 'Sand Flea'],
];

export function rankFor(score) {
  for (const [s, n] of RANKS) if (score >= s) return n;
  return RANKS[RANKS.length - 1][1];
}
