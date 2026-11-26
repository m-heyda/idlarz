# Paragon 1/3: the curve, the paragon bar and the ranking mark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levels past 100 exist as paragon levels (derived from lifetime XP), shown on the Hero window's XP bar, the Overview and the Rankings; no bonuses yet.

**Architecture:** One pure curve in `src/utils/game/character.ts` next to `calculateLevel`; a pure `xpBarOf` helper turns (level, xp) into the bar's numbers and text for either track; the UI reads those. Paragon is never stored: the Rankings already store lifetime XP (`player_rankings.xp`) and call `paragonOf(xp, level)`, a hook built for this, so the server side is that one function. The plain `level` stays capped at 100.

**Tech Stack:** TypeScript, `node:test` via `tsx --test`, React (design-system `XpBar`).

**Spec:** `docs/plan/paragon.md` (this plan is project 1 of 3; IDL-114).

## Global Constraints

- Curve numbers, verbatim from the spec: `paragonFirstStepXp` = 2.1e8, `paragonGrowth` = 1.002, `paragonCap` = 5000 (total 2.3e15 XP, must stay below 2^53 = 9.007e15). Paragon XP = lifetime XP past `cumulativeXp(MAX_LEVEL)` (1.85e10); banked XP counts.
- Step from paragon level `p` to `p+1` costs `paragonFirstStepXp x paragonGrowth^p`; total to reach level `n` is `paragonFirstStepXp x (paragonGrowth^n - 1) / (paragonGrowth - 1)`. Reference totals past level 100: paragon 50 = 1.1e10, 100 = 2.3e10, 200 = 5.2e10, 300 = 8.6e10, 400 = 1.3e11, 500 = 1.8e11, 1,000 = 6.7e11 (2 significant figures).
- `level` (and `MAX_LEVEL`, `calculateLevel`) do not change: nothing that reads `level` (unlocks, tutorial, deeds, attribute points) may see paragon.
- No save, ledger or SQL change; fixtures in `tests/fixtures/saves/` untouched.
- Changing a formula edits its JSDoc block in the same change (`@category Progression/Levels`, `@formula`). No new art; the paragon mark is the existing `✦ n` of `RankingsWindow`.
- Desktop only. Commits use `git -c core.hooksPath=.githooks` in worktrees; `npm run verify` before pushing.

## Review Focus

1. XP exactly at a level boundary (`cumulativeXp(100)`, and the total of paragon `n`): the level steps up exactly there and one XP less stays below (float error at the edges; tested in Task 1).
2. Garbage XP (negative, NaN, Infinity, above `XP_CAP`): never NaN or a negative paragon; clamped (Task 1).
3. The paragon ceiling (5,000): progress 1, nothing to go, no division by zero in the bar or the level-up timer (Tasks 1 to 3).
4. A Rankings row with big XP but a level below 100 (inconsistent data), and non-Level boards where `xp` is 0: paragon 0 (Task 4).
5. A player below level 100 still sees exactly the old bar text and numbers (Task 2).

## File Structure

- Modify `src/config/character.ts`: `LEVELING` gets the three paragon numbers.
- Modify `src/utils/game/character.ts`: `paragonStepXp`, `cumulativeParagonXp`, `calculateParagon` (pure, no imports from stores).
- Create `src/lib/xpBar.ts`: `xpBarOf(level, xp)` (the bar numbers and words for either track).
- Modify `src/components/game/hero/HeroWindow.tsx`, `src/components/game/LevelUpTimer.tsx`, `src/components/game/hero/HeroStats.tsx`: read `xpBarOf`.
- Modify `src/lib/rankings.ts`: `paragonOf` uses `calculateParagon`.
- Tests: create `tests/economy/paragon.test.ts` and `tests/ui/xpBar.test.ts`; modify `tests/saves/rankings.test.ts`.

### Task 1: The curve

**Files:** Modify `src/config/character.ts` (`LEVELING`), `src/utils/game/character.ts`; Test `tests/economy/paragon.test.ts`

**Interfaces:**
- Produces: `LEVELING.paragonFirstStepXp: number`, `LEVELING.paragonGrowth: number`, `LEVELING.paragonCap: number`; `paragonStepXp(paragon: number): number` (cost of the step from `paragon` to `paragon + 1`; 0 at or above the cap); `cumulativeParagonXp(paragon: number): number` (paragon XP needed to reach it; 0 for 0); `calculateParagon(xp: number): { paragon: number; progress: number; into: number; needed: number }` where `xp` is lifetime XP, `paragon` is 0 below `cumulativeXp(MAX_LEVEL)`, `into` is XP inside the current paragon level, `needed` is `paragonStepXp(paragon)`, `progress` is `into / needed` (1 at the cap).

- [ ] **Step 1: Write the failing tests** in `tests/economy/paragon.test.ts`, asserting: `cumulativeParagonXp(50/100/200/300/400/500/1000)` within 1 % of the reference totals in Global Constraints; `cumulativeParagonXp(5000) < 2 ** 53`; `paragonStepXp(0) === 2.1e8`; `paragonStepXp(499)` between 5.6e8 and 5.8e8; `calculateParagon(cumulativeXp(100) - 1)` is paragon 0 with `into` 0; `calculateParagon(cumulativeXp(100))` is paragon 0, progress 0; for every `n` in `[1, 2, 10, 99, 100, 499, 500, 999, 1000, 4999, 5000]`, `calculateParagon(base + cumulativeParagonXp(n)).paragon === n` and `calculateParagon(base + cumulativeParagonXp(n) - 1).paragon === n - 1` (`base = cumulativeXp(100)`; skip the second assertion when `cumulativeParagonXp(n) - 1` is not representable, i.e. never for these n); `calculateParagon(Number.POSITIVE_INFINITY / NaN / -5 / 1e30)` has `paragon` an integer in `[0, 5000]` and finite `progress` in `[0, 1]`; at the cap `progress === 1` and `needed === 0`; `calculateParagon(1e30).paragon === 5000`.
- [ ] **Step 2: Run** `npx tsx --test tests/economy/paragon.test.ts` and expect FAIL (functions not defined).
- [ ] **Step 3: Implement** the three numbers in `LEVELING` and the three functions with the signatures above. `calculateParagon`: clamp `xp` like `calculateLevel` (`XP_CAP`, non-finite to the cap, negative to 0), subtract `cumulativeXp(MAX_LEVEL)`, take the closed-form `floor(log1p(p * (g - 1) / s1) / log(g))` capped at `paragonCap`, then correct by at most one step in either direction by comparing with `cumulativeParagonXp` so the boundary assertions hold exactly. JSDoc with `@category Progression/Levels`, `@order 6` and an `@formula` block for the step and the total.
- [ ] **Step 4: Run** the same command; expect all PASS. Also run `npx tsx --test tests/economy/*.test.ts` to see nothing else moved.
- [ ] **Step 5: Commit** `git add src/config/character.ts src/utils/game/character.ts tests/economy/paragon.test.ts` with message "Paragon: the curve past level 100 (IDL-114)".

### Task 2: The bar numbers for either track

**Files:** Create `src/lib/xpBar.ts`; Test `tests/ui/xpBar.test.ts`

**Interfaces:**
- Consumes: `calculateParagon`, `xpToNextLevel`, `MAX_LEVEL` (Task 1 and `src/utils/game/character.ts`).
- Produces: `xpBarOf(level: { level: number; progress: number }, xp: number): { track: 'level' | 'paragon'; into: number; max: number; remaining: number; label: string; next: string }` where for a level below 100 `into = floor(progress * xpToNextLevel(level.level))`, `max = xpToNextLevel(level.level)`, `remaining = max - into`, `label = "Level L · P% · into / max"` (compact numbers, exactly the text `HeroWindow` builds today), `next = "level up"`; for level 100 the paragon track: `label = "Paragon N · P% · into / needed"`, `next = "paragon level"`, `remaining = needed - into`; at the ceiling `label = "Paragon 5000 · MAX"`, `max = 1`, `into = 1`, `remaining = 0`. `compact` is the formatter `HeroWindow` already uses for that line (`compact` from `packages/design-system/src/logic`).

- [ ] **Step 1: Write the failing tests** in `tests/ui/xpBar.test.ts`: level 99 at 32 % reproduces today's text and numbers exactly (compare with the old template: `Level 99 · 32% · <into> / <needed>`); level 100 with `xp = cumulativeXp(100) + 1.1e8` is the paragon track, `label` starts with `Paragon 0 ·`; one with `xp` past the first paragon step starts with `Paragon 1 ·` and `remaining` is positive and below `needed`; the ceiling gives the MAX label and `remaining` 0; no output field is NaN for xp NaN.
- [ ] **Step 2: Run** `npx tsx --test tests/ui/xpBar.test.ts`; expect FAIL (module missing).
- [ ] **Step 3: Implement** `xpBarOf` in `src/lib/xpBar.ts` as specified (pure, no store imports).
- [ ] **Step 4: Run** the test; expect PASS.
- [ ] **Step 5: Commit** "Paragon: xpBarOf, the XP bar for both tracks (IDL-114)".

### Task 3: Hero window, level-up timer, Overview

**Files:** Modify `src/components/game/hero/HeroWindow.tsx` (the `needed`, `into`, `xpText` block and the `XpBar` and `LevelUpTimer` usage in `HeroLeft`), `src/components/game/LevelUpTimer.tsx`, `src/components/game/hero/HeroStats.tsx` (the `Level` and `Next level` rows, line ~183)

**Interfaces:**
- Consumes: `xpBarOf(level, xp)` from Task 2; `calculateParagon` from Task 1.

- [ ] **Step 1: Implement** in `HeroLeft`: replace the local `needed/into/xpText` with `const bar = xpBarOf(level, resources.xp)` and pass `value={bar.into} max={bar.max} label={bar.label}` to `XpBar` (keep `level={level.level}`). In `LevelUpTimer`: add a required `xp` prop (pass `resources.xp`), and replace the `MAX_LEVEL` "Max level" branch by `bar.remaining / xpRate` formatted like today, the heading text "Time until " + `bar.next`; show "Max level" only when `bar.remaining === 0` at the paragon ceiling. In `HeroStats`: the `Level` row value becomes `100 ✦ N` for paragon > 0 (`formatCompact(level.level)` plus ` ✦ ${N}`), and `Next level` shows the paragon progress when `level.level >= 100`.
- [ ] **Step 2: Typecheck and lint** `npx tsc --noEmit && npx eslint src/components/game/hero/HeroWindow.tsx src/components/game/LevelUpTimer.tsx src/components/game/hero/HeroStats.tsx`; expect no output.
- [ ] **Step 3: Run** `npx tsx --test tests/ui/*.test.ts`; expect all PASS (the existing Hero and Kingdom render tests keep passing for level < 100).
- [ ] **Step 4: Check in the game** (guest play, `npm run dev`): below level 100 the bar reads exactly as before. For the paragon case, temporarily start the dev server with a test save whose XP is `1.85e10 + 5e8` (edit the guest save through the app's own dev tool if one exists; otherwise rely on Task 2's tests and say in the PR that the paragon bar was not seen live).
- [ ] **Step 5: Commit** "Paragon: the Hero window's XP bar, the level-up timer and the Overview read the paragon track (IDL-114)".

### Task 4: The ranking mark and the docs

**Files:** Modify `src/lib/rankings.ts` (`paragonOf`, JSDoc), `tests/saves/rankings.test.ts` (the test 'there is no paragon yet'), `docs/plan/paragon.md`, `docs/plan/13-rebirth-reset-and-paragon.md` (one line under section 5)

**Interfaces:**
- Consumes: `calculateParagon` (Task 1). Keeps `paragonOf(xp: number, level: number): number`.

- [ ] **Step 1: Replace the test** 'there is no paragon yet' with: `paragonOf(1e12, MAX_LEVEL) > 0`; `paragonOf(cumulativeXp(MAX_LEVEL), MAX_LEVEL) === 0`; `paragonOf(1e12, 60) === 0` (a level below 100 never has paragon, even with odd XP); `paragonOf(0, MAX_LEVEL) === 0`; `paragonOf(NaN, MAX_LEVEL) === 0`; and `buildRankingRows([entry({ value: 100, xp: 6.5e10 })], new Map([['u1', profile({})]]), new Map([['u1', []]]), null)[0].paragon` is above 0 (`entry` and `profile` are the helpers at the top of that test file).
- [ ] **Step 2: Run** `npx tsx --test tests/saves/rankings.test.ts`; expect FAIL on the new assertions.
- [ ] **Step 3: Implement** `paragonOf` as `level >= MAX_LEVEL ? calculateParagon(xp).paragon : 0` and rewrite its JSDoc (it is no longer "0 until paragon exists"; say the Level board orders by `level desc, xp desc` already, so paragon order is XP order).
- [ ] **Step 4: Docs.** In `docs/plan/paragon.md` change the display line to the `✦ N` mark and note that nothing is added to `summarize` or the database (the Rankings read stored XP). Add one line to section 5 of `docs/plan/13-rebirth-reset-and-paragon.md`: "Superseded by [paragon.md](paragon.md)."
- [ ] **Step 5: Verify** `npm run verify`; expect "all green". If it reports `docs/generated` changed, commit it. Then read-only check of the live ordering: with the Supabase tool run `select level, xp from player_rankings order by rank_level limit 3` and confirm the two level-100 players are ordered by XP.
- [ ] **Step 6: Commit** "Paragon: the Rankings show the paragon level (IDL-114)", push, open the PR to `staging`, update IDL-114 (In Review, link) and add a changelog line to the then-current `content/changelog` file only when the owner has decided the 0.9.x versus 1.0 timing (open call 1 in the spec).

## Self-review

- Spec coverage: curve and numbers (Task 1), server recompute via stored XP (Task 4, spec updated), display (Tasks 2 to 3), ranking mark and order (Task 4). Not in this plan on purpose: points, upgrades, milestones, deeds, name tags on the landing page and the HUD dock (projects 2 and 3).
- Types: `calculateParagon` returns `{ paragon, progress, into, needed }` in Tasks 1, 2 and 4; `xpBarOf` returns `{ track, into, max, remaining, label, next }` in Tasks 2 and 3.
- Proportion: four tasks, signatures and assertions only.
