import { HOUSE_NAMES, HOUSE_NAMES_EN, msToCycles } from '../core/constants.js';
import { stats } from '../data/gamedata.js';

// A participating house (player or AI). Mirrors Dune Legacy's House economy:
// credits = storedCredits (refined spice, limited by storage capacity) + startingCredits (unlimited).
export class House {
  constructor(game, id, opts = {}) {
    this.game = game;
    this.id = id;
    this.name = HOUSE_NAMES[id];
    this.nameEn = HOUSE_NAMES_EN[id];
    this.team = opts.team ?? id + 1;
    this.isHuman = !!opts.human;
    this.ai = null;
    this.defeated = false; // defeat already announced
    this.startingCredits = opts.credits ?? 0;
    this.storedCredits = 0;
    this.quota = opts.quota ?? 0;
    this.maxUnits = opts.maxUnits ?? 0;
    this.capacity = 0; // spice storage
    this.producedPower = 0;
    this.powerRequirement = 0;
    this.powerUsageTimer = msToCycles(15000);
    this.counts = new Map(); // itemId -> count
    this.numUnits = 0;
    this.numStructures = 0;
    this.stats = {
      spiceHarvested: 0,
      unitsBuilt: 0,
      structuresBuilt: 0,
      unitsKilled: 0,
      structuresKilled: 0,
      unitsLost: 0,
      structuresLost: 0,
      damageDealt: 0,
      creditsSpent: 0,
    };
    this.lastAttackNotice = -99999;
    this.techLevel = opts.techLevel ?? 8;
    this.palaceTimer = 0;
  }

  get credits() {
    return Math.floor(this.storedCredits + this.startingCredits);
  }

  getCount(item) {
    return this.counts.get(item) || 0;
  }

  addCredits(amount, refined = false) {
    if (amount <= 0) return;
    if (refined) {
      this.stats.spiceHarvested += amount;
    }
    this.storedCredits += amount;
    const g = this.game;
    if (this.quota > 0 && g.scenario.winFlags & 4 && this.isHuman && this.credits >= this.quota) {
      g.declareWinner(this.team);
    }
  }

  // refund (e.g. cancelled production) - overflow above capacity goes to starting credits
  returnCredits(amount) {
    if (amount <= 0) return;
    const left = Math.max(0, this.capacity - this.storedCredits);
    if (amount <= left) this.addCredits(amount, false);
    else {
      this.addCredits(left, false);
      this.startingCredits += amount - left;
    }
  }

  // withdraw up to `amount`; returns what was actually taken
  takeCredits(amount) {
    let taken = 0;
    if (this.credits >= 1) {
      if (this.storedCredits > amount) {
        taken = amount;
        this.storedCredits -= amount;
      } else {
        taken = this.storedCredits;
        this.storedCredits = 0;
        if (this.startingCredits > amount - taken) {
          this.startingCredits -= amount - taken;
          taken = amount;
        } else {
          taken += this.startingCredits;
          this.startingCredits = 0;
        }
      }
    }
    this.stats.creditsSpent += taken;
    return taken;
  }

  hasPower() {
    return this.producedPower >= this.powerRequirement;
  }

  // ratio used by production speed (Dune Legacy: production slows without power)
  powerRatio() {
    if (this.powerRequirement <= 0) return 1;
    return Math.min(1, this.producedPower / this.powerRequirement);
  }

  recalcPowerAndStorage() {
    let produced = 0;
    let required = 0;
    let cap = 0;
    for (const s of this.game.structures) {
      if (!s.alive || s.owner !== this.id) continue;
      const st = stats(s.type, s.originalOwner);
      if (s.type === 'windtrap') {
        // windtraps produce power proportional to their health (WindTrap::getProducedPower)
        produced += Math.round((Math.abs(st.power) * s.health) / s.maxHealth);
      } else if (st.power > 0) {
        required += st.power;
      }
      if (s.type === 'refinery' || s.type === 'silo') cap += st.capacity;
    }
    this.producedPower = produced;
    this.powerRequirement = required;
    this.capacity = cap;
  }

  inc(item, isUnit) {
    this.counts.set(item, this.getCount(item) + 1);
    if (isUnit) this.numUnits++;
    else this.numStructures++;
  }

  dec(item, isUnit) {
    this.counts.set(item, Math.max(0, this.getCount(item) - 1));
    if (isUnit) this.numUnits--;
    else this.numStructures--;
  }

  update() {
    // spice above storage capacity slowly rots away
    if (this.storedCredits > this.capacity) {
      this.storedCredits = Math.max(0, this.storedCredits - 1);
      if (this.isHuman && this.game.cycle % 400 === 0) {
        this.game.message('Spice storage full: excess spice is being lost!', 'warn', 'storage', this.game.cycle % 2000 === 0, 'storage');
      }
    }
    if (this.isHuman && this.game.cycle % 125 === 0) {
      const low = this.powerRequirement > 0 && !this.hasPower();
      if (low && (!this.lowPower || this.game.cycle - this.lowPowerAt > 3750)) {
        this.lowPowerAt = this.game.cycle;
        this.game.message('Low power: build more Windtraps', 'warn', 'lowPower', true, 'lowPower');
      }
      this.lowPower = low;
    }
    if (--this.powerUsageTimer <= 0) {
      this.powerUsageTimer = msToCycles(15000);
      this.takeCredits(this.powerRequirement / 32);
    }
    if (this.ai) this.ai.update();
  }

  // House::isAlive (dynamic): any structure except walls, or any unit except carryall/harvester/frigate/sandworm
  get alive() {
    return this.checkAlive();
  }

  checkAlive() {
    const structs = this.numStructures - this.getCount('wall');
    const units = this.numUnits - this.getCount('carryall') - this.getCount('harvester') - this.getCount('frigate') - this.getCount('sandworm');
    return structs > 0 || units > 0;
  }
}
