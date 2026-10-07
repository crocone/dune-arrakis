// Renders the voice-over script (src/data/voice.js) with the ElevenLabs text-to-speech API.
//
//   node tools/voice-gen.mjs            generate missing / changed lines
//   node tools/voice-gen.mjs --dry      only print what would be generated and the character count
//   node tools/voice-gen.mjs --only mentat/cyril   restrict to ids with this prefix
//   node tools/voice-gen.mjs --force    regenerate everything that matches the filter
//
// The API key is read from ELEVENLABS_API_KEY (environment or .env.local).
// Output: public/voice/<id>.mp3 and public/voice/manifest.json ({ id: { d: seconds, h: textHash } }).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildVoiceScript, VOICE_CAST } from '../src/data/voice.js';
import { fetch } from './net.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'voice');
const MODEL = arg('--model') || 'eleven_multilingual_v2';
const CONCURRENCY = Number(arg('--jobs') || 3);
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const ONLY = arg('--only');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

export function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^ELEVENLABS_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

// Post-processing with ffmpeg when available: trim silence, even out loudness between
// voices, mono 64 kbps. Returns the clip duration in seconds, or null without ffmpeg.
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;
const FILTER = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11';

function postProcess(file) {
  if (!HAS_FFMPEG) return null;
  const tmp = file + '.tmp.mp3';
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-af', FILTER, '-ac', '1', '-ar', '44100', '-b:a', '64k', tmp]);
  if (r.status !== 0) {
    console.warn('ffmpeg failed for ' + file + ': ' + r.stderr);
    return null;
  }
  fs.renameSync(tmp, file);
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = parseFloat(String(p.stdout));
  return Number.isFinite(d) ? d : null;
}

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
// rough duration of a CBR 128 kbps MP3
const mp3Seconds = (bytes) => (bytes * 8) / 128000;

async function tts(key, line, seed) {
  const c = VOICE_CAST[line.role];
  if (!c) throw new Error('No cast for role ' + line.role);
  const body = {
    text: line.text,
    model_id: MODEL,
    seed,
    voice_settings: { stability: c.stability, similarity_boost: c.similarity, style: c.style, use_speaker_boost: true, speed: c.speed },
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, cost: Number(r.headers.get('character-cost') || 0) };
  }
  throw new Error('Too many retries');
}

async function main() {
  const script = buildVoiceScript().filter((l) => !ONLY || l.id.startsWith(ONLY));
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const todo = script.filter((l) => {
    const file = path.join(OUT, l.id + '.mp3');
    return FORCE || !fs.existsSync(file) || manifest[l.id]?.h !== hash(l.text + '|' + l.role + '|' + MODEL);
  });
  // clips generated before post-processing was available
  if (!DRY && HAS_FFMPEG) {
    let n = 0;
    for (const l of script) {
      const file = path.join(OUT, l.id + '.mp3');
      if (!manifest[l.id] || manifest[l.id].p || !fs.existsSync(file) || todo.includes(l)) continue;
      const pd = postProcess(file);
      if (pd) {
        manifest[l.id].d = Math.round(pd * 100) / 100;
        manifest[l.id].p = 1;
        n++;
      }
    }
    if (n) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));
      console.log(`Post-processed ${n} existing clips.`);
    }
  }
  const chars = todo.reduce((s, l) => s + l.text.length, 0);
  console.log(`${script.length} lines in script, ${todo.length} to generate, ${chars} characters (model ${MODEL}).`);
  if (DRY) {
    const byRole = {};
    for (const l of todo) byRole[l.role] = (byRole[l.role] || 0) + l.text.length;
    console.table(byRole);
    return;
  }
  const key = loadKey();
  if (!key) {
    console.error('ELEVENLABS_API_KEY is not set (environment or .env.local).');
    process.exit(1);
  }
  let done = 0;
  let cost = 0;
  const warnings = [];
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const line = queue.shift();
      const file = path.join(OUT, line.id + '.mp3');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      let seed = 1000 + (parseInt(hash(line.id), 16) % 100000);
      let res;
      let secs;
      // speech should run at roughly 8-25 characters per second; outside that range the
      // take is probably truncated or garbled, so try another seed once
      for (let take = 0; take < 2; take++) {
        res = await tts(key, line, seed);
        cost += res.cost;
        secs = mp3Seconds(res.buf.length);
        const cps = line.text.length / secs;
        if (cps > 7 && cps < 26) break;
        if (take === 0) warnings.push(`${line.id}: ${cps.toFixed(1)} chars/s, regenerating`);
        else warnings.push(`${line.id}: still ${cps.toFixed(1)} chars/s, kept`);
        seed += 7919;
      }
      fs.writeFileSync(file, res.buf);
      const pd = postProcess(file);
      manifest[line.id] = { d: Math.round((pd ?? secs) * 100) / 100, h: hash(line.text + '|' + line.role + '|' + MODEL), ...(pd ? { p: 1 } : {}) };
      done++;
      if (done % 10 === 0 || done === todo.length) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));
        console.log(`  ${done}/${todo.length}  (credits used so far: ${cost})`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length || 1) }, worker));
  // drop manifest entries for lines that no longer exist
  const ids = new Set(buildVoiceScript().map((l) => l.id));
  for (const id of Object.keys(manifest)) if (!ids.has(id)) delete manifest[id];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));
  for (const w of warnings) console.warn('warning: ' + w);
  console.log(`Done: ${done} clips, ${cost} credits.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
