import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const results = [];
const check = (name, cond, info = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${info}`);
try {
  const { generateSkirmishMap } = await server.ssrLoadModule('/src/game/missionGen.js');
  const { createGameFromIni } = await server.ssrLoadModule('/src/game/scenario.js');
  const { MODE } = await server.ssrLoadModule('/src/game/object.js');
  const mk = (seed = 11) => {
    const sk = generateSkirmishMap({ seed, players: [{ house: 1 }, { house: 0 }], startCredits: 20000, worms: 0 });
    const g = createGameFromIni(sk.ini, { player: 1, campaign: false, seed: 3, teams: { 1: 1, 0: 2 } });
    g.houses[0].ai = null; // passive enemy
    return g;
  };
  const ff = (g, n) => { for (let i = 0; i < n; i++) g.update(); };
  const spot = (g, P, type, near) => {
    for (let r = 0; r < 14; r++) for (let y = near.y - r; y <= near.y + r; y++) for (let x = near.x - r; x <= near.x + r; x++) if (g.canPlaceStructure(P, type, x, y).ok) return [x, y];
    return null;
  };
  // ---------------- build a base
  const g = mk();
  const P = 1;
  const cy = g.structures.find((s) => s.owner === P && s.type === 'constructionYard');
  const build = (type) => {
    cy.doProduceItem(type);
    let n = 0;
    while (!cy.waitingToPlace && n < 6000) { g.update(); n++; }
    // add slabs everywhere near? just place
    const p = spot(g, P, type, cy);
    if (!p) return null;
    const s = g.placeStructure(P, type, p[0], p[1], { builder: cy, byPlayer: true });
    cy.onPlaced();
    return s;
  };
  for (const t of ['windtrap', 'windtrap', 'refinery', 'radar', 'windtrap', 'lightFactory', 'heavyFactory', 'starport', 'highTechFactory', 'windtrap', 'windtrap', 'palace']) {
    const s = build(t);
    check('build ' + t, !!s, s ? `@${s.x},${s.y} hp ${Math.round(s.health)}/${s.maxHealth}` : '');
  }
  const house = g.houses[P];
  const expectedPower = g.structures.filter((s) => s.owner === P && s.type === 'windtrap').reduce((a, s) => a + Math.round((100 * s.health) / s.maxHealth), 0);
  check('windtrap power ~ health', house.producedPower === expectedPower, `${house.producedPower}/${expectedPower}`);
  // ---------------- starport
  const sp = g.structures.find((s) => s.owner === P && s.type === 'starport');
  if (sp) {
    for (const id of ['tank', 'trike', 'quad']) if (house.choam.has(id)) house.choam.items.get(id).num = 5;
    sp.updateBuildList();
    const before = g.units.filter((u) => u.owner === P && u.type === 'tank').length;
    const ok1 = sp.doProduceItem('tank', 2);
    const ok2 = sp.doPlaceOrder();
    let frigateSeen = false;
    for (let i = 0; i < 4000; i++) { g.update(); if (g.units.some((u) => u.type === 'frigate')) frigateSeen = true; }
    const after = g.units.filter((u) => u.owner === P && u.type === 'tank').length;
    check('starport order', ok1 && ok2 && frigateSeen && after === before + 2, `tanks ${before}->${after} frigate ${frigateSeen}`);
  }
  // ---------------- palace (Atreides => fremen)
  const pal = g.structures.find((s) => s.owner === P && s.type === 'palace');
  if (pal) {
    pal.specialTimer = 1;
    g.update();
    const before = g.units.filter((u) => u.owner === P && u.type === 'trooper').length;
    const ok = pal.doSpecialWeapon();
    const after = g.units.filter((u) => u.owner === P && u.type === 'trooper').length;
    check('palace fremen', ok && after > before, `troopers ${before}->${after}`);
  }
  // ---------------- carryall + harvester pickup
  const hf = g.structures.find((s) => s.owner === P && s.type === 'highTechFactory');
  if (hf) {
    hf.doProduceItem('carryall');
    ff(g, 3200);
    const ca = g.units.find((u) => u.owner === P && u.type === 'carryall' && u.owned !== false);
    check('carryall built', !!ca);
    const tank = g.placeUnit('tank', P, cy.x + 2, cy.y + 3, {});
    const dest = g.map.findNearest(cy.x + 22, cy.y - 14, 12, (x, y) => tank.canPass(x, y));
    tank.doMove2Pos(dest[0], dest[1], true);
    tank.requestCarryall();
    let picked = false;
    for (let i = 0; i < 3000; i++) { g.update(); if (ca && ca.cargo.includes(tank)) picked = true; }
    check('carryall transports tank', picked && tank.x === dest[0] && tank.y === dest[1], `tank at ${tank.x},${tank.y} dest ${dest}`);
  }
  // harvest totals
  ff(g, 6000);
  check('spice harvested', house.stats.spiceHarvested > 300, `harvested ${Math.round(house.stats.spiceHarvested)}`);
  // ---------------- death hand
  const g2 = mk(12);
  const H0 = 0;
  g2.houses[0].isHuman = false;
  const enemyCy = g2.structures.find((s) => s.owner === 1 && s.type === 'constructionYard');
  const hcy = g2.structures.find((s) => s.owner === H0 && s.type === 'constructionYard');
  const pal2 = g2.placeStructure(H0, 'palace', hcy.x + 3, hcy.y + 3, { byScenario: true }) || null;
  if (pal2) {
    pal2.specialTimer = 0;
    const hp0 = enemyCy.health;
    pal2.doLaunchDeathHand(enemyCy.x, enemyCy.y);
    ff(g2, 300);
    check('death hand hits', enemyCy.health < hp0 || !enemyCy.alive, `cy hp ${hp0} -> ${Math.round(enemyCy.health)} alive ${enemyCy.alive}`);
  } else check('death hand palace placed', false);
  // ---------------- worm
  const g3 = mk(13);
  const map = g3.map;
  let wormSpot = null;
  for (let y = 5; y < map.height - 5 && !wormSpot; y++) for (let x = 5; x < map.width - 5 && !wormSpot; x++) {
    let ok = true;
    for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 3; i++) if (!map.isSand(x + i, y + j) || map.ground[map.idx(x + i, y + j)]) { ok = false; break; }
    if (ok) wormSpot = [x, y];
  }
  if (wormSpot) {
    const w = g3.placeUnit('sandworm', 3, wormSpot[0], wormSpot[1], { mode: MODE.AMBUSH });
    const victim = g3.placeUnit('trike', 1, wormSpot[0] + 2, wormSpot[1], { mode: MODE.GUARD });
    victim.doMove2Pos(wormSpot[0] - 3, wormSpot[1], true);
    let eaten = false;
    for (let i = 0; i < 2000 && !eaten; i++) { g3.update(); if (!victim.alive) eaten = true; }
    check('worm eats trike', eaten, w ? `worm kills ${w.kills}` : 'no worm');
  } else check('worm spot', false);
  // ---------------- capture
  const g4 = mk(14);
  const ecy = g4.structures.find((s) => s.owner === 0 && s.type === 'constructionYard');
  ecy.health = ecy.maxHealth * 0.2;
  const inf = g4.placeUnit('soldier', 1, ecy.x - 2, ecy.y, { mode: MODE.GUARD });
  inf.doCaptureStructure(ecy);
  ff(g4, 2500);
  check('capture structure', ecy.owner === 1, `owner ${ecy.owner}`);
} catch (e) { console.error(e); } finally {
  console.log(results.join('\n'));
  await server.close();
}
