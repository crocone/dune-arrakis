import objectData from './objectData.json';
import { H } from '../core/constants.js';

// ---------------------------------------------------------------------------
// Static metadata for all items. Numeric stats come from Dune Legacy's ObjectData.ini
// (converted into objectData.json); everything else is descriptive / visual.
// ---------------------------------------------------------------------------

export const STRUCTURE_SIZE = {
  barracks: [2, 2], constructionYard: [2, 2], gunTurret: [1, 1], heavyFactory: [3, 2], highTechFactory: [3, 2],
  ix: [2, 2], lightFactory: [2, 2], palace: [3, 3], radar: [2, 2], refinery: [3, 2], repairYard: [3, 2],
  rocketTurret: [1, 1], silo: [2, 2], starport: [3, 3], slab1: [1, 1], slab4: [2, 2], wall: [1, 1], windtrap: [2, 2], wor: [2, 2],
};

export const ITEM_INFO = {
  // structures
  constructionYard: { name: 'Construction Yard', desc: 'The heart of the base. Builds every structure; without it, nothing new can be built.' },
  slab1: { name: 'Concrete Slab', desc: 'A 1×1 foundation. Structures on concrete do not decay in the harsh Arrakis weather.' },
  slab4: { name: 'Concrete 2×2', desc: 'Four foundation slabs at once.' },
  windtrap: { name: 'Windtrap', desc: 'Supplies power. Without enough power the radar goes dark and structures slowly decay.' },
  refinery: { name: 'Spice Refinery', desc: 'Turns spice into credits. Comes with a Harvester. Stores up to 1000 spice.' },
  silo: { name: 'Spice Silo', desc: 'Increases spice storage by 1000.' },
  radar: { name: 'Radar Outpost', desc: 'Enables the radar map (requires sufficient power).' },
  barracks: { name: 'Barracks', desc: 'Trains Light Infantry.' },
  wor: { name: 'WOR', desc: 'Trains Heavy Troopers armed with rocket launchers.' },
  lightFactory: { name: 'Light Factory', desc: 'Produces light vehicles: Trikes and Quads.' },
  heavyFactory: { name: 'Heavy Factory', desc: 'Produces tanks, Harvesters, Missile Tanks and MCVs.' },
  highTechFactory: { name: 'High-Tech Factory', desc: 'Produces aircraft: Carryalls and Ornithopters.' },
  repairYard: { name: 'Repair Facility', desc: 'Repairs damaged vehicles for credits.' },
  starport: { name: 'Starport', desc: 'Buys vehicles from the CHOAM trading guild at fluctuating prices.' },
  palace: { name: 'Palace', desc: 'Seat of the House. Grants access to the House special weapon.' },
  ix: { name: 'IX Research Centre', desc: 'Ixian technology unlocks the House special weapons.' },
  gunTurret: { name: 'Gun Turret', desc: 'Defensive turret against ground vehicles.' },
  rocketTurret: { name: 'Rocket Turret', desc: 'Long-range turret that also hits aircraft. Requires power.' },
  wall: { name: 'Wall', desc: 'A concrete wall to protect the base.' },
  // units
  soldier: { name: 'Light Infantry', desc: 'Cheap foot soldiers that can capture damaged structures.' },
  trooper: { name: 'Heavy Trooper', desc: 'Heavy infantry with a rocket launcher. Dangerous to vehicles.' },
  trike: { name: 'Trike', desc: 'A fast reconnaissance vehicle.' },
  raider: { name: 'Raider Trike', desc: 'The Ordos upgraded Trike: faster, but more lightly armoured.' },
  quad: { name: 'Quad', desc: 'An armoured vehicle with twin machine guns.' },
  tank: { name: 'Combat Tank', desc: 'The main battle tank. Good against vehicles and structures.' },
  siegeTank: { name: 'Siege Tank', desc: 'A heavy tank with a twin cannon.' },
  launcher: { name: 'Missile Tank', desc: 'Long-range artillery with light armour.' },
  devastator: { name: 'Devastator', desc: 'A colossal Harkonnen tank with a nuclear reactor. Can self-destruct.' },
  deviator: { name: 'Deviator', desc: 'Ordos gas missiles temporarily turn enemy vehicles to your side.' },
  sonicTank: { name: 'Sonic Tank', desc: 'The Atreides sonic wave passes through enemy ranks, and your own.' },
  harvester: { name: 'Harvester', desc: 'Collects spice and brings it to the Spice Refinery.' },
  mcv: { name: 'MCV', desc: 'Mobile Construction Vehicle. Deploys into a Construction Yard.' },
  carryall: { name: 'Carryall', desc: 'Transport aircraft. Ferries Harvesters, and damaged vehicles to repair, on its own.' },
  ornithopter: { name: 'Ornithopter', desc: 'A fast attack aircraft. It strikes on its own and cannot be controlled.' },
  frigate: { name: 'Frigate', desc: 'Delivers Starport orders.' },
  saboteur: { name: 'Saboteur', desc: 'An invisible Ordos demolition expert. Destroys a structure at the cost of his life.' },
  sandworm: { name: 'Sandworm', desc: 'Shai-Hulud. Devours anything that moves on the sand.' },
};

export const UNIT_CLASS = {
  soldier: 'infantry', trooper: 'infantry', saboteur: 'infantry',
  trike: 'wheeled', raider: 'wheeled', quad: 'wheeled',
  tank: 'tracked', siegeTank: 'tracked', launcher: 'tracked', devastator: 'tracked', deviator: 'tracked', sonicTank: 'tracked', harvester: 'tracked', mcv: 'tracked',
  carryall: 'air', ornithopter: 'air', frigate: 'air',
  sandworm: 'worm',
};

export const BUILDER_ORDER = ['constructionYard', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'starport', 'palace'];

export function isStructureType(id) {
  return !!objectData.structures[id];
}

export function isUnitType(id) {
  return !!objectData.units[id];
}

function rawEntry(id) {
  return objectData.structures[id] || objectData.units[id] || null;
}

const statCache = new Map();

// Effective stats for a given item and house (house overrides applied)
export function stats(id, house = H.ATREIDES) {
  const key = id + ':' + house;
  let s = statCache.get(key);
  if (s) return s;
  const e = rawEntry(id);
  if (!e) throw new Error('Unknown item ' + id);
  s = { ...e.base, ...(e.house[house] || {}) };
  s.id = id;
  s.isStructure = !!objectData.structures[id];
  s.size = STRUCTURE_SIZE[id] || [1, 1];
  statCache.set(key, s);
  return s;
}

export function itemName(id) {
  return ITEM_INFO[id]?.name || id;
}

export function itemDesc(id) {
  return ITEM_INFO[id]?.desc || '';
}

export const ALL_STRUCTURES = Object.keys(objectData.structures);
export const ALL_UNITS = Object.keys(objectData.units);
export const MAP_SETTINGS = objectData.mapSettings;

// Deviator effectiveness against each house in campaign games (src/sand.cpp getDeviateWeakness)
export const DEVIATE_WEAKNESS = [0.78, 0.3, 0.5, 0.08, 0.04, 0.5];

// INI names → item ids (Dune II / Dune Legacy scenario files)
const INI_NAMES = {
  'barracks': 'barracks', 'const yard': 'constructionYard', 'construction yard': 'constructionYard',
  'r-turret': 'rocketTurret', 'rocket-turret': 'rocketTurret', 'turret': 'gunTurret', 'gun-turret': 'gunTurret',
  'heavy fctry': 'heavyFactory', 'heavy factory': 'heavyFactory', 'hi-tech': 'highTechFactory', 'hightech factory': 'highTechFactory',
  'ix': 'ix', 'house ix': 'ix', 'light fctry': 'lightFactory', 'light factory': 'lightFactory', 'palace': 'palace',
  'outpost': 'radar', 'radar': 'radar', 'refinery': 'refinery', 'repair': 'repairYard', 'repair yard': 'repairYard',
  'spice silo': 'silo', 'silo': 'silo', 'concrete': 'slab1', 'slab1': 'slab1', 'slab4': 'slab4', 'star port': 'starport',
  'starport': 'starport', 'wall': 'wall', 'windtrap': 'windtrap', 'wor': 'wor',
  'carryall': 'carryall', 'carry-all': 'carryall', 'devastator': 'devastator', 'devistator': 'devastator', 'deviator': 'deviator',
  'frigate': 'frigate', 'harvester': 'harvester', 'soldier': 'soldier', 'launcher': 'launcher', 'mcv': 'mcv',
  'thopters': 'ornithopter', "'thopters": 'ornithopter', 'thopter': 'ornithopter', "'thopter": 'ornithopter', 'ornithopter': 'ornithopter',
  'quad': 'quad', 'saboteur': 'saboteur', 'sandworm': 'sandworm', 'siege tank': 'siegeTank', 'sonic tank': 'sonicTank',
  'sonictank': 'sonicTank', 'tank': 'tank', 'trike': 'trike', 'raider trike': 'raider', 'raider': 'raider', 'trooper': 'trooper',
  'special': 'special', 'infantry': 'infantry', 'troopers': 'troopers',
};

export function itemIdFromIniName(name) {
  return INI_NAMES[String(name).trim().toLowerCase()] || null;
}
