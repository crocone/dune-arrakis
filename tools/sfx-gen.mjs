// Renders sound effects with the ElevenLabs sound-generation API.
//
//   node tools/sfx-gen.mjs              generate missing effects
//   node tools/sfx-gen.mjs --only cannon
//   node tools/sfx-gen.mjs --force
//
// Output: public/sfx/<name>_<n>.mp3 and public/sfx/manifest.json ({ name: { n: variants, h: hash } }).
// The game falls back to its procedural WebAudio synthesis for any effect that is missing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadKey } from './voice-gen.mjs';
import { fetch } from './net.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'sfx');
const FORCE = process.argv.includes('--force');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1] : null;
})();

// name: [prompt, seconds, variants, promptInfluence, loop]
export const SFX = {
  mg: ['Short burst of heavy machine gun fire, three quick shots, dry outdoor desert battlefield, no music', 0.6, 2, 0.6],
  gun: ['Single sci-fi infantry rifle shot, sharp crack, dry outdoor, no music', 0.5, 2, 0.6],
  cannon: ['Tank main cannon firing, deep punchy boom with a short metallic ring, outdoor, no music', 1.0, 3, 0.6],
  heavyCannon: ['Heavy siege tank twin cannon firing, massive low boom, outdoor, no music', 1.3, 2, 0.6],
  rocket: ['Rocket missile launch, fast ignition hiss and whoosh flying away, no music', 1.0, 2, 0.6],
  sonic: ['Sci-fi sonic wave cannon blast, warbling low frequency pulse rippling outward, no music', 1.5, 1, 0.5],
  gas: ['Toxic gas canister bursting open with a long pressurised hiss, no music', 1.2, 1, 0.6],
  explSmall: ['Small explosion on sand, short sharp blast with sand debris, no music', 0.8, 3, 0.6],
  explMed: ['Armoured vehicle explosion, fiery medium blast with scattering metal debris, no music', 1.5, 3, 0.6],
  explLarge: ['Large building explosion, huge deep blast followed by rumbling structural collapse and falling debris, no music', 3.0, 2, 0.5],
  deathHand: ['Colossal atomic missile detonation, deep sub-bass shockwave with a long rumbling roll-off, no music', 5.0, 1, 0.5],
  crush: ['Short heavy crunch of a tank track rolling over gravel and debris, no music', 0.5, 1, 0.6],
  worm: ['Gigantic sandworm bursting out of the desert, deep roaring rumble and cascading sand, no music', 3.5, 2, 0.5],
  bloom: ['Underground gas pocket erupting through desert sand, deep thump and a spray of sand, no music', 2.0, 1, 0.5],
  place: ['Heavy prefabricated building module slamming into place, metallic clank and hydraulic hiss, no music', 1.2, 1, 0.6],
  infantryDie: ['Short distant pained shout of a soldier falling in battle, no music', 0.8, 2, 0.5],
  click: ['Very short soft sci-fi interface click', 0.5, 1, 0.7],
  select: ['Very short bright sci-fi interface blip', 0.5, 1, 0.7],
  ack: ['Very short two-tone military radio chirp', 0.5, 1, 0.7],
  error: ['Very short low buzzer, access denied, sci-fi interface', 0.5, 1, 0.7],
  complete: ['Short pleasant two-note sci-fi chime, task complete notification', 1.0, 1, 0.6],
  radarOn: ['Sci-fi radar powering up, rising electronic sweep with a soft ping', 1.5, 1, 0.6],
  wind: ['Desert wind ambience, steady gusting wind blowing sand over dunes, no music, no voices', 20, 1, 0.4, true],
};

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

async function generate(key, prompt, seconds, influence, loop) {
  const body = { text: prompt, duration_seconds: seconds, prompt_influence: influence };
  if (loop) {
    body.loop = true;
    body.model_id = 'eleven_text_to_sound_v2';
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    if (!r.ok) {
      const t = await r.text();
      // older accounts may not have the looping model; retry without it
      if (loop && body.loop) {
        delete body.loop;
        delete body.model_id;
        continue;
      }
      throw new Error(`${r.status} ${t}`);
    }
    return { buf: Buffer.from(await r.arrayBuffer()), cost: Number(r.headers.get('character-cost') || 0) };
  }
  throw new Error('Too many retries');
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.error('ELEVENLABS_API_KEY is not set (environment or .env.local).');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const jobs = [];
  for (const [name, [prompt, secs, variants, infl, loop]] of Object.entries(SFX)) {
    if (ONLY && name !== ONLY) continue;
    const h = hash(prompt + secs + variants + infl);
    const have = manifest[name]?.h === h && [...Array(variants).keys()].every((i) => fs.existsSync(path.join(OUT, `${name}_${i + 1}.mp3`)));
    if (have && !FORCE) continue;
    for (let i = 0; i < variants; i++) jobs.push({ name, i, prompt, secs, infl, loop, h, variants });
  }
  console.log(`${jobs.length} sound effects to generate.`);
  let cost = 0;
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const j = queue.shift();
      const res = await generate(key, j.prompt, j.secs, j.infl, j.loop);
      cost += res.cost;
      fs.writeFileSync(path.join(OUT, `${j.name}_${j.i + 1}.mp3`), res.buf);
      manifest[j.name] = { n: j.variants, h: j.h, loop: !!j.loop };
      console.log(`  ${j.name}_${j.i + 1} (${(res.buf.length / 1024).toFixed(0)} KB)`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));
  console.log(`Done, ${cost} credits.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
