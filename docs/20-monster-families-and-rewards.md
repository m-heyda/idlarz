# 20 · Monster families, rewards and spawn pressure (design draft, nothing built)

How the monster system grows from "rats and one king" to three or four monsters plus a boss per biome ([12](12-rebirth-biomes.md)), with a reward model in which **low-level monsters stop mattering as the player grows** and high-level monsters pay much more, in gold, in basic goods and in tiered items.

## 1. What exists (read from the code)
- `MONSTERS` in `config/combatConfig.ts`: `rat` and `ratKing` (a boss). A `MonsterDef` carries stats per `refLevel`, per-level scaling, `spawnWindow` (the level range by castle level), `spawn` (biomes, castle distance, `minRebirths`), `rewardSec`, `lootSourceId`.
- **A kill pays seconds of the player's current income**: gold = `rewardSec x gold/s`, XP likewise (`COMBAT.rewards.minGold` 10 and `minXp` 5 as floors), hide = a share (`hideShare` 0.6) of the hide rate; multiplied by `rewardPerLevel^(level - refLevel)` (`lib/loot/kill.ts`, `payKill` in `lib/offline/reward.ts`). Luck, Gold Find and the set's Kill Rewards % apply on top.
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

**Still open:**
1. The numbers: per-family `rewardSec`, caps, `levelMult`, goods chance/amount/cap and the relevance floor; set with a new kill-reward sim so that kill income stays a small share of total income (BL12).
2. Relic drop chance per boss and what relics are used for (top legendary crafts, Idol cap upgrades?).
3. Whether Luck / Gold Find multiply before or after the cap (proposed: after).
