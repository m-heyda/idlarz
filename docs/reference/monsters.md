# Monsters

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The roster, levels, growth, spawning and what a kill pays.

**Contents**

- Roster: [`MONSTERS`](#monsters)
- Level scaling: [`monsterStats`](#monsterstats), [`spawnLevelRange`](#spawnlevelrange), [`rollSpawnLevel`](#rollspawnlevel), [`levelAtAge`](#levelatage), [`dangerBonus`](#dangerbonus)
- Spawning: [`advanceBank`](#advancebank), [`canSpawnOn`](#canspawnon), [`typeWeights`](#typeweights), [`placeTickets`](#placetickets), [`ticketCap`](#ticketcap), [`DISTANCE_BANDS`](#distance-bands), [`BOSS_MIN_DISTANCE`](#boss-min-distance), [`bandOf`](#bandof)
- Rewards: [`killIncome`](#killincome)
- Bestiary: [`META`](#meta), [`FAMILY_DROPS`](#family-drops)
- Boss modifiers: [`BossModifiers`](#bossmodifiers), [`describeModifiers`](#describemodifiers)

## Roster

<a id="monsters"></a>

### `MONSTERS` <small>const</small>

Source: [`src/config/combatConfig.ts:592`](../../src/config/combatConfig.ts)

The roster: 72 monsters in twelve biomes that can appear, five normal ones and a boss each (IDL-360: a glass cannon and an armored wall or a brute were added to every biome), plus seven retired stand-ins and duplicates that never do (`RETIRED_MONSTERS`): plains, forest, swamp and tundra, since IDL-201 hills, coast and lake, and the five rebirth biomes (each only after its rebirth, the jungle after the first). A monster may only stand on a biome in its `spawn.biomes`, which is its own biome, water included (an owned coast or lake tile holds a monster like any other). The rebirth biomes only get tiles once `config/biomeStage.ts` turns them on; until then their monsters wait.
Stats are at level 1 (bosses at their `refLevel`), straight from [`monsterStats`](monsters.md#monsterstats); speed is attacks per second; the spawn window shows castle level 1 to castle level 10.

- Builds (`BUILD`): even x1 HP x1 attack, speed 0.5; tough x1.3 HP x0.8 attack, 0.4; fierce x0.8 HP x1.25 attack, 0.6; elite x2 HP x1.5 attack, 0.45, +8 armor.
- Normal monsters never crit (`critChance` 0, `critMult` 1.5, no Stun resistance). Bosses, plains / coast / forest / hills / swamp / lake / tundra / jungle: crit 8 / 8 / 9 / 9 / 10 / 11 / 13 / 14 %, Stun resistance 20 / 22 / 25 / 27 / 30 / 37 / 45 / 50 %, time limit 75 / 78 / 80 / 82 / 85 / 88 / 90 / 100 s, one hit every 3 s (`BIOME_TIER`).
- Tier numbers per biome (`BIOME_TIER`), HP / attack: plains 100 / 4; coast 130 / 5; forest 160 / 6; hills 190 / 6.5; swamp 220 / 7; lake 260 / 7.5; tundra 300 / 8; jungle 340 / 9.
- The ladder against gear: `docs/generated/monster-ladder.md`.

**The roster (level 1 stats; bosses at their reference level)** _(computed from the code)_

| Biome | Monster | Ref. level | HP | Attack | Armor | Speed / s | Spawn level window (castle 1 -> castle 10) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plains | Thistle Boar | 1 | 100 | 4 | 0 | 0.5 | 1-3 -> 8-10 |
| plains | Burrow Badger | 1 | 130 | 3 | 0 | 0.4 | 1-3 -> 8-10 |
| plains | Dust Strider | 1 | 80 | 5 | 0 | 0.6 | 1-3 -> 8-10 |
| plains | Gravel Quail | 1 | 56 | 6 | 0 | 0.6 | 1-3 -> 8-10 |
| plains | Stonehorn Bison | 1 | 163 | 4 | 3 | 0.4 | 1-3 -> 8-10 |
| plains | The Great Auroch (boss) | 15 | 1,000 | 11 | 15 | 0.33 | 15-18 -> 22-25 |
| forest | Mossback Wolf | 1 | 128 | 8 | 1 | 0.6 | 4-6 -> 12-14 |
| forest | Bramble Imp | 1 | 160 | 6 | 1 | 0.5 | 4-6 -> 12-14 |
| forest | Rotcap Stag | 1 | 208 | 5 | 1 | 0.4 | 4-6 -> 12-14 |
| forest | Ember Squirrel | 1 | 90 | 9 | 1 | 0.6 | 4-6 -> 12-14 |
| forest | Pinecone Warden | 1 | 261 | 6 | 5 | 0.4 | 4-6 -> 12-14 |
| forest | The Elder Stag (boss) | 20 | 1,900 | 16 | 24 | 0.33 | 20-23 -> 27-30 |
| swamp | Garbage Ogre | 1 | 286 | 6 | 2 | 0.4 | 8-10 -> 16-18 |
| swamp | Toxic Zombie | 1 | 286 | 6 | 2 | 0.4 | 8-10 -> 16-18 |
| swamp | Dumpback | 1 | 220 | 7 | 2 | 0.5 | 8-10 -> 16-18 |
| swamp | Rot Heron | 1 | 176 | 9 | 2 | 0.6 | 8-10 -> 16-18 |
| swamp | Scrap Golem | 1 | 286 | 6 | 2 | 0.4 | 8-10 -> 16-18 |
| swamp | Bogfire Wisp | 1 | 123 | 11 | 2 | 0.6 | 8-10 -> 16-18 |
| swamp | The Mire Matriarch (boss) | 25 | 2,800 | 21 | 32 | 0.33 | 25-28 -> 32-35 |
| tundra | Frost Hare | 1 | 240 | 10 | 3 | 0.6 | 12-14 -> 16-18 |
| tundra | Icetusk Calf | 1 | 390 | 6 | 3 | 0.4 | 12-14 -> 16-18 |
| tundra | Rime Wraith | 1 | 600 | 12 | 11 | 0.45 | 12-14 -> 16-18 |
| tundra | Frost Moth | 1 | 300 | 8 | 3 | 0.5 | 12-14 -> 16-18 |
| tundra | Glacier Yeti | 1 | 840 | 9 | 10 | 0.45 | 12-14 -> 16-18 |
| tundra | The Winter Wyrm (boss) | 30 | 7,000 | 36 | 58 | 0.33 | 30-33 -> 37-40 |
| hills | Granite Ram | 1 | 152 | 8 | 1.5 | 0.6 | 6-8 -> 14-16 |
| hills | Cave Goblin Miner | 1 | 190 | 7 | 1.5 | 0.5 | 6-8 -> 14-16 |
| hills | Boulder Beetle | 1 | 247 | 5 | 1.5 | 0.4 | 6-8 -> 14-16 |
| hills | The Hill Giant (boss) | 22 | 2,300 | 18 | 28 | 0.33 | 22-25 -> 29-32 |
| hills | Magma Knight | 1 | 152 | 8 | 1.5 | 0.6 | 6-8 -> 14-16 |
| hills | Magma Crab | 1 | 247 | 5 | 1.5 | 0.4 | 6-8 -> 14-16 |
| hills | Mawhorn Brute | 1 | 190 | 7 | 1.5 | 0.5 | 6-8 -> 14-16 |
| hills | Quarry Drake | 1 | 106 | 10 | 1.5 | 0.6 | 6-8 -> 14-16 |
| hills | Cairn Sentinel | 1 | 310 | 6 | 6 | 0.4 | 6-8 -> 14-16 |
| hills | Quarry Rat Knight | 1 | 247 | 5 | 1.5 | 0.4 | 6-8 -> 14-16 |
| hills | Highland Gnoll | 1 | 190 | 7 | 1.5 | 0.5 | 6-8 -> 14-16 |
| hills | The Ironhorn (boss) | 22 | 2,300 | 23 | 28 | 0.33 | 22-25 -> 29-32 |
| coast | Wreck Crab | 1 | 169 | 4 | 0 | 0.4 | 2-4 -> 10-12 |
| coast | Net Gull | 1 | 104 | 6 | 0 | 0.6 | 2-4 -> 10-12 |
| coast | Drowned Sailor | 1 | 130 | 5 | 0 | 0.5 | 2-4 -> 10-12 |
| coast | Tideglass Jelly | 1 | 73 | 8 | 0 | 0.6 | 2-4 -> 10-12 |
| coast | Barnacle Brute | 1 | 212 | 5 | 3 | 0.4 | 2-4 -> 10-12 |
| coast | The Reef Leviathan (boss) | 17 | 1,400 | 17 | 20 | 0.33 | 17-20 -> 24-27 |
| lake | Moss Snapper | 1 | 338 | 6 | 2.5 | 0.4 | 10-12 -> 17-19 |
| lake | Reed Nymph | 1 | 260 | 8 | 2.5 | 0.5 | 10-12 -> 17-19 |
| lake | Pike Lurker | 1 | 208 | 9 | 2.5 | 0.6 | 10-12 -> 17-19 |
| lake | Tidepool Golem | 1 | 338 | 6 | 2.5 | 0.4 | 10-12 -> 17-19 |
| lake | Silt Eel | 1 | 146 | 12 | 2.5 | 0.6 | 10-12 -> 17-19 |
| lake | Lilypad Warden | 1 | 424 | 7 | 8 | 0.4 | 10-12 -> 17-19 |
| lake | The Lake Hydra (boss) | 27 | 4,500 | 27 | 45 | 0.33 | 27-30 -> 34-37 |
| jungle | Skull Vine | 1 | 340 | 9 | 4 | 0.5 | 16-18 -> 23-25 |
| jungle | Eye Horror | 1 | 272 | 11 | 4 | 0.6 | 16-18 -> 23-25 |
| jungle | Zombie Triceratops | 1 | 442 | 7 | 4 | 0.4 | 16-18 -> 23-25 |
| jungle | Vinewhip Panther | 1 | 190 | 14 | 4 | 0.6 | 16-18 -> 23-25 |
| jungle | Mossback Idol | 1 | 554 | 8 | 11 | 0.4 | 16-18 -> 23-25 |
| jungle | The Hardwood Colossus (boss) | 32 | 9,000 | 40 | 64 | 0.33 | 38-41 -> 45-48 |
| jungle | The Brainstorm (boss) | 32 | 9,000 | 40 | 64 | 0.33 | 38-41 -> 45-48 |
| fields | Barn Gargoyle | 1 | 320 | 13 | 5 | 0.6 | 20-22 -> 27-29 |
| fields | Bucket Knight | 1 | 520 | 8 | 5 | 0.4 | 20-22 -> 27-29 |
| fields | Hedge Bandit | 1 | 400 | 11 | 5 | 0.5 | 20-22 -> 27-29 |
| fields | Crow Marshal | 1 | 224 | 17 | 5 | 0.6 | 20-22 -> 27-29 |
| fields | Millstone Golem | 1 | 652 | 10 | 13 | 0.4 | 20-22 -> 27-29 |
| fields | The Harvest Matron (boss) | 37 | 12.5 K | 52 | 80 | 0.33 | 46-49 -> 53-56 |
| orchard | Greenscale Warden | 1 | 611 | 10 | 6 | 0.4 | 24-26 -> 31-33 |
| orchard | Blossom Ronin | 1 | 376 | 15 | 6 | 0.6 | 24-26 -> 31-33 |
| orchard | Gray Gleaner | 1 | 470 | 12 | 6 | 0.5 | 24-26 -> 31-33 |
| orchard | Mushroom Wizard | 1 | 263 | 19 | 6 | 0.6 | 24-26 -> 31-33 |
| orchard | Rootbound Gardener | 1 | 766 | 11 | 15 | 0.4 | 24-26 -> 31-33 |
| orchard | The Blossom Reaper (boss) | 42 | 16.5 K | 77 | 98 | 0.33 | 54-57 -> 61-64 |
| blight | Gasket Goblin | 1 | 550 | 14 | 7.5 | 0.5 | 28-30 -> 35-37 |
| blight | Blighted Husk | 1 | 715 | 11 | 7.5 | 0.4 | 28-30 -> 35-37 |
| blight | Mothwing Hexer | 1 | 440 | 17 | 7.5 | 0.6 | 28-30 -> 35-37 |
| blight | Gloom Cerberus | 1 | 1,100 | 20 | 15.5 | 0.45 | 28-30 -> 35-37 |
| blight | Sporeback Ogre | 1 | 1,540 | 15 | 19 | 0.45 | 28-30 -> 35-37 |
| blight | Spore Hound | 1 | 440 | 17 | 7.5 | 0.6 | 28-30 -> 35-37 |
| blight | The Eyed Maw (boss) | 47 | 21.5 K | 78 | 118 | 0.33 | 60-63 -> 67-70 |
| battlefield | Bone Cleaver | 1 | 640 | 15 | 9 | 0.5 | 32-34 -> 39-41 |
| battlefield | Frostguard Knight | 1 | 832 | 12 | 9 | 0.4 | 32-34 -> 39-41 |
| battlefield | Gilded Champion | 1 | 512 | 19 | 9 | 0.6 | 32-34 -> 39-41 |
| battlefield | Banner Wraith | 1 | 358 | 24 | 9 | 0.6 | 32-34 -> 39-41 |
| battlefield | Frost-Flame Knight | 1 | 1,043 | 14 | 21 | 0.4 | 32-34 -> 39-41 |
| battlefield | The Cinder Warlord (boss) | 52 | 50 M | 10800 | 50000 | 0.33 | 68-71 -> 75-78 |

## Level scaling

<a id="monsterstats"></a>

### `monsterStats` <small>function</small>

Source: [`src/lib/monsters.ts:132`](../../src/lib/monsters.ts)

HP, attack, armor, crit and stun resistance of a monster at a level (the reward is `monsterReward`).

Level scaling: a monster has an integer level. Stats follow `monsterStats`.

- **Normal** (`scaling: 'exp'`): `HP = round(hp x sqrt(1.5)^(level-1))`, `attack = round(attack x sqrt(1.25)^(level-1))`, `armor = armor + 0.5 x (level-1)`. A level 9 plains monster has 506 HP.
- **Boss** (`scaling: 'gear'`): HP and attack `x levelScale(level) / levelScale(refLevel)` (`1 + 0.07 x (level - 1)`, `src/catalog/stats.ts`); armor `+0.5` per level away from `refLevel`. The plains boss has 1,000 HP and 11 attack at level 15.
- Reference levels: plains 15, coast 17, forest 20, hills 22, swamp 25, lake 27, tundra 30.
- Boss modifiers ([`BossModifiers`](monsters.md#bossmodifiers)): **Brutal** raises `attack` by its %, **Enrage** raises `attackSpeed` by its % for every step the fight has reached (`elapsedSec`, one step per `everySec`, a maximum of `maxSteps`).

**Formula**

```text
normal: HP     = round(hp     x sqrt(1.5)^(level - 1))
        attack = round(attack x sqrt(1.25)^(level - 1))
        armor  = armor + 0.5 x (level - 1)
boss:   HP, attack = base x levelScale(level) / levelScale(refLevel)         levelScale(L) = 1 + 0.07 x (L - 1)
        armor  = armor + 0.5 x (level - refLevel)
Brutal: attack      x (1 + attackPct / 100)
Enrage: attackSpeed x (1 + speedPct / 100 x steps)        steps = min(maxSteps, floor(elapsedSec / everySec))
```

<a id="spawnlevelrange"></a>

### `spawnLevelRange` <small>function</small>

Source: [`src/lib/monsters.ts:51`](../../src/lib/monsters.ts)

The levels a new monster of this type can appear at in a world of this castle level (both ends included).

Spawn window. Plains normal: base 1, +1 per castle level, spread 2, cap 10; coast 2/+1/2/12; forest 4/+1/2/14; hills 6/+1/2/16; swamp 8/+1/2/18; lake 10/+1/2/19; tundra 12/+0.5/2/20. Bosses: base 15 / 17 / 20 / 22 / 25 / 27 / 30 (plains, coast, forest, hills, swamp, lake, tundra), +0.8 per castle level, spread 3, cap base + 10.

**Formula**

```text
min = max(1, min(cap - spread, base + floor(perCastleLevel x (castle level - 1))))
max = min(cap, min + spread)
```

<a id="rollspawnlevel"></a>

### `rollSpawnLevel` <small>function</small>

Source: [`src/lib/monsters.ts:68`](../../src/lib/monsters.ts)

The level a new monster starts at. Rolled from a generator seeded by its id and nothing else, so it takes no number from
Math.random (the rest of the game's randomness is the same with or without it) and the same monster always rolls the same.
`levelCap` (optional) is the highest level the player can still beat (see offline/spawnWeights.ts): a roll above it comes down to it, never below `min`.

The level is rolled from a generator seeded by the monster's ticket number only, plus a **danger bonus** of 1 level per 8 tiles of Chebyshev distance from the castle ([`dangerBonus`](monsters.md#dangerbonus), `COMBAT.spawn.dangerStep`).
The per-band `dangerOffset` in `DISTANCE_BANDS` is 0 everywhere and unused.

<a id="levelatage"></a>

### `levelAtAge` <small>function</small>

Source: [`src/lib/monsters.ts:105`](../../src/lib/monsters.ts)

The level of a monster of this age: its spawn level plus one per growth interval, up to the growth limit.

Growth: +1 level per 1,800 s on the map (`LIMITS.monsterGrowthIntervalSec`), at most +10 above the spawn level (`LIMITS.monsterGrowthLevels`, hard 40). The level is a function of age.
A monster whose spawn was capped for a weak player has a smaller `growCap`.

**Formula**

```text
level = spawnLevel + min(growthLevels, floor(ageSec / 1800))
```

<a id="dangerbonus"></a>

### `dangerBonus` <small>function</small>

Source: [`src/lib/monsters.ts:86`](../../src/lib/monsters.ts)

Levels added to a monster that appears `distance` tiles (Chebyshev) from the castle: danger grows toward the frontier.

**Formula**

```text
danger bonus = floor(Chebyshev distance from the castle / 8) levels
```

## Spawning

<a id="advancebank"></a>

### `advanceBank` <small>function</small>

Source: [`src/lib/offline/tickets.ts:182`](../../src/lib/offline/tickets.ts)

Runs the timers for `dtSec` seconds and mints the tickets that come due, in the order they come (a chest every ~10 minutes
(shorter with Luck), a normal monster every 15, the first after 2, a boss every 3 hours while none waits), as long as there is room.
With no room the chest and monster timers sit at 0, like the client's own timers. `rollFor(kind, n)` gives the random source of ticket
`n` (the server seals it with a secret; tests pass a seeded one) and decides whether a monster is golden.

`realDtSec` is the real time the `dtSec` stand for: an absence is credited at a share of its length (the efficiency), but the
tickets are stamped across the whole real stretch so that they have the ages they would have had.

Where and when monsters appear (server only).

- **Timers** (`COMBAT.spawn`): the first normal monster 120 s after the run starts, then one per 900 s; one boss at a time, 10,800 s after the last one left (or after the start). The timers pause when the map has no room or no free tile for it.
- **Room**: monsters and chests together hold at most 30% of the free tiles, at least 2, at most 40 tickets ([`ticketCap`](monsters.md#ticketcap), `SPAWN_LIMIT`, `TICKET_CAP`).
- **Golden (lucky) monsters**: chance `min(10%, 2% + 0.05% x Luck)` per new normal monster; a kill pays x3 gold, XP and hide and adds one guaranteed gear roll (`LUCK.goldenMonster`). Bosses are never golden.

<a id="canspawnon"></a>

### `canSpawnOn` <small>function</small>

Source: [`src/lib/monsters.ts:165`](../../src/lib/monsters.ts)

Whether a monster of this type may stand on this tile: the biome is on its allowlist, the tile is within its castle distance
(Chebyshev), and nothing else is there (castle ward, chest, another monster). The rules are `MonsterDef.spawn`.

The tile: an owned tile whose biome is in the monster's list (`MonsterDef.spawn`), Chebyshev distance from the castle 2 to 9 (`minCastleDistance`, `maxCastleDistance`), no chest, no other monster,
outside the castle ward from castle level 7. `minRebirths` exists in the rule but no monster uses it.

<a id="typeweights"></a>

### `typeWeights` <small>function</small>

Source: [`src/lib/offline/spawnWeights.ts:49`](../../src/lib/offline/spawnWeights.ts)

Weight of each type for this player and castle level, in the order given.

Which type spawns. Each type is weighted by the player's win chance against it ([`estimateWin`](combat.md#estimatewin)) at the middle of its spawn window: full weight (1) for 40-95%, falling to 0.75 for a trivial monster (chance 1)
and to 0.1 for a hopeless one (chance <= 5%); equal weights give the plain uniform pick. The spawn level is capped at the highest level the player still beats (never below the window's bottom) and so is its growth (`growCap`),
for new spawns only. Bosses follow the same rules (IDL-222): among the boss types that have a free tile the pick is weighted and the level capped ([`placeTickets`](monsters.md#placetickets)). Measured: `docs/generated/spawn-mix.md`.

<a id="placetickets"></a>

### `placeTickets` <small>function</small>

Source: [`src/lib/offline/placement.ts:82`](../../src/lib/offline/placement.ts)

Looks at the land: counts the tiles each kind may stand on, takes a monster or chest off a tile that stopped being valid (it is placed
again), and gives every waiting monster a tile and the level it appears at and every waiting chest a tile. Tickets with no tile left stay hidden until the land
grows. `rollFor('spawnpos', n)` picks the tile of monster ticket `n` and `rollFor('chestpos', n)` the one of chest `n` (the server seals
them with a secret; tests pass a seeded one). A chest leans toward the edge of the land and away from other chests (`pickChestSpot`).
With the player's profile (`hero`) a new monster's type is weighted by how beatable it is (spawnWeights.ts) and its level and growth are capped
near what the player can beat; without it every type is equally likely and nothing is capped. Bosses are treated the same way (IDL-222): among the boss types
that still have a free tile the pick is weighted by win chance and the boss's spawn level and growth are capped. A boss only has a free tile 8 or more tiles from the castle (`BOSS_MIN_DISTANCE`).

<a id="ticketcap"></a>

### `ticketCap` <small>function</small>

Source: [`src/lib/offline/tickets.ts:142`](../../src/lib/offline/tickets.ts)

How many more tickets may wait: the same share of the free land as the client's own spawn limit (monsters and chests together),
(`freeLand`, the client's own formula) estimated from the save's counts because the server never opens the map, and never more than `TICKET_CAP` per kind.

The room for new tickets: monsters and chests together hold at most 30% of the free land, at least 2, at most 40 tickets in all.

<a id="distance-bands"></a>

### `DISTANCE_BANDS` <small>const</small>

Source: [`src/config/distanceBands.ts:25`](../../src/config/distanceBands.ts)

Distance bands: home 1-6, outskirts 7-12, frontier 13-21, wilds 22+, read by [`bandOf`](monsters.md#bandof). No spawn rule reads them yet.

<a id="boss-min-distance"></a>

### `BOSS_MIN_DISTANCE` <small>const</small>

Source: [`src/config/combatConfig.ts:517`](../../src/config/combatConfig.ts)

The boss band (IDL-222, owner decision 2026-11-09): a boss only stands 8 or more tiles from the castle (the owner first picked 10, then lowered it to 8 after testing), just past the outskirts' start (7), and the band is open-ended (`BOSS_MAX_DISTANCE` is only a number larger than any map). Normal monsters keep 2 to 9, so at distances 8 and 9 a normal monster and a boss may both stand (never on the same tile: one monster per tile).

**Formula**

```text
boss tile: BOSS_MIN_DISTANCE (8) <= castle distance <= BOSS_MAX_DISTANCE; normal monster tile: 2 <= castle distance <= 9
```

<a id="bandof"></a>

### `bandOf` <small>function</small>

Source: [`src/lib/distance.ts:13`](../../src/lib/distance.ts)

The band a castle distance falls in. Anything below the first band (the castle tile itself) or NaN is the first band.

## Rewards

<a id="killincome"></a>

### `killIncome` <small>function</small>

Source: [`src/lib/loot/kill.ts:61`](../../src/lib/loot/kill.ts)

Rewards for a kill. Gold and XP are "seconds of income" (like chests) so they scale with the economy. The items come from
the shared loot pipeline (`generateLoot`): the monster's loot profile decides how many rolls, which rarities and which
item level; this adapter only adds the gold and XP and keeps the call the game and the tests have always made.

What a kill pays. Luck, Gold Find and Kill Rewards are applied after the cap, so pay can exceed it. Minimums: 10 gold, 5 XP (`COMBAT.rewards`). `levelMult` is 1.08 per level for normal monsters and 1.03 for bosses.
Items: see [`generateLoot`](loot.md#generateloot). Measured share of income: `docs/generated/kill-sim.md`.

**Formula**

```text
goldBase = min(gold/s x rewardSec, goldCap) x levelMult^(level - refLevel)
gold     = floor(max(10, goldBase x (1 + 0.005 x Luck) x (1 + Gold Find%)) x (lucky ? 3 : 1) x (1 + Kill Rewards%) x (1 + mastery gold%) x (1 + deed gold%))
xp       = max(5, min(xp/s x rewardSec, xpCap) x levelMult^(level - refLevel) x xpScale) x (lucky ? 3 : 1) x (1 + Kill Rewards%) x (1 + mastery XP%) x (1 + deed XP%)      (xpScale 3: kills carry the levelling, tile XP is small)      (xp/s includes the XP gain %)
hide     = floor(hide/s x rewardSec x levelMult^(level - refLevel) x 0.6 x (lucky ? 3 : 1))
```

**Kill rewards per biome** _(computed from the code)_

| Biome | rewardSec | Gold cap (level 1; bosses at refLevel) | XP cap | levelMult |
| --- | --- | --- | --- | --- |
| plains | 90 | 300 | 42 | 1.08 |
| Boss (all) | 3600 | 600 K | 45 K | 1.03 |
| forest | 110 | 600 | 85 | 1.08 |
| swamp | 135 | 1,200 | 171 | 1.08 |
| tundra | 190 | 2,400 | 342 | 1.08 |
| hills | 120 | 800 | 114 | 1.08 |
| coast | 100 | 450 | 64 | 1.08 |
| lake | 160 | 1,800 | 257 | 1.08 |
| jungle | 210 | 3,000 | 430 | 1.08 |
| fields | 250 | 4,000 | 560 | 1.08 |
| orchard | 290 | 5,200 | 720 | 1.08 |
| blight | 330 | 6,600 | 900 | 1.08 |
| battlefield | 380 | 8,400 | 1,150 | 1.08 |

## Bestiary

<a id="meta"></a>

### `META` <small>const</small>

Source: [`src/catalog/monsterMeta.ts:11`](../../src/catalog/monsterMeta.ts)

Family and tags of every monster. The family drives the Bestiary's family filter and the family bonuses of mastery ("+x% against beasts"); the tags are flavour chips. A monster without a row here reads as a Beast with no tags (a test fails on the gap).

<a id="family-drops"></a>

### `FAMILY_DROPS` <small>const</small>

Source: [`src/catalog/monsterDrops.ts:35`](../../src/catalog/monsterDrops.ts)

What each family leaves (two or three ingredients), so a bear and a boar share a theme and the Bestiary can explain it.

**Monster ingredients (Bestiary drops)** _(computed from the code)_

| Monster | Family | Ingredients (chance per kill, from level) |
| --- | --- | --- |
| Thistle Boar | Beast | bacon 8%, blood 9%, horn 4% (L3+), carrot 10% |
| Burrow Badger | Beast | bacon 12%, blood 9%, horn 4% (L3+), carrot 10%, clay 10% |
| Dust Strider | Bird | feather 16%, bacon 5%, sticks 8% |
| Gravel Quail | Bird | feather 16%, bacon 5%, carrot 6% |
| Stonehorn Bison | Beast | bacon 12%, blood 9%, horn 10% |
| The Great Auroch | Beast | bacon always, blood 9%, horn always |
| Mossback Wolf | Beast | bacon 12%, blood 9%, horn 4% (L3+), sticks 6% |
| Bramble Imp | Demon | blood 8%, horn_dark 4% (L8+), dark_shard 2% (L14+) |
| Rotcap Stag | Beast | bacon 12%, blood 9%, horn 6% (L2+), orange_mushrooms 10% |
| Ember Squirrel | Beast | bacon 12%, blood 9%, horn 4% (L3+), ember_coal 5%, sticks 8% |
| Pinecone Warden | Plant | sticks 14%, dried_herbs 14%, hollow_log 8% |
| The Elder Stag | Beast | bacon 12%, blood 9%, horn always, glowberry always |
| Mawhorn Brute | Demon | blood 8%, horn_dark 6% (L6+), dark_shard 2% (L14+) |
| Quarry Drake | Dragon | claw 8%, ember_coal 6%, fire_drop 2% (L10+), copper_ore 8%, geode 4% (L8+) |
| Cairn Sentinel | Construct | clay 12%, scrap 12%, copper_ore 10%, geode 5% (L6+) |
| Quarry Rat Knight | Humanoid | coins 10%, jug 8%, bacon 6%, copper_ore 8% |
| Highland Gnoll | Humanoid | coins 14%, jug 10%, bacon 6% |
| The Ironhorn | Construct | clay 12%, scrap 12%, copper_ore always, geode always, ember_coal always |
| Toxic Zombie | Undead | bones 18%, dark_potion 5% (L6+), moon 1% (L14+) |
| Dumpback | Beast | bacon 12%, blood 9%, horn 4% (L3+), jug 8%, scrap 10% |
| Rot Heron | Bird | feather 16%, bacon 5%, blood 6% |
| Scrap Golem | Construct | clay 12%, scrap 12%, copper_ore 6% (L3+), geode 2% (L8+) |
| Bogfire Wisp | Elemental | ember_coal 10%, obsidian 3% (L8+), fire_drop 1.5% (L10+), moon 2% (L10+), glowberry 8% (L5+) |
| The Mire Matriarch | Aquatic | sand 10%, blood always, geode 2% (L10+), dark_potion always |
| Frost Hare | Beast | bacon 12%, blood 9%, horn 4% (L3+) |
| Icetusk Calf | Beast | bacon 12%, blood 9%, horn 4% (L3+) |
| Rime Wraith | Undead | bones 18%, dark_potion 3% (L8+), moon 3% (L10+) |
| Frost Moth | Vermin | claw 7%, tar 6% |
| Glacier Yeti | Beast | bacon 10%, blood 9%, horn 8% (L6+) |
| The Winter Wyrm | Dragon | claw 8%, ember_coal 6%, fire_drop 2% (L10+), horn_dark always, moon always |
| Wreck Crab | Vermin | claw 7%, tar 6%, jug 8%, coins 6% |
| Net Gull | Bird | feather 16%, bacon 5%, grapes 5% |
| Drowned Sailor | Undead | bones 18%, dark_potion 3% (L8+), moon 1% (L14+), coins 14%, jug 10% |
| Tideglass Jelly | Aquatic | sand 10%, blood 5%, geode 2% (L10+), glowberry 6% (L4+) |
| Barnacle Brute | Aquatic | sand 10%, blood 5%, geode 2% (L10+), copper_ore 6%, clay 8% |
| The Reef Leviathan | Aquatic | sand always, blood 5%, geode always |
| Moss Snapper | Aquatic | sand 10%, blood 5%, geode 2% (L10+), hollow_log 8% |
| Reed Nymph | Plant | sticks 16%, dried_herbs 14%, hollow_log 8%, glowberry 8% (L4+), grapes 6% |
| Tidepool Golem | Construct | clay 12%, scrap 12%, copper_ore 6% (L3+), geode 6% (L8+) |
| Silt Eel | Aquatic | sand 10%, blood 5%, geode 3% (L8+) |
| Lilypad Warden | Aquatic | sand 10%, blood 5%, geode 2% (L10+), hollow_log 8%, beet 8% |
| The Lake Hydra | Aquatic | sand 10%, blood 5%, geode 2% (L10+), horn always, dark_potion always |
| Skull Vine | Plant | sticks 16%, dried_herbs 14%, hollow_log 8%, bones 12% |
| Eye Horror | Demon | blood 8%, horn_dark 4% (L8+), dark_shard 2% (L14+), emerald_star 2% (L14+) |
| Zombie Triceratops | Undead | bones 14%, dark_potion 3% (L8+), moon 1% (L14+), horn 10% (L6+) |
| Vinewhip Panther | Beast | bacon 12%, blood 9%, horn 4% (L3+), emerald_star 1.5% (L14+) |
| Mossback Idol | Construct | clay 12%, scrap 12%, copper_ore 6% (L3+), geode 5% (L10+), emerald_star 2% (L14+) |
| The Brainstorm | Fungus | orange_mushrooms always, glowberry 6% (L5+), dried_herbs 5%, emerald_star always |
| Barn Gargoyle | Construct | clay 10%, scrap 12%, copper_ore 6% (L3+), geode 2% (L8+), wheat_sheaf 8% |
| Bucket Knight | Humanoid | coins 12%, jug 6%, bacon 6%, wheat_sheaf 12%, beet 10% |
| Hedge Bandit | Humanoid | coins 16%, jug 10%, bacon 6% |
| Crow Marshal | Bird | feather 12%, bacon 5%, wheat_sheaf 10% |
| Millstone Golem | Construct | clay 12%, scrap 12%, copper_ore 6% (L3+), geode 2% (L8+), wheat_sheaf 14% |
| The Harvest Matron | Bird | feather always, bacon 5%, wheat_sheaf always |
| Greenscale Warden | Dragon | claw 8%, ember_coal 6%, fire_drop 2% (L10+), grapes 12%, horn 5% (L6+) |
| Blossom Ronin | Humanoid | coins 12%, jug 8%, bacon 6%, grapes 10% |
| Gray Gleaner | Undead | bones 18%, dark_potion 3% (L8+), moon 1% (L14+), grapes 14%, beet 10%, carrot 10% |
| Mushroom Wizard | Fungus | orange_mushrooms 14%, glowberry 10% (L4+), dried_herbs 5%, dark_potion 4% (L10+) |
| Rootbound Gardener | Plant | sticks 16%, dried_herbs 14%, hollow_log 8%, carrot 14%, beet 12%, grapes 10% |
| The Blossom Reaper | Undead | bones 18%, dark_potion 3% (L8+), moon always, grapes always |
| Gasket Goblin | Humanoid | coins 12%, jug 8%, bacon 6%, scrap 14%, copper_ore 8% |
| Mothwing Hexer | Vermin | claw 7%, tar 6%, dark_shard 3% (L14+) |
| Gloom Cerberus | Demon | blood 8%, horn_dark 8% (L10+), dark_shard 5% (L14+) |
| Sporeback Ogre | Fungus | orange_mushrooms 16%, glowberry 6% (L5+), dried_herbs 5%, dark_shard 4% (L14+) |
| Spore Hound | Beast | bacon 12%, blood 10%, horn 4% (L3+), orange_mushrooms 10% |
| The Eyed Maw | Demon | blood 8%, horn_dark 4% (L8+), dark_shard always, orange_mushrooms always |
| Bone Cleaver | Undead | bones 20%, dark_potion 3% (L8+), moon 1% (L14+), blood 10% |
| Frostguard Knight | Undead | bones 18%, dark_potion 3% (L8+), moon 1% (L14+), copper_ore 10%, coins 10% |
| Gilded Champion | Undead | bones 18%, dark_potion 3% (L8+), moon 1% (L14+), coins 20%, heart_gem 0.4% (L20+) |
| Banner Wraith | Undead | bones 18%, dark_potion 3% (L8+), moon 3% (L12+), coins 10% |
| Frost-Flame Knight | Elemental | ember_coal 12%, obsidian 5% (L12+), fire_drop 1.5% (L10+) |
| The Cinder Warlord | Undead | bones 18%, dark_potion 3% (L8+), moon 1% (L14+), fire_drop always, heart_gem always, coins always |

## Boss modifiers

<a id="bossmodifiers"></a>

### `BossModifiers` <small>interface</small>

Source: [`src/config/combatConfig.ts:145`](../../src/config/combatConfig.ts)

What makes a boss fight different (all optional; a boss may carry one to three). The numbers are looked up from the monster's definition during the fight, so tuning them is a config edit.
The browser shows each one as a chip in the fight panel ([`describeModifiers`](monsters.md#describemodifiers), `src/lib/bossModifiers.ts`).

- **Venom**: poison stacks from every landed hit; each stack costs a share of the hero's max HP per second and the hero's regeneration is cut. Ticks in `fightStep`, reported as `poison` events (one per second). No random numbers.
- **Sluggish**: the shared potion cooldown of the fight is longer (`potionCooldownAgainst`).
- **Enrage**: the boss's attack speed rises a step every few seconds (`monsterStats` with the fight's `elapsedSec`).
- **Brutal**: the boss's attack is higher at every level (`monsterStats`).

The win estimate (`estimateWin`) counts all four, so auto-battle does not pick fights it would lose to them.

**Boss modifiers by boss** _(computed from the code)_

| Boss | Biome | Modifiers |
| --- | --- | --- |
| The Elder Stag | forest | **Enrage**: Attacks 12% faster every 15 s of the fight, up to 5 times (+60%). |
| The Mire Matriarch | swamp | **Venom**: Every hit that lands adds a poison stack (up to 5, 8 s): each costs 0.4% of your max HP per second, and your regeneration is cut by 50% while poisoned. |
| The Winter Wyrm | tundra | **Sluggish**: Potions take 50% longer to come off cooldown in this fight. |
| The Ironhorn | hills | **Brutal**: Hits 25% harder. |
| The Reef Leviathan | coast | **Brutal**: Hits 30% harder. |
| The Lake Hydra | lake | **Venom**: Every hit that lands adds a poison stack (up to 4, 8 s): each costs 0.15% of your max HP per second, and your regeneration is cut by 25% while poisoned. |
| The Brainstorm | jungle | **Venom**: Every hit that lands adds a poison stack (up to 4, 8 s): each costs 0.3% of your max HP per second, and your regeneration is cut by 40% while poisoned.<br>**Sluggish**: Potions take 30% longer to come off cooldown in this fight. |
| The Harvest Matron | fields | **Enrage**: Attacks 10% faster every 15 s of the fight, up to 5 times (+50%). |
| The Blossom Reaper | orchard | **Enrage**: Attacks 10% faster every 20 s of the fight, up to 4 times (+40%).<br>**Brutal**: Hits 20% harder. |
| The Eyed Maw | blight | **Venom**: Every hit that lands adds a poison stack (up to 5, 8 s): each costs 0.4% of your max HP per second, and your regeneration is cut by 50% while poisoned.<br>**Sluggish**: Potions take 30% longer to come off cooldown in this fight. |
| The Cinder Warlord | battlefield | **Enrage**: Attacks 10% faster every 20 s of the fight, up to 4 times (+40%).<br>**Brutal**: Hits 20% harder. |

<a id="describemodifiers"></a>

### `describeModifiers` <small>function</small>

Source: [`src/lib/bossModifiers.ts:18`](../../src/lib/bossModifiers.ts)

The chips a boss shows in the fight panel, one per modifier it carries (none for a monster without). Pure text from the config, so a retune needs no edit here.
