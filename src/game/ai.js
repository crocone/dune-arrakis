import { T, H } from '../core/constants.js';
import { MODE, blockDistance } from './object.js';
import { stats, STRUCTURE_SIZE, isStructureType } from '../data/gamedata.js';

const AI_UPDATE_INTERVAL = 50;

// Build priority of units (CampaignAIPlayer.cpp:42-90)
const UNIT_PRIORITY = {
  devastator: 175, siegeTank: 130, launcher: 100, tank: 80, sonicTank: 80, ornithopter: 75, quad: 60, raider: 55, trike: 50,
  trooper: 50, deviator: 50, soldier: 20, carryall: 20, harvester: 10, mcv: 10, saboteur: 0,
};

// Target priority (CampaignAIPlayer.cpp:92-145)
const TARGET_PRIORITY = {
  saboteur: 700, heavyFactory: 600, repairYard: 600, palace: 400, devastator: 355, constructionYard: 300, windtrap: 300,
  refinery: 300, siegeTank: 280, radar: 275, launcher: 250, starport: 250, gunTurret: 225, deviator: 225, rocketTurret: 225,
  highTechFactory: 200, tank: 200, sonicTank: 200, lightFactory: 200, ix: 200, barracks: 150, wor: 150, quad: 150, harvester: 150,
  trooper: 120, raider: 100, trike: 100, silo: 100, ornithopter: 100, mcv: 100, soldier: 70, carryall: 50, wall: 30,
};

const NON_COMBAT = new Set(['harvester', 'mcv', 'carryall', 'frigate', 'saboteur', 'sandworm']);

export class AIPlayer {
  constructor(game, houseId, opts = {}) {
    this.game = game;
    this.houseId = houseId;
    this.mode = opts.mode || 'campaign'; // 'campaign' | 'skirmish'
    this.difficulty = opts.difficulty ?? 1; // 0 easy, 1 medium, 2 hard
    this.active = this.mode !== 'campaign';
    this.attackTriggered = false;
    this.fullScaleDone = false;
    this.lastWaveCycle = -99999;
    this.rebuildQueue = []; // [{type, x, y}]
    this.nextAttackCycle = this.mode === 'skirmish' ? [7, 5, 3.5][this.difficulty] * 60 * 62.5 + houseId * 900 : Infinity;
    this.waveSize = this.mode === 'skirmish' ? [5, 7, 9][this.difficulty] : 8;
    this.placeTries = 0;
  }

  get house() {
    return this.game.houses[this.houseId];
  }

  activate() {
    if (!this.active) {
      this.active = true;
    }
  }

  buildSpeedLimit() {
    if (this.mode !== 'campaign') return [0.7, 0.85, 1][this.difficulty];
    const tl = this.game.techLevel;
    return Math.min(1, ((tl - 1) * 20 + 95) / 255) * [0.85, 1, 1.15][this.difficulty];
  }

  onDamage(obj, damage, damager) {
    if (!damager || damager.owner === this.houseId) return;
    const g = this.game;
    if (damager.team === obj.team) return;
    this.activate();
    if (obj.isUnit) {
      this.attackTriggered = true;
      if (obj.type === 'harvester' && damager.alive && !damager.isAir) {
        for (const u of g.units) {
          if (u.alive && u.owner === this.houseId && !NON_COMBAT.has(u.type) && !u.target && !u.isAir && u.respondable !== false) {
            if (blockDistance(u.x, u.y, damager.x, damager.y) < 16) {
              u.doSetAttackMode(MODE.HUNT);
              u.doAttackObject(damager, false);
            }
          }
        }
      }
    } else if (obj.isStructure) {
      this.attackTriggered = true;
      if (!this.fullScaleDone) {
        this.fullScaleDone = true;
        for (const u of g.units) {
          if (u.alive && u.owner === this.houseId && !NON_COMBAT.has(u.type) && !u.target && u.respondable !== false) {
            u.doSetAttackMode(MODE.HUNT);
          }
        }
      }
      // defend: units near the base attack the damager
      if (damager.alive && damager.isUnit && !damager.isAir) {
        for (const u of g.units) {
          if (u.alive && u.owner === this.houseId && !NON_COMBAT.has(u.type) && !u.target && blockDistance(u.x, u.y, obj.x, obj.y) < 12) {
            u.doAttackObject(damager, false);
          }
        }
      }
    }
  }

  onStructureLost(s) {
    if (s.type === 'wall') return;
    if (this.rebuildQueue.length < 5) this.rebuildQueue.push({ type: s.type, x: s.x, y: s.y });
  }

  update() {
    const g = this.game;
    if ((g.cycle + this.houseId * 7) % AI_UPDATE_INTERVAL !== 0) return;
    const house = this.house;
    if (!house || !house.alive) return;
    this.updateHarvesters();
    this.updateMCVs();
    if (!this.active) return;
    for (const s of g.structures) {
      if (!s.alive || s.owner !== this.houseId) continue;
      if (s.type === 'palace' && s.isReady()) this.usePalace(s);
      if (s.health < s.maxHealth / 2 && !s.repairing && house.credits > 200) s.doRepair();
      if (s.isBuilder) {
        s.buildSpeedLimit = this.buildSpeedLimit();
        if (s.type !== 'starport' && s.canUpgrade() && !s.currentItem && house.credits > (this.mode === 'campaign' ? 300 : 900)) {
          s.doUpgrade();
          continue;
        }
        if (s.upgrading) continue;
        if (s.type === 'constructionYard') this.updateConstructionYard(s);
        else if (s.type === 'starport') this.updateStarport(s);
        else this.updateFactory(s);
      }
    }
    this.updateUnits();
  }

  // ---------------------------------------------------------------------------
  updateConstructionYard(cy) {
    const g = this.game;
    const house = this.house;
    if (cy.waitingToPlace && cy.currentItem) {
      const type = cy.currentItem;
      let spot = null;
      const rq = this.rebuildQueue.find((r) => r.type === type);
      if (rq && g.canPlaceStructure(this.houseId, type, rq.x, rq.y).ok) spot = [rq.x, rq.y];
      if (!spot) spot = this.findPlaceLocation(type);
      if (spot) {
        const s = g.placeStructure(this.houseId, type, spot[0], spot[1], { builder: cy });
        cy.onPlaced();
        if (rq) this.rebuildQueue.splice(this.rebuildQueue.indexOf(rq), 1);
        if (s && s.isBuilder) s.buildSpeedLimit = this.buildSpeedLimit();
        this.placeTries = 0;
      } else if (++this.placeTries > 6) {
        cy.doCancelItem(type);
        if (rq) this.rebuildQueue.splice(this.rebuildQueue.indexOf(rq), 1);
        this.placeTries = 0;
      }
      return;
    }
    if (cy.currentItem) return;
    if (this.mode === 'campaign') {
      const rq = this.rebuildQueue[0];
      if (rq) {
        if (cy.buildList.includes(rq.type) && house.credits > 50) cy.doProduceItem(rq.type);
        else if (!cy.buildList.includes(rq.type)) this.rebuildQueue.shift();
      }
      return;
    }
    // skirmish: grow the base
    const want = this.nextStructureToBuild(cy);
    if (want && house.credits > 100) cy.doProduceItem(want);
  }

  nextStructureToBuild(cy) {
    const house = this.house;
    const c = (t) => house.getCount(t);
    const can = (t) => cy.buildList.includes(t);
    const powerMargin = house.producedPower - house.powerRequirement;
    const d = this.difficulty;
    const order = [];
    if (powerMargin < 50 && can('windtrap')) return 'windtrap';
    if (c('refinery') < 1 && can('refinery')) return 'refinery';
    if (c('barracks') < 1 && can('barracks') && house.id !== H.HARKONNEN) order.push('barracks');
    if (c('refinery') < 2 && can('refinery')) order.push('refinery');
    if (c('radar') < 1 && can('radar')) order.push('radar');
    if (c('lightFactory') < 1 && can('lightFactory')) order.push('lightFactory');
    if (c('wor') < 1 && can('wor') && house.id === H.HARKONNEN) order.push('wor');
    if (c('heavyFactory') < 1 && can('heavyFactory')) order.push('heavyFactory');
    if (house.capacity - house.storedCredits < 400 && can('silo')) order.push('silo');
    if (c('gunTurret') < 2 + d && can('gunTurret')) order.push('gunTurret');
    if (c('rocketTurret') < 1 + d && can('rocketTurret')) order.push('rocketTurret');
    if (c('refinery') < 2 + d && can('refinery')) order.push('refinery');
    if (c('repairYard') < 1 && can('repairYard')) order.push('repairYard');
    if (c('highTechFactory') < 1 && can('highTechFactory')) order.push('highTechFactory');
    if (c('ix') < 1 && can('ix')) order.push('ix');
    if (c('starport') < 1 && can('starport') && house.credits > 1000) order.push('starport');
    if (c('palace') < 1 && can('palace') && house.credits > 1200) order.push('palace');
    if (c('heavyFactory') < 2 && can('heavyFactory') && house.credits > 1500) order.push('heavyFactory');
    if (c('rocketTurret') < 3 + d * 2 && can('rocketTurret') && house.credits > 1500) order.push('rocketTurret');
    return order[0] || null;
  }

  // AIPlayer::findPlaceLocation simplified: score candidate spots around the base
  findPlaceLocation(type) {
    const g = this.game;
    const map = g.map;
    const [w, h] = STRUCTURE_SIZE[type] || [1, 1];
    const own = g.structures.filter((s) => s.alive && s.owner === this.houseId);
    if (!own.length) return null;
    const center = g.baseCenter(this.houseId) || [own[0].x, own[0].y];
    const enemy = this.enemyBaseCenter();
    let best = null;
    let bestScore = -Infinity;
    const R = 14;
    for (let y = center[1] - R; y <= center[1] + R; y++) {
      for (let x = center[0] - R; x <= center[0] + R; x++) {
        if (!map.inBounds(x, y) || !map.inBounds(x + w - 1, y + h - 1)) continue;
        const res = g.canPlaceStructure(this.houseId, type, x, y);
        if (!res.ok) continue;
        // keep a 1-tile corridor: avoid touching other structures on all sides for big buildings
        let score = -Math.hypot(x - center[0], y - center[1]);
        if (type === 'refinery') {
          const sp = g.findSpice(x + 1, y + 1);
          if (sp) score -= Math.hypot(sp[0] - x, sp[1] - y) * 1.5;
        } else if (type === 'gunTurret' || type === 'rocketTurret') {
          if (enemy) score -= Math.hypot(enemy[0] - x, enemy[1] - y) * 0.8;
          score += this.gapScore(x, y, w, h) * 0;
        } else if (enemy) {
          score += Math.hypot(enemy[0] - x, enemy[1] - y) * 0.3;
        }
        if (type !== 'wall' && type !== 'gunTurret' && type !== 'rocketTurret') score += this.gapScore(x, y, w, h);
        score += g.rng.rand() * 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = [x, y];
        }
      }
    }
    return best;
  }

  // prefer leaving free lanes around buildings
  gapScore(x, y, w, h) {
    const map = this.game.map;
    let blocked = 0;
    for (let j = -1; j <= h; j++) {
      for (let i = -1; i <= w; i++) {
        if (i >= 0 && j >= 0 && i < w && j < h) continue;
        const tx = x + i;
        const ty = y + j;
        if (!map.inBounds(tx, ty)) continue;
        const gid = map.ground[map.idx(tx, ty)];
        if (gid) {
          const o = this.game.objects.get(gid);
          if (o && o.isStructure) blocked++;
        }
      }
    }
    return -blocked * 2;
  }

  enemyBaseCenter() {
    const g = this.game;
    const myTeam = g.teamOf(this.houseId);
    for (const h of g.houses) {
      if (h && h.alive && h.team !== myTeam) {
        const c = g.baseCenter(h.id);
        if (c) return c;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  updateFactory(f) {
    if (f.currentItem || f.queue.length) return;
    const g = this.game;
    const house = this.house;
    if (this.mode === 'skirmish') {
      // economy first: harvesters & carryalls
      const refs = house.getCount('refinery');
      const wantHarv = Math.max(1, Math.round(refs * [1, 1.5, 2][this.difficulty]));
      if (f.type === 'heavyFactory' && house.getCount('harvester') < wantHarv && f.buildList.includes('harvester') && house.credits > 300) {
        f.doProduceItem('harvester');
        return;
      }
      if (f.type === 'highTechFactory' && house.getCount('carryall') < Math.ceil(house.getCount('harvester') / 2) && f.buildList.includes('carryall') && house.credits > 800) {
        f.doProduceItem('carryall');
        return;
      }
      if (house.credits < [600, 300, 150][this.difficulty]) return;
    } else if (house.credits < 100) return;
    let best = null;
    let bestP = -1;
    for (const id of f.buildList) {
      if (id === 'harvester' || id === 'mcv') continue;
      if (id === 'carryall' && house.getCount('carryall') >= 1) continue;
      if (id === 'ornithopter' && this.mode === 'skirmish' && g.cycle < 10 * 60 * 62.5) continue;
      if (id === 'saboteur') continue;
      let p = UNIT_PRIORITY[id] ?? 30;
      if ((this.houseId + hashId(id) + Math.floor(g.cycle / 3000)) % 4 === 0) p += 1000;
      if (p > bestP) {
        bestP = p;
        best = id;
      }
    }
    if (best) f.doProduceItem(best);
  }

  updateStarport(sp) {
    if (this.mode === 'campaign') return;
    const house = this.house;
    const choam = house.choam;
    if (!sp.okToOrder()) return;
    if (sp.orders.length) {
      sp.doPlaceOrder();
      return;
    }
    if (house.credits < 2000) return;
    const cands = ['siegeTank', 'tank', 'launcher', 'quad'].filter((id) => sp.buildList.includes(id) && choam.num(id) > 0 && choam.isCheap(id));
    for (let i = 0; i < Math.min(6, cands.length * 2); i++) {
      const id = cands[i % cands.length];
      if (id && house.credits > choam.price(id) + 1000) sp.doProduceItem(id);
    }
    if (sp.orders.length) sp.doPlaceOrder();
  }

  // ---------------------------------------------------------------------------
  usePalace(p) {
    const g = this.game;
    const kind = p.weaponKind();
    if (kind === 'deathHand') {
      // target: base center of the enemy house with most structures
      let best = null;
      let bestN = 0;
      const myTeam = g.teamOf(this.houseId);
      for (const h of g.houses) {
        if (!h || h.team === myTeam || !h.alive) continue;
        if (h.numStructures > bestN) {
          bestN = h.numStructures;
          best = h;
        }
      }
      if (best) {
        const c = g.baseCenter(best.id);
        if (c) p.doLaunchDeathHand(c[0], c[1]);
      }
    } else {
      p.doSpecialWeapon();
    }
  }

  // ---------------------------------------------------------------------------
  updateHarvesters() {
    const g = this.game;
    const house = this.house;
    let nHarv = 0;
    for (const u of g.units) if (u.alive && u.owner === this.houseId && u.type === 'harvester') nHarv++;
    for (const u of g.units) {
      if (!u.alive || u.owner !== this.houseId || u.type !== 'harvester' || !u.active) continue;
      // flee from worms
      if (!u.returning && g.map.isSand(u.x, u.y)) {
        for (const w of g.units) {
          if (w.alive && w.type === 'sandworm' && !w.hidden && blockDistance(w.x, w.y, u.x, u.y) <= 5) {
            if (u.spice > 0) u.doReturn();
            break;
          }
        }
      }
      if (nHarv < 3 && u.spice >= 350 && !u.returning) u.doReturn();
      if (u.attackMode === MODE.STOP) u.doSetAttackMode(MODE.HARVEST);
    }
    if (house.getCount('harvester') === 0 && house.getCount('refinery') > 0 && house.credits > 400) {
      const hf = g.structures.find((s) => s.alive && s.owner === this.houseId && s.type === 'heavyFactory' && !s.currentItem);
      if (hf && hf.buildList.includes('harvester')) hf.doProduceItem('harvester');
    }
  }

  updateMCVs() {
    const g = this.game;
    for (const u of g.units) {
      if (!u.alive || u.owner !== this.houseId || u.type !== 'mcv' || u.moving) continue;
      if (u.canDeploy()) {
        u.doDeploy();
        continue;
      }
      // find rock spot nearby
      const map = g.map;
      const spot = map.findNearest(u.x, u.y, 20, (x, y) => {
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          if (!map.inBounds(x + i, y + j) || !map.isBuildable(x + i, y + j)) return false;
          if (map.ground[map.idx(x + i, y + j)] && !(i === 0 && j === 0)) return false;
        }
        return true;
      });
      if (spot && (!u.destination || u.destination.x !== spot[0] || u.destination.y !== spot[1])) u.doMove2Pos(spot[0], spot[1], true);
    }
  }

  // ---------------------------------------------------------------------------
  updateUnits() {
    const g = this.game;
    const idle = [];
    for (const u of g.units) {
      if (!u.alive || u.owner !== this.houseId || NON_COMBAT.has(u.type) || u.hidden || u.respondable === false) continue;
      if (u.byScenario && this.mode === 'campaign') continue;
      if (u.target || u.forced || u.attackMode === MODE.HUNT) continue;
      if (u.isAir && u.type !== 'ornithopter') continue;
      idle.push(u);
    }
    const timed = this.mode === 'skirmish' && g.cycle >= this.nextAttackCycle;
    const triggered = this.attackTriggered || this.fullScaleDone || timed;
    if (!triggered) return;
    const enough = idle.length >= this.waveSize || (timed && idle.length >= Math.ceil(this.waveSize / 2));
    if (enough && g.cycle - this.lastWaveCycle >= 750) {
      const target = this.chooseTarget(idle[0]);
      for (const u of idle) {
        u.doSetAttackMode(MODE.HUNT);
        if (target) {
          if (u.isAir) u.doAttackObject(target, false);
          else {
            const [tx, ty] = target.closestPoint(u.x, u.y);
            u.doMove2Pos(tx, ty, false);
            u.attackMode = MODE.HUNT;
          }
        }
      }
      this.lastWaveCycle = g.cycle;
      if (timed) this.nextAttackCycle = g.cycle + [5, 4, 3][this.difficulty] * 60 * 62.5;
    }
  }

  chooseTarget(from) {
    const g = this.game;
    const myTeam = g.teamOf(this.houseId);
    let best = null;
    let bestScore = -1;
    const fx = from ? from.x : 0;
    const fy = from ? from.y : 0;
    const consider = (o) => {
      if (!o.alive || o.team === myTeam || o.hidden || o.type === 'sandworm') return;
      if (this.mode === 'campaign' && !(o.isStructure ? o.isExploredBy(myTeam) : g.isTileVisibleToTeam(myTeam, o.x, o.y))) return;
      const pr = TARGET_PRIORITY[o.type] ?? 50;
      const [cx, cy] = o.closestPoint(fx, fy);
      const d = blockDistance(fx, fy, cx, cy) + 1;
      const s = pr / d;
      if (s > bestScore) {
        bestScore = s;
        best = o;
      }
    };
    for (const s of g.structures) consider(s);
    if (!best) for (const u of g.units) consider(u);
    return best;
  }
}

function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
