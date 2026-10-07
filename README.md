# Dune: The Battle for Arrakis

A remake of the strategy game **Dune II: The Building of a Dynasty** (Westwood, 1992) in **three.js**.
It is based on the open-source [Dune Legacy](https://dunelegacy.sourceforge.net/) engine: the mechanics, numbers
and rules were ported from its source code, and the graphics were rebuilt in modern 3D.

## Running

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. To build for publishing:

```bash
npm run build
```

The static build ends up in `dist/` and runs from any web server.

## Online demo (GitHub Pages)

The repository deploys itself to GitHub Pages with [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
on every push to `main`. One-time setup: in the repository open **Settings → Pages** and set
**Build and deployment → Source** to **GitHub Actions**. The demo is then served at
`https://<user>.github.io/<repository>/`. All asset paths are relative, so the game works from any sub-path.

The demo needs a desktop browser with WebGL 2; sound starts after the first click (browser autoplay rules).

## What's in the game

- **Campaigns for the three Great Houses**: Atreides, Harkonnen and Ordos. Each has 9 levels, with regions picked
  on a 3D map of Arrakis, mentat briefings (Cyril, Radnor, Ammon), "Meanwhile…" scenes after levels 4 and 8,
  and its own finale. The objectives follow the original: a spice quota on the first levels, then destroying
  enemy bases; the Sardaukar arrive from level 4, the enemies join forces on level 8, and level 9 is the final
  battle at the Emperor's palace.
- **OpenSD2 bonus campaigns** for the Fremen, Sardaukar and Mercenaries (open scenarios shipped with Dune Legacy).
- **Skirmish** against the AI: a random map from the Dune II generator or one of 50 Dune Legacy maps,
  up to 6 players, teams, difficulty, starting credits and tech level.
- **Every Dune II unit and structure**, including the House specials: Sonic Tank, Devastator, Deviator,
  Fremen, Death Hand and Saboteurs, plus the CHOAM Starport with fluctuating prices, Carryalls, Frigates,
  Ornithopters and sandworms.
- **Full voice-over**: mentat briefings, narrator, base computer announcements for each House and radio
  acknowledgements from unit crews (ElevenLabs).
- **Saving and loading** mid-mission, with campaign progress saved automatically.
- **Mentat encyclopedia** of every unit and structure.

## Mechanics (as in Dune Legacy)

- The simulation ticks every 16 ms (62.5 ticks/s). Speed, damage, ranges and reload times come from `ObjectData.ini`.
- Tile-based movement: a unit turns to face the neighbouring tile before driving onto it. Speed depends on
  the terrain and differs for wheeled and tracked vehicles. Damaged vehicles move more slowly.
- Area damage: a unit takes `W >> (d/16 + 1)`, a structure takes full damage. Friendly fire is on.
- Missile Tank rockets miss at close range, the sonic wave passes through everything, and Deviator gas turns enemy vehicles.
- A Harvester carries 700 spice and unloads at a Refinery. Storage is limited and excess spice is lost.
  Windtraps produce power in proportion to their health. A structure placed without concrete starts at 50% health.
- Tracked vehicles crush infantry. Infantry can cross mountains and capture damaged structures.
- Sandworms live in the sand, eat up to three targets and leave. Spice blooms explode and create new fields.
- The campaign AI sleeps until first contact, then rebuilds its losses and attacks in waves.
  The skirmish AI builds its base from scratch.

Detailed technical write-ups are in `docs/research/`:
- [01_campaign_story.md](docs/research/01_campaign_story.md): story, campaign, missions, interface;
- [02_units_combat.md](docs/research/02_units_combat.md): units, weapons, combat, movement;
- [03_structures_economy_ai.md](docs/research/03_structures_economy_ai.md): structures, economy, AI, scenarios.

## Controls

| Action | Key / mouse |
|---|---|
| Select / box select / all units of a type | Left click / drag / double click (or Ctrl+click) |
| Order (move, attack, harvest, repair, unload) | Right click |
| Camera | Arrows, screen edge, middle mouse button; wheel zooms; Q/E rotate; Home resets |
| Move / attack / capture / stop | M / A / C / S |
| Harvester home / repair / upgrade | H / R / U |
| Place structure / Construction Yard / factories | P / G / F |
| MCV: deploy, Devastator: detonate | X |
| Groups | Ctrl+1…9 assign, 1…9 select (twice to jump to the group) |
| Whole army / health bars | Ctrl+A / Tab |
| Pause / speed / menu | Space / + and − / Esc |

In the build list: left click orders an item (Shift for ×5), right click puts it on hold or cancels it.
Right-clicking the ground with a factory selected sets its rally point.

## Voice-over and sound effects

All speech and sound effects were generated with [ElevenLabs](https://elevenlabs.io/) and live in
`public/voice` and `public/sfx`. The game falls back to browser speech synthesis and procedural WebAudio
sounds for anything that is missing.

- The full script, the cast and the voice settings are in [src/data/voice.js](src/data/voice.js).
- `npm run voice` renders new or changed lines, and `npm run sfx` renders the sound effects
  ([tools/voice-gen.mjs](tools/voice-gen.mjs), [tools/sfx-gen.mjs](tools/sfx-gen.mjs)).
  Both read `ELEVENLABS_API_KEY` from the environment or from `.env.local`, and honour `HTTPS_PROXY`.
- If `ffmpeg` is installed, the voice clips are trimmed, loudness-normalised and stored as 64 kbps mono.
- `node tools/voice-gen.mjs --dry` shows how many characters a run would use.

## Music

Drop audio files into `public/music/`; the file name selects when a track plays:

| Prefix | When it plays |
|---|---|
| `menu*` | menus, briefings, the region map |
| `ambient*` | in a mission while it is quiet |
| `battle*` | in a mission after an attack alert (for about 30 seconds after the last one) |
| `victory*`, `defeat*` | at the end of a mission and on the results screen |

For example: `menu.mp3`, `ambient1.mp3`, `ambient2.mp3`, `battle1.mp3`, `victory.mp3`. The dev server and the
build pick the files up automatically. Without any files, a generative ambient score is played instead.
If `ffmpeg` is installed, every track is analysed once ([tools/music-levels.mjs](tools/music-levels.mjs), cached in
`public/music/levels.json`): the game evens out their loudness and crossfades into the next track before any
trailing silence. The original files are not modified.
Prompts for generating the tracks with Suno are in [docs/MUSIC_SUNO.md](docs/MUSIC_SUNO.md).

## Code layout

```
src/
  core/      constants, RNG, events, math
  data/      stats (objectData.json from Dune Legacy), descriptions, campaign, voice script
  game/      simulation: map, units, structures, projectiles, AI, scenarios, map generator, saves
  render/    three.js: terrain, models, effects, planet, icons
    models/  procedural models: builder (geometry), materials (PBR + canvas textures),
             tanks / wheeled / heavy / air / infantry (units), base1-3 / defense (structures)
  client/    game view and input
  ui/        HUD, menus, minimap
  audio/     samples, voice, music and procedural fallback synthesis
tools/       headless simulation tests, ObjectData.ini converter, ElevenLabs generators
public/      maps (Dune Legacy maps, OpenSD2 scenarios), voice, sfx, music
```

Model viewer (every unit and structure, any House, orbit with the mouse). With the dev server running, open
`http://localhost:5173/tools/viewer.html?set=vehicles&house=1`. Sets: `vehicles`, `air`, `infantry`, `base`,
`defense`, or model names separated by commas (`set=tank,palace`). Options: `house=0..5`,
`view=iso|iso2|iso3|front|side|top`, `zoom=0.6` (closer), `anim=1` (turrets, rotors, wings).
Triangle and mesh budget per model:

```bash
node tools/modelstats.mjs
```

Headless tests:

```bash
node tools/testcampaign.mjs 3000
```

```bash
node tools/mechanics.mjs
```

## License

The code is distributed under **GPL-2.0-or-later**, because the project is a derivative of Dune Legacy (see `LICENSE`).
Maps and scenarios are CC-BY-SA 3.0. Details and authors are in [CREDITS.md](CREDITS.md).
Dune is a trademark of its respective owners. This is a non-commercial fan project and uses none of the
original Westwood assets.
