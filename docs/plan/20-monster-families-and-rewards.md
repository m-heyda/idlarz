# 20 · Monster families, rewards and spawn pressure (the reward model is built; goods, spawn tables and relics are open)

Reviewed against the code on 2026-11-26. Sections 1, 2, 6 and 7 of the old draft (what existed, the problem, the server changes, the monster UI) are built and removed; **the numbering is kept because code comments cite sections 3 and 8.** Built, and described by the code and its JSDoc: a monster kill pays `min(rewardSec x income, cap) x levelMult^(level - refLevel)` (`MonsterDef.reward` in `src/config/combatConfig.ts`, `killIncome` in `src/lib/loot/kill.ts`, `payKill`), the ticket bank is generic (`TicketBank` holds any monster type), the relevance fade has its first slice (`src/lib/offline/spawnWeights.ts`), grown monsters show a blue frame and a growth bar on the map (`MonsterSprite`). The numbers are measured by `npm run kill-sim` ([kill-sim](../generated/kill-sim.md)).

## 3. The reward model (built; what is left is the goods)

Gold and XP: `min(rewardSec x income per second, cap) x levelMult^(level - refLevel)`, Luck, Gold Find and Kill Rewards % applied after the cap (the player's investment, not the monster's). Normal monsters use `levelMult` 1.08 and a per-biome `rewardSec` and cap, bosses 3600 s, 1.03 and a high cap (the tier tables in `combatConfig.ts`). The owner has not formally approved these numbers; the balance pass (IDL-275, IDL-276) is the place to do it.

**Not built: goods per family (decided).** They replace the single `hideShare` rule of today: a per-kill chance of a small amount of a resource, **by family type**: beasts drop **hide**, herd and humanoid monsters **food or meat**, slimes and the undead **coal** or small extract shards, each with a chance, an amount that scales with the level multiplier and a cap:

```ts
goods: [{ resource: 'hide' | 'food' | 'meat' | 'coal', chance, amount, cap }]
```

Items by tier stay in the loot profile (item level = monster level, the pool by the family's tag); caps never apply to items, they are limited by drop chance, pity and the bag.

## 4. Spawn pressure (partly built)

**Built:** the generic ticket list, and the first slice of the relevance fade (IDL-215): a new monster's type is weighted by the hero's win chance against it (full weight for 40 to 95 %, 0.75 for a trivial monster, the floor 0.1 for a hopeless one, never gone), and the spawn level and growth of a new monster are capped at what the hero still beats.

**Open (IDL-53, release P3.4):** replace the single timer's mix with **spawn tables per distance band**. The bands exist (`DISTANCE_BANDS` in `src/config/distanceBands.ts`: home 1-6, outskirts 7-12, frontier 13-21, wilds 22+) but no spawn rule reads them and `dangerOffset` is 0 everywhere.

- Monsters spawn in every band (today's 2-9 tile limit goes away); weak families stay near the castle (the rat 2-6).
- **Danger offset** replaces `dangerBonus` (+1 level per 8 tiles): home +0, outskirts +2, frontier +5, wilds +9 levels over the castle-window level, capped by the monster's own `spawnWindow.cap`.
- **Weights weak : mid : strong** per band: home 3:2:1, outskirts 2:2:1, frontier 1:2:2, wilds 1:2:4; an outgrown family keeps a relevance factor with floor 0.1.
- The overall rate stays `COMBAT.spawn` (one monster per interval) and the ticket cap stays; only the mix changes. Same placement for the same seed when the new tables equal the old rules. Bosses appear from the frontier (13+) outward, one per biome with its own timer, `minCastleDistance` and `minRebirths`.

## 5. Families (template)

A family entry needs: biome allowlist, distance band, `minRebirths`, level window and `spawnWindow`, stats at `refLevel` with per-level scaling, a `reward` block, `lootSourceId` plus pool tags, `goods` (once built), art (a sprite and a short attack animation; finished images in `public/pixel/enemies/<biome>/<monster-id>.png`, prompts and naming in [monster-art-prompts](monster-art-prompts.md)), and a `taunts` list for bosses. The tests `monsterConfig.test.ts` and `fightBalance.test.ts` and the sims (`fight-sim`, `loot-sim`, `kill-sim`) read the registry, so a new family appears in them without code changes. The 16 current monsters plus the 12 of the hills, coast and lake are the home roster.

## 8. Decisions that are not built yet

- **Relics (decided 2026-11-07, owner; IDL-111, IDL-146; nothing in the code):** one relic per biome boss, 12 in all: Auroch Horn, Stag Antler, Matriarch's Eye, Wyrm Scale, Giant's Knuckle, Leviathan Pearl, Hydra Fang, Colossus Heartwood, Harvest Crown, Treant Blossom, Blight Heart, Warlord's Standard. A boss kill drops its relic with **5 %, pity +1 % per miss up to +10 %**. Relics are held in the ledger (never the save), **survive rebirth** (the T4 tier of [18](18-biome-buildings-and-material-tiers.md)), and are **currency: 5 relics from any bosses exchange at the Vault for a chosen top-tier legendary** (income, building time or kill reward; docs/plan/28-reuse-items-and-stats.md section 2). About a month of play per top legendary. They cannot be sold or traded; `netWorth.ts` prices them at a fixed value; the count is bounded by boss kills times the maximum chance.
- **Biome boss rules (defaults, tuned by sim):** the one-boss-at-a-time timer stays 3 h; a new biome's boss spawns only on that biome's tiles at least 10 tiles beyond the biome's minimum distance; the time limit grows with the tier (75 s plains to 90 s tundra today, then hills 90, coast 95, lake 95, jungle 100, fields 100, orchard 105, blight 110, battlefield 120); HP and attack follow `BIOME_TIER` steps. Set pieces S2 and S3 drop from their biome bosses (IDL-44).

**Still open:** the numbers for goods chance, amount and cap and the relevance floor per band (gold and XP are measured with `kill-sim`).

> **Update 2026-11-27 (first slice of IDL-53, built):** spawn levels rise 4 per rebirth (`rebirthLevelBonus`), normals stand 2 to 40 tiles out (`NORMAL_MAX_DISTANCE`), the frontier and wilds bands add +1 / +2 levels (`DISTANCE_BANDS`), bosses come every 1.5 h (1 h from rebirth 3), and the Ember upgrade Wild Growth shortens the growth interval. Spawn tables with different weights per band are still open.
