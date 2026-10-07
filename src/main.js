import { SceneRenderer } from './render/scene.js';
import { PlanetView } from './render/planet.js';
import { IconFactory } from './render/icons.js';
import { audio } from './audio/audio.js';
import { h, clear, storageGet, storageSet, storageRemove } from './ui/dom.js';
import * as menus from './ui/menus.js';
import { GameView } from './client/gameView.js';
import { createGameFromIni, readMapInfo } from './game/scenario.js';
import { generateCampaignMission, generateSkirmishMap, hashSeed } from './game/missionGen.js';
import { parseIni } from './game/ini.js';
import { serializeGame, deserializeGame } from './game/saveload.js';
import { stats, itemName, itemDesc, STRUCTURE_SIZE } from './data/gamedata.js';
import { H, HOUSE_NAMES, HOUSE_LETTER } from './core/constants.js';
import {
  CAMPAIGNS, BRIEFINGS, REGION_PROGRESS, INITIAL_OWNERS, REGION_NAMES, VICTORY_TEXT, DEFEAT_TEXT, MEANWHILE, FINALE, regionDir, INTRO_TEXT,
} from './data/campaign.js';
import { mentatId } from './data/voice.js';

const DEFAULT_SETTINGS = {
  volMaster: 0.8,
  volSfx: 0.8,
  volMusic: 0.4,
  volVoice: 0.9,
  quality: 'high',
  gameSpeed: 1,
  edgeScroll: true,
  fogOfWar: false,
  concreteRequired: true,
  wormsRespawn: false,
};
const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ui = document.getElementById('ui-root');
    this.settings = { ...DEFAULT_SETTINGS, ...storageGet('dune.settings', {}) };
    this.campaign = storageGet('dune.campaign', null);
    this.skirmishSettings = storageGet('dune.skirmish', null) || {
      map: 'random',
      seed: 1992,
      credits: 3000,
      techLevel: 8,
      worms: 2,
      players: [{ house: H.ATREIDES, team: 1 }, { house: H.HARKONNEN, team: 2, difficulty: 1 }],
    };
    this.sceneRenderer = new SceneRenderer(this.canvas);
    this.sceneRenderer.quality = this.settings.quality;
    this.sceneRenderer.setQuality(this.settings.quality);
    this.icons = new IconFactory(this.sceneRenderer.renderer);
    this.planet = new PlanetView(this.sceneRenderer.renderer);
    this.gameView = null;
    this.menuOpen = false;
    this.overlay = null;
    this.mission = null;
    audio.setVolume('master', this.settings.volMaster);
    audio.volumes.sfx = this.settings.volSfx;
    audio.volumes.music = this.settings.volMusic;
    audio.volumes.voice = this.settings.volVoice;
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindPlanetInput();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.show('main');
    // quick start for development: ?mission=<house>,<level>,<variant>
    const params = new URLSearchParams(location.search);
    if (params.get('mission')) {
      const [house, level, variant] = params.get('mission').split(',').map((n) => parseInt(n, 10));
      this.campaign = { house, level, owners: {}, played: [], appliedLevel: level, kind: 'main', scores: [] };
      this.startCampaignMission(variant || 0);
    } else if (params.get('skirmish')) {
      this.skirmishSettings.map = params.get('skirmish');
      this.startSkirmish();
    }
    const unlock = () => {
      audio.init();
      audio.setVolume('sfx', this.settings.volSfx);
      audio.setVolume('music', this.settings.volMusic);
      if (!this.gameView && !audio.music && !audio.track) audio.startMusic('menu');
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  saveSettings() {
    storageSet('dune.settings', this.settings);
  }

  saveCampaign() {
    if (this.campaign) storageSet('dune.campaign', this.campaign);
    else storageRemove('dune.campaign');
  }

  resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.sceneRenderer.resize(w, hgt);
    this.planet.setAspect(w, hgt);
    if (this.gameView) this.gameView.resize();
  }

  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    try {
      if (this.gameView) {
        const gv = this.gameView;
        gv.update(dt);
        if (this.gameView === gv) gv.render();
      } else {
        this.planet.update(dt);
        this.planet.render();
      }
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------------------------------------------------------------------
  setScreen(el) {
    clear(this.ui);
    this.overlay = null;
    audio.stopDialogue();
    // victory / defeat music plays over the results screen only
    if (!this.gameView && (audio.musicMood === 'victory' || audio.musicMood === 'defeat') && !(el && el.classList.contains('results'))) audio.startMusic('menu');
    if (el) {
      this.ui.appendChild(el);
      if (el.voice) audio.dialogue(el.voice);
    }
  }

  show(name) {
    this.planet.showRegions(false);
    this.planet.offsetX = name === 'main' ? 1.6 : 0;
    this.planet.spin = true;
    this.pickRegions = null;
    switch (name) {
      case 'main': this.setScreen(menus.mainMenu(this)); break;
      case 'houseSelect': this.setScreen(menus.houseSelect(this)); break;
      case 'intro': this.setScreen(menus.introScreen(this, INTRO_TEXT, () => this.show('houseSelect'))); break;
      case 'encyclopedia': this.setScreen(this.encyclopediaOverlay(() => this.show('main'))); break;
      case 'settings': this.setScreen(menus.settingsScreen(this, () => this.show('main'))); break;
      case 'about': this.setScreen(menus.aboutScreen(this)); break;
      case 'skirmish': this.setScreen(menus.skirmishScreen(this)); break;
      case 'bonus': this.setScreen(menus.bonusScreen(this)); break;
      default: this.setScreen(menus.mainMenu(this));
    }
  }

  showOverlay(el) {
    if (this.overlay) this.overlay.remove();
    audio.stopDialogue();
    this.overlay = el;
    this.ui.appendChild(el);
    if (el.voice) audio.dialogue(el.voice);
  }

  // ---------------------------------------------------------------------------
  // planet input for region selection
  bindPlanetInput() {
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.gameView || !this.pickRegions) return;
      const i = this.planet.pick((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      const r = this.planet.regions[i];
      this.planet.setHover(r && r.selectable ? i : -1);
      this.canvas.style.cursor = r && r.selectable ? 'pointer' : '';
    });
    this.canvas.addEventListener('click', (e) => {
      if (this.gameView || !this.pickRegions) return;
      const i = this.planet.pick((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      const r = this.planet.regions[i];
      if (r && r.selectable) {
        audio.play('select');
        this.pickRegions(r.choiceIndex);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Campaign
  startCampaign(house) {
    const owners = {};
    for (const [hh, list] of Object.entries(INITIAL_OWNERS)) for (const r of list) owners[r] = Number(hh);
    this.campaign = { house, level: 1, owners, played: [], appliedLevel: 1, kind: 'main', scores: [] };
    this.saveCampaign();
    this.showCampaignBriefing(0);
  }

  continueCampaign() {
    const c = this.campaign;
    if (!c) return this.show('main');
    if (c.kind === 'bonus') return this.continueBonus();
    if (c.level <= 1) this.showCampaignBriefing(0);
    else this.showRegionMap();
  }

  applyRegionChanges() {
    const c = this.campaign;
    const prog = REGION_PROGRESS[c.house];
    while (c.appliedLevel < c.level) {
      c.appliedLevel++;
      const step = prog[c.appliedLevel];
      if (step) for (const [hh, list] of Object.entries(step.changes)) for (const r of list) c.owners[r] = Number(hh);
    }
    this.saveCampaign();
  }

  showRegionMap() {
    const c = this.campaign;
    this.applyRegionChanges();
    const step = REGION_PROGRESS[c.house][c.level];
    const choices = step.choices;
    const regions = [];
    for (let r = 1; r <= 27; r++) {
      const ci = choices.indexOf(r);
      regions.push({ id: r, dir: regionDir(r), owner: c.owners[r] ?? -1, selectable: ci >= 0 && !c.played.includes(ci), choiceIndex: ci });
    }
    this.planet.setRegions(regions);
    this.planet.showRegions(true);
    this.planet.offsetX = 0;
    this.planet.focus(regionDir(choices[0]));
    const choose = (idx) => {
      if (c.played.includes(idx) && choices.some((_, i) => !c.played.includes(i))) {
        audio.play('error');
        return;
      }
      this.pickRegions = null;
      this.showCampaignBriefing(idx);
    };
    this.pickRegions = choose;
    this.setScreen(menus.regionMapScreen(this, {
      house: c.house,
      level: c.level,
      text: step.text,
      choices,
      played: c.played,
      onChoose: choose,
      onBack: () => this.show('main'),
      voice: mentatId(c.house, `region_${c.level}`),
    }));
  }

  showCampaignBriefing(variant) {
    const c = this.campaign;
    const tpl = CAMPAIGNS[c.house][c.level - 1];
    const region = c.level === 1 ? null : REGION_PROGRESS[c.house][c.level].choices[variant];
    const objective = tpl.quota ? (c.level === 2 ? `accumulate ${tpl.quota} credits of spice or destroy the enemy base` : `accumulate ${tpl.quota} credits of spice`) : 'destroy all enemy structures';
    const enemies = tpl.enemies.map((e) => HOUSE_NAMES[e]).join(', ');
    this.pickRegions = null;
    this.planet.showRegions(false);
    this.planet.offsetX = -1.8;
    this.setScreen(menus.briefingScreen(this, {
      house: c.house,
      title: `Mission ${c.level}${region ? ': ' + REGION_NAMES[region] : ''}`,
      meta: `${HOUSE_NAMES[c.house]} · level ${c.level} of 9 · enemy: ${enemies}`,
      text: BRIEFINGS[c.house][c.level - 1],
      voice: mentatId(c.house, `briefing_${c.level}`),
      objective,
      onStart: () => this.startCampaignMission(variant),
      onBack: c.level > 1 ? () => this.showRegionMap() : () => this.show('main'),
    }));
  }

  startCampaignMission(variant) {
    const c = this.campaign;
    c.variant = variant;
    this.saveCampaign();
    this.setScreen(menus.loadingScreen('Landing on Arrakis…'));
    setTimeout(() => {
      const m = generateCampaignMission(c.house, c.level, variant);
      this.mission = { kind: 'campaign', house: c.house, level: c.level, variant, ini: m.ini, techLevel: m.techLevel, objective: m.objective };
      this.launchMission();
    }, 30);
  }

  launchMission() {
    const m = this.mission;
    const game = createGameFromIni(m.ini, {
      player: m.house,
      campaign: m.kind !== 'skirmish',
      techLevel: m.techLevel,
      settings: this.gameSettings(),
      seed: hashSeed(m.house, m.level, m.variant, Date.now() & 0xffff),
      playerSlots: m.playerSlots,
      teams: m.teams,
      aiMode: m.kind === 'skirmish' ? 'skirmish' : 'campaign',
      difficulty: m.difficulty ?? 1,
      name: m.name,
    });
    if (m.aiDifficulty) for (const [hid, d] of Object.entries(m.aiDifficulty)) if (game.houses[hid]?.ai) {
      game.houses[hid].ai.difficulty = d;
      game.houses[hid].ai.waveSize = [5, 7, 9][d];
    }
    if (m.objective) game.scenario.objective = 'Objective: ' + m.objective;
    this.startGame(game, m);
  }

  gameSettings() {
    return {
      fogOfWar: !!this.settings.fogOfWar,
      concreteRequired: this.settings.concreteRequired !== false,
      wormsRespawn: !!this.settings.wormsRespawn,
    };
  }

  startGame(game, mission) {
    if (this.gameView) this.gameView.dispose();
    this.setScreen(null);
    this.planet.showRegions(false);
    this.gameView = new GameView(this, game, { terrainSeed: hashSeed(mission.level || 0, mission.variant || 0) & 0xffff });
    this.gameView.cam.edgeScroll = this.settings.edgeScroll;
    this.gameView.setSpeed(this.settings.gameSpeed);
    this.menuOpen = false;
    game.message(mission.objective ? 'Objective: ' + mission.objective : 'Mission started', 'info');
  }

  endGameView() {
    if (this.gameView) {
      this.gameView.dispose();
      this.gameView = null;
    }
    this.menuOpen = false;
    if (audio.musicMood !== 'victory' && audio.musicMood !== 'defeat') audio.startMusic('menu');
  }

  // called by GameView a few seconds after the game is over
  onGameFinished(over, view) {
    const m = this.mission;
    const game = view.game;
    this.endGameView();
    if (!m) return this.show('main');
    if (m.kind === 'skirmish') {
      this.setScreen(menus.resultsScreen(this, { won: over.won, game, level: 5, onContinue: () => this.show('skirmish'), onRetry: () => this.launchMission() }));
      return;
    }
    if (m.kind === 'bonus') return this.finishBonus(over, game);
    const c = this.campaign;
    if (over.won) {
      const vt = VICTORY_TEXT[c.house];
      this.setScreen(menus.resultsScreen(this, {
        won: true, game, level: c.level, house: c.house,
        extraText: vt[c.level % vt.length],
        voice: mentatId(c.house, `victory_${(c.level % vt.length) + 1}`),
        onContinue: () => this.advanceCampaign(game.computeScore(c.level)),
      }));
    } else {
      this.setScreen(menus.resultsScreen(this, {
        won: false, game, level: c.level, house: c.house,
        extraText: DEFEAT_TEXT[c.house],
        voice: mentatId(c.house, 'defeat'),
        onRetry: () => this.launchMission(),
        onContinue: () => {
          if (c.level > 1) {
            if (!c.played.includes(m.variant)) c.played.push(m.variant);
            const n = REGION_PROGRESS[c.house][c.level].choices.length;
            if (c.played.length >= n) c.played = [];
            this.saveCampaign();
            this.showRegionMap();
          } else this.showCampaignBriefing(0);
        },
      }));
    }
  }

  advanceCampaign(score) {
    const c = this.campaign;
    const finished = c.level;
    if (finished > 1) {
      const region = REGION_PROGRESS[c.house][finished].choices[c.variant ?? 0];
      if (region) c.owners[region] = c.house;
    }
    c.scores.push(score);
    c.level++;
    c.played = [];
    this.saveCampaign();
    const next = () => {
      if (finished >= 9) {
        this.showFinale();
        return;
      }
      this.showRegionMap();
    };
    if (MEANWHILE[finished]) {
      this.setScreen(menus.storyScreen(this, { title: 'Meanwhile…', text: MEANWHILE[finished][c.house], house: c.house, onContinue: next, voice: `narrator/meanwhile_${finished}_${HOUSE_NAME_EN(c.house).toLowerCase()}` }));
    } else next();
  }

  showFinale() {
    const c = this.campaign;
    const owners = {};
    for (let r = 1; r <= 27; r++) owners[r] = c.house;
    const regions = [];
    for (let r = 1; r <= 27; r++) regions.push({ id: r, dir: regionDir(r), owner: c.house, selectable: false });
    this.planet.setRegions(regions);
    this.planet.showRegions(true);
    this.planet.spin = true;
    const total = c.scores.reduce((a, b) => a + b, 0);
    this.setScreen(menus.storyScreen(this, {
      title: `Arrakis belongs to House ${HOUSE_NAMES[c.house]}`,
      text: FINALE[c.house] + `\n\nFinal campaign score: ${total}.`,
      house: c.house,
      label: 'Main menu',
      voice: `narrator/finale_${HOUSE_NAME_EN(c.house).toLowerCase()}`,
      onContinue: () => {
        this.campaign = null;
        this.saveCampaign();
        this.show('main');
      },
    }));
  }

  // ---------------------------------------------------------------------------
  // Bonus campaigns (OpenSD2)
  async startBonusCampaign(house) {
    this.campaign = { kind: 'bonus', house, level: 1, mission: 1, played: [], owners: {}, scores: [] };
    for (const [hh, list] of Object.entries(INITIAL_OWNERS)) for (const r of list) this.campaign.owners[r] = Number(hh);
    this.saveCampaign();
    await this.showBonusBriefing();
  }

  async loadRegionIni(house) {
    const letter = HOUSE_LETTER[house];
    const text = await fetchText(`maps/opensd2/REGION${letter}.INI`);
    return parseIni(text);
  }

  async continueBonus() {
    const c = this.campaign;
    if (c.level <= 1) return this.showBonusBriefing();
    const ini = await this.loadRegionIni(c.house);
    const group = `GROUP${c.level - 1}`;
    // apply ownership of this group
    const keyHouse = { HAR: H.HARKONNEN, ATR: H.ATREIDES, ORD: H.ORDOS, FRE: H.FREMEN, SAR: H.SARDAUKAR, MER: H.MERCENARY };
    for (const [k, v] of ini.entries(group)) {
      if (keyHouse[k.toUpperCase()] !== undefined) for (const r of v.split(',').map((s) => parseInt(s, 10)).filter(Boolean)) c.owners[r] = keyHouse[k.toUpperCase()];
    }
    const choices = [];
    for (let i = 1; i <= 4; i++) {
      const v = ini.get(group, 'REG' + i);
      if (v) choices.push(parseInt(v.split(',')[0], 10));
    }
    const texts = ini.entries(group).filter(([k]) => /^ENGTXT/i.test(k)).map(([, v]) => v).join(' ');
    const regions = [];
    for (let r = 1; r <= 27; r++) {
      const ci = choices.indexOf(r);
      regions.push({ id: r, dir: regionDir(r), owner: c.owners[r] ?? -1, selectable: ci >= 0 && !c.played.includes(ci), choiceIndex: ci });
    }
    this.planet.setRegions(regions);
    this.planet.showRegions(true);
    this.planet.offsetX = 0;
    if (choices.length) this.planet.focus(regionDir(choices[0]));
    const choose = (idx) => {
      this.pickRegions = null;
      c.mission = c.level === 9 ? 22 : (c.level - 1) * 3 + 2 + idx;
      if (c.level === 9) c.mission = 22;
      c.variant = idx;
      this.saveCampaign();
      this.showBonusBriefing();
    };
    this.pickRegions = choose;
    this.setScreen(menus.regionMapScreen(this, {
      house: c.house, level: c.level, text: texts || 'Choose a region for the next operation.', choices, played: c.played, onChoose: choose, onBack: () => this.show('main'),
    }));
  }

  async showBonusBriefing() {
    const c = this.campaign;
    const letter = HOUSE_LETTER[c.house];
    const file = `maps/opensd2/SCEN${letter}${String(c.mission).padStart(3, '0')}.INI`;
    let text;
    try {
      text = await fetchText(file);
    } catch (e) {
      this.show('main');
      return;
    }
    const ini = parseIni(text);
    const win = ini.getInt('BASIC', 'WinFlags', 3);
    const quota = ini.getInt(HOUSE_NAME_EN(c.house), 'Quota', 0);
    const objective = win & 4 && quota ? `accumulate ${quota} credits of spice` : 'destroy all enemy structures';
    const enemies = [H.HARKONNEN, H.ATREIDES, H.ORDOS, H.FREMEN, H.SARDAUKAR, H.MERCENARY].filter((hh) => hh !== c.house && ini.has(HOUSE_NAME_EN(hh))).map((hh) => HOUSE_NAMES[hh]).join(', ');
    this.planet.showRegions(false);
    this.planet.offsetX = -1.8;
    const author = ini.get('BASIC', 'Author', '');
    this.setScreen(menus.briefingScreen(this, {
      house: c.house,
      title: `Operation ${c.mission}`,
      meta: `${HOUSE_NAMES[c.house]} · level ${c.level} of 9 · enemy: ${enemies || '—'}${author ? ' · scenario by ' + author : ''}`,
      text: `Commander, our scouts have confirmed the enemy positions, and our forces are ready to land. ${objective[0].toUpperCase() + objective.slice(1)}, and this region will be ours. Remember the worms: the sand here is alive.`,
      voice: win & 4 && quota ? 'narrator/bonus_quota' : 'narrator/bonus_destroy',
      objective,
      onStart: () => {
        const techLevel = c.mission === 22 ? 8 : Math.floor((c.mission + 1) / 3) + 1;
        this.mission = { kind: 'bonus', house: c.house, level: c.level, variant: c.variant || 0, ini: text, techLevel, objective };
        this.launchMission();
      },
      onBack: () => this.show('main'),
    }));
  }

  finishBonus(over, game) {
    const c = this.campaign;
    this.setScreen(menus.resultsScreen(this, {
      won: over.won, game, level: c.level,
      onRetry: over.won ? null : () => this.launchMission(),
      onContinue: () => {
        if (over.won) {
          c.scores.push(game.computeScore(c.level));
          if (c.level >= 9) {
            this.campaign = null;
            this.saveCampaign();
            this.setScreen(menus.storyScreen(this, { title: 'Campaign complete', text: `The ${HOUSE_NAMES[c.house]} are victorious on Arrakis. Final score: ${c.scores.reduce((a, b) => a + b, 0)}.`, onContinue: () => this.show('main') }));
            return;
          }
          c.level++;
          c.played = [];
        } else if (c.level > 1) {
          if (!c.played.includes(c.variant)) c.played.push(c.variant);
          c.level = c.level; // retry same level with another region
        }
        this.saveCampaign();
        this.continueBonus();
      },
    }));
  }

  // ---------------------------------------------------------------------------
  // Skirmish
  async loadSkirmishIndex() {
    if (this.skirmishIndex) return this.skirmishIndex;
    try {
      const r = await fetch('maps/skirmish/index.json');
      this.skirmishIndex = (await r.json()).sort((a, b) => a.players - b.players || a.w * a.h - b.w * b.h);
    } catch (e) {
      this.skirmishIndex = [];
    }
    return this.skirmishIndex;
  }

  async startSkirmish() {
    const s = this.skirmishSettings;
    storageSet('dune.skirmish', s);
    // unique houses
    const seen = new Set();
    const players = s.players.filter((p) => {
      if (seen.has(p.house)) return false;
      seen.add(p.house);
      return true;
    });
    if (players.length < 2) {
      alert('At least two different Houses are required.');
      return;
    }
    this.setScreen(menus.loadingScreen('Preparing the map…'));
    const teams = {};
    players.forEach((p) => (teams[p.house] = p.team || 1));
    const aiDifficulty = {};
    players.slice(1).forEach((p) => (aiDifficulty[p.house] = p.difficulty ?? 1));
    let ini;
    let playerSlots;
    if (s.map === 'random') {
      const gen = generateSkirmishMap({ seed: s.seed, players: players.map((p) => ({ house: p.house })), startCredits: s.credits, worms: s.worms, techLevel: s.techLevel });
      ini = gen.ini;
    } else {
      const text = await fetchText(`maps/skirmish/${encodeURIComponent(s.map)}`);
      const info = readMapInfo(text);
      playerSlots = {};
      players.slice(0, info.players.length).forEach((p, i) => (playerSlots[info.players[i]] = p.house));
      // override starting credits
      ini = text.replace(/^(Credits\s*=\s*)\d+/gim, `$1${s.credits}`);
      ini = ini.replace(/^(TechLevel\s*=\s*)\d+/gim, `$1${s.techLevel}`);
    }
    this.mission = {
      kind: 'skirmish', house: players[0].house, level: 0, variant: s.seed, ini, techLevel: s.techLevel, teams, playerSlots, aiDifficulty,
      objective: 'destroy all enemies',
    };
    setTimeout(() => this.launchMission(), 30);
  }

  // ---------------------------------------------------------------------------
  // in-game menu
  openGameMenu() {
    if (!this.gameView) return;
    this.menuOpen = true;
    this.showOverlay(menus.gameMenu(this));
  }

  closeGameMenu() {
    this.menuOpen = false;
    audio.stopDialogue();
    if (this.overlay) this.overlay.remove();
    this.overlay = null;
  }

  currentBriefingOverlay() {
    const m = this.mission;
    const house = m ? m.house : H.ATREIDES;
    const campaign = m && m.kind === 'campaign';
    const text = campaign ? BRIEFINGS[house][m.level - 1] : 'Destroy the enemy, and conquer Arrakis.';
    return menus.briefingScreen(this, {
      house, title: 'Briefing', meta: HOUSE_NAMES[house], text, objective: m?.objective,
      voice: campaign ? mentatId(house, `briefing_${m.level}`) : 'narrator/skirmish',
      startLabel: 'Back', onStart: () => this.showOverlay(menus.gameMenu(this)),
    });
  }

  restartMission() {
    this.closeGameMenu();
    this.endGameView();
    this.launchMission();
  }

  surrender() {
    this.closeGameMenu();
    if (this.gameView && !this.gameView.game.over) this.gameView.game.endGame(false, 'surrender');
  }

  quitToMenu() {
    this.closeGameMenu();
    this.endGameView();
    this.show('main');
  }

  encyclopediaOverlay(onBack) {
    const house = this.gameView ? this.gameView.game.player : this.campaign ? this.campaign.house : H.ATREIDES;
    return menus.encyclopediaScreen(this, house, onBack, { stats, itemName, itemDesc, STRUCTURE_SIZE });
  }

  hasSavedGame() {
    return !!storageGet('dune.save.meta', null);
  }

  saveGame() {
    if (!this.gameView) return;
    const g = this.gameView.game;
    try {
      const data = serializeGame(g);
      const payload = { data, mission: this.mission, campaign: this.campaign, cam: [this.gameView.cam.target.x, this.gameView.cam.target.z] };
      const ok = storageSet('dune.save', payload);
      if (!ok) throw new Error('storage');
      storageSet('dune.save.meta', { date: Date.now(), house: g.player, kind: this.mission?.kind, level: this.mission?.level });
      this.closeGameMenu();
      g.message('Game saved', 'good', 'saved', true, 'saved');
    } catch (e) {
      console.error(e);
      this.closeGameMenu();
      g.message('Could not save the game (not enough browser storage)', 'warn', 'savefail');
    }
  }

  loadGame() {
    const payload = storageGet('dune.save', null);
    if (!payload) return;
    try {
      this.setScreen(menus.loadingScreen('Loading saved game…'));
      const game = deserializeGame(payload.data);
      this.mission = payload.mission;
      if (payload.campaign) this.campaign = payload.campaign;
      if (payload.cam) game.startView = [Math.floor(payload.cam[0]), Math.floor(payload.cam[1])];
      this.startGame(game, this.mission || { kind: 'skirmish', level: 0, variant: 0 });
    } catch (e) {
      console.error(e);
      this.show('main');
    }
  }

  changeSpeed(dir) {
    let i = SPEEDS.indexOf(this.settings.gameSpeed);
    if (i < 0) i = 2;
    i = Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
    this.settings.gameSpeed = SPEEDS[i];
    this.saveSettings();
    if (this.gameView) {
      this.gameView.setSpeed(SPEEDS[i]);
      this.gameView.hud.addMessage(`Game speed: ×${SPEEDS[i]}`);
    }
  }
}

function HOUSE_NAME_EN(h) {
  return ['Harkonnen', 'Atreides', 'Ordos', 'Fremen', 'Sardaukar', 'Mercenary'][h];
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  const buf = await r.arrayBuffer();
  return new TextDecoder('latin1').decode(buf);
}

window.__app = new App();
window.__audio = audio;
