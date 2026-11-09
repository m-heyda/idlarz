# Monsters

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The roster, levels, growth, spawning and what a kill pays.

**Contents**

- Roster: [`MONSTERS`](#monsters)
- Level scaling: [`monsterStats`](#monsterstats), [`spawnLevelRange`](#spawnlevelrange), [`rollSpawnLevel`](#rollspawnlevel), [`levelAtAge`](#levelatage), [`dangerBonus`](#dangerbonus)
- Spawning: [`advanceBank`](#advancebank), [`canSpawnOn`](#canspawnon), [`typeWeights`](#typeweights), [`placeTickets`](#placetickets), [`ticketCap`](#ticketcap), [`DISTANCE_BANDS`](#distance-bands), [`bandOf`](#bandof)
- Rewards: [`killIncome`](#killincome)

## Roster

<a id="monsters"></a>

### `MONSTERS` <small>const</small>

Source: [`src/config/combatConfig.ts:350`](../../src/config/combatConfig.ts)

The roster: 16 monsters in four biomes, three normal ones and a boss each. Plains, forest, swamp and tundra only; hills, coast and lake have none (a monster may only stand on a biome in its `spawn.biomes`).
Stats are at level 1 (bosses at their `refLevel`), straight from [`monsterStats`](monsters.md#monsterstats); speed is attacks per second; the spawn window shows castle level 1 to castle level 10.

- Builds (`BUILD`): even x1 HP x1 attack, speed 0.5; tough x1.3 HP x0.8 attack, 0.4; fierce x0.8 HP x1.25 attack, 0.6; elite x2 HP x1.5 attack, 0.45, +8 armor.
- Normal monsters never crit (`critChance` 0, `critMult` 1.5, no Stun resistance). Bosses: crit 8 / 9 / 10 / 13 %, Stun resistance 20 / 25 / 30 / 45 %, time limit 75 / 80 / 85 / 90 s, one hit every 3 s (`BIOME_TIER`).
- Tier numbers per biome (`BIOME_TIER`): plains HP 100 attack 4; forest 160 / 6; swamp 220 / 7; tundra 300 / 8.
- The ladder against gear: `docs/generated/monster-ladder.md`.

**The roster (level 1 stats; bosses at their reference level)** _(computed from the code)_

| Biome | Monster | Ref. level | HP | Attack | Armor | Speed / s | Spawn level window (castle 1 -> castle 10) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plains | Thistle Boar | 1 | 100 | 4 | 0 | 0.5 | 1-3 -> 8-10 |
| plains | Burrow Badger | 1 | 130 | 3 | 0 | 0.4 | 1-3 -> 8-10 |
| plains | Dust Strider | 1 | 80 | 5 | 0 | 0.6 | 1-3 -> 8-10 |
| plains | The Great Auroch (boss) | 15 | 1,000 | 11 | 15 | 0.33 | 15-18 -> 22-25 |
| forest | Mossback Wolf | 1 | 128 | 8 | 1 | 0.6 | 4-6 -> 12-14 |
| forest | Bramble Imp | 1 | 160 | 6 | 1 | 0.5 | 4-6 -> 12-14 |
| forest | Rotcap Stag | 1 | 208 | 5 | 1 | 0.4 | 4-6 -> 12-14 |
| forest | The Elder Stag (boss) | 20 | 1,900 | 16 | 24 | 0.33 | 20-23 -> 27-30 |
| swamp | Garbage Ogre | 1 | 286 | 6 | 2 | 0.4 | 8-10 -> 16-18 |
| swamp | Dumpback | 1 | 220 | 7 | 2 | 0.5 | 8-10 -> 16-18 |
| swamp | Rot Heron | 1 | 176 | 9 | 2 | 0.6 | 8-10 -> 16-18 |
| swamp | The Mire Matriarch (boss) | 25 | 2,800 | 21 | 32 | 0.33 | 25-28 -> 32-35 |
| tundra | Frost Hare | 1 | 240 | 10 | 3 | 0.6 | 12-14 -> 16-18 |
| tundra | Icetusk Calf | 1 | 390 | 6 | 3 | 0.4 | 12-14 -> 16-18 |
| tundra | Rime Wraith | 1 | 600 | 12 | 11 | 0.45 | 12-14 -> 16-18 |
| tundra | The Winter Wyrm (boss) | 30 | 7,000 | 36 | 58 | 0.33 | 30-33 -> 37-40 |

## Level scaling

<a id="monsterstats"></a>

### `monsterStats` <small>function</small>

Source: [`src/lib/monsters.ts:117`](../../src/lib/monsters.ts)

HP, attack, armor, crit and stun resistance of a monster at a level (the reward is `monsterReward`).

Level scaling: a monster has an integer level. Stats follow `monsterStats`.

- **Normal** (`scaling: 'exp'`): `HP = round(hp x sqrt(1.5)^(level-1))`, `attack = round(attack x sqrt(1.25)^(level-1))`, `armor = armor + 0.5 x (level-1)`. A level 9 plains monster has 506 HP.
- **Boss** (`scaling: 'gear'`): HP and attack `x levelScale(level) / levelScale(refLevel)` (`1 + 0.07 x (level - 1)`, `src/catalog/stats.ts`); armor `+0.5` per level away from `refLevel`. The plains boss has 1,000 HP and 11 attack at level 15.
- Reference levels: plains 15, forest 20, swamp 25, tundra 30.

**Formula**

```text
normal: HP     = round(hp     x sqrt(1.5)^(level - 1))
        attack = round(attack x sqrt(1.25)^(level - 1))
        armor  = armor + 0.5 x (level - 1)
boss:   HP, attack = base x levelScale(level) / levelScale(refLevel)         levelScale(L) = 1 + 0.07 x (L - 1)
        armor  = armor + 0.5 x (level - refLevel)
```

<a id="spawnlevelrange"></a>

### `spawnLevelRange` <small>function</small>

Source: [`src/lib/monsters.ts:39`](../../src/lib/monsters.ts)

The levels a new monster of this type can appear at in a world of this castle level (both ends included).

Spawn window. Plains normal: base 1, +1 per castle level, spread 2, cap 10; forest 4/+1/2/14; swamp 8/+1/2/18; tundra 12/+0.5/2/20. Bosses: base 15 / 20 / 25 / 30, +0.8 per castle level, spread 3, cap 25 / 30 / 35 / 40.

**Formula**

```text
min = max(1, min(cap - spread, base + floor(perCastleLevel x (castle level - 1))))
max = min(cap, min + spread)
```

<a id="rollspawnlevel"></a>

### `rollSpawnLevel` <small>function</small>

Source: [`src/lib/monsters.ts:56`](../../src/lib/monsters.ts)

The level a new monster starts at. Rolled from a generator seeded by its id and nothing else, so it takes no number from
Math.random (the rest of the game's randomness is the same with or without it) and the same monster always rolls the same.
`levelCap` (optional) is the highest level the player can still beat (see offline/spawnWeights.ts): a roll above it comes down to it, never below `min`.

The level is rolled from a generator seeded by the monster's ticket number only, plus a **danger bonus** of 1 level per 8 tiles of Chebyshev distance from the castle ([`dangerBonus`](monsters.md#dangerbonus), `COMBAT.spawn.dangerStep`).
The per-band `dangerOffset` in `DISTANCE_BANDS` is 0 everywhere and unused.

<a id="levelatage"></a>

### `levelAtAge` <small>function</small>

Source: [`src/lib/monsters.ts:93`](../../src/lib/monsters.ts)

The level of a monster of this age: its spawn level plus one per growth interval, up to the growth limit.

Growth: +1 level per 1,800 s on the map (`LIMITS.monsterGrowthIntervalSec`), at most +10 above the spawn level (`LIMITS.monsterGrowthLevels`, hard 40). The level is a function of age.
A monster whose spawn was capped for a weak player has a smaller `growCap`.

**Formula**

```text
level = spawnLevel + min(growthLevels, floor(ageSec / 1800))
```

<a id="dangerbonus"></a>

### `dangerBonus` <small>function</small>

Source: [`src/lib/monsters.ts:74`](../../src/lib/monsters.ts)

Levels added to a monster that appears `distance` tiles (Chebyshev) from the castle: danger grows toward the frontier.

**Formula**

```text
danger bonus = floor(Chebyshev distance from the castle / 8) levels
```

## Spawning

<a id="advancebank"></a>

### `advanceBank` <small>function</small>

Source: [`src/lib/offline/tickets.ts:142`](../../src/lib/offline/tickets.ts)

Runs the timers for `dtSec` seconds and mints the tickets that come due, in the order they come (a chest every ~10 minutes
(shorter with Luck), a normal monster every 15, the first after 2, a boss every 3 hours while none waits), as long as there is room.
With no room the chest and rat timers sit at 0, like the client's own timers. `rollFor(kind, n)` gives the random source of ticket
`n` (the server seals it with a secret; tests pass a seeded one) and decides whether a rat is lucky.

`realDtSec` is the real time the `dtSec` stand for: an absence is credited at a share of its length (the efficiency), but the
tickets are stamped across the whole real stretch so that they have the ages they would have had.

Where and when monsters appear (server only).

- **Timers** (`COMBAT.spawn`): the first normal monster 120 s after the run starts, then one per 900 s; one boss at a time, 10,800 s after the last one left (or after the start). The timers pause when the map has no room or no free tile for it.
- **Room**: monsters and chests together hold at most 30% of the free tiles, at least 2, at most 40 tickets ([`ticketCap`](monsters.md#ticketcap), `SPAWN_LIMIT`, `TICKET_CAP`).
- **Golden (lucky) monsters**: chance `min(10%, 2% + 0.05% x Luck)` per new normal monster; a kill pays x3 gold, XP and hide and adds one guaranteed gear roll (`LUCK.luckyRat`). Bosses are never golden.

<a id="canspawnon"></a>

### `canSpawnOn` <small>function</small>

Source: [`src/lib/monsters.ts:150`](../../src/lib/monsters.ts)

Whether a monster of this type may stand on this tile: the biome is on its allowlist, the tile is within its castle distance
(Chebyshev), and nothing else is there (castle ward, building, chest, another monster). The rules are `MonsterDef.spawn`.

The tile: an owned tile whose biome is in the monster's list (`MonsterDef.spawn`), Chebyshev distance from the castle 2 to 9 (`minCastleDistance`, `maxCastleDistance`), no building, no chest, no other monster,
outside the castle ward from castle level 7. `minRebirths` exists in the rule but no monster uses it.

<a id="typeweights"></a>

### `typeWeights` <small>function</small>

Source: [`src/lib/offline/spawnWeights.ts:49`](../../src/lib/offline/spawnWeights.ts)

Weight of each type for this player and castle level, in the order given.

Which type spawns. Each type is weighted by the player's win chance against it ([`estimateWin`](combat.md#estimatewin)) at the middle of its spawn window: full weight (1) for 40-95%, falling to 0.75 for a trivial monster (chance 1)
and to 0.1 for a hopeless one (chance <= 5%); equal weights give the plain uniform pick. The spawn level is capped at the highest level the player still beats (never below the window's bottom) and so is its growth (`growCap`),
for new spawns only. Bosses are never weighted or capped: among the boss types that still have a free tile the pick is uniform ([`placeTickets`](monsters.md#placetickets)). Measured: `docs/generated/spawn-mix.md`.

<a id="placetickets"></a>

### `placeTickets` <small>function</small>

Source: [`src/lib/offline/placement.ts:75`](../../src/lib/offline/placement.ts)

Looks at the land: counts the tiles each kind may stand on, takes a monster or chest off a tile that stopped being valid (it is placed
again), and gives every waiting monster a tile and the level it appears at and every waiting chest a tile. Tickets with no tile left stay hidden until the land
grows. `rollFor('spawnpos', n)` picks the tile of monster ticket `n` and `rollFor('chestpos', n)` the one of chest `n` (the server seals
them with a secret; tests pass a seeded one). A chest leans toward the edge of the land and away from other chests (`pickChestSpot`).
With the player's profile (`hero`) a new monster's type is weighted by how beatable it is (spawnWeights.ts) and its level and growth are capped
near what the player can beat; without it every type is equally likely and nothing is capped. Bosses are never weighted or capped.

Bosses are placed with a uniform pick among the boss types that still have a free tile, while normal monsters are weighted by win chance.

**Known issues**

- IDL-222 bosses are never weighted by win chance (a uniform pick); needs an owner decision.

<a id="ticketcap"></a>

### `ticketCap` <small>function</small>

Source: [`src/lib/offline/tickets.ts:102`](../../src/lib/offline/tickets.ts)

How many more tickets may wait: the same share of the free land as the client's own spawn limit (monsters and chests together),
estimated from the owned tiles because the server never opens the map, and never more than `TICKET_CAP` per kind.

The room for new tickets: monsters and chests together hold at most 30% of the free land, at least 2, at most 40 tickets in all.

**Known issues**

- IDL-221 `ticketCap` estimates free land as `owned - 1 - buildings - ward` and does not subtract lakes.

<a id="distance-bands"></a>

### `DISTANCE_BANDS` <small>const</small>

Source: [`src/config/distanceBands.ts:25`](../../src/config/distanceBands.ts)

Distance bands: home 1-6, outskirts 7-12, frontier 13-21, wilds 22+, read by [`bandOf`](monsters.md#bandof). No spawn rule reads them yet.

<a id="bandof"></a>

### `bandOf` <small>function</small>

Source: [`src/lib/distance.ts:13`](../../src/lib/distance.ts)

The band a castle distance falls in. Anything below the first band (the castle tile itself) or NaN is the first band.

## Rewards

<a id="killincome"></a>

### `killIncome` <small>function</small>

Source: [`src/lib/loot/kill.ts:51`](../../src/lib/loot/kill.ts)

Rewards for a kill. Gold and XP are "seconds of income" (like chests) so they scale with the economy. The items come from
the shared loot pipeline (`generateLoot`): the monster's loot profile decides how many rolls, which rarities and which
item level; this adapter only adds the gold and XP and keeps the call the game and the tests have always made.

What a kill pays. Luck, Gold Find and Kill Rewards are applied after the cap, so pay can exceed it. Minimums: 10 gold, 5 XP (`COMBAT.rewards`). `levelMult` is 1.08 per level for normal monsters and 1.03 for bosses.
Items: see [`generateLoot`](loot.md#generateloot). Measured share of income: `docs/generated/kill-sim.md`.

**Formula**

```text
goldBase = min(gold/s x rewardSec, goldCap) x levelMult^(level - refLevel)
gold     = floor(max(10, goldBase x (1 + 0.005 x Luck) x (1 + Gold Find%)) x (lucky ? 3 : 1) x (1 + Kill Rewards%))
xp       = max(5, min(xp/s x rewardSec, xpCap) x levelMult^(level - refLevel)) x (lucky ? 3 : 1) x (1 + Kill Rewards%)      (xp/s includes the XP gain %)
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
