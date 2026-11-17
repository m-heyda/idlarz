# Long-game scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rebirth 10+ last months: huge numbers (past Sx), run length held at about 4 to 6 days by a calibrated price curve, regular monsters that follow player power (bosses full power, more often per rebirth), and endless Ember tails on the headline upgrades.

**Architecture:** Pure config and pure shared functions (client and server read the same code). Every curve is config calibrated with the sim, never stored in saves. Each task is its own PR with sim before and after, and the `pacing-change` label when a pacing band moves on purpose.

**Tech Stack:** TypeScript, Zustand store slices, Vitest, the bot sim (`scripts/sim.ts`), Supabase ledger (server side in `src/lib/offline/`).

**Spec:** `docs/superpowers/specs/2026-11-17-long-game-scaling-design.md` (Linear IDL-277, IDL-275, IDL-364)

## Global Constraints

- Saves stay compatible: additive fields, new ids appended, `limitOf` + `HARD_LIMITS` only grow, SAVE_SCHEMA stays 7, no stored derived numbers.
- Run length target: about 4 to 6 days for a human player, drift about +5 % per rebirth after rebirth 10.
- Build-time cut cap stays 60 %; the three build-time upgrades plus Master Builders must be able to reach 50 % or more.
- Regular monsters about 5x faster to kill for a legendary wearer than for a non-legendary player at the same level; bosses use full power; bosses appear more often with each rebirth.
- Ember tails: headline only (Eternal Tithe, Overseer, monster growth); cost growth x2.2 or more; ceiling 1,000 levels in `HARD_LIMITS`.
- JSDoc is the source of truth: every changed formula edits its JSDoc block (`@category`, `@formula`, `@table` from `scripts/docs/tableDefs.ts`), then `npm run docs:code`.
- `npm run verify` before each push; `npm run docs:gen:fast` when a generator input changed; pacing moves need the `pacing-change` label.
- Commits: try normal, retry `git -c commit.gpgsign=false commit` only if signing fails.

## Review Focus

- A save with gold at exactly 1e21 (the old cap) loads, is not flagged as tampered, and keeps growing.
- Income times elapsed time overflowing a double (Infinity or NaN) never reaches a stored resource or a rendered label.
- Rebirth 0 to 5: tile prices, `tilesNeeded` and monster levels are byte-identical to today (the multiplier is 1).
- A weak player with no legendary keeps today's `levelCap` protection; the upward push never creates an unwinnable spawn.
- A tail level in a save is clamped to the ceiling by `sanitizeSave`, and `refundOldShop` never drops tail levels of a shop already at version 2.
- The server-side Ember gain bound (`emberModel.ts`) includes the Eternal Tithe tail, so a client cannot claim more than the server allows.

---

### Task 1: Raise the number cap and extend the notation

**Files:**
- Modify: `src/config/economy.ts:43-44` (`RESOURCE_CAP`, `XP_CAP`) and its JSDoc; `src/utils/formatters.ts:2` (`SUFFIXES`); `src/lib/sanitizeSave.ts:142` (`num` default max)
- Check: `supabase/schema.sql` and `supabase/migrations/` for column types that store resource totals (`GrantTotals`, ledger)
- Test: `tests/utils/formatters.test.ts` (existing file; add cases), `tests/saves/saveTolerance.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RESOURCE_CAP: number` (my call: `1e63` as the first step toward 1e300, the Vg suffix); `SUFFIXES` extended so `formatNumber`, `formatHeaderAmount` and `parseAmount` round-trip every tier.

- [ ] **Step 1: Check the stored column types.** Read `supabase/schema.sql` for every column or JSON field that holds a resource total (`player_ledger` totals, `player_saves.rates`). Record in the PR description whether any is `bigint` or `integer` (would overflow above 9.2e18). If one is, write an additive migration (numeric or double precision) with a rollback file and apply it before the code; stop and tell the owner first.
- [ ] **Step 2: Write the failing tests.**
  - `formatNumber(1e21)` is `"1Sx"` style as today (unchanged).
  - `formatNumber(1e24)` returns `"1Sp"`, `formatNumber(1e63)` returns `"1Vg"`, and `formatNumber(1e66)` falls back to exponent text without throwing.
  - `parseAmount("2sp")` equals `2e24`; `parseAmount("1vg")` equals `1e63`.
  - `sanitizeSave`: a save whose `resources.gold` is `1e21` loads untouched; one with `1e64` is rejected as tampered.
- [ ] **Step 3: Run `npx vitest run tests/utils/formatters.test.ts tests/saves/saveTolerance.test.ts`.** Expected: FAIL on the new cases.
- [ ] **Step 4: Implement.** `SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg']` (tier index is the power of 1000). Set `RESOURCE_CAP = 1e63`; `XP_CAP` stays `= RESOURCE_CAP`. Update the JSDoc at `economy.ts:13` (the cap statement) and the `ceiling: RESOURCE_CAP / 100` line stays derived.
- [ ] **Step 5: Run the two test files and `npx vitest run tests/economy tests/audit`.** Expected: PASS (fix any test that hard-codes 1e21 by reading `RESOURCE_CAP`).
- [ ] **Step 6: Run `npm run docs:code && npm run verify`.** Commit: `feat: raise the resource cap to 1e63 and extend number suffixes to Vg`.

### Task 2: Re-measure the game and add the `rebirth20` probe

**Files:**
- Modify: `scripts/sim.ts` (add a `localOnly: true` profile `human-rebirth20`: a human-style player rebirthing at castle 6, twenty runs; model it on `hardcore-rebirth6-x20`), `src/config`-adjacent `MAGNITUDE_BANDS` at `scripts/sim.ts:986` (update after the measurement)
- Create: `docs/superpowers/plans/notes/2026-11-17-baseline.md` (the measured table, committed)

**Interfaces:**
- Consumes: `npm run sim:local` and `npm run sim:parallel`.
- Produces: measured run time per rebirth (days) for `human-rebirth8` and the new `human-rebirth20`, used by Task 3 as the calibration target.

- [ ] **Step 1: Add the profile and run `npm run sim -- --list-local`.** Expected: `human-rebirth20` is listed.
- [ ] **Step 2: Run `npm run sim:local` with the current shop** and save run-time-per-rebirth (castle 6 reached, days) for rebirths 1 to 20 into the notes file. Include the Ember totals.
- [ ] **Step 3: Compare to `MAGNITUDE_BANDS`.** Update the bands only where the new shop moved a value outside its band, and say why in the JSDoc. Label the PR `pacing-change`.
- [ ] **Step 4: Run `npm run docs:gen:fast && npm run verify`.** Commit: `chore: re-measure the long game and add the human-rebirth20 probe`.

### Task 3: The price curve (approach A)

**Files:**
- Modify: `src/config/rebirth.ts` (new `PRICE_CURVE` block next to `REBIRTH`); `src/utils/game/costs.ts:14` (`calculateTileCost`); every caller of `calculateTileCost` (grep it; pass `state.prestige.rebirths`); `src/config/rebirth.ts:31` (`tilesNeeded`) if the sim shows +50 is too flat; the castle cost lookup for levels 11 to 15 in `src/config/castle.ts`
- Test: `tests/economy/priceCurve.test.ts` (new), `tests/economy/rebirth.test.ts`

**Interfaces:**
- Consumes: Task 2's notes (target run time) and `human-rebirth20`.
- Produces: `rebirthPriceMultiplier(rebirths: number): number` exported from `src/utils/game/costs.ts`; `calculateTileCost(ownedTiles: number, discountPercent = 0, rebirths = 0): TileCost`.

- [ ] **Step 1: Write the failing tests.** `rebirthPriceMultiplier(r) === 1` for r in 0..5; strictly increasing for r in 6..200; finite and below 1e200 at r = 200; `calculateTileCost(n, 0, 0)` deep-equals today's result for n in [0, 100, 400, 1000]; `calculateTileCost(n, 0, 10).gold` equals the rebirth-0 gold times `rebirthPriceMultiplier(10)` (floor).
- [ ] **Step 2: Run `npx vitest run tests/economy/priceCurve.test.ts`.** Expected: FAIL (function missing).
- [ ] **Step 3: Implement** `PRICE_CURVE = { from: 5, growth: g, drift: d }` and `rebirthPriceMultiplier = (r) => r <= from ? 1 : (1 + g) ** (r - from) * (1 + d) ** max(0, r - 10)`. Start values g = 0.5, d = 0.05 are placeholders; Step 5 sets the real ones. Thread `rebirths` through every caller. Apply the multiplier to the castle cost of levels 11 to 15 only.
- [ ] **Step 4: Run the new test and `npx vitest run tests/economy tests/audit tests/saves`.** Expected: PASS.
- [ ] **Step 5: Calibrate.** Run `human-rebirth8` and `human-rebirth20`; adjust `g` and `d` until the time between rebirths stays in 4 to 6 days through rebirth 10 and then grows about 5 % per rebirth through 20. Record before/after tables in the PR. Set the final values, update the `@formula`/`@table` of the tile-price JSDoc and add a table to `scripts/docs/tableDefs.ts` (price multiplier by rebirth).
- [ ] **Step 6: Run `npm run docs:gen:fast && npm run verify`.** Commit with the `pacing-change` label on the PR: `feat: rebirth price curve calibrated to a 4 to 6 day run`.

### Task 4: Monster scaling from player power, and more bosses

**Files:**
- Create: `src/lib/monsterPower.ts`
- Modify: `src/lib/monsters.ts:56` (`rollSpawnLevel`), `src/lib/offline/spawnWeights.ts:79` (`spawnLevelCap`), `src/lib/offline/tickets.ts:180,204,235` (boss timer), `src/config/combatConfig.ts:72` (`bossIntervalSec`), the per-type `spawnWindow.cap` in the monster catalog
- Test: `tests/combat/monsterPower.test.ts` (new), `tests/combat/spawn.test.ts` (existing spawn tests)

**Interfaces:**
- Consumes: `PlayerProfile` from `src/lib/offline/profile.ts`.
- Produces: `playerPower(profile: PlayerProfile, kind: 'regular' | 'boss'): number` (character level plus weighted item levels; legendary perks weight about 0.2 for `'regular'`, 1 for `'boss'`; my call, tune with `fight-sim`); `bossIntervalFor(rebirths: number): number` (seconds; shrinks with rebirths, floor documented); `rollSpawnLevel(type, castleLevel, monsterId, distance, levelCap?, power?: number): number` (new optional last parameter, the upward push).

- [ ] **Step 1: Write the failing tests.**
  - `playerPower(p, 'regular') < playerPower(p, 'boss')` when `p` wears legendaries; equal when it wears none.
  - Time to kill a regular monster of equal level: a legendary kit versus the same-level non-legendary kit is between 4x and 6x (use the existing fight engine helper in `src/lib/offline/fightProfile.ts`; assert `ratio > 4 && ratio < 6`).
  - `rollSpawnLevel` with no `power` argument returns exactly today's values for 200 sampled ids (regression).
  - `bossIntervalFor(0) === COMBAT.spawn.bossIntervalSec`; `bossIntervalFor(r)` is non-increasing and never below the documented floor.
  - A weak profile with a low `levelCap` still gets a level not above its cap.
- [ ] **Step 2: Run `npx vitest run tests/combat/monsterPower.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement** `monsterPower.ts`, the optional `power` push (levels rise above the castle-and-distance roll by a bounded amount, still clamped by the type's cap and `levelCap`), and swap the three `bossIntervalSec` reads in `tickets.ts` for `bossIntervalFor(rebirths)`. Raise or lift the per-type `spawnWindow.cap` only as far as the sim needs.
- [ ] **Step 3b: Run `npm run fight-sim` and `loot-sim`** before and after; record both in the PR; label `pacing-change`.
- [ ] **Step 4: Run `npx vitest run tests/combat tests/audit && npm run docs:gen:fast && npm run verify`.** Expected: PASS. Commit: `feat: regular monsters follow player power, bosses come sooner per rebirth`.

### Task 5: Ember tails and the build-time check

**Files:**
- Modify: `src/config/rebirth.ts` (`EmberUpgradeDef` gets optional `tail?: { costGrowth: number; stepFraction: number; maxLevels: number }`; add tails to `tithe` and `overseer`); `src/utils/game/rebirth.ts:33` (`emberUpgradeCost` works past `maxLevel`); `src/utils/game/emberEffects.ts` (`emberEffect` adds the tail steps); `src/stores/game/rebirthSlice.ts:100` (`buyEmberUpgrade` allows `maxLevel + tail.maxLevels`); `src/lib/sanitizeSave.ts` (clamp to ceiling); `src/lib/cloudSave/emberModel.ts` (the Ember gain bound includes the tithe tail); `src/components/game/overlays/RebirthDialog.tsx` (`levelText` and the last row); `src/config/limits.ts` (HARD_LIMITS ceiling)
- Test: `tests/economy/emberTails.test.ts` (new), `tests/economy/rebirth.test.ts`, `tests/server/emberModel.test.ts`

**Interfaces:**
- Consumes: `EMBER_UPGRADES`, `emberUpgradeCost(id, level)`, `emberEffect(prestige, id)`.
- Produces: `emberTailLevels(id: EmberUpgradeId): number` (0 when no tail); `emberUpgradeCost` and `emberEffect` valid for levels up to `maxLevel + emberTailLevels(id)`.

- [ ] **Step 1: Write the failing tests.**
  - `emberUpgradeCost('tithe', 5)` equals `ceil(baseCost x costGrowth^5)`-continuation of the finite curve times the tail growth (state the exact expected number from the config you set); cost is strictly increasing across the finite-to-tail boundary.
  - `emberEffect` at `maxLevel + 1` is greater than at `maxLevel` by exactly `stepFraction x` the last finite step; at `maxLevel + tail.maxLevels` it is finite.
  - `buyEmberUpgrade('tithe')` at `maxLevel` succeeds when affordable, refuses at the ceiling; an upgrade without a tail still refuses at `maxLevel`.
  - `sanitizeSave` clamps a tail level above the ceiling; `refundOldShop` leaves tail levels alone when `shopVersion === 2`.
  - `emberModel` bounds the gain with the tithe tail at its top level (a rebirth claiming more is clamped).
  - Build time: with Master Builders, Mason's Guild and Shrine Keepers each at the level that reaches 50 % for its kind, `buildTimeReduction(prestige, 0, kind)` is at least 0.5 and at most 0.6 for `'castle'`, `'building'` and `'idol'`.
- [ ] **Step 2: Run `npx vitest run tests/economy/emberTails.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement** the tail fields and the functions above. Tail constants (my call): `costGrowth` 2.2, `stepFraction` 0.25 of the last finite step, `maxLevels` so total never passes 1,000; raise the matching `HARD_LIMITS` entry (only grows). Monster growth (IDL-364) gets **no tail in this task**: its reward question is open; add it when that brainstorm closes.
- [ ] **Step 4: Run `npx vitest run tests/economy tests/server tests/saves` and `npm run docs:gen:fast && npm run verify`.** Expected: PASS. Commit: `feat: endless Ember tails on Eternal Tithe and Overseer`.

### Task 6: Close the loop in Linear and the changelog

- [ ] **Step 1: Update Linear.** Comment progress on IDL-277, IDL-275 and IDL-364 (what shipped, what is left: the monster growth upgrade).
- [ ] **Step 2: When the owner asks,** write `content/changelog/0.7.1.md` (patch bump only, per the standing rule) from the player-visible changes.
