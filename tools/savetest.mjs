import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateCampaignMission } = await server.ssrLoadModule('/src/game/missionGen.js');
  const { createGameFromIni } = await server.ssrLoadModule('/src/game/scenario.js');
  const { serializeGame, deserializeGame } = await server.ssrLoadModule('/src/game/saveload.js');
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  const m = generateCampaignMission(1, 6, 1);
  const g = createGameFromIni(m.ini, { player: 1, campaign: true, techLevel: m.techLevel, seed: 9 });
  for (let i = 0; i < 20000; i++) g.update();
  const data = serializeGame(g);
  const json = JSON.stringify(data);
  console.log('save size', (json.length / 1024).toFixed(0), 'KB');
  const g2 = deserializeGame(JSON.parse(json));
  const sig = (x) => x.houses.filter(Boolean).map((h) => `${h.nameEn}:${h.numStructures}s/${h.numUnits}u/${Math.round(h.credits)}c`).join(' ') + ' objs ' + x.objects.size;
  console.log('orig ', sig(g));
  console.log('loaded', sig(g2));
  // continue both and compare (determinism is not guaranteed because bullets are dropped, but both must run)
  for (let i = 0; i < 8000; i++) { g.update(); g2.update(); }
  console.log('orig +8000 ', sig(g));
  console.log('loaded+8000', sig(g2));
} catch (e) { console.error(e); } finally { await server.close(); }
