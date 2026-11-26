# Paragon: what is left (the curve, the points and the 20 upgrades are built; milestones, deeds and cosmetics are open)

Written 2026-11-26 after a design talk with the owner. It **replaces section 5 of [13](13-rebirth-reset-and-paragon.md)** and the numbers of IDL-104, IDL-186, IDL-187 and IDL-114 (paragon cap 400, growth 1.06, all bonuses capped). Hand-written plan like the other files here: it lists what is **not built**. Linear holds the tickets.

## Why

Two players have already reached level 100 and have nothing left to chase. The owner wants a Diablo 3 style endless track: levels past 100 that give points, spent in a grid of upgrades (combat, economy, luck and more), with milestones every 100 levels, deeds, a visible level and a place in the rankings. A first target: **paragon 500 as a long-term goal** (about four months of active play on the retuned curve); levels beyond 1,000 must stay possible and worth it.

## Decided by the owner

- 4 categories with 5 upgrades each: **3 capped and 2 uncapped** per category (12 capped, 8 uncapped). Diablo-like bonuses for combat, economy, luck and the realm.
- Paragon XP is **XP past level 100**, for everyone, from the moment the update ships: a player's banked XP counts. The curve is tough enough that the player with the most banked XP (about 4.6e10 past level 100, paragon 61 on this curve) lands near 60, not 180 (retuned 2026-11-26 after the first curve put the two level-100 players at 184 and 25).
- A milestone every 100 paragon levels, and **deeds** (the Hall of Deeds) for paragon levels.
- Uncapped upgrades grow with a **square root** (each point worth less than the last, never zero, never explosive).

## Goals, non-goals, anti-goals

- Goals: a chase that stays alive past paragon 1,000; every point feels useful; level and paragon are visible in the HUD, the Hero window, deeds and rankings; the server owns the numbers.
- Non-goals: no attribute points from paragon, nothing gated behind paragon, no new art (a CSS badge and the existing icons only), no new currencies.
- Anti-goals: it must not break the pacing targets (the x4 magnitude target, the run-2 ratio), must not make a character a one-shot machine, and must not need a save wipe.

## The curve (my call, tuned from the two level-100 players' real pace of about 3 to 5 billion XP a day)

Paragon level `n` costs `paragonFirstStepXp x paragonGrowth^(n-1)`; the total to reach it is `paragonFirstStepXp x (paragonGrowth^n - 1) / (paragonGrowth - 1)` on top of the 1.85e10 of level 100.

- `paragonFirstStepXp` = 7e8 (41 % of the 1.7e9 step 99 to 100), `paragonGrowth` = 1.002 (a step grows 0.2 % per level: 7e8 at the start, 1.9e9 at paragon 500).
- Totals past level 100: paragon 50 = 3.7e10, 100 = 7.7e10, 200 = 1.7e11, 300 = 2.9e11, 400 = 4.3e11, 500 = 6.0e11, 1,000 = 2.2e12. At 4-5e9 XP a day that is roughly 17 / 38 / 64 / 95 / 130 days to paragon 100 / 200 / 300 / 400 / 500 (rebirths and the Paragon XP upgrade make it faster).
- **Ceiling: paragon 5,000** (`paragonCap`, 7.6e15 XP), still below 2^53 (9e15) where floats are exact (IDL-129). Raise it only together with that ticket.
- The ratio and first step go in `LEVELING` (`src/config/character.ts`), the functions next to `calculateLevel` in `src/utils/game/character.ts`. Retune the two numbers, not the code.

## Points and upgrades

- 1 paragon point per paragon level. Points = `paragonLevel(xp) - spent`; spent points are held by the server (a ledger column, below).
- Every **capped upgrade caps at 25 points** (12 x 25 = 300: all of them are done by paragon 300); everything after goes into the 8 uncapped ones.
- **Uncapped**: bonus = `k x sqrt(points)`. Example `Damage = 2 x sqrt(p) %`: 100 points +20 %, 500 +45 %, 1,000 +63 %, 5,000 +141 %.
- Respec: refunds every point, costs gems (500, confirm like the attribute respec); the first one of an account is free. Points are not wiped by a rebirth.

The grid (all numbers are placeholders until the sims; ids are append-only):

| | Capped (25 points each, effect per point) | Uncapped (k x sqrt(p)) |
|---|---|---|
| **Combat** | Crit damage +2 % (max +50 %), Boss timer +0.6 s (max +15 s), Life leech +0.2 % (max +5 %) | Damage % (k 2), Max life % (k 2) |
| **Economy** | Income +0.8 % (max +20 %), XP gain +0.8 % (max +20 %), Tile discount +0.4 (max +10) | Click gold % (k 3), Kill rewards % (gold and XP, k 1.5) |
| **Fortune** | Luck +1.2 (max +30), Gold find +0.4 % (max +10 %), Golden-monster chance +0.1 pt (max +2.5 pt) | Monster-chest drop chance (+0.2 x sqrt(p) points), Epic-find chance (k 1 %, relative) |
| **Realm** | Offline efficiency +0.8 pt (max +20 pt, under the 100 % `HARD_LIMITS`), Build speed +0.4 % (max +10 %, inside the 60 % build-time cap), Potion power +0.6 % (max +15 %) | Paragon XP gain % (counts only past level 100, k 2), Crafting XP % (k 2) |

## Milestones, deeds, display, ranking

- **Milestones every 100 paragon levels** (100, 200 ... 500, then every 100): gems once on Claim (Hall of Deeds style), a **title and a name frame** shown on the player's name (HUD, rankings, landing), and one bonus paragon point (my call: it keeps the milestone useful without touching pacing). Titles are data in `src/catalog` like the badges and titles of IDL-296; no new art.
- **Deeds**: a new `paragon` condition kind in `AchievementCondition` (`src/catalog/achievements.ts`, `conditionProgress` in `src/lib/deeds.ts`), tiers at paragon 1, 10, 25, 50, 100, 200, 300, 400, 500, 750, 1,000, with deed points like the other tiers. They feed the existing deed milestones (`src/catalog/deedMilestones.ts`).
- **Display**: past level 100 the XP bar becomes the paragon bar ("Paragon 37 · 25% · into / needed", the level box stays 100), the Overview reads `Level 100 ✦ 37` and "Next paragon level", and the Rankings show the mark `✦ 37` (already built, fed by `paragonOf`). The plain `level` stays capped at 100 everywhere it is read today (unlocks, tutorial, deeds); paragon is a separate derived number (`calculateParagon`), so nothing that reads `level` can break. Nothing is added to the save, `summarize` or the database.
- **Ranking**: the Level board already orders by `level desc, xp desc, level_maxed_at asc` (`player_rankings` refresh, `supabase/migrations/player_rankings.sql`), so paragon order falls out of the XP that keeps counting; the board gets a Paragon column. A separate Paragon board is not needed. Ties at 100 keep the "first to the cap" tie-break.

## Server, saves and economy

- **Ledger column** `paragon` (jsonb, nullable): `{ ver, spent: { <upgradeId>: points }, freeRespecUsed }`, modelled on `attrs` (`src/lib/offline/attrs.ts`, migration `gems_attrs_ledger.sql`) with a spend and a respec op on a new `/api/paragon` route (`characterStep` is the template: the browser previews, the server decides, compare-and-swap and an idempotency key). Budget = `paragonLevel(xp) - spent`, where `xp` is the server's clamped XP (`cloudSave/xpModel.ts`), never the upload's.
- Every bonus enters through the numbers the server already derives so it pays exactly what the client shows: combat in `effectiveStats` and the fight profile (`lib/offline/profile.ts`), kill pay in `killIncome`, income and XP in their **own multiplicative bucket** in `calculateResourceBreakdown` (as IDL-187 planned), Luck and offline efficiency in `summarize` (`cloudSave/summary.ts`), chest and drop odds where `MONSTER_CHEST.dropChance` and the loot rolls are read.
- **Save compatibility** (see `save-compatibility.md`): additive only. A nullable ledger column, SQL first and a rollback file, a tolerant reader (missing = no points spent), new ids appended, `HARD_LIMITS` only grow; no `SAVE_SCHEMA` bump, fixtures in `tests/fixtures/saves/` untouched.
- **Balance gates**: `fight-sim` for the combat upgrades, a pace profile with paragon points for the economy ones (run-2 ratio, `idle` and `casual` milestones unchanged at paragon 0), `npm run stat-audit` pins for each bonus at 0, 1, cap and over cap.

## Approaches considered

1. **Flat uncapped (Diablo 3)**: simplest, but a linear bonus past ~paragon 300 breaks every pacing target. Rejected.
2. **Logarithmic / asymptotic uncapped**: safe, but flattens before 1,000 or never truly uncaps. Rejected.
3. **Square root (chosen)**: always worth a point, no explosion, easy to explain.
For the curve, the original x1.06 growth reaches paragon 500 at about 1e23 XP (past the 1e21 XP cap and the 2^53 limit) and puts the banked-XP player at paragon 406 on day one; x1.002 fixes both. The first x1.002 curve (first step 2.1e8) still gave the banked-XP player 184, so the first step is 7e8.

## Order of work (three projects, each its own plan and PRs)

1. **Curve, display and ranking** (IDL-114, the display half of IDL-186): the paragon functions, the server recompute, the paragon bar, `100 + P37` on tags and rankings, the Paragon column. No bonuses; safe to ship on its own.
2. **Points and the 20 upgrades** (IDL-186, IDL-187): **built** (the code and its JSDoc are the record: `src/config/paragon.ts`, `src/lib/offline/paragon.ts`, `paragonStep` in `src/lib/offline/online.ts`, the Paragon tab `HeroParagon.tsx`). The ledger column `paragon` (migration `paragon_ledger.sql`, SQL first), `/api/paragon`, the gem shop's `paragon_respec`, and every bonus folded into `idolEconomy` (the one function the browser and the server both read), the fight profile (`idolFx`), the kill and loot rolls, tile discount and build timers. Still open: the sims (`fight-sim` with the combat upgrades at the cap and at 500 uncapped points, a pace profile with paragon points) and the coefficient tuning they decide; all numbers in the grid are placeholders until then.
3. **Milestones, deeds and cosmetics**: the `paragon` deed condition and tiers, the milestone rewards, titles and frames.

## Owner calls

1. **Timing: decided 2026-11-26, Paragon ships before 1.0** (all three projects, in 0.9.x; the changelog starts in `0.9.4.md`).
2. The bonus paragon point at each milestone: kept (my call, approved with the design).
3. The first respec is free (my call, approved with the design).

## Left to the builder

Exact coefficients (all are placeholders), the names and look of the titles and frames, the layout of the Paragon window, and where the bar sits in the Hero window.
