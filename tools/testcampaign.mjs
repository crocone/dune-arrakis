import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateCampaignMission, generateSkirmishMap } = await server.ssrLoadModule('/src/game/missionGen.js');
  const { createGameFromIni } = await server.ssrLoadModule('/src/game/scenario.js');
  const cycles = parseInt(process.argv[2] || '3000', 10);
  for (const house of [1, 0, 2]) {
    for (let level = 1; level <= 9; level++) {
      const variant = level % 3;
      const t0 = performance.now();
      const m = generateCampaignMission(house, level, variant);
      const tGen = performance.now() - t0;
      const g = createGameFromIni(m.ini, { player: house, campaign: true, techLevel: m.techLevel, seed: 7 });
      const info = g.houses.filter(Boolean).map((h) => `${h.nameEn[0]}:${h.numStructures}s/${h.numUnits}u/${h.credits}c`).join(' ');
      const t1 = performance.now();
      for (let i = 0; i < cycles && !g.over; i++) g.update();
      const tRun = performance.now() - t1;
      const after = g.houses.filter(Boolean).map((h) => `${h.nameEn[0]}:${h.numStructures}s/${h.numUnits}u/${Math.round(h.credits)}c`).join(' ');
      console.log(`H${house} L${level} ${g.map.width}x${g.map.height} gen ${tGen.toFixed(0)}ms run ${(tRun / g.cycle).toFixed(3)}ms/c | ${info} -> ${after}${g.over ? ' OVER ' + JSON.stringify(g.over) : ''}`);
    }
  }
  const sk = generateSkirmishMap({ seed: 5, players: [{ house: 1 }, { house: 0 }, { house: 2 }], startCredits: 3000 });
  const g = createGameFromIni(sk.ini, { player: 1, campaign: false, seed: 3, teams: { 1: 1, 0: 2, 2: 3 } });
  for (let i = 0; i < 20000 && !g.over; i++) g.update();
  console.log('skirmish', g.cycle, g.houses.filter(Boolean).map((h) => `${h.nameEn}:${h.numStructures}s/${h.numUnits}u/${Math.round(h.credits)}c harv ${Math.round(h.stats.spiceHarvested)}`).join(' | '));
} catch (e) { console.error(e); } finally { await server.close(); }
