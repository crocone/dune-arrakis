# Credits and licenses

## Code

This project is a derivative work of [Dune Legacy](https://dunelegacy.sourceforge.net/) (GPL-2.0-or-later):
the game mechanics, unit and structure statistics (`config/ObjectData.ini.default`), the seed-based map generator
(`src/MapSeed.cpp`, ported to `src/game/mapseed.js`) and the scenario format come from the Dune Legacy source code.
For that reason all code in this project is distributed under the **GNU GPL v2 or later** (see the LICENSE file).

Third-party libraries: [three.js](https://threejs.org/) (MIT), [Vite](https://vitejs.dev/) (MIT), [undici](https://undici.nodejs.org/) (MIT, tools only).

## Graphics, sound, texts

- 3D models of units and structures, terrain, effects and icons are generated procedurally by the project code
  (geometry from primitives; panel, concrete and cloth textures are drawn on a canvas at startup). The design
  language of the three Houses (Atreides: wedges, gold and the hawk; Harkonnen: angular armour, spikes and the
  bull; Ordos: smooth ovals, chrome, green glow and the snake) is inspired by the Dune 2000 / Emperor games,
  Dune: Spice Wars and the Villeneuve films; no rights holder assets or models are used.
- Voice-over (mentats, narrator, base announcers, unit crews) and sound effects were generated with
  [ElevenLabs](https://elevenlabs.io/) text-to-speech and sound generation, using ElevenLabs premade voices
  (see `src/data/voice.js`). Without these files the game falls back to WebAudio synthesis and browser speech.
- Music: the tracks in `public/music` were generated with [Suno](https://suno.com/) (prompts in
  [docs/MUSIC_SUNO.md](docs/MUSIC_SUNO.md)); without them a generative score is synthesized in real time.
- Mentat briefings, finales and interface texts were written from scratch; no original Westwood texts are used.
- Fonts: Cinzel and Inter (Google Fonts, SIL Open Font License).

## Maps and scenarios (CC-BY-SA 3.0)

The skirmish maps come from the Dune Legacy distribution and are licensed under
[Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
The map files are unmodified (only starting credits and tech level are overridden at launch).

| Map | Size | Players | Author |
|---|---|---|---|
| Bottle Neck | 64×64 | 2 | Rippsblack |
| Broken Mountains | 64×64 | 2 | Rippsblack |
| Canyon | 32×128 | 2 | R. Schaller |
| Cliffs Of Rene | 64×32 | 2 | Rippsblack |
| David's Pass | 64×64 | 2 | Rippsblack |
| Duality | 64×64 | 2 | Rippsblack |
| Face Off | 64×64 | 2 | Rippsblack |
| Gatekeeper | 32×128 | 2 | kc |
| Great Divide | 64×64 | 2 | Rippsblack |
| North vs. South | 64×64 | 2 | R. Schaller |
| Sanctuarys | 64×64 | 2 | Rippsblack |
| Twin Fists | 64×64 | 2 | Rippsblack |
| X-Factor | 32×32 | 2 | R. Schaller |
| Middle Man | 64×32 | 3 | Rippsblack |
| 3 vs 1 | 64×64 | 4 | kc |
| Channels | 64×64 | 4 | kc |
| Clear Path | 64×64 | 4 | Rippsblack |
| Combed | 64×64 | 4 | kc |
| Deserted | 128×128 | 4 | kc |
| Equilibrium | 128×128 | 4 | Stefan van der Wel |
| Four Chambers | 64×64 | 4 | Richard Schaller |
| Four Cities | 128×128 | 4 | Stefan van der Wel |
| Four Courners | 64×64 | 4 | Rippsblack |
| Gamma Sector | 128×64 | 4 | kc |
| Hungry Hippos | 128×128 | 4 | Stefan van der Wel |
| Moshpit with Garbages | 128×128 | 4 | SardukarKoon |
| Sietch Stefan | 64×64 | 4 | Rippsblack |
| Silicon Valley | 64×64 | 4 | kc |
| Silicon Valley XL | 128×128 | 4 | kc |
| Snake Pass | 128×128 | 4 | Stefan van der Wel |
| Spicestorm | 128×128 | 4 | kc |
| Stronghold | 64×64 | 4 | kc |
| The Sardaukar Outpost | 128×128 | 4 | R. Schaller |
| Vast Armies Have Arrived | 64×64 | 4 | R. Schaller |
| Worm Investation | 128×128 | 4 | Stefan van der Wel |
| Wormhole | 128×128 | 4 | kc |
| All against Atreides | 128×128 | 5 | Richard Schaller |
| Fortress | 128×128 | 5 | kc |
| Gridlocked | 128×128 | 5 | kc |
| Hellvetika | 128×128 | 5 | Kuffar |
| Kragetam | 128×128 | 5 | Kuffar |
| Meadow | 128×128 | 5 | kc |
| Sardaukar Base | 128×128 | 5 | kc |
| Sardaukar Base Easy | 128×128 | 5 | kc |
| Watch Your Track | 128×64 | 5 | kc |
| Alkozeltser 2 | 128×128 | 6 | JonhSoft(TM) |
| Fertile Basin | 64×64 | 6 | Kuffar |
| Full Wormage | 128×128 | 6 | JonhSoft™ 2024 (C) |
| Gargantuan Mountains | 128×128 | 6 | Kuffar |
| Rocking Fields | 64×128 | 6 | kc |

The bonus campaigns are the **OpenSD2** scenarios (Fremen, Sardaukar, Mercenary) from the Dune Legacy distribution,
licensed under CC-BY-SA 3.0 (license text: `public/maps/opensd2/CC-BY-SA.txt`); the authors are listed in the scenario files
(mostly R. Schaller).

## Trademarks

Dune is a trademark of its respective owners. Dune II is a game by Westwood Studios (1992).
This non-commercial fan project is not affiliated with them and contains none of their original assets.
