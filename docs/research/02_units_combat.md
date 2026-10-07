# 02. Units, Weapons, Combat, Movement — Technical Specification (from the Dune Legacy source)

Source: a Dune Legacy clone in `scratchpad/dunelegacy` (all paths below are relative to the root of that repository).
Numeric unit stats (HP, damage, range, reload, speed) are taken from `config/ObjectData.ini.default`.
They are **not copied in full** here; they are used only for calculations and examples.

> **A note on the version.** This is not "vanilla" Dune Legacy 0.96/0.97 but a fork. The code has many comments mentioning "Dynasty", "v0.96.4" and "MULTIPLAYER-SAFE",
> and it includes the QuantBot AI, a pathfinding budget, and so on. Speeds in the INI are roughly 2–2.5 times higher than in the classic game, rockets got
> a "Dynasty-style" mechanic, and the Carryall gained a "pull-in" towards its target. If anything here differs from what you remember
> of Dune II/DL 0.96, the code takes priority. Places where the behaviour clearly looks like a bug are marked **[BUG/QUIRK]**.

---

## 0. Simulation model (what you need to know before reading the rest)

* **Fixed step.** The logic is deterministic: fixed-point `FixPoint` (Q32.32) and its own RNG, `currentGame->randomGen`. In JS, `float64` plus a seeded RNG is enough unless you need network lock-step.
* **Order of a single game cycle** (`Game::processObjects`, src/Game.cpp:331-382):
  1. the target-search request queue — up to 50 per cycle (src/Game.cpp:384-424);
  2. the pathfinding request queue — an A* node "budget": 15000 nodes per cycle, adaptive 5k–25k (include/Game.h:854-858, src/Game.cpp:533+). If the budget is exhausted, the unit waits for its path until the following cycles;
  3. `Tile::update` — corpse timers;
  4. all structures;
  5. all units (`unitList`, in creation order);
  6. all bullets (`bulletList`). A bullet fired in this same cycle immediately makes its first step;
  7. all explosions (visual animation only).
* **Unit update** (`UnitBase::update`, src/units/UnitBase.cpp:1658-1720):
  if `active`: `targeting()` → `navigate()` → `move()` → (if still active) `turn()` → `updateVisibleUnits()`.
  Then, if `health <= 0`, `destroy()` is called. At the end, all timers greater than 0 are decremented: `recalculatePathTimer`, `findTargetTimer`, `primaryWeaponTimer`, `carryallRequestCooldown`, `secondaryWeaponTimer`. The `deviationTimer` is decremented too, and when it reaches ≤ 0, `quitDeviation()` is called.
* **Objects on a tile.** A tile holds 4 lists: air / non-infantry ground (vehicles and structures) / infantry (up to 5) / underground (worms) — include/Tile.h.
  A "ground object" = a vehicle, a structure or infantry. A tile is `isBlocked()` = a mountain, or it contains a ground object (include/Tile.h:450).

---

## 1. System constants and unit conversion

### 1.1 Space and angles

| Constant | Value | Where |
|---|---|---|
| `TILESIZE` | **64** world pixels per tile | include/Definitions.h:66 |
| Tile centre (x,y) | `(x*64+32, y*64+32)` | `Tile::getCenterPoint`, include/Tile.h |
| `realX/realY` of a unit | world coordinates of the unit's **centre** (for infantry, with the sub-position offset) | UnitBase::setLocation, UnitBase.cpp:1214 |
| Directions | 8: RIGHT=0, RIGHTUP=1, UP=2, LEFTUP=3, LEFT=4, LEFTDOWN=5, DOWN=6, RIGHTDOWN=7 (counter-clockwise, screen Y points down) | include/DataTypes.h:474-484 |
| Bullet angle | scale 0..256 (256 = 360°), `drawnAngle = round(a/32) & 7` | include/mmath.h:72-94 |
| `DIAGONALSPEEDCONST` | √2/2 ≈ 0.7071 | Definitions.h:37 |
| Map size | ≤ 512×512 | Definitions.h:54-55 |

**Distance metrics** (include/mmath.h):

* `blockDistance(p1,p2)` (line 136) — **octile**: `max(dx,dy) + (√2−1)·min(dx,dy)`, in tiles (fractional). It is used for weapon range, guard/attack range and the A* heuristic.
* `blockDistanceApprox` (line 153) — `round((2·max+min)/2)`, "as in the original". Used only for revealing the map (`Map::viewMap`).
* `distanceFrom` — Euclidean, in pixels. Used for splash, bullet movement and the Carryall.
* `maximumDistance` — Chebyshev, `max(dx,dy)`.

### 1.2 Time

| Constant | Value | Where |
|---|---|---|
| Cycle length | `gameSpeed` ms; by default **16 ms → 62.5 cycles/s**; configurable 8..32 ms | Definitions.h:40-42, Game.cpp:2049-2128 |
| `MILLI2CYCLES(ms)` | `ms / 16`. All "second" timers are specified in cycles, so changing the game speed scales everything at once | Definitions.h:43 |
| `WeaponReloadTime` (INI) | in **cycles** | ObjectData.cpp; UnitBase::attack, UnitBase.cpp:251 |
| `UNITIDLETIMER` | 315 cycles ≈ 5 s — random turns of idle units | UnitBase.cpp:45, 805 |
| `FOGTIME` | 625 cycles (10 s) — a tile "fogs over" if it has not been seen | src/Tile.cpp:36 |
| `DEVIATIONTIME` | 7500 cycles (120 s) | Definitions.h:80 |
| `TRACKSTIME` | 4096 cycles (~65 s), track marks (visual) | Definitions.h:81 |
| Corpses on a tile | 2000 cycles (32 s), visual | include/Tile.h:236 |
| Explosion frame | 5 cycles/frame, visual | src/Explosion.cpp:27 |

**Reload in seconds** (defaults, 62.5 cycles/s; values from the INI):

| Unit/weapon | Reload, cycles | seconds | Shots per volley |
|---|---|---|---|
| Soldier | 135 | 2.16 | 1 |
| Trooper | 150 | 2.40 | 1 |
| Trike / Raider Trike / Quad | 150 | 2.40 | 2 (the second after 15 cycles = 0.24 s) |
| Tank | 240 | 3.84 | 1 |
| Siege Tank | 270 | 4.32 | 2 |
| Devastator | 300 | 4.80 | 2 |
| Launcher | 360 | 5.76 | 2 |
| Deviator | 540 | 8.64 | 1 |
| Sonic Tank | 240 | 3.84 | 1 |
| Ornithopter | 150 | 2.40 | 1 |
| Sandworm (pause between "bites") | 60 | 0.96 | — |
| Gun Turret / Rocket Turret (for reference) | 240 / 360 | 3.84 / 5.76 | 1 |

### 1.3 Speeds

`MaxSpeed` in the INI is in **world pixels per cycle** (at TILESIZE=64).
`v[tiles/s] = MaxSpeed × 62.5 / 64 = MaxSpeed × 0.9766`.
The actual speed of a ground unit = `MaxSpeed × kTerrain × kDamage` (details in section 6).

| Unit | MaxSpeed (INI) | tiles/s on concrete | Movement class |
|---|---|---|---|
| Soldier | 1.024 | 1.00 | infantry |
| Trooper | 1.92 | 1.88 | infantry |
| Saboteur | 5.12 | 5.00 | infantry |
| Trike | 6.4425 | 6.29 | wheeled |
| Raider Trike | 9.25 | 9.03 | wheeled |
| Quad | 5.12 | 5.00 | wheeled |
| MCV | 2.56 | 2.50 | **wheeled** (GroundUnit, not TrackedUnit!) |
| Harvester | 2.56 | 2.50 | tracked, but with **no** terrain effect on speed |
| Tank | 4.0 | 3.91 | tracked |
| Siege Tank | 2.56 | 2.50 | tracked |
| Launcher / Sonic / Deviator | 3.84 | 3.75 | tracked |
| Devastator | 1.28 | 1.25 | tracked |
| Sandworm | 4.48 | 4.38 (×0.75 on sand = 3.28) | underground |
| Carryall | 19.2 | 18.75 (variable, see §8) | air |
| Ornithopter | 14.4 | 14.06 (constant) | air |
| Frigate | 12.8 | 12.5 (variable) | air |

In addition, ground units have a **pause on every tile**. Navigation runs only in cycles where `(cycle + objectID*1337) % 5 == 0` (UnitBase.cpp:734). At least 1 more cycle is spent on `justStoppedMoving`. In practice this is 1–5 cycles of idling at the centre of each tile (more in §6.3).

### 1.4 Turning

`TurnSpeed` (INI) is measured in **eighths of a full turn per cycle**, i.e. 1.0 = 45° per cycle
(UnitBase::turnLeft/turnRight, UnitBase.cpp:1625-1643; AirUnit::turn, AirUnit.cpp:171).
The comments in the INI call this "rad" — that is incorrect.

* All ground units (by default): 0.0625 → **16 cycles per 45°** (0.256 s), 180° ≈ 1.02 s.
* TankBase turrets (Tank, Siege): a fixed 0.0625 (include/units/TankBase.h:60), not from the INI.
* Carryall/Frigate: 0.099 → ~4.46°/cycle (~278°/s). Ornithopter: 0.0707 → ~3.18°/cycle. Sandworm: 0.625 → 1.6 cycles per 45°.

### 1.5 Other constants (Definitions.h, unless stated otherwise)

* `HARVESTERMAXSPICE = 700` (line 82), `HARVESTSPEED = 0.1344` spice/cycle (line 83).
* `MAXIMUMHARVESTERSLOWDOWN = 0.4` (Harvester.cpp:48); unloading `MAXIMUMHARVESTEREXTRACTSPEED = 0.625`/cycle (Refinery.cpp:34).
* `BADLYDAMAGEDRATIO = 0.5` (line 84) — below 50% HP a unit is "badly damaged": it smokes, slows down and loses its second barrel.
* `HEAVILYDAMAGEDRATIO = (025_fix)` (line 85) — **[BUG]**: the literal `025` is parsed as an octal integer = 21.0 (`operator"" _fix(unsigned long long)`, include/fixmath/FixPoint.h:77). 0.25 was intended. Consequence: the "red" health colour (and the ability to **capture** a building) kicks in already at HP < 50%, not < 25%. See §4.17 and §9.
* `HEAVILYDAMAGEDSPEEDMULTIPLIER = 0.75` (line 86).
* `NUM_INFANTRY_PER_TILE = 5` (line 88).
* `UNIT_REPAIRCOST = 0.1` credits per 1 HP (line 90).
* `MIN_CARRYALL_LIFT_DISTANCE = 6` tiles (line 58).
* `RANDOMSPICEMIN/MAX = 74..148` per spice tile, `RANDOMTHICKSPICEMIN/MAX = 148..296` per thick spice tile (lines 61-64).
* `DEFAULT_GUARDRANGE = 10` (line 91). In the code, AREAGUARD uses the literal 10 (12 for the Launcher).

---

## 2. Projectiles and weapons

Projectile types: include/data.h:22-34. Parameters: `Bullet::init`, src/Bullet.cpp:167-269. Behaviour: `Bullet::update`, src/Bullet.cpp:353-545.
Explosion and damage: `Bullet::destroy`, src/Bullet.cpp:548-616 → `Map::damage`, src/Map.cpp:118-302.

### 2.1 Projectile table

| ID | Projectile | Fired by (damage from INI) | Speed, px/cycle (tiles/s) | Damage radius, px | Timer (cycles) | Homing | Scatter | Explodes on a structure in its path | Hits air | Terraforming |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | DRocket (Deviator gas) | Deviator (0) | 19.2 (18.75) | 32 | 19; 50 against an air target | only after an Ornithopter | yes, "Dynasty-style" | no | in theory yes (`Map::damage` has a branch for it), but the Deviator does not pick air targets | no |
| 1 | LargeRocket (Death Hand) | Palace H/Sardaukar (100) | 32 (31.25) | 64 × 21 points | none | no | at launch 0..320 px | no | no (`air=false`) | yes |
| 2 | Rocket | Launcher (75×2) | 19.2 (18.75) | 32 | 22; 50 against air | only after an Ornithopter | yes | no | yes | yes |
| 3 | TurretRocket | Rocket Turret (30) | 19.2 (18.75) | 32 | 60 against ground / 120 against air; explodes on expiry | full homing on any target | no | no | yes | yes |
| 4 | ShellSmall | Soldier 3, Trooper at close range, Trike 5×2, Raider 5×2, Quad 7×2 | 20 (19.5) | 32 | — | no | no | **yes** | no | no |
| 5 | ShellMedium | Tank (25) | 20 | 32 | — | no | no | **yes** | no | no |
| 6 | ShellLarge | Siege (30×2), Devastator (40×2) | 20 | 32 | — | no | no | **yes** | no | no |
| 7 | ShellTurret | Gun Turret (20), Rocket Turret at close range (<3 tiles) | 20 | 32 | — | no | no | yes, except for own structures | no | no |
| 8 | SmallRocket | Trooper (5), Ornithopter (45) | 23.04 (22.5) | 32 | 7 (not used) | no | no | no | yes | yes (smaller craters) |
| 9 | Sonic | Sonic Tank (60) | 2×6 = 12 (11.7) | 48, damage without falloff | 45 | no | no | passes straight through | no | no |
| 10 | Sandworm | Sandworm (5000, pseudo-projectile) | — | the worm's tile only | — | — | — | — | — | — |

Notes on the columns:

* "Explodes on a structure in its path": shell-type projectiles (`explodesAtGroundObjects=true`, Bullet.cpp:493-500) explode in the very first tile containing a **structure** that they cross. This also applies to your own structures, except that ShellTurret passes through its own structures. This is why a shot at a unit behind a wall hits the wall.
* A bullet that leaves the map by more than 5 tiles is removed without exploding (Bullet.cpp:450-454).
* Sound and visual explosion type: Bullet.cpp:554-611 (Explosion_Gas, Large1/2, Small, ShellSmall/Medium/Large).

### 2.2 General flight logic

```
every cycle:
  (for Rocket/DRocket/TurretRocket — steer towards destination, see 2.3)
  oldDist = |pos - destination|
  pos += (xSpeed, ySpeed)
  tile = floor(pos / 64)
  if tile is outside the map by more than 5 → remove
  newDist = |pos - destination|
  if detonationTimer > 0: detonationTimer--
  TurretRocket and detonationTimer == 0 → explode here
  Sonic → see 2.5
  shell and there is a structure in tile (for ShellTurret — not its own) → explode here
  if oldDist < newDist  OR  newDist < 4:          // "arrived or overshot"
      Rocket/DRocket: target is air → explode here; otherwise explode only if detonationTimer == 0
      TurretRocket: pos = destination; explode
      others: pos = destination; explode
```

The firing direction is towards the original target point: the target's centre at the moment of firing, `getClosestCenterPoint`. For a structure this is the centre of the tile closest to the shooter (StructureBase.cpp:292). The target for the shot is taken in `UnitBase::attack` (UnitBase.cpp:205-298).

### 2.3 Launcher (Rocket) and Deviator (DRocket) rockets

* **Scatter on firing** (Bullet.cpp:86-113). Let `d = round(dist/64)` in tiles. With a 15/16 chance `limit = d + 8`, otherwise `limit = rand(0..255) + 8`.
  Take `r = rand(0..255)` and keep halving it while `r > limit`. The destination point is offset by `r` **pixels** in a random direction.
  Result: the miss is usually no more than (d+8) px, i.e. up to ~¼ tile. In roughly 1 of 16 cases the miss can be up to ~4 tiles.
* **Homing** (Bullet.cpp:355-397). The rocket starts on a heading towards the original target point, then each cycle turns towards `destination` by no more than 4.5/256 of a revolution (≈6.3°/cycle). Turning radius ≈ 19.2/0.11 ≈ 174 px ≈ 2.7 tiles.
  If the target is an **Ornithopter**, `destination` is replaced with its current centre every cycle (tracking). Carryalls and ground targets are not tracked.
* **Timer and the "point-blank miss"** (Bullet.cpp:502-521). The Rocket has a 22-cycle timer (≈422 px ≈ 6.6 tiles of travel), the DRocket 19 cycles (≈365 px ≈ 5.7 tiles).
  Against a ground target the rocket explodes only when it is at the destination point **and** the timer is already 0.
  If the target is closer than ~6.6 tiles (~5.7 for the Deviator), the rocket overshoots the point, starts circling and explodes at the first moment after the timer reaches zero when it is moving away from the point. It can detonate quite far from the target. This is intentional: "the Launcher is bad at point-blank shooting".
* **Against an air target** the timer is immediately 50 cycles (Bullet.cpp:59-68), and the explosion happens as soon as it closes in, without checking the timer.
* Damage to air is dealt only if the shot was an "air" shot (`bAirBullet = target is flying`, UnitBase.cpp:217). Such an explosion affects **only** air units; ground units are unharmed, and vice versa.

### 2.4 TurretRocket (the Rocket Turret's rocket — for reference)

Fully homes in on the current centre of any target (Bullet.cpp:398-440). The turning rate is the same — 4.5/256 per cycle.
The timer is 60 cycles against a ground target and 120 against an air target (Bullet.cpp:52-58). When it expires, the rocket explodes wherever it is (Bullet.cpp:463-466).
On closing in, it explodes immediately, with the explosion point moved to `destination`.
If the target is closer than 3 tiles, the turret fires not a rocket but a ShellTurret shell with the Gun Turret's damage, and it does not fire at air targets at close range (src/structures/RocketTurret.cpp:76-110).

### 2.5 Sonic Tank sound wave

* The destination point is always extended to exactly `weaponrange*64` px (8 tiles = 512 px) in the direction of the target (Bullet.cpp:72-85). The wave passes through the target and hits the whole line.
* The speed is `speed=6`, but each cycle makes **2 steps of 6 px**, and `Map::damage` is called after every step (Bullet.cpp:468-492). The lifetime is 45 cycles, but the wave dies out earlier, on reaching the 512 px point (~43 cycles ≈ 0.69 s).
* Damage of one "sample" (Bullet.cpp:475-486), with `W` = weapondamage (60):
  * `start = (W/4 + 1)/4.5`, `end = ((W−9)/4 + 1)/4.5`;
  * damage falls linearly with the distance travelled: `cur = start − dist·(start−end)/(45·2·6)`;
  * `cur/2` is passed to `Map::damage`, and the unit receives `round(cur/2)`. At W=60 this is ≈1.78..1.53, i.e. **exactly 2 HP per sample**.
* Radius 48 px, **no distance falloff** (Map.cpp:242-243). A unit on the wave's axis is hit by about 16 samples, i.e. takes ~32 damage per pass. Offset 24 px from the axis — ~28, at 40 px — ~18.
* A structure takes `round(cur/2)` for each sample whose point lies inside its rectangle. The wave crosses a two-tile building in ~21 samples, which is ~42 damage.
* **Hits friendly units**: there is no owner check in `Map::damage`. The exception is the Sonic Tank: it takes no damage from **any** Sonic Tank (SonicTank.cpp:105-110) and does not pick them as targets (SonicTank.cpp:112-114).
* It does not explode on structures, does not trigger a spice bloom (Map.cpp:295), and leaves no craters.
* If a Sonic Tank "attacks a point" on a spice bloom, it does not stop attacking after the shot, unlike the others (UnitBase.cpp:255).

### 2.6 Death Hand (LargeRocket, Harkonnen/Sardaukar Palace)

* The scatter is determined at launch (src/structures/Palace.cpp:140-159). `s = rand(0..255)` is kept halving while `s > 160`, then `radius = 2·s` px (0..320 px, up to 5 tiles) in a random direction.
* It flies straight (no homing), 32 px/cycle, no timer.
* On detonation — 21 points: a 5×5 grid with a 1-tile step minus the 4 corners (Bullet.cpp:561-578). At each point `Map::damage(100, radius 64)` is executed.
  A unit close to several points takes damage **from each of them**. A structure takes the full 100 for **every** point that falls inside its rectangle: a 3×3 structure in the centre will take 900.
* Each point is also a rocket explosion for the terrain: craters, destruction of concrete.

### 2.7 Other firing details (UnitBase::attack, UnitBase.cpp:205-298)

* **Two barrels.** If `numWeapons == 2`, after the primary shot `secondaryWeaponTimer = 15`. After 15 cycles, if the unit is still facing the target and is **not** badly damaged (HP ≥ 50%), the second shot follows. A badly damaged unit's second barrel stays silent.
* **Trooper**: if a ground target is closer than 2 tiles (≤128 px between centres), it fires ShellSmall with damage `W − W/4` (5 → 4) instead of a rocket (UnitBase.cpp:226-234).
* **Every shot reveals** an area of radius 2 around the shooter to the target's owner (`viewMap(..., 2)`, UnitBase.cpp:248, 277).
* **Attacking a spice bloom by point.** After the first shot at `attackPos`, if there is a bloom there, the unit stops attacking (except the Sonic Tank). The bloom triggers on a hit.
* **Deviated unit**: each of its shots reduces `deviationTimer` by 1250 cycles (20 s) (UnitBase.cpp:262-264, 289-291).
* A shot is possible only when the "attack angle" matches one of the 8 directions towards the target. The attack angle is the hull, and for TankBase, the turret. The direction is computed by `destinationDrawnAngle(shooter's tile, target's tile)`, i.e. from **tile** coordinates.

---

## 3. Damage formula, modifiers, splash, friendly fire

### 3.1 `Map::damage(damagerID, owner, realPos, bulletID, damage, radius, air)` — src/Map.cpp:118-302

```
tileC = realPos / 64
candidates = all objects from tiles tileC ± 2 (5×5):
    airSet    = air units
    groundSet = infantry + underground (worms) + vehicles + structures (no duplicates)

if bulletID == Sandworm:                                   // Map.cpp:138-149
    for each g in groundSet: if g is not a worm, g is a ground unit/infantry
                                 and g.location == tileC:
        g.setVisible(ALL,false)  // ⇒ no wreckage and no "dropped" soldier
        g.handleDamage(round(damage))
else if air:                                              // Map.cpp:151-202
    only for DRocket/Rocket/TurretRocket/SmallRocket:
      for each a in airSet: d = round(|a.center - realPos|); if d > radius → skip
        DRocket: if a is not Carryall/Frigate/Worm and rand < weakness(a.originalHouse) → a.deviate(owner)
        else: Ornithopter → damage = round(damage)          // no falloff!
               others (Carryall, Frigate) → round(damage) >> (d/16 + 1)
else (ground explosion):                                      // Map.cpp:203-266
    for each o in groundSet:
      structure: if realPos is inside the structure's rectangle → o.handleDamage(round(damage))  // FULL damage
                 (Rocket/TurretRocket/SmallRocket/LargeRocket at HP<50% also add smoke, ≤5 pieces, visual)
      unit: d = round(|o.center - realPos|) (Euclidean, px); if d <= radius:
            DRocket → chance of deviation (as above), no damage
            Sonic   → o.handleDamage(round(damage))        // no falloff
            else    → o.handleDamage(round(damage) >> (d/16 + 1))
    terraforming (see 3.4)
if bulletID is not Sonic and not Sandworm and tileC is a spice bloom → the bloom triggers (on behalf of owner)  // Map.cpp:295-301
```

### 3.2 Damage falloff against units (except Sonic and Ornithopter-versus-air)

`damage = round(W) >> (floor(d/16) + 1)`, where `d` is the whole-pixel distance from the unit's centre to the explosion point.

| d (px) | 0–15 | 16–31 | 32–47 | 48–63 | 64 |
|---|---|---|---|---|---|
| multiplier | ½ | ¼ | ⅛ | 1/16 | 1/32 |

Consequences:

* **Even a direct hit deals only half the WeaponDamage to a unit**, but full damage to a structure. A Tank (25) hits a vehicle for 12 but a building for 25. A Soldier (3) hits a unit for 1.
* For projectiles with a radius of 32, a unit at a distance of 32 px takes ⅛. Infantry on neighbouring sub-positions (±16, ±16 → ~22.6 px) takes ¼ — "squad splash".
* A target that has moved during the flight takes less: the projectile flies to the old point, with no lead.
* **There are no armour types and no "infantry/vehicle/building" modifiers.** There is only one difference: structures take full damage without falloff (if the point is inside them), units take it with falloff. All `handleDamage` implementations are listed in ObjectBase.cpp:238, UnitBase.cpp:1019, Harvester.cpp:436, SandWorm.cpp:323, SonicTank.cpp:105, TurretBase.cpp:206; none of them has damage modifiers.

### 3.3 Friendly fire

* `Map::damage` **does not check the owner**. All splash (shells, rockets, Sonic, Death Hand, the Devastator explosion) hits your own and allied units just like enemies.
* A Deviator can "re-recruit" a unit of another house on the same team. For its own house, `deviate()` simply does nothing (UnitBase.cpp:406-408).
* Units deliberately fire at friendly targets only on an "attack" order (forced). When the player attacks one of their own objects, it creates `targetFriendly && forced` — fire is opened (UnitBase.cpp:559-562).
* Shells explode on your own buildings in the line of fire (except ShellTurret).

### 3.4 Terrain on explosion (Map.cpp:267-291)

Applies only to Rocket, TurretRocket, SmallRocket, LargeRocket, only in the tile of the explosion point and only if there is **no structure** there:

* **Concrete (Slab) → becomes Rock**: the concrete is destroyed, the tile's owner is reset, and a 1×1 debris piece is drawn. This is a real mechanic: rockets "eat" concrete.
* Full rock (`TerrainTile_RockFull`) and concrete get a RockDamage1 crater decal from SmallRocket or RockDamage2 from the others.
* Sand and spice get a SandDamage1–2 decal from SmallRocket or 3–4 from the others.
* At most 5 decals per tile (`DAMAGE_PER_TILE`, include/Tile.h:32). Decals are purely visual. `setType` clears them in a 4×4 square down and to the right of the tile (Tile.cpp:650, the upper bound is exclusive — include/Map.h:149).
* Shells (Shell*), Sonic, DRocket and the Devastator explosion do not change the terrain.

### 3.5 Applying damage (ObjectBase::handleDamage, ObjectBase.cpp:238-285; UnitBase::handleDamage, UnitBase.cpp:1019-1055)

* `health -= damage`. At ≤ 0 the health becomes 0, and the killer is credited with a kill. The actual destruction happens in the object's `update()`.
* `setHealth` recomputes `badlyDamaged = health < 0.5·max` (ObjectBase.cpp:308-313).
* Before that, if the unit is deviated: `deviationTimer −= damage·1250` cycles, i.e. 20 s for **every** HP of damage. Just 6 damage fully removes the 120-second deviation (UnitBase.cpp:1021-1023).
* Reactions to damage are in §5.6.
* The `immortalHumanPlayer` option (single-player) zeroes damage to the local player's units. It can be skipped in the remake.

---

## 4. Units: unique behaviour

Class hierarchy:

```
UnitBase
├── GroundUnit
│   ├── Trike, RaiderTrike, Quad, MCV, Sandworm      (wheeled / own terrain table)
│   ├── InfantryBase → Soldier, Trooper, Saboteur
│   └── TrackedUnit
│       ├── Harvester, Launcher, Deviator, SonicTank, Devastator
│       └── TankBase → Tank, SiegeTank                (rotating turret)
└── AirUnit → Carryall, Ornithopter, Frigate
```

What can be attacked is determined by `canAttack`. By default this is `ObjectBase::canAttack`, ObjectBase.cpp:367-372: "not the unit's own team and visible, or it is a worm (a worm — always)", and the object must **not be flying** (structures are fine).

### 4.1 UnitBase — common behaviour

* Created with a random direction 0..7 (UnitBase.cpp:51) and in GUARD mode (ObjectBase.cpp:102).
* **Death** (UnitBase.cpp:376-402). If the unit is visible (`isVisible()` — to anyone at all), then with a probability of `InfSpawnProp`% a Soldier of the owning house appears on its tile with **half HP**. If the unit was deviated, the soldier inherits the new owner and the remaining deviation timer.
  InfSpawnProp in the INI: vehicles 25, Harvester 50, infantry and air 0.
  Units eaten by a worm or killed on a spice bloom become invisible **before** dying, so no soldier appears.
* **Smoke** is drawn at HP < 50% (visual, `drawSmoke`, UnitBase.cpp:1931).
* **Badly damaged vehicles (HP < 50%)**: speed ×0.75 in `setSpeeds` (UnitBase.cpp:1277-1279) **and an additional** ×0.5 in `move` (UnitBase.cpp:612-618). In total **×0.375**. The second barrel does not fire.
* **Automatic repair** (GroundUnit::checkPos, GroundUnit.cpp:110-121). Triggers if all of the following hold:
  * HP < max/2;
  * the house has a Repair Facility **and** at least one Carryall;
  * the unit is not infantry, not deviated, not `forced`, not picked up.
  Then `doRepair()` is called: the nearest Repair Facility with **0 bookings** is chosen (GroundUnit.cpp:264-290), a Carryall is requested, and the unit drives to the repair facility (`doMove2Object`). If there is no free repair facility, nothing happens.
* Repair at the Repair Facility: +1 HP per structure cycle, 0.1 credits per HP (src/structures/RepairYard.cpp:131-136). After repair the unit drives out nearby in GUARD mode (Harvester — in HARVEST) or is carried away by a Carryall (only with the manualCarryallDrops option and a distance of ≥ 6 to guardPoint).

### 4.2 Soldier (src/units/Soldier.cpp)

ShellSmall, 1 barrel. Targets: structures and ground (non-flying) enemies, as well as the worm (Soldier.cpp:52-65).
Can walk on mountains (general infantry rules — §6.4). Can capture buildings (§4.17).

### 4.3 Trooper (src/units/Trooper.cpp)

SmallRocket. **Can attack air targets** (Trooper.cpp:52-62). The rocket flies to the point where the target was at the moment of firing, with no tracking — against fast Ornithopters it almost always misses.
At close range (≤ 2 tiles) it switches to ShellSmall with −25% damage. Can capture buildings.

### 4.4 Saboteur (src/units/Saboteur.cpp)

* No weapons (`numWeapons=0`), range 0, HP 10, speed 5.12.
* **Invisibility** (Saboteur.cpp:64-89). Visibility is recomputed every cycle: team *T* sees the Saboteur only if there is an object of team *T* within the 5×5 square around it (±2 tiles). Its own team always sees it. An invisible target cannot be chosen (`canAttack` requires `isVisible(team)`).
* **Targets**: enemy structures and enemy **non**-infantry ground vehicles, except the worm (Saboteur.cpp:135-149). The target is always taken with `forced=true`, so that a path to an occupied tile can be laid (UnitBase.cpp:1355, 1382, 1484).
* **Detonation** (Saboteur.cpp:91-125). If the Saboteur is not moving and `blockDistance(tile, the target's nearest tile) ≤ 1.5` (i.e. it stands **right next to it**, diagonals included), it destroys itself and **instantly destroys the target entirely** (`setHealth(0)` + `destroy()`). The target's HP does not matter, there is no splash, and the explosion is visual.
* When dropped from a Carryall or created by an AI Palace, it receives HUNT mode (Carryall.cpp:283-284, Palace.cpp:263-280).

### 4.5 Trike, Raider Trike, Quad (src/units/Trike.cpp, RaiderTrike.cpp, Quad.cpp)

Wheeled (GroundUnit), 2 barrels of ShellSmall. They differ only in the numbers from the INI. There is nothing unique in the logic, apart from a visual "shaking" on rock (`hasBumpyMovementOnRock`, UnitBase.cpp:690-730).

### 4.6 TankBase — turret (src/units/TankBase.cpp)

* The turret rotates at 0.0625/cycle, **including while moving**. The hull rotates only while standing still (TankBase.cpp:173-210).
* While moving, the turret looks in the direction of the route's end point (TankBase.cpp:75-85).
* **A second, "close" target** `closeTarget` (TankBase.cpp:108-171). When the tank is standing and `findTargetTimer == 0`, it looks for a target within the mode's radius (`findTarget`). If the main target is out of weapon reach (or there is none), and `closeTarget` is within reach, the turret rotates towards it and fires. The main target does not change in the process.
* Idling (TankBase.cpp:87-106): in GUARD mode, about once every 5 s, the hull turns with a 10% chance and the turret with a 10% chance.
* Tank: ShellMedium, 1 barrel. Siege Tank: ShellLarge, 2 barrels, screen shake 18 on death.

### 4.7 Launcher (src/units/Launcher.cpp)

Tracked, no rotating turret: it fires with the hull. 2 barrels of Rocket (§2.3).
**Attacks everything**: ground targets, air, structures (Launcher.cpp:104-108). In AREAGUARD mode the search radius is 12 instead of 10 (UnitBase.cpp:1069, 1115; ObjectBase.cpp:705).
Rockets hit poorly against targets closer than ~6.6 tiles.

### 4.8 Deviator (src/units/Deviator.cpp)

* DRocket, damage 0, range 7, reload 540.
* Targets: only enemy **ground units**. Structures and air are excluded (Deviator.cpp:109-117).
* On explosion (radius 32 px), every **unit** within the radius (including infantry and allies; not Carryall, not Frigate, not worm) switches to the Deviator's owner with probability `weakness(unit's original house)` (Map.cpp:235-241).
* **Weakness** (src/sand.cpp:592-610):
  * in Custom Game and Custom Multiplayer — **1.0 for everyone**;
  * in campaign/skirmish: Harkonnen 0.78, Atreides 0.30, Ordos 0.50, Fremen 0.08, Sardaukar 0.04, Mercenaries 0.50.
* **Deviation** (`UnitBase::deviate`, UnitBase.cpp:404-432):
  * the unit is deselected, its target is cleared, guardPoint and destination = the current tile, GUARD mode;
  * `owner = new owner`, recolouring;
  * `deviationTimer = 7500` cycles (120 s).
  The timer is reduced by 1250 cycles for each of the unit's own shots and by 1250×damage for each hit received. When it expires, the unit returns to its original owner with the same resets (UnitBase.cpp:1645-1656).
  Stats (HP, damage, speed) are always taken from `originalHouseID`. A deviated unit does **not** go off for repair.

### 4.9 Sonic Tank (src/units/SonicTank.cpp)

Sonic (§2.5), 1 barrel, range 8. Immune to the sound waves of any Sonic Tank and does not pick them as targets.
All other friendly units and buildings in the line of fire take damage.

### 4.10 Devastator (src/units/Devastator.cpp)

* 2 barrels of ShellLarge (40), speed 1.28.
* **Self-destruction** (Devastator.cpp:115-154). The `doStartDevastate` command sets `devastateTimer = 200` cycles (3.2 s) if the timer is not already running. When it expires, `destroy()` is called.
* **Explosion on any death** (Devastator.cpp:121-142), if the unit is visible. At 9 points — the centre and the 8 neighbouring tile centres — `Map::damage(damage 150, radius 16 px)` is executed.
  Units closer than 16 px to a tile centre (all vehicles standing exactly at the centre, and infantry at the centre sub-position) take 150>>1 = **75**. Infantry at the corner sub-positions (~22.6 px) takes none.
  **Structures take 150 for each of the 9 points that falls inside their rectangle.** This includes allied/own vehicles and buildings.
  May trigger a spice bloom.

### 4.11 Harvester (src/units/Harvester.cpp)

* Tracked, but **its speed does not depend on terrain** (Harvester.cpp:598-619):
  `v = MaxSpeed × (HP<50% ? 0.75 : 1) × (1 − 0.4·spice/700)`.
  A full Harvester moves 40% slower. At HP < 50%, the ×0.5 from `move` is added on top.
* `canAttackStuff=false`, but its "target" can only be enemy **infantry** — so that it can crush it (Harvester.cpp:577-583).
  When damaged by infantry, the Harvester assigns it as its target (Harvester.cpp:436-445). In practice it lets go almost immediately: in GUARD/HARVEST the attack range is 0, but a player order (forced) will make it drive over to crush.
* **Capacity** 700. **Harvesting**: standing on a destination tile with spice, it takes 0.1344 spice per cycle (8.4/s). An average tile (~111) is emptied in ~13 s, and a full hold takes ~83 s of pure harvesting (Harvester.cpp:517-568, Tile.cpp:678-698).
  * Thick spice becomes normal when it has < 148 spice; normal spice becomes sand at 0.
  * When the type changes, the thick tiles adjacent in a cross pattern turn into normal spice (`Map::spiceRemoved`, Map.cpp:681-703).
  * When a tile is exhausted, the next spice is searched for from the current tile (`Map::findSpice`).
  * Hold full or no more spice → `doReturn()`.
* **Spice search** (`Map::findSpice`, Map.cpp:636-675). Its own tile is checked first. Then random tiles on a "ring" of depth `depth` around **guardPoint**: 100 attempts per ring, then the ring expands. A tile with spice and no ground objects is suitable.
  This is **not a deterministic nearest-tile** search. If you implement a proper BFS, the behaviour will be slightly "smarter" than the original.
* **Idling** (Harvester.cpp:309-333). If the Harvester is not harvesting and not in STOP, every 100 cycles it looks for spice from guardPoint. If found, it drives there (`harvestingMode=true`), guardPoint = the found tile.
* **Player target selection** (`setGuardPoint`, UnitBase.cpp:1195-1212). Clicking a tile **without** spice puts the Harvester into STOP: it stands still and does not harvest on its own. Clicking spice → GUARD and harvesting. The AI immediately returns from STOP to HARVEST (Harvester.cpp:179-185).
* **Return** (Harvester.cpp:187-285):
  * it picks its own Spice Refinery with the **fewest bookings**, the nearest one if tied. Then `doMove2Object` and booking (`Harvester::setTarget`, lines 477-496);
  * a Harvester may enter the tile of its own Spice Refinery if it is going to unload and the refinery is free (TrackedUnit::canPass, TrackedUnit.cpp:88-94). Having stopped on any tile of the Spice Refinery, if it is free, it disappears into it (`setReturned`, lines 498-515). If it is occupied, it moves to a free tile nearby and requests a Carryall;
  * if the free Spice Refinery is ≥ 6 tiles away and the house has a Carryall, it requests a Carryall;
  * if the path is blocked for 3 checks in a row, it requests a Carryall or looks for another free Spice Refinery.
* **Transport to the field**: in harvesting mode, if the destination point is ≥ 6 tiles away, the Harvester requests a Carryall (Harvester.cpp:286-287).
* **Unloading** (src/structures/Refinery.cpp:162-205):
  * 0.625 spice per cycle × `max(1, floor(5·HP_ref/max))/5` (a damaged Spice Refinery unloads more slowly; minimum 1/5). 1 spice = 1 credit. A full hold at 100% HP takes ~17.9 s;
  * after unloading: if the Harvester has a guardPoint (the last field) and a free Carryall is available, it is carried back to guardPoint. Otherwise it drives out next to the Spice Refinery (`findDeploySpot` towards the Spice Refinery's gather point).
* **Death** (Harvester.cpp:355-409). 75% of the cargo is scattered **evenly** over sand and spice tiles in a circle of radius `round(spice/210)` tiles. The explosion is visual, shake 18. InfSpawnProp 50%.
* **A new Spice Refinery** → a free Harvester with 5 spice arrives on a "courier" Carryall from the nearest map edge, if the Harvester limit has not been exceeded (`House::freeHarvester`, src/House.cpp:625-656).
* AI of class AIPlayer (src/players/AIPlayer.cpp:715-748): if a worm is closer than 5 tiles to a Harvester on sand, the Harvester returns. If there are fewer than 3 Harvesters, the AI sends them home already at ≥ 350 spice.

### 4.12 MCV (src/units/MCV.cpp)

* **Wheeled** (GroundUnit): it cannot crush; its "target" is only infantry, but since it cannot crush, this is of no use.
* **Deploying** (MCV.cpp:65-131). A 2×2 Construction Yard is placed with its top-left corner on the MCV's tile. All 4 tiles must be "rock": Rock, Slab or Mountain. The three tiles other than its own must be unblocked, i.e. have no ground objects and no mountains.
  Concrete and proximity to a base are **not required**. The MCV is then removed "silently": it becomes invisible, so no soldier drops out and there is no explosion.

### 4.13 Sandworm — see §7.

### 4.14 AirUnit — common behaviour (src/units/AirUnit.cpp)

* Always in motion. `navigate()` simply sets `moving=true` and **does not use A\*** (AirUnit.cpp:144-147).
* `move()` (AirUnit.cpp:149-165): a step of `currentMaxSpeed` along the continuous angle `angle` (0..8). The tile is updated by the centre.
* `turn()` (AirUnit.cpp:171-206): smooth turning towards the destination tile's centre by no more than `turnspeed` per cycle. If there is no destination — slow circling (`angle −= turnspeed/8` per cycle).
* Air units **do not reveal the map** (AirUnit.cpp:76-86) and do not trigger a spice bloom.
* Ordinary ground units cannot attack them. Those that can: Trooper, Launcher, Rocket Turret, and also the Ornithopter, but only against ground targets.
* They take damage only from "air" rockets (§3.1).

### 4.15 Ornithopter (src/units/Ornithopter.cpp)

* A **constant** speed of 14.4 px/cycle (`currentMaxSpeed` is fixed in init, Ornithopter.cpp:134-150). Turning radius ≈ 4 tiles.
* SmallRocket (45), range 5, reload 150. Attacks everything non-flying, including the worm (Ornithopter.cpp:184-191).
* **Attack runs** (Ornithopter.cpp:213-229). It fires only when its 8-direction `drawnAngle` matches the direction to the target. For 62 cycles (1 s) after firing it flies **away from** the target, then turns back onto it. This produces "strafing runs".
* Without a target (Ornithopter.cpp:166-182): if the destination is closer than 2 tiles, it clears it and circles. If it has moved further than 17 tiles from guardPoint, it returns.
* It takes **full** damage from "air" rockets without falloff (Map.cpp:177-178): a Rocket Turret (30) or Launcher (75) shoots it down (25 HP) with a single hit.
* In HUNT mode for a **human** player, the target is chosen using the QuantBot priority table: weight / (distance+1) (Ornithopter.cpp:231-313). This is a quirk of the fork; for the remake the standard selection is enough.
* On death it leaves wreckage.

### 4.16 Carryall and Frigate — see §8.

### 4.17 InfantryBase — infantry, capturing buildings (src/units/InfantryBase.cpp)

* Up to 5 infantrymen **of the same team** per tile, on sub-positions: 0 = centre, 1..4 = (±16, ±16) px (InfantryBase.cpp:35).
  The sub-position is the first free one (Tile.cpp:245-275). Enemies do not stand on the same tile.
* Infantry walks on mountains (§6.4).
* **Capture** — only Soldier and Trooper on a player command (InfantryBase.cpp:73-85); the AI can do it too.
  The structure must be an enemy one and `canBeCaptured()`. These **cannot** be captured: Barracks, IX Research Centre, Palace, Radar Outpost, Wall, WOR (`canBeCaptured() = false` in include/structures/*.h). All others can, including Construction Yard, Spice Refinery, Spice Silo, Starport, turrets, factories, Repair Facility.
  `doCaptureStructure` = an attack with `forced=true` + CAPTURE mode (lines 92-101). The infantryman goes **inside** the target tile (InfantryBase::canPass, lines 150-158).
* When the infantryman has stopped on the structure's tile (`blockDistance ≤ 0.5`, lines 187-357):
  * if the structure's health colour is **red** (§1.5: intended HP < 25%, in practice < 50%) — **capture**:
    * all other infantrymen on the tiles of this structure are destroyed;
    * the structure is recreated under the new owner with the same HP; `originalHouseID` is preserved (tech by the original house);
    * a Harvester inside the Spice Refinery and a unit on the Repair Facility also pass to the new owner;
    * for Spice Silo and Spice Refinery the new owner steals credits: `capacity(Silo, 1000) × stored/capacity` of the former owner. For the Spice Refinery the Silo's capacity is used too — that is how it is in the code;
  * otherwise — damage to the structure of `min(structure HP/2, infantryman HP·2)` (Soldier 20 HP → up to 40, Trooper 45 HP → up to 90).
  * In **both** cases the infantryman is consumed (dies without a corpse).
* **Crushing** (`InfantryBase::squash` → `destroy`): if there is an enemy vehicle on the tile at the moment of death, a crushed corpse is drawn and a "squash" sound is played.

---

## 5. Unit "AI": modes, auto-targeting, priorities

### 5.1 Modes (`ATTACKMODE`, include/DataTypes.h:293-306; names in maps — src/sand.cpp:410-421)

| Mode | Target search `findTarget` (ObjectBase.cpp:694-737) | Accept a target if (`isInGuardRange`, UnitBase.cpp:1057-1101) | Continue attacking if (`isInAttackRange`, UnitBase.cpp:1103-1147) |
|---|---|---|---|
| GUARD | radius = WeaponRange from the current tile | target centre ≤ WeaponRange·64 from the **centre of guardPoint** | same |
| AREAGUARD | radius 10 tiles (Launcher 12) | ≤ 10 (12) tiles from the **current position** | same — may wander far from home |
| AMBUSH | radius = ViewRange | ≤ ViewRange from guardPoint; if the target is ≤ ViewRange from the current tile → **switch to HUNT** (UnitBase.cpp:1371-1378) | ≤ ViewRange+1 from guardPoint |
| HUNT | the whole map: nearest target | always | always |
| STOP | none | — | — |
| HARVEST, SABOTAGE, CAPTURE, RETREAT, CARRYALLREQUESTED | none (`findTarget` → nullptr) | no | no |

All distances are `blockDistance`, in tiles. In the guard checks pixels are compared: block distance between centres ≤ range×64.

### 5.2 Targeting loop (`UnitBase::targeting`, UnitBase.cpp:1343-1404)

```
if findTargetTimer == 0 and mode is not STOP/CARRYALLREQUESTED:
   // "refresh": is the current target out of weapon range?
   if there is a target, no attackPos, not forced, mode ∈ {GUARD,AREAGUARD,AMBUSH,HUNT}
        and the target is outside WeaponRange:
        t = findTarget(); if t: doAttackObject(t, forced = (Saboteur)); findTargetTimer = 500  // 8 s
   // "acquire" a new target — only while standing still:
   if no target, no attackPos, !moving, !justStoppedMoving, !forced:
        t = findTarget()
        if t: inRange = isInGuardRange(t); AMBUSH and t within ViewRange → mode HUNT, inRange = true
                if inRange: doAttackObject(t, Saboteur?); worm → HUNT
        else if HUNT: guardPoint = here; mode GUARD      // HUNT with no targets "calms down"
        findTargetTimer = 62   // 1 s
engageTarget()
```

* Target search happens about once every ~1 s (62 cycles), but when damage is taken the timer is reset to 0.
* A **standing** unit looks for a target. A unit moving on a **non-forced** order (HUNT, an AREAGUARD return, etc.) searches at the centre of every tile: there is always ≥ 1 cycle there with `!moving && !justStoppedMoving`.
* A unit walking on a player order (`forced=true`) **does not react to enemies** until it reaches the point (then `forced=false`, UnitBase.cpp:658-663).

### 5.3 How a target is chosen (`findTargetViaGrid` / `findTargetLegacy`, ObjectBase.cpp:405-637)

* The candidate must pass the unit's `canAttack`. In addition, the target's tile must be **explored** by the team and **not in fog** (`isTileVisibleToSeeker`). Fog works only with the `fogOfWar` option.
* The **nearest** candidate is chosen by `blockDistance` from the unit's tile to the target's nearest tile (for a structure — its nearest tile).
* **Walls and Carryalls** have a lowered priority: they are taken only if there are no other candidates (`isDeprioritizedTarget`, lines 407-409). When choosing a target structure for the AI (`findClosestTargetStructure`), +20 000 000 is added to a wall's distance.
* HUNT: a search across the whole map. If nothing is found among the visible tiles, the fallback is: the nearest object by Chebyshev rings **without** the exploration check (`findClosestTargetLegacy`, lines 422-458). Otherwise the unit switches to GUARD.
* "Can attack" by unit type:

| Unit | Can attack |
|---|---|
| Most (Tank, Siege, Devastator, Trike, Quad, Raider) | structures + ground enemies + worm |
| Soldier | same |
| Trooper, Launcher | **everything**, including air |
| Ornithopter | everything non-flying |
| Deviator | only enemy ground units |
| Sonic Tank | like most, except Sonic Tanks |
| Saboteur | enemy structures and enemy non-infantry vehicles |
| Harvester, MCV | enemy infantry only (to crush) |
| Sandworm | any ground units on the sand of its own region, **without a team check** (§7) |
| Carryall, Frigate | nothing |

### 5.4 Conducting combat (`UnitBase::engageTarget`, UnitBase.cpp:481-607)

The target is released (`releaseTarget`: forced → guardPoint = current tile; destination = guardPoint; forced=false) if:
* the object has disappeared or is inactive;
* it can no longer be fired upon (became invisible, was deviated, etc.);
* it is not forced and has left `isInAttackRange`.

Then:
* if the distance to the target (tiles, block distance to the nearest tile) > WeaponRange: for an air target — drop it (ground units do not chase aircraft); otherwise — **drive towards it** (`destination` = the target's tile);
* within weapon range:
  * no fire is opened on a friendly target without forced;
  * if driving off for repair, destination is left alone;
  * CAPTURE → drive straight into the building;
  * **tracked + target is infantry + forced + target not on a mountain** → drive onto the infantry's tile (to crush), without firing the hull weapon;
  * otherwise stop (`destination = here`) and turn (`targetAngle`);
  * when the attack angle matches — `attack()`.
* Re-pathing against a moving target: if the target has shifted by more than 1 tile and is closer than 10 tiles, the path is recomputed. If it is farther, the old path is kept with an updated end point (UnitBase.cpp:512-532).

### 5.5 Attacking a point (`doAttackPos`, UnitBase.cpp:946-963)

The unit drives until the point is within weapon range, then stands and fires at the tile's centre. The attack continues indefinitely — except for a spice bloom, where it stops after the first shot.

### 5.6 Reaction to damage (`UnitBase::handleDamage`, UnitBase.cpp:1019-1055)

* **HUNT** and not forced: if the attacker can be fired upon and (there is no target or the current target is out of reach) → immediately attack the offender.
* **AMBUSH** (except Harvester): on any damage > 0 → HUNT mode.
* GUARD/AREAGUARD/HUNT: `findTargetTimer = 0`, i.e. look for a target immediately, but **within the mode's radius**. A GUARD unit that is being shelled from beyond its WeaponRange (for example, by a Launcher) will not respond.
* A worm, when damaged, switches to HUNT and attacks the offender with `forced=true` if the latter is not standing on rock (§7).

### 5.7 Player commands (src/Command.cpp:129-248; UnitBase.cpp:824-1017)

| Command | What it does |
|---|---|
| Move (right-click on ground) | `doMove2Pos(x,y, forced=true)`: target=null, destination=guardPoint=the tile. HUNT/CAPTURE → GUARD |
| Right-click on an object | enemy → `doAttackObject(forced=true)`; friendly → `doMove2Object` (follow the object; to your own Repair Facility — repair, to your own Spice Refinery for a Harvester — unloading) |
| Attack | on an object — attack, even your own; on empty ground — `doAttackPos` |
| Set Mode | for GUARD and STOP: the unit stops (on the current tile or the nearest tile of its path). For HUNT: an immediate target request |
| Send to Repair | `doRepair()` |
| Request Carryall Drop | `doMove2Pos(forced)` + `requestCarryall()` |
| Capture (infantry) | §4.17 |
| Deploy (MCV), Devastate, Return (Harvester) | §4.12, §4.10, §4.11 |

### 5.8 Other micro-behaviour

* **Idling** (UnitBase.cpp:813-822): a ground unit in GUARD (except Harvester), with no target and no path, about once every 5 s with a 20% chance turns in a random direction.
* **Contact with the enemy** (UnitBase.cpp:1722-1773): the visibility of a ground unit to an enemy team "activates" the AI of both sides. This is needed for the campaign logic "the AI sleeps until contact".
* Visibility/sight: upon entering a tile, the unit reveals a circle `blockDistanceApprox ≤ ViewRange` (Map.cpp:705-742). A standing unit repeats this once every 512 cycles (GroundUnit.cpp:243-249).

---

## 6. Movement and passability

### 6.1 Terrain types (include/data.h:105-115, include/Tile.h:419-433)

| Type | Wheeled / MCV | Tracked / Harvester | Infantry | Worm | Air | Buildable |
|---|---|---|---|---|---|---|
| Sand | yes | yes | yes | **yes** | yes | no |
| Dunes | yes | yes | yes | yes | yes | no |
| Spice / ThickSpice | yes | yes | yes | yes | yes | no |
| SpiceBloom / SpecialBloom | yes, but dangerous (§6.6) | yes, dangerous | yes, dangerous | yes | yes | no |
| Rock | yes | yes | yes | **no** | yes | yes |
| Slab (concrete) | yes | yes | yes | **no** | yes | yes |
| Mountain | **no** | **no** | **yes** (≤ 5 per tile) | no | yes | no |

`isRock()` = Rock, Slab or Mountain (used for building, the MCV and the worm). Sand regions (8-connected areas of non-rock, `Map::createSandRegions`, Map.cpp:80-116) limit the worm's hunting.

### 6.2 Terrain speed modifier

`setSpeeds()` (UnitBase.cpp:1272-1292): `v = MaxSpeed × (2 − difficulty(tile type))`, then ×0.75 at HP < 50%.
Diagonally each component is ×0.7071, so the speed magnitude is the same, but a diagonal tile is √2 times longer.
**The terrain is taken from the tile the unit is leaving:** `setSpeeds` is called at the start of the step, when `location` is still the old tile.

| Type | wheeled/infantry difficulty (GroundUnit.h:70-84) | multiplier | tracked difficulty (TrackedUnit.h:47-60) | multiplier | Worm (SandWorm.h:63-77) | multiplier |
|---|---|---|---|---|---|---|
| Slab | 1.0 | **1.0** | 1.0 | **1.0** | — | — |
| Sand | 1.375 | 0.625 | 1.5625 | **0.4375** | 1.25 | 0.75 |
| Rock | 1.5625 | **0.4375** | 1.375 | 0.625 | — | — |
| Dunes | 1.375 | 0.625 | 1.375 | 0.625 | 1.25 | 0.75 |
| Mountain | 1.0 | 1.0 (infantry only) | — | — | — | — |
| Spice / ThickSpice | 1.375 | 0.625 | 1.375 | 0.625 | 1.25 | 0.75 |
| SpiceBloom / SpecialBloom | 1.375 | 0.625 | 1.5625 | 0.4375 | 1.25 | 0.75 |

Exceptions:

* **Harvester**: terrain does not affect speed. Only load and damage do (§4.11).
* **Infantry** (InfantryBase::setSpeeds, InfantryBase.cpp:495-531). If the sub-position in the new tile **matches** the old one (a lone soldier, always position 0), the normal formula with terrain applies. If the sub-position changes, the speed = pure MaxSpeed along the vector "old sub-position → new one", **without** terrain and **without** the damage penalty.
  The ×0.5 step at HP < 50% does not apply to infantry either: `InfantryBase::move` does not divide the speed.
* **Air**: no terrain effects.
* Concrete is the fastest surface for everyone. Wheeled units are faster on sand than on rock; tracked units are the opposite.

Examples, tiles/s: Tank — concrete 3.91, rock/dunes/spice 2.44, sand 1.71. Trike — concrete 6.29, sand 3.93, rock 2.75.

### 6.3 Tile-by-tile movement (UnitBase::navigate/move, UnitBase.cpp:609-811)

```
navigate (once every 5 cycles, phase = objectID*1337; for air — always):
  if !moving and !justStoppedMoving:
    if the path cache is invalid → clearPath
    if location != destination:
      if nextSpot is not chosen:
        if the path is empty and recalculatePathTimer == 0 → queue an A* request
        if there is a path → nextSpot = pop(path)
      else:
        nextSpotAngle = direction to nextSpot
        if nextSpot is impassable:
            if there is a moving unit there → wait (do not reset the path)
            else → clearPath (re-plan)
        else if drawnAngle == nextSpotAngle:
            moving = true; occupy nextSpot (assignToMap); setSpeeds()
        // otherwise wait for the turn (turn() turns only a standing unit)
    else if no target → idleAction about once every ~5 s
move:
  pos += speed (×0.5 at HP<50%, except air)
  when |pos − centre of the old tile| ≥ 32 in x or y → release the old tile, location = nextSpot
  when ≥ 64 → moving=false, justStoppedMoving=true, pos = tile centre
  checkPos()   // crushing, bloom, repair, carryall requests…
```

* **Occupancy.** The target tile is booked at the start of the step. The old one is released halfway. During the first half of the step the unit occupies two tiles.
* **Turning.** The hull turns **only while standing**, towards `nextSpotAngle` (movement has priority) or `targetAngle` (UnitBase.cpp:1593-1623). Starting to move is allowed when `round(angle) == direction`.
* **Pause on a tile.** After arriving at the centre: 1 cycle of `justStoppedMoving` plus waiting for the navigation "window" (up to 5 cycles). Example: a Tank on concrete crosses a tile in 16 cycles, but really spends ~19–20 cycles per tile on average.
* **Path recalculation** (UnitBase.cpp:1496-1591). After each search `recalculatePathTimer = 500`. It is reset to 0 each time a step is taken, so in practice it only delays a repeated search when no path was found (~8 s).
* Getting stuck (3 attempts without progress or 3 failed searches):
  * if the house has a Carryall, (the manualCarryallDrops option **or** the owner is an AI) and the target is ≥ 6 tiles away → request a Carryall;
  * an AI Harvester drives home in this situation;
  * a returning Harvester simply waits;
  * other units give up (`destination = here`).

### 6.4 Tile passability for different classes (`canPass`)

* **Base/wheeled/MCV** (`UnitBase::canPass`, UnitBase.cpp:1775-1804): not a mountain and no ground object. The exception is your own free Repair Facility, if it is the target and the unit is heading for repair.
* **Tracked** (`TrackedUnit::canPass`, TrackedUnit.cpp:61-108):
  * not a mountain;
  * its own tile is always passable;
  * its own target structure: a Repair Facility (heading for repair, free) or a Spice Refinery (the Harvester is returning, free);
  * a tile with **only enemy infantry** (no vehicles) is **passable**, and that infantry will be crushed.
* **Infantry** (`InfantryBase::canPass`, InfantryBase.cpp:135-164):
  * an empty tile;
  * a mountain, if there are fewer than 5 infantrymen on it;
  * a tile with infantry **of its own team** and fewer than 5 infantrymen;
  * an enemy structure that is the target (capture).
* **Worm** (SandWorm.cpp:447-452): not rock/concrete/mountain and no other worm. Ground units do not hinder the worm: it is underground.
* **Air**: everything. For the Ornithopter, `canPass` forbids a tile with another air unit, but this does not affect movement: aviation does not use A*.

### 6.5 Infantry crushing (TrackedUnit.cpp:53-59, Tile.cpp:654-668)

When a **tracked** unit (all TrackedUnit, including the Harvester, but not the MCV and not wheeled units) arrives at the centre of a tile (`justStoppedMoving`), all infantry on that tile is destroyed. In practice this is enemy infantry: it drives around its own.
On an order to attack infantry (forced), a tracked unit drives over to crush it instead of firing (§5.4).
When choosing a drop-off spot, tracked units are not placed on a tile with infantry (Map.cpp:474-481).

### 6.6 Spice bloom and special bloom

* **Any ground unit other than the worm that stops at the centre of a bloom tile dies.** Stopping at the centre happens on **every** tile of a path. The bloom explodes in the process and creates a spice field (GroundUnit.cpp:86-101, InfantryBase.cpp:176-190, UnitBase.cpp:350-368 — when dropped off/stepping onto a bloom).
  A\* **does not avoid** bloom tiles. In the remake this is worth keeping: the player must detonate blooms with a shot. Alternatively, a penalty can be added to A\* for the AI.
* Trigger: a hit from any projectile except Sonic and the worm's on a bloom tile (Map.cpp:295-301), or driving onto it.
* Effect (Tile.cpp:829-854): the tile → Spice. Sand tiles (specifically Sand, not dunes) within a Euclidean radius of 5 tiles → Spice with a random amount of 74..148. Screen shake 18.
* **Special bloom** (Tile.cpp:856-954): the tile → sand, and the unit that drove onto it **does not die**. A random effect out of four:
  * 150–400 credits;
  * a free Trike;
  * a Trike to a random enemy house;
  * 3 Soldiers to a random enemy house.

### 6.7 Pathfinding — A* (src/AStarSearch.cpp:116-240)

* 8 neighbours. A node is passable if `unit.canPass(x,y)` — taking into account the **current** unit positions at the moment of the search.
* Step cost:
  * `difficulty(type of the tile being entered)`, ×√2 diagonally. For aviation — 1. In practice aviation does not use A\*;
  * plus a **turn penalty**: `angleDiff(new direction, direction of arrival at the current tile) × 1/(TurnSpeed·64)`. With TurnSpeed 0.0625 this is 0.25 for each 45°.
* Heuristic `h = blockDistance(tile, goal)` (octile). It is admissible because the minimum step cost is 1.0 (concrete).
* If the goal is an adjacent tile (`h ≤ 1.5`) and it is impassable, no search is performed: an empty path.
* A limit of 16384 closed nodes (`MAX_NODES_CHECKED`, line 35). There is an early exit: "the square around the goal has been fully traversed — so it is unreachable" (lines 183-230).
* **If the goal is unreachable**, the path to the tile with the **lowest heuristic** is returned: the unit drives "as close as possible".
* The path is stored as a list of tiles (without the starting one). The cache is valid until the target changes. After any change in map occupancy (`pathingRevision`), the first 6 tiles of the path are re-checked (UnitBase.cpp:1827-1908).
* The path goal is the nearest tile of the target object. For Carryall→Spice Refinery it is `loc+(2,0)`, for Frigate→Starport it is `loc+(1,1)` (UnitBase.cpp:1806-1820).

### 6.8 Unit placement on exit / drop-off (`Map::findDeploySpot`, Map.cpp:431-512)

Random tiles around the building's perimeter on an expanding "ring": 100 attempts per ring. A tile is suitable if `canPass`, and for tracked units also if it has no infantry.
If a "gather point" (the factory's rally point) is set, the one nearest to it is chosen among those found.
Air units appear at the building's `loc+(1,1)`.

---

## 7. Sandworm (src/units/SandWorm.cpp, include/units/SandWorm.h)

**Type.** GroundUnit, registered as an *underground* object of the tile (lines 107-113). Ground units do not block it, and it does not block them either.
`respondable=false`: the player does not control it. The owner is set by the map (usually a separate house).

**Stats (INI):** HP 1000, ViewRange 2, WeaponDamage 300 (not used — the worm deals 5000), WeaponRange 0, reload 60, MaxSpeed 4.48, TurnSpeed 0.625.

**Movement.** Only on non-rock (sand, dunes, spice, bloom), and not into another worm's tile. Speed on sand ×0.75: 3.36 px/cycle ≈ 3.3 tiles/s. The worm does not trigger blooms and leaves no tracks (its own `checkPos`, lines 207-219).
The visible part is a "ripple" (4 segments along the last tiles) only while moving. The worm itself is drawn only during an attack.

**Target selection** (`Sandworm::findTarget`, lines 454-551):

* Candidates are **any** ground units, including infantry, Harvesters and MCVs, except worms (`canAttack`, lines 432-445):
  * the tile is passable for the worm (not rock);
  * the tile lies in the **same sand region** as the worm;
  * **there is no team or visibility check** — the worm eats its own master's units too;
  * fog is not taken into account either.
* Maximum distance (`blockDistance` in tiles): GUARD/AMBUSH — ViewRange (**2**); HUNT — 2×ViewRange (**4**); AREAGUARD and forced — unlimited.
* Candidate priority:

```
base = infantry: 100;  Harvester or tracked: 1000;  other ground (wheeled, MCV): 5000
if the candidate is moving or has a target: base *= 4
d = max(1, round(blockDistance))
prio = base / d (integer division); if d < 2: prio *= 2
→ the maximum prio is taken
```

* If nobody qualified, for GUARD/AMBUSH the ordinary `ObjectBase::findTarget` is used (the nearest within ViewRange on explored tiles).

**Modes.**
* Initial — AMBUSH (line 88).
* Found a target within ViewRange → HUNT (UnitBase.cpp:1371-1388).
* In HUNT the worm pursues its target while it is ≤ 4 tiles away. Beyond that it drops the target, switches to AMBUSH mode and returns to guardPoint (`engageTarget`, lines 221-268).
* HUNT with no targets → GUARD with guardPoint = the current tile (common logic).
* On receiving damage > 0 → HUNT. If the offender is a unit **not on rock**, the worm attacks it with `forced=true` (pursues without a distance limit, lines 323-347).

**Attack** (lines 115-144, 372-401):
1. The worm catches up with the target **into the same tile** (WeaponRange 0). The worm's attack angle always "matches".
2. `attack()`: sound, a 9-frame animation of 10 cycles each (90 cycles). `primaryWeaponTimer = 60`.
3. On frame 1 (after ~10 cycles) — the "bite": `Map::damage(Bullet_Sandworm, 5000)`. It kills **all** ground units and infantry **standing in the worm's tile** at that moment (not only the target). They are made invisible: no wreckage and no dropped soldiers.
   If the target was alive and disappeared, `kills++`. The target has ~10 cycles to drive away — then the bite lands on empty ground.
4. When the animation finishes, if `kills ≥ 3`, `sleepOrDie()` is called.

**Leaving / dying** (`sleepOrDie`, lines 297-311; `update`, lines 349-430):
* Conditions: HP ≤ 50% (≤ 500 of 1000) **or** 3 targets eaten.
* If the `killedSandwormsDropSpice` option is enabled — a spice field of radius 4 is created where the worm was.
* If the `sandwormsRespawn` option is enabled — the worm "falls asleep":
  * it disappears from the map, HP is fully restored, `kills=0`;
  * it sleeps for 10000–50000 cycles (160–800 s);
  * then it appears in a random tile passable for the worm (up to 1000 attempts; if none found — it sleeps again).
* Otherwise the worm is destroyed.

**Vulnerability.** The worm takes damage from any **ground** explosion (it is in the ground/underground list of `Map::damage`), including Sonic. It cannot be deviated (Map.cpp:236). Air rockets do not affect it.
Any unit can pick the worm as a target regardless of team (ObjectBase.cpp:371). The worm, however, must be on an explored and non-fogged tile.
The worm does not touch units on rock or concrete — the "safe base" rests on this.

**Sound/UI.** The "Worm sign" plays once, when the worm first picks a unit of the local player as its target (lines 313-321). The phrase "something under the sand" plays if the worm has stopped under the player's infantry.

---

## 8. Carryall and Frigate (src/units/Carryall.cpp, src/units/Frigate.cpp)

### 8.1 Speed (`Carryall::update`, Carryall.cpp:89-113; the Frigate is the same, Frigate.cpp:103-125)

```
if there is a unit target:            dist = |pos − target.pos|            (px)
else if there is a target or cargo:   dist = |pos − centre of the destination tile|
if dist is known:
   dist < 32         → v = min(dist, 2)
   dist ≥ 640        → v = MaxSpeed (19.2 / 12.8)
   otherwise         → linear from 2 (at 32 px) to MaxSpeed (at 640 px)
else (free):        v = min(v + 0.2, MaxSpeed)   // acceleration
```

Turning is 0.099 eighths per cycle. The turning radius at full speed is ≈ 3.9 tiles; near the target it is small: the speed drops as it approaches.

### 8.2 Booking and summoning

* `isBooked()` = has a target **or** cargo (include/units/Carryall.h).
* `GroundUnit::requestCarryall()` (GroundUnit.cpp:185-209), if the house has a Carryall and the unit is not already waiting:
  * the unit's mode → CARRYALLREQUESTED;
  * the **first** unbooked Carryall of the house in `unitList` order is taken (not the nearest!);
  * `carryall.setTarget(unit)` (the unit is marked `awaitingPickup`), and the unit remembers `bookedCarrier`.
  If there are no free ones, the unit stays in CARRYALLREQUESTED and repeats the request every cycle, continuing to drive on its own. When the house has lost its Carryalls, the unit returns to GUARD/HARVEST (GroundUnit.cpp:151-162).
* **While the unit is waiting for a Carryall (`awaitingPickup`), it does not navigate, i.e. it stands still** (GroundUnit.cpp:251-258).
* Who summons a Carryall automatically:
  * Harvester: the field or Spice Refinery is ≥ 6 tiles away, or the path is blocked;
  * Spice Refinery after unloading: carry the Harvester back to the field;
  * auto-repair and "Send to repair";
  * Repair Facility after repair (only with the manualCarryallDrops option);
  * units stuck on a long path (only the AI or with manualCarryallDrops);
  * the "Request Carryall Drop" command.

### 8.3 Approach and pickup (`engageTarget`, Carryall.cpp:355-447; `pickupTarget`, lines 464-537)

* The target is released if it has disappeared, become inactive, stopped waiting (`!awaitingPickup`) or changed team (deviation). After that a Carryall without cargo flies to guardPoint.
* Approach point: for a Spice Refinery — `loc+(2,0)` (the landing pad); for a unit — its tile; for other structures — the nearest tile.
* **"Pull-in"** (a quirk of the fork): closer than 2 tiles, the Carryall is additionally shifted straight towards the centre of the point, by up to 16 px per axis per cycle. This eliminates circling.
* Pickup happens at a distance of ≤ 6.4 px (TILESIZE/10):
  * **ground unit**:
    * if it died at that moment — the Carryall crashes too (HP=0);
    * if the unit "needs" it (has a target, or destination ≠ tile, or HP < 50%, or is waiting):
      * if HP < 50% or the unit has no target and is not a Harvester — `doRepair()` is called. **Any damaged** carried unit without a target is redirected to a free Repair Facility;
      * the unit is hidden in the Carryall (`setPickedUp`: invisible, inactive, removed from the map);
      * destination: Spice Refinery (if the unit's target is one) → `loc+(2,0)`; Repair Facility → its nearest tile; otherwise — the unit's destination. The unit's guardPoint = the pickup spot;
    * otherwise — refusal: a unit from CARRYALLREQUESTED → STOP, the Carryall is freed;
  * **structure**:
    * Spice Refinery — pick up the unloaded Harvester (`deployHarvester(this)`), carry it to its guardPoint;
    * Repair Facility — pick up the repaired unit.

### 8.4 Drop-off (`checkPos`, Carryall.cpp:161-224; `deployUnit`, lines 226-303)

* Drop-off begins when the Carryall is in the destination tile and its speed is ≤ 0.5.
  Up to 3 infantrymen or 1 vehicle are dropped at a time. If cargo remains, a new random free tile at a distance of 3..8 tiles is chosen, and the flight continues.
* When dropping over **your own** building:
  * a free Repair Facility — the unit immediately goes in for repair; if the Repair Facility is busy, it is booked;
  * a free Spice Refinery and a Harvester — the Harvester immediately starts unloading.
* Otherwise the unit is placed nearby via `findDeploySpot`, turned the same way as the Carryall, `forced=false`. Mode after drop-off: Saboteur → HUNT, Harvester → HARVEST, **all others → AREAGUARD**.
* If the target is a structure and the Carryall is over it with cargo, all the cargo is dropped at once.
* After being emptied, a regular Carryall flies to its guardPoint.
* **A free "own" Carryall** (Carryall.cpp:211-221): if it has a destination — on arriving within a radius of 2 tiles it clears it and circles. If it has moved further than 17 tiles from guardPoint, it returns.

### 8.5 Carryall death (Carryall.cpp:305-345)

All bookings are removed. **The cargo is destroyed** along with it — this is how carried Harvesters die. Wreckage remains on the tile.
A Carryall is shot down only by the Launcher, Trooper and Rocket Turret. Rocket damage to a Carryall is with falloff (§3.1). Launcher rockets do **not** track it.

### 8.6 The "courier" Carryall (dropOfferer)

Used for the free Harvester and for reinforcements from triggers.

* `House::freeHarvester` (House.cpp:625-656): a Carryall (`owned=false`) with a Harvester (5 spice) appears at the map-edge tile closest to `refinery+(2,0)`, facing inwards, with the Spice Refinery as its target.
* Reinforcements (src/Trigger/ReinforcementTrigger.cpp:208-247):
  * the drop point is chosen by type: N/E/S/W/Air/Visible/Enemybase/Homebase;
  * then up to 32 attempts at a random shift of up to 7 tiles to a free tile;
  * the Carryall flies from the nearest edge with the cargo.
* After unloading, the courier flies to its guardPoint (the map edge). In the last 32 px before the edge it does not turn; it flies off the edge and is removed once its centre goes more than 1 tile beyond the map.

### 8.7 Frigate (Starport)

* An order at the Starport (`doPlaceOrder`, src/structures/StarPort.cpp:188-201): `arrivalTimer = 1875` cycles (30 s; with instantBuild — 1).
* On the timer (StarPort.cpp:234-269):
  * the Frigate is created at the map-edge tile closest to `starport+(1,1)`, facing inwards;
  * the target is the Starport, the destination is the Starport tile nearest to the Frigate.
* HP 10000, speed 12.8 with the same braking curve, turning 0.099. It attacks nobody, `respondable=false`.
* When the Frigate is in the destination tile and closer than 8 px to its centre (Frigate.cpp:86-101), `Starport.startDeploying()` is called. The Frigate turns towards guardPoint (the spawn point at the edge) and flies away. Beyond the map it is removed, like the courier. In the last 32 px before the edge it does not turn.
* Unloading from the Starport: one order at a time (3 infantrymen for "Infantry/Troopers") every 125 cycles (2 s), with `findDeploySpot` placement (StarPort.cpp:270-345).
* If the Starport is destroyed before unloading, the Frigate simply flies away. If the Frigate is destroyed, the Starport's order is zeroed (`informFrigateDestroyed`, StarPort.cpp:355).

---

## 9. "Non-obvious" rules without which it will not feel like Dune II / Dune Legacy

1. **A direct hit = half damage to a unit, full to a building.** The formula is `W >> (d/16+1)` (§3.2). Without this, all units will be twice as "fragile".
2. **Friendly fire is on everywhere.** Splash, Sonic, Death Hand, the Devastator explosion. Shells explode on your own buildings in the line of fire (except Gun Turret).
3. **Air and ground are hit separately.** A ground explosion does not touch aircraft, an "air" rocket does not touch the ground. The Ornithopter takes full damage from anti-air rockets without falloff.
4. **The Launcher "misses at point-blank range".** The rocket does not explode until the 22-cycle timer has expired (~6.6 tiles of travel). There is scatter (d+8) px and rare (1/16) long misses of up to ~4 tiles. Against Ornithopters the rocket homes in.
5. **Speed depends strongly on terrain**, and differently for wheels and tracks (§6.2). Concrete is the fastest. A pause of 1–5 cycles on every tile. The hull turns only while standing, ~0.26 s per 45°.
6. **Damaged vehicles (HP < 50%) move at 37.5% speed**, fire with one barrel, and smoke. With a Repair Facility + Carryall available, they fly off for repair on their own.
7. **A unit that has received a player order is "deaf" to enemies until it arrives** (forced). Units in GUARD do not answer fire from outside their range. AMBUSH turns into HUNT on seeing an enemy or on taking damage. HUNT with no targets becomes GUARD.
8. **Walls and Carryalls are targets of last resort.**
9. **Tracked units crush enemy infantry by driving into its tile** (at the tile's centre). On an order to attack infantry, they drive over to crush it. Wheeled units and the MCV cannot crush. Your own infantry blocks passage.
10. **Infantry walks on mountains and stands 5 to a tile** (of one team only). Infantry is the only way to get onto mountains.
11. **Capturing a building with infantry.** The infantryman always dies. Capture at "red" HP (by design < 25%, in this fork due to the bug < 50% — choose deliberately); otherwise damage `min(HP/2, 2·infantryman HP)`. Palace, IX Research Centre, Barracks, WOR, Radar Outpost and Wall cannot be captured.
12. **The Saboteur is invisible** while there is no enemy object nearby (±2 tiles). Detonating right next to a target (8 neighbours), it destroys a building or vehicle **entirely**.
13. **The Deviator.** The probability depends on the victim's house (in custom games — 100%). The duration is 120 s, but any damage to the victim (20 s per 1 HP) and each of its shots (20 s) shorten it. Deviation does not work on the Carryall, Frigate, worm and buildings. A soldier dropped from a deviated unit is also deviated.
14. **Devastator**: self-destruct after 3.2 s. On any death — a 3×3 explosion: 75 to vehicles at tile centres and 150 to a building for each tile.
15. **The Sonic Tank** hits along a line through everything for its full range (8 tiles), ~2 HP per 6 px of travel within a radius of 48 px, without falloff. It hits friendly units, except other Sonic Tanks.
16. **A spice bloom kills any ground unit passing through the centre of its tile**, and turns into a spice field of radius 5. It is detonated by any shot except Sonic.
17. **Harvester**: 700 spice; ~8.4 spice/s harvesting, ~39/s unloading (slower with a damaged Spice Refinery). A full one moves 40% slower. On death 75% of the cargo is scattered around.
    A click on a non-spice tile puts it in STOP. A Carryall transports Harvesters if the field/Spice Refinery is ≥ 6 tiles away. While a Harvester waits for a Carryall, it stands still.
18. **The worm**:
    * lives only on the sand of its own region;
    * attacks any ground units within 2 tiles (up to 4 when pursuing, unlimited if it has been wounded);
    * prefers **wheeled vehicles** (5000), then tracked ones and Harvesters (1000), then infantry (100); moving ones ×4;
    * kills **everyone** in the tile with a single "bite";
    * leaves after 3 targets eaten or at HP ≤ 50%;
    * never enters rock or concrete.
19. **A vehicle's death can "drop" a soldier** (InfSpawnProp %: 25 for vehicles, 50 for the Harvester) with half HP.
20. **Every shot reveals the shooter** (radius 2) to the target's owner. Aviation does not reveal the map.
21. **Rockets (not shells) destroy concrete** at the point of explosion if there is no building there: Slab → Rock.
22. **The Carryall is chosen as "first free"**, not nearest. When a Carryall dies, its cargo dies too. Free Carryalls circle around guardPoint. Dropped units receive AREAGUARD mode.
23. **Ornithopter**: constant speed, fires only when "facing" the target, flies away for 1 s after firing — strafing runs. Shot down by a single anti-air rocket.
24. **The MCV** deploys anywhere that a 2×2 area is rock or concrete and the 3 neighbouring tiles are free. Concrete and proximity to a base are not required.
25. **All timers are in cycles.** When the game is sped up (fewer ms/cycle), everything speeds up at once. The reference rate is 62.5 Hz.

---

## Appendix A. Pseudocode of key functions for implementation

```js
// Damage to a unit from an explosion (not Sonic, not Ornithopter-versus-air)
function splashToUnit(W, distPx) { return Math.round(W) >> (Math.floor(distPx / 16) + 1); }

// Speed of a ground unit when starting a step from tile fromTile
function stepSpeed(unit, fromTile) {
  let v = unit.maxSpeed;                                   // px/cycle
  if (unit.isHarvester) {
    if (unit.hp < unit.maxHp * 0.5) v *= 0.75;
    v *= 1 - 0.4 * unit.spice / 700;
  } else if (!unit.isAir) {
    v *= 2 - terrainDifficulty(unit.moveClass, fromTile.type);   // table in §6.2
    if (unit.hp < unit.maxHp * 0.5) v *= 0.75;
  }
  return v;                     // in move(): if !air && !infantry && hp<50% → the step is v/2
}

// Octile distance (tiles)
const blockDistance = (a, b) => {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};

// Scatter of a Launcher/Deviator rocket
function rocketScatter(rng, distPx) {
  const d = Math.max(0, Math.round(distPx / 64));
  const limit = rng.int(0, 15) !== 0 ? d + 8 : rng.int(0, 255) + 8;
  let r = rng.int(0, 255); while (r > limit) r >>= 1;
  const a = 2 * Math.PI * rng.float();
  return { dx: Math.round(Math.cos(a) * r), dy: -Math.round(Math.sin(a) * r) };
}
```

## Appendix B. Quick source index

| Topic | File:lines |
|---|---|
| Constants | include/Definitions.h:37-92 |
| Projectile/explosion/terrain types | include/data.h:22-115 |
| Attack modes | include/DataTypes.h:293-306 |
| Projectiles | src/Bullet.cpp:36-129 (creation, scatter), 167-269 (parameters), 353-545 (flight), 548-616 (explosion) |
| Area damage, terrain, bloom | src/Map.cpp:118-302 |
| Deviation weakness | src/sand.cpp:592-610 |
| Unit firing/combat/movement/AI | src/units/UnitBase.cpp:205-298, 481-607, 609-811, 1019-1157, 1272-1292, 1343-1591 |
| Target selection | src/ObjectBase.cpp:367-372, 405-737 |
| Repair, carryall requests, bloom | src/units/GroundUnit.cpp:68-290 |
| Terrain (wheels/infantry) | include/units/GroundUnit.h:70-84 |
| Terrain (tracks), crushing | include/units/TrackedUnit.h:47-60; src/units/TrackedUnit.cpp:53-108 |
| Infantry, capture | src/units/InfantryBase.cpp:92-375, 495-531 |
| Tank turrets | src/units/TankBase.cpp |
| Harvester | src/units/Harvester.cpp:152-619; src/structures/Refinery.cpp:107-205 |
| Worm | src/units/SandWorm.cpp; include/units/SandWorm.h |
| Aviation | src/units/AirUnit.cpp; Carryall.cpp; Ornithopter.cpp; Frigate.cpp |
| A* | src/AStarSearch.cpp:116-240; include/AStarSearch.h |
| Tiles, spice, bloom | src/Tile.cpp:245-275, 599-711, 829-954 |
