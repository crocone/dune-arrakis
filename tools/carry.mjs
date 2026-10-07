import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateSkirmishMap } = await server.ssrLoadModule('/src/game/missionGen.js');
  const { createGameFromIni } = await server.ssrLoadModule('/src/game/scenario.js');
  const sk = generateSkirmishMap({ seed: 11, players: [{ house: 1 }, { house: 0 }], startCredits: 20000, worms: 0 });
  const g = createGameFromIni(sk.ini, { player: 1, campaign: false, seed: 3, teams: { 1: 1, 0: 2 } });
  g.houses[0].ai = null;
  const P = 1;
  const cy = g.structures.find((s) => s.owner === P && s.type === 'constructionYard');
  const ca = g.placeUnit('carryall', P, cy.x, cy.y, {});
  const tank = g.placeUnit('tank', P, cy.x + 2, cy.y + 3, {});
  const dest = g.map.findNearest(cy.x + 20, cy.y - 15, 10, (x, y) => tank.canPass(x, y));
  tank.doMove2Pos(dest[0], dest[1], true);
  tank.requestCarryall();
  let carried = false;
  for (let i = 0; i < 3000; i++) {
    g.update();
    if (ca.cargo.includes(tank)) carried = true;
    if (i % 250 === 0) console.log(i, `tank ${tank.x},${tank.y} hidden${+tank.hidden} await${+tank.awaitingPickup} mode=${tank.attackMode} | ca ${ca.x},${ca.y} tgt=${ca.target ? (ca.target.type + '#' + ca.target.id) : '-'} cargo${ca.cargo.length} spd${ca.currentMaxSpeed.toFixed(1)} dest=${ca.destination?.x},${ca.destination?.y}`);
  }
  console.log('carried', carried, 'tank at', tank.x, tank.y, 'dest', dest, 'dist', Math.hypot(tank.x - dest[0], tank.y - dest[1]).toFixed(1));
} catch (e) { console.error(e); } finally { await server.close(); }
