# 03. Structures, Economy, Houses, AI, Scenarios/Campaign, Map

Research into the **Dune Legacy** source code (SourceForge master, commit `591b9e1`, cloned to
`scratchpad/dunelegacy`). The goal is an exact reproduction of the mechanics in JS/three.js.

* Unit/structure stats (HP, price, power, BuildTime, Prerequisite, TechLevel, UpgradeLevel, etc.)
  are already in `config/ObjectData.ini.default` — they are **not duplicated** here; this document only clarifies how the engine applies them.
* References of the form `src/House.cpp:244` are paths from the root of the Dune Legacy repository.
* This is a **modern fork** of Dune Legacy with tweaks "in the style of Dune Dynasty" (16 ms/cycle speed, the "original" campaign AI,
  modified ballistics). Where the behaviour clearly differs from classic Dune II, this is noted.
* Companion file: `docs/research/mapseed_port.js` — a verified port of the map generator (section 9).

---

## 0. Basic Units and Conventions

| What | Value | Where |
|---|---|---|
| Game cycle (tick) | 16 ms at the default speed → **62.5 cycles/s** | `include/Definitions.h:42` `GAMESPEED_DEFAULT 16` |
| Time conversion | `MILLI2CYCLES(ms) = ms / 16` | `include/Definitions.h:43` |
| Game speed | 8…32 ms per cycle (changes only real time; all logic is counted in cycles) | `Definitions.h:40-41`, `Game.cpp:4050` |
| Tile | `TILESIZE = 64` world units | `Definitions.h:66` |
| Credits | fractional (FixPoint), shown on screen via `lround()` | `include/House.h:167` |
| Game RNG | `randomGen.rand(min,max)` — **inclusive** | `include/misc/Random.h:101-114` |

**From here on, all "seconds" assume 16 ms/cycle.** In JS it is convenient to keep the logic in whole cycles and use `CYCLE_MS = 16`.

Order of processing for a single cycle (`src/Game.cpp:2356 updateGameState`, `:331 processObjects`):
1. execute the players' commands (`cmdManager.executeCommands`);
2. `House::update()` for each house (storage overflow, power tax, CHOAM, player AI);
3. `triggerManager.trigger(cycle)` (reinforcements, timeout);
4. update tiles → structures → units → bullets → explosions;
5. `gameCycleCount++`; if the game is over, leave the mission after `END_WAIT_TIME = 6 s` (`Game.cpp:2405`, `include/Game.h:63`).

---

## 1. Economy

### 1.1 The house's two "wallets"

`House` stores **two** sums (`src/House.cpp:52-84`):

* `startingCredits` — the starting credits from the scenario (`Credits=`, default `DEFAULT_STARTINGCREDITS = 3000`, `Definitions.h:92`) plus the "overflow" of refunds. **They need no storage and never disappear.**
* `storedCredits` — refined spice sitting in refineries/silos. **Limited by capacity.**
* What the player sees: `getCredits() = lround(stored + starting)` (`House.h:167`).

Operations:

| Function | Logic | Reference |
|---|---|---|
| `addCredits(x, wasRefined)` | `stored += x`; if `wasRefined` — `harvestedSpice += x` (statistics); quota check (see 8.6) | `House.cpp:244-259` |
| `takeCredits(x)` | only if `getCredits() >= 1`. Deducts from `stored` first, the remainder from `starting`. If there is less money than `x`, it deducts **as much as there is** and returns the amount actually deducted | `House.cpp:279-301` |
| `returnCredits(x)` (refunds) | fills `stored` up to capacity, **the excess goes into `starting`** (a refund is never lost) | `House.cpp:264-274` |

Consequence: when you spend money, you first use up the spice in the storage, which frees up room in the silos.

### 1.2 Storage capacity and spice loss

* `capacity = Σ Capacity` over all of the house's structures: Spice Refinery **1005**, Spice Silo **1000** (from ObjectData; `House.cpp:442`, `:465`).
* Every cycle, if `stored > capacity`: `stored -= 1` (≈ **62.5 credits/s**) + the message *"As insufficient spice storage is available, spice is lost"* (`House.cpp:353-362`).
  In other words, excess spice "leaks away" gradually rather than being cut off instantly.
* Capturing an enemy Silo/Refinery with infantry steals spice: `1000 * stored/capacity` of the victim (`src/units/InfantryBase.cpp:218-225`).

### 1.3 The power "tax"

Every 15 s (`powerUsageTimer = MILLI2CYCLES(15000)`) the house pays `powerRequirement / 32` credits (`House.cpp:364-368`).
`powerRequirement` is the sum of the positive `Power` values of all structures. Example: a base consuming 300 → 9.4 cr / 15 s. A trifle, but the money "ticks" away even without any production.

### 1.4 Spice on the map

| Parameter | Value | Reference |
|---|---|---|
| Spice on a `Spice` tile | random 74…148 (`111±37`) when the type is set | `Definitions.h:61-62`, `Tile.cpp:599-606` |
| `ThickSpice` | random 148…296 (`222±74`) | `Definitions.h:63-64` |
| Harvesting | a Harvester standing on a tile with `spice>0` removes `HARVESTSPEED = 0.1344` every cycle | `Definitions.h:83`, `Tile.cpp:678-697`, `src/units/Harvester.cpp:529-541` |
| Harvester capacity | `HARVESTERMAXSPICE = 700` | `Definitions.h:82` |
| Full load | 700 / 0.1344 ≈ 5208 cycles ≈ **83 s** of pure harvesting (+ moving between tiles) | — |
| Depletion | Thick → Spice when the remainder drops below 148; Spice → Sand at 0 | `Tile.cpp:688-694` |
| Smoothing | when a tile turns to sand, neighbouring (4-connected) ThickSpice tiles are downgraded to Spice | `Map.cpp:681-703` |
| `setSpice(v)` | the type is derived from the amount: ≤0 Sand, ≥148 Thick, otherwise Spice | `Tile.cpp:700-711` |

There are **no** other ways for spice to grow (no gradual "regrowth"). Spice appears only from:

1. **Spice Bloom** (`Terrain_SpiceBloom`, positions from `[MAP] Bloom=`). Triggers when a ground unit/infantry **stops** on the tile (`src/units/GroundUnit.cpp:86-101`, `InfantryBase.cpp:176-187`) or when any projectile other than a sonic one or a Sandworm's hits the tile (`Map.cpp:296-301`).
   Effect (`Tile.cpp:829-854`): sound, screen shake, the tile → Spice, `createSpiceField(loc, 5)` — all **Sand** tiles (not dunes!) within a Euclidean radius of 5 become Spice (`Map.cpp:750-770`). **A unit that steps on a bloom is killed.**
2. **Special Bloom** (`[MAP] Special=`): when stepped on, the tile → Sand and one of 4 outcomes is picked at random (`Tile.cpp:856-960`): +150…400 credits; a free Trike for yourself; a Trike for a random **enemy** (one that has units); 3 Soldiers for a random enemy.
3. `[MAP] Field=` at load time: `createSpiceField(pos, 5, centerIsThickSpice=true)` (`INIMapLoader.cpp:215-232`).
4. A destroyed Harvester scatters **75%** of its cargo evenly over the sand/spice within a radius of `lround(spice/210)` (`Harvester.cpp:356-393`).
5. The Seed-based map generator (section 9).

### 1.5 Harvester → Spice Refinery

* Unloading (`src/structures/Refinery.cpp:162-205`): every cycle
  `scale = floor(5*HP/maxHP)`, if 0 → 1; `speed = 0.625 * scale / 5`; spice is converted **1:1** into credits via `addCredits(x, wasRefined=true)`.
  At full refinery HP: 0.625 cr/cycle = 39 cr/s, 700 spice ≈ **17.9 s**. A damaged refinery unloads more slowly (in steps of 20%).
* While unloading is in progress, the Harvester is "inside" the structure (invisible); refinery animation frames 8-9.
* After unloading: if the house has a free Carryall and the Harvester has a return point (guardPoint), the Carryall carries it there; otherwise it drives out on its own (`findDeploySpot`).
* If the refinery is destroyed with a Harvester inside, the Harvester is destroyed too (`Refinery.cpp` destructor).

### 1.6 Free Harvesters

* **Whenever a refinery is built with the Construction Yard** — a free Harvester, delivered by a Carryall from the nearest edge of the map (`House.cpp:767-769`, `:626-660`). At mission start (GameState::Start) — only if the house has no Harvesters yet.
  The Harvester arrives with 5 spice; the Carryall is "ownerless" (`setOwned(false)`) and flies away after the delivery.
* **Loss of the last Harvester**: if the number of Harvesters drops to 0 and there is a refinery, a free Harvester is sent to the refinery (`House.cpp:943-973`).
* Not granted if the Harvester limit has been reached (`House.cpp:628`).

### 1.7 Prices and refunds (summary)

* The production cost is deducted **gradually** as construction progresses (see 3.5). Cancelling returns what has already been spent via `returnCredits` (100%).
* Starport: the money is deducted **immediately when the order is placed** and refunded in full on cancellation (see 5.1). If the Frigate is shot down, everything is lost.
* Upgrades are paid gradually and cannot be cancelled (there is no command for it).
* There is **no** selling of structures (there is no SELL in the command list of `include/Command.h`).
* When a factory is destroyed, unfinished production is lost without a refund.

---

## 2. Power and Its Effects

* Production: Windtrap only. `getProducedPower() = lround(HP/maxHP * |Power|)` = up to **100** per Windtrap, **proportional to health** (`src/structures/WindTrap.cpp:75-88`). Any change in a Windtrap's HP recalculates the house's `producedPower`.
* Consumption: `powerRequirement += Power` when a structure appears (only `Power >= 0`), `-=` when it is destroyed (`House.cpp:436-439`, `:459-462`).
* `hasPower() = producedPower >= powerRequirement` (`House.h:69`).

Effects of a power shortage **in this code**:

| Effect | Condition | Reference |
|---|---|---|
| **Structure degradation** (see 3.3) | `powerRequirement > producedPower` and the `concreteRequired` option (on by default) | `StructureBase.cpp:341-360` |
| **Radar/minimap switches off** | `hasRadarOn() = hasRadar() && hasPower()` | `House.h:68`, `RadarView.cpp:140-147` |
| Rocket Turrets stop working | only if the `rocketTurretsNeedPower` option is set (**off** by default), and never for AI in campaign/skirmish | `RocketTurret.cpp:61-64` |
| Production speed | **NOT affected** by power (the code explicitly has a comment, "That was wrong") | `BuilderBase.cpp:238-244` |
| Gun Turrets | not affected | — |

> In the original Dune II, a power shortage slowed down production/turrets; Dune Legacy dropped this. To get the "Dune II feel" it can be made an option.

---

## 3. Construction

### 3.1 Placing a structure (Construction Yard)

Click check (`src/Game.cpp:3756 handlePlacementClick`) and the rule `Map::okayToPlaceStructure` (`src/Map.cpp:339-361`):

1. All tiles of the rectangle exist and are **rock** (`Rock` or `Slab`; mountains are forbidden — `isBlocked()` includes `Mountain`, `include/Tile.h:426,450`).
2. There are no ground objects (units/structures) on the tiles. If **only your own units** are in the way, the click does not go through, but they are ordered to move out of the way (`Game.cpp:3819-3840`).
3. **At least one** tile of the structure lies within `BUILDRANGE = 2` (a 5×5 square, Chebyshev distance) of a tile **owned** by the house (`Map.cpp:363-374`, `Definitions.h:57`).
   Tiles under the house's structures and concrete slabs get an owner (`StructureBase.cpp:126`, `House.cpp:683,711`).
   A peculiarity: **tile ownership persists after the structure is destroyed** (it is reset only when a missile hits the concrete, `Map.cpp:279`) — you can build on the ruins again.
4. There is no requirement for the structure to be adjacent to others; the "gap" function `isAStructureGap` exists in the code but is not used for placement.

Concrete:

* **Slab1** (1×1, 5 cr): onto rock without concrete, within build range (`Game.cpp:3769-3782`). Places `Terrain_Slab`, the owner is the house (`House.cpp:680-701`).
* **Slab4** (2×2, 20 cr, needs CY upgrade level 1): laid on those of the 4 tiles that are rock (not mountains) with no objects; it is enough for at least one tile to be valid (`House.cpp:703-730`, `Game.cpp:3784-3803`).
* An MCV deploys into a CY on its own tile as the top-left corner of a 2×2, all 4 tiles must be rock without objects; **no build range is needed** (`src/units/MCV.cpp:65-131`).

Structure sizes (`src/sand.cpp:178-200`):

| 1×1 | 2×2 | 3×2 | 3×3 |
|---|---|---|---|
| Slab1, Wall, Gun Turret, Rocket Turret | Slab4, Construction Yard, Windtrap, Barracks, WOR, Radar(Outpost), Silo, Light Factory, IX | Refinery, Heavy Factory, Hi-Tech Factory, Repair Yard | Palace, Starport |

### 3.2 Damage for building without concrete

`StructureBase::assignToMap` (`StructureBase.cpp:109-141`): for **each** tile of the structure that is not on concrete,
`HP -= maxHP / (2 * sizeX * sizeY)`. That is, with no concrete at all the structure is placed with **50% HP**, with half on concrete — 75%.
Exceptions: Wall and Construction Yard; structures from the scenario (GameState::Start); the `concreteRequired=false` option.
The tiles under the structure become `Rock` (the concrete under a structure "disappears" as a type).

### 3.3 Degradation

`StructureBase::update` (`StructureBase.cpp:341-360`):

* Each structure has a timer of 15 s (`degradeTimer`), which ticks **only while the house has a power deficit** and the `concreteRequired` option is on.
* When it fires, **if HP > 50%**: `HP -= mult% * maxHP`, where `mult` = Harkonnen/Sardaukar **3**, Ordos **2**, Mercenary **5**, the rest (Atreides, Fremen) **1**.
* Degradation does not push HP below 50%.
* `degradeTimer = -1` (never) only if the structure is entirely on concrete **and** the option `structuresDegradeOnConcrete=false` is set (default is true → concrete does not protect against degradation).

> In classic Dune II, structures not on concrete degrade regardless of power. If the goal is "like Dune II", an alternative is possible: degradation of structures without concrete down to 50% HP. I document both variants; in Dune Legacy it is tied to power.

### 3.4 Repair with the Repair button

`StructureBase.cpp:369-391`. The command only **turns on** repair (it cannot be turned off, `Command.cpp:261-270`).
Every cycle, while `getCredits() >= 5`:

```
fraction    = floor(2*256 / maxHP)            // integer arithmetic, as in Dune II (fixed point ×256)
repairPrice = fraction * Price / 256          // price of 5 HP
HP         += 5/30                            // = 1/6 HP per cycle → 10.4 HP/s
credits    -= repairPrice / 30
```
Repair stops at full HP or if money < 5.
The time to fully repair `H` HP: `6H` cycles (0.096·H s). The cost per HP = `repairPrice/5`.

| Structure (HP/price) | fraction | cr per 5 HP | 0→100% |
|---|---|---|---|
| Windtrap 200/300 | 2 | 2.34 | 93.8 cr, 19.2 s |
| Construction Yard 400/400 | 1 | 1.56 | 125 cr, 38.4 s |
| Radar 500/400 | 1 | 1.56 | 156 cr, 48 s |
| Wall 50/50 | 10 | 1.95 | 19.5 cr, 4.8 s |
| **Palace 1000/999** | **0** | **0** | **free** (an artefact of the formula when maxHP > 512) |

An AI owner automatically turns on repair if HP < 50% (`StructureBase.cpp:389-391`).

### 3.5 The production queue (BuilderBase)

`src/structures/BuilderBase.cpp`. A builder has: `buildList` (what can be built), `currentProductionQueue` (the queue), `currentProducedItem`, `productionProgress` (**in credits**).

* **Ordering** (`doProduceItem`, `:509-534`): +1 (or +5 in the "multiple" mode `multipleMode`) is added to the queue; if nothing is being built, production starts immediately. Money is **not deducted** at the time of ordering.
* **Progress** (`updateProductionProgress`, `:216-257`), every cycle, if `progress < price`, it is not "on hold", the unit limit has not been reached, and `getCredits() > 0`:
  ```
  buildSpeed  = min(HP/maxHP of the builder, buildSpeedLimit)   // a damaged factory builds more slowly!
  perCycle    = Price / (BuildTime * 15)
  progress   += takeCredits(perCycle * buildSpeed)          // may take less if there is not enough money
  ```
  Build time at 100% HP = **`BuildTime × 15` cycles = `BuildTime × 0.24 s`**. Examples: Windtrap (48) 11.5 s; Refinery (80) 19.2 s; Heavy Factory (144) 34.6 s; Palace (130) 31.2 s; Tank (64) 15.4 s; Soldier (32) 7.7 s.
  (House IX has two BuildTime lines in the ini — the parser takes the **first** one, 80; `src/FileClasses/INIFile.cpp:213-222`.)
  If not a single credit could be deducted during a cycle, the message "Not enough money" is shown and progress stands still.
* `buildSpeedLimit` (0…1) is used by the AI to handicap it (see 7.1). For the player it is 1.
* **Completion**:
  * unit: `deployTimer = MILLI2CYCLES(750)` (≈0.75 s, `:341`), after which the unit appears (see 3.7). Infantry/Troopers (composite entries) yield 3 Soldiers/Troopers.
  * structure: the CY waits for placement (`isWaitingToPlace`), and the next item in the queue does **not start** until the structure has been placed.
* **Pause (On hold)**: `bCurrentItemOnHold` — progress freezes (`:220`).
* **Cancel** (`doCancelItem`, `:536-569`): decrements the counter; the **last** such element of the queue is removed. If the last instance of the type currently being built is cancelled, `productionProgress` is returned via `returnCredits` and the next one starts. Cancelling something in the queue (not yet started) does not touch the money.
* An item disappears from the buildList (loss of a prerequisite) → the current progress is returned, and all such elements are removed from the queue (`removeItem`, `:147-176`).
* **Unit limits** (`House.h:127-160`): if the limit is reached, unit production stalls (it is not cancelled).
  * ground: `ground + ceil(soldiers/3) + ceil(troopers/3) >= maxUnits` (infantry counts as 1/3 each);
  * infantry: `ground + floor(soldiers/3) + floor(troopers/3) >= maxUnits`;
  * air: `carryalls + ornithopters >= 11*max(maxUnits,25)/25`;
  * Harvesters: `numHarvesters >= maxHarvesters`; `maxUnits = 0` → no limit.
  * default values by map area (`config/ObjectData.ini.default` [Map Settings], `INIMapLoader.cpp:428-463`): ≤1024 tiles — 25 units / 5 Harvesters; <4096 — 100/10; <16384 — 250/15; otherwise 300/40. A 62×62 map = 3844 → 100/10. In a scenario, `MaxUnit=`/`MaxUnits=` overrides the unit limit (in the campaign usually 25).

The order of buttons in the sidebar (`BuilderBase.cpp:33-43`): Slab4, Slab1, IX, Starport, Hi-Tech, Heavy, R-Turret, Repair, Turret, WOR, Barracks, Wall, Light, Silo, Radar, Refinery, Windtrap, Palace; units: Sonic, Devastator, Deviator, Special, Launcher, Siege, Tank, MCV, Harvester, Ornithopter, Carryall, Quad, Raider, Trike, Troopers, Trooper, Infantry, Soldier, Frigate, Sandworm, Saboteur.

### 3.6 Availability (buildList) and upgrades

`updateBuildList` (`BuilderBase.cpp:291-323`) — an item is available if, in ObjectData for the structure's **original house** (`originalHouseID`, which matters for captured structures!):
`Enabled && Builder == this type && UpgradeLevel <= current level && TechLevel <= the game's techLevel && the house has all Prerequisites`.
It is recomputed whenever the number of the house's structures changes (`House.cpp:446`, `:469`).

The game's `techLevel` (`Game.cpp:292`): `((mission + 1) / 3) + 1` → mission 1 → 1; 2-4 → 2; 5-7 → 3; 8-10 → 4; 11-13 → 5; 14-16 → 6; 17-19 → 7; 20-22 → 8. For custom maps — `[BASIC] TechLevel=` (default 8).

**Upgrade** (`BuilderBase.cpp:355-357`, `:425-442`, `:497-507`):

* The maximum level = the maximum `UpgradeLevel` among this builder's items that are available at the techLevel (`:277-289`).
* The price = **the builder's Price / 2**; it can be started only if `getCredits() >= price`.
* The duration is fixed: **600 cycles = 9.6 s**; `price/600` is deducted every cycle.
* **Production stands still** during an upgrade. On completion, `curUpgradeLev++` and the list is recomputed.

What the upgrades unlock (per ObjectData.ini.default):

| Builder | Upgrade price | Lv.1 | Lv.2 | Lv.3 |
|---|---|---|---|---|
| Construction Yard | 200 | Slab4 (TL4) | Rocket Turret (TL6) | — |
| Light Factory | 200 | Quad (TL3; for Harkonnen the Quad is at level 0, TL1) | — | — |
| Heavy Factory | 300 | MCV (TL4) | Launcher (TL5, not Ordos) | Siege Tank (TL6; for Ordos — level 2, TL7) |
| Hi-Tech Factory | 250 | Ornithopter (TL7, needs IX, not Harkonnen) | — | — |
| Barracks, WOR, Starport | — | no levels | | |

House-specific builder rules (from ObjectData): Harkonnen cannot build Barracks (WOR is available right from TL2 without Barracks), Atreides cannot build WOR; Trike — not H/O; Raider Trike — not A/H; Launcher — not O; Sonic Tank — not O/H; Devastator — not A/O; Deviator — O only (all three require IX).

### 3.7 Unit exit and the rally point

* Right-clicking the map with a builder structure selected sets its `destination` (rally point); clicking the structure itself resets it (`StructureBase.cpp:296-312`).
* A new unit is placed by `Map::findDeploySpot` (`Map.cpp:431-519`): random tiles along the structure's perimeter (widening the ring after every 100 attempts), and the one closest to the rally point is chosen; tracked vehicles are not placed on top of infantry. Flying units go to `location + (1,1)`.
* The unit then receives `guardPoint = destination` and drives there. For the AI, Harvesters/MCVs/Carryalls ignore the rally point; AI Harvesters go straight into HARVEST mode (`BuilderBase.cpp:389-410`).

### 3.8 Destruction, smoke, infantry from ruins, capture

* Smoke: when missiles hit a structure with HP < 50%, a smoke point is added (maximum 5) that lives for 8 s (`Map.cpp:216-222`, `StructureBase.cpp:394-401`). Purely visual.
* HP colour: ≥50% green, otherwise yellow/red. ⚠ In this fork `HEAVILYDAMAGEDRATIO` is written as `025_fix` (`Definitions.h:85`) — this is an octal literal equal to 21, so "red" starts already **below 50%**. In Dune Legacy/Dune II the threshold for red is **25%**. I recommend 25%.
* Destruction (`StructureBase.cpp:421-492`): on each tile there is a large explosion and a ruin tile; with probability `InfSpawnProp`% (from ObjectData) a **Soldier of the owner with 50% HP** appears on the tile. Walls have separate graphics and no infantry.
* **Capture** (`InfantryBase.cpp:192-345`): infantry with a Capture order, on reaching an enemy structure:
  * if the structure's HP is "red", the structure is recreated under the new owner with the same HP and `originalHouseID` (it builds units of the **original** house), its contents (a Harvester in a refinery, a unit being repaired) pass to the new owner, spice is stolen (1.2), and the rest of the infantry on the structure's tiles die;
  * otherwise — damage of `min(HP/2, 2*infantryman's HP)`;
  * the infantryman dies in either case.
  * Cannot be captured: Palace, IX, Radar, Barracks, WOR, Wall (`canBeCaptured()` in `include/structures/*.h`).

---

## 4. Structures — Unique Rules

| Structure | Notes | References |
|---|---|---|
| **Construction Yard** | Structure builder. `doPlaceStructure` only when the item is ready. No damage for the lack of concrete. When a Palace is built, it cancels the Palace in the other CYs' queues (`House.cpp:775-785`) | `ConstructionYard.cpp` |
| **Windtrap** | Power 100 × HP% (section 2). Animation by `gameCycle/8` | `WindTrap.cpp:65-88` |
| **Refinery** | Capacity 1005; Harvester unloading 0.625×scale/5 per cycle; a free Harvester on construction; booking (`bookings`) — several Harvesters wait in line | `Refinery.cpp:162-205`, `include/structures/Refinery.h:45-56` |
| **Spice Silo** | Only `Capacity=1000`. No logic of its own. If there is no room, the excess `stored` leaks away at 1 cr/cycle | `Silo.cpp`, `House.cpp:353` |
| **Radar (Outpost)** | ViewRange 10. The minimap works only with `hasRadar && hasPower`; switching it on/off plays a "static" animation | `Radar.cpp`, `RadarView.cpp:140-200` |
| **Barracks / WOR / Light / Heavy / Hi-Tech** | Ordinary BuilderBase. Light/Heavy show the roll-out animation while `deployTimer>0`. `HeavyFactory::doBuildRandom` (for the simple AI) upgrades first and never builds Harvester/MCV | `HeavyFactory.cpp:53-66` |
| **Repair Yard** | The unit "drives in" inside. Every cycle: if `takeCredits(0.1) > 0` → **+1 HP**. That is, 62.5 HP/s at 0.1 cr per HP. After repair it drives out (or is carried away by a Carryall when the manual-drops option is on). Ground units (not infantry) with HP < 50% drive to repair on their own if the house has a Repair Yard **and** a Carryall | `RepairYard.cpp:116-179`, `Definitions.h:90`, `GroundUnit.cpp:109-120` |
| **Starport** | CHOAM, section 5.1 | `StarPort.cpp` |
| **Palace** | Special weapon, section 5.2. HP 1000 — free repair | `Palace.cpp` |
| **House IX** | Only a prerequisite (Sonic/Devastator/Deviator/Ornithopter) | `IX.cpp` |
| **Gun Turret** | Targets ground units/structures (not aircraft) visible to the team. Target search once every 50-69 cycles (~1 s), and within ≤10 cycles after taking damage. Rotates by `TurnSpeed` per cycle (angle 0..8), fires when `drawnAngle == the required angle`. Damage 20, range 5, reload 240 cycles | `TurretBase.cpp:76-233`, `GunTurret.cpp` |
| **Rocket Turret** | Hits aircraft too. Against a ground target closer than 3 tiles it fires the **Gun Turret's projectile** (Gun Turret damage/reload); otherwise a `Bullet_TurretRocket` missile (damage 30, range 8, reload 360). Fires when the barrel deviation is ≤ 1/3 of a sector (≈15°), not strictly along the direction | `RocketTurret.cpp:56-118`, `TurretBase.cpp:30-33` |
| All turrets | A shot **reveals** the turret to the owner of the target (viewMap radius 2 around the turret) | `TurretBase.cpp:246` |
| **Wall** | 1×1, HP 50. The sprite depends on the 4-neighbourhood of walls (`fixWall`); when a neighbour is destroyed, a "broken" variant is drawn (flags `bWallDestroyed*`). Cannot be captured, has no concrete-related degradation, and is not counted as a "structure" for the house-alive check | `Wall.cpp:71-234`, `House.h:54` |

---

## 5. Starport/CHOAM and the Palace

### 5.1 Starport and CHOAM

**Assortment.** Only the units listed in the scenario's `[CHOAM]` are available (`INIMapLoader.cpp:498-528`) — identically for **all** houses. The value = the starting quantity; `-1` → 0 (the unit is on the list but out of stock). No `[CHOAM]` section → the Starport is empty. In the campaign the Ornithopter is excluded from the Starport (`StarPort.cpp:224`).

**CHOAM::update** (`src/Choam.cpp:82-112`, called from `House::update` every cycle):
* every **30 s** (`cycle % 1875 == 0`): for one **random** item `num = min(num+1, 10)`;
* every **60 s** (`cycle % 3750 == 0`, including cycle 0): **new prices for all items**:
  `price = min( (rand(2,8) + rand(2,8)) * floor(basePrice/10), 999 )` — i.e. 40…160% of the base price (triangular distribution, mode 100%), capped at 999. A player with a Starport gets the message "New Starport prices".
* `isCheap(item)` = `price < basePrice * 1.3` (used by the AI).

**Ordering** (`StarPort.cpp:95-211`):
1. Clicking an item: if `num <= 0` → "This unit is sold out"; if money < price → "Not enough money".
2. `doProduceItem`: for each instance (1 or 5), the money is **deducted immediately**, `num--` in CHOAM, and the item goes into the queue with its own price.
3. Cancelling an item: the price of the **most expensive** such item in the queue is refunded, and `num++`.
4. The **Place Order** button (`doPlaceOrder`): `arrivalTimer = 30 s` (1875 cycles). While an order is on its way, the UI blocks new orders (`okToOrder() = arrivalTimer < 0`, `src/GUI/dune/BuilderList.cpp:105,203`); an order can be cancelled ("Cancel Order") only before it is dispatched (`StarPort.cpp:203-211`).
5. When the timer fires: a Frigate appears at the map edge nearest to the Starport and flies to it (`StarPort.cpp:234-266`). Message "Frigate has arrived".
6. Once it has landed on the Starport → `deploying`: every **2 s** one item from the queue is unloaded (Infantry/Troopers = 3 infantrymen) next to the Starport and drives to the rally point.
7. Frigate destroyed → the **entire queue is lost without a refund** (`StarPort.cpp:355-363`, `Frigate.cpp:67-71`).

AI specifics: `StarPort::doBuildRandom` never picks Harvester/MCV/Carryall.

### 5.2 Palace — special weapon

`src/structures/Palace.cpp`, the timer is in `include/structures/Palace.h:58-73`.

* Recharge: Harkonnen/Sardaukar **10 min** (37500 cycles), the rest **5 min** (18750). A freshly built Palace starts **with a full recharge** (the weapon is not ready immediately). When ready — "Palace is ready".
* The type of weapon is determined by the Palace's `originalHouseID` (a Palace cannot be captured, so in effect it is determined by the house that built it).

| House | Weapon | Mechanics |
|---|---|---|
| Harkonnen, Sardaukar | **Death Hand** | The player clicks on the target (a tile). Scatter: `r = rand(0,255); while (r>160) r /= 2; radius = 2r` world units (up to 320 = **5 tiles**), random angle. A `Bullet_LargeRocket` missile (speed 32, damage **100**) flies from the centre of the Palace. On explosion there are **21 points** (a 5×5 grid without the corners, 1-tile step), each with damage 100 and radius 64 (`Bullet.cpp:561-578`). A structure takes 100 for each point inside it; units take `100 >> (dist/16 + 1)`. If it was not the player who launched it, everyone gets "Missile is approaching" (`Palace.cpp:132-169`) |
| Atreides, Fremen | **Fremen** | A random map point around which a 3×3 area is free of ground objects (up to 1000 attempts). 15 attempts, each with a 5/6 chance → ≈12.5 **Troopers of the owner**, uncontrollable (`respondable=false`), HUNT mode, heading for the nearest enemy structure (or, failing that, a unit) (`Palace.cpp:200-261`) |
| Ordos, Mercenary | **Saboteur** | A single Saboteur next to the Palace (heading for the rally point). For the player it is controllable; for the AI it is HUNT + the message "Saboteur is approaching" (`Palace.cpp:263-278`) |

Use by the AI (see 7): as soon as it is ready — Fremen/Saboteur immediately; Death Hand — on the centre of the base of the house with the most structures (if there are no structures — on the position of the most expensive unit) (`CampaignAIPlayer.cpp:328-356`, `AIPlayer.cpp:355-381`).

The `onlyOnePalace` option — no more than one Palace per house.

---

## 6. Fog of War, "Shroud", Radar/Minimap

* **Shroud (explored)** — a permanent flag per tile and house (`include/Tile.h:400-403`). `Map::viewMap(house, center, range)` reveals tiles with `blockDistanceApprox ≤ range`; for range ≤ 1 it uses a Chebyshev square (`Map.cpp:705-741`).
  `blockDistanceApprox = ((2*max + min) + 1) / 2` (`include/mmath.h:153-162`) — a "diamond-shaped circle" as in Dune II.
* Who reveals: units while moving (ViewRange), a structure when it is placed and **every 512 cycles** (`StructureBase.cpp:333`), concrete slabs, a turret/unit shot (to the enemy — radius 2 around the shooter).
* Visibility/detection are computed **per team** (`isExploredByTeam` — any house of the team).
* **Fog of war** is an option (**off** by default): a tile is "fogged" if the team has not seen it for the last **10 s** (`FOGTIME`, `Tile.cpp:36`, `:977-1006`). In the fog the last known structures are visible (a frozen frame), and units are hidden.
* The "Start with explored map" option exists in the settings but is not applied in this fork's game logic.

**Minimap** (`Tile::getRadarColor`, `Tile.cpp:1008-1056`):

| State | What is visible |
|---|---|
| Tile not explored | black |
| Radar OFF (no Radar or no power) | only **your own** units/structures on explored tiles; terrain and enemies are black |
| Radar ON | terrain (colour by type), units/structures in the house colour, Sandworm in white; in the fog — the last known colour |

Switching the radar is accompanied by a static animation (`RadarView.cpp:185-196`).

---

## 7. Enemy AI

### 7.0 Which AI is used where

* Classes (`src/players/PlayerFactory.cpp:25-105`): `CampaignAIPlayer` (the default for the campaign, `DEFAULTAIPLAYERCLASS`), `AIPlayer` Easy/Medium/Hard (classic Dune Legacy), `SmartBot`, `QuantBot` (Defend/Easy/Medium/Hard/Brutal + the "Support" ally).
* Campaign/skirmish: the player's house is team 1, **all other houses are team 2 (allies of one another)** (`src/Menu/SinglePlayerMenu.cpp:145-160`, `INIMapLoader.cpp:940-944`). The menu lets you choose the enemy AI class — that is the "difficulty".
* Each AI runs once every `AIUPDATEINTERVAL = 50` cycles (0.8 s), staggered by houseID.
* The `Brain=` key in the scenario is ignored in the campaign (it is used only in custom games).
* **`[TEAMS]` are loaded into `House::aiteams`, but none of this fork's AIs uses them** (see 7.4).

### 7.1 CampaignAIPlayer — the "original Dune II AI" (inspired by Dune Dynasty)

`src/players/CampaignAIPlayer.cpp`. The key principles — these are what is worth reproducing:

1. **Sleep mode until contact.** `update()` does nothing while `house.isAIActivated()` = false (`:217-229`). Activation is **mutual**: when a ground (non-flying) unit of a house becomes visible to another team, both houses are activated (`src/units/UnitBase.cpp:1755-1760`).
2. **The base does not expand.** The AI only **rebuilds** destroyed structures: when a structure is lost, `(itemID, location)` is put into a rebuild queue of **5 slots** (`:235-240`). The CY builds the first element of the queue and places it **at the former location**; if that fails — it is cancelled with a refund (`:384-423`).
3. **Repair** of any of its structures with HP < 50% (`:358-364`).
4. **Upgrades**: any builder that has not reached its maximum level upgrades first (`:367-374`).
5. **Build speed is limited**: `buildSpeedLimit = min(1, ((techLevel-1)*20 + 95)/255)` → TL1 37%, TL2 45%, … TL8 92% (`:414`, `:430`). (The Dune II formula: `campaignID*20+95` out of 256.)
6. **Unit production**: each factory (except the Starport) with an empty queue takes 1 unit (`pickNextToBuild`, `:442-487`):
   * filter: the Heavy Factory **never** builds Harvester and MCV; Hi-Tech — no more than 1 Carryall; Ornithopter in skirmish not before the 10th minute (`:489-524`);
   * choice: a pass through the buildList — the item with the highest "build priority", but an item for which `(houseID + itemID) % 4 == 0` "wins" out of turn (a deterministic replacement for the original's 25% chance);
   * priorities (`:42-90`): Devastator 175, Siege 130, Launcher 100, Tank 80, Sonic 80, Ornithopter 75, Quad 60, Raider 55, Trike 50, Trooper/Troopers 50, Deviator 50, Soldier/Infantry/Carryall 20, Harvester/MCV 10.
   * The AI of this class does not use the Starport.
7. **Combat behaviour**:
   * damage to an AI **unit** from an enemy → `attackTriggered = true`; the attacked unit responds; if a Harvester is attacked — all free combat units (except Harvesters/MCVs/Carryalls/Saboteurs) go to HUNT against the aggressor (`:242-320`);
   * damage to an AI **structure** → **Full-scale attack** (one-time): all combat units without a target go to HUNT, plus base defence (`:631-659`);
   * **waves** (`updateUnits`, `:529-614`): only after `attackTriggered` or a full-scale attack. Free combat units that were **not placed by the scenario** (`isByScenario`), have no target and have no forced order are gathered. If there are ≥ **8** of them and ≥ **12 s** have passed since the previous wave, a target with the max `targetPriority/distance + 1` is chosen (`:616-624`) and the whole group goes to HUNT against it.
   * target priorities (`:92-145`): Saboteur 700, Heavy Factory 600, Repair Yard 600, Palace 400, Devastator 355, ConYard/Windtrap/Refinery 300, Siege 280, Radar 275, Launcher/Starport 250, Gun Turret/Deviator 225, … Wall 30, Slab 5.
8. Units placed by the scenario behave according to their own mode from `[UNITS]` (Guard / Area Guard / Ambush / Hunt) — this is the main "script" of a campaign mission.

### 7.2 AIPlayer (classic Dune Legacy; Easy/Medium/Hard)

`src/players/AIPlayer.cpp`:
* **Attack by timer**: the first one after `(2 - difficulty)*2 min + 9 min + houseID*30 s` (Hard ≈ 9 min, Easy ≈ 13 min) (`:40-48`). An attack: all free combat units in Guard/AreaGuard/Ambush modes drive to the nearest enemy structure of the "leader" and switch to HUNT. The next one comes after 15000 **cycles** (≈4 min; the "15 seconds" comment in the code is wrong) (`:670-713`).
* **Base building** (CY, `:552-664`): if money > 100, by priority: Windtrap (if the power reserve < 50) → Refinery (up to 3) → Radar → Starport → 1 Rocket Turret → Light → Heavy → (if < 1000 cr — stop) → up to 3 R-Turrets → IX → Repair → Palace → 4 R-Turrets → WOR → Hi-Tech → 5 R-Turrets → … (Medium/Hard: 4/5 refineries) → up to 3 Heavy → up to 10/20 R-Turrets when there is plenty of money. Under structures it first lays Slab4/Slab1 if concrete is required.
* Site selection (`findPlaceLocation`, `:159-332`): refinery — closer to spice; factories — closer to sand and right up against its own structures; turrets/walls — closer to the enemy; everything else — farther from the enemy.
* **Army**: only if `isAllowedToArm()` — Easy: the cost of the units built is less than that of the strongest enemy; Medium: < 2× the enemy; Hard: always (`:761-798`). Heavy Factory: first Harvesters up to `maxHarvester` (Easy = refineries, Medium = (2·refineries+1)/3, Hard = 2·refineries), then with > 1500 cr — tanks in set proportions (`:427-452`). Hi-Tech: Carryalls (≈1 per 2 Harvesters), with > 2500 cr — Ornithopters. Starport: Harvesters/Carryalls, otherwise up to 6 "cheap" (`isCheap`) tanks/Launchers/Quads (`:466-508`).
* Harvesters return when threatened by a Sandworm (≤ 5 tiles) and when there are < 3 of them and their load is ≥ 50% (`:715-759`). An MCV looks for a site and deploys.
* Upgrades with > 2000 cr (the CY — with > 900 cr and a Radar present).

### 7.3 QuantBot (briefly)

`src/players/QuantBot.cpp` + `config/QuantBot Config.ini.default`. The "smartest" one:
* In campaign/skirmish (`gameMode = Campaign`): on cycle 0 it records the **initial number of each structure/unit** and rebuilds structures up to those counts (except Brutal) (`:291-327`, `:2022-2035`); the army limit = the initial military cost × a difficulty multiplier (Easy 2.0 … Brutal 3.5); Harvesters = refineries × a multiplier.
* The first attack in the campaign: 8 min (TL ≤ 5), 9 min (TL6), 10 min (TL7), 12 min (TL8) (`:155-175`); in the campaign the AI "wakes up" to respond when the player has attacked a non-special unit (`:740-742`).
* Unit ratios per house are in the `[Unit Ratios]` section of the config. It has kiting, gathering a squad at a rally point, Ornithopter air strikes (Hard/Brutal), and a targeted Death Hand (`findBestDeathHandTarget`).

### 7.4 How to implement it in a simplified but similar way (recommendation)

A minimal campaign AI that reproduces the feel of Dune II:

```
every 50 cycles (0.8 s), staggered by houseID:
  if !activated: return                     // woken by mutual visual contact of ground units
  for each structure:
     palace ready → special weapon (Death Hand: centre of the enemy base with the most structures)
     HP < 50% → repair
     builder below max level → upgrade
     CY: rebuildQueue (≤5) → build and place at the former location, buildSpeedLimit=(TL-1)*20+95)/255
     factory with an empty queue → unit by priority (no Harvester/MCV, ≤1 Carryall)
  if there was combat (an AI unit took damage) or a structure was attacked:
     idle combat units built by the AI (not from the scenario) ≥ 8 and 12 s have passed → HUNT on the target with max(prio/dist)
  attack on a structure → once, all combat units go to HUNT
```
Using `[TEAMS]` (as in the original Dune II, if needed): entries `House,Behaviour,Type,Min,Max` describe "teams" — accumulate built units of the required movement type (Foot/Wheeled/Tracked/Winged/Slither/Harvester) up to `Max` (but not fewer than `Min`), then attack: Normal/Guard — the nearest units and structures, Kamikaze — structures right away, Staging — assemble, Flee — do nothing (`include/DataTypes.h:332-349`). The simplest implementation: replace the "8 units" in a wave with assembling by the `[TEAMS]` teams in round-robin order.

---

## 8. Scenario Format and Campaign

### 8.1 General structure of SCEN*.INI (version 1, Dune II)

Example (opensd2 `SCENF009.INI`, abridged):
```ini
[BASIC]
WinFlags=3            ; which events end the mission
LoseFlags=1           ; which of them count as a victory (see 8.6)
TimeOut=0             ; minutes; 0 = none
MapScale=0            ; 0: 62x62, 1: 32x32, 2: 21x21
CursorPos=3059        ; not used by the engine
TacticalPos=2796      ; initial screen position
BriefPicture=LTANK.WSA ; WinPicture=, LosePicture= — for the menus, not read by the map loader

[MAP]
Bloom=2665            ; spice blooms (positions separated by commas)
Field=338,1516,...    ; spice fields of radius 5 (the centre is thick)
Special=...           ; "special" blooms
Seed=16               ; terrain generator seed (section 9)

[Fremen]              ; house section: Harkonnen/Atreides/Ordos/Fremen/Sardaukar/Mercenary
Quota=0
Credits=1500
Brain=Human           ; ignored in the campaign
MaxUnit=25

[TEAMS]
1=Mercenary,Normal,Foot,2,5

[UNITS]
ID001=Fremen,Quad,256,2993,224,Guard

[STRUCTURES]
ID001=Fremen,Const Yard,256,3059
GEN728=Mercenary,Wall

[REINFORCEMENTS]
3=Ordos,Troopers,Enemybase,21,+

[CHOAM]
Tank=4
```
Loading order (`src/INIMap/INIMapLoader.cpp:45-56`): `[FEATURES]` (any enabled feature → error) → map → houses → units → structures → reinforcements → teams → view → CHOAM. Keys and sections are case-insensitive.

### 8.2 [BASIC]

| Key | Meaning | Reference |
|---|---|---|
| `Version` | <2 — the map comes from the Seed (Dune II); ≥2 — an explicit map in rows `000=`…`[MAP] SizeX/SizeY` with the characters `- ^ ~ + % @ O Q` (sand, dunes, spice, thick, rock, mountain, bloom, special) | `INIMapLoader.cpp:62`, `:234-334` |
| `WinFlags` (default 3), `LoseFlags` (1) | see 8.6 | `:64-65` |
| `TechLevel` (8) | only if it is not campaign/skirmish | `:67-69` |
| `TIMEOUT`/`TimeOut` (0) | minutes; the trigger is set only if `WinFlags & 8` | `:71-75` |
| `MapScale` | size and offset of the area | `:88-115` |
| `TacticalPos` | `pos + 64*5 + 7` → screen centre (Dune II stores the top-left corner of a 15×10 window) | `:914-929` |

### 8.3 Coordinates

* Position = `y*64 + x` in the **logical 64×64 map** (for Version<2).
* The play area is cut out: `x = pos % 64 - offset`, `y = pos / 64 - offset` (`include/INIMap/INIMap.h:119-120`):

| MapScale | Size | offset |
|---|---|---|
| 0 | 62×62 | 1 |
| 1 | 32×32 | 16 |
| 2 | 21×21 | 11 |

* Angle in `[UNITS]`: 0…255, 0 = north, clockwise (64 = east, 128 = south, 192 = west). Conversion to 8 directions: `a=(angle+16)/32; dir=(8-a+2)%8` (`INIMapLoader.cpp:569-570`, enum `RIGHT=0, RIGHTUP, UP, LEFTUP, LEFT, LEFTDOWN, DOWN, RIGHTDOWN`).
* Health in `[UNITS]/[STRUCTURES]`: 0…256, the fraction = `min(h/256, 1)`.

### 8.4 House sections, [UNITS], [STRUCTURES], [CHOAM]

* A house is created if there is a section with its name (or a `player1..6` section for custom maps). Keys: `Credits` (3000), `Quota` (0), `MaxUnit`/`MaxUnits`; the Harvester limit comes only from [Map Settings]. (`INIMapLoader.cpp:342-493`)
* A house mentioned only in `[UNITS]` and the like (for example "Sardaukar" with a Sandworm) is created automatically with 0 credits; in the campaign/skirmish — in **team 2** (`:936-1020`).
* `[UNITS]` key `IDnnn=House,Type,Health,Position,Angle,Mode` (`:533-660`). Modes: `Guard`, `Area Guard`, `Ambush`, `Hunt`/`Attack`, `Harvest`, `Sabotage`, `Stop`, `Capture`, `Retreat` (`src/sand.cpp:409-421`). `Infantry`/`Troopers` = 3 Soldiers/Troopers on the same tile; `Special` = Devastator (H) / Sonic Tank (A) / Deviator (O); for F/S/M — alternating Sonic/Devastator. A unit with `Enabled=false` for the house is skipped. An invalid angle → 64; an invalid mode → Area Guard.
* `[STRUCTURES]`: `IDnnn=House,Type,Health,Position` or `GENposition=House,Concrete|Wall` (`:665-755`). Scenario structures do not take damage for the lack of concrete.
* `[CHOAM]`: `UnitName=count` (`-1` → 0), common to all houses (`:498-528`).

Object names in the INI (case-insensitive, `src/sand.cpp:210-257`):

| Structures | Units |
|---|---|
| `Barracks`; `Const Yard`/`Construction Yard`; `R-Turret`/`Rocket-Turret`; `Turret`/`Gun-Turret`; `Heavy Fctry`/`Heavy Factory`; `Hi-Tech`/`HighTech Factory`; `IX`/`House IX`; `Light Fctry`/`Light Factory`; `Palace`; `Outpost`/`Radar`; `Refinery`; `Repair`/`Repair Yard`; `Spice Silo`/`Silo`; `Concrete`/`Slab1`; `Slab4`; `Star Port`/`Starport`; `Wall`; `Windtrap`; `WOR` | `Carryall`/`Carry-all`; `Devastator`/`Devistator`; `Deviator`; `Frigate`; `Harvester`; `Soldier`; `Launcher`; `MCV`; `Thopter(s)`/`'Thopter(s)`/`Ornithopter`; `Quad`; `Saboteur`; `Sandworm`; `Siege Tank`; `Sonic Tank`/`SonicTank`; `Tank`; `Trike`; `Raider Trike`/`Raider`; `Trooper`; `Special`; `Infantry`; `Troopers` |

Houses: `Harkonnen, Atreides, Ordos, Fremen, Sardaukar, Mercenary` (id 0…5; file letters `H A O F S M`, `include/globals.h:104`).

### 8.5 [REINFORCEMENTS] and triggers

Format: `n=House,Unit,Place,Time[+]` or `n=House,Unit,Place,Time,+` (`INIMapLoader.cpp:760-851`).
* **Time in minutes**: `cycle = MILLI2CYCLES(t*60*1000)` = `t*3750`. `+` (at the end of the time or as the 5th field) — **repeat every `t` minutes** (`ReinforcementTrigger.cpp:257-261`). The repeat is stored as `repeatCycle = time` (0 = no repeat, `include/Trigger/ReinforcementTrigger.h:79`), so "0,+" = a one-time event at the start of the game.
* Entries with the same house/time/place/repeat are merged into **one** trigger (one Carryall for all of them).
* Places (`src/sand.cpp:462-480`, logic in `src/Trigger/ReinforcementTrigger.cpp:58-262`):

| Place | How they appear |
|---|---|
| `North/East/South/West` | **without a Carryall**, directly at a random point on the corresponding edge, scattered along the edge (up to 63 attempts with a growing radius); a Sandworm — onto sand only |
| `Air` | a Carryall to a random point of the map |
| `Visible` | a Carryall to the centre of the map |
| `Enemybase` | a Carryall to the "main base centre" of the first enemy house (not team 0, not its own) that has structures; if there are none — to the enemy's most expensive unit; if none — to a random point |
| `Homebase` | to the centre of its own base / its own most expensive unit / a random point |

For the Carryall variants: the drop point is searched for with 32 steps of a random walk (radius 0…7) until a free tile is found; the Carryall is "ownerless" and appears at the nearest edge.
The "main base centre" = the structure closest to the mean of the centres of all the house's structures (`House.cpp:868-916`).

`TriggerManager` (`src/Trigger/TriggerManager.cpp:38-56`) is a list sorted by cycle; triggers with `cycle == current` fire.

### 8.6 Win/lose conditions

Bits (`include/Definitions.h:49-52`): `1` AI_NO_BUILDINGS, `2` HUMAN_HAS_BUILDINGS, `4` QUOTA, `8` TIMEOUT.
**WinFlags** — which events end the mission; **LoseFlags** — for events 1/2/8: if the bit is present in LoseFlags, it is a **victory** for the player, otherwise a **defeat**.

* A house is "dead" (`House.h:54`): its team ≠ 0 and it has **no structures other than walls** and **no units other than** Carryall/Harvester/Frigate/Sandworm. This is checked on every unit/structure loss (`House.cpp:422-423`, `:472-473`) and at the start.
* Bit 2: all houses of the player's team are dead → `LoseFlags&2 ? victory : defeat` (`House.cpp:575-596`).
* Bit 1: all houses of **other** teams (except team 0) are dead → `LoseFlags&1 ? victory : defeat` (`House.cpp:598-620`).
* Bit 4 (quota): whenever the player's house receives credits, if `storedCredits >= Quota` → **victory** (LoseFlags is not checked). Only **credits in storage** are counted (starting credits do not count, and spending reduces progress) (`House.cpp:251-256`).
* Bit 8: when `TimeOut` minutes elapse → `LoseFlags&8 ? victory : defeat` (`TimeoutTrigger.cpp:40-51`). The timer is shown on screen.
* Typical: `3/1` — destroy the enemy (victory) or be destroyed (defeat); `6/4` — collect the quota without being destroyed; `7/5` — quota or destruction of the enemy.

### 8.7 Campaign: missions, levels, region choice

* File: `SCEN{H|A|O|F|S|M}{NNN}.INI`, `NNN` = mission number 001…022 (`src/GameInitSettings.cpp:185-201`).
* The campaign starts at mission 1 (`GameInitSettings.cpp:46-51`).
* Level (`include/sand.h:66-72`): `level = ((mission+1)/3)+1`, but mission 22 → 9. Levels: 1 → m.1; 2 → 2-4; 3 → 5-7; 4 → 8-10; 5 → 11-13; 6 → 14-16; 7 → 17-19; 8 → 20-21; 9 → 22. **In total 9 levels, 22 scenarios per house.**
* After a **victory** (`Game.cpp:2748-2782`): victory briefing → statistics (8.8) → cutscenes (after levels 4 and 8 — "Meanwhile", after 9 — the finale; `src/sand.cpp:666-695`) → the region choice screen.
* After a **defeat**: `mission -= 3` (or −1 for mission 22) and a choice again on the map of the previous level (the region that was played is no longer available). On a defeat in mission 1 — mission 1 is replayed without a map.

The choice screen (`src/Menu/MapChoice.cpp`, `include/Menu/MapChoice.h:48-65`), data from `REGION{H/A/O/…}.INI`:
* `lastScenario = level(last mission)` (`MapChoice.cpp:44`).
* `[GROUPn]` (n = 1…8, by level): `HAR=/ATR=/ORD=/FRE=/SAR=/MER=` — the numbers of the pieces of the Dune map (1…27) that are painted in the house colour at the start of this screen (with the texts `ENGTXTk=` for piece k); `REG1..REG4=region,arrow,x,y` — the regions to attack (region, arrow sprite number 0…8, arrow position in 320×200 coordinates, ×2).
* `[PIECES] k=x,y` — the positions of the 27 pieces (`(x+8)*2, (y+24)*2`).
* A click on a region (via the "click mask") is available if the region is among the REGs of this level and has not been played yet (the bit mask `alreadyPlayedRegions`; when all have been played it is reset).
* **Next mission**: `regionIndex` = the index of the chosen REG (0…3);
  `mission = (lastScenario-1)*3 + 2 + regionIndex` for levels 1…7; for level 8 — `22 + regionIndex` (`MapChoice.h:56-63`).
  That is, after m.1 you choose 2/3/4, after 2-4 → 5/6/7, …, after 17-19 → 20/21, after 20-21 → 22 (in GROUP8 all the REGs point to one region).

### 8.8 Score calculation (`src/Menu/CampaignStatsMenu.cpp:420-494`)

```
score = level*45
      + Σ(player: destroyedValue) − Σ(AI: destroyedValue)   // destroyedValue += max(price/100,1) for each kill
      + player_credits / 100
      + Σ over the player's structures price/100
      − (game_seconds/60 + 1)
```
Also shown: spice collected by the player/AI (+ the Harvesters' cargo), the number of units and structures destroyed. Time — `gameCycle*16 ms`.
Ranks: ≥1400 Emperor, ≥1000 Ruler of Arrakis, ≥700 Chief Warlord, ≥500 Warlord, ≥400 Base Commander, ≥300 Outpost Commander, ≥200 Squad Leader, ≥150 Dune Trooper, ≥100 Sand Warrior, ≥50 Desert Mongoose, ≥25 Sand Snake, otherwise Sand Flea (with cheats — "Cheater").

---

## 9. The Dune II Seed Map Generator (1:1 port)

Source: `src/MapSeed.cpp:23-504` (`createMapWithSeed(Uint32 seed, Uint16* result)`), called from `INIMapLoader.cpp:123-167`.
The ready-made port: **`docs/research/mapseed_port.js`** — `createMapFromSeed(seed)`, `createRawMapFromSeed(seed)`, `cropForMapScale(map, mapScale)`, `iniPosToXY(pos, mapScale)`.

**Port verification:** the C++ code from `MapSeed.cpp` was compiled with MSVC as is (only the `typedef`s of the types and `SDL_SwapLE32` = identity on little-endian) and compared with the JS by the FNV hash of all 4096 values:
seeds 0…69,999, 20,000 seeds with a step of 214,749, 20,000 seeds with a step of 4,294,949 (a check of 32-bit overflow) — **0 mismatches out of 110,000**; plus an element-by-element comparison for all 48 seeds from opensd2 — a match.

### 9.1 Types and important C details

* `MapArray` — `Uint32[65*65]` (elements ≥ 4096 are always 0 and are read as "0" at the bottom edge).
* The index `idx(x,y) = x | (y << 6)` — a **bitwise OR**. With `x = 64` and even `y` it gives `(y+1)*64` (the start of the next row), with odd — `y*64`. Reproduce this literally.
* `idxOOB(x,y) = idx(x & 63, y)` — horizontal "toroidality" when reading.
* `point.x/point.y` — `Uint16` (overflow mod 65536 matters in steps 7 and 8).
* `>> 7` of a negative `int` is an arithmetic shift (JS `>>` matches).

### 9.2 The random number generator `SeedRand()` (`MapSeed.cpp:167-217`)

The state is a 32-bit `Seed`; the bytes `p0` (lowest), `p1`, `p2` are used; `p3` does not change. A translation of the Dune II assembly:
```
a = p0 >> 1                ; shr al,1
carry = a & 1 ; a >>= 1    ; shr al,1   (carry = bit 1 of the original p0)
c2 = p2>>7 ; p2 = (p2<<1 | carry) & 0xFF ; carry = c2     ; rcl [seed+2],1
c1 = p1>>7 ; p1 = (p1<<1 | carry) & 0xFF ; carry = c1     ; rcl [seed+1],1
carry = !carry                                            ; cmc
a = (a - (p0 + carry)) & 0xFF                             ; sbb al,[seed]
carry = a & 1                                             ; shr al,1
p0 = (p0 >> 1) | (carry << 7)                             ; rcr [seed],1
return p0 ^ p1                                            ; 0..255
```

### 9.3 Tables

```
BoolArray[21]  = {0,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0,0,1,0,0}   // [v]==1: 4 (rock), 6 (mountain) — "solid"
OffsetArray1[21] = {0,-1,1,-16,16, -17,17,-15,15, -2,2,-32,32, -4,4,-64,64, -30,30,-34,34}
```
`OffsetArray2` — 42 entries `(x1,y1)-(x2,y2)`; the midpoint is written to the `idx` of the mean of the packed indices:
```
 i : points           → midpoint     |  i : points           → midpoint
 0 : (0,0)-(4,0) → (2,0)             | 21 : (0,0)-(4,0) → (2,0)
 1 : (4,0)-(4,4) → (4,2)             | 22 : (4,0)-(4,4) → (4,2)
 2 : (0,0)-(0,4) → (0,2)             | 23 : (0,0)-(0,4) → (0,2)
 3 : (0,4)-(4,4) → (2,4)             | 24 : (0,4)-(4,4) → (2,4)
 4 : (0,0)-(0,2) → (0,1)             | 25 : (0,0)-(0,2) → (0,1)
 5 : (0,2)-(0,4) → (0,3)             | 26 : (0,2)-(0,4) → (0,3)
 6 : (0,0)-(2,0) → (1,0)             | 27 : (0,0)-(2,0) → (1,0)
 7 : (2,0)-(4,0) → (3,0)             | 28 : (2,0)-(4,0) → (3,0)
 8 : (4,0)-(4,2) → (4,1)             | 29 : (4,0)-(4,2) → (4,1)
 9 : (4,2)-(4,4) → (4,3)             | 30 : (4,2)-(4,4) → (4,3)
10 : (0,4)-(2,4) → (1,4)             | 31 : (0,4)-(2,4) → (1,4)
11 : (2,4)-(4,4) → (3,4)             | 32 : (2,4)-(4,4) → (3,4)
12 : (0,0)-(4,4) → (2,2)  ← diagonal | 33 : (4,0)-(0,4) → (2,2)  ← other diagonal
13 : (2,0)-(2,2) → (2,1)             | 34 : (2,0)-(2,2) → (2,1)
14 : (0,0)-(2,2) → (1,1)             | 35 : (0,0)-(2,2) → (1,1)
15 : (4,0)-(2,2) → (3,1)             | 36 : (4,0)-(2,2) → (3,1)
16 : (0,2)-(2,2) → (1,2)             | 37 : (0,2)-(2,2) → (1,2)
17 : (2,2)-(4,2) → (3,2)             | 38 : (2,2)-(4,2) → (3,2)
18 : (2,2)-(0,4) → (1,3)             | 39 : (2,2)-(0,4) → (1,3)
19 : (2,2)-(4,4) → (3,3)             | 40 : (2,2)-(4,4) → (3,3)
20 : (2,2)-(2,4) → (2,3)             | 41 : (2,2)-(2,4) → (2,3)
```
The raw 168 bytes (as in C, rows of 21):
```
0,0,4,0,4,0,4,4,0,0,0,4,0,4,4,4,0,0,0,2,0,
2,0,4,0,0,2,0,2,0,4,0,4,0,4,2,4,2,4,4,0,4,
2,4,2,4,4,4,0,0,4,4,2,0,2,2,0,0,2,2,4,0,2,
2,0,2,2,2,2,2,4,2,2,2,0,4,2,2,4,4,2,2,2,4,
0,0,4,0,4,0,4,4,0,0,0,4,0,4,4,4,0,0,0,2,0,
2,0,4,0,0,2,0,2,0,4,0,4,0,4,2,4,2,4,4,0,4,
2,4,2,4,4,4,4,0,0,4,2,0,2,2,0,0,2,2,4,0,2,
2,0,2,2,2,2,2,4,2,2,2,0,4,2,2,4,4,2,2,2,4
```
`sinus[256]` = `round(127*sin(π·i/128))` in Sint8 (`MapSeed.cpp:78-95`; in full — in `mapseed_port.js`; **do not recompute it**, take the table: the values do not always match plain rounding, for example `sinus[20]=59` (not 60), `sinus[192]=-126` (not -127)):
```
  0,  3,  6,  9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45,
 48, 51, 54, 57, 59, 62, 65, 67, 70, 73, 75, 78, 80, 82, 85, 87,
 89, 91, 94, 96, 98,100,101,103,105,107,108,110,111,113,114,116,
117,118,119,120,121,122,123,123,124,125,125,126,126,126,126,126,
127,126,126,126,126,126,125,125,124,123,123,122,121,120,119,118,
117,116,114,113,112,110,108,107,105,103,102,100, 98, 96, 94, 91,
 89, 87, 85, 82, 80, 78, 75, 73, 70, 67, 65, 62, 59, 57, 54, 51,
 48, 45, 42, 39, 36, 33, 30, 27, 24, 21, 18, 15, 12,  9,  6,  3,
  0, -3, -6, -9,-12,-15,-18,-21,-24,-27,-30,-33,-36,-39,-42,-45,
-48,-51,-54,-57,-59,-62,-65,-67,-70,-73,-75,-78,-80,-82,-85,-87,
-89,-91,-94,-96,-98,-100,-102,-103,-105,-107,-108,-110,-111,-113,-114,-116,
-117,-118,-119,-120,-121,-122,-123,-123,-124,-125,-125,-126,-126,-126,-126,-126,
-126,-126,-126,-126,-126,-126,-125,-125,-124,-123,-123,-122,-121,-120,-119,-118,
-117,-116,-114,-113,-112,-110,-108,-107,-105,-103,-102,-100,-98,-96,-94,-91,
-89,-87,-85,-82,-80,-78,-75,-73,-70,-67,-65,-62,-59,-57,-54,-51,
-48,-45,-42,-39,-36,-33,-30,-27,-24,-21,-18,-15,-12, -9, -6, -3
```
`TileTypes[]` (for values > 85) is not used in practice (the maximum value = 80), but it is kept in the port.

### 9.4 The algorithm, step by step

All `R()` calls = `SeedRand()`, in strictly the stated order.

1. **Height grid** `G` (`Uint8[273]`): for `i = 0..271`: `G[i] = R() & 15`, if > 10 → 10. (`G[272]` is uninitialized, but never reaches the map.)
2. **Blobs**: `for (i = R() & 15; i >= 0; i--)` { `c = R() & 255`; for `j = 0..20`: `k = clamp(c + OffsetArray1[j], 0, 272)`; `G[k] = (G[k] + (R() & 15)) & 15` }.
3. **Depressions**: `for (i = R() & 3; i >= 0; i--)` { `c = R() & 255`; for `j = 0..20`: `k = clamp(...)`; `G[k] = R() & 3` }.
4. **Layout**: for `y = 0,4,…,60`, `x = 0,4,…,60`: `M[idx(x,y)] = G[y*4 + x/4]` (only `G[0..255]` are used).
5. **Subdivision**: for `y = 0,4..60`, `x = 0,4..60`; `base = (x % 8 == 0) ? 21 : 0`; for `i = base..base+20`:
   `P1 = idx(x+O2[4i], y+O2[4i+1])`, `P2 = idx(x+O2[4i+2], y+O2[4i+3])`, `pos = (P1+P2)/2` (integer);
   if `pos >= 4096` — skip; otherwise `M[pos] = (M[idxOOB(..P1..)] + M[idxOOB(..P2..)] + 1) / 2`.
   The order matters: the following entries use midpoints that have already been computed.
6. **3×3 box filter** over the rows `y = 0..63`: the values of the previous and current rows are taken **before** filtering (the copies `oldRow`, `curRow`), and the next row's — from the not yet processed `M`. Outside the map, the **centre** value is substituted. `M[y*64+x] = (sum of 9) / 9` (integer).
7. **Thresholds**: `r = R() & 15`, `r = clamp(r, 8, 12)`; `py = ((R() & 3) - 1) & 0xFFFF` (Uint16!); `py = min(r-3, py)` (if `R()&3 == 0` → `py = r-3`, not −1).
   For each tile `h = M[i] & 0xFFFF`: `h > r+4` → **6** (mountain); `h >= r` → **4** (rock); `h <= py` → **2** (dunes); otherwise **0** (sand).
8. **Spice**: `for (i = R() & 0x2F; i != 0; i--)` (0…15 or 32…47 fields):
   * `y = R() & 63`, then `x = R() & 63`; `index = idx(x,y)`; if `BoolArray[M[index]] == 1` (rock/mountain) — `i++; continue` (retry).
   * `n = R() & 31`; for `j = 0..n-1`:
     * `max = R() & 63`; if `max == 0` → `pos = index`;
     * otherwise: `py = ((index<<2) & 0xFF00) | 0x80`, `px = ((index & 63) << 8) | 0x80` (the tile centre in 8.8 fixed point); `d = R() & 255`, while `d > max`: `d >>= 1`; `a = R() & 255`;
       `px = (px + (((sinus[a]*d) >> 7) << 4)) & 0xFFFF`; `py = (py + (((-sinus[(a+64)%256]*d) >> 7) << 4)) & 0xFFFF`;
       if `px > 0x4000 || py > 0x4000` → `pos = index`, otherwise `pos = ((py & 0xFF00) >> 2) | (px >> 8)`;
     * if `pos >= 4096` — `j--; continue` (repeat the iteration);
     * `SmoothNeighbourhood(pos)`:
       * `M[pos] == 8` → `M[pos] = 9`, recursively for `pos`;
       * `M[pos] == 9` → for the 3×3 neighbours (including the tile itself; `P = idx(px+dx, py+dy)`, skipping `P<0 || P>=4096`): if the neighbour is "solid" → `M[pos] = 8` (the centre "rolls back"); otherwise, if the neighbour ≠ 9 → the neighbour = 8;
       * otherwise, if it is not solid (0 or 2) → `M[pos] = 8`.
     The result: sand/dunes → spice (8); a repeated hit → thick spice (9) with a rim of spice; thick spice does not form next to rock.
9. **Neighbour masks** (a second pass with row copies, as in step 6): for the centre `C` and the 4 neighbours (outside the map = `C`):
   bit0 — up, bit1 — right, bit2 — down, bit3 — left are set if the neighbour is "of the same class": for `C=4` — the neighbour is 4 or 6; for `C=8` — 8 or 9; otherwise — equal to `C`.
   Then: `C=0` → 0; `C=4` → `mask+1`; `C=2` → `mask+0x11`; `C=6` → `mask+0x21`; `C=8` → `mask+0x31`; `C=9` → `mask+0x41`.
10. **Result**: `tile = ((v & 0xFE00) | (v <= 85 ? v+127 : TileTypes[v-85]) | 0xF800) & 0x1FF` = effectively `v + 127` (range 127…207).

The tile type = `tile >> 4` (`INIMapLoader.cpp:130-161`):

| `tile>>4` | Type | Tile range | Low 4 bits |
|---|---|---|---|
| 0x7 | Sand | 127 | — |
| 0x8 | Rock | 128…143 | neighbour mask (rock/mountain) |
| 0x9 | Dunes | 144…159 | dune mask |
| 0xA | Mountain | 160…175 | mountain mask |
| 0xB | Spice | 176…191 | spice mask (spice/thick) |
| 0xC | Thick Spice | 192…207 | thick spice mask |
| 0x2 | "Building" → Rock | not created by the generator | |

The mask can be used for autotiling (Dune Legacy itself recomputes the sprites from the neighbours, `Tile.cpp:1060-1135`).

### 9.5 Applying it to a scenario

1. `raw = createRawMapFromSeed(Seed)`; 2. crop the area according to `MapScale` (`offset` 1/16/11); 3. the type of each tile comes from the table; the amount of spice on a tile is set by the **game** RNG (74…148 / 148…296) — it is not part of the Seed algorithm; 4. place the blooms `Bloom=`, `Special=` (the tile type changes to a bloom), then `Field=` (radius 5, centre thick) — in exactly this order (`INIMapLoader.cpp:169-232`); 5. compute the "sand regions" (connected non-rock areas by 8-neighbourhood) — needed for Sandworms (`Map.cpp:80-116`).

---

## 10. Non-Obvious Rules That Matter for the Dune II Feel

1. **Two kinds of money**: starting credits need no silos; refined spice **leaks away at 1 cr/cycle** on overflow, and spending is drawn first from the spice in storage.
2. **The quota** counts only the spice in storage (`storedCredits`), not the total balance.
3. **A structure without concrete is placed with 50% HP** (proportional to the number of tiles without concrete); walls and the CY have no penalty.
4. **Build speed is proportional to the HP of the factory/CY** — a damaged CY builds slowly.
5. Power: a Windtrap yields power in proportion to its HP; with a deficit the radar goes dark and structures degrade (down to 50%, hardest for Mercenary/Harkonnen); production does not depend on power (in this fork).
6. **A free Harvester** with every refinery and upon the loss of the last Harvester.
7. Refinery unloading slows down in steps of 20% of the refinery's HP.
8. **Infantry from ruins**: each tile of a destroyed structure yields a Soldier with a chance of `InfSpawnProp`% (IX 75%, Palace/Refinery/Radar/Starport 50%).
9. Capture: an infantryman who enters a "red" structure captures it (together with its contents and the silo's spice); otherwise he deals damage and dies. A captured factory builds units of the **original** house.
10. **Tile ownership remains after destruction** — you can keep building on the ruins.
11. A spice bloom kills whoever steps on it and creates a field of radius 5 only on clean sand; shooting at a bloom also detonates it.
12. A destroyed Harvester scatters 75% of its cargo as spice.
13. Repairing structures is cheap, the Palace (HP > 512) is repaired for free; repair cannot be stopped manually.
14. Repairing units at a Repair Yard: 1 HP/cycle for 0.1 cr; vehicles with HP < 50% go to repair on their own if a Carryall is available.
15. CHOAM: prices 40…160% of the base, updated once a minute; the stock grows by 1 random item every 30 s (up to 10); delivery takes 30 s + the flight, unloading is 1 unit per 2 s; a shot-down Frigate = the loss of the whole order.
16. Palace: the weapon is **not ready** immediately after construction (5 min, for Harkonnen 10 min); Death Hand — 21 explosions of 100 damage with a scatter of up to 5 tiles; Fremen — ≈12 uncontrollable Troopers at a random place on the map.
17. The campaign AI **sleeps** until its ground units meet yours; it does not expand its base, only rebuilds what was destroyed (a queue of 5) at the former location; it repairs everything below 50%; it builds more slowly (37…92% depending on the level); waves of 8 units no more often than every ≥12 s, and only after combat has started; an attack on an AI structure triggers a "total" attack.
18. All hostile houses in the campaign are one team; a house "dies" only when it has neither structures (other than walls) nor combat units.
19. Reinforcements from the map edges (`North/East/South/West`) appear without a Carryall, directly on the edge; the others are carried by a Carryall, which can be shot down.
20. A Rocket Turret at close range (< 3 tiles) fires like a Gun Turret; a shot from any turret reveals its position.
21. Unit limit: infantry counts as 1/3; aircraft have a separate limit.
22. Time in scenarios (`TimeOut`, reinforcements) is in **minutes**.

### Summary of key constants

| Constant | Value | Where |
|---|---|---|
| Cycle | 16 ms (62.5/s) | `Definitions.h:42` |
| BUILDRANGE | 2 tiles | `Definitions.h:57` |
| Build time | `BuildTime*15` cycles | `BuilderBase.cpp:233` |
| Unit roll-out | 750 ms | `BuilderBase.cpp:341` |
| Upgrade | builder price/2, 600 cycles | `BuilderBase.cpp:356`, `:432` |
| Degradation | every 15 s, H/S 3%, O 2%, M 5%, others 1%, down to 50% | `StructureBase.cpp:342-360` |
| Power tax | power/32 every 15 s | `House.cpp:364-368` |
| Spice leak | 1 cr/cycle when stored > capacity | `House.cpp:353-357` |
| Refinery / Silo | 1005 / 1000 | ObjectData |
| Harvester | 700, harvesting 0.1344/cycle, unloading 0.625/cycle | `Definitions.h:82-83`, `Refinery.cpp:34` |
| Spice per tile | 74-148 / 148-296 | `Definitions.h:61-64` |
| Unit repair | +1 HP, −0.1 cr per cycle | `Definitions.h:90`, `RepairYard.cpp:135` |
| CHOAM | +1 item/30 s (≤10), prices/60 s, 40-160% (≤999) | `Choam.cpp:12-15`, `:82-112` |
| Starport | delivery 30 s, unloading 2 s/unit | `StarPort.cpp:35`, `:260` |
| Palace | 5 min / 10 min (H,S); Death Hand 100 damage × 21 | `Palace.h:64-73`, `Palace.cpp:38` |
| Fog | 10 s | `Tile.cpp:36` |
| AI | once per 50 cycles; wave of ≥8 units, once per ≥12 s | `CampaignAIPlayer.cpp:32`, `include/players/CampaignAIPlayer.h:115-116` |
