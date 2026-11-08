# Loot decisions not built yet

Loot decisions of 2026-11-07 that the code does not do yet. The loot system as built is [game/loot.md](../game/loot.md). Moved here from the old `10-loot-system.md` when `docs/` was split into `game/`, `plan/` and `ops/`.

## Perk families and caps (decided 2026-11-07, IDL-149; sim checks pending)

Legendary perks and set bonuses use the same families. Each percent family is its own `(1 + sum)` bucket ([25](25-idle-game-research.md) item 12); the gear bucket (sets plus legendary perks) is clamped at the family cap. **Offline efficiency (points) and offline cap (hours) are not multipliers: they add to the base value (50 % and 8 h) and the sum is clamped by `HARD_LIMITS` (100 % and 72 h)**, so +8 points on a 50 % base is 58 %. Tier magnitudes are fixed numbers, they do not scale with item level.

| Family | Common | Rare | Top | Gear cap | Combines with |
| --- | --- | --- | --- | --- | --- |
| Income | 8 % | 15 % | 25 % | 50 % | Embers (`0.1 × earned^0.6`), Paragon: separate buckets |
| XP | 8 % | 15 % | 25 % | 40 % | Paragon account bucket |
| Kill reward | 8 % | 15 % | 25 % | 60 % | Luck / Gold Find apply after the monster reward cap |
| Click gold | 8 % | 15 % | 25 % | 40 % | click Idol |
| Damage | 4 % | 6 % | 10 % | 45 % | S2 38, S3 40 at 14 pieces; the damage legendary is a main-hand weapon, so wearing it costs the 14th set piece (the 12-piece tier, S2 28 and S3 30, plus 10 = 38 and 40), below the cap |
| Offline efficiency | 8 | 15 | 25 points | HARD_LIMITS 100 % | Steward, Night Watch |
| Offline cap hours | +2 h | +4 h | +6 h | HARD_LIMITS 72 h | Ember shop |
| Max HP | 8 % | 15 % | 25 % | 50 % | attributes |
| Building time | 8 % | 15 % | 25 % | -60 % combined | Embers (Builders, max -50 %) and Idols; tooltip shows the capped total |
| Chest interval | 8 % | 15 % | 25 % | -40 %, floor 8 min | chest Idol, Beacon potion |

Which items carry what: see [28](28-reuse-items-and-stats.md) section 6 (11 legendaries, one headline family each, two launch handlers). The Rattatui set is removed (IDL-55); sets S1-S3 carry the set bonuses of [28](28-reuse-items-and-stats.md) section 10.

## Monster chests (decided 2026-11-07, IDL-163; not built)

A kill sometimes drops a **chest item** into the bag, opened later from the inventory (`open` op on `/api/inventory`).

- **No keys in v1.** A chest opens free; keys can return later for locked Royal chests.
- **Drop chance:** 2 % per normal kill, a boss always drops its Royal chest, a golden monster drops an Arcane chest. Always `placement: 'extra'`, never `replace`.
- **Tiers by biome:** Wooden (home), Iron Strongbox, Mossy, Coral, Frost, Magma as the biomes arrive; Royal (boss) and Arcane (golden) on top. Chest level = the dropping monster's level, capped.
- **Contents:** gear, potions (including buffs), materials, XP orbs and gold, from the existing loot pipeline. **No permanent stat gifts. No gems** (gem sources stay achievements and the daily bonus, IDL-188/194). Legendary rolls stay inside the legendary rules ([28](28-reuse-items-and-stats.md) section 6).
- **Safety:** the roll is sealed on a counter (a reload cannot reroll); gold is recorded as `granted`; a full bag converts the chest to its sell value; "Sell common" never sweeps chests.
- **Budget:** the expected value of chests must stay at 10 % of hourly income or less at every tier; `loot-sim` gets a chest-tier table and fails the check above that.

## Not done yet (kept on purpose)

Salvage / materials and reroll / upgrade (real gear sinks), set bonuses that follow the item level (today a set bonus is a fixed amount, bigger on purpose so it matters before the first rebirth), `requiredLevel`, elite monsters and premium chests, and rebalancing the monsters with the world level (see [ROADMAP](ROADMAP.md)).
