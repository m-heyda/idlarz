# Overview: the game as it is today

Idle Realm (code name idlarz) is an idle/incremental map game for signed-in players. This folder describes **only what the code does now**, with the file each number comes from. Plans and drafts live in [../plan/](../plan/ROADMAP.md); [CHANGELOG-audit.md](CHANGELOG-audit.md) lists the open code-side findings of the doc audit.

| Page | Covers |
| --- | --- |
| [economy.md](economy.md) | income, tiles, buildings, castle, farm, merchant, clicks, chests, Luck |
| [combat.md](combat.md) | player stats, the server's fight engine, auto-battle, queue, skills, win chance |
| [monsters.md](monsters.md) | the 16-monster roster, levels, growth, spawning, rewards |
| [loot.md](loot.md) | the loot pipeline, rarities, affixes, sets, sell values |
| [progression.md](progression.md) | levels, attributes, rebirth, Embers, limits |
| [saves-and-server.md](saves-and-server.md) | the save, cloud save checks, the ledger, sealed rolls, away time |

## The loop

1. You start with a castle and the four tiles beside it on an unbounded map, 125 gold and 1,000 gems. Gold, other resources and XP trickle in (`BASE_GENERATION_RATES`, `INITIAL_RESOURCES` in `src/config/economy.ts`).
2. Gold (plus wood, stone, coal, food and hide from tile 15 up) buys adjacent tiles; each becomes a randomly rolled biome and adds income. Buildings stand on tiles and add output. Same-biome neighbours add 25% each.
3. The **castle** is a timed upgrade (level 1-10) that adds a big modifier to every resource, a range bonus on nearby tiles, and a ward from level 7 that keeps monsters out.
4. The **farm** turns food into animals that make meat and small amounts of eggs, milk and hide. The **merchant** buys resources, sells gear and potions, and sells permanent upgrades for gold.
5. **Clicks** on the map and **chests** add active gold. Every level gives attribute points (Strength, Dexterity, Intelligence, Vitality, Charisma) that add income, combat strength, Luck and a tile discount.
6. **Monsters** appear on owned land. You click one and the server runs the fight; wins pay gold, XP, hide and gear. Gear comes only from fights, chests and the merchant's shelf.
7. **Rebirth** (castle 6 and 400+ tiles) restarts the map for Embers: a permanent income bonus and a shop. Level, XP, Embers and shop levels stay; map, gear and merchant upgrades (except Pack Rat) do not.

## Time scale

Timers that set the pace: castle upgrades 30 min to 3.5 days per level (`src/config/castle.ts`); a monster every 15 minutes and a boss every 3 hours (`COMBAT.spawn`); a chest every 10 minutes (`CHEST.intervalSec`); away time paid up to 8 hours at 50% (`LIMITS`). Measured pacing from the bot simulation is in [generated/sim-milestones.md](../generated/sim-milestones.md); targets in [pacing-targets.md](pacing-targets.md).

## Where the numbers live

| Domain | Config | Maths |
| --- | --- | --- |
| Economy | `src/config/economy.ts`, `castle.ts`, `buildings.ts`, `farm.ts`, `merchant.ts`, `biomes.ts`, `biomeRules.ts`, `spawns.ts` | `src/utils/game/*.ts` |
| Combat and monsters | `src/config/combatConfig.ts`, `distanceBands.ts` | `src/lib/combat.ts`, `monsters.ts`, `src/lib/offline/fight*.ts`, `winChance.ts` |
| Loot and items | `src/catalog/lootConfig.ts`, `rarity.ts`, `affixes.ts`, `stats.ts`, `sets.ts`, `items/*` | `src/lib/loot/*`, `itemInstance.ts` |
| Progression | `src/config/character.ts`, `rebirth.ts`, `limits.ts` | `src/utils/game/character.ts`, `rebirth.ts`, `src/lib/limits.ts` |
| Server | `src/lib/cloudSave/verify.ts` (`VERIFY`, `FLAG_POLICY`), `xpModel.ts` | `src/lib/offline/*`, `src/app/api/*` |

Generated reports (do not edit by hand, `npm run docs:gen`): [balance-tables](../generated/balance-tables.md), [item-catalog](../generated/item-catalog.md), [fight-sim](../generated/fight-sim.md), [monster-ladder](../generated/monster-ladder.md), [loot-sim](../generated/loot-sim.md), [kill-sim](../generated/kill-sim.md), [spawn-mix](../generated/spawn-mix.md), [stat-audit](../generated/stat-audit.md), [sim-milestones](../generated/sim-milestones.md).

## What is not in the game yet

Hills, coast and lake monsters; jungle, fields, orchard, blight and battlefield biomes (dev-only entries); the Producer/Extractor/Idol building rework; crafting; quests; gambling; achievements, glossary and mastery; real class bonuses; paragon levels; rankings and the preview map; landing page and `/play` route; the guided tutorial rework; gem sinks. Details: [plan/ROADMAP.md](../plan/ROADMAP.md).
