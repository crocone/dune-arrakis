// Save / load of a running match. Generic serializer: object references are stored by id,
// typed arrays as base64, Maps as entry lists. Transient state (bullets, selection) is dropped.
import { Game, UNIT_CLASSES, STRUCT_CLASSES } from './game.js';
import { Unit } from './unit.js';
import { Structure, Choam } from './structures.js';
import { AIPlayer } from './ai.js';
import { stats } from '../data/gamedata.js';

const SKIP = new Set(['game', 'st']);
const TA = { Uint8Array, Int8Array, Uint16Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array };

function toB64(ta) {
  const bytes = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

function fromB64(str, Ctor) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Ctor(bytes.buffer);
}

function isGameObject(v) {
  return v && typeof v === 'object' && v.game && v.id !== undefined && (v.isUnit || v.isStructure);
}

function ser(v) {
  if (v === Infinity) return { __inf: 1 };
  if (v === -Infinity) return { __inf: -1 };
  if (v === null || typeof v !== 'object') return v;
  if (isGameObject(v)) return { __ref: v.id };
  if (Array.isArray(v)) return v.map(ser);
  if (ArrayBuffer.isView(v)) return { __ta: v.constructor.name, d: toB64(v) };
  if (v instanceof Map) return { __map: [...v].map(([k, x]) => [k, ser(x)]) };
  if (v instanceof Set) return { __set: [...v].map(ser) };
  if (v.game) return null; // other game-bound helper objects are rebuilt on load
  const o = {};
  for (const k of Object.keys(v)) o[k] = ser(v[k]);
  return o;
}

function serOwn(obj, skip = SKIP) {
  const out = {};
  for (const k of Object.keys(obj)) if (!skip.has(k)) out[k] = ser(obj[k]);
  return out;
}

function deser(v, refs) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => deser(x, refs));
  if (v.__inf) return v.__inf > 0 ? Infinity : -Infinity;
  if (v.__ref !== undefined) {
    refs.pending = true;
    return { __pendingRef: v.__ref };
  }
  if (v.__ta) return fromB64(v.d, TA[v.__ta]);
  if (v.__map) return new Map(v.__map.map(([k, x]) => [k, deser(x, refs)]));
  if (v.__set) return new Set(v.__set.map((x) => deser(x, refs)));
  const o = {};
  for (const k of Object.keys(v)) o[k] = deser(v[k], refs);
  return o;
}

// replace {__pendingRef:id} markers with actual objects (recursive, in place)
function resolve(v, objects, depth = 0) {
  if (!v || typeof v !== 'object' || depth > 6) return v;
  if (v.__pendingRef !== undefined) return objects.get(v.__pendingRef) || null;
  if (ArrayBuffer.isView(v) || v instanceof Map || v instanceof Set) return v;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) v[i] = resolve(v[i], objects, depth + 1);
    return v;
  }
  if (isGameObject(v)) return v;
  for (const k of Object.keys(v)) v[k] = resolve(v[k], objects, depth + 1);
  return v;
}

export function serializeGame(g) {
  const map = g.map;
  const teams = new Set(g.houses.filter(Boolean).map((h) => h.team));
  const data = {
    version: 1,
    game: {
      cycle: g.cycle,
      nextId: g.nextId,
      player: g.player,
      techLevel: g.techLevel,
      isCampaign: g.isCampaign,
      scenario: g.scenario,
      settings: g.settings,
      triggers: g.triggers,
      startView: g.startView,
      rng: g.rng.getState(),
      over: g.over,
    },
    map: {
      width: map.width,
      height: map.height,
      types: toB64(map.types),
      spice: toB64(map.spice),
      damage: toB64(map.damage),
      ground: toB64(map.ground),
      infantry: toB64(map.infantry),
      air: toB64(map.air),
      underground: toB64(map.underground),
      tileOwner: toB64(map.tileOwner),
      seen: [...teams].map((t) => [t, toB64(map.seen[t])]),
    },
    houses: g.houses.map((h) => {
      if (!h) return null;
      const out = serOwn(h, new Set(['game', 'ai', 'choam']));
      out.choam = h.choam ? ser(h.choam.items) : null;
      out.ai = h.ai ? serOwn(h.ai) : null;
      return out;
    }),
    objects: [...g.structures, ...g.units].filter((o) => o.alive).map((o) => serOwn(o)),
  };
  return data;
}

export function deserializeGame(data) {
  const gd = data.game;
  const g = new Game({ seed: 1, settings: gd.settings, player: gd.player, techLevel: gd.techLevel, campaign: gd.isCampaign, scenario: gd.scenario });
  g.cycle = gd.cycle;
  g.nextId = gd.nextId;
  g.triggers = gd.triggers || [];
  for (const t of g.triggers) if (t.repeat === null) t.repeat = 0;
  g.startView = gd.startView;
  g.rng.setState(gd.rng);
  const md = data.map;
  g.initMap(md.width, md.height);
  const map = g.map;
  map.types = fromB64(md.types, Uint8Array);
  map.spice = fromB64(md.spice, Float32Array);
  map.damage = fromB64(md.damage, Uint8Array);
  map.ground = fromB64(md.ground, Int32Array);
  map.infantry = fromB64(md.infantry, Int32Array);
  map.air = fromB64(md.air, Int32Array);
  map.underground = fromB64(md.underground, Int32Array);
  map.tileOwner = fromB64(md.tileOwner, Int8Array);
  for (const [t, s] of md.seen) map.seen[t] = fromB64(s, Int32Array);
  map.cycle = g.cycle;
  map.dirtyTerrain = [];
  const refs = {};
  // houses
  data.houses.forEach((hd, id) => {
    if (!hd) return;
    const h = g.addHouse(id, {});
    const plain = deser(hd, refs);
    const { choam, ai, ...rest } = plain;
    Object.assign(h, rest);
    if (choam) h.choam.items = choam;
    if (ai) {
      const a = Object.create(AIPlayer.prototype);
      Object.assign(a, ai);
      a.game = g;
      h.ai = a;
    }
  });
  // objects
  const created = [];
  for (const od of data.objects) {
    const plain = deser(od, refs);
    const isStruct = !!plain.isStructure;
    const Cls = (isStruct ? STRUCT_CLASSES : UNIT_CLASSES)[plain.type] || (isStruct ? Structure : Unit);
    const o = Object.create(Cls.prototype);
    Object.assign(o, plain);
    o.game = g;
    o.st = stats(o.type, o.originalOwner);
    g.objects.set(o.id, o);
    if (isStruct) g.structures.push(o);
    else g.units.push(o);
    created.push(o);
  }
  const resolveFields = (obj) => {
    for (const k of Object.keys(obj)) if (k !== 'game' && k !== 'st') obj[k] = resolve(obj[k], g.objects);
  };
  for (const o of created) resolveFields(o);
  for (const h of g.houses) if (h && h.ai) resolveFields(h.ai);
  g.computeSandRegions();
  for (const h of g.houses) if (h) h.recalcPowerAndStorage();
  for (const s of g.structures) if (s.isBuilder) s.updateBuildList();
  g.over = gd.over || null;
  return g;
}
