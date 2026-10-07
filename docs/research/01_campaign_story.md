# 01. Dune II: The Building of a Dynasty — Story, Campaign and Their Implementation in Dune Legacy

A research document for a three.js strategy-game remake. It covers the lore, the campaign structure, all 27 missions (3 Houses × 9 levels, 66 map variants), the tech tree by level, the differences between Houses, the interface and notifications (original and Dune Legacy), and House colors.

**On copyright.** The texts of Mentat briefings, cutscene dialogue and map captions are not quoted, only paraphrased. The briefings in §3 were written from scratch specifically for our game and can be used as is. Short service notification phrases ("Construction complete" and the like) are given as event identifiers.

**Where the data comes from.**
- The per-mission numbers (credits, quotas, armies, bases, reinforcements, worms, CHOAM) are taken from the original scenario files `SCEN{A|H|O}001–022.INI`. Copies of them live in the open Dune II – The Maker (D2TM) repository. I extracted only facts (see Appendix A).
- The tech availability logic is taken from the reconstructed original code in OpenDUNE (`structureinfo.c`, `unitinfo.c`, `structure.c`) and from the Dune Legacy configuration (`config/ObjectData.ini.default`).
- Dune Legacy behavior is taken from the local source code (`src/Menu/*`, `src/CutScenes/*`, `src/Game.cpp`, `src/GameInterface.cpp`, etc.).
- The lore is taken from the Dune Wiki (Fandom), the Dune RTS Wiki (wiki.gg) and Wikipedia (en/ru).

Related documents:
- [`02_units_combat.md`](02_units_combat.md): unit stats and combat.
- [`03_structures_economy_ai.md`](03_structures_economy_ai.md): structures, economy, AI, scenario format.

These topics are touched on here only as far as the campaign needs them.

---

## 0. In Brief

| What | Value |
|---|---|
| Player Houses | Atreides, Harkonnen, Ordos |
| Non-playable forces | The Emperor's Sardaukar; Fremen (allies of the Atreides, and formally the owners of the sandworms); Mercenaries (present in the engine, not used in the original campaign) |
| Campaign length | 9 levels per House. Each House has 22 scenarios: 1 + 3×6 + 2 + 1. 66 maps in total |
| Region selection | From level 2 onward, a map of Dune with 27 regions is shown. On levels 2–7 you choose from 3 regions, on level 8 from 2, and level 9 has just one (the Emperor's palace) |
| Objectives | Lvl 1: harvest spice worth 1000 credits. Lvl 2: accumulate 2700 credits or destroy the enemy base. Lvl 3–9: destroy all enemy structures (walls, turrets and slabs do not count) |
| Opponents | The other two Houses alternate. From level 4 the enemy receives Sardaukar. On level 8 the player faces two Houses at once. On level 9 it is two Houses plus the Emperor, and all three have Palaces |
| Technology | Unlocked by level (TechLevel = level number) and by builder upgrades. The full arsenal is available by level 8 (Palace) |
| Cutscenes | Intro; "Meanwhile, in the Emperor's palace…" after level 4 and level 8; a finale, different for each House |
| Dune Legacy | Repeats the structure of the original: reads `REGION?.INI` and `SCEN????.INI` from PAK files. Adds modern controls: drag-box selection, right-click orders, production queues, groups |

---

## 1. Story and Lore

### 1.1 The Setup: the Opening Cutscene (paraphrase)

1. The planet Arrakis, called Dune: a world of sand and the only source of the spice melange.
2. The spice rules the Empire, and whoever holds Dune holds the spice.
3. The Emperor offered the Great Houses a contest: Dune will go to the House that harvests the most spice. The territories are not divided, and there are no rules of war.
4. Huge armies arrive on the planet. Three Houses start a war for Dune: the noble Atreides, the cunning Ordos and the vicious Harkonnen.
5. Only one House will win. The player's battle begins.

In Dune Legacy the intro is assembled in `src/CutScenes/Intro.cpp` from the original WSA animations INTRO1–11 (the planet, a storm, harvesters, the palace, the Emperor, the spaceport, scenes of the three Houses, a wrecked tank). The texts come from `INTRO.ENG`.

### 1.2 Emperor Frederick IV, House Corrino

- **Frederick IV** is the Padishah Emperor from House Corrino. In the Westwood games he replaces the books' Shaddam IV.
- According to the backstory, he regained the throne after infighting with his relatives and ran up enormous debts; rumor has it that he owes CHOAM more than three billion. He needs the spice to pay them off.
- Hence the offer: the governorship of Arrakis will go to the House that harvests the most spice. Secretly, he expects the Houses to bleed each other dry, with his Sardaukar finishing off the remnants.
- Over the course of the campaign the Emperor secretly helps whoever is losing to the player: on level 4 the Sardaukar arrive as reinforcements for the enemy. After level 8 he openly unites the other two Houses against the player, and on level 9 he defends the palace on Dune himself.

### 1.3 The Three Great Houses

| | **Atreides** | **Harkonnen** | **Ordos** |
|---|---|---|---|
| Homeworld | Caladan: a warm, mild climate, green lands and plenty of water | Giedi Prime: a grim, industrial, polluted world | Sigma Draconis IV: an icy planet |
| Character | Nobility, honor, "fair play", loyalty to allies (the Fremen), respect for the Great Convention | Cruelty, strength, fear, intrigue, contempt for the weak | A trading cartel and smugglers: calculation, profit, secrecy, forbidden Ixian technology |
| Mentat | **Cyril** | **Radnor** (according to the lore, he killed his teacher Marko and took his place) | **Ammon** (later, per the Dune 2000 lore, executed for embezzlement) |
| Army style | Balanced: fast, high-tech vehicles, air power, the Sonic Tank | Heavy, expensive, powerful vehicles. No Trikes, no Light Infantry | Speed, cunning, sabotage. No Missile Tank (Launcher), Siege Tanks come latest of all |
| Exclusives | Sonic Tank; Fremen (via the Palace); Trike | Devastator; Death Hand (via the Palace); Trooper only | Deviator; Saboteur (via the Palace); Raider Trike |
| Color | Blue | Red | Green |

### 1.4 The Mentats: the "Voice" of the Campaign

The Mentat guides the player through the whole campaign: a briefing before each mission, congratulations after a victory, a post-mortem after a defeat. In addition, the "Mentat" button during play opens the reference on structures and units.

- **Cyril (Atreides):** polite, warm, respectful of the player. Talks about duty, honor and protecting the peaceful harvesters. Dislikes war but is firm. Praises generously, almost like a father.
- **Radnor (Harkonnen):** arrogant, caustic, threatens through innuendo. Praises through gritted teeth and immediately reminds you who is in charge. Savors the suffering of enemies and lets slip his own ambitions.
- **Ammon (Ordos):** cold and businesslike. Measures everything by profit, scorns "fair play" and morality. Values capturing enemy structures ("pure profit"), and stresses how busy he is.

### 1.5 Other Forces

- **Sardaukar:** the Emperor's elite heavy infantry; in the engine they are a separate House. In the scenarios they appear as squads of heavy infantry (`Troopers`) dropped onto the enemy's base. This happens from about minute 20 on level 4 and from about minute 30 on levels 8–9 (repeating). On level 9 the Sardaukar have a full base: a Palace (Death Hand), a Heavy Factory, 2 WORs, 9 Rocket Turrets, ~50 wall segments. By the lore they are armed with rapid-fire guns and rockets; in Dune Legacy their stats are the same as regular Troopers.
- **Fremen:** the native inhabitants of the desert, excellent guerrillas. The Atreides have always treated them fairly, so the Fremen are friendly to them. The Harkonnen consider them slaves of the Atreides, and the Ordos see them simply as skilled fighters. Their gameplay role: the Atreides Palace summons a Fremen squad once every 5 minutes. They cannot be controlled: they hunt enemy units on their own and do not attack structures. In all scenarios the sandworms are registered to the "Fremen" House.
- **Mercenaries:** the engine's sixth House (golden-ochre color, its own voice set). They never appear in any of the 66 original scenarios. They are used in fan campaigns (Super Dune II, OpenSD2 from `scratchpad/opensd2`: campaigns for the Fremen, Sardaukar and Mercenaries) and in Dune Legacy's own custom games. For our game they are a candidate for "Ordos mercenaries" or for a bonus campaign.
- **Sandworm (Shai-Hulud):** lives only in sand, swallows vehicles and infantry, and does not go onto rock. It is attracted by movement. After swallowing a few objects it goes back under the sand. It is very hard to kill (1000 HP). From level 3 there are 2–3 worms on every map.
- **CHOAM and the Guild:** at the Starport (level 6) the vehicle stock is limited by the scenario (the `[CHOAM]` section), and prices fluctuate. The purchase is delivered by a Frigate. In Dune Legacy the Frigate arrives after ~30 s, the price is periodically recomputed within 40–160 % of base (maximum 999), and the stock is slowly replenished.
- **IX Research Centre (House of IX):** a level 7 structure. It gives access to the "house" super tanks and to Ornithopters.

### 1.6 The Palace Superweapon (level 8+)

| House | Weapon | How it works (original / Dune Legacy) | Cooldown (Dune Legacy) |
|---|---|---|---|
| Atreides | **Fremen** | Summons a Fremen squad at a random point on the map. In Dune Legacy this is up to 15 Troopers (each appears with probability 5/6) in Hunt mode. They cannot be controlled and attack the nearest enemy | 5 min |
| Harkonnen (and Sardaukar) | **Death Hand** | A ballistic missile from the Palace at a chosen point: a large radius, 100 damage, low accuracy. The AI launches it at the player's base; "Missile approaching" is announced | 10 min |
| Ordos | **Saboteur** | A controllable saboteur appears next to the Palace. He runs fast and blows up a structure or vehicle on contact. "Saboteur approaching" is announced | 5 min |

### 1.7 The "Meanwhile…" Scenes (paraphrase)

In Dune Legacy they are implemented in `src/CutScenes/Meanwhile.cpp` and launched from `sand.cpp` after a victory on level 4 and level 8.

- **After level 4: the Emperor's palace.** The Emperor reprimands the envoy of the House he was secretly helping, which lost to the player anyway. If the player is Atreides, Radnor (Harkonnen) is reprimanded. If the player is Harkonnen, Ammon (Ordos) is reprimanded. If the player is Ordos, Cyril (Atreides) is reprimanded. The Emperor reproaches the envoy: he lost even though he was given Sardaukar to help. The envoy tries to justify himself, the Emperor cuts him off and promises not to let it happen again.
- **After level 8: the Emperor's palace, now on Dune.** The Emperor is furious at both losing Houses. He gave them weapons and troops, and they still failed to stop the player. He does not want to hear explanations and announces that from now on they will fight together against the common enemy. This is how the final coalition of level 9 begins.

### 1.8 House Finales (paraphrase)

Implemented in `src/CutScenes/Finale.cpp`. The music is different for each House. At the end the planet Dune on screen is recolored in the winning House's color.

- **Atreides: a lawful trial.** An Atreides representative (per the wiki description, Cyril with warriors) enters the throne room. He formally charges Frederick with treason against House Atreides. The House will decide guilt or innocence, and until then Frederick is removed from power. Result: the Atreides win by law, without an execution.
- **Harkonnen: a reprisal.** The Harkonnen envoy accuses the Emperor of lying: he swore loyalty but played a double game. The Emperor is bewildered. He will pay for this lie with his life: blaster shots, explosions and the sound of breaking glass follow, and the Emperor's cry is cut off. Result: the Harkonnen kill the Emperor.
- **Ordos: a puppet.** The Ordos envoy tells the Emperor that he has seen through his game: the Houses were pawns and Dune was the board. Now the Ordos take the game into their own hands, and the Emperor will become their pawn. Strange, lizard-like sounds are heard. Result: the Ordos make the Emperor their puppet.

### 1.9 After a Mission: Statistics and Ranks (Dune Legacy)

After a victory the statistics screen is shown (`CampaignStatsMenu.cpp`). It compares how much spice the player collected and how much the enemy did, how many units and structures were destroyed, and shows the time and the score.

The score formula (`CampaignStatsMenu.cpp:420-494`):
- base: `level × 45`;
- plus the value of what the player destroyed, minus the value of what the enemy destroyed;
- plus the player's credits / 100;
- plus the value of the player's surviving structures / 100;
- minus (minutes + 1).

Ranks by score threshold:

| Score | <25 | ≥25 | ≥50 | ≥100 | ≥150 | ≥200 | ≥300 | ≥400 | ≥500 | ≥700 | ≥1000 | ≥1400 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rank | Sand Flea | Sand Snake | Desert Mongoose | Sand Warrior | Dune Trooper | Squad Leader | Outpost Commander | Base Commander | Warlord | Chief Warlord | Ruler of Arrakis | Emperor |

---

## 2. Campaign Structure

### 2.1 Levels, Scenarios, Numbering

Each House plays through 9 levels. The scenarios are named `SCEN{H}{NNN}.INI`, where `H` = A/H/O and `NNN` = 001…022.

| Level | Scenarios (NNN) | Variants | Briefing animation (level theme) | Map size | Objective |
|---|---|---|---|---|---|
| 1 | 001 | 1 | Harvester: spice harvesting | 32×32 | Quota of 1000 credits |
| 2 | 002–004 | 3 | Radar/HQ: radar | 32×32 | Quota of 2700 **or** destroy the base |
| 3 | 005–007 | 3 | Quad: the quad | 62×62 (64 with border) | Destroy all enemy structures |
| 4 | 008–010 | 3 | Light tank: the tank | 62×62 | Same |
| 5 | 011–013 | 3 | Repair: the repair facility | 62×62 | Same |
| 6 | 014–016 | 3 | Heavy factory | 62×62 | Same |
| 7 | 017–019 | 3 | IX | 62×62 | Same |
| 8 | 020–021 | **2** | Palace | 62×62 | Same, against two Houses at once |
| 9 | 022 | 1 | Sardaukar | 62×62 | Same, against two Houses and the Emperor |

Dune Legacy formulas:
- `level = (mission+1)/3 + 1`; for mission 22 the briefing explicitly counts it as level 9.
- `TechLevel = (mission+1)/3 + 1`, so mission 22 has TechLevel 8 (there are no new technologies on level 9).
- The region choice on the map is turned into a mission number as follows. After a completed level L (L = 1…7): `(L−1)·3 + 2 + arrow_index` (index 0 = REG1). After level 8 the result is 22 (`MapChoice.h::getSelectedMission`).

### 2.2 Win and Lose Conditions (as in the original)

The scenario has two bit fields, and they do not work the way their names suggest (`OpenDUNE opendune.c::GameLoop_IsLevelFinished/IsLevelWon`):

- `WinFlags` defines **when the level ends**. Bits: 1 — the enemies have no structures left; 2 — the player has no structures left; 4 — the quota is reached; 8 — the timer has expired.
- `LoseFlags` defines **whether the ending counts as a victory**. Bit 1: the enemy has no structures. Bit 2: the player has structures. Bit 4: the quota is reached.
- Structures are counted **without** slabs, walls, gun turrets and rocket turrets.
- The level cannot end sooner than 7200 ticks (~2 minutes).

| Level | WinFlags / LoseFlags | Meaning |
|---|---|---|
| 1 | 6 / 4 | Ends on reaching the quota or on losing all structures; a victory if the quota is reached |
| 2 | 7 (or 23) / 5 | Ends on reaching the quota, on destroying the enemy base, or on losing your own base; a victory on the quota or on a destroyed enemy base |
| 3–4 | 3 (or 19) / 1 | Ends when either side has no structures left; a victory if the enemy has none left |
| 5–9 | 3 / 1 | Same |

Dune Legacy uses the same flags: `WINLOSEFLAGS_AI_NO_BUILDINGS=1`, `HUMAN_HAS_BUILDINGS=2`, `QUOTA=4`, `TIMEOUT=8`.

### 2.3 The Map of Dune: 27 Regions

The selection map (MAPMACH.CPS and the like) is divided into 27 "pieces". Their positions are set in `[PIECES]` of the `REGION?.INI` file: the top-left corner coordinates in pixels of a 320×200 screen (Dune Legacy adds an offset of +8,+24 and a ×2 scale). Below is a rough grid:

```
y≈0     [1]   [2]   [3]   [4]        [5]   [6]
y≈10-40 [7]     [8]   [9]   [10] [11]   [12]
y≈40-70 [13][14]   [15]  [16] [17]   [18]  [19]
y≈70-98 [20][21] [22]   [23] [24][25] [26] [27]
        west ──────────────────────────────── east
```

| Region | x,y | Region | x,y | Region | x,y |
|---|---|---|---|---|---|
| 1 | 0,0 | 10 | 173,16 | 19 | 280,47 |
| 2 | 55,0 | 11 | 220,22 | 20 | 0,82 |
| 3 | 97,0 | 12 | 264,16 | 21 | 23,91 |
| 4 | 145,0 | 13 | 0,41 | 22 | 59,86 |
| 5 | 211,0 | 14 | 21,46 | 23 | 133,92 |
| 6 | 247,0 | 15 | 87,70 | 24 | 172,90 |
| 7 | 0,9 | 16 | 148,45 | 25 | 195,70 |
| 8 | 71,38 | 17 | 186,45 | 26 | 216,98 |
| 9 | 133,31 | 18 | 243,47 | 27 | 249,77 |

**The starting distribution** is the same in all three campaigns:

| Owner | Regions | Where on the map |
|---|---|---|
| Atreides | 7, 13, 14, 20, 21, 22 | west and southwest |
| Harkonnen | 3, 4, 5, 6, 9, 10 | north |
| Ordos | 19, 23, 24, 25, 26, 27 | east and southeast |
| Neutral | 1, 2, 8, 11, 12, 15, 16, 17, 18 | center and northwest |

The `REGION?.INI` format (an example is in `scratchpad/opensd2/REGIONS.INI`; Dune Legacy reads it in `MapChoice::loadINI`):
- `[GROUPn]` — the state of the map before level n+1.
- The keys `ATR=`, `HAR=`, `ORD=`, `SAR=`, `FRE=`, `MER=` — the regions this House has captured by that point. When the map is shown they "flow" into its color.
- `REG1..REG4=region,arrow_number,x,y` — the regions available for attack. The arrow is animated, and its direction is set by a number 0–8.
- `ENGTXTk=` — the phrase in the scrolling ticker that appears when piece k is colored in.

### 2.4 The War on the Map and Region Choice

Data: the D2TM reconstruction of `REGION?.INI` (`campaign/{house}/missionN.ini`); the phrases were checked against the quotes on the Dune RTS Wiki. The map phrases below are paraphrased.

**Atreides**

| Before lvl | Map changes | Course of events (ticker paraphrase) | Region choice |
|---|---|---|---|
| 2 | Starting distribution | The Atreides have taken the key lands, the Ordos came in from the east, the Harkonnen invaded from the north | 8 / 15 / 23 |
| 3 | A: 8, 15, 23; O: 12, 16, 17, 18; H: 1, 2, 11 | The Atreides expanded and pushed out the Ordos, who turned toward the Harkonnen, and the Harkonnen pushed their borders outward | 1 / 2 / 3 (Harkonnen) |
| 4 | A: 1, 2, 3; O: 11; H: 16, 6 | The Harkonnen borders are weak, except for one outpost | 4 / 9 / 16 |
| 5 | A: 4, 9, 16; H: 11, 6 | The Harkonnen retreat into Ordos lands | 17 / 25 / 24 (Ordos) |
| 6 | A: 17, 25, 24; H: 18 | All forces are thrown against the Ordos | 10 / 11 / 18 (Harkonnen) |
| 7 | A: 10, 11, 18 | The Atreides push the Ordos back further | 19 / 27 / 26 (Ordos) |
| 8 | A: 26, 27, 19 | The Ordos are almost destroyed | 5 / 12 (both Houses) |
| 9 | A: 5, 12; Sardaukar: 6 | Only the Emperor's troops remain | 6 (the palace) |

**Harkonnen**

| Before lvl | Map changes | Course of events | Choice |
|---|---|---|---|
| 2 | Start | The Harkonnen arrived first, the Atreides look like easy prey, and the Ordos are creeping closer | 1 / 2 / 8 |
| 3 | H: 1, 2, 8; A: 15, 16, 23; O: 11, 12, 17, 18 | The Harkonnen fielded strong forces, the Atreides went after the Ordos, and the Ordos snatched up more land | 17 / 11 / 12 (Ordos) |
| 4 | H: 11, 12, 17; A: 24; O: 16 | The Ordos never stood a chance; the Atreides and Ordos traded lands | 25 / 18 / 19 (Ordos) |
| 5 | H: 18, 19, 25; O: 24, 27 | The Ordos outpost is surrounded, and the Ordos broke through the Atreides | 13 / 7 / 14 (Atreides) |
| 6 | H: 7, 13, 14; O: 23 | House Atreides will soon vanish | 24 / 26 / 27 (Ordos) |
| 7 | H: 24, 26, 27; A: 20, 23 | The Harkonnen crushed most of the Ordos | 20 / 21 / 22 (Atreides) |
| 8 | H: 20, 21, 22 | The Atreides are crushed | 16 / 23 (both Houses) |
| 9 | H: 16, 23; Sardaukar: 15 | Only the Harkonnen will win | 15 (the palace) |

**Ordos**

| Before lvl | Map changes | Course of events | Choice |
|---|---|---|---|
| 2 | Start | The Ordos took the best lands, the Atreides are nearby, and the Harkonnen are a threat | 15 / 16 / 17 |
| 3 | O: 15, 16, 17; A: 1, 2, 8; H: 11, 12, 18 | The Ordos advanced without resistance, the Atreides are stretched thin, and the Harkonnen drew closer | 14 / 22 / 8 (Atreides) |
| 4 | O: 8, 14, 22; H: 2 | All strikes go against the Atreides | 13 / 20 / 21 (Atreides) |
| 5 | O: 13, 20, 21; A: 2 | The Ordos took advantage of the Atreides' war with the Harkonnen | 11 / 18 / 12 (Harkonnen) |
| 6 | O: 11, 12, 18 | The Harkonnen had to be pushed back | 1 / 7 / 2 (Atreides) |
| 7 | O: 1, 2, 7; A: 3 | The Ordos finished off most of the Atreides | 10 / 5 / 6 (Harkonnen) |
| 8 | O: 5, 6, 10 | The Ordos seized more Harkonnen lands | 3 / 9 (both Houses) |
| 9 | O: 3, 9; Sardaukar: 4 | Soon all of Dune will be under the Ordos | 4 (the palace) |

Each House has its own final point (region 6, 15 or 4): the Emperor's palace, which is "handed over" to the Sardaukar immediately before the finale.

### 2.5 Defeat and Retry (Dune Legacy)

- After a defeat a defeat debriefing is shown: the Mentat explains what went wrong. Then the selection map for the same level opens again (`Game::getNextGameInitSettings`: the mission number is rolled back by 3, and for 22 by 1).
- The region where the player lost is marked as already played (`alreadyPlayedRegions`, a bit mask) and is no longer offered by an arrow. You can choose a different variant. If all variants of the level are exhausted, the mask is reset.
- In the original, before some missions the Mentat asked a question from the manual (copy protection). Dune Legacy does not have it.

### 2.6 Opponents by Level (summary)

| Lvl | Atreides vs. | Harkonnen vs. | Ordos vs. |
|---|---|---|---|
| 1 | Ordos infantry (12 soldiers, no base) | Atreides infantry (12 squads + a soldier) | Harkonnen infantry (7 soldiers, 5 WOR fighters) |
| 2 | A small Ordos base | A small Atreides base | A small Harkonnen base |
| 3 | Harkonnen | Ordos | Atreides |
| 4 | Harkonnen + **Sardaukar** reinforcements | Ordos + **Sardaukar** | Atreides + **Sardaukar** |
| 5 | Ordos | Atreides | Harkonnen |
| 6 | Harkonnen | Ordos | Atreides |
| 7 | Ordos (Deviators) | Atreides (Sonic Tanks) | Harkonnen (Devastators) |
| 8 | Harkonnen **and** Ordos; one of them has a Palace; Sardaukar from minute 30 | Atreides and Ordos (same) | Atreides and Harkonnen (same) |
| 9 | Harkonnen + Ordos + **Sardaukar**; 3 Palaces | Atreides + Ordos + Sardaukar | Atreides + Harkonnen + Sardaukar |

### 2.7 Typical Events by Level

| Lvl | Events |
|---|---|
| 1 | No enemy base. Some of the enemy infantry waits in ambush (Ambush), some hunts (Hunt). In Dune Legacy the tutorial hints are also active at the start |
| 2 | The enemy has a starting base: CY, windtrap, refinery, silo, radar, barracks or WOR. The AI forms 5 infantry teams of 2–5 fighters. You can capture the enemy silo with infantry (the Ordos are directly advised to do so) |
| 3 | The first big map and the **first worms** (2–3). Reinforcements arrive for the player at about minutes 6 and 11 (a Trike and infantry). Infantry is dropped on the enemy at minutes 5, 10 and 20 |
| 4 | The enemy has a Heavy Factory and walls. Tanks and Quads arrive for the player at minutes 12 and 21. **From minute 20, 4 Sardaukar squads are dropped on the enemy every ~20 minutes** (repeating) |
| 5 | The enemy has 7–17 gun turrets, a Repair Facility, and a Hi-Tech Factory. The AI's Kamikaze teams appear (attacking to the last unit) |
| 6 | Rocket turrets (6–9), 2 Heavy Factories, Siege Tanks and Missile Tanks. The player gets the Starport, and the CHOAM stock is set in the scenario |
| 7 | The enemy has the IX Research Centre and house super tanks. At minute 21 the player receives their own super tank: Sonic (Atreides), Devastator (Harkonnen), Deviator (Ordos) |
| 8 | Two enemy bases, one with a Palace (a superweapon against the player). Enemy reinforcements at minutes 12/14/21, Sardaukar from minute 30, repeating |
| 9 | Three bases, three Palaces. Repeating enemy waves from minute 12–14, Sardaukar from minute 30. The player starts with only 1000–1500 credits and a strike group |

Reinforcement times in a scenario are set in minutes of game time: in the original, a counter `value×6+1` ticks down once every 10 s. The `+` suffix means a repeat at the same interval.

---

## 3. Missions by House

Legend:
- "Credits" — the player's / the opponent's starting credits.
- "New" — what first becomes available to the player on this level (original; for Dune Legacy differences see §4).
- "Reinf." — reinforcements (m = minute).
- LF / HF — Light Factory / Heavy Factory.

Detailed army and base compositions for each of the 66 variants are given in **Appendix A**.

### 3.1 Atreides (Mentat Cyril)

| Lvl | Scenarios (map variants) | Objective | Opponent | Credits (player / enemy) | New in the arsenal | Notes |
|---|---|---|---|---|---|---|
| 1 | A001 | Quota 1000 (destroying the infantry is optional) | Ordos: 12 soldiers (9 in ambush, 3 in Hunt mode) | 1000 / 0 | Slabs, Windtrap, Refinery (+ Harvester) | Start: CY, 3 soldiers, 2 Trikes. A large spice field to the west |
| 2 | A002 north, A003 center, A004 south | Quota 2700 or the enemy base | Ordos | 1200 / 0 | Radar (Outpost), Silo, Barracks (Soldier, Infantry squad after the upgrade), Light Factory (Trike) | The enemy has 5 Raider Trikes, 3 soldiers, 3 WOR fighters |
| 3 | A005 west, A006 center, A007 east | Destroy the base | Harkonnen | 1500 / 300 | Light Factory upgrade → Quad | First worms (2–3). Enemy: 7 Quads, 7 Troopers. Player reinf. at min 6 and 11 |
| 4 | A008 north, A009 center, A010 south | Destroy the base | Harkonnen + Sardaukar | 1500 / 400 | Heavy Factory (Tank, Harvester), walls, 2×2 slab (CY upgrade), MCV (HF upgrade) | Walls around the base (16–22). From min 20, 4 Sardaukar squads at a time, repeating. Player reinf.: tanks at min 12 and 21 |
| 5 | A011 north, A012 center, A013 south | Destroy the base | Ordos | 1500 / 500–700 | Hi-Tech (Carryall), Repair Facility, Gun Turret, Launcher (2nd HF upgrade) | The enemy has 7–10 turrets, 8–11 tanks, Kamikaze attacks |
| 6 | A014 west, A015 center, A016 east | Destroy the base | Harkonnen | 1700 / 700–825 | Starport, Rocket Turret (2nd CY upgrade), Siege Tank (3rd HF upgrade) | 6–7 Rocket Turrets, 7–8 Siege Tanks, up to 7 Launchers |
| 7 | A017 north, A018 center, A019 south | Destroy the base | Ordos | 2000 (A018: 1800) / 1000 | IX Research Centre → Sonic Tank; Hi-Tech upgrade → Ornithopter | The enemy has 3–4 Deviators and an IX Research Centre. A Sonic Tank arrives for the player at min 21 |
| 8 | A020 (Harkonnen base with a Palace), A021 (the Ordos have a Palace) | Destroy both bases | Harkonnen + Ordos | 2000 / 1000 + 1000 | Palace → Fremen | The enemies have Devastators + Deviators. Enemy superweapon: Death Hand (A020) or Saboteur (A021). Sardaukar from min 30 |
| 9 | A022 (region 6) | Destroy everyone | Harkonnen, Ordos, Sardaukar | 1000 / 1500, 1500, 2500 | — | 3 Palaces: Death Hand ×2 (H, S) and Saboteur (O). Waves from min 12–14. Player reinf.: Sonic + Launcher at min 13, a squad at min 22 |

**Briefings (new texts for the game)**

- **A1.** Welcome to Arrakis, Commander. My name is Cyril, I am the Mentat of House Atreides, and I will be at your side throughout the campaign. Your first task is a modest one: set up spice harvesting and bring the House 1000 credits' worth of spice. Start with a windtrap, then build a refinery, and a harvester will be delivered along with it. The Ordos infantry squads nearby are dangerous only to the careless.
- **A2.** Your first report pleased the House Council, and you are now entrusted with a richer plot: you must accumulate 2700 credits. Scouts have discovered an Ordos camp nearby. Guard the harvesters with Trikes from the new Light Factory, and recruit infantry at the Barracks. If the Ordos do not leave you in peace, I authorize you to raze their camp.
- **A3.** We hoped for a long time to settle matters peacefully, but the Harkonnen understand only force. Their garrison in the neighboring region plunders caravans and threatens our people. Drive the Harkonnen out of there, leaving not a single structure standing. Once upgraded, the Light Factory will give you Quads; use them in concert.
- **A4.** The Harkonnen are hunting our harvesters again, machines that threaten no one. The Council no longer intends to tolerate it. The Heavy Factory is ready, and Combat Tanks will become the backbone of your army. There are troubling rumors that someone powerful is supplying the Harkonnen with troops, so be prepared for surprises.
- **A5.** You saw it with your own eyes: the Emperor's Sardaukar fought on the Harkonnen side. Our diplomats will find out what earned them such support. Your target is the Ordos, who took advantage of the confusion and seized this region. Missile Tanks, a Repair Facility, defensive turrets and a High-Tech Factory with Carryalls are now at your disposal.
- **A6.** Every reclaimed sector adds weight to our voice in the Landsraad, and right now we need one more. The Harkonnen have dug in behind walls and rocket towers, and their Siege Tanks strike far and hard. The Starport will let you order vehicles from CHOAM, and an upgraded Heavy Factory will start producing our own Siege Tanks. Show the Harkonnen that attacking the Atreides comes at a high price.
- **A7.** The scales are tipping in our favor, but the Ordos still hold a rich district and are hiding Ixian technology there. We, too, have gained access to the IX Research Centre, and its masters have built us a Sonic Tank, capable of punching through an entire column of the enemy. Beware the Deviators: their gas temporarily turns our vehicles to the enemy's side. Clear the region of Ordos.
- **A8.** The Ordos and the Harkonnen have forgotten their old feuds and moved against us in a united front. The Council has authorized construction of a Palace, and from there you can call on the Fremen, our friends from the deep desert. One of the enemies has a Palace as well, so do not keep all your forces in one place. Both bases must disappear.
- **A9.** This is the final battle for Dune. Emperor Frederick has dropped the mask: his Sardaukar, together with the remnants of the Ordos and the Harkonnen, have dug in around the palace, and each of the three armies has its own Palace. Our forces are few, so every harvester and every tank counts. Win, and the Emperor will stand trial before House Atreides.

### 3.2 Harkonnen (Mentat Radnor)

| Lvl | Scenarios | Objective | Opponent | Credits | New | Notes |
|---|---|---|---|---|---|---|
| 1 | H001 | Quota 1000 | Atreides: 12 infantry squads + a soldier | 1000 / 0 | Slabs, Windtrap, Refinery | Start: CY, 3 Troopers, 2 Quads. A spice field to the southwest |
| 2 | H002 north, H003 center, H004 south | Quota 2700 or the enemy base | Atreides | 1200 / 100 | Radar, Silo, **WOR** (Trooper) without Barracks | The enemy has Trikes and 6 infantry squads, Barracks |
| 3 | H005 east, H006 center, H007 west | Enemy base | Ordos | 1500 / 300 | **Light Factory → Quad** (the Harkonnen have no Trikes) | Worms. Player reinf. at min 6 and 11 (including a Trike, even though it cannot be built) |
| 4 | H008 west, H009 center, H010 east | Enemy base | Ordos + Sardaukar | 1500 / 500 | Heavy Factory (Tank), walls, MCV, 2×2 slab | From min 20, 4 Sardaukar squads at a time, repeating. The Ordos have 5–6 tanks |
| 5 | H011 east, H012 center, H013 west | Enemy base | Atreides | 1500 / 700 | Hi-Tech (Carryall), Repair, Turret, Launcher; WOR upgrade (Troopers squads) | The Atreides have **14–17 turrets**, 6–7 Launchers, up to 12 tanks |
| 6 | H014 northeast, H015 center, H016 west | Enemy base | Ordos | 1700 / 800 | Starport, Rocket Turret, Siege Tank | The Ordos have 10–12 Siege Tanks, 6–8 Rocket Turrets |
| 7 | H017 west, H018 center, H019 east | Enemy base | Atreides | 1800–2000 / 1000 | IX Research Centre → **Devastator** (the Harkonnen have no Ornithopters) | The enemy has 3–5 Sonic Tanks and up to 8 Launchers. A Devastator arrives for the player at min 21. In files H017–H019 the type is misspelled as `Devistator`: Dune Legacy recognizes the typo (`sand.cpp:233`), but in the original this reinforcement probably never arrives (unverified) |
| 8 | H020 (the Atreides have a Palace), H021 (the Ordos have a Palace) | Both bases | Atreides + Ordos | 2000 / 1000 + 1000 | Palace → **Death Hand** | Against the player: Fremen (H020) or Saboteur (H021). Sardaukar from min 30 |
| 9 | H022 (region 15) | Destroy everyone | Atreides, Ordos, Sardaukar | 1000 / 1500, 1500, 2500 | — | 3 Palaces: Fremen (A), Saboteur (O), Death Hand (S) |

**Briefings**

- **H1.** My name is Radnor, and your career, and perhaps your life, now depends on my opinion of you. We begin with something simple: a thousand credits' worth of spice, and I want no excuses. A windtrap, a refinery: even a raw recruit can handle that. If Atreides infantry wanders up to the base, feed it to our fighters for sport.
- **H2.** You managed, for now. Next you face a plot with more spice and no fewer enemies: gather 2700 credits. A tiny Atreides outpost has dug in nearby. Burning it down is pleasant, but the quota matters more than pleasure. Barracks are for weaklings; you have a WOR and real heavy infantry.
- **H3.** The Ordos traders have imagined they can pump our spice. They are wrong. Find their base and wipe it out, with no negotiation and no prisoners. The Light Factory will give you Quads; leave the toy Trikes to others.
- **H4.** Do not get cocky over your first success. The Ordos have spread across this region as well, like sand fleas, and you will have to purge them all over again. The Heavy Factory is now yours: tanks settle disputes faster than diplomats. And do not be surprised if the Ordos suddenly turn out to have friends in the Emperor's uniform.
- **H5.** Sardaukar on the Ordos side... The Emperor is playing dangerous games, and I will not forget it. Meanwhile the Atreides, left unwatched, have ringed their bases with turrets and fancy themselves the masters. Missile Tanks and a Repair Facility are already at your disposal. Let them learn how their nobility burns.
- **H6.** The Ordos are underfoot again, this time behind walls and rocket towers and with an entire fleet of Siege Tanks. I have allotted you a Starport and the right to build your own Siege Tanks; do not make me regret my generosity. Burn their base to the ground.
- **H7.** Spies report that the Atreides have acquired Ixian toys: Sonic Tanks. The House of IX has given us something more serious: the Devastator, a nuclear fortress on tracks. Show them whose armor is stronger. Nothing that could be rebuilt must remain of their base.
- **H8.** From now on you have a Palace, and with it the Death Hand, a missile that no walls can stop. The Atreides and the Ordos have holed up in this sector together, like rats in a single burrow. Destroy them both. Succeed, and I might mention your name to the Baron.
- **H9.** Frederick decided he could play the Harkonnen for fools, and shielded our enemies with his Sardaukar. Such mistakes are paid for in blood. The Atreides, the Ordos and the Imperial Guard have locked themselves in at the palace, and each has a Palace of its own, so burn them all down. Dune will go to the Harkonnen, and with the Emperor we will have a separate talk.

### 3.3 Ordos (Mentat Ammon)

| Lvl | Scenarios | Objective | Opponent | Credits | New | Notes |
|---|---|---|---|---|---|---|
| 1 | O001 | Quota 1000 | Harkonnen: 7 soldiers, 5 Troopers | 1000 / 0 | Slabs, Windtrap, Refinery | Start: CY, 3 soldiers, 2 Raider Trikes. Spice to the east |
| 2 | O002 west, O003 center, O004 east | Quota 2700 or the enemy base | Harkonnen | 1200 / 0 | Radar, Silo, Barracks (Soldier), Light Factory (**Raider Trike**) | The enemy has a WOR and 4–6 Troopers, 4–5 Quads. The Mentat advises capturing the enemy silo |
| 3 | O005 west, O006 south, O007 north | Enemy base | Atreides | 1500 / 300–500 | LF upgrade → Quad | Worms. The enemy has 8 Trikes and 2 Light Factories (O005) |
| 4 | O008 north, O009 center, O010 south | Enemy base | Atreides + Sardaukar | 1500 / 400 | Heavy Factory (Tank), walls, MCV, 2×2 slab | From min 20, 4 Sardaukar squads at a time, repeating |
| 5 | O011 east, O012 center, O013 west | Enemy base | Harkonnen | 1500 / 700–725 | Hi-Tech, Repair, Turret, **WOR** (Trooper; requires Barracks) | The Ordos have no Missile Tanks. The Harkonnen have 5 Launchers and 8 turrets |
| 6 | O014 northeast, O015 center, O016 west | Enemy base | Atreides | 1700 / 700–800 | Starport, Rocket Turret, WOR upgrade. **No Siege Tank yet** | The Atreides have 7–9 Siege Tanks, 3–6 Launchers. Siege Tanks reach the player only as reinforcements (min 21) |
| 7 | O017 west, O018 center, O019 east | Enemy base | Harkonnen | 2000 / 1000 | IX Research Centre → **Deviator**; Ornithopter; **Siege Tank** (2nd HF upgrade) | The enemy has 4–5 Devastators. The player gets a Deviator at min 21 (in O017 and O018 another one at min 13) |
| 8 | O020 (the Atreides have a Palace), O021 (the Harkonnen have a Palace) | Both bases | Atreides + Harkonnen | 2000 / 1000 + 1000 | Palace → **Saboteur** | Against the player: Fremen (O020) or Death Hand (O021). Sardaukar from min 30 |
| 9 | O022 (region 4) | Destroy everyone | Atreides, Harkonnen, Sardaukar | 1500 / 1000, 1500, 2500 | — | 3 Palaces: Fremen (A), Death Hand (H and S) |

**Briefings**

- **O1.** I am Ammon, Mentat of the Ordos Cartel; remember that name, for it will stand under your contracts. We are interested only in income, so we begin with a test: 1000 credits' worth of spice. Set up a windtrap and a refinery, and a harvester will follow. You can ignore the Harkonnen infantrymen in the area so long as they do not interfere with the work.
- **O2.** The first result is acceptable. The new bar is 2700 credits, and only that matters. A Harkonnen outpost stands nearby, and its spice storage would be useful to the Cartel: send infantry and take it intact. Barracks and a Light Factory with Raider Trikes are now available.
- **O3.** The Atreides have settled where we need freedom of action. Remove them. Leave talk of honor to the Atreides themselves; so far it has not saved them even once. An upgraded Light Factory will give you Quads for quick strikes.
- **O4.** The Atreides in this district must disappear. The Cartel still pays generously for captured structures: an intact enemy building is worth more than a heap of rubble. The Heavy Factory and tanks are at your service. Our informants hint that the Atreides may receive unexpected help; factor that into your calculations.
- **O5.** The Sardaukar's interference in the last battle cost us money, and I will present the bill later. For now the Harkonnen are hindering the Cartel: there are too many of their tanks and missile crews in this sector. Clear the region. A High-Tech Factory, a Repair Facility, turrets and a WOR for heavy infantry are now available.
- **O6.** The Atreides bury the Landsraad in complaints and petitions while their army occupies a sector that suits us. The Cartel prefers silence; ensure it. Through the Starport you can buy what our factories do not produce, for example Missile Tanks. The expense, naturally, must pay for itself.
- **O7.** The Harkonnen are still disrupting our deliveries. The House of IX has unlocked the Deviator for us: its gas makes enemy vehicles fight for us for a time. Turn their vaunted Devastators against their own base. We now produce our own Siege Tanks as well.
- **O8.** The Atreides and the Harkonnen, yesterday's enemies, have struck a deal against us. The Cartel has approved construction of a Palace, and its saboteurs will slip into any fortress. Destroy both bases, and quickly: a drawn-out war ruins even the Ordos.
- **O9.** Emperor Frederick decided he could move the Ordos around like pieces on a board. That was his last mistake. His Sardaukar and the remnants of the Atreides and the Harkonnen have gathered at the imperial palace, each with a Palace of its own. At stake is everything the Cartel has saved up over the years; destroy them, and Dune will be our deal of the century.

---

## 4. The Tech Tree by Level

### 4.1 Summary Table: What Unlocks on Each Level

TechLevel = the level number; on level 9 TechLevel 8 is used. Some units require a builder upgrade (CY, LF, HF, Hi-Tech, Barracks, WOR). The upgrades also become available by level.

| Lvl | Structures | Units / upgrades | Atreides | Harkonnen | Ordos |
|---|---|---|---|---|---|
| 1 | Concrete Slab 1×1, Windtrap, Refinery | Harvester (together with the refinery) | ✔ | ✔ | ✔ |
| 2 | Radar (Outpost), Spice Silo; Barracks; WOR (H only); Light Factory (A, O) | Soldier; Trooper (H); Trike (A) / Raider Trike (O); Barracks upgrade → Infantry squad (original only) | Barracks, LF: Trike | **WOR** instead of Barracks; no LF | Barracks, LF: Raider |
| 3 | Light Factory (H) | LF upgrade → **Quad** | Quad | LF + Quad (no upgrade in Dune Legacy) | Quad |
| 4 | Heavy Factory, Wall, Concrete 2×2 (CY upgrade #1) | **Tank**, Harvester; HF upgrade #1 → **MCV** | ✔ | ✔ | ✔ |
| 5 | Hi-Tech Factory, Repair Facility, Gun Turret; WOR (O, requires Barracks) | **Carryall**; HF upgrade #2 → **Launcher** (A, H); WOR upgrade (H) → Troopers squad | Launcher | Launcher | WOR; no Launcher |
| 6 | Starport; Rocket Turret (CY upgrade #2) | HF upgrade #3 → **Siege Tank** (A, H); WOR upgrade (O) | Siege | Siege | No Siege: only as reinforcements, and it is not in the CHOAM stock on lvl 6 either |
| 7 | **IX Research Centre** | Sonic Tank (A) / Devastator (H) / Deviator (O); Hi-Tech upgrade → **Ornithopter** (A, O); Ordos: 2nd HF upgrade → Siege Tank | Sonic, Thopter | Devastator | Deviator, Thopter, Siege |
| 8 | **Palace** (requires Starport) | Fremen / Death Hand / Saboteur | Fremen | Death Hand | Saboteur |
| 9 | — | — | | | |

The original (OpenDUNE `structureinfo.c`: `availableCampaign` and `upgradeCampaign[]`):
- `upgradeCampaign` by builder: Light Fctry [3]; Heavy Fctry [4, 5, 6]; Hi-Tech [7]; WOR [6]; Const Yard [4, 6]; Barracks [2].
- Special rules in `Structure_GetBuildable` and `Structure_IsUpgradable`:
  - the LF is available to everyone except the Harkonnen from level 2;
  - the Harkonnen WOR is available from level 2 and does not require Barracks;
  - for the Ordos the Trike is replaced by the Raider Trike;
  - the Ordos need 1 upgrade fewer for the Siege Tank, but their second HF upgrade is allowed only from level 7;
  - the Harkonnen cannot upgrade the Hi-Tech (no Ornithopters);
  - the Harkonnen WOR is upgraded from level 5.

### 4.2 Dune Legacy: `config/ObjectData.ini.default`

Structures (TechLevel and prerequisites):

| Structure | TL | Prerequisites | Cost | HP | Power | House-specific rules |
|---|---|---|---|---|---|---|
| Slab1 / Slab4 | 1 / 4 (+CY upgrade 1) | — | 5 / 20 | — | 0 | |
| Windtrap | 1 | — | 300 | 200 | **+100** | |
| Refinery | 1 | Windtrap | 400 | 450 | −30 | capacity 1005 |
| Radar | 2 | Windtrap | 400 | 500 | −30 | view range 10 |
| Spice Silo | 2 | Windtrap, Refinery | 150 | 150 | −5 | capacity 1000 |
| Barracks | 2 | Windtrap, Radar | 300 | 300 | −10 | `Builder(H)=Invalid`: the Harkonnen cannot build it |
| Light Factory | 2 (H, S: 3) | Windtrap, Refinery | 400 | 350 | −20 | |
| WOR | 5 (H: 2) | Windtrap, Radar, Barracks (H: no Barracks) | 400 | 400 | −20 | `Builder(A)=Invalid`: the Atreides cannot build it |
| Heavy Factory | 4 | Windtrap, Radar, Light Factory | 600 | 200 | −35 | |
| Wall | 4 | Windtrap, Radar | 50 | 50 | 0 | |
| Hightech Factory | 5 | Windtrap, Radar, Light Factory | 500 | 400 | −35 | |
| Repair Yard | 5 | Windtrap, Radar, Light Factory | 700 | 200 | −20 | |
| Gun-Turret | 5 | Windtrap, Radar | 125 | 200 | −10 | damage 20, range 5 |
| Starport | 6 | Windtrap, Refinery | 500 | 500 | −50 | |
| Rocket-Turret | 6 (+CY upgrade 2) | Windtrap, Radar | 250 | 200 | −25 | damage 30, range 8 |
| House IX | 7 | Windtrap, Refinery, Starport | 500 | 400 | −40 | |
| Palace | 8 | Starport | 999 | 1000 | −80 | |

Units (who builds them, TL, builder upgrade):

| Unit | Built at | TL / upgrade | Cost | HP | House restrictions |
|---|---|---|---|---|---|
| Soldier | Barracks | (Barracks TL 2) | 60 | 20 | not available to H (no Barracks) |
| Trooper | WOR | (WOR TL) | 100 | 45 | not available to A (no WOR) |
| Trike | Light Factory | — | 150 | 100 | **A only** |
| Raider Trike | Light Factory | — | 150 | 80 | **O only** |
| Quad | Light Factory | TL3, upgrade 1 (**H: TL1, no upgrade**) | 200 | 130 | all |
| Tank | Heavy Factory | — | 300 | 200 | all |
| Harvester | Heavy Factory | — | 300 | 150 | all |
| MCV | Heavy Factory | TL4, upgrade 1 | 900 | 150 | all |
| Launcher | Heavy Factory | TL5, upgrade 2 | 450 | 100 | **not available to O** |
| Siege Tank | Heavy Factory | TL6, upgrade 3 (**O: TL7, upgrade 2**) | 600 | 300 | all |
| Sonic Tank | Heavy Factory | requires House IX | 600 | 110 | **A only** |
| Devastator | Heavy Factory | requires House IX | 800 | 400 | **H only** |
| Deviator | Heavy Factory | requires House IX | 750 | 120 | **O only** |
| Carryall | Hightech Factory | — | 800 | 100 | all |
| Ornithopter | Hightech Factory | TL7, upgrade 1, requires House IX | 600 | 25 | **not available to H** |
| Saboteur / Fremen / Death Hand | Palace | special weapon | — | — | see §1.6 |

How Dune Legacy differs from the original:
1. There are no Infantry and Troopers squads: only single Soldiers and Troopers; up to 5 fighters fit in one tile. The scenario `Infantry` and `Troopers` entries are turned into 3 single fighters (`INIMapLoader::loadReinforcements`).
2. The Harkonnen get the Quad right away with the LF, with no upgrade.
3. The maximum builder upgrade level is computed from what that House can actually build there (`BuilderBase::getMaxUpgradeLevel`). That is why the Harkonnen LF cannot be upgraded at all.
4. Everything is configured from INI with per-House overrides: `Price(A)=…`, `TechLevel(H)=…`, `Builder(O)=Invalid`. For our game this is a convenient data model (see §8).

---

## 5. Differences Between the Houses

### 5.1 The "Who Builds What" Matrix (original = Dune Legacy, except where noted)

| | Atreides | Harkonnen | Ordos |
|---|---|---|---|
| Barracks / Soldier | ✔ | ✘ | ✔ |
| WOR / Trooper | ✘ | ✔ (from lvl 2, no Barracks needed) | ✔ (from lvl 5, requires Barracks) |
| Light Factory | from lvl 2 | **from lvl 3** | from lvl 2 |
| Trike | ✔ | ✘ | ✘ (Raider Trike instead) |
| Raider Trike | ✘ | ✘ | ✔ |
| Quad | ✔ | ✔ | ✔ |
| Tank, Harvester, MCV, Carryall | ✔ | ✔ | ✔ |
| Launcher | ✔ | ✔ | ✘ |
| Siege Tank | lvl 6 | lvl 6 | **lvl 7** |
| Ornithopter | ✔ | ✘ | ✔ |
| Super tank (House IX) | Sonic Tank | Devastator | Deviator |
| Palace superweapon | Fremen | Death Hand | Saboteur |

Foreign technology can be obtained by capturing an enemy factory with infantry. A captured LF or HF builds what is allowed to the factory's owner House. For example, a Sonic Tank at a captured Atreides HF or a Devastator at a Harkonnen HF. Through the Starport you can buy vehicles your own House does not produce (Trike, Launcher, etc.), if they are in the CHOAM stock.

### 5.2 Exclusive Units: Gameplay Role

- **Sonic Tank (A):** a sound wave with a range of 8 hits everything in a line, including friendly units. Weak in close combat (HP 110).
- **Ornithopter (A, O):** a fast, fragile attack aircraft (HP 25). In the original it cannot be controlled: it attacks on its own.
- **Devastator (H):** the most heavily armored tank (HP 400, a powerful gun, damage 40), very slow. It can self-destruct with a nuclear explosion (the Destruct button).
- **Death Hand (H):** an area-effect missile from the Palace, inaccurate.
- **Deviator (O):** gas-filled missiles temporarily switch enemy units to the shooter's side. In the original a gassed unit always goes to the Ordos, even if the Deviator belongs to another House. In Dune Legacy the gas affects all units except Carryalls, worms and Frigates. The chance depends on the target's House (see §5.3).
- **Raider Trike (O):** the fastest ground unit, fragile.
- **Saboteur (O):** a saboteur from the Palace, blows up a structure on contact.
- **Fremen (A):** uncontrollable elite infantry from the Palace.

### 5.3 Hidden House Parameters (bonuses and penalties)

In the original, unit prices and stats are the same for all Houses. The differences are set by House parameters (`OpenDUNE table/houseinfo.c`):

| Parameter | H | A | O | Fremen | Sardaukar | Mercenaries | Meaning |
|---|---|---|---|---|---|---|---|
| toughness | 200 | 77 | 128 | 10 | 10 | 0 | The probability (in units of 1/256) that a Deviator will turn a unit of this House, and the speed at which the effect wears off. Deviators take Harkonnen units most often; Sardaukar and Fremen are nearly immune |
| degradingAmount | 3 | 1 | 2 | 1 | 1 | 1 | How much HP structures not on concrete lose per degradation tick (down to 50 % HP). Harkonnen structures wear out fastest |
| specialCountDown | 600 | 300 | 300 | 300 | 600 | 300 | Palace cooldown: twice as long for H and S |
| starportDeliveryTime | 10 | 10 | 10 | 0 | 0 | 0 | Frigate delivery delay |

In Dune Legacy:
- **Degradation** (`StructureBase.cpp`): when power is insufficient and the "Concrete Required" option is on, a structure loses a share of HP every 15 s, down to 50 %. Multiplier: A and Fremen ×1 %, O ×2 %, H and S ×3 %, Mercenaries ×5 %.
- **Palace cooldown:** 10 min (H, S), 5 min (others).
- **Vulnerability to the Deviator** (`sand.cpp::getDeviateWeakness`; campaign only, 100 % in custom games): H 78 %, O 50 %, Mercenaries 50 %, A 30 %, Fremen 8 %, Sardaukar 4 %. This is a direct port of the original's toughness.

### 5.4 How the Houses Play

- **Atreides:** a balanced army. Missile Tanks and Siege Tanks early (lvl 5–6), air power, the best super tank for defending against crowds. There is no WOR infantry, but the Fremen replace it.
- **Harkonnen:** power and armor. Heavy infantry available early (WOR from lvl 2), but the Light Factory comes later and without Trikes. No air power. Structures wear out faster, and the Ordos Deviator is especially dangerous to them. The Death Hand wrecks a base but recharges longer.
- **Ordos:** speed and cunning. Raiders, capturing structures, the Deviator, the Saboteur. No Missile Tank, and the Siege Tank only from lvl 7. On level 6 they fight the Atreides Siege Tanks with almost nothing but tanks and turrets, which makes it one of the hardest levels.

---

## 6. Interface and Notifications

### 6.1 The Original Dune II (DOS, 320×200)

- **Top bar:** the "Mentat" (reference and briefing) and "Options" (save, load, speed, quit) buttons, a message line, and a credits counter with "rolling" digits on the right. The interface frames are tinted in the House color.
- **Right panel:** a portrait of the selected object, its name, a health bar and 4 command buttons with hotkeys (`OpenDUNE unitinfo.c actionsPlayer`):
  - combat units: Attack / Move / Retreat / Guard;
  - Devastator: Attack / Move / Destruct / Guard;
  - Harvester: Harvest / Move / Return / Stop;
  - MCV: Deploy / Move / Retreat / Stop;
  - Saboteur: Sabotage / Move / Retreat / Guard.
- **Builder structures:** the panel shows the current production item; Build/Place, Upgrade and Repair buttons. What to build is chosen in a separate "factory window" with a list of icons, prices and descriptions.
- **Windtrap and refinery:** selecting a windtrap shows power "required / produced", selecting a refinery or silo shows spice "stored / maximum". The original has no permanent power bar.
- **Radar:** a minimap at the bottom right. Works only with an Outpost and sufficient power; switching it on and off is accompanied by static and a voice.
- **1992-style controls:** there is no selection box and no groups, and one object is selected at a time. You first choose a command (a button or a key), then the target. Clicking the ground does not issue an order by itself.

### 6.2 Dune Legacy: the Screen (`src/GameInterface.cpp`)

- **Top bar** (House color): a scrolling news ticker (NewsTicker), the Options and Mentat buttons.
- **Right sidebar** (House color), top to bottom:
  1. **Radar/minimap.** A left click or drag moves the camera. A right click gives the selected units an order to that point. With an active Move/Attack/Capture cursor, a click on the radar executes that order.
  2. A button for quickly selecting all Ornithopters (in this build; the O key).
  3. **Vertical power bar** (green): production/consumption, the middle of the bar = balance.
  4. **Spice bar** (orange): stored/capacity.
  5. **Credits counter** (sprite digits).
  6. **Object panel.** For units: Move, Attack, Capture, Carryall drop, Return (harvester), Deploy (MCV), Destruct (Devastator), Repair, plus the modes Guard / Area Guard / Stop / Ambush / Hunt / Retreat. For a structure: Repair, Upgrade (with progress). For a builder: a **production list** with icons and prices. For a windtrap: Required/Produced. For a refinery and silo: Capacity/Stored. For a Palace: a timer and the READY label. For a Starport: ordering and dispatch.
- **Chat** and tutorial hints are displayed over the map on the left.

### 6.3 The Mouse in Dune Legacy

| Action | Result |
|---|---|
| LMB on your own object | Select |
| LMB on a unit that is already the only one selected | Select all units of this type on screen (`Map::selectObjects`) |
| LMB drag (box) | Multi-select your own units |
| Shift + LMB / box | Add to or remove from the selection |
| LMB on an enemy object | View information (if none of your own are selected) |
| RMB on the map with units selected | A context order: move, attack an enemy, infantry capturing a structure, a harvester collecting spice, driving in for repair, etc. |
| RMB with a special cursor | Cancels the mode |
| LMB in Move / Attack / Capture / Carryall drop modes (M/A/C/D buttons) | Execute the order at the point |
| LMB on an icon in the builder list | Add to the queue; **Shift = +5** |
| RMB on an icon | Remove from the queue; **Shift = −5**. RMB on the item currently being produced puts it on hold (On Hold); another RMB cancels it |
| A completed structure | Placement cursor: a grid shows validity, LMB places the structure. The P key or a click on the icon toggles the mode |
| Mouse wheel | Scrolls the sidebar lists |
| Screen edge / arrow keys | Scrolls the map |

### 6.4 Dune Legacy Hotkeys (`Game::handleKeyInput`, manual.html)

| Key | Action |
|---|---|
| Esc | Menu (pause) |
| Space | Pause / resume |
| M / A / C | Cursor: move / attack / capture (infantry) |
| D | Request a Carryall for transport (if the option is enabled) |
| H | Send the harvester to base |
| R | Repair the selected structure or send a vehicle to the Repair Facility |
| U | Upgrade the selected builder |
| P | Place the completed structure (CY selected) |
| G | Next Construction Yard |
| F | Next factory (Barracks, WOR, LF, HF, Hi-Tech, Starport) |
| O | Select all Ornithopters |
| Ctrl+1…9 | Save the selection as a group |
| 1…9 | Select a group (pressing again centers the camera); Shift+1…9 adds the group to the selection |
| 0 / Ctrl+0 | Clear the selection / remove the selected units from all groups |
| − / + | Game speed slower / faster (not in network games) |
| F1 / F2 / F3 | Zoom ×1 / ×2 / ×3 |
| F4 / F5 / F6 | Skip 10 s / 30 s / 2 min (single-player and replay) |
| T | Show game time |
| F10 / F11 / F12 | Toggle sound / music / FPS on and off |
| Enter | Chat; Alt+Enter: fullscreen mode |
| Print / Ctrl+P | Screenshot (Shift: periodic screenshots) |
| Arrow keys | Scroll the map |

### 6.5 Notifications: Voice and Scrolling Ticker

Dune Legacy voices (`include/FileClasses/SFXManager.h::Voice_enum`) and the events that trigger them:

| Event | Voice (ID in Dune Legacy) | Ticker text |
|---|---|---|
| Structure built | ConstructionComplete — "Construction complete" | "Construction is complete" |
| Unit built | UnitDeployed — "Unit deployed" | — |
| Harvester built or delivered; a harvester's first exit from a new refinery | HarvesterDeployed — "Harvester deployed" | — |
| Ornithopter or Carryall built | UnitLaunched — "Unit launched" | — |
| Vehicle repaired | VehicleRepaired | — |
| Frigate arrived (Starport) | FrigateHasArrived | "Frigate has arrived" |
| The player's structure is under fire (no more often than once per set interval) | BaseIsUnderAttack — "Our base is under attack" | — |
| A worm targeted a player's object for the first time | WarningWormSign — "Warning: Wormsign" | — |
| A worm stopped under the player's infantry | SomethingUnderTheSand | — |
| A spice bloom was stepped on | BloomLocated | — |
| Radar switched on / off (power, Outpost) | RadarActivated / RadarDeactivated | — |
| A Death Hand is incoming | MissileApproaching | "Missile is approaching" |
| A saboteur was released | SaboteurApproaching | "Saboteur is approaching" |
| Victory / defeat | YourMissionIsComplete / YouHaveFailedYourMission | — |
| Order to a vehicle | Acknowledged / Affirmative, Reporting on selection | — |
| Order to infantry | MovingOut / InfantryOut, YesSir on selection | — |
| House selection in the menu | HouseAtreides / HouseHarkonnen / HouseOrdos | — |

Other ticker messages:
- "Not enough money"
- "Cannot place %s here" / "Cannot place slab here"
- "You cannot deploy here" (MCV)
- "As insufficient spice storage is available, spice is lost"
- "New Starport prices"
- "This unit is sold out"
- "Palace is ready"
- "Unable to spawn Fremen"
- "House '%s' has been defeated"
- the status of the selected harvester ("Harvester: X% full and harvesting / returning / awaiting pickup")

**The original has a richer set:** phrases are assembled from fragments (`OpenDUNE table/sound.c`, `g_feedback`):
- "Warning, enemy unit approaching from the north/east/south/west";
- "[Atreides/Harkonnen/Ordos/Fremen/Sardaukar] unit approaching / destroyed / deployed / launched";
- "[House] structure destroyed";
- "… structure captured";
- a countdown "five…one" before the missile;
- "Missile launched", "Warning: missile approaching".

Each House is voiced by its own voice: the file prefixes are A/H/O. For the Fremen, Sardaukar and Mercenaries the House table lists their own voice files (`afremen.voc`, `asard.voc`, `amerc.voc`). For the remake we recommend bringing back the "enemy unit approaching from [direction]" and "[House] structure destroyed" notifications: they help a lot with orientation.

### 6.6 Tutorial Hints (Dune Legacy, `HumanPlayer.cpp`)

The first time each type of structure is built, a short note from `MESSAGE.ENG` is shown (what the structure does). In addition, there are tips at the start of the game: "look for spice fields"; "the structure is not on full concrete and will need repair over time". This can be disabled with the "Show Tutorial Hints" option.

---

## 7. House Colors and Visual Style

House colors in the original are defined by ranges of the `IBM.PAL` palette; the engine recolors sprites by substitution (remap). The base indices (`Colors.h` in Dune Legacy):
- Harkonnen 144;
- Atreides 160;
- Ordos 176;
- Fremen 192;
- Sardaukar 208;
- Mercenaries 224.

The values below are taken from `d2tm.pal` (D2TM). This palette matches IBM.PAL at all the indices I checked against the Dune Legacy constants: 47 (mountains), 83 (orange), 105 (sand), 111 (spice), 116 (thick spice), 123 (yellow), 231 (red).

| House | Index | Shades (light to dark) | Perceived as |
|---|---|---|---|
| Harkonnen | 144–150 | `#D60000` `#B60000` `#990000` `#7D0000` `#590000` `#3C0000` `#200000` | Blood red |
| Atreides | 160–166 | `#5079D6` `#3455B6` `#283C99` `#18207D` `#080C59` `#04043C` `#000020` | Blue / steel |
| Ordos | 176–182 | `#4CD64C` `#38B638` `#249924` `#187D18` `#0C590C` `#043C04` `#002000` | Toxic green |
| Fremen | 192–198 | `#D67910` `#B66108` `#994C04` `#793C04` `#5D2800` `#3C1800` `#200C00` | Sandy orange / ochre-brown |
| Sardaukar | 208–214 | `#F269F2` `#CE48CE` `#AA30AA` `#891889` `#650C65` `#400040` `#200020` | Purple / violet |
| Mercenaries | 224–230 | `#D69500` `#B67D00` `#996900` `#7D5000` `#593800` `#3C2400` `#201000` | Golden ochre / yellow-brown |

The task's assumption that the Fremen are "gray-beige" is not confirmed by the original palette: their range is a warm sandy orange. The Mercenaries are golden, not orange. If our game needs a better contrast between the Fremen and the sand, the gray-beige variant can be used. This is a deliberate departure from the original.

Other Dune Legacy and world colors:
- sand `#FFD27D`;
- spice `#F2AE24`, thick spice `#B67D0C`;
- rock and mountains `#695004`;
- rock on the minimap `#555555`;
- a spice bloom on the minimap is red.

**Visual style (recommendations for the 3D remake, in the Westwood spirit):**
- **Atreides:** a blue-steel palette, clean noble shapes, light metal with blue inserts. The emblem in the Westwood tradition is a hawk. Heroic music, a cold blue interface.
- **Harkonnen:** a black-and-red palette, heavy angular industrial shapes, rivets, soot. The emblem in the Westwood tradition is a ram's head. A dark red interface.
- **Ordos:** a green-and-gold palette, smooth streamlined high-tech shapes, a feel of secrecy and money. The emblem in the Westwood tradition is a snake. A green interface.
- **Sardaukar:** purple with dark gold, imperial luxury and militarism.
- **Fremen:** desert cloaks (stillsuits), sandy and brown tones.
- **Mercenaries:** a motley mix of equipment, ochre and khaki.

The House crests on the Dune II selection screen need to be checked against the original graphics.

In Dune Legacy the House color is applied to more than units. The top bar and sidebar (`UI_TopBar` and `UI_SideBar` with a houseID parameter), the Mentat buttons, the pieces of the region selection map, and the cutscene text (`palette[houseToPaletteIndex[house]+1]`) are all recolored with it. In the finale cutscene the whole planet is recolored in the House color.

---

## 8. Recommendations for Implementing in three.js

1. **Keep the campaign data in JSON:** levels, regions and texts separately from the mission maps. A minimal schema:

```json
{
  "house": "atreides",
  "levels": [
    { "level": 3, "techLevel": 3, "briefingAnim": "quad",
      "mapState": { "atreides": [8,15,23], "ordos": [12,16,17,18], "harkonnen": [1,2,11] },
      "tickerTexts": { "8": "…", "12": "…" },
      "choices": [ { "region": 1, "arrow": 2, "pos": [38,16], "mission": "A005" },
                   { "region": 2, "arrow": 1, "pos": [72,10], "mission": "A006" },
                   { "region": 3, "arrow": 1, "pos": [104,8], "mission": "A007" } ] }
  ]
}
```

   The arrow coordinates in the example are illustrative; the real ones are set against our own map of Dune.

2. **The mission format repeats the original's sections** (this simplifies porting all 66 scenarios):
   - `basic`: winFlags/loseFlags, starting camera, map size;
   - `houses`: credits, quota, brain, maxUnit;
   - `units`, `structures`: House, type, HP %, tile, direction, AI mode;
   - `reinforcements`: House, type, location (Homebase / Enemybase / compass directions / Air / Visible), minute, repeat;
   - `aiTeams`: House, behavior, movement type, min, max;
   - `choam`;
   - `spice`: fields and blooms.

   The terrain in the original is generated from `Seed`: the generator is described in Dune Legacy's `src/MapSeed.cpp` and has already been ported to `E:\dev\dune\docs\research\mapseed_port.js`.

3. **Technology:** `techLevel`, `builder`, `upgradeLevel`, `prerequisites`, plus a per-House override table, as in `ObjectData.ini`. This one model describes all the restrictions: the Harkonnen without Barracks and Trikes, the Atreides without WOR, the Ordos without Launcher and with a late Siege Tank.

4. **Campaign flow:**
   - House selection → the Mentat's description of the House and confirmation;
   - [region map] → Mentat briefing → mission → debriefing (victory or defeat);
   - after a victory: statistics and rank;
   - after lvl 4 and lvl 8: the "Meanwhile" cutscene;
   - after lvl 9: the finale.

   After a defeat: the map of the same level again, with the lost region excluded.

5. **Texts:** the briefings from §3, plus our own debriefings and map phrases. We do not use the original texts.

6. **Notifications:** an event system with priorities and anti-spam (like `ATTACKNOTIFICATIONTIME` for "base under attack"), plus compound phrases "[House] [unit/structure] [event] [direction]".

---

## Appendix A. Data for All 66 Original Scenarios

The data was extracted by script from `SCEN{A,H,O}001–022.INI` (copies in the D2TM repository, `resources/bin/campaign/maps/`). Only numbers and compositions are given; no text was copied.

Notation:
- **Infantry(squad)** and **Troopers(squad)** — squads of 3 fighters (in Dune Legacy they turn into 3 single Soldiers or Troopers).
- `@12m` — the minute of game time; `↻` — the reinforcement repeats at the same interval.
- The prefixes `A:`, `H:`, `O:`, `S:` — the reinforcing House, when there are several enemies; `S:` — Sardaukar.
- The base is listed without slabs (`Concrete`) but with walls (`Wall`).
- "Worms" — the number of sandworms (House Fremen) on the map.
- A 62×62 map corresponds to `MapScale=0` (64×64 with the border), 32×32 to `MapScale=1`.
- The variants of one level are in arrow order: variant A corresponds to REG1, B to REG2, C to REG3.
- The directions per the Dune RTS Wiki are given in §3.

In all scenarios the player starts with only a Construction Yard (plus the troops from the table). The player's `MaxUnit` is 25; the enemies' is 15–25.

#### Atreides — Level 1

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA001 | 32×32 | 1000 / 1000 | Ordos (0) | Soldier×3, Trike×2 | Ordos: Soldier×12 | — | — | — | 0 |

#### Atreides — Level 2

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA002 | 32×32 | 1200 / 2700 | Ordos (0) | Trike×3, Soldier×3, Quad | Ordos: Raider Trike×5, Soldier×3, Trooper×3 | Ordos: Const Yard, Spice Silo, Outpost, Windtrap, Refinery, Barracks | — | — | 0 |
| SCENA003 | 32×32 | 1200 / 2700 | Ordos (0) | Trike×3, Soldier×3, Quad | Ordos: Raider Trike×5, Soldier×3, Trooper×3 | Ordos: Const Yard, Spice Silo, Windtrap, Barracks, Refinery, Outpost | — | — | 0 |
| SCENA004 | 32×32 | 1200 / 2700 | Ordos (0) | Trike×3, Soldier×3, Quad | Ordos: Raider Trike×5, Trooper×3, Soldier×3 | Ordos: Const Yard, Spice Silo, Windtrap, Refinery, Barracks, Outpost | — | — | 0 |

#### Atreides — Level 3

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA005 | 62×62 | 1500 | Harkonnen (300) | Soldier×3, Quad×2, Trike×2, Infantry(squad)×1 | Harkonnen: Quad×7, Trooper×7, Troopers(squad)×1 | Harkonnen: Windtrap×2, Spice Silo, Refinery, WOR, Outpost, Const Yard, Light Fctry | Trooper×2 @5m; Trooper×2 @10m; Trooper×2 @20m | Trike @6m; Infantry(squad) @6m; Infantry(squad)×2 @11m | 3 |
| SCENA006 | 62×62 | 1500 | Harkonnen (300) | Soldier×3, Quad×2, Trike×2, Infantry(squad)×1 | Harkonnen: Quad×7, Trooper×7, Troopers(squad)×1 | Harkonnen: Windtrap×2, Const Yard, Light Fctry, Outpost, WOR, Spice Silo, Refinery | Trooper×2 @5m; Trooper×2 @10m; Trooper×2 @20m | Trike @6m; Infantry(squad) @6m; Infantry(squad)×2 @11m | 2 |
| SCENA007 | 62×62 | 1500 | Harkonnen (300) | Soldier×3, Trike×2, Quad×2, Infantry(squad)×1 | Harkonnen: Quad×7, Trooper×7, Troopers(squad)×1 | Harkonnen: Windtrap×2, Spice Silo, Light Fctry, Const Yard, Refinery, WOR, Outpost | Trooper×2 @5m; Trooper×2 @10m; Trooper×2 @20m | Trike @6m; Infantry(squad) @6m; Infantry(squad)×2 @11m | 3 |

#### Atreides — Level 4

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA008 | 62×62 | 1500 | Harkonnen (400) | Quad×4, Infantry(squad)×3, Trike×2 | Harkonnen: Troopers(squad)×7, Quad×5, Tank×5 | Harkonnen: Wall×16, Windtrap×2, Spice Silo, Refinery, Const Yard, WOR, Light Fctry, Heavy Fctry, Outpost | H:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 3 |
| SCENA009 | 62×62 | 1500 | Harkonnen (400) | Quad×4, Infantry(squad)×3, Trike×2 | Harkonnen: Troopers(squad)×8, Quad×6, Tank×6 | Harkonnen: Wall×19, Windtrap×2, Heavy Fctry, Const Yard, WOR, Light Fctry, Spice Silo, Outpost, Refinery | H:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 3 |
| SCENA010 | 62×62 | 1500 | Harkonnen (400) | Quad×4, Infantry(squad)×3, Trike×2 | Harkonnen: Tank×8, Troopers(squad)×6, Quad×5 | Harkonnen: Wall×22, Windtrap×2, Light Fctry, Const Yard, Heavy Fctry, WOR, Outpost, Spice Silo, Refinery | H:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 3 |

#### Atreides — Level 5

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA011 | 62×62 | 1500 | Ordos (700) | Quad×3, Tank×3, Infantry(squad)×2 | Ordos: Tank×8, Troopers(squad)×2, Raider Trike, Quad | Ordos: Wall×32, Turret×8, Windtrap×4, Const Yard×2, Refinery×2, Hi-Tech, Outpost, Light Fctry, Heavy Fctry, WOR, Repair, Spice Silo | Troopers(squad)×3 @11m; Quad @20m; Tank @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENA012 | 62×62 | 1500 | Ordos (500) | Tank×3, Quad×3, Infantry(squad)×2 | Ordos: Tank×11, Troopers(squad)×5, Quad | Ordos: Wall×31, Turret×10, Windtrap×4, Spice Silo×3, Refinery×2, Const Yard, Hi-Tech, Heavy Fctry, Light Fctry, Outpost, Repair | Troopers(squad)×3 @11m; Quad @20m; Tank @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENA013 | 62×62 | 1500 | Ordos (600) | Quad×3, Tank×3, Infantry(squad)×2 | Ordos: Tank×8, Troopers(squad)×3, Quad, Raider Trike | Ordos: Wall×19, Turret×7, Windtrap×3, Spice Silo×2, Refinery×2, Hi-Tech, Const Yard, Repair, Light Fctry, Outpost, Heavy Fctry, WOR | Troopers(squad)×3 @11m; Quad @20m; Tank @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |

#### Atreides — Level 6

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA014 | 62×62 | 1700 | Harkonnen (825) | Quad×3, Tank×3, Launcher×2 | Harkonnen: Siege Tank×8, Launcher×7, Tank×4, Quad×2, Troopers(squad)×1 | Harkonnen: Wall×36, R-Turret×6, Windtrap×5, Const Yard×2, Heavy Fctry×2, Turret×2, Repair×2, WOR×2, Spice Silo×2, Refinery×2, Outpost, Hi-Tech, Light Fctry | Troopers(squad)×2 @12m; Quad @12m; Troopers(squad) @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Siege Tank×2 @21m | 2 |
| SCENA015 | 62×62 | 1700 | Harkonnen (700) | Quad×3, Tank×3, Launcher×2 | Harkonnen: Siege Tank×7, Tank×5, Quad×3, Launcher×3, Troopers(squad)×1 | Harkonnen: Wall×32, R-Turret×7, Windtrap×4, Const Yard×2, Heavy Fctry×2, WOR×2, Turret×2, Spice Silo×2, Refinery×2, Hi-Tech, Outpost, Light Fctry, Repair | Troopers(squad)×2 @12m; Quad @12m; Troopers(squad) @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Siege Tank×2 @21m | 2 |
| SCENA016 | 62×62 | 1700 | Harkonnen (720) | Tank×3, Quad×3, Launcher×2 | Harkonnen: Siege Tank×8, Tank×6, Launcher×3, Quad×3 | Harkonnen: Wall×31, R-Turret×7, Windtrap×6, Const Yard×2, Heavy Fctry×2, Turret×2, Spice Silo×2, Refinery×2, WOR×2, Repair, Outpost, Hi-Tech, Light Fctry | Troopers(squad)×2 @12m; Quad @12m; Troopers(squad) @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Siege Tank×2 @21m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:4, Launcher:3, Harvester:2, MCV:2, Carryall:2

#### Atreides — Level 7

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA017 | 62×62 | 2000 | Ordos (1000) | Siege Tank×2, Quad×2, Tank×2, Launcher | Ordos: Siege Tank×8, Quad×5, Deviator×3, Troopers(squad)×2, Tank×2, Raider Trike | Ordos: Wall×32, R-Turret×9, Windtrap×6, Heavy Fctry×3, WOR×2, Spice Silo×2, Refinery×2, IX, Const Yard, Repair, Hi-Tech, Light Fctry, Outpost | Troopers(squad)×2 @12m; Quad @12m; Deviator @20m; Siege Tank @20m; Tank @20m | Tank @13m; Launcher @13m; Sonic Tank @21m; Siege Tank @21m | 2 |
| SCENA018 | 62×62 | 1800 | Ordos (1000) | Quad×2, Tank×2, Siege Tank×2, Launcher | Ordos: Siege Tank×7, Deviator×4, Troopers(squad)×4, Quad×3, Tank×2 | Ordos: Wall×20, R-Turret×9, Windtrap×3, Heavy Fctry×2, Spice Silo×2, Refinery×2, Light Fctry×2, WOR×2, Outpost, Const Yard, IX, Hi-Tech, Repair | Troopers(squad)×2 @12m; Quad @12m; Deviator @20m; Siege Tank @20m; Tank @20m | Tank @13m; Launcher @13m; Sonic Tank @21m; Siege Tank @21m | 2 |
| SCENA019 | 62×62 | 2000 | Ordos (1000) | Quad×2, Siege Tank×2, Tank×2, Launcher | Ordos: Siege Tank×6, Troopers(squad)×5, Quad×4, Deviator×4, Tank×3 | Ordos: Wall×22, R-Turret×7, Windtrap×4, Heavy Fctry×3, Spice Silo×2, WOR×2, Refinery×2, Repair, IX, Hi-Tech, Outpost, Const Yard, Light Fctry | Troopers(squad)×2 @12m; Quad @12m; Deviator @20m; Siege Tank @20m; Tank @20m | Tank @13m; Launcher @13m; Sonic Tank @21m; Siege Tank @21m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:5, Siege Tank:3, Launcher:4, Harvester:2, MCV:2, Carryall:2

#### Atreides — Level 8

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA020 | 62×62 | 2000 | Harkonnen (1000), Ordos (1000) | Launcher×2, Siege Tank×2, Quad, Sonic Tank, Tank | Harkonnen: Launcher×6, Siege Tank×5, Devastator×3; Ordos: Siege Tank×4, Deviator×3 | Ordos: Wall×58, R-Turret×8, Windtrap×3, Refinery×2, Spice Silo×2, Heavy Fctry, WOR, Light Fctry, Hi-Tech, Const Yard, Repair; Harkonnen: Wall×66, R-Turret×8, Windtrap×5, Refinery×2, Spice Silo×2, Const Yard, Heavy Fctry, WOR, Light Fctry, Palace, Repair, Hi-Tech | H:Troopers(squad) @12m; O:Siege Tank @12m; H:Troopers(squad) @14m; H:Devastator @14m; O:Launcher @21m; O:Deviator @21m; S:Troopers(squad)×4 @30m↻ | Siege Tank @13m; Launcher @13m; Infantry(squad) @22m; Siege Tank @22m; Sonic Tank @22m | 2 |
| SCENA021 | 62×62 | 2000 | Harkonnen (1000), Ordos (1000) | Siege Tank×2, Launcher×2, Sonic Tank, Tank, Quad | Ordos: Siege Tank×6, Deviator×3, Quad×2, Tank; Harkonnen: Devastator×4, Launcher×3, Siege Tank×2 | Ordos: Wall×50, R-Turret×6, Windtrap×5, Spice Silo×2, Refinery×2, Const Yard, WOR, Light Fctry, Hi-Tech, Heavy Fctry, Palace; Harkonnen: Wall×50, R-Turret×6, Windtrap×4, Spice Silo×2, Refinery×2, Const Yard, Hi-Tech, WOR, Heavy Fctry, Repair, Light Fctry | O:Troopers(squad) @12m; O:Siege Tank @12m; H:Troopers(squad) @14m; H:Devastator @14m; O:Launcher @21m; O:Deviator @21m; S:Troopers(squad)×4 @30m↻ | Siege Tank @13m; Launcher @13m; Infantry(squad) @22m; Siege Tank @22m; Sonic Tank @22m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:5, Siege Tank:4, Launcher:4, Harvester:2, MCV:2, Carryall:2, Thopter:3

#### Atreides — Level 9

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENA022 | 62×62 | 1000 | Harkonnen (1500), Ordos (1500), Sardaukar (2500) | Siege Tank×4, Sonic Tank×2 | Ordos: Siege Tank×3, Deviator×2; Harkonnen: Devastator×3, Launcher×2; Sardaukar: Launcher×3, Siege Tank | Ordos: Wall×29, R-Turret×6, Refinery×2, Light Fctry×2, Palace, Spice Silo, Const Yard, Hi-Tech, WOR, Heavy Fctry; Harkonnen: Wall×37, R-Turret×4, Windtrap×3, Const Yard×2, Turret×2, Heavy Fctry, Hi-Tech, Spice Silo, Refinery, WOR, Light Fctry, Repair, Palace; Sardaukar: Wall×51, R-Turret×9, Windtrap×3, Const Yard×2, WOR×2, Repair, Hi-Tech, Refinery, Heavy Fctry, Palace | S:Troopers(squad) @12m↻; O:Siege Tank @12m↻; S:Troopers(squad) @14m↻; H:Siege Tank @14m↻; O:Troopers(squad) @21m↻; O:Deviator @21m↻; S:Troopers(squad)×4 @30m↻ | Sonic Tank @13m; Launcher @13m; Troopers(squad) @22m; Siege Tank @22m; Sonic Tank @22m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:6, Launcher:5, Siege Tank:6, Harvester:4, MCV:2, Thopter:5, Carryall:2

#### Harkonnen — Level 1

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH001 | 32×32 | 1000 / 1000 | Atreides (0) | Trooper×3, Quad×2 | Atreides: Infantry(squad)×12, Soldier | — | — | — | 0 |

#### Harkonnen — Level 2

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH002 | 32×32 | 1200 / 2700 | Atreides (100) | Quad×4, Trooper×3 | Atreides: Infantry(squad)×6, Trike×5, Quad | Atreides: Windtrap×2, Const Yard, Outpost, Barracks, Refinery | — | — | 0 |
| SCENH003 | 32×32 | 1200 / 2700 | Atreides (100) | Quad×4, Trooper×3 | Atreides: Infantry(squad)×6, Trike×4, Quad | Atreides: Const Yard, Barracks, Windtrap, Refinery, Outpost, Spice Silo | — | — | 0 |
| SCENH004 | 32×32 | 1200 / 2700 | Atreides (100) | Quad×3, Trooper×3 | Atreides: Infantry(squad)×6, Trike×5 | Atreides: Const Yard, Windtrap, Barracks, Spice Silo, Refinery, Outpost | — | — | 0 |

#### Harkonnen — Level 3

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH005 | 62×62 | 1500 | Ordos (300) | Quad×4, Trooper×3 | Ordos: Raider Trike×7, Infantry(squad)×4, Quad×3, Trooper×2 | Ordos: Windtrap×2, Refinery, Const Yard, Spice Silo, Barracks, Light Fctry, Outpost | Trooper×2 @5m; Trooper×2 @10m; Trooper×2 @20m | Trike @6m; Trooper @6m; Trooper×2 @11m | 2 |
| SCENH006 | 62×62 | 1500 | Ordos (300) | Quad×4, Trooper×3 | Ordos: Raider Trike×7, Infantry(squad)×4, Quad×2, Trooper×2 | Ordos: Windtrap×2, Const Yard, Light Fctry, Spice Silo, Refinery, Barracks, Outpost | Trooper×2 @5m; Trooper×2 @10m; Trooper×2 @20m | Trike @6m; Trooper @6m; Trooper×2 @11m | 2 |
| SCENH007 | 62×62 | 1500 | Ordos (300) | Quad×4, Trooper×3 | Ordos: Infantry(squad)×6, Raider Trike×6, Quad×2, Trooper×2 | Ordos: Windtrap×2, Const Yard, Spice Silo, Refinery, Light Fctry, Barracks, Outpost | Trooper×2 @5m; Trooper×2 @10m; Trooper×2 @20m | Trike @6m; Trooper @6m; Trooper×2 @11m | 2 |

#### Harkonnen — Level 4

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH008 | 62×62 | 1500 | Ordos (500) | Quad×4, Troopers(squad)×3 | Ordos: Raider Trike×6, Tank×5, Troopers(squad)×4, Quad×2, Infantry(squad)×2 | Ordos: Wall×21, Windtrap×2, Spice Silo×2, Light Fctry, Const Yard, Outpost, Heavy Fctry, Refinery, WOR | O:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 0 |
| SCENH009 | 62×62 | 1500 | Ordos (500) | Quad×4, Troopers(squad)×2 | Ordos: Quad×6, Tank×6, Raider Trike×4, Troopers(squad)×4, Infantry(squad)×2 | Ordos: Wall×28, Windtrap×2, Spice Silo×2, Const Yard, WOR, Heavy Fctry, Light Fctry, Outpost, Refinery | O:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 3 |
| SCENH010 | 62×62 | 1500 | Ordos (500) | Quad×4, Troopers(squad)×2 | Ordos: Tank×6, Raider Trike×5, Troopers(squad)×4, Infantry(squad)×3, Quad×2 | Ordos: Wall×21, Windtrap×2, Const Yard, Light Fctry, Outpost, WOR, Spice Silo, Refinery, Heavy Fctry | O:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 2 |

#### Harkonnen — Level 5

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH011 | 62×62 | 1500 | Atreides (700) | Tank×3, Quad×3, Troopers(squad)×2 | Atreides: Tank×7, Launcher×7 | Atreides: Wall×34, Turret×14, Windtrap×4, Refinery×2, Spice Silo×2, Const Yard, Repair, Barracks, Outpost, Hi-Tech, Light Fctry, Heavy Fctry | Troopers(squad) @11m; Tank @11m; Tank×2 @20m; Quad @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENH012 | 62×62 | 1500 | Atreides (700) | Tank×3, Quad×3, Troopers(squad)×2 | Atreides: Tank×11, Launcher×7 | Atreides: Wall×31, Turret×15, Windtrap×4, Refinery×2, Repair×2, Spice Silo×2, Barracks×2, Const Yard, Light Fctry, Hi-Tech, Heavy Fctry, Outpost | Troopers(squad) @11m; Tank @11m; Tank×2 @20m; Quad @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENH013 | 62×62 | 1500 | Atreides (700) | Tank×3, Quad×3, Troopers(squad)×2 | Atreides: Tank×12, Launcher×6 | Atreides: Wall×23, Turret×17, Windtrap×5, Barracks×2, Repair×2, Refinery×2, Spice Silo×2, Hi-Tech, Const Yard, Light Fctry, Heavy Fctry, Outpost | Troopers(squad) @11m; Tank @11m; Tank×2 @20m; Quad @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |

#### Harkonnen — Level 6

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH014 | 62×62 | 1700 | Ordos (800) | Tank×3, Quad×3, Launcher | Ordos: Siege Tank×10, Troopers(squad)×5, Quad×4, Tank×3 | Ordos: Wall×25, R-Turret×7, Windtrap×6, Refinery×2, Spice Silo×2, WOR×2, Heavy Fctry×2, Const Yard, Outpost, Light Fctry, Repair, Hi-Tech | Troopers(squad)×2 @12m; Quad @12m; Troopers(squad) @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Tank @21m; Siege Tank @21m | 2 |
| SCENH015 | 62×62 | 1700 | Ordos (800) | Quad×2, Troopers(squad)×2, Tank×2, Launcher | Ordos: Siege Tank×11, Tank×7, Quad×4, Troopers(squad)×1 | Ordos: Wall×33, R-Turret×6, Windtrap×4, Refinery×2, Heavy Fctry×2, Light Fctry×2, WOR×2, Repair×2, Const Yard×2, Turret×2, Hi-Tech, Spice Silo, Outpost | Troopers(squad)×2 @12m; Quad @12m; Troopers(squad) @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Tank @21m; Siege Tank @21m | 2 |
| SCENH016 | 62×62 | 1700 | Ordos (800) | Quad×3, Tank×2, Troopers(squad)×2, Launcher | Ordos: Siege Tank×12, Quad×4, Troopers(squad)×3, Tank×2 | Ordos: Wall×30, R-Turret×8, Windtrap×7, Const Yard×2, Heavy Fctry×2, WOR×2, Refinery×2, Spice Silo×2, Outpost, Turret, Hi-Tech, Light Fctry, Repair | Troopers(squad)×2 @12m; Quad @12m; Troopers(squad) @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Tank @21m; Siege Tank @21m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:4, Launcher:3, Harvester:2, MCV:2, Carryall:2

#### Harkonnen — Level 7

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH017 | 62×62 | 1800 | Atreides (1000) | Tank×2, Siege Tank×2, Quad, Launcher, Troopers(squad)×1 | Atreides: Launcher×8, Siege Tank×6, Sonic Tank×4, Quad×3, Tank | Atreides: Wall×28, R-Turret×8, Windtrap×7, Heavy Fctry×2, Light Fctry×2, Const Yard×2, Refinery×2, Spice Silo×2, Hi-Tech, Barracks, Turret, Repair, IX, Outpost | Sonic Tank @12m; Quad @12m; Tank @12m; Sonic Tank×2 @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Devastator @21m; Siege Tank @21m | 2 |
| SCENH018 | 62×62 | 2000 | Atreides (1000) | Siege Tank×2, Tank×2, Launcher, Troopers(squad)×1, Quad | Atreides: Launcher×8, Siege Tank×7, Sonic Tank×5, Quad | Atreides: Wall×32, R-Turret×9, Windtrap×6, Heavy Fctry×3, Refinery×3, Light Fctry×2, Spice Silo×2, Hi-Tech, Barracks, Outpost, IX, Const Yard, Repair | Sonic Tank @12m; Quad @12m; Tank @12m; Sonic Tank×2 @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Devastator @21m; Siege Tank @21m | 2 |
| SCENH019 | 62×62 | 1800 | Atreides (1000) | Tank×2, Siege Tank×2, Quad, Launcher, Troopers(squad)×1 | Atreides: Launcher×8, Siege Tank×6, Sonic Tank×3, Tank×2, Quad×2 | Atreides: Wall×24, R-Turret×8, Refinery×2, Heavy Fctry×2, Windtrap×2, Light Fctry×2, Const Yard×2, Spice Silo×2, Outpost, Hi-Tech, Barracks, Repair, IX | Sonic Tank @12m; Quad @12m; Tank @12m; Sonic Tank×2 @20m; Siege Tank @20m | Tank @13m; Launcher @13m; Devastator @21m; Siege Tank @21m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:5, Siege Tank:3, Launcher:4, Harvester:2, MCV:2, Carryall:2

#### Harkonnen — Level 8

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH020 | 62×62 | 2000 | Atreides (1000), Ordos (1000) | Launcher×2, Siege Tank×2, Quad, Devastator, Tank | Atreides: Launcher×5, Siege Tank×5, Sonic Tank×3; Ordos: Siege Tank×4, Deviator×3 | Atreides: Wall×65, R-Turret×8, Windtrap×5, Heavy Fctry×2, Refinery×2, Spice Silo×2, Repair, Palace, Light Fctry, Barracks, Const Yard; Ordos: Wall×37, R-Turret×9, Windtrap×3, Spice Silo×2, Refinery×2, Repair, Const Yard, Hi-Tech, Light Fctry, WOR, Heavy Fctry | A:Troopers(squad) @12m; A:Siege Tank @12m; A:Troopers(squad) @14m; A:Sonic Tank @14m; O:Troopers(squad) @21m; O:Deviator @21m; S:Troopers(squad)×4 @30m↻ | Siege Tank @13m; Launcher @13m; Infantry(squad) @22m; Siege Tank @22m; Devastator @22m | 2 |
| SCENH021 | 62×62 | 2000 | Atreides (1000), Ordos (1000) | Siege Tank×2, Launcher×2, Quad, Devastator | Atreides: Launcher×4, Siege Tank×4, Sonic Tank×4; Ordos: Siege Tank×6, Deviator×4 | Ordos: Wall×32, R-Turret×7, Windtrap×4, Refinery×2, Palace, Hi-Tech, Heavy Fctry, WOR, Light Fctry, Const Yard; Atreides: Wall×67, R-Turret×9, Windtrap×4, Refinery×2, Const Yard×2, Spice Silo×2, Heavy Fctry×2, Hi-Tech, Barracks, Light Fctry | A:Troopers(squad) @12m; A:Siege Tank @12m; O:Troopers(squad) @14m; O:Deviator @14m; A:Launcher @21m; A:Sonic Tank @21m; S:Troopers(squad)×4 @30m↻ | Siege Tank @13m; Launcher @13m; Troopers(squad) @22m; Siege Tank @22m; Devastator @22m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:5, Siege Tank:4, Launcher:4, Harvester:2, MCV:2, Carryall:2, Thopter:3

#### Harkonnen — Level 9

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENH022 | 62×62 | 1000 | Atreides (1500), Ordos (1500), Sardaukar (2500) | Devastator×2, Siege Tank×2, Launcher×2, Quad, Troopers(squad)×1 | Atreides: Siege Tank×4, Launcher; Ordos: Siege Tank×3, Deviator×2; Sardaukar: Launcher×4, Siege Tank | Atreides: Wall×26, R-Turret×5, Refinery×2, Palace, Spice Silo, Const Yard, Hi-Tech, WOR, Light Fctry, Heavy Fctry, Windtrap; Ordos: Wall×33, R-Turret×11, Windtrap×3, Spice Silo×2, Const Yard, Heavy Fctry, Hi-Tech, Refinery, WOR, Light Fctry, Palace; Sardaukar: Wall×51, R-Turret×9, Windtrap×4, WOR×2, Const Yard, Hi-Tech, Spice Silo, Refinery, Heavy Fctry, Palace | S:Troopers(squad) @12m↻; A:Siege Tank @12m↻; S:Troopers(squad) @14m↻; O:Deviator @14m↻; A:Troopers(squad) @21m↻; A:Sonic Tank @21m↻; S:Troopers(squad)×4 @30m↻ | Devastator @13m; Launcher @13m; Troopers(squad) @22m; Siege Tank @22m; Devastator @22m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:6, Launcher:5, Siege Tank:6, Harvester:4, MCV:2, Thopter:5, Carryall:2

#### Ordos — Level 1

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO001 | 32×32 | 1000 / 1000 | Harkonnen (0) | Soldier×3, Raider Trike×2 | Harkonnen: Soldier×7, Trooper×5 | — | — | — | 0 |

#### Ordos — Level 2

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO002 | 32×32 | 1200 / 2700 | Harkonnen (0) | Raider Trike×4, Soldier×4 | Harkonnen: Trooper×6, Quad×5, Soldier | Harkonnen: Const Yard, Spice Silo, Windtrap, WOR, Refinery, Outpost | — | — | 0 |
| SCENO003 | 32×32 | 1200 / 2700 | Harkonnen (0) | Raider Trike×4, Soldier×4 | Harkonnen: Trooper×4, Quad×4, Soldier×2 | Harkonnen: Const Yard, Spice Silo, Windtrap, WOR, Refinery, Outpost | — | — | 0 |
| SCENO004 | 32×32 | 1200 / 2700 | Harkonnen (0) | Raider Trike×4, Soldier×4 | Harkonnen: Quad×4, Trooper×4, Soldier×2 | Harkonnen: Const Yard, Spice Silo, Windtrap, WOR, Refinery, Outpost | — | — | 0 |

#### Ordos — Level 3

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO005 | 62×62 | 1500 | Atreides (300) | Raider Trike×4, Soldier×3, Infantry(squad)×1 | Atreides: Trike×8, Infantry(squad)×4, Soldier×3, Quad | Atreides: Spice Silo×3, Windtrap×2, Light Fctry×2, Refinery, Barracks, Outpost, Const Yard | Infantry(squad)×2 @5m; Infantry(squad)×2 @10m; Infantry(squad)×2 @20m | Trike @6m; Trooper @6m; Trooper×2 @11m | 2 |
| SCENO006 | 62×62 | 1500 | Atreides (500) | Raider Trike×4, Soldier×4 | Atreides: Trike×8, Infantry(squad)×4, Soldier×2, Quad | Atreides: Spice Silo×2, Windtrap×2, Refinery, Outpost, Light Fctry, Barracks, Const Yard | Infantry(squad)×2 @5m; Infantry(squad)×2 @10m; Infantry(squad)×2 @20m | Trike @6m; Trooper @6m; Trooper×2 @11m | 2 |
| SCENO007 | 62×62 | 1500 | Atreides (300) | Soldier×4, Raider Trike×4 | Atreides: Trike×8, Infantry(squad)×5, Soldier×4, Quad | Atreides: Spice Silo×2, Windtrap×2, Refinery, Outpost, Light Fctry, Barracks, Const Yard | Infantry(squad)×2 @5m; Infantry(squad)×2 @10m; Infantry(squad)×2 @20m | Trike @6m; Trooper @6m; Trooper×2 @11m | 2 |

#### Ordos — Level 4

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO008 | 62×62 | 1500 | Atreides (400) | Quad×3, Infantry(squad)×3, Raider Trike×3 | Atreides: Tank×6, Infantry(squad)×6, Trike×3, Quad×3 | Atreides: Wall×32, Windtrap×2, Spice Silo×2, Refinery, Heavy Fctry, Barracks, Light Fctry, Outpost, Const Yard | A:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENO009 | 62×62 | 1500 | Atreides (400) | Infantry(squad)×3, Quad×3, Raider Trike×3 | Atreides: Infantry(squad)×6, Tank×6, Quad×4, Trike×3 | Atreides: Wall×16, Windtrap×2, Spice Silo×2, Refinery, Heavy Fctry, Barracks, Light Fctry, Const Yard, Outpost | A:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENO010 | 62×62 | 1500 | Atreides (400) | Quad×3, Infantry(squad)×3, Raider Trike×3 | Atreides: Quad×6, Infantry(squad)×5, Tank×5, Trike×2 | Atreides: Wall×9, Windtrap×2, Refinery, Const Yard, Spice Silo, Outpost, Barracks, Light Fctry, Heavy Fctry | A:Troopers(squad)×2 @11m; S:Troopers(squad)×4 @20m↻ | Tank @12m; Quad @12m; Tank×2 @21m | 2 |

#### Ordos — Level 5

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO011 | 62×62 | 1500 | Harkonnen (700) | Tank×3, Quad×3, Troopers(squad)×1, Infantry(squad)×1 | Harkonnen: Launcher×5, Tank×4, Troopers(squad)×1, Quad | Harkonnen: Wall×39, Turret×8, Windtrap×3, Refinery×2, Hi-Tech, Spice Silo, Light Fctry, WOR, Repair, Outpost, Heavy Fctry, Const Yard | Troopers(squad) @11m; Tank @11m; Tank×2 @20m; Quad @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENO012 | 62×62 | 1500 | Harkonnen (720) | Tank×3, Quad×3, Infantry(squad)×1, Troopers(squad)×1 | Harkonnen: Tank×6, Launcher×5, Troopers(squad)×2 | Harkonnen: Wall×30, Turret×8, Windtrap×4, Refinery×2, Spice Silo×2, Repair, Const Yard, Hi-Tech, Light Fctry, WOR, Outpost, Heavy Fctry | Troopers(squad) @11m; Tank @11m; Tank×2 @20m; Quad @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |
| SCENO013 | 62×62 | 1500 | Harkonnen (725) | Tank×3, Quad×3, Infantry(squad)×1, Troopers(squad)×1 | Harkonnen: Tank×7, Launcher×5 | Harkonnen: Wall×28, Turret×8, Windtrap×4, Spice Silo×2, Refinery×2, Repair, Hi-Tech, Outpost, Light Fctry, WOR, Heavy Fctry, Const Yard | Troopers(squad) @11m; Tank @11m; Tank×2 @20m; Quad @20m | Tank @12m; Quad @12m; Tank×2 @21m | 2 |

#### Ordos — Level 6

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO014 | 62×62 | 1700 | Atreides (800) | Quad×3, Tank×3, Troopers(squad)×2 | Atreides: Siege Tank×9, Launcher×6, Tank×4, Quad×2 | Atreides: Wall×33, R-Turret×8, Windtrap×4, Refinery×3, Repair×2, Const Yard×2, Turret×2, Spice Silo×2, Hi-Tech, Outpost, Barracks, Heavy Fctry, WOR, Light Fctry | Infantry(squad) @12m; Quad @12m; Tank @12m; Launcher @20m; Siege Tank @20m | Tank @13m; Troopers(squad) @13m; Siege Tank×2 @21m | 2 |
| SCENO015 | 62×62 | 1700 | Atreides (800) | Quad×2, Troopers(squad)×2, Tank×2 | Atreides: Siege Tank×8, Tank×6, Launcher×5, Quad×4 | Atreides: Wall×36, R-Turret×6, Windtrap×4, Refinery×2, Spice Silo×2, Heavy Fctry×2, Repair×2, Const Yard×2, Turret×2, Light Fctry, WOR, Hi-Tech, Barracks, Outpost | Infantry(squad) @12m; Quad @12m; Tank @12m; Launcher @20m; Siege Tank @20m | Tank @13m; Troopers(squad) @13m; Siege Tank×2 @21m | 2 |
| SCENO016 | 62×62 | 1700 | Atreides (700) | Quad×3, Tank×3, Troopers(squad)×2 | Atreides: Siege Tank×7, Tank×5, Quad×3, Launcher×3, Infantry(squad)×1 | Atreides: Wall×35, R-Turret×6, Windtrap×4, Heavy Fctry×2, Refinery×2, Spice Silo×2, Turret×2, Repair, Light Fctry, Outpost, Barracks, Const Yard, WOR, Hi-Tech | Infantry(squad) @12m; Quad @12m; Tank @12m; Launcher @20m; Siege Tank @20m | Tank @13m; Troopers(squad) @13m; Siege Tank×2 @21m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:4, Launcher:3, Harvester:2, MCV:2, Carryall:2

#### Ordos — Level 7

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO017 | 62×62 | 2000 | Harkonnen (1000) | Siege Tank×2, Quad×2, Tank×2, Troopers(squad)×1 | Harkonnen: Quad×6, Devastator×4, Siege Tank×4, Launcher×3, Troopers(squad)×2, Tank×2 | Harkonnen: Wall×34, R-Turret×8, Windtrap×6, Heavy Fctry×3, Refinery×2, Spice Silo×2, WOR×2, Outpost, Light Fctry, Hi-Tech, Repair, Const Yard, IX | Troopers(squad)×2 @12m; Quad @12m; Launcher @20m; Devastator @20m; Tank @20m | Tank @13m; Deviator @13m; Deviator @21m; Siege Tank @21m | 2 |
| SCENO018 | 62×62 | 2000 | Harkonnen (1000) | Tank×2, Siege Tank×2, Troopers(squad)×2, Quad | Harkonnen: Launcher×8, Siege Tank×6, Devastator×4, Quad×3, Tank | Harkonnen: Wall×32, R-Turret×8, Windtrap×6, Spice Silo×3, Heavy Fctry×2, Light Fctry×2, Refinery×2, Hi-Tech, WOR, Repair, Const Yard, IX, Outpost | Troopers(squad) @12m; Quad @12m; Tank @12m; Devastator @20m; Siege Tank @20m; Launcher @20m | Tank @13m; Deviator @13m; Deviator @21m; Siege Tank @21m | 2 |
| SCENO019 | 62×62 | 2000 | Harkonnen (1000) | Siege Tank×2, Troopers(squad)×2, Tank×2, Quad | Harkonnen: Launcher×8, Siege Tank×7, Devastator×5, Tank, Quad | Harkonnen: Wall×32, R-Turret×9, Windtrap×6, Refinery×3, Spice Silo×3, Heavy Fctry×2, Light Fctry×2, Hi-Tech, WOR, Outpost, IX, Const Yard, Repair | Troopers(squad) @12m; Quad @12m; Tank @12m; Devastator @20m; Siege Tank @20m; Launcher @20m | Tank @13m; Launcher @13m; Deviator @21m; Siege Tank @21m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:5, Siege Tank:3, Launcher:4, Harvester:2, MCV:2, Carryall:2

#### Ordos — Level 8

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO020 | 62×62 | 2000 | Atreides (1000), Harkonnen (1000) | Siege Tank×2, Troopers(squad)×2, Deviator, Tank, Quad | Atreides: Siege Tank×4, Sonic Tank×4, Launcher×3, Quad×2, Tank; Harkonnen: Devastator×4, Launcher×3, Siege Tank×2 | Harkonnen: Wall×50, R-Turret×6, Windtrap×4, Refinery×2, Spice Silo×2, Light Fctry, Repair, Heavy Fctry, WOR, Hi-Tech, Const Yard; Atreides: Wall×65, R-Turret×6, Windtrap×5, Refinery×2, Spice Silo×2, Palace, Heavy Fctry, Hi-Tech, Light Fctry, Barracks, Const Yard | A:Troopers(squad) @12m; A:Siege Tank @12m; H:Troopers(squad) @30m; H:Devastator @30m; A:Launcher @21m; A:Sonic Tank @21m; S:Troopers(squad)×4 @30m↻ | Siege Tank @13m; Troopers(squad) @13m; Troopers(squad) @22m; Siege Tank @22m; Deviator @22m | 2 |
| SCENO021 | 62×62 | 2000 | Atreides (1000), Harkonnen (1000) | Siege Tank×2, Troopers(squad)×1, Deviator, Quad, Tank | Atreides: Launcher×4, Siege Tank×4, Sonic Tank×4; Harkonnen: Devastator×4, Launcher×4, Siege Tank×3 | Atreides: Wall×63, R-Turret×9, Windtrap×4, Spice Silo×2, Refinery×2, Const Yard, Light Fctry, Barracks, Heavy Fctry, Hi-Tech, Turret; Harkonnen: Wall×45, R-Turret×7, Windtrap×4, Refinery×2, Spice Silo, Const Yard, Light Fctry, WOR, Heavy Fctry, Hi-Tech, Palace | A:Troopers(squad) @12m; A:Siege Tank @12m; H:Troopers(squad) @30m; H:Devastator @30m; A:Launcher @21m; A:Sonic Tank @21m; S:Troopers(squad)×4 @30m | Siege Tank @13m; Troopers(squad) @13m; Troopers(squad) @22m; Siege Tank @22m; Deviator @22m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:5, Siege Tank:4, Launcher:4, Harvester:2, MCV:2, Carryall:2, Thopter:3

#### Ordos — Level 9

| Scenario | Map | Player credits / quota | Opponents (starting credits) | Player starting army | Enemy starting army | Enemy base (no slabs) | Enemy reinforcements | Player reinforcements | Worms |
|---|---|---|---|---|---|---|---|---|---|
| SCENO022 | 62×62 | 1500 | Atreides (1000), Harkonnen (1500), Sardaukar (2500) | Siege Tank×4, Deviator×2 | Atreides: Siege Tank×5, Sonic Tank, Launcher; Harkonnen: Devastator×3, Launcher×2; Sardaukar: Launcher×3, Siege Tank | Atreides: Wall×29, R-Turret×6, Refinery×2, Light Fctry×2, Palace, Spice Silo, Const Yard, Hi-Tech, WOR, Heavy Fctry; Harkonnen: Wall×37, R-Turret×4, Windtrap×3, Turret×2, Const Yard×2, Heavy Fctry, Hi-Tech, Spice Silo, Refinery, WOR, Light Fctry, Repair, Palace; Sardaukar: Wall×51, R-Turret×9, Windtrap×3, Const Yard×2, WOR×2, Repair, Hi-Tech, Refinery, Heavy Fctry, Palace | S:Troopers(squad) @12m↻; A:Siege Tank @12m↻; S:Troopers(squad) @14m↻; A:Sonic Tank @14m↻; A:Troopers(squad) @21m↻; A:Launcher @21m↻; S:Troopers(squad)×4 @30m↻ | Deviator @13m; Troopers(squad) @13m; Troopers(squad) @22m; Siege Tank @22m; Deviator @22m | 2 |

CHOAM (Starport stock): Trike:5, Quad:5, Tank:6, Launcher:5, Siege Tank:6, Harvester:4, MCV:2, Thopter:5, Carryall:2

---

## Sources

**Lore, story, missions**
- Wikipedia (en): https://en.wikipedia.org/wiki/Dune_II
- Wikipedia (ru): https://ru.wikipedia.org/wiki/Dune_II
- Dune Wiki (Fandom), the article on the game: https://dune.fandom.com/wiki/Dune_II
- Dune Wiki, characters and events:
  - https://dune.fandom.com/wiki/Cyril
  - https://dune.fandom.com/wiki/Radnor
  - https://dune.fandom.com/wiki/Ammon
  - https://dune.fandom.com/wiki/Frederick_IV
  - https://dune.fandom.com/wiki/First_Spice_War
  - https://dune.fandom.com/wiki/Dune_Legacy
- Dune RTS Wiki (wiki.gg), the campaign: https://dunerts.wiki.gg/wiki/Dune_II_campaign
- Dune RTS Wiki, mission pages:
  - https://dunerts.wiki.gg/wiki/Dune_II_Atreides_mission_1 … https://dunerts.wiki.gg/wiki/Dune_II_Atreides_mission_9
  - https://dunerts.wiki.gg/wiki/Dune_II_Harkonnen_mission_1 … https://dunerts.wiki.gg/wiki/Dune_II_Harkonnen_mission_9
  - https://dunerts.wiki.gg/wiki/Dune_II_Ordos_mission_1 … https://dunerts.wiki.gg/wiki/Dune_II_Ordos_mission_9
- Dune RTS Wiki, Houses and forces:
  - https://dunerts.wiki.gg/wiki/House_Atreides
  - https://dunerts.wiki.gg/wiki/House_Harkonnen
  - https://dunerts.wiki.gg/wiki/House_Ordos
  - https://dunerts.wiki.gg/wiki/Fremen_(Dune_II)
  - https://dunerts.wiki.gg/wiki/Sardaukar_(Dune_II)
  - https://dunerts.wiki.gg/wiki/Mercenaries
- Command & Conquer Wiki, the Dune II portal: https://cnc.fandom.com/wiki/Portal:Dune_II
- A walkthrough with screenshots: https://pcgamescreens.blogspot.com/2016/02/dune-2-screenshots-walkthrough.html
- TASVideos, a discussion of Dune II (Sardaukar on lvl 4 and 7, Death Hand): https://tasvideos.org/Forum/Posts/420373
- A review of the Amiga version (Usenet): https://www.math.uh.edu/~barrett/data/all/DuneII

**Scenario, code and palette data**
- OpenDUNE, a reconstruction of the original code: https://github.com/OpenDUNE/OpenDUNE. Files:
  - `src/table/structureinfo.c`, `src/table/unitinfo.c`, `src/table/houseinfo.c`, `src/table/sound.c`;
  - `src/structure.c` (`Structure_GetBuildable`, `Structure_IsUpgradable`);
  - `src/unit.c` (`Unit_Deviate`);
  - `src/scenario.c` (`[REINFORCEMENTS]`);
  - `src/house.c` (timers);
  - `src/opendune.c` (`GameLoop_IsLevelFinished` / `IsLevelWon`).
- Dune II – The Maker (D2TM): https://github.com/stefanhendriks/Dune-II---The-Maker. Files:
  - `resources/bin/campaign/maps/scen{a,h,o}0NN.ini` — the original scenarios;
  - `resources/bin/campaign/{atreides,harkonnen,ordos}/missionN.ini` — a reconstruction of the region map;
  - `resources/doc/d2tm.pal` — the palette.
- OpenRA, the Dune II mod: https://github.com/OpenRA/d2. Files: `mods/d2/maps/scena001`, `mods/d2/audio/notifications.yaml`, `mods/d2/rules/palettes.yaml`.
- Dune Legacy: https://dunelegacy.sourceforge.net/ (manual, map format; a local copy in `sourceforge_website/`).

**Local Dune Legacy sources** (`scratchpad/dunelegacy`):
- `config/ObjectData.ini.default`, `config/Dune Legacy.ini`;
- `src/Menu/MapChoice.cpp`, `include/Menu/MapChoice.h`, `src/Menu/BriefingMenu.cpp`, `src/Menu/MentatMenu.cpp`, `src/Menu/CampaignStatsMenu.cpp`;
- `src/CutScenes/Intro.cpp`, `Meanwhile.cpp`, `Finale.cpp`;
- `src/sand.cpp`, `src/Game.cpp`, `src/GameInitSettings.cpp`, `src/GameInterface.cpp`, `src/Map.cpp`;
- `src/GUI/dune/BuilderList.cpp`, `include/GUI/ObjectInterfaces/*.h`;
- `src/structures/Palace.cpp`, `BuilderBase.cpp`, `StructureBase.cpp`, `StarPort.cpp`, `Refinery.cpp`;
- `src/Choam.cpp`, `src/players/HumanPlayer.cpp`, `src/units/SandWorm.cpp`;
- `src/INIMap/INIMapLoader.cpp`;
- `include/FileClasses/SFXManager.h`, `include/Colors.h`, `include/Definitions.h`;
- `data/locale/dunelegacy.pot`.

**Open OpenSD2 scenarios** (`scratchpad/opensd2`, CC-BY-SA): `REGION{F,M,S}.INI` — a sample of the region map format; `SCEN{F,M,S}0NN.INI` — the campaigns for the Fremen, Mercenaries and Sardaukar.

**Unavailable at collection time (Cloudflare 403):** StrategyWiki (`strategywiki.org/wiki/Dune_II:_The_Building_of_a_Dynasty`), GameFAQs, speedrun.com. Their data is covered by the sources above.
