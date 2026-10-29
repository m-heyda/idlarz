# 19 · Build spec for the first two steps: castle timers and the resource registry (spec, nothing built)

The two prerequisites of the rebirth-world plan ([ROADMAP](ROADMAP.md), [18](18-biome-buildings-and-material-tiers.md)). They are independent, each is one pull request, and neither changes what a player sees except the shorter castle timers. Do **A first** (small, an immediate pacing win, nothing depends on it), then **B** (pure refactor that every later feature needs).

| Step | What | Size | Behaviour change |
|---|---|---|---|
| A | Shorter early castle timers | S | yes: levels 2-6 build faster |
| B | One source of truth for resource keys, plus the tier ladder T0-T4 in the catalog | M | none (byte-identical saves and sim) |

---

## Step A · Castle timers

### Decision (2026-10-29)
**Timers 1 h / 3 h / 9 h / 16 h / 36 h and the first five castle upgrade costs x0.75** (the upgrades leaving levels 1 to 5: gold, wood, stone, coal, food and meat alike). Levels 6 -> 7 and up are unchanged. Chosen from the sim (table below): about one day off the first rebirth for both bots, run-2 ratio back in band.

### Goal
Take about one day off the first run. Levels 2-6 go from **1 h, 4 h, 12 h, 24 h, 48 h (3 d 17 h)** to **1 h, 3 h, 9 h, 16 h, 36 h (2 d 17 h)**. Levels 7-10 (3, 4, 5, 7 days) are unchanged.

### Change
Two edits in `CASTLE_UPGRADE` (`src/config/gameConfig.ts`). First `durationsSec` (line 361):

```ts
// before: [3600, 14400, 43200, 86400, 172800, 259200, 345600, 432000, 604800]
durationsSec: [3600, 10800, 32400, 57600, 129600, 259200, 345600, 432000, 604800],
```

Second, the first five rows of `upgradeCosts`, each value x0.75 (every value divides evenly, so no rounding is needed), i.e.:

```ts
{ gold: 52500, wood: 7500, stone: 7500 },                                                    // 1 -> 2   (was 70000 / 10000 / 10000)
{ gold: 150000, wood: 22500, stone: 22500, coal: 15000 },                                    // 2 -> 3   (200000 / 30000 / 30000 / 20000)
{ gold: 750000, wood: 75000, stone: 75000, coal: 37500, food: 150000, meat: 30000 },         // 3 -> 4   (1000000 / 100000 / 100000 / 50000 / 200000 / 40000)
{ gold: 3000000, wood: 300000, stone: 300000, coal: 150000, food: 1500000, meat: 75000 },    // 4 -> 5   (4000000 / 400000 / 400000 / 200000 / 2000000 / 100000)
{ gold: 6000000, wood: 1500000, stone: 1500000, coal: 750000, food: 3000000, meat: 375000 }, // 5 -> 6   (8000000 / 2000000 / 2000000 / 1000000 / 4000000 / 500000)
```

These equal the sim override `castleCostScale=0.75` for these five rows, but the override also scaled levels 6 -> 10, so re-run the sim with the literals before merging (castle 6 should not change; later castles will be slower than in the override runs). The timer array and the costs are read by: `castleUpgradeDuration()` (`utils/gameUtils.ts`, with the Master Builders discount), the Guide text (`Tutorial.tsx` formats it, so it updates itself), `scripts/balance-report.ts`, and `scripts/sim.ts`. No other code change is needed for the numbers.

### The compatibility trap (must be handled in the same PR)
*(Relevant because Step A ships before the class-release reset; if the reset shipped first, the trap would not exist.)*
A save that is **in the middle of an upgrade** stores `castleUpgrade.remainingSec` from the old, longer timer (a 4 -> 5 upgrade with 22 h left; the new maximum is 16 h). Three places react badly:

1. **`sanitizeSave`** bounds `remainingSec` by the current duration (`src/lib/sanitizeSave.ts:473`, `num(..., 0, castleUpgradeDuration(castleLevel))`). The server decodes every upload with it, **without repair** (`cloudSave/pipeline.ts`): an upload from a tab that still runs the old build, or a save loaded before the deploy, comes back `invalid`. Fix: bound by the largest duration the game ever had (add `CASTLE_UPGRADE.legacyDurationsSec`, the old array, used only here), then **normalise** to `min(remaining, castleUpgradeDuration(castleLevel))` inside `sanitizeSave`. The player's upgrade silently becomes the shorter one (they keep the benefit).
2. **`verify.ts` `castleJumped`** (`cloudSave/verify.ts:63-73`) compares the previous stored `derived.castleUpgrade.remainingSec` with the new one: a 22 h -> 16 h drop with no elapsed time is `castle_jump`, which sets `ever_flagged` and **permanently un-ranks the account**. Fix: clamp `was.remainingSec` to `castleUpgradeDuration(was.toLevel - 1)` before comparing. Test: previous 22 h, next 16 h, no elapsed time -> no flag.
3. **Offline grant** reads the stored `derived.castleUpgrade` (the old, longer remaining) until the next upload: harmless, the player is simply credited a little less on that single claim. Note it in the release notes, no code.

`repairSave.fixCastleUpgrade` already clamps `remainingSec` to the duration for browser loads; keep it.

### Pacing checks (the real work of this step)
The upgrade cost is paid up front, so what the player needs is gold and materials ready when the previous timer ends. Average income the *gold part* alone must reach to pay the next upgrade within the previous timer (gold cost leaving level L / timer of the level before):

| Starting upgrade | Gold cost | Preceded by timer (old -> new) | Needed income old -> new |
|---|---|---|---|
| 2 -> 3 | 200k | 1 h | 56 /s (unchanged) |
| 3 -> 4 | 1M | 4 h -> 3 h | 69 -> 93 /s |
| 4 -> 5 | 4M | 12 h -> 9 h | 93 -> 123 /s |
| 5 -> 6 | 8M | 24 h -> 16 h | 93 -> 139 /s |
| (6 -> 7) | 30M | 48 h -> 36 h | 174 -> 231 /s |

The need rises 33-48 % where the timers are cut, so part of the saving will be eaten by waiting for resources. The existing sim already shows waiting (hardcore: castle 3 at 8.7 h with a 4 h timer from 3.3 h, so the 2 -> 3 upgrade started 1.4 h late). Therefore:

- **Add a diagnostic to `scripts/sim.ts`**: per castle level, hours between "previous timer finished" and "next upgrade started" (= waiting on resources), printed in `sim-milestones.md`. Without it the effect of A cannot be explained.
- **Measured (2026-10-29, `npm run sim`, 3 seeds for hardcore/human, 1 seed for the rebirth profiles, `--no-write`)**, castle 6 reached:

| Variant | hardcore | human | human first rebirth | human run 2 / run 1 |
|---|---|---|---|---|
| Today (1/4/12/24/48 h) | 4.3 d | 5.6 d | 5.8 d | 69 % (4.0 / 5.8 d) |
| **Timers 1/3/9/16/36 h** | 3.3 d (-1.0 d) | 5.1 d (-0.5 d) | 5.1 d | 59 % (3.0 / 5.1 d) |
| Timers + castle costs x0.75 (levels 2-6) | 3.3 d (-1.0 d) | 4.6 d (-1.0 d) | 4.6 d | 65 % (3.0 / 4.6 d) |
| Timers + castle costs x0.60 | 3.3 d | 4.1 d (-1.5 d) | n/a | n/a |

- **What the diagnostic shows.** The hardcore bot is almost timer-bound (about 12 h of waiting in the whole climb), so shorter timers give it the full day. The `human` profile is not: it waits 10 h for the 2 -> 3 upgrade (it starts it at 14 h after finishing level 2 at 4 h) and 24 h for 4 -> 5. The first wait does not move with the costs at all (still 14 h at x0.6): it is the bot's sleep window (it plays 8-9, 12-13 and 18-23; level 2 finishes at 22:00 and the next visit is at 08:00), i.e. a **player who sleeps** loses the same hours however short the timer is. The 4 -> 5 wait is real resource waiting (it drops from 24 h to about 10 h at x0.75). So for the owner-like profile, timers alone give half a day and only cheaper castle costs reach the day.
- **Read-across to the targets**: the run 2 / run 1 ratio for `human` falls to 59 % with timers only (the target band is 60-70 %) and returns to 65 % with the x0.75 costs, because run 1 benefits more from cheaper costs than the later runs, which already have Embers. Hardcore stays at about 80 % in all variants (its later runs are bounded by the castle timers and Master Builders).
- **Caveats**: single seed for the rebirth rows; the human bot quantises everything to its play windows, so its numbers move in steps of hours, not smoothly; the cost cut also trims the T0 sinks (wood, stone, coal, food, meat), which the ROADMAP (BL5) already calls thin, and the sim cannot judge whether that matters. Castle costs for levels 7-10 were not scaled in the castle-6 numbers (a x0.75 override on all levels moves later castles too; limit the final change to the first five upgrades).
- **Recommendation**: timers **1 h / 3 h / 9 h / 16 h / 36 h** *and* the first five castle upgrade costs **x0.75** (gold, wood, stone, coal, food, meat alike). It meets "about a day off the first rebirth" for both bots (human 5.8 -> 4.6 d, hardcore 4.3 -> 3.3 d) and keeps the run-2 ratio in band. If you do not want to touch costs, ship timers only: -1.0 d hardcore, -0.5 d human, run-2 ratio 59 %.
- **First rebirth day**: [06](06-pacing-targets.md) says day 5-7; the measured first rebirth for the human profile is 4.6-5.1 d, so update the target to "about day 4-6" when the change ships.
- **Run 2 ratio** (castle 6 again in 60-70 % of run 1, [06](06-pacing-targets.md)): measured above; re-run with `--seeds=3` before merging.
- Master Builders (-5 %/level, max -50 %) shortens these further; the Dwarf Statue ([18](18-biome-buildings-and-material-tiers.md)) will stack, so the combined cap (proposal 60 %) is a Step-18 item, not part of A.

### Files
`src/config/gameConfig.ts` (array, `legacyDurationsSec`, and, if chosen, the first five `upgradeCosts` rows x0.75), `src/lib/sanitizeSave.ts`, `src/lib/cloudSave/verify.ts`, `scripts/sim.ts` (diagnostic), docs: `02-mechanics.md:67`, `03-formulas-and-scaling.md:76,91`, `06-pacing-targets.md:19` and the targets table, `18-...md` section 5.1, then `npm run docs:gen` (regenerates `balance-tables.md`, `sim-milestones.md`) and commit the diff.

### Tests
- `tests/castle.test.ts`: pin the first five durations and their sum (`65 h`), and that levels 7-10 are unchanged. This is the "pacing guard": changing a timer later must update the test on purpose.
- `tests/economy.test.ts:176-181` keep passing (they use `durationsSec[0]`, unchanged).
- New `tests/saves.test.ts` case: a save with `castleUpgrade.remainingSec` = the old maximum for the level loads and ends up at the new maximum.
- New `tests/cloudSave.test.ts` case for the `castle_jump` clamp above.
- A frozen fixture is not needed (no schema change), but run the existing v1-v6 fixtures.

### Live data and rollout
5 live players, castle level max 4. Before the deploy: `select derived->'castleUpgrade' from player_saves where derived->'castleUpgrade' is not null` to see who is mid-upgrade (0-2 rows; read-only, no names). No SQL migration, no `SAVE_SCHEMA` bump. Ship, run `docs:gen`, done. **Acceptance:** tests green; `sim --seeds=3` summary pasted in the PR with the new waiting column; no `castle_jump` flag in a test that replays the old-remaining case.

---

## Step B · One registry for resource keys, and the tier ladder

### Goal
Adding a resource (17 are planned: 5 T2, 12 T3, plus T4 later) must be **one catalog entry**, not edits in about eight files. The refactor changes no behaviour: the same keys in the same order, the same saves, the same sim output.

### Where the key list lives today (verified)
| Place | What is hand-kept |
|---|---|
| `src/types/game.ts:11` | `interface Resources` (10 keys) |
| `src/config/gameConfig.ts` | `INITIAL_RESOURCES`, `BASE_GENERATION_RATES`, `CASTLE_BASE_RATES`, `FARM_PRODUCT_KEYS` |
| `src/utils/gameUtils.ts:461-464` | `RESOURCE_KEYS`, `FARM_KEYS`, `zeroResources()` |
| `src/lib/sanitizeSave.ts:142-143` | `RESOURCE_KEYS` (from `INITIAL_RESOURCES`), `OPTIONAL_RESOURCES = {eggs, milk, hide}` |
| `src/lib/offline/grant.ts:5,39` | `RESOURCES` array, `zeroGrant()` |
| `src/lib/offline/ledger.ts:13-15` | `GrantTotals = Resources & {gems}`, `zeroTotals()` |
| `src/lib/repairSave.ts:77` | loops `INITIAL_RESOURCES` (already derived) |
| `src/catalog/resources.ts` | `RESOURCES`: the presentation catalog, already holds every key plus `gems`, `embers`; `tier`, `merchant` |

### Design
1. **The catalog is the registry.** Add to `ResourceDef` two optional flags: `stored: true` (lives in the save's `resources` object: gold, wood, stone, coal, food, meat, eggs, milk, hide, xp; **not** gems/embers) and `since: 1 | 2 ...` is *not* needed; instead `optionalInSave: true` for every key added after the first saves (eggs, milk, hide today; every new key from now on defaults to optional, so an old save without it loads as 0, the existing `OPTIONAL_RESOURCES` rule).
2. **Derived exports** (one new module `src/catalog/resourceKeys.ts`, imported by all of the above):
   - `STORED_KEYS` (catalog order filtered by `stored`; order must equal today's: `gold, wood, stone, coal, food, meat, eggs, milk, hide, xp`),
   - `type StoredKey`, and `Resources = Record<StoredKey, number>` replaces the hand-written interface,
   - `zeroResources()`, `zeroTotals()`, `zeroGrant()` built from `STORED_KEYS`,
   - `OPTIONAL_KEYS`, `FARM_KEYS` (a `group: 'farm'` flag; `FARM_PRODUCT_KEYS` = the farm group minus meat, as now),
   - helper `rates({ gold: 0.1, ... })` returning a full `Resources` with 0 for the keys not listed, so `BASE_GENERATION_RATES` / `CASTLE_BASE_RATES` / `INITIAL_RESOURCES` list only what is non-zero (`INITIAL_RESOURCES = rates({ gold: 125 })`).
3. **Tier ladder in the catalog**: extend `ResourceTier` to `'currency' | 't0' | 't1' | 't2' | 't3' | 't4'` with labels (`Base materials`, `Farm products`, `Biome goods`, `Extracts`, `Relics`; today's `t1` label "T1 materials" becomes "Farm products"), and make the header skip a tier that has no resources. No resource is added in this step.
4. **No save change.** `saveFormat`/`sanitizeSave` keep reading the same keys in the same order; `world_hash` covers the map only. A key is never removed or renamed by this PR.
5. **A guard against drift**: `tests/catalog.test.ts` gains (a) every `stored` key is present in each derived structure, (b) `Object.keys(INITIAL_RESOURCES)` deep-equals the current literal list (a snapshot, updated deliberately when a resource is added), (c) a source scan that fails if any file under `src/` outside `catalog/` contains a literal array/object with `'eggs'` and `'milk'` and `'hide'` (the pattern of the old hand-kept lists), with a short allowlist for tests and docs generators.

### Out of scope
New resources, merchant changes, UI for hidden/discovered resources, ledger columns (the ledger rows already merge `{...zeroTotals(), ...row.granted}`, so adding keys later is safe), any SQL.

### Risks and how to catch them
- **Key order** changes JSON order in saves and the checksum of stored text. Keep catalog order equal to today's and assert it in the snapshot test; also round-trip every fixture in `tests/fixtures/saves/` (v1-v5, add v6) through load -> save and compare.
- **TypeScript churn**: `Resources` becomes a mapped type; places that spread or index it keep working. `tsc`, `lint` and the whole suite are the check; expect many touched imports, few logic edits.
- **Import cycles**: `types/game.ts` imports `BIOMES` from `gameConfig` (type only); the registry must import only the catalog, never `gameConfig`.
- **Behaviour drift**: `npm run sim -- --no-write human hardcore` before and after must print identical milestone tables, and `npm run docs:gen` must produce an empty diff. That is the acceptance test for "pure refactor".

### Tests and acceptance
`tsc` clean; `npm test` green; the sim and generated docs unchanged; the scan test fails when someone re-adds a hand list (prove it once locally); the PR description lists the eight places that no longer have a list.

### Files
`src/catalog/resources.ts`, new `src/catalog/resourceKeys.ts`, `src/types/game.ts`, `src/config/gameConfig.ts`, `src/utils/gameUtils.ts`, `src/lib/sanitizeSave.ts`, `src/lib/offline/grant.ts`, `src/lib/offline/ledger.ts`, `src/components/game/GameHeader.tsx` / `ResourceDisplay.tsx` (empty-tier skip), `tests/catalog.test.ts`, `docs/ROADMAP.md` ("Resource key lists are hand-kept..." note is removed).

---

## Order, slicing, and what follows
1. **PR A** (castle timers + clamps + sim diagnostic + docs) -> merge -> read the sim numbers.
2. **PR B** (registry) -> merge. Then the catalog-only work starts: T2/T3 materials ([12](12-rebirth-biomes.md), [18](18-biome-buildings-and-material-tiers.md)) are a catalog entry plus a source and a sink each.
3. In parallel and independent: the fight-polling write fix ([14](14-server-audit-and-data-plan.md) section 5), which should land before crafting and rankings add load.

Pull requests go to `m-heyda/idlarz` (not the upstream); commits need your GPG passphrase.

## Open questions
1. ~~Timers only or timers + costs x0.75?~~ **Decided: timers + costs x0.75.**
2. For Step A, may old in-progress upgrades be shortened to the new maximum (proposed: yes, the player benefits)?
3. Should the registry also carry the pixel icon and the floating-text colour (they already live in the catalog) so a new resource needs zero other files?
