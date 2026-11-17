# Long-game scaling after rebirth 10 (design)

Status: draft for owner approval, 2026-11-17. Linear: IDL-277 (parent IDL-275), IDL-364 (monster growth Ember upgrade).
Nothing here is built. It describes what to build and which calls are still the builder's.

## Intent and why

From rebirth 5 on the content ends (five biomes are live), so the curve has to carry the game. The owner wants a player at rebirth 10+ to still want the next rebirth for the next boost, to see prices in billions, trillions, sextillions and beyond, to meet stronger monsters and more bosses with every rebirth, and to chase achievements, the bestiary and rankings (server PVP with medals comes later). The game should last months, not weeks.

## Goals

- A human player's run (rebirth to rebirth) stays **about 4 to 6 days** and drifts slowly longer after rebirth 10 (about +5 % per rebirth). Twenty rebirths is then about 100 days.
- Income and prices both grow exponentially, so the numbers reach B, T, Sx and past them.
- Every rebirth pays a boost; an Ember sink exists at every stage (the tails below).
- Build timers can be cut by at least half with Ember upgrades (cap stays 60 %).
- Monsters stay relevant: regular monsters follow player power, bosses are the real test.

## Non-goals and anti-goals

- No PVP, medals or profile showcase in this work (later, server based).
- No hard wall at a fixed rebirth (a visible wall feels bad).
- No tails on every Ember upgrade, only the three headline ones.
- Anti-goal: runs that shrink to hours at rebirth 10+ because the shop got stronger and the prices did not follow.
- No stored derived numbers; saves stay compatible (additive, `limitOf` + `HARD_LIMITS` only grow, SAVE_SCHEMA stays 7).

## Approaches considered

1. **A. Prices follow your power (chosen).** A rebirth multiplier on the price curve is calibrated with the sim so a human run stays in the 4 to 6 day band; a small drift after rebirth 10. Scales with future shop changes; depends on realistic sim bots.
2. **B. A fixed exponent per rebirth** (`price x (1 + g)^(rebirths - 5)`, g by hand). Simple, but every shop change needs a retune of g.
3. **C. A hard wall** at about rebirth 15. Keeps the game from ending but players hit a visible wall.

## Decisions made with the owner

- **Monsters, regular:** level follows player power (character level plus item levels), so fights stay roughly as hard. Legendary gear counts for less in this scaling so a legendary wearer kills a regular monster **about 5x faster** than a non-legendary player at the same level.
- **Monsters, bosses:** follow the full power (legendaries included) and stay a challenge; bosses appear **more often with each rebirth**.
- **Ember shop:** endless sinks, in the **same shop as a last row**. Each upgrade keeps its finite levels, then gets a tail (extra levels, rising cost, smaller steps). **Headline tails only: Eternal Tithe (Ember gain), Overseer (income) and monster growth (IDL-364).** Others get tails one at a time later.
- **Run length:** the owner delegated the numbers: match the current pace and make it last. Proposed 4 to 6 days flat, +5 % per rebirth drift after rebirth 10.
- **Numbers:** extreme values must be representable (see Constraints).

## The parts

1. **Price curve.** A multiplier `m(rebirths)` applied to the tile price tail (and to castle costs from the new levels 11 to 15). Fitted with the sim (`scripts/sim.ts`, profiles `human-rebirth8`, `hardcore-rebirth10`, local `max-*` bots, a new `rebirth20` bot) so run time stays in the band. Stored as config, never in saves. `REBIRTH.tilesNeeded` may need a steeper step than +50 per rebirth.
2. **Monster scaling.** Player power pushes regular-monster level up (today it only pulls it down via `levelCap`); legendary perks count at a reduced weight for regular monsters, full weight for bosses. Raise or lift the per-type `spawnWindow.cap`. Boss frequency grows with rebirth. All of it is a pure shared function in `src/lib/` used by the server (`src/lib/offline/spawnWeights.ts`).
3. **Ember tails.** Eternal Tithe, Overseer, monster growth: tail cost growth x2.2 or more, step a fraction of the last finite step, ceiling in `HARD_LIMITS` (suggest 1,000 levels). Model them in `cloudSave/emberModel.ts` bounds.
4. **Numbers.** Raise `RESOURCE_CAP` (1e21 today, which is Sx) toward 1e300, extend the notation suffixes past Sx, and handle precision past 2^53 (IDL tickets for the cap and the notation exist).
5. **Build-time halving.** The three build-time upgrades plus Master Builders should be able to reach 50 %+ combined within the 60 % cap at a realistic Ember spend; check with the sim.

## What is left to the builder (my calls, marked)

- The exact form of `m(rebirths)` and the drift constant (my call: exponent calibrated so human run time is 4 to 6 days, then +5 %/rebirth; the sim decides the numbers).
- How "player power" is measured for monster scaling (my call: character level plus a weighted sum of item levels; legendary perks weighted about 0.2 for regular monsters so the 5x holds; verify with `fight-sim`).
- Tail constants and the `HARD_LIMITS` ceiling (my call: ceiling 1,000, cost x2.2).
- Whether monster growth (IDL-364) also raises rewards: open, owner to decide in its own brainstorm.

## Constraints

- Server authority: fights and rewards are computed on the server; any new function is pure and shared.
- Saves compatible; pacing guard needs the `pacing-change` label for intended moves; re-baseline `docs/generated/sim-baseline.json` after agreed moves.
- JSDoc is the source of truth: new formulas get `@formula` / `@table` blocks.

## Suggested order

1. Raise `RESOURCE_CAP` and notation (prerequisite).
2. Re-measure the current game with the new Ember shop in the sim (bands are stale).
3. Price curve and `rebirth20` bot, calibrated.
4. Monster scaling and boss frequency.
5. Ember tails; build-time check.
Each step is its own PR with sim before and after.
