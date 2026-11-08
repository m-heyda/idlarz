# 20 · Monster families, rewards and spawn pressure (reward model built: IDL-182)

How the monster system grows from "rats and one king" to three or four monsters plus a boss per biome ([12](12-rebirth-biomes.md)), with a reward model in which **low-level monsters stop mattering as the player grows** and high-level monsters pay much more, in gold, in basic goods and in tiered items.

## 1. What exists (read from the code)
- `MONSTERS` in `config/combatConfig.ts`: `rat` and `ratKing` (a boss). A `MonsterDef` carries stats per `refLevel`, per-level scaling, `spawnWindow` (the level range by castle level), `spawn` (biomes, castle distance, `minRebirths`), `rewardSec`, `lootSourceId`.
- **A kill pays seconds of the player's current income**: gold = `min(rewardSec x gold/s, cap)`, XP likewise, times `levelMult^(level - refLevel)` (`reward` block of `MonsterDef`, `lib/loot/kill.ts`, `payKill` in `lib/offline/reward.ts`); `COMBAT.rewards.minGold` 10 and `minXp` 5 are floors, hide = a share (`hideShare` 0.6) of the hide rate. Luck, Gold Find and the set's Kill Rewards % apply after the cap. See section 8 for the numbers.
- Spawn: one rat ticket per 900 s, a boss per 10,800 s (`COMBAT.spawn`), at most `min(40, 30 % of the free land)` tickets; the level comes from `spawnWindow` by castle level plus the distance danger bonus. A monster grows one level per 30 minutes up to +10 (`LIMITS`).
- Loot: `LOOT_SOURCES` profiles (`catalog/lootConfig.ts`): rolls, rarity weights, item level window, pools; `bonusTables` for potions.

## 2. The problem to solve
Because a kill pays *seconds of current income*, a low-level monster keeps paying a share of a huge income forever, and more monster types would multiply that. We want: weak monsters irrelevant later, strong ones worth hunting, no flood of cheap kills.

## 3. The reward model (decided: `min(income share, cap) x level multiplier`)

Every family gets an absolute reward block next to the income-based one, and the **cap** decides which monsters stay relevant:

```ts
reward: {
  gold: { rewardSec, cap },          // pays min(rewardSec x gold/s, cap), then x levelMult
  xp:   { rewardSec, cap },
  goods: [{ resource: 'hide' | 'food' | 'meat', chance, amount, cap }],   // small, per kill, capped
  levelMult: 1.17,                    // per monster level above refLevel (today rewardPerLevel)
}
```

- `gold = min(rewardSec x gold/s, cap) x levelMult^(level - refLevel)` (same for XP). Early the income is small, so `rewardSec` decides (as today); later the **cap** decides, so a rat that paid 90 s of income at day 1 pays a flat, small amount at day 30. A boss has a much higher cap and level multiplier, so it stays valuable.
- `goods` are the "some hide or food and gold" of the idea, **by family type (decided)**: beasts drop **hide**, herd and humanoid monsters **food/meat**, slimes and the undead **coal** or small T2 shards, each with a per-kill chance, an amount that scales with the level multiplier, and a cap. They replace the single `hideShare` rule.
- **Items by tier** stay in the loot profile: item level = monster level, the pool is picked by the family's tag (beast leather, blight cores, battlefield steel), so a higher-level monster drops higher-tier items. Caps never apply to items; they are limited by drop chance, pity and the bag.
- Luck, Gold Find and Kill Rewards % multiply after the cap (they are the player's investment, the cap is the monster's).
- The numbers are placeholders until a sim exists: first targets, kill income stays a small share of total income (BL12) and the per-kill gold of the weakest family falls below about 1 % of a 10-minute income by the middle of a run.

## 4. Spawn pressure (do not flood the map)
- Replace the single rat timer with **spawn tables per distance band** ([12](12-rebirth-biomes.md) `DISTANCE_BANDS`): each band lists families with weights and level windows; a ticket first picks a band-compatible tile, then a family by weight. The overall rate stays `COMBAT.spawn` (one monster per interval) and the ticket cap stays; only the mix changes.
- **Relevance fade (decided: rarer only, never gone)**: a family whose maximum spawn level is below the castle-based window gets its weight multiplied by a `relevance` factor that falls with the level gap down to a floor (proposal 0.1), so outgrown monsters still turn up now and then but no longer fill the map. The rat is the first. Rats stay near the castle (distance 2-6).
- Weak families spawn **less often** as the player advances (weight x `relevance`), while higher-level families keep or raise their weight, so the map fills with what is worth fighting.
- Bosses: one per biome, own timer and own `minCastleDistance`, `minRebirths` (the Rat King pattern).

## 5. Families (placeholders to fill later)
Each biome: 3-4 monsters and a boss, names and stats open ([12](12-rebirth-biomes.md) section 5). A family entry needs: biome allowlist, distance band, `minRebirths`, level window and `spawnWindow`, stats at `refLevel` with per-level scaling, `reward` block above, `lootSourceId` plus pool tags, `goods`, art (sprite and a short attack animation; finished images live in `public/pixel/enemies/<biome>/<monster-id>.png`, prompts and naming in [monster-art-prompts](monster-art-prompts.md)), and a `taunts` list for bosses. The tests `monsterConfig.test.ts`, `fightBalance.test.ts` and the sims (`fight-sim`, `loot-sim`) read the registry, so a new family appears in them without code changes.

## 6. Server changes
1. Generic ticket list in `player_ledger.bank`: `{ n, type, at, x, y, spawnLevel, lucky }` instead of `rats` and `king` (`upgradeBank` reads old rows; no data migration needed, a lazy read).
2. `payKill` takes the type from the ticket and the reward block from the registry; the kill roll stays sealed per kill number.
3. `placement.ts` `typeOf`, `spawnTiles` and `winChance`/`fight` already take a monster type; the hard-coded `'rat' | 'king'` unions go.
4. Offline: the "monsters that would have appeared" count uses the same tables.
5. No SQL. Save: monster tickets are server-owned; the save only draws them, so old saves are unaffected.

## 7. Monster UI rework (quick win, see the ROADMAP)
Monsters grow in level on the map but look the same at every age. The first UI step needs no server change: a **blue frame and glow on the level badge at the maximum level**, a small **progress ring to the next level**, and a tooltip with "Level N of M, grows in X min". The same badge later carries the other states (boss skull, lucky gold, unknown black, [22](22-glossary-and-mastery.md)) and, once the reward model exists, a hint that a grown monster pays more.

## 8. Decisions and open questions

**Decided (2026-10-29):**
- Reward shape: gold and XP = `min(rewardSec x income, cap) x levelMult^(level - refLevel)`.
- Outgrown monsters become rarer (floor weight, proposal 0.1) but never stop spawning.
- Goods by family type (beasts hide, herd/humanoid food or meat, slimes/undead coal or small T2 shards).
- **T4 relics** come from the biome bosses (a small drop chance each) and **survive rebirth**, because they are rare and boss-gated ([18](18-biome-buildings-and-material-tiers.md)).
- **Relics (decided 2026-11-07, owner; IDL-111, IDL-146; not built, nothing in code yet):** one relic per biome boss, 12 in all: Auroch Horn, Stag Antler, Matriarch's Eye, Wyrm Scale, Giant's Knuckle, Leviathan Pearl, Hydra Fang, Colossus Heartwood, Harvest Crown, Treant Blossom, Blight Heart, Warlord's Standard. A boss kill drops its relic with **5 %, pity +1 % per miss up to +10 %**. Relics are held in the ledger (never the save), survive rebirth, and are **currency: 5 relics from any bosses exchange at the Vault for a chosen top-tier legendary** (income, building time or kill reward; docs/plan/28-reuse-items-and-stats.md section 6). About a month of play per top legendary. They cannot be sold or traded; `netWorth.ts` prices them at a fixed value; the count is bounded by boss kills times the maximum chance.
- **Biome boss rules (defaults, tuned by sim):** the one-boss-at-a-time timer stays 3 h; a new biome's boss spawns only on that biome's tiles at least 10 tiles beyond the biome's minimum distance; the time limit grows with the tier (75 s plains to 90 s tundra today, then hills 90, coast 95, lake 95, jungle 100, fields 100, orchard 105, blight 110, battlefield 120); HP and attack follow `BIOME_TIER` steps. Set pieces S2 and S3 drop from their biome bosses (IDL-44).
- **Spawn tables per distance band (decided 2026-11-07, owner; IDL-53, IDL-13):** `DISTANCE_BANDS` home 1-6, outskirts 7-12, frontier 13-21, wilds 22+ (one config, read by monsters, chests and biomes). Monsters spawn in every band (today's 2-9 tile limit goes away). **Danger offset** (planned; today `dangerOffset` is 0 in every band and unread, and `dangerBonus` rules) replaces `dangerBonus` (+1 level per 8 tiles): home +0, outskirts +2, frontier +5, wilds +9 levels over the castle-window level, capped by the monster's own `spawnWindow.cap`. **Weights weak : mid : strong** per biome: home 3:2:1, outskirts 2:2:1, frontier 1:2:2, wilds 1:2:4; an outgrown family keeps a relevance factor with floor 0.1 (rarer, never gone). Bosses appear from the frontier (13+) outward. Same placement for the same seed when the new tables equal the old rules; the ROADMAP R7 row is deleted in the same PR.
- **First slice of the relevance fade (IDL-215, built):** the server weights the type of a new monster by the win chance of the player's profile against it at the middle of its castle-level window (`offline/spawnWeights.ts`): full weight for 40-95 %, fading to 0.75 for a trivial monster and to the floor 0.1 for a hopeless one (never gone). The spawn level of a new rat is capped at the highest level the hero still beats (never below the window's bottom), and so is its growth (`growCap` on the ticket, new spawns only). Bosses, timers and `ticketCap` are untouched; a player nothing can hurt gets exactly the old uniform pick. Measured in [spawn-mix](../generated/spawn-mix.md): a level 1-10 hero in the starter kit at castle 1 sees about 70 % of spawns with a win chance above 50 % (26-34 % before). The per-band weights and danger offsets above are still to do (P3.4).
- **IDL-54 (home families beyond 16) is closed as superseded:** the 16 current monsters plus the 12 hills/coast/lake monsters of IDL-201 are the home roster.

- **Reward model, built and numbers (IDL-49 decision 2026-11-07, IDL-182; the numbers await the owner's approval):**
  - `MonsterDef.reward = { gold: { rewardSec, cap }, xp: { rewardSec, cap }, levelMult }` replaces the flat `rewardSec` / `rewardPerLevel`. `killIncome` (`lib/loot/kill.ts`, used by `payKill`): `gold = min(goldPerSec x rewardSec, cap) x levelMult^(level - refLevel)`, XP the same; **Luck, Gold Find and Kill Rewards % apply after the cap** (so the pay can exceed the cap by the player's investment). Hide stays a share of the farm's hide for the (uncapped) reward seconds until goods per family are built.
  - Normal monsters: `levelMult` **1.08** (was 1.17; a level 20 monster pays 4.3x a level 1 kill instead of 19.7x). `rewardSec` stays per biome (plains 90, forest 110, swamp 135, tundra 190), so early pay is as before. **Gold cap** (at level 1, per kill, before the level multiplier): plains 300, forest 600, swamp 1,200, tundra 2,400; **XP cap**: a seventh of that (42 / 85 / 171 / 342).
  - Bosses are unchanged (3600 s, 1.03 per level) with a **high cap**: 600,000 gold and 45,000 XP at their `refLevel`. It binds from about castle level 5 (income about 300 gold/s), so a boss stops growing with the income there; before that it pays 3600 s of income as before.
  - Measured with `npm run kill-sim` ([kill-sim](../generated/kill-sim.md)): kill income (every monster the hero can beat is killed, spawns weighted by win chance) is about 15-17 % of the income at castle levels 3-5 (mostly the bosses, a few percent from normal monsters), and fades to 5 % at castle 7 and about 2 % at castle 9, where the caps bind. The weakest monster pays under 1 % of a 10-minute income from castle 4 on (0.7 % at castle 4, 0.2 % at castle 5). At castle 1-2 the normal monsters still pay 5-7 % because `rewardSec` decides there.
  - Not built here: goods per family, the relevance floor and per-band weights.

**Still open:**
1. The numbers for goods chance/amount/cap and the relevance floor (gold and XP: set above with `kill-sim`).
2. ~~Relic drop chance and use~~ decided above (2026-11-07).
3. ~~Whether Luck / Gold Find multiply before or after the cap~~ decided: after (IDL-49).
