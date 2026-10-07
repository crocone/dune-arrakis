import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateCampaignMission } = await server.ssrLoadModule('/src/game/missionGen.js');
  const { createGameFromIni } = await server.ssrLoadModule('/src/game/scenario.js');
  const [house, level, minutes] = process.argv.slice(2).map(Number);
  const m = generateCampaignMission(house, level, 1);
  const g = createGameFromIni(m.ini, { player: house, campaign: true, techLevel: m.techLevel, seed: 9 });
  const P = house;
  const t0 = performance.now();
  for (let i = 0; i < minutes * 3750 && !g.over; i++) {
    g.update();
    if (i % 3750 === 0) {
      const ai = g.houses.filter((h) => h && h.ai).map((h) => `${h.nameEn}: act${+h.ai.active} trig${+h.ai.attackTriggered} ${h.numStructures}s/${h.numUnits}u cr${h.credits} built${h.stats.unitsBuilt}`).join(' | ');
      const p = g.houses[P];
      console.log(`min ${i / 3750}: player ${p.numStructures}s/${p.numUnits}u lost ${p.stats.unitsLost}/${p.stats.structuresLost} | ${ai}`);
    }
  }
  console.log('over', g.over, 'cycles', g.cycle, 'time', ((performance.now() - t0) / 1000).toFixed(1), 's');
} catch (e) { console.error(e); } finally { await server.close(); }
