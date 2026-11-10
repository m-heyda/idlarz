# Overview

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

What the game is and how the loop fits together.

**Contents**

- The game: [The game at a glance](#the-game-at-a-glance), [Conventions](#conventions)

## The game

<a id="the-game-at-a-glance"></a>

### The game at a glance

Source: [`src/app/GameApp.tsx:17`](../../src/app/GameApp.tsx)

Idle Realm (code name idlarz) is an idle/incremental map game for signed-in players. Everything here describes **only what the code does now**, with the symbol each number comes from.

**The loop of the game**

1. You start with a castle and the four tiles beside it on an unbounded map, 125 gold and 1,000 gems. Gold, other resources and XP trickle in ([`BASE_GENERATION_RATES`](economy.md#base-generation-rates)).
2. Gold (plus wood, stone, coal, food and hide from tile 15 up) buys adjacent tiles ([`tilePrice`](economy.md#tileprice)); each becomes a randomly rolled biome ([`rollBiome`](economy.md#rollbiome)) and adds income. Same-biome neighbours add 25% each.
3. The **castle** is a timed upgrade (level 1-10) that adds a big modifier to every resource, a range bonus on nearby tiles, and a ward from level 7 that keeps monsters out ([`CASTLE_UPGRADE`](economy.md#castle-upgrade)).
4. The **farm** turns food into animals that make meat and small amounts of eggs, milk and hide ([`ANIMALS`](economy.md#animals)). The **merchant** buys resources, sells gear and potions, and sells permanent upgrades for gold ([`MERCHANT_UPGRADES`](economy.md#merchant-upgrades)).
5. **Clicks** on the map and **chests** add active gold ([`clickGold`](economy.md#clickgold), [`CHEST`](economy.md#chest)). Every level gives attribute points (Strength, Dexterity, Intelligence, Vitality, Charisma) that add income, combat strength, Luck and a tile discount ([`CHARACTER_STAT_CONFIG`](progression.md#character-stat-config)).
6. **Monsters** appear on owned land ([`advanceBank`](monsters.md#advancebank)). You click one and the server runs the fight ([`runCombat`](combat.md#runcombat)); wins pay gold, XP, hide and gear ([`killIncome`](monsters.md#killincome), [`generateLoot`](loot.md#generateloot)). Gear comes only from fights, chests and the merchant's shelf.
7. **Rebirth** (castle 6 and 400+ tiles) restarts the map for Embers: a permanent income bonus and a shop ([`REBIRTH`](progression.md#rebirth)). Level, XP, Embers and shop levels stay; map, gear and merchant upgrades (except Pack Rat) do not.

**Time scale.** Timers that set the pace: castle upgrades 30 min to 3.5 days per level; a monster every 15 minutes and a boss every 3 hours (`COMBAT.spawn`); a chest every 10 minutes (`CHEST.intervalSec`); away time paid up to 8 hours at 50% (`LIMITS`).
Measured pacing from the bot simulation is in `docs/generated/sim-milestones.md`; targets are on the Pacing page.

**Where the numbers live.** Config is data (`src/config/*`, `src/catalog/*`), maths is pure functions next to it (`src/utils/game/*`, `src/lib/*`), the server engine is `src/lib/offline/*` + `src/app/api/*`. This reference points at all of them; the generated
[code-map.md](code-map.md) lists every file with its first comment.

**Not in the game yet**: hills, coast and lake monsters; jungle, fields, orchard, blight and battlefield biomes (dev-only entries); the Producer/Extractor/Idol building rework; quests; gambling; achievements, glossary and mastery;
paragon levels; rankings and the preview map; landing page and `/play` route; the guided tutorial (built, dark until the new chapter flips); gem sinks. Details: `docs/plan/ROADMAP.md`. Crafting (queue, recipes) exists but is still a first draft: `docs/plan/crafting-v0.md`.

**Stack (versions from package.json)** _(computed from the code)_

| Package | Version |
| --- | --- |
| `next` | 15.5.28 |
| `react` | ^19.0.0 |
| `tailwindcss` | ^4.0.11 |
| `zustand` | ^5.0.3 |
| `@supabase/supabase-js` | ^2.118.0 |
| `@supabase/ssr` | ^0.12.7 |
| `typescript` | ^5 |
| `eslint` | ^9 |
| `tsx` | ^4.23.15 |
| `@playwright/test` | 1.65.0 |
| `prettier` | 3.3.3 |

<a id="conventions"></a>

### Conventions

Source: [`src/app/GameApp.tsx:2`](../../src/app/GameApp.tsx)

Conventions that hold for the whole code base.

- Rates are per second and before modifiers unless stated; modifiers are fractions (0.25 = +25 %).
- Anything that moves resources is validated in the store action and covered in `tests/economy/economy.test.ts`; anything that is saved is validated in `src/lib/sanitizeSave.ts` ([`sanitizeSave`](saves-and-server.md#sanitizesave));
  anything that decides a reward or a fight lives on the server side (`src/lib/offline/`).
- **Documentation lives in the JSDoc next to the code** (this reference is generated from it, see the README of this folder). When the code changes, change its block in the same edit; a pre-commit hook regenerates `docs/reference`.
  `docs/plan/` holds the plans for what is not built; a built draft leaves `plan/` and is described here, in the JSDoc.
- Config is data, maths is pure functions. Tutorial, stat tooltips and cost lists are generated from config constants so they cannot drift from the rules.
- Reports measured from the game (`docs/generated/*`, written by `npm run docs:gen`) are never edited by hand; prefer a link to them over copying numbers into prose, and prefer `@table` over numbers typed into JSDoc.
