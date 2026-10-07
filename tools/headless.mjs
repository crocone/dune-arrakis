// Headless simulation smoke test: node tools/headless.mjs <scenario.ini> [cycles] [playerHouse]
import { createServer } from 'vite';
import fs from 'node:fs';
const [file, cyclesArg, houseArg] = process.argv.slice(2);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { createGameFromIni } = await server.ssrLoadModule('/src/game/scenario.js');
  const text = fs.readFileSync(file, 'latin1');
  const player = houseArg ? parseInt(houseArg, 10) : 1;
  const game = createGameFromIni(text, { player, campaign: true, seed: 42 });
  console.log('map', game.map.width, game.map.height, 'units', game.units.length, 'structures', game.structures.length);
  for (const h of game.houses) if (h) console.log(' house', h.nameEn, 'team', h.team, 'credits', h.credits, 'units', h.numUnits, 'structs', h.numStructures, 'ai', !!h.ai);
  const cycles = parseInt(cyclesArg || '6000', 10);
  const t0 = performance.now();
  for (let i = 0; i < cycles; i++) {
    game.update();
    if (game.over) { console.log('game over at', game.cycle, game.over); break; }
  }
  const dt = performance.now() - t0;
  console.log(`ran ${game.cycle} cycles in ${dt.toFixed(0)} ms (${(dt / game.cycle).toFixed(3)} ms/cycle)`);
  for (const h of game.houses) if (h) console.log(' house', h.nameEn, 'credits', h.credits, 'units', h.numUnits, 'structs', h.numStructures, 'harvested', h.stats.spiceHarvested.toFixed(0), 'killed', h.stats.unitsKilled, h.stats.structuresKilled);
  const byType = {};
  for (const u of game.units) byType[u.owner + ':' + u.type] = (byType[u.owner + ':' + u.type] || 0) + 1;
  console.log(byType);
} catch (e) {
  console.error(e);
} finally {
  await server.close();
}
