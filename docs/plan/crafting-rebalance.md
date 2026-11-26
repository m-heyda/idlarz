# Crafting rebalance: proposal (nothing built, for the owner to approve)

Written 2026-11-26 after the owner's request (crafting level 60 for Ichor is a very long grind at level 15; queues can run for months; weapon crafts are too fast). **Hand-written plan, like the other files here: it lists what is not built.** It replaces the timeline parts of [crafting-v0](crafting-v0.md) once approved. The numbers below come from a read-only what-if sim over the real recipe catalog (`GEAR_RECIPES`, `recipeCostGold`, the level curve in `src/config/crafting.ts`); the sim script is not committed, it becomes `craft-sim` changes in the first PR.

## What the numbers say today

Live data (read-only aggregate query, 2026-11-26): 10 accounts, 7 have crafted, the best has 15,179 crafting XP (about level 12), the median crafter 4,172. Level 60 needs 5,000,000 XP, level 80 30,000,000.

Three things cause the grind, and the biggest is not the one it looks like:

1. **Gold cost per XP (the real wall).** A craft pays its recipe `xp` times `CRAFTING.xpScale` (0.005, cut from 0.02 on 2026-11-17). A G4 Steel piece costs about 2.3-3.5 million gold of inputs and pays about 30 XP. Reaching level 60 by the best recipe at each step burns about **2,760 billion gold**; castle-10 income is 3,000-6,000 gold/s (260-520 million a day, `MAGNITUDE_BANDS`), so that is 5,000 to 10,000 days of all income. With a realistic crafting budget (30-100 million gold a day) level 40 is never reached and level 30 takes 87-291 days.
2. **Time is not the limit, and is wrongly shaped.** The batch cap is a billion (`LIMITS.craftBatchCap`), so one request can queue 132 days of crafts or more, while a single gear craft takes only 20-120 s and a legendary 8 h. The "Hours per level" table in `craft-sim.md` says level 80 takes 12 hours of nonstop crafting, which ignores `xpScale` (it is 200 times too optimistic) and the gold.
3. **`xpScale` 0.005** makes a craft worth 1/200 of its recipe XP (a Minor Healing Potion pays 0.03 XP).

## Proposal

**Principle:** time gates *how many* a player can craft per day, gold gates *what*, XP per craft sets how many crafts a level needs. Frequent players should reach 60 in about a month, casual players should still move every visit.

| Lever | Today | Proposed |
|---|---|---|
| Batch cap, gear, potions, goods | 1,000,000,000 | **25** (`craftBatchCap`; legendary **5**) |
| Batch cap, components (planks, ingots, nails, extracts) | 1,000,000,000 | **1,000**, 1-10 s each, so one batch is at most about 3 h |
| Stash cap per component (`componentCap`) | 1,000,000 | 10,000,000 (planks and nails in the millions can be held and used) |
| Longest batch | unbounded | **12 h** (new `craftMaxBatchHours`; the request is cut to fit) |
| Seconds per gear craft, G1-G8 (`CRAFT_GEAR.timeSec`) | 20, 30, 45, 60, 75, 90, 105, 120 | **2, 5, 10, 15, 20, 25, 30, 30 minutes** (regular weapons about 30 min at the top; lower grades quicker so early levels are not a wait) |
| Legendary craft | 8 h | **3 h** (within the 2-4 h asked) |
| `xpScale` | 0.005 | **0.2** |
| Gold cost of G4-G8 gear recipes | 2.3 M ... 1.6 B | **x 0.05** (about 115 k ... 80 M); G1-G3 unchanged |
| Distilled Ichor unlock | level 60 | **level 35** (G5), 40 XP and the recipe cost unchanged |
| Queue slots, offline run hours | 3 (5 with the Ember shop), 8 h | unchanged |

### Simulated result (days to level 60)

Day-stepped model: each visit refills every free slot with a full batch of the best unlocked recipe; a batch runs at most 8 h without a visit. "Frequent" is 3 visits a day, "casual" 1 visit a day. The gold budget is what the player is willing to spend on crafting each day. All rows use the proposed batch cap and times; only `xpScale` and the G4+ cost factor change.

| xpScale | G4+ cost | frequent, 100 M gold/day | casual, 100 M gold/day | frequent, 30 M gold/day | casual, 30 M gold/day | gold to level 60 |
|---|---|---:|---:|---:|---:|---:|
| 0.005 (today) | x1 | never (level 30 in 87 d) | never | never | never | 2,760 B |
| 0.1 | x1 | never | never | never | never | 136 B |
| 0.1 | x0.1 | 144 d | 154 d | never | never | 13.9 B |
| 0.1 | x0.05 | 75 d | 87 d | 235 d | 246 d | 7.0 B |
| **0.2** | **x0.05** | **37 d** | **44 d** | 117 d | 123 d | **3.5 B** |
| 0.3 | x0.05 | 25 d | 31 d | 77 d | 83 d | 2.4 B |

Reading: only raising XP per craft is not enough (rows 2-3: gold is the wall); cutting the cost of G4+ by 20 is what makes level 60 reachable, and the XP scale then sets the pace. The recommended row reaches level 60 in about 5-6 weeks at 100 M gold a day (a frequent or a casual player), and level 50 in 9-15 days. Levels 61-80 stay a long goal (the G7 and G8 grades, `CRAFT_ONLY_GRADES`): in the sim level 70 takes about 8 months at 100 M gold a day (170-257 days) and level 80 is out of reach inside a year, as intended for a skill that never resets. The curve anchors can move afterwards (a lower level 60 anchor makes everything shorter) without code changes.

### The gold-printer gate needs a decision

`tests/crafting/gearRecipes.test.ts` requires every gear craft to cost more than the piece sells for ("no gold printer", `CRAFT_COST_HEADROOM`). With G4+ costs at x0.05 a G4 piece costs about 115 k and sells for about 343 k. Options:

- **A. Keep the gate: crafted gear sells for a fraction** (for example 5 % of its value, a flag on crafted pieces, the sell value is already a pure function). Crafting stays an XP-and-gear activity, never a gold source. Costs: a rule players must be told about.
- **B. Relax the gate and let time cap the printer.** At 30 minutes a craft, 3 slots and 100 % margin the most gold a queue can make is about 1.4 M gold/hour (about 33 M a day, roughly 13 % of castle-10 income); the sim guard in `craft-sim` fails if it ever passes 15 %. Costs: crafted gear is a small gold source.

**Recommendation: A** (simpler to reason about, no new income source), unless the owner wants crafting to also pay.

## What stays and what moves in the code

All values are config; no formula changes except one new limit.

- `src/config/limits.ts`: `craftBatchCap` split into a gear batch cap and a component batch cap (new keys, `HARD_LIMITS` only grow), new `craftMaxBatchHours`.
- `src/config/crafting.ts`: `xpScale`, `CRAFT_GEAR.timeSec`, `componentCap`; `src/catalog/recipes.ts` and `refined.ts`: component `timeSec`, G4+ `GEAR_GRADE_COST.value`, the Ichor unlock, legendary `timeSec`.
- `src/lib/offline/craft.ts` / `online.ts`: clamp a new request to the cap and to `craftMaxBatchHours`. **Existing queued batches are left alone** (a batch stores its own `count` and `timeSec`, so a player who already queued a huge batch still finishes it; the cap applies to new requests). No ledger change, no `SAVE_SCHEMA` bump, nothing to migrate.
- `scripts/craft-sim.ts`: apply `xpScale` in "Hours per level" (it is missing today), add the gold budget column and the printer guard above, regenerate `docs/generated/craft-sim.md`.
- Tests: `tests/crafting/*` (the gates move with option A or B), a new test for the batch cap and the 12 h clamp.
- Changelog line for players; one PR with the `pacing-change` label. Loot and fight sims are not affected.

## Questions for the owner

1. **"Materials in millions":** does it mean the stash and the recipe inputs (planks, nails, ingots held and used in millions, the batch itself stays small), or batches of up to a million planks? The proposal assumes the first (stash 10 M, component batches 1,000); a million-plank batch at 1-10 s each would be a 12-115 day queue, which is the problem we are removing.
2. **Gold printer:** option A (crafted gear sells for a fraction) or B (time-capped small gold source)?
3. **Casual players:** is "level 60 in about 6 weeks at one visit a day" the right feel, or should casual be slower (`xpScale` 0.1 with costs x0.05 gives about 3 months)?
4. **Ichor at level 35:** the Blight biome only opens at rebirth 4, so most players cannot use Ichor before then anyway. Is 35 right, or should it follow the biome (for example level 25)?
