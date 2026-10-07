import path from 'node:path';
import { defineConfig } from 'vite';
import { musicLevels } from './tools/music-levels.mjs';

// Serves / emits music/index.json: the audio files dropped into public/music, with a loudness
// correction and the start of trailing silence for each (see tools/music-levels.mjs).
// File names choose the mood: menu*, ambient*, battle*, victory*, defeat*.
function musicIndex() {
  const dir = path.resolve('public/music');
  const list = () => musicLevels(dir);
  return {
    name: 'music-index',
    configureServer(server) {
      server.middlewares.use('/music/index.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(list()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'music/index.json', source: JSON.stringify(list()) });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [musicIndex()],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
