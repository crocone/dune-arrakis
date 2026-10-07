// Audio: sampled sound effects, voice-over and music, with procedural fallbacks.
// - Sound effects: ElevenLabs-generated samples from public/sfx (see tools/sfx-gen.mjs);
//   any missing effect is synthesized with WebAudio.
// - Voice: ElevenLabs-generated clips from public/voice (see tools/voice-gen.mjs and
//   src/data/voice.js). Announcements fall back to the browser's speech synthesis.
// - Music: audio files dropped into public/music (menu*, ambient*, battle*, victory*, defeat*);
//   without them a generative ambient score is played.
import { ANNOUNCER_LINES, UNIT_LINES, announcerId, unitSet } from '../data/voice.js';

// relative loudness of sampled effects after peak normalisation
const SFX_LEVEL = {
  mg: 0.45, gun: 0.4, cannon: 0.7, heavyCannon: 0.8, rocket: 0.55, sonic: 0.75, gas: 0.5,
  explSmall: 0.6, explMed: 0.8, explLarge: 1.0, deathHand: 1.0, crush: 0.5, worm: 0.95, bloom: 0.8,
  place: 0.6, infantryDie: 0.45, click: 0.35, select: 0.35, ack: 0.4, error: 0.45, complete: 0.55, radarOn: 0.55,
};
const UI_SFX = new Set(['click', 'select', 'ack', 'error', 'complete', 'radarOn']);

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volumes = { master: 0.8, sfx: 0.8, music: 0.45, voice: 0.9 };
    this.listener = { x: 0, z: 0, dist: 20 };
    this.lastPlayed = new Map();
    this.lastVoice = new Map();
    this.music = null; // generative music state
    this.track = null; // streamed music track
    this.musicMood = 'menu';
    this.musicFiles = null;
    this.buffers = new Map(); // url -> Promise<AudioBuffer|null>
    this.sfx = {}; // name -> [{ buffer, norm }]
    this.sfxManifest = null;
    this.voiceManifest = null;
    this.announceQueue = [];
    this.announcing = null;
    this.bark = null;
    this.lastBarkIndex = new Map();
    this.dialogueNode = null;
    this.dialogueToken = 0;
    this.enVoice = null;
    if (typeof speechSynthesis !== 'undefined') {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices();
        this.enVoice = voices.find((v) => /^en(-|_)(GB|US)/i.test(v.lang || '')) || voices.find((v) => /^en/i.test(v.lang || '')) || null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
    this.manifestsReady = Promise.all([
      this._json('voice/manifest.json').then((m) => (this.voiceManifest = m || {})),
      this._json('sfx/manifest.json').then((m) => (this.sfxManifest = m || {})),
      this._json('music/index.json').then((m) => (this.musicFiles = (Array.isArray(m) ? m : []).map((e) => (typeof e === 'string' ? { file: e } : e)))),
    ]);
  }

  async _json(url) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volumes.master;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.volumes.music;
    this.musicDuck = this.ctx.createGain();
    this.musicGain.connect(this.musicDuck).connect(this.master);
    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.value = this.volumes.voice;
    this.voiceGain.connect(this.master);
    // radio filter for unit acknowledgements
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 320;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
    }
    shaper.curve = curve;
    this.radio = hp;
    hp.connect(lp).connect(shaper).connect(this.voiceGain);
    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // reverb impulse
    this.reverb = this.ctx.createConvolver();
    const irLen = this.ctx.sampleRate * 1.6;
    const ir = this.ctx.createBuffer(2, irLen, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
    }
    this.reverb.buffer = ir;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.18;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.manifestsReady.then(() => this._loadSfx());
  }

  setVolume(kind, v) {
    this.volumes[kind] = v;
    if (!this.ctx) return;
    if (kind === 'master') this.master.gain.value = v;
    if (kind === 'sfx') this.sfxGain.gain.value = v;
    if (kind === 'music') this.musicGain.gain.value = v;
    if (kind === 'voice') this.voiceGain.gain.value = v;
  }

  setListener(x, z, dist) {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.dist = dist;
  }

  // --- sample loading --------------------------------------------------------
  _buffer(url) {
    if (!this.ctx) return Promise.resolve(null);
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((ab) => (ab ? this.ctx.decodeAudioData(ab) : null))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  async _loadSfx() {
    const m = this.sfxManifest || {};
    await Promise.all(Object.entries(m).map(async ([name, info]) => {
      const list = [];
      for (let i = 1; i <= info.n; i++) {
        const buffer = await this._buffer(`sfx/${name}_${i}.mp3`);
        if (!buffer) continue;
        let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const ch = buffer.getChannelData(c);
          for (let k = 0; k < ch.length; k += 4) peak = Math.max(peak, Math.abs(ch[k]));
        }
        list.push({ buffer, norm: peak > 0.01 ? 0.9 / peak : 1 });
      }
      if (list.length) this.sfx[name] = list;
    }));
    if (this.ambiencePending) this.startAmbience();
  }

  // returns [gain, pan] for a world position, or null if inaudible
  _spatial(pos) {
    if (!pos) return [1, 0];
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const range = 14 + this.listener.dist * 0.9;
    if (d > range * 1.6) return null;
    const g = Math.max(0, 1 - d / (range * 1.6));
    return [g * g * (1.2 - Math.min(0.6, this.listener.dist / 100)), Math.max(-1, Math.min(1, dx / range))];
  }

  _out(gain, pan, rev = 0.3) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let node = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(this.sfxGain);
    if (rev > 0) {
      const rg = this.ctx.createGain();
      rg.gain.value = rev;
      node.connect(rg).connect(this.reverb);
    }
    return g;
  }

  _noise(dest, t0, dur, type, f0, f1, q = 1, g0 = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(g0, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  _tone(dest, t0, dur, type, f0, f1, g0 = 1, attack = 0.005) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(g0, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // Play named effect at world position {x,z} (or null for UI)
  play(name, pos = null, opts = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const minGap = { gun: 0.05, mg: 0.04, cannon: 0.06, rocket: 0.06, explSmall: 0.05, explMed: 0.06, explLarge: 0.08 }[name] ?? 0.03;
    const last = this.lastPlayed.get(name) || 0;
    if (now - last < minGap) return;
    const sp = this._spatial(pos);
    if (!sp) return;
    if (sp[0] < 0.02) return;
    this.lastPlayed.set(name, now);
    const t = now + 0.005;
    const samples = this.sfx[name];
    if (samples) {
      const s = samples[Math.floor(Math.random() * samples.length)];
      const ui = UI_SFX.has(name);
      const out = this._out(sp[0] * (opts.volume ?? 1) * s.norm * (SFX_LEVEL[name] ?? 0.6), sp[1], ui ? 0 : (opts.reverb ?? 0.2));
      const src = this.ctx.createBufferSource();
      src.buffer = s.buffer;
      if (!ui) src.playbackRate.value = 0.93 + Math.random() * 0.14;
      src.connect(out);
      src.start(t);
      return;
    }
    const out = this._out(sp[0] * (opts.volume ?? 1), sp[1], opts.reverb ?? 0.3);
    switch (name) {
      case 'mg':
        for (let i = 0; i < 3; i++) this._noise(out, t + i * 0.07, 0.06, 'bandpass', 2400, 900, 1.2, 0.6);
        break;
      case 'gun':
        this._noise(out, t, 0.12, 'bandpass', 1800, 500, 1, 0.8);
        this._tone(out, t, 0.08, 'square', 300, 90, 0.15);
        break;
      case 'cannon':
        this._noise(out, t, 0.35, 'lowpass', 2200, 180, 0.8, 1);
        this._tone(out, t, 0.3, 'sine', 120, 40, 0.9);
        break;
      case 'heavyCannon':
        this._noise(out, t, 0.5, 'lowpass', 1800, 120, 0.8, 1);
        this._tone(out, t, 0.45, 'sine', 90, 30, 1);
        break;
      case 'rocket':
        this._noise(out, t, 0.6, 'bandpass', 600, 3200, 2, 0.6);
        this._noise(out, t, 0.25, 'lowpass', 1200, 200, 1, 0.5);
        break;
      case 'sonic': {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(70, t);
        o.frequency.linearRampToValueAtTime(140, t + 0.9);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 28;
        const lg = this.ctx.createGain();
        lg.gain.value = 0.4;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        lfo.connect(lg).connect(g.gain);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        o.connect(f).connect(g).connect(out);
        o.start(t); lfo.start(t);
        o.stop(t + 1.05); lfo.stop(t + 1.05);
        break;
      }
      case 'gas':
        this._noise(out, t, 0.9, 'highpass', 3000, 1200, 0.7, 0.4);
        break;
      case 'explSmall':
        this._noise(out, t, 0.4, 'lowpass', 2500, 200, 0.7, 0.8);
        this._tone(out, t, 0.25, 'sine', 160, 50, 0.5);
        break;
      case 'explMed':
        this._noise(out, t, 0.9, 'lowpass', 2000, 100, 0.7, 1);
        this._tone(out, t, 0.6, 'sine', 110, 30, 1);
        break;
      case 'explLarge':
        this._noise(out, t, 1.6, 'lowpass', 1600, 60, 0.7, 1);
        this._tone(out, t, 1.2, 'sine', 80, 22, 1.2);
        this._noise(out, t + 0.15, 1.2, 'bandpass', 800, 150, 0.6, 0.5);
        break;
      case 'deathHand':
        this._noise(out, t, 3.5, 'lowpass', 1400, 40, 0.7, 1.4);
        this._tone(out, t, 3, 'sine', 60, 18, 1.6, 0.05);
        break;
      case 'crush':
        this._noise(out, t, 0.15, 'bandpass', 900, 300, 2, 0.6);
        break;
      case 'worm':
        this._noise(out, t, 2.5, 'lowpass', 300, 60, 1, 1.2);
        this._tone(out, t, 2.2, 'sawtooth', 45, 28, 0.5, 0.3);
        break;
      case 'bloom':
        this._noise(out, t, 1.2, 'lowpass', 900, 80, 0.8, 1);
        break;
      case 'place':
        this._tone(out, t, 0.15, 'square', 180, 120, 0.3);
        this._noise(out, t, 0.25, 'bandpass', 700, 300, 2, 0.5);
        break;
      case 'click':
        this._tone(out, t, 0.06, 'triangle', 1200, 900, 0.25);
        break;
      case 'select':
        this._tone(out, t, 0.08, 'sine', 900, 1300, 0.2);
        break;
      case 'ack':
        this._tone(out, t, 0.07, 'square', 520, 660, 0.12);
        this._tone(out, t + 0.07, 0.07, 'square', 660, 780, 0.12);
        break;
      case 'error':
        this._tone(out, t, 0.18, 'square', 160, 140, 0.25);
        break;
      case 'complete':
        this._tone(out, t, 0.25, 'sine', 660, 660, 0.3);
        this._tone(out, t + 0.12, 0.35, 'sine', 990, 990, 0.3);
        break;
      case 'money':
        this._tone(out, t, 0.05, 'triangle', 1500, 1500, 0.08);
        break;
      case 'radarOn':
        this._tone(out, t, 0.6, 'sine', 300, 1200, 0.25, 0.05);
        break;
      case 'harvest':
        this._noise(out, t, 0.3, 'bandpass', 500, 400, 3, 0.2);
        break;
      default:
        this._tone(out, t, 0.1, 'sine', 440, 440, 0.2);
    }
  }

  // looping desert wind under the battlefield
  startAmbience() {
    this.ambiencePending = true;
    if (!this.ctx || this.ambience) return;
    const s = this.sfx.wind?.[0];
    if (!s) return;
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.16 * s.norm, this.ctx.currentTime + 3);
    src.connect(g).connect(this.sfxGain);
    src.start();
    this.ambience = { src, g };
  }

  stopAmbience() {
    this.ambiencePending = false;
    if (!this.ambience) return;
    const { src, g } = this.ambience;
    this.ambience = null;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    src.stop(t + 1.3);
  }

  // --- voice -------------------------------------------------------------------
  hasVoice(id) {
    return !!(id && this.voiceManifest && this.voiceManifest[id]);
  }

  _voiceSource(buffer, radio = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(radio ? this.radio : this.voiceGain);
    return src;
  }

  // Base computer announcement for the player's house; `line` is a key of ANNOUNCER_LINES.
  announce(house, line, { text = null, key = line, cooldown = 3 } = {}) {
    if (!this.enabled || this.volumes.voice <= 0) return;
    const now = performance.now() / 1000;
    if (now - (this.lastVoice.get(key) ?? -99) < cooldown) return;
    this.lastVoice.set(key, now);
    const id = announcerId(house, line);
    if (this.ctx && this.hasVoice(id)) {
      if (this.announceQueue.length >= 3) this.announceQueue.shift();
      this.announceQueue.push({ id, t: now });
      this._nextAnnouncement();
      return;
    }
    this._speak(ANNOUNCER_LINES[line] || text);
  }

  async _nextAnnouncement() {
    if (this.announcing || !this.announceQueue.length || !this.ctx) return;
    const item = this.announceQueue.shift();
    if (performance.now() / 1000 - item.t > 6) return this._nextAnnouncement();
    this.announcing = item;
    const buffer = await this._buffer(`voice/${item.id}.mp3`);
    if (!buffer) {
      this.announcing = null;
      return this._nextAnnouncement();
    }
    const src = this._voiceSource(buffer);
    src.onended = () => {
      this.announcing = null;
      this._nextAnnouncement();
    };
    src.start();
  }

  _speak(text) {
    if (!text || typeof speechSynthesis === 'undefined') return;
    if (speechSynthesis.speaking && speechSynthesis.pending) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.enVoice?.lang || 'en-US';
    if (this.enVoice) u.voice = this.enVoice;
    u.rate = 1.05;
    u.pitch = 0.85;
    u.volume = this.volumes.voice * this.volumes.master;
    speechSynthesis.speak(u);
  }

  // Unit acknowledgement over the radio: kind = select | move | attack | harvest
  async unitBark(house, kind) {
    if (!this.enabled || !this.ctx || this.volumes.voice <= 0) return;
    const set = unitSet(house);
    const lines = UNIT_LINES[set]?.[kind] || UNIT_LINES[set]?.move;
    if (!lines) return;
    const now = this.ctx.currentTime;
    if (this.bark && now - this.bark.t < 0.45) return;
    let i = Math.floor(Math.random() * lines.length);
    const lastKey = set + kind;
    if (lines.length > 1 && i === this.lastBarkIndex.get(lastKey)) i = (i + 1) % lines.length;
    this.lastBarkIndex.set(lastKey, i);
    const id = `unit/${set}/${kind}_${i + 1}`;
    if (!this.hasVoice(id)) return;
    const token = {};
    this.bark = { t: now, token, src: null };
    const buffer = await this._buffer(`voice/${id}.mp3`);
    if (!buffer || this.bark?.token !== token) return;
    if (this.bark.src) try { this.bark.src.stop(); } catch (e) { /* ignore */ }
    const src = this._voiceSource(buffer, true);
    this.bark.src = src;
    src.start();
  }

  // Long-form speech (briefings, story screens). Ducks the music; a new line replaces the old.
  async dialogue(id) {
    this.stopDialogue();
    if (!this.enabled || !this.ctx || this.volumes.voice <= 0 || !this.hasVoice(id)) return;
    const token = ++this.dialogueToken;
    const buffer = await this._buffer(`voice/${id}.mp3`);
    if (!buffer || token !== this.dialogueToken) return;
    const src = this._voiceSource(buffer);
    this.dialogueNode = src;
    this._duck(true);
    src.onended = () => {
      if (this.dialogueNode === src) {
        this.dialogueNode = null;
        this._duck(false);
      }
    };
    src.start(this.ctx.currentTime + 0.15);
  }

  stopDialogue() {
    this.dialogueToken++;
    if (this.dialogueNode) {
      try { this.dialogueNode.stop(); } catch (e) { /* ignore */ }
      this.dialogueNode = null;
      this._duck(false);
    }
  }

  _duck(on) {
    if (!this.ctx) return;
    const g = this.musicDuck.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? 0.35 : 1, t + (on ? 0.4 : 1.2));
  }

  // --- music -------------------------------------------------------------------
  // mood: menu | calm | battle | victory | defeat
  startMusic(mood = 'calm') {
    this.musicMood = mood;
    if (!this.ctx) return;
    if (this.musicFiles === null) {
      this.manifestsReady.then(() => this.musicMood === mood && this.startMusic(mood));
      return;
    }
    const tracks = this._tracksFor(mood);
    if (tracks.length) {
      this._stopGenerative();
      if (this.track && this.track.mood === mood) return;
      this._playTrack(mood, tracks);
    } else {
      this._stopTrack();
      if (this.music) this.music.mood = mood;
      else this._startGenerative(mood);
    }
  }

  setMusicMood(mood) {
    if (mood === this.musicMood) return;
    if (this.track || (this.musicFiles && this._tracksFor(mood).length)) this.startMusic(mood);
    else {
      this.musicMood = mood;
      if (this.music) this.music.mood = mood;
    }
  }

  stopMusic() {
    this._stopTrack();
    this._stopGenerative();
  }

  _tracksFor(mood) {
    const files = this.musicFiles || [];
    const pick = (prefix) => files.filter((e) => e.file.toLowerCase().startsWith(prefix));
    const order = {
      menu: ['menu', 'ambient'],
      calm: ['ambient', 'menu'],
      battle: ['battle', 'ambient'],
      victory: ['victory', 'menu'],
      defeat: ['defeat', 'menu'],
    }[mood] || ['ambient'];
    for (const p of order) {
      const l = pick(p);
      if (l.length) return l;
    }
    return [];
  }

  // tracks: [{ file, gain (dB, loudness correction), end (s, where trailing silence starts) }]
  _playTrack(mood, tracks) {
    const XFADE = 3;
    const prev = this.track;
    let entry = tracks[Math.floor(Math.random() * tracks.length)];
    if (prev && tracks.length > 1 && entry.file === prev.file) entry = tracks[(tracks.indexOf(entry) + 1) % tracks.length];
    const el = new Audio(`music/${encodeURIComponent(entry.file)}`);
    el.preload = 'auto';
    const src = this.ctx.createMediaElementSource(el);
    const g = this.ctx.createGain();
    const level = Math.pow(10, (entry.gain || 0) / 20);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 2.5);
    src.connect(g).connect(this.musicGain);
    const track = { el, g, mood, file: entry.file, handedOff: false };
    const once = mood === 'victory' || mood === 'defeat';
    // crossfade into the next track before the end (and before any trailing silence)
    el.addEventListener('timeupdate', () => {
      if (track.handedOff || this.track !== track || !el.duration) return;
      const endAt = Math.min(el.duration, entry.end || el.duration);
      if (el.currentTime < endAt - XFADE) return;
      track.handedOff = true;
      if (once) {
        this.track = null;
        this._release(track, Math.max(0.5, endAt - el.currentTime));
      } else this._playTrack(mood, this._tracksFor(mood));
    });
    el.addEventListener('ended', () => {
      if (this.track !== track) return;
      this.track = null;
      this._release(track, 0);
      if (!once) this._playTrack(mood, this._tracksFor(mood));
    });
    el.play().catch(() => {});
    this.track = track;
    if (prev) this._release(prev, 2.5);
  }

  _release(track, fade) {
    const t = this.ctx.currentTime;
    track.g.gain.cancelScheduledValues(t);
    track.g.gain.setValueAtTime(track.g.gain.value, t);
    track.g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => {
      track.el.pause();
      track.el.removeAttribute('src');
      track.g.disconnect();
    }, fade * 1000 + 100);
  }

  _stopTrack() {
    if (!this.track) return;
    const tr = this.track;
    this.track = null;
    this._release(tr, 1.5);
  }

  // --- Generative ambient music --------------------------------------------
  _startGenerative(mood = 'calm') {
    if (!this.ctx) return;
    this._stopGenerative();
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    out.connect(this.musicGain);
    const rev = ctx.createGain();
    rev.gain.value = 0.6;
    out.connect(rev).connect(this.reverb);
    const state = { out, nodes: [], timer: null, mood, step: 0 };
    // D phrygian dominant flavour
    const base = 73.42; // D2
    const scale = [0, 1, 4, 5, 7, 8, 10, 12];
    const chordRoots = [0, 1, 0, -2];
    const makePad = (freq, detune) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'sawtooth';
      o1.frequency.value = freq;
      o2.frequency.value = freq;
      o2.detune.value = detune;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      f.Q.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lg = ctx.createGain();
      lg.gain.value = 250;
      lfo.connect(lg).connect(f.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.05;
      o1.connect(f);
      o2.connect(f);
      f.connect(g).connect(out);
      o1.start(); o2.start(); lfo.start();
      state.nodes.push(o1, o2, lfo);
      return { o1, o2, g };
    };
    const pads = [makePad(base, 7), makePad(base * 1.5, -6), makePad(base * 2, 4)];
    const tick = () => {
      if (!this.music || this.music !== state) return;
      const t = ctx.currentTime;
      const root = chordRoots[state.step % chordRoots.length];
      const r = base * Math.pow(2, root / 12);
      pads[0].o1.frequency.setTargetAtTime(r, t, 1.5);
      pads[0].o2.frequency.setTargetAtTime(r, t, 1.5);
      pads[1].o1.frequency.setTargetAtTime(r * Math.pow(2, 7 / 12), t, 1.5);
      pads[1].o2.frequency.setTargetAtTime(r * Math.pow(2, 7 / 12), t, 1.5);
      pads[2].o1.frequency.setTargetAtTime(r * 2 * Math.pow(2, (state.step % 2 ? 4 : 3) / 12), t, 1.5);
      pads[2].o2.frequency.setTargetAtTime(r * 2 * Math.pow(2, (state.step % 2 ? 4 : 3) / 12), t, 1.5);
      // sparse plucked melody
      const notes = state.mood === 'battle' ? 8 : 4;
      for (let i = 0; i < notes; i++) {
        if (Math.random() < 0.55) {
          const deg = scale[Math.floor(Math.random() * scale.length)];
          const f = base * 4 * Math.pow(2, (deg + root) / 12);
          const tt = t + i * (state.mood === 'battle' ? 0.5 : 1.0) + Math.random() * 0.05;
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, tt);
          g.gain.exponentialRampToValueAtTime(0.07, tt + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0005, tt + 1.4);
          o.connect(g).connect(out);
          o.start(tt);
          o.stop(tt + 1.5);
        }
      }
      // low drum pulse in battle mood
      if (state.mood === 'battle') {
        for (let i = 0; i < 8; i++) {
          if (i % 2 === 0 || Math.random() < 0.3) {
            const tt = t + i * 0.5;
            this._tone(out, tt, 0.35, 'sine', 70, 35, 0.35);
            this._noise(out, tt, 0.08, 'bandpass', 1500, 800, 2, 0.05);
          }
        }
      }
      state.step++;
    };
    this.music = state;
    tick();
    state.timer = setInterval(tick, 4000);
  }

  _stopGenerative() {
    if (!this.music) return;
    const st = this.music;
    this.music = null;
    clearInterval(st.timer);
    try {
      st.out.gain.cancelScheduledValues(this.ctx.currentTime);
      st.out.gain.setValueAtTime(st.out.gain.value, this.ctx.currentTime);
      st.out.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
    } catch (e) {
      /* ignore */
    }
    setTimeout(() => {
      for (const n of st.nodes) {
        try { n.stop(); } catch (e) { /* ignore */ }
      }
      st.out.disconnect();
    }, 1700);
  }
}

export const audio = new AudioManager();
