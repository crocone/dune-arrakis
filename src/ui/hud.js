import { h, clear } from './dom.js';
import { Minimap } from './minimap.js';
import { itemName, itemDesc, stats, isStructureType, STRUCTURE_SIZE } from '../data/gamedata.js';
import { HOUSE_NAMES, HOUSE_COLORS_CSS, H } from '../core/constants.js';
import { formatTime } from '../core/mathutil.js';
import { MODE, MODE_NAMES } from '../game/object.js';
import { DISPLAY_ORDER } from '../game/structures.js';
import { audio } from '../audio/audio.js';

const BUILDER_TABS = ['constructionYard', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'highTechFactory', 'starport'];
const PREREQ_NAMES = (list) => list.map((p) => itemName(p)).join(', ');

export class Hud {
  constructor(view) {
    this.view = view;
    this.game = view.game;
    this.app = view.app;
    this.icons = view.app.icons;
    this.root = h('div.hud');
    document.getElementById('ui-root').appendChild(this.root);
    this.dirty = true;
    this.activeBuilderType = 'constructionYard';
    this.activeBuilder = null;
    this.itemEls = new Map();
    this.messagesQueue = [];
    this.lastStats = '';
    this.updateTimer = 0;
    this.build();
  }

  sidebarWidth() {
    return this.sidebar ? this.sidebar.offsetWidth : 290;
  }

  dispose() {
    this.root.remove();
  }

  resize() {}

  icon(id, house) {
    return this.icons.get(id, house ?? this.game.player);
  }

  build() {
    const g = this.game;
    const hc = HOUSE_COLORS_CSS[g.player];
    this.root.style.setProperty('--house', hc);
    // --- top bar
    this.menuBtn = h('button.btn.icon-btn', { title: 'Menu (Esc)', onclick: () => this.app.openGameMenu() }, '☰');
    this.objectiveEl = h('div.panel.objective');
    this.clockEl = h('div.panel.clock');
    this.topbar = h('div.topbar', this.menuBtn, this.objectiveEl, this.clockEl);
    // --- sidebar
    this.minimapCanvas = h('canvas');
    this.radarOff = h('div.offline', 'Radar offline');
    this.minimapWrap = h('div.minimap-wrap', this.minimapCanvas, this.radarOff);
    this.minimap = new Minimap(this.minimapCanvas);
    this.minimap.setMap(g.map);
    this.bindMinimap();
    this.creditsVal = h('div.val', '0');
    this.storageFill = h('div');
    this.creditsSub = h('div.sub', '');
    this.powerFill = h('div.fill');
    this.powerUse = h('div.use');
    this.powerVal = h('div.val', '0');
    this.powerSub = h('div.sub', '');
    this.stats = h('div.stats',
      h('div.stat', h('div.lbl', 'Credits'), this.creditsVal, h('div.storage-bar', this.storageFill), this.creditsSub),
      h('div.stat', h('div.lbl', 'Power'), this.powerVal, h('div.power-bar', this.powerFill, this.powerUse), this.powerSub),
    );
    this.tabs = h('div.tabs');
    this.builderHead = h('div.builder-head');
    this.grid = h('div.build-grid');
    this.sideActions = h('div.side-actions');
    this.sidebar = h('div.sidebar', this.minimapWrap, this.stats, this.tabs, this.builderHead, this.grid, this.sideActions);
    // --- selection
    this.selection = h('div.panel.selection.hidden');
    // --- messages, banner, tooltip
    this.messagesEl = h('div.messages');
    this.bannerEl = h('div.centerline');
    this.tooltip = h('div.tooltip');
    this.tooltip.style.display = 'none';
    this.pauseEl = h('div.centerline', { style: { top: '45%' } });
    this.root.append(this.topbar, this.sidebar, this.selection, this.messagesEl, this.bannerEl, this.pauseEl, this.tooltip);
  }

  bindMinimap() {
    const c = this.minimapCanvas;
    let dragging = false;
    const move = (e) => {
      const r = c.getBoundingClientRect();
      const [tx, ty] = this.minimap.toTile(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      return [tx, ty];
    };
    c.addEventListener('mousedown', (e) => {
      audio.init();
      const [tx, ty] = move(e);
      if (e.button === 0) {
        dragging = true;
        this.view.cam.lookAt(tx, ty, false);
      } else if (e.button === 2) {
        const units = this.view.input.ownSelectedUnits();
        if (units.length) this.view.input.commandUnits(units, Math.floor(tx), Math.floor(ty), null, 'auto');
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const [tx, ty] = move(e);
      this.view.cam.lookAt(tx, ty, false);
    });
    window.addEventListener('mouseup', () => (dragging = false));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  addMessage(text, kind = 'info') {
    const el = h('div.msg', { class: kind === 'warn' ? 'warn' : kind === 'good' ? 'good' : '' }, text);
    this.messagesEl.prepend(el);
    while (this.messagesEl.children.length > 6) this.messagesEl.lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 6000);
    setTimeout(() => el.remove(), 7000);
  }

  showBanner(text, warn) {
    clear(this.bannerEl);
    this.bannerEl.appendChild(h('div.banner', { class: warn ? 'warn' : '' }, text));
  }

  setPaused(p) {
    clear(this.pauseEl);
    if (p) this.pauseEl.appendChild(h('div.banner', 'PAUSED'));
  }

  // ---------------------------------------------------------------------------
  playerHouse() {
    return this.game.houses[this.game.player];
  }

  ownBuilders(type) {
    const g = this.game;
    return g.structures.filter((s) => s.alive && s.owner === g.player && s.type === type);
  }

  // pick active builder: selected builder or first of active type
  resolveActiveBuilder() {
    const g = this.game;
    const sel = [...g.selection];
    if (sel.length === 1 && sel[0].isStructure && sel[0].isBuilder && sel[0].owner === g.player) {
      this.activeBuilder = sel[0];
      this.activeBuilderType = sel[0].type;
      return;
    }
    if (this.activeBuilder && this.activeBuilder.alive && this.activeBuilder.owner === g.player && this.activeBuilder.type === this.activeBuilderType) return;
    const list = this.ownBuilders(this.activeBuilderType);
    if (list.length) {
      this.activeBuilder = list[0];
      return;
    }
    for (const t of BUILDER_TABS) {
      const l = this.ownBuilders(t);
      if (l.length) {
        this.activeBuilderType = t;
        this.activeBuilder = l[0];
        return;
      }
    }
    this.activeBuilder = null;
  }

  renderTabs() {
    clear(this.tabs);
    for (const t of BUILDER_TABS) {
      const list = this.ownBuilders(t);
      if (!list.length) continue;
      const busy = list.some((b) => b.waitingToPlace);
      const tab = h('button.tab', {
        class: this.activeBuilderType === t ? 'active' : '',
        title: itemName(t) + (list.length > 1 ? ` (${list.length})` : ''),
        onclick: () => {
          audio.play('click');
          if (this.activeBuilderType === t && list.length > 1) {
            const i = list.indexOf(this.activeBuilder);
            this.activeBuilder = list[(i + 1) % list.length];
          } else {
            this.activeBuilderType = t;
            this.activeBuilder = list[0];
          }
          this.game.selection.clear();
          this.game.selection.add(this.activeBuilder);
          this.dirty = true;
        },
        ondblclick: () => this.view.cam.lookAt(this.activeBuilder.px, this.activeBuilder.py, false),
      }, h('img', { src: this.icon(t), alt: '' }), list.length > 1 ? h('span.badge', String(list.length)) : null, busy ? h('span.ready-dot') : null);
      this.tabs.appendChild(tab);
    }
    // palace weapon tab
    const palaces = this.ownBuilders('palace');
    if (palaces.length) {
      const p = palaces[0];
      const ready = p.isReady();
      const kind = p.weaponKind();
      const name = kind === 'deathHand' ? 'Death Hand' : kind === 'fremen' ? 'Summon Fremen' : 'Saboteur';
      this.palaceCharge = h('div.charge');
      const btn = h('button.tab.palace-btn', {
        class: ready ? 'active' : '',
        title: `${name}${ready ? ': ready' : ''}`,
        onclick: () => {
          if (!p.alive || !p.isReady()) {
            audio.play('error');
            return;
          }
          if (kind === 'deathHand') {
            this.view.input.setMode('deathHand', p);
            this.game.message('Select a target for the Death Hand', 'info', 'dhpick');
          } else p.doSpecialWeapon();
          this.dirty = true;
        },
      }, h('img', { src: this.icon('palace'), alt: '' }), this.palaceCharge, ready ? h('span.ready-dot') : null);
      this.palaceBtn = { btn, palace: p };
      this.tabs.appendChild(btn);
    } else this.palaceBtn = null;
  }

  renderBuildGrid() {
    clear(this.grid);
    clear(this.builderHead);
    clear(this.sideActions);
    this.itemEls.clear();
    const b = this.activeBuilder;
    const g = this.game;
    const house = this.playerHouse();
    if (!b) {
      this.builderHead.appendChild(h('span', 'No production structures'));
      return;
    }
    const hpPct = Math.round((b.health / b.maxHealth) * 100);
    const head = h('span', h('b', itemName(b.type)), ` · ${hpPct}%`);
    this.builderHead.appendChild(head);
    if (b.type !== 'starport' && b.maxUpgradeLevel() > 0) {
      const lvl = h('span', { title: 'Upgrade level' }, `lvl ${b.upgradeLevel}/${b.maxUpgradeLevel()}`);
      this.builderHead.appendChild(lvl);
    }
    // items: available + locked potential ones
    const available = b.buildList;
    const potential = b.type === 'starport' ? available : b.potentialItems();
    for (const id of potential) {
      const avail = available.includes(id);
      const st = stats(id, b.originalOwner);
      const price = b.type === 'starport' ? house.choam.price(id) : st.price;
      const el = h('div.bitem', { class: avail ? '' : 'disabled' },
        h('img', { src: this.icon(id, g.player), alt: '' }),
        h('div.prog', { style: { transform: 'scaleY(0)' } }),
        h('div.state'),
        h('div.count'),
        h('div.price', `${Math.round(price)}`),
      );
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        audio.init();
        if (!avail) {
          audio.play('error');
          return;
        }
        this.onItemClick(b, id, e.button, e.shiftKey);
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('mouseenter', () => this.showTooltip(el, b, id, avail));
      el.addEventListener('mouseleave', () => this.hideTooltip());
      this.grid.appendChild(el);
      this.itemEls.set(id, { el, prog: el.querySelector('.prog'), state: el.querySelector('.state'), count: el.querySelector('.count'), price: el.querySelector('.price') });
    }
    // side actions
    if (b.type === 'starport') {
      this.sideActions.appendChild(h('button.btn.small', { onclick: () => { if (b.doPlaceOrder()) audio.play('ack'); else audio.play('error'); this.dirty = true; } }, 'Order'));
      this.sideActions.appendChild(h('button.btn.small', { onclick: () => { b.doCancelOrder(); this.dirty = true; } }, 'Cancel'));
    } else {
      const canUp = b.canUpgrade();
      this.upBtn = h('button.btn.small', {
        disabled: !canUp,
        title: canUp ? `Upgrade for ${b.upgradePrice()} cr. (U)` : 'Upgrade unavailable',
        onclick: () => {
          if (b.doUpgrade()) audio.play('ack');
          else audio.play('error');
          this.dirty = true;
        },
      }, b.upgrading ? 'Upgrading…' : 'Upgrade');
      this.sideActions.appendChild(this.upBtn);
    }
    this.sideActions.appendChild(h('button.btn.small', { title: 'Repair (R)', disabled: b.health >= b.maxHealth, onclick: () => { b.doRepair(); this.dirty = true; } }, b.repairing ? 'Repairing…' : 'Repair'));
    this.sideActions.appendChild(h('button.btn.small', { title: 'Show on map', onclick: () => this.view.cam.lookAt(b.px, b.py, false) }, 'Locate'));
  }

  onItemClick(b, id, button, shift) {
    const g = this.game;
    const input = this.view.input;
    if (button === 0) {
      if (b.type === 'constructionYard' && b.waitingToPlace && b.currentItem === id) {
        input.setMode('place', { item: id, builder: b });
        audio.play('click');
        return;
      }
      if (b.doProduceItem(id, shift ? 5 : 1)) audio.play('click');
      else audio.play('error');
    } else if (button === 2) {
      if (b.type === 'starport') {
        b.doCancelItem(id);
      } else if (b.currentItem === id && !b.onHold && b.progress > 0 && !b.waitingToPlace && b.countInQueue(id) === 1 && !shift) {
        b.setOnHold(true);
      } else {
        const n = shift ? 5 : 1;
        for (let i = 0; i < n; i++) b.doCancelItem(id);
        if (input.mode === 'place' && input.placeItem === id && !b.waitingToPlace) input.cancelMode();
      }
      audio.play('click');
    }
    this.dirty = true;
  }

  showTooltip(el, b, id, avail) {
    const st = stats(id, b.originalOwner);
    const g = this.game;
    const house = this.playerHouse();
    const lines = [h('b', itemName(id)), h('div', itemDesc(id))];
    const meta = [];
    const price = b.type === 'starport' ? house.choam.price(id) : st.price;
    meta.push(`Cost: ${Math.round(price)}`);
    if (st.hitPoints) meta.push(`Armour: ${st.hitPoints}`);
    if (st.weaponDamage) meta.push(`Damage: ${st.weaponDamage}, range ${st.weaponRange}`);
    if (isStructureType(id)) {
      if (st.power > 0) meta.push(`Power: −${st.power}`);
      else if (st.power < 0) meta.push(`Power: +${-st.power}`);
      const [w, hh] = STRUCTURE_SIZE[id];
      meta.push(`Size: ${w}×${hh}`);
    }
    if (b.type !== 'starport') meta.push(`Time: ${Math.round((st.buildTime * 15 * 16) / 1000)} s`);
    else meta.push(`In stock: ${house.choam.num(id)}`);
    lines.push(h('div.meta', meta.join(' · ')));
    if (!avail) {
      const req = [];
      if ((st.upgradeLevel || 0) > b.upgradeLevel) req.push(`upgrade level ${st.upgradeLevel}`);
      const missing = (st.prerequisite || []).filter((p) => house.getCount(p) <= 0);
      if (missing.length) req.push(PREREQ_NAMES(missing));
      lines.push(h('div.req', 'Requires: ' + (req.join(', ') || 'unavailable')));
    } else {
      lines.push(h('div.meta', 'Left click: order (Shift ×5). Right click: hold / cancel'));
    }
    clear(this.tooltip);
    this.tooltip.append(...lines);
    this.tooltip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const tw = 280;
    this.tooltip.style.left = Math.max(8, r.left - tw - 10) + 'px';
    this.tooltip.style.top = Math.min(window.innerHeight - 160, r.top) + 'px';
  }

  hideTooltip() {
    this.tooltip.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  renderSelection() {
    const g = this.game;
    const sel = [...g.selection].filter((o) => o.alive);
    const el = this.selection;
    clear(el);
    if (!sel.length) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const first = sel[0];
    const own = first.owner === g.player;
    if (sel.length === 1) {
      const o = first;
      el.appendChild(h('div.portrait', h('img', { src: this.icons.get(o.fremen ? 'trooper' : o.type, o.owner), alt: '' })));
      this.selHp = h('div');
      this.selDetail = h('div.detail');
      el.appendChild(h('div.info',
        h('div.name', o.fremen ? 'Fremen' : itemName(o.type)),
        h('div.owner', { style: { color: HOUSE_COLORS_CSS[o.owner] } }, HOUSE_NAMES[o.owner] + (o.deviationTimer > 0 ? ' (deviated)' : '')),
        h('div.hpbar', this.selHp),
        this.selDetail,
      ));
    } else {
      const multi = h('div.multi');
      this.multiEls = [];
      for (const o of sel.slice(0, 30)) {
        const hp = h('div');
        const m = h('div.mini', {
          title: itemName(o.type),
          onclick: (e) => {
            if (e.shiftKey) g.selection.delete(o);
            else {
              g.selection.clear();
              g.selection.add(o);
            }
            this.dirty = true;
          },
        }, h('img', { src: this.icons.get(o.type, o.owner), alt: '' }), h('div.hp', hp));
        this.multiEls.push({ o, hp });
        multi.appendChild(m);
      }
      el.appendChild(multi);
      this.selHp = null;
    }
    if (!own) return;
    const cmds = h('div.cmds');
    const units = sel.filter((o) => o.isUnit && o.respondable !== false);
    const input = this.view.input;
    const btn = (label, title, fn, active = false) => h('button.btn', { title, class: active ? 'active' : '', onclick: () => { audio.play('click'); fn(); this.dirty = true; } }, label);
    if (units.length) {
      const anyArmed = units.some((u) => u.canAttackAnything());
      cmds.appendChild(btn('Move', 'Move (M)', () => input.setMode('move'), input.mode === 'move'));
      if (anyArmed) cmds.appendChild(btn('Attack', 'Attack (A)', () => input.setMode('attack'), input.mode === 'attack'));
      cmds.appendChild(btn('Stop', 'Stop (S)', () => units.forEach((u) => u.doSetAttackMode(MODE.STOP))));
      if (anyArmed) {
        const m = units[0].attackMode;
        cmds.appendChild(btn('Guard', 'Guard position', () => units.forEach((u) => u.doSetAttackMode(MODE.GUARD)), m === MODE.GUARD));
        cmds.appendChild(btn('Area', 'Guard area', () => units.forEach((u) => u.doSetAttackMode(MODE.AREAGUARD)), m === MODE.AREAGUARD));
        cmds.appendChild(btn('Ambush', 'Ambush: wait for the enemy', () => units.forEach((u) => u.doSetAttackMode(MODE.AMBUSH)), m === MODE.AMBUSH));
        cmds.appendChild(btn('Hunt', 'Seek and destroy', () => units.forEach((u) => u.doSetAttackMode(MODE.HUNT)), m === MODE.HUNT));
      }
      if (units.some((u) => u.isInfantry && u.type !== 'saboteur')) cmds.appendChild(btn('Capture', 'Capture structure (C)', () => input.setMode('capture'), input.mode === 'capture'));
      if (units.some((u) => u.type === 'harvester')) cmds.appendChild(btn('Return', 'Return to refinery (H)', () => units.forEach((u) => u.type === 'harvester' && u.doReturn())));
      if (units.some((u) => u.type === 'mcv')) cmds.appendChild(btn('Deploy', 'Deploy into a Construction Yard (X)', () => units.forEach((u) => {
        if (u.type === 'mcv' && !u.doDeploy()) g.message('The MCV cannot deploy here', 'warn', 'mcv');
      })));
      if (units.some((u) => u.type === 'devastator')) cmds.appendChild(btn('Detonate', 'Self-destruct (X)', () => units.forEach((u) => u.type === 'devastator' && u.doStartDevastate())));
      if (units.some((u) => !u.isInfantry && !u.isAir && u.health < u.maxHealth) && g.hasStructure(g.player, 'repairYard')) {
        cmds.appendChild(btn('Repair', 'Send for repair (R)', () => units.forEach((u) => !u.isInfantry && u.doRepair())));
      }
      if (g.hasCarryalls(g.player) && units.some((u) => !u.isInfantry && !u.isAir)) cmds.appendChild(btn('Airlift', 'Deliver by Carryall (D)', () => input.setMode('drop'), input.mode === 'drop'));
    } else if (sel.length === 1 && first.isStructure) {
      const s = first;
      if (s.health < s.maxHealth) cmds.appendChild(btn(s.repairing ? 'Repairing…' : 'Repair', 'Repair (R)', () => s.doRepair(), s.repairing));
      if (s.isBuilder && s.type !== 'starport' && s.canUpgrade()) cmds.appendChild(btn('Upgrade', `Upgrade for ${s.upgradePrice()} cr. (U)`, () => s.doUpgrade()));
      if (s.isBuilder && s.type === 'constructionYard' && s.waitingToPlace) cmds.appendChild(btn('Place', 'Place structure (P)', () => input.setMode('place', { item: s.currentItem, builder: s })));
      if (s.type === 'palace') {
        const kind = s.weaponKind();
        const label = kind === 'deathHand' ? 'Death Hand' : kind === 'fremen' ? 'Fremen' : 'Saboteur';
        cmds.appendChild(btn(label, 'House special weapon', () => {
          if (!s.isReady()) return audio.play('error');
          if (kind === 'deathHand') input.setMode('deathHand', s);
          else s.doSpecialWeapon();
        }));
      }
    }
    if (cmds.children.length) el.appendChild(cmds);
  }

  updateSelectionDynamic() {
    const g = this.game;
    const sel = [...g.selection].filter((o) => o.alive);
    if (sel.length === 1 && this.selHp) {
      const o = sel[0];
      const f = o.health / o.maxHealth;
      this.selHp.style.width = `${f * 100}%`;
      this.selHp.style.background = f >= 0.5 ? '#46e04a' : f >= 0.25 ? '#f0c030' : '#f03a2a';
      let d = `Armour ${Math.ceil(o.health)}/${o.maxHealth}`;
      if (o.isUnit && o.attackMode && o.respondable !== false && o.owner === g.player) d += ` · ${MODE_NAMES[o.attackMode] || ''}`;
      if (o.type === 'harvester') d += ` · Spice ${Math.round((o.spice / 700) * 100)}%${o.returning ? ' · returning' : o.isHarvesting && o.isHarvesting() ? ' · harvesting' : ''}`;
      if (o.type === 'windtrap' || (o.type === 'constructionYard' && o.owner === g.player)) {
        const hs = g.houses[o.owner];
        d += ` · Power ${hs.producedPower}/${hs.powerRequirement}`;
      }
      if ((o.type === 'refinery' || o.type === 'silo') && o.owner === g.player) {
        const hs = g.houses[o.owner];
        d += ` · Storage ${Math.round(hs.storedCredits)}/${hs.capacity}`;
      }
      if (o.type === 'palace') d += o.isReady() ? ' · Weapon ready' : ` · Ready in ${formatTime((o.specialTimer * 16) / 1000)}`;
      if (o.deviationTimer > 0) d += ` · ${Math.ceil((o.deviationTimer * 16) / 1000)} s`;
      if (o.isBuilder && o.upgrading) d += ` · Upgrading ${Math.round((o.upgradeProgress / o.upgradePrice()) * 100)}%`;
      if (o.type === 'starport' && o.arrivalTimer > 0) d += ` · Frigate in ${Math.ceil((o.arrivalTimer * 16) / 1000)} s`;
      if (this.selDetail.textContent !== d) this.selDetail.textContent = d;
    } else if (this.multiEls) {
      for (const { o, hp } of this.multiEls) {
        const f = o.health / o.maxHealth;
        hp.style.width = `${f * 100}%`;
        hp.style.background = f >= 0.5 ? '#46e04a' : f >= 0.25 ? '#f0c030' : '#f03a2a';
      }
    }
  }

  updateItems() {
    const b = this.activeBuilder;
    if (!b || !b.alive) return;
    const house = this.playerHouse();
    for (const [id, refs] of this.itemEls) {
      let state = '';
      let frac = 0;
      let cls = '';
      const count = b.countInQueue(id);
      if (b.type === 'starport') {
        refs.price.textContent = String(Math.round(house.choam.price(id)));
        state = house.choam.num(id) <= 0 ? 'SOLD OUT' : '';
        refs.count.textContent = count ? String(count) : `${house.choam.num(id)}`;
        if (b.arrivalTimer > 0) {
          frac = b.productionFraction();
          if (count) state = 'EN ROUTE';
        }
      } else {
        refs.count.textContent = count > 1 ? String(count) : '';
        if (b.currentItem === id) {
          frac = b.productionFraction();
          if (b.waitingToPlace) {
            state = 'READY';
            cls = 'ready';
          } else if (b.onHold) {
            state = 'ON HOLD';
            cls = 'onhold';
          } else if (b.upgrading) state = '…';
          else state = `${Math.floor(frac * 100)}%`;
        } else if (count) state = 'QUEUED';
      }
      refs.prog.style.transform = `scaleY(${frac})`;
      if (refs.state.textContent !== state) refs.state.textContent = state;
      refs.el.classList.toggle('ready', cls === 'ready');
      refs.el.classList.toggle('onhold', cls === 'onhold');
    }
    if (this.upBtn && b.upgrading) this.upBtn.textContent = `Upgr. ${Math.round((b.upgradeProgress / b.upgradePrice()) * 100)}%`;
  }

  updateStats() {
    const g = this.game;
    const house = this.playerHouse();
    if (!house) return;
    const cr = house.credits;
    this.creditsVal.textContent = String(cr);
    const cap = house.capacity;
    this.storageFill.style.width = cap > 0 ? `${Math.min(100, (house.storedCredits / cap) * 100)}%` : '0%';
    this.creditsSub.textContent = cap > 0 ? `Spice ${Math.round(house.storedCredits)}/${cap}` : 'No storage';
    const prod = house.producedPower;
    const req = house.powerRequirement;
    this.powerVal.textContent = `${prod - req >= 0 ? '+' : ''}${prod - req}`;
    this.powerVal.style.color = prod >= req ? '' : 'var(--danger)';
    const max = Math.max(prod, req, 1);
    this.powerFill.style.width = `${(prod / max) * 100}%`;
    this.powerFill.style.background = prod >= req ? 'var(--ok)' : 'var(--danger)';
    this.powerUse.style.left = `${Math.min(100, (req / max) * 100)}%`;
    this.powerSub.textContent = `${prod} / ${req}`;
    // objective
    const sc = g.scenario;
    let obj = '';
    let prog = null;
    if (house.quota > 0) {
      obj = `Objective: accumulate <b>${house.quota}</b> credits of spice` + (sc.winFlags & 1 ? ' or destroy the enemy' : '');
      prog = Math.min(1, house.storedCredits / house.quota);
    } else if (sc.winFlags & 1) obj = 'Objective: <b>destroy all enemy forces</b>';
    else obj = sc.objective || 'Objective: survive';
    const key = obj + (prog !== null ? Math.round(prog * 200) : '');
    if (key !== this.lastObjective) {
      this.lastObjective = key;
      this.objectiveEl.innerHTML = obj + (prog !== null ? `<div class="progress"><div style="width:${prog * 100}%"></div></div>` : '');
    }
    const secs = (g.cycle * 16) / 1000;
    const speed = this.view.speed;
    this.clockEl.textContent = `${formatTime(secs)} · ×${speed}`;
  }

  radarActive() {
    const g = this.game;
    const house = this.playerHouse();
    return house && house.getCount('radar') > 0 && house.hasPower();
  }

  update(dt) {
    const g = this.game;
    this.updateTimer += dt;
    // structural rebuilds
    const sig = this.signature();
    if (this.dirty || sig !== this.lastSig) {
      this.lastSig = sig;
      this.dirty = false;
      this.resolveActiveBuilder();
      this.renderTabs();
      this.renderBuildGrid();
      this.renderSelection();
    }
    this.updateItems();
    if (this.palaceBtn) {
      const p = this.palaceBtn.palace;
      this.palaceCharge.style.width = `${(1 - p.specialTimer / p.maxSpecialTimer()) * 100}%`;
    }
    if (this.updateTimer > 0.1) {
      this.updateTimer = 0;
      this.updateStats();
      this.updateSelectionDynamic();
      const radar = this.radarActive();
      if (radar !== this.lastRadar) {
        if (this.lastRadar !== undefined) {
          audio.play('radarOn');
          audio.announce(this.game.player, radar ? 'radarOn' : 'radarOff', { key: 'radar', cooldown: 3 });
        }
        this.lastRadar = radar;
        this.minimap.dirty = true;
      }
      this.radarOff.style.display = radar ? 'none' : 'flex';
      this.radarOff.textContent = this.playerHouse().getCount('radar') > 0 ? 'Not enough power for radar' : 'No Radar Outpost';
    }
    this.minimap.draw(g, g.player, this.view.cam.viewCorners(), this.radarActive());
  }

  // a cheap signature of things that change the sidebar layout
  signature() {
    const g = this.game;
    const house = this.playerHouse();
    let s = '';
    for (const st of g.structures) {
      if (st.owner !== g.player || !st.alive) continue;
      if (st.isBuilder) s += st.type[0] + st.id + ':' + st.buildList.length + (st.waitingToPlace ? 'w' : '') + st.upgradeLevel + (st.upgrading ? 'u' : '') + (st.repairing ? 'r' : '') + Math.round((st.health / st.maxHealth) * 10) + ';';
      else if (st.type === 'palace') s += 'p' + (st.isReady() ? 1 : 0);
    }
    s += '|' + [...g.selection].map((o) => o.id + (o.alive ? '' : 'x') + (o.attackMode || '') + (o.owner) + (o.repairing ? 'r' : '')).join(',');
    s += '|' + (this.view.input.mode || '');
    s += '|' + (house ? house.getCount('repairYard') + house.getCount('carryall') : 0);
    return s;
  }
}
