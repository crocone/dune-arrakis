import { h, clear } from './dom.js';
import { emblemSVG, mentatSVG } from './emblems.js';
import { H, HOUSE_NAMES, HOUSE_COLORS_CSS, HOUSE_NAMES_EN } from '../core/constants.js';
import { HOUSE_LORE, MENTATS, BRIEFINGS, REGION_NAMES } from '../data/campaign.js';
import { mentatId } from '../data/voice.js';
import { audio } from '../audio/audio.js';
import { formatTime } from '../core/mathutil.js';
import { rankFor } from '../game/game.js';

function screen(cls, ...children) {
  return h('div.screen', { class: cls }, ...children);
}

// Attach a voice-over clip to a screen. The app plays it when the screen is shown
// (or right away if the screen is already on the page).
export function withVoice(el, id) {
  if (!id) return el;
  if (el.isConnected) audio.dialogue(id);
  else el.voice = id;
  return el;
}

function btn(label, onclick, cls = '') {
  return h('button.btn', {
    class: cls,
    onclick: (e) => {
      audio.init();
      audio.play('click');
      onclick(e);
    },
  }, label);
}

// ---------------------------------------------------------------------------
export function mainMenu(app) {
  const hasSave = !!app.campaign;
  const box = h('div.menu-box',
    h('h1.title', 'DUNE'),
    h('h2', 'THE BATTLE FOR ARRAKIS'),
    hasSave ? btn(`Continue campaign: ${HOUSE_NAMES[app.campaign.house]}, level ${app.campaign.level}`, () => app.continueCampaign(), 'primary') : null,
    btn('New campaign', () => app.show('intro'), hasSave ? '' : 'primary'),
    app.hasSavedGame() ? btn('Load saved game', () => app.loadGame()) : null,
    btn('Skirmish', () => app.show('skirmish')),
    btn('Bonus campaigns (OpenSD2)', () => app.show('bonus')),
    btn('Mentat encyclopedia', () => app.show('encyclopedia')),
    btn('Settings', () => app.show('settings')),
    btn('About', () => app.show('about')),
    h('div.footer',
      'A three.js remake of Dune II based on Dune Legacy. Game mechanics, unit statistics and the map generator come from the Dune Legacy source code (GPL). ',
      'Graphics are procedural; voice-over and sound effects were generated with ElevenLabs.'),
  );
  return screen('main-menu', box);
}

export function aboutScreen(app) {
  const box = h('div.panel.modal',
    h('h2', 'About'),
    h('p', 'A non-commercial fan remake of Dune II: The Building of a Dynasty (Westwood Studios, 1992) in three.js, built on the mechanics of the open-source Dune Legacy engine.'),
    h('p.muted', 'The Dune Legacy code and the map generator port are distributed under GPL-2.0-or-later. Dune Legacy maps and OpenSD2 scenarios are CC-BY-SA (authors: Rippsblack, kc, R. Schaller, Stefan van der Wel, Kuffar, SardukarKoon, JonhSoft and others).'),
    h('p.muted', 'Dune is a trademark of its respective owners. This project is not affiliated with them and uses none of the original assets: models, sounds and texts were created from scratch.'),
    h('h3', 'Controls'),
    h('ul.muted', { style: { lineHeight: '1.7', fontSize: '13px' } },
      h('li', 'Left click: select. Drag: box select. Double click: all units of that type'),
      h('li', 'Right click: order (move, attack, harvest, repair, unload)'),
      h('li', 'Arrows / screen edge / middle button: camera. Wheel: zoom. Q/E: rotate'),
      h('li', 'M move, A attack, C capture, S stop, H harvester home, R repair, U upgrade'),
      h('li', 'P place structure, G/F Construction Yard / factories, X deploy MCV / detonate'),
      h('li', 'Ctrl+1…9 assign group, 1…9 select, Ctrl+A whole army, Tab health bars'),
      h('li', 'Space pause, +/− game speed, Esc menu'),
    ),
    h('div.row', { style: { justifyContent: 'flex-end', marginTop: '12px' } }, btn('Back', () => app.show('main'))),
  );
  return screen('overlay-dim', box);
}

// ---------------------------------------------------------------------------
export function houseSelect(app) {
  const cards = [H.ATREIDES, H.HARKONNEN, H.ORDOS].map((house) => {
    const lore = HOUSE_LORE[house];
    const card = h('div.house-card', {
      style: { '--hc': HOUSE_COLORS_CSS[house] },
      onmouseenter: () => {
        audio.init();
        audio.dialogue(mentatId(house, 'greeting'));
      },
      onclick: () => {
        audio.init();
        audio.play('select');
        app.startCampaign(house);
      },
    },
    h('div.emblem', { html: emblemSVG(house, 64) }),
    h('h3', HOUSE_NAMES[house]),
    h('div.motto', lore.motto + ' · ' + lore.home),
    h('p', lore.text),
    h('ul', ...lore.perks.map((p) => h('li', p))),
    h('div.glow'));
    return card;
  });
  return screen('house-select',
    h('h1.title', 'Choose your Great House'),
    h('div.muted', { style: { textAlign: 'center', maxWidth: '640px' } }, 'Emperor Frederick IV has decreed that Arrakis will belong to the House that harvests the most spice. No law binds the contenders. Only one will prevail.'),
    h('div.house-cards', ...cards),
    btn('Back', () => app.show('main')),
  );
}

// ---------------------------------------------------------------------------
export function briefingScreen(app, opts) {
  const { house, title, meta, text, objective, onStart, onBack, startLabel, voice } = opts;
  const mentat = MENTATS[house] || MENTATS[H.ATREIDES];
  const textEl = h('div.text');
  // typewriter effect
  let i = 0;
  const timer = setInterval(() => {
    i += 3;
    textEl.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(timer);
  }, 16);
  textEl.addEventListener('click', () => {
    i = text.length;
    textEl.textContent = text;
  });
  const box = h('div.panel.box', { style: { '--hc': HOUSE_COLORS_CSS[house] } },
    h('div.mentat',
      h('div.portrait', { html: mentatSVG(house) }),
      h('div.name', mentat.name),
      h('div.role', mentat.role),
    ),
    h('div',
      h('h2', title),
      h('div.mission-meta', meta),
      textEl,
      objective ? h('div.objectives', h('b', 'Objective: '), objective) : null,
      h('div.actions',
        voice && audio.hasVoice(voice) ? btn('↻ Replay', () => audio.dialogue(voice)) : null,
        onBack ? btn('Back', () => { clearInterval(timer); audio.stopDialogue(); onBack(); }) : null,
        btn(startLabel || 'Start mission', () => { clearInterval(timer); audio.stopDialogue(); onStart(); }, 'primary'),
      ),
    ),
  );
  return withVoice(screen('briefing', box), voice);
}

// ---------------------------------------------------------------------------
export function regionMapScreen(app, opts) {
  const { house, level, text, choices, onChoose, played = [], onBack, voice } = opts;
  const info = h('div.panel.info',
    h('h2', `Level ${level}: choose a region to attack`),
    h('div.story', text),
    h('div.muted', { style: { fontSize: '12px' } }, 'Highlighted regions can be attacked. Hover over a region on the planet and click it.'),
    h('div.legend',
      ...[H.ATREIDES, H.HARKONNEN, H.ORDOS, H.SARDAUKAR].map((hh) => h('span', { style: { '--c': HOUSE_COLORS_CSS[hh] } }, HOUSE_NAMES[hh]))),
    h('div.row', { style: { marginTop: '10px', flexWrap: 'wrap' } },
      ...choices.map((r, idx) => btn(`${REGION_NAMES[r] || 'Region ' + r}${played.includes(idx) ? ' (fought)' : ''}`, () => onChoose(idx), played.includes(idx) ? '' : 'primary')),
      onBack ? btn('Main menu', onBack) : null,
    ),
  );
  return withVoice(screen('region-map', info), voice);
}

// ---------------------------------------------------------------------------
export function resultsScreen(app, opts) {
  const { won, game, level, onContinue, onRetry, house, extraText, voice } = opts;
  const p = game.houses[game.player];
  const enemies = game.houses.filter((hh) => hh && hh.team !== p.team && hh.id !== H.FREMEN);
  const sumE = (f) => enemies.reduce((s, hh) => s + f(hh), 0);
  const score = game.computeScore(level || 1);
  const secs = (game.cycle * 16) / 1000;
  const row = (label, a, b) => h('tr', h('th', label), h('td', String(a)), h('td', String(b)));
  const box = h('div.panel.box',
    h('h1.title', won ? 'Victory' : 'Defeat'),
    extraText ? h('p', { style: { color: '#e2d3bc', lineHeight: '1.6' } }, extraText) : null,
    h('table',
      h('tr', h('th', ''), h('td', h('b', 'You')), h('td', h('b', 'Enemy'))),
      row('Spice harvested', Math.round(p.stats.spiceHarvested), Math.round(sumE((hh) => hh.stats.spiceHarvested))),
      row('Units destroyed', p.stats.unitsKilled, sumE((hh) => hh.stats.unitsKilled)),
      row('Structures destroyed', p.stats.structuresKilled, sumE((hh) => hh.stats.structuresKilled)),
      row('Units lost', p.stats.unitsLost, sumE((hh) => hh.stats.unitsLost)),
      row('Units built', p.stats.unitsBuilt, sumE((hh) => hh.stats.unitsBuilt)),
      row('Structures built', p.stats.structuresBuilt, sumE((hh) => hh.stats.structuresBuilt)),
      row('Time', formatTime(secs), ''),
    ),
    won ? h('div', h('div.muted', 'Score'), h('div.score', String(score)), h('div', { style: { marginTop: '4px', color: 'var(--accent-strong)' } }, 'Rank: ' + rankFor(score))) : null,
    h('div.row', { style: { justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' } },
      onRetry ? btn('Retry', () => { audio.stopDialogue(); onRetry(); }) : null,
      btn('Continue', () => { audio.stopDialogue(); onContinue(); }, 'primary'),
    ),
  );
  return withVoice(screen('results', box), voice);
}

export function storyScreen(app, { title, text, house, onContinue, label, voice }) {
  const box = h('div.panel.box', { style: { maxWidth: '720px' } },
    h('h1.title', { style: { fontSize: '30px' } }, title),
    h('p', { style: { fontSize: '16px', lineHeight: '1.7', color: '#ead9c0', textAlign: 'left' } }, text),
    h('div.row', { style: { justifyContent: 'center', marginTop: '18px' } }, btn(label || 'Continue', () => { audio.stopDialogue(); onContinue(); }, 'primary')),
  );
  return withVoice(screen('results', box), voice);
}

// ---------------------------------------------------------------------------
export function settingsScreen(app, onBack) {
  const s = app.settings;
  const slider = (key, label, min = 0, max = 1, step = 0.05, apply) => {
    const input = h('input', { type: 'range', min, max, step, value: s[key] });
    input.addEventListener('input', () => {
      s[key] = parseFloat(input.value);
      if (apply) apply(s[key]);
      app.saveSettings();
    });
    return h('div.setting', h('label', label), input);
  };
  const select = (key, label, options, apply) => {
    const sel = h('select', ...options.map(([v, t]) => h('option', { value: v, selected: String(s[key]) === String(v) ? true : null }, t)));
    sel.addEventListener('change', () => {
      const v = sel.value;
      s[key] = isNaN(Number(v)) ? v : Number(v);
      if (apply) apply(s[key]);
      app.saveSettings();
    });
    return h('div.setting', h('label', label), sel);
  };
  const check = (key, label, apply) => {
    const c = h('input', { type: 'checkbox', checked: s[key] ? true : null });
    c.addEventListener('change', () => {
      s[key] = c.checked;
      if (apply) apply(s[key]);
      app.saveSettings();
    });
    return h('div.setting', h('label', label), h('div', c));
  };
  const box = h('div.panel.modal',
    h('h2', 'Settings'),
    slider('volMaster', 'Master volume', 0, 1, 0.05, (v) => audio.setVolume('master', v)),
    slider('volSfx', 'Sound effects', 0, 1, 0.05, (v) => audio.setVolume('sfx', v)),
    slider('volMusic', 'Music', 0, 1, 0.05, (v) => audio.setVolume('music', v)),
    slider('volVoice', 'Voice', 0, 1, 0.05, (v) => audio.setVolume('voice', v)),
    select('quality', 'Graphics quality', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], (v) => app.sceneRenderer.setQuality(v)),
    select('gameSpeed', 'Game speed', [[0.5, 'Very slow'], [0.75, 'Slow'], [1, 'Normal (Dune Legacy)'], [1.5, 'Fast'], [2, 'Very fast']], (v) => app.gameView && app.gameView.setSpeed(v)),
    check('edgeScroll', 'Scroll at screen edge', (v) => app.gameView && (app.gameView.cam.edgeScroll = v)),
    check('fogOfWar', 'Fog of war (new games)'),
    check('concreteRequired', 'Structures without concrete start damaged (new games)'),
    check('wormsRespawn', 'Sandworms respawn (new games)'),
    h('div.row', { style: { justifyContent: 'flex-end', marginTop: '14px' } }, btn('Done', onBack, 'primary')),
  );
  return screen('overlay-dim', box);
}

// ---------------------------------------------------------------------------
export function gameMenu(app) {
  const box = h('div.panel.modal',
    h('h2', 'Paused'),
    h('div.menu-list',
      btn('Resume', () => app.closeGameMenu(), 'primary'),
      btn('Settings', () => app.showOverlay(settingsScreen(app, () => app.showOverlay(gameMenu(app))))),
      btn('Mission briefing', () => app.showOverlay(app.currentBriefingOverlay())),
      btn('Mentat encyclopedia', () => app.showOverlay(app.encyclopediaOverlay(() => app.showOverlay(gameMenu(app))))),
      btn('Save game', () => app.saveGame()),
      app.mission ? btn('Restart mission', () => app.restartMission()) : null,
      btn('Surrender', () => app.surrender()),
      btn('Quit to main menu', () => app.quitToMenu()),
    ),
  );
  return screen('overlay-dim', box);
}

// ---------------------------------------------------------------------------
export function skirmishScreen(app) {
  const s = app.skirmishSettings;
  const players = s.players;
  const playersEl = h('div.players');
  const houseOpts = [H.ATREIDES, H.HARKONNEN, H.ORDOS, H.SARDAUKAR, H.MERCENARY];
  const render = () => {
    clear(playersEl);
    players.forEach((p, i) => {
      const houseSel = h('select', ...houseOpts.map((hh) => h('option', { value: hh, selected: p.house === hh ? true : null }, HOUSE_NAMES[hh])));
      houseSel.addEventListener('change', () => (p.house = parseInt(houseSel.value, 10)));
      const teamSel = h('select', ...[1, 2, 3, 4, 5, 6].map((t) => h('option', { value: t, selected: p.team === t ? true : null }, `Team ${t}`)));
      teamSel.addEventListener('change', () => (p.team = parseInt(teamSel.value, 10)));
      const diffSel = h('select', ...[[0, 'Easy'], [1, 'Normal'], [2, 'Hard']].map(([v, t]) => h('option', { value: v, selected: p.difficulty === v ? true : null }, t)));
      diffSel.addEventListener('change', () => (p.difficulty = parseInt(diffSel.value, 10)));
      playersEl.appendChild(h('div.player-row',
        h('b', { style: { color: HOUSE_COLORS_CSS[p.house] } }, i === 0 ? 'You' : `AI ${i}`),
        houseSel, teamSel, i === 0 ? h('span.muted', 'Human') : diffSel,
        i > 1 ? h('button.btn.small', { onclick: () => { players.splice(i, 1); render(); } }, '✕') : h('span'),
      ));
    });
    addBtn.disabled = players.length >= 6;
  };
  const addBtn = btn('+ Add AI player', () => {
    const used = new Set(players.map((p) => p.house));
    const free = houseOpts.find((hh) => !used.has(hh)) ?? H.MERCENARY;
    players.push({ house: free, team: players.length + 1, difficulty: 1 });
    render();
  });
  const mapSel = h('select', h('option', { value: 'random' }, 'Random map (Dune II generator)'));
  app.loadSkirmishIndex().then((list) => {
    for (const m of list) mapSel.appendChild(h('option', { value: m.file, selected: s.map === m.file ? true : null }, `${m.name} · ${m.w}×${m.h} · up to ${m.players} players · ${m.author}`));
    if (s.map !== 'random') mapSel.value = s.map;
  });
  mapSel.addEventListener('change', () => (s.map = mapSel.value));
  const credits = h('select', ...[1000, 2000, 3000, 5000, 10000].map((c) => h('option', { value: c, selected: s.credits === c ? true : null }, `${c} credits`)));
  credits.addEventListener('change', () => (s.credits = parseInt(credits.value, 10)));
  const tech = h('select', ...[1, 2, 3, 4, 5, 6, 7, 8].map((t) => h('option', { value: t, selected: s.techLevel === t ? true : null }, `Tech level ${t}`)));
  tech.addEventListener('change', () => (s.techLevel = parseInt(tech.value, 10)));
  const worms = h('select', ...[0, 1, 2, 3, 5].map((t) => h('option', { value: t, selected: s.worms === t ? true : null }, `Sandworms: ${t}`)));
  worms.addEventListener('change', () => (s.worms = parseInt(worms.value, 10)));
  const seedIn = h('input', { type: 'number', value: s.seed, style: { width: '110px' } });
  seedIn.addEventListener('change', () => (s.seed = parseInt(seedIn.value, 10) || 1));
  const box = h('div.panel.modal',
    h('h2', 'Skirmish'),
    h('div.setting', h('label', 'Map'), mapSel),
    h('div.setting', h('label', 'Random map seed'), h('div.row', seedIn, h('button.btn.small', { onclick: () => { s.seed = Math.floor(Math.random() * 100000); seedIn.value = s.seed; } }, '🎲'))),
    h('div.setting', h('label', 'Starting credits'), credits),
    h('div.setting', h('label', 'Tech level'), tech),
    h('div.setting', h('label', 'Sandworms (random map)'), worms),
    h('h3', { style: { margin: '14px 0 4px', fontFamily: 'var(--font-title)' } }, 'Players'),
    playersEl,
    addBtn,
    h('div.row', { style: { justifyContent: 'flex-end', marginTop: '16px' } },
      btn('Back', () => app.show('main')),
      btn('To battle!', () => app.startSkirmish(), 'primary'),
    ),
  );
  render();
  return screen('overlay-dim skirmish', box);
}

export function bonusScreen(app) {
  const camp = (house, name, desc) => h('div.house-card', {
    style: { '--hc': HOUSE_COLORS_CSS[house] },
    onclick: () => app.startBonusCampaign(house),
  }, h('div.emblem', { html: emblemSVG(house, 64) }), h('h3', name), h('p', desc), h('div.glow'));
  return screen('house-select',
    h('h1.title', 'Bonus campaigns'),
    h('div.muted', { style: { textAlign: 'center', maxWidth: '680px' } }, 'The open fan-made OpenSD2 campaigns (CC-BY-SA) shipped with Dune Legacy: 22 scenarios each for the Fremen, the Sardaukar and the Mercenaries.'),
    h('div.house-cards',
      camp(H.FREMEN, 'Fremen', 'The people of the desert rise against the invaders of Arrakis.'),
      camp(H.SARDAUKAR, 'Sardaukar', 'The Emperor’s elite restore order on a rebellious planet.'),
      camp(H.MERCENARY, 'Mercenaries', 'Soldiers of fortune fight for whoever pays the most.'),
    ),
    btn('Back', () => app.show('main')),
  );
}

export function loadingScreen(text = 'Loading…') {
  return screen('loading', h('div.title', { style: { fontSize: '28px' } }, text), h('div.bar', h('div')));
}

// ---------------------------------------------------------------------------
export function introScreen(app, paragraphs, onDone) {
  const text = h('div', { style: { maxWidth: '760px', textAlign: 'center' } });
  let i = 0;
  let timer = null;
  let el = null;
  const finish = () => {
    clearTimeout(timer);
    audio.stopDialogue();
    onDone();
  };
  const next = () => {
    if (i >= paragraphs.length) return finish();
    const id = `narrator/intro_${i + 1}`;
    const p = h('p', { style: { fontFamily: 'var(--font-title)', fontSize: 'clamp(17px, 2.2vw, 24px)', lineHeight: '1.6', color: '#f1dfc4', textShadow: '0 2px 18px #000', animation: 'fadein 1.2s ease' } }, paragraphs[i++]);
    clear(text);
    text.appendChild(p);
    // with narration, hold each page until the line has been spoken
    const spoken = audio.voiceManifest?.[id]?.d;
    timer = setTimeout(next, spoken && audio.ctx ? Math.max(5200, spoken * 1000 + 1400) : 5200);
    if (el) withVoice(el, id);
  };
  const skip = btn('Skip', finish);
  el = screen('intro', h('div.col', { style: { alignItems: 'center', gap: '28px', padding: '16px' } }, text, h('div.row', btn('Next', () => { clearTimeout(timer); next(); }, 'primary'), skip)));
  next();
  return el;
}

const ENCYCLOPEDIA_GROUPS = [
  ['Structures', ['constructionYard', 'slab1', 'slab4', 'windtrap', 'refinery', 'silo', 'radar', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'repairYard', 'starport', 'ix', 'palace', 'gunTurret', 'rocketTurret', 'wall']],
  ['Infantry', ['soldier', 'trooper', 'saboteur']],
  ['Vehicles', ['trike', 'raider', 'quad', 'tank', 'siegeTank', 'launcher', 'harvester', 'mcv', 'sonicTank', 'devastator', 'deviator']],
  ['Aircraft and others', ['carryall', 'ornithopter', 'frigate', 'sandworm']],
];

export function encyclopediaScreen(app, house, onBack, deps) {
  const { stats, itemName, itemDesc, STRUCTURE_SIZE } = deps;
  const detail = h('div.panel', { style: { padding: '14px 16px', minHeight: '220px' } });
  const show = (id) => {
    const st = stats(id, house);
    clear(detail);
    const rows = [];
    const add = (k, v) => rows.push(h('tr', h('th', { style: { textAlign: 'left', color: 'var(--text-dim)', fontWeight: '500', padding: '3px 10px 3px 0' } }, k), h('td', String(v))));
    if (st.price) add('Cost', st.price);
    if (st.hitPoints) add('Armour', st.hitPoints);
    if (st.weaponDamage) add('Damage', st.weaponDamage + (st.weaponReloadTime ? ` (reload ${(st.weaponReloadTime * 16 / 1000).toFixed(1)} s)` : ''));
    if (st.weaponRange) add('Range', st.weaponRange + ' tiles');
    if (st.maxSpeed && !st.isStructure) add('Speed', (st.maxSpeed * 62.5 / 64).toFixed(1) + ' tiles/s (on concrete)');
    if (st.viewRange) add('Sight', st.viewRange + ' tiles');
    if (st.isStructure) {
      if (st.power > 0) add('Power', '−' + st.power);
      if (st.power < 0) add('Power', '+' + -st.power);
      if (st.capacity) add('Storage', st.capacity);
      const [w, hh] = STRUCTURE_SIZE[id] || [1, 1];
      add('Size', `${w}×${hh}`);
    }
    if (st.buildTime && st.builder) add('Build time', Math.round(st.buildTime * 15 * 16 / 1000) + ' s');
    if (st.techLevel > 0 && st.builder) add('Available from level', st.techLevel);
    if (st.prerequisite && st.prerequisite.length) add('Requires', st.prerequisite.map(itemName).join(', '));
    const availability = st.builder ? `Built at: ${itemName(st.builder)}` : (st.enabled ? 'Not built by this House' : 'Not available to this House');
    detail.append(
      h('div.row', { style: { gap: '14px', alignItems: 'flex-start' } },
        h('img', { src: app.icons.get(id, house), style: { width: '110px', height: '110px' } }),
        h('div', h('h3', { style: { margin: '0 0 4px', fontFamily: 'var(--font-title)', color: 'var(--accent-strong)' } }, itemName(id)), h('div', { style: { fontSize: '13px', lineHeight: '1.5' } }, itemDesc(id)), h('div.muted', { style: { fontSize: '12px', marginTop: '6px' } }, availability))),
      h('table', { style: { marginTop: '10px', fontSize: '13px' } }, ...rows),
    );
  };
  const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
  for (const [title, ids] of ENCYCLOPEDIA_GROUPS) {
    list.appendChild(h('div.muted', { style: { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' } }, title));
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '6px' } });
    for (const id of ids) {
      grid.appendChild(h('button.btn.small', { title: itemName(id), style: { padding: '2px' }, onclick: () => show(id) }, h('img', { src: app.icons.get(id, house), style: { width: '56px', height: '56px', display: 'block' } })));
    }
    list.appendChild(grid);
  }
  show('constructionYard');
  const box = h('div.panel.modal', { style: { width: 'min(980px, calc(100vw - 32px))' } },
    h('h2', 'Mentat encyclopedia'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: '16px' } }, h('div', { style: { maxHeight: '60vh', overflowY: 'auto', paddingRight: '6px' } }, list), detail),
    h('div.row', { style: { justifyContent: 'flex-end', marginTop: '12px' } }, btn('Close', onBack, 'primary')),
  );
  return screen('overlay-dim', box);
}
