// Loudness analysis for the tracks in public/music (needs ffmpeg).
// For every file it measures integrated loudness (EBU R128) and where trailing silence starts,
// and caches the result in public/music/levels.json. The game uses `gain` to play all tracks at the
// same loudness and `end` to crossfade into the next track before the silence.
//
//   node tools/music-levels.mjs        (also run automatically by the Vite dev server and build)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TARGET_LUFS = -14;
const AUDIO = /\.(mp3|ogg|m4a|wav|flac)$/i;

let ffmpeg = null;
const hasFfmpeg = () => (ffmpeg ??= spawnSync('ffmpeg', ['-version']).status === 0);

function analyse(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet,silencedetect=n=-50dB:d=0.6', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = r.stderr || '';
  const dur = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null;
  const lufs = [...out.matchAll(/^\s+I:\s+(-?[\d.]+) LUFS/gm)].pop();
  // trailing silence: the last silence_start with no matching silence_end, or one ending at the file end
  let end = null;
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const lastStart = starts.at(-1);
  if (lastStart !== undefined && (ends.length < starts.length || (duration && duration - ends.at(-1) < 0.3))) end = lastStart;
  const I = lufs ? Number(lufs[1]) : null;
  return {
    lufs: I,
    gain: I === null ? 0 : Math.max(-12, Math.min(6, Math.round((TARGET_LUFS - I) * 10) / 10)),
    duration: duration && Math.round(duration * 100) / 100,
    end: end && Math.round(end * 100) / 100,
  };
}

// Returns [{ file, gain, end }] for the audio files in `dir`, analysing new or changed files.
export function musicLevels(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => AUDIO.test(f)).sort();
  const cachePath = path.join(dir, 'levels.json');
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (e) {
    /* no cache yet */
  }
  let changed = false;
  const result = files.map((file) => {
    // content hash, so the committed cache stays valid after a git checkout (CI needs no ffmpeg)
    const sig = crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, file))).digest('hex').slice(0, 16);
    if (cache[file]?.sig !== sig && hasFfmpeg()) {
      cache[file] = { sig, ...analyse(path.join(dir, file)) };
      changed = true;
    }
    const c = cache[file] || {};
    return { file, gain: c.gain ?? 0, end: c.end ?? null };
  });
  for (const f of Object.keys(cache)) if (!files.includes(f)) (delete cache[f], (changed = true));
  if (changed) fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'music');
  musicLevels(dir);
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'levels.json'), 'utf8'));
  console.table(Object.fromEntries(Object.entries(cache).map(([f, c]) => [f, { LUFS: c.lufs, gainDb: c.gain, seconds: c.duration, silenceFrom: c.end }])));
}
