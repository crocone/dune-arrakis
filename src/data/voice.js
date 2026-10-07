// Voice-over script: every spoken line in the game, who speaks it, and which ElevenLabs voice
// is used. tools/voice-gen.mjs renders the lines into public/voice/<id>.mp3, and the
// AudioManager plays them by id (falling back to browser speech synthesis when a clip is absent).
import { H } from '../core/constants.js';
import { BRIEFINGS, VICTORY_TEXT, DEFEAT_TEXT, MEANWHILE, FINALE, INTRO_TEXT, REGION_PROGRESS } from './campaign.js';

// ElevenLabs premade voices. Settings: stability / similarity_boost / style / speed.
export const VOICE_CAST = {
  narrator: { voice: 'nPczCjzI2devNBz1zQrb', label: 'Brian', stability: 0.55, similarity: 0.8, style: 0.25, speed: 0.92 },
  // mentats
  cyril: { voice: 'JBFqnCBsd6RMkjVDRZzb', label: 'George', stability: 0.55, similarity: 0.8, style: 0.2, speed: 0.95 },
  radnor: { voice: 'N2lVS1w4EtoT3dr4eOWO', label: 'Callum', stability: 0.4, similarity: 0.8, style: 0.45, speed: 0.95 },
  ammon: { voice: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel', stability: 0.65, similarity: 0.8, style: 0.15, speed: 0.95 },
  // base computer announcers
  ann_atreides: { voice: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice', stability: 0.7, similarity: 0.8, style: 0.1, speed: 1.0 },
  ann_harkonnen: { voice: 'VR6AewLTigWG4xSOukaG', label: 'Arnold', stability: 0.6, similarity: 0.8, style: 0.25, speed: 1.0 },
  ann_ordos: { voice: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte', stability: 0.7, similarity: 0.8, style: 0.15, speed: 1.0 },
  // unit crews
  unit_atreides: { voice: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam', stability: 0.45, similarity: 0.8, style: 0.35, speed: 1.05 },
  unit_harkonnen: { voice: 'ODq5zmih8GrVes37Dizd', label: 'Patrick', stability: 0.3, similarity: 0.8, style: 0.6, speed: 1.05 },
  unit_ordos: { voice: 'cjVigY5qzO86Huf0OWal', label: 'Eric', stability: 0.55, similarity: 0.8, style: 0.25, speed: 1.05 },
  unit_fremen: { voice: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh', stability: 0.5, similarity: 0.8, style: 0.35, speed: 1.0 },
  unit_sardaukar: { voice: '2EiwWnXFnvU5JabPnv8n', label: 'Clyde', stability: 0.35, similarity: 0.8, style: 0.55, speed: 1.0 },
  unit_mercenary: { voice: 'CwhRBWXzGAHq8TQ4Fs17', label: 'Roger', stability: 0.4, similarity: 0.8, style: 0.45, speed: 1.05 },
};

export const MENTAT_KEY = { [H.ATREIDES]: 'cyril', [H.HARKONNEN]: 'radnor', [H.ORDOS]: 'ammon' };
const HOUSE_KEY = { [H.ATREIDES]: 'atreides', [H.HARKONNEN]: 'harkonnen', [H.ORDOS]: 'ordos' };

// Base computer announcements (one set per Great House)
export const ANNOUNCER_LINES = {
  construct: 'Construction complete.',
  upgrade: 'Upgrade complete.',
  unitReady: 'Unit ready.',
  aircraftReady: 'Aircraft launched.',
  harvesterDeployed: 'Harvester deployed.',
  baseAttack: 'Our base is under attack!',
  harvAttack: 'Harvester under attack!',
  harvLost: 'Harvester destroyed.',
  unitLost: 'Unit lost.',
  structLost: 'Structure destroyed.',
  captured: 'Enemy structure captured.',
  lostCapture: 'Warning. One of our structures has been captured.',
  reinf: 'Reinforcements have arrived.',
  nomoney: 'Insufficient funds.',
  frigate: 'Frigate has arrived.',
  repaired: 'Vehicle repaired.',
  palace: 'Palace complete. Special weapon available.',
  missile: 'Warning! Missile approaching!',
  saboteur: 'Warning! Saboteur approaching!',
  worm: 'Wormsign detected!',
  fremen: 'The Fremen have joined the battle.',
  deathHand: 'Death Hand launched.',
  radarOn: 'Radar activated.',
  radarOff: 'Radar offline.',
  won: 'Mission accomplished.',
  lost: 'Mission failed.',
  approach_n: 'Warning. Enemy approaching from the north.',
  approach_s: 'Warning. Enemy approaching from the south.',
  approach_e: 'Warning. Enemy approaching from the east.',
  approach_w: 'Warning. Enemy approaching from the west.',
  storage: 'Spice storage full. Build more silos.',
  lowPower: 'Low power. Build more windtraps.',
  saved: 'Game saved.',
};

// Unit acknowledgements. Each kind has variants, picked at random without immediate repeats.
export const UNIT_LINES = {
  atreides: {
    select: ['Reporting.', 'Yes, Commander?', 'Ready for orders.'],
    move: ['Acknowledged.', 'Moving out.', 'Right away, sir.'],
    attack: ['Engaging!', 'Target in sight.', 'For House Atreides!'],
    harvest: ['Harvester en route.', 'Heading for the spice field.'],
  },
  harkonnen: {
    select: ['What now?', 'Ready to kill.', 'Speak.'],
    move: ['Moving.', 'Got it.', 'Out of my way!'],
    attack: ['Crush them!', 'No mercy!', 'Burn them all!'],
    harvest: ['Fetching the spice.', 'Spice run, move it!'],
  },
  ordos: {
    select: ['Standing by.', 'Your orders?', 'Operational.'],
    move: ['Understood.', 'Proceeding.', 'As you wish.'],
    attack: ['Target confirmed.', 'Eliminating.', 'Engaging target.'],
    harvest: ['Collecting spice.', 'Profit awaits.'],
  },
  fremen: {
    select: ['The desert hears you.', 'We are ready.'],
    move: ['We move like the wind.', 'As the sand shifts.'],
    attack: ['For the desert!', 'Strike from the sand!'],
    harvest: ['The spice calls.'],
  },
  sardaukar: {
    select: ['For the Emperor.', 'Sardaukar, ready.'],
    move: ['Advancing.', 'By the Emperor’s will.'],
    attack: ['Annihilate them!', 'No survivors!'],
    harvest: ['Harvesting, as ordered.'],
  },
  mercenary: {
    select: ['Yeah, boss?', 'Paid and ready.'],
    move: ['On it.', 'Moving, moving.'],
    attack: ['Let’s earn our pay!', 'Light ’em up!'],
    harvest: ['Spice means money.'],
  },
};

export const MENTAT_GREETING = {
  cyril: 'House Atreides. Honour is our shield.',
  radnor: 'House Harkonnen. Strength, and fear.',
  ammon: 'The Ordos Cartel. Profit, above all.',
};

export const MENTAT_CHOOSE_REGION = {
  cyril: 'Choose the region for our next operation, Commander.',
  radnor: 'Pick your next target. Choose well.',
  ammon: 'Select the next region. Choose the most profitable one.',
};

export const NARRATOR_EXTRA = {
  skirmish: 'Destroy the enemy, and conquer Arrakis.',
  bonus_destroy: 'Commander, our scouts have confirmed the enemy positions, and our forces are ready to land. Destroy every enemy structure, and this region will be ours. Remember the worms: the sand here is alive.',
  bonus_quota: 'Commander, our scouts have confirmed the enemy positions, and our forces are ready to land. Gather the spice quota, and this region will be ours. Remember the worms: the sand here is alive.',
};

// --- id helpers used by the game ------------------------------------------------
export function announcerSet(house) {
  if (house === H.HARKONNEN || house === H.SARDAUKAR) return 'harkonnen';
  if (house === H.ORDOS || house === H.MERCENARY) return 'ordos';
  return 'atreides';
}

export function unitSet(house) {
  return ['harkonnen', 'atreides', 'ordos', 'fremen', 'sardaukar', 'mercenary'][house] || 'atreides';
}

export const announcerId = (house, line) => `announcer/${announcerSet(house)}/${line}`;
export const unitLineId = (house, kind, i) => `unit/${unitSet(house)}/${kind}_${i + 1}`;
export const mentatId = (house, line) => (MENTAT_KEY[house] ? `mentat/${MENTAT_KEY[house]}/${line}` : null);
export const narratorId = (line) => `narrator/${line}`;

// --- full manifest: [{ id, role, text }] -----------------------------------------
export function buildVoiceScript() {
  const out = [];
  const add = (id, role, text) => out.push({ id, role, text });
  for (const set of ['atreides', 'harkonnen', 'ordos']) {
    for (const [k, t] of Object.entries(ANNOUNCER_LINES)) add(`announcer/${set}/${k}`, `ann_${set}`, t);
  }
  for (const [set, kinds] of Object.entries(UNIT_LINES)) {
    for (const [kind, list] of Object.entries(kinds)) list.forEach((t, i) => add(`unit/${set}/${kind}_${i + 1}`, `unit_${set}`, t));
  }
  for (const house of [H.ATREIDES, H.HARKONNEN, H.ORDOS]) {
    const m = MENTAT_KEY[house];
    const hk = HOUSE_KEY[house];
    add(`mentat/${m}/greeting`, m, MENTAT_GREETING[m]);
    add(`mentat/${m}/choose_region`, m, MENTAT_CHOOSE_REGION[m]);
    BRIEFINGS[house].forEach((t, i) => add(`mentat/${m}/briefing_${i + 1}`, m, t));
    VICTORY_TEXT[house].forEach((t, i) => add(`mentat/${m}/victory_${i + 1}`, m, t));
    add(`mentat/${m}/defeat`, m, DEFEAT_TEXT[house]);
    for (const [lvl, step] of Object.entries(REGION_PROGRESS[house])) add(`mentat/${m}/region_${lvl}`, m, step.text);
    for (const lvl of Object.keys(MEANWHILE)) add(`narrator/meanwhile_${lvl}_${hk}`, 'narrator', MEANWHILE[lvl][house]);
    add(`narrator/finale_${hk}`, 'narrator', FINALE[house]);
  }
  INTRO_TEXT.forEach((t, i) => add(`narrator/intro_${i + 1}`, 'narrator', t));
  for (const [k, t] of Object.entries(NARRATOR_EXTRA)) add(`narrator/${k}`, 'narrator', t);
  return out;
}
