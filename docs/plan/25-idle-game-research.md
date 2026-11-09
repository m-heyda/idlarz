# 25 · Idle-game research: formulas, big numbers, offline progress

*Research note, written 2026-11-07. Nothing here is built and no number in it is a decision.* It compares what the incremental-game literature teaches with what the game does today ([economy](../reference/economy.md), [pacing targets](../reference/pacing.md), [saves and server](../reference/saves-and-server.md)) and with the plans in [ROADMAP](ROADMAP.md), and ends with a ranked list of improvements. The code wins wherever this note and the code disagree.

## 1. Skills for building idle games with Claude

A search of the skills ecosystem (`npx skills find`, 2026-11-07) found **no skill built for browser incremental games**. The nearest matches are generic or engine-specific, all under 1K installs, and none was opened or vetted:

| Skill | Installs | Fit |
| --- | --- | --- |
| `donchitos/claude-code-game-studios@balance-check` | 918 | generic balance review |
| `omer-metin/skills-for-antigravity@game-design-core` | 595 | generic game design |
| `thedivergentai/game-dev-agentic-skills@godot-genre-idle-clicker` | 348 | Godot; only the design ideas transfer |
| `…@godot-economy-system`, `…@godot-monte-carlo-balancer` | 478 / 215 | Godot |
| `davila7/claude-code-templates` `game-development` | n/a | generic orchestrator, found by web search |

Recommendation: install none. `scripts/sim.ts` (real store, seeded bot profiles, [pacing targets](../reference/pacing.md)) already does what a balancing skill would suggest, with the game's own numbers. The genre knowledge is in the articles of section 2.

## 2. What the literature says

**Verified (read in full):** Anthony Pecorella, *The Math of Idle Games* parts [I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i), [II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii), [III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii), and the READMEs of [break_infinity.js](https://github.com/Patashu/break_infinity.js) and [break_eternity.js](https://github.com/Patashu/break_eternity.js).

- **Core model.** `cost_next = base × r^owned`, `production = base_rate × owned × multipliers`. Cost is exponential, production linear or polynomial, so exponential cost always wins eventually. Balancing means delaying the crossover. Growth rates in the articles: 1.07 (AdVenture Capitalist), 1.1 (Derivative Clicker). A dev.to tutorial uses 1.15 (not checked against the Cookie Clicker wiki).
- **Bulk buy** (single exponential only): cost of n = `b·r^k·(r^n − 1)/(r − 1)`; max affordable = `floor(ln(c·(r−1)/(b·r^k) + 1) / ln r)`.
- **Milestone multipliers** (AdCap: x2 at 25 and 50 owned) with **different thresholds per generator**, so that different generators lead at different stages. Without that, the newest generator always dominates and older ones are dead weight. A cheap-per-value generator that "feels worthless" is ignored.
- **Derivative chains** (part II): when generator N makes generator N−1, output grows like `x^n/n!`. A "tier boost" (every purchased tier-1 unit adds a small percentage to all tier-1 output, 0.05 % in Derivative Clicker) keeps old tiers relevant.
- **Prestige currency formulas** (part III), all fractional powers rather than logs, so that doing nothing new earns nothing:
  - Realm Grinder `(√(1 + 8·c_max/10¹²) − 1)/2` (4x the run for 2x currency)
  - AdCap `150·√(lifetime/10¹⁵)` (about 3-4x)
  - Cookie Clicker `∛(lifetime/10¹²)` (8x)
  - Egg Inc. `(run/10⁶)^0.14` (128x; paired with a 2-hour offline cap)
- **Pacing variety.** Vary run length and reset timing so players do not all reset at one point; the article's own spreadsheet showed a 16x milestone at 500 owned breaking a run.
- **Big numbers.** `break_infinity` reaches about 1e(9e15) and is 2.5-3x faster than decimal.js for add/multiply (its own benchmark). `break_eternity` reaches 10^^1e308 at similar speed and is a drop-in successor, but `log`/`ln` return Decimals. Neither supports operators (`.add()`, `.mul()`), and every call allocates a new object.

**Weak evidence (SEO-style pages, treat as patterns, not rules):** offline progress is usually capped and often scaled down (50 % is common) with upgrades that extend the cap; some games bank the overflow as a "boost bank"; layered prestige needs autobuyers or bulk buy; too many softcaps can stall the early game ([overview](https://themindstudios.com/blog/idle-clicker-game-design-and-monetization), [Wikipedia](https://en.wikipedia.org/wiki/Incremental_game)).

**Not obtained:** the Cookie Clicker, Clicker Heroes and AdCap wiki pages (HTTP 402) and the r/incremental_games wikis (blocked). Their constants were not used.

## 3. The game against it

| Topic | Genre practice | This game | Verdict |
| --- | --- | --- | --- |
| Cost curve | exponential, one rate | staged: x1.13 to 15 tiles, x1.07 to 100, x1.007 to 300, then `(n/300)^4.5` capped at `RESOURCE_CAP/100` | fits a map game; the tail is the wall rebirth exists for |
| Prestige | `x^(1/2..1/3)` of earnings | `3·(C−5)·(√(n/10) + 0.02·tiles over the requirement)`, +6 % income per Ember ([03 §9](../reference/economy.md)) | see item 6 |
| Multiplier buckets | several independent `(1+Σ)` groups | castle, Embers, Foreman, set income | good, this is where big totals come from |
| Milestone multipliers | thresholds per generator | none on ownership counts; kills/resources only ([22](22-glossary-and-mastery.md)) | gap |
| Offline | capped, scaled, extendable | server-owned: 8 h cap, 50 % efficiency, Night Watch +1 h and Steward +5 % per level, hard limit 72 h / 100 % (`config/limits.ts`) | ahead of most games (no clock cheating) |
| Offline UX | clear cap state | report bar planned ([21](21-classes-avatars-achievements-offline-report.md)) | planned |
| Layering | one layer at a time | rebirth, then paragon ([13](13-rebirth-reset-and-paragon.md)), then mastery ([22](22-glossary-and-mastery.md)) | sequenced correctly |
| Autobuyers | needed once layers stack | auto-battle only | gap |
| Number type | Decimal library for huge ranges | plain doubles, `RESOURCE_CAP` 1e21 | enough until about 1e300 |
| Notation | suffix, scientific, engineering | suffixes to `Sx` (1e21) then `1.23e24` (`utils/formatters.ts`) | ends exactly at the cap |
| Balancing tool | spreadsheet model | seeded sim on the real store, "minutes to cover" table | ahead |

## 4. Improvements, ranked

1. **Write down the magnitude target.** No doc says how large gold per second, stocks or Embers should be at castle 10, rebirth 5 and rebirth 10. Add that table and have `npm run sim` print it; every cap decision below depends on it.
2. **Raise the cap before adopting a Decimal library.** Doubles reach about 1.8e308, so moving `RESOURCE_CAP` from 1e21 toward 1e300 gives 17 more orders of magnitude without new types. A Decimal library allocates per operation, and the income pass is the hot path (about 11 ms at 50,000 tiles, [ROADMAP](ROADMAP.md) technical risks). If ever needed, use it for totals only, not per tile. It would also touch `sanitizeSave`, `cloudSave/netWorth.ts`, the ledger JSON and any database column type (not checked here).
3. **Handle precision past 2^53 (about 9e15).** Already noted under BL16. `floor()` and exact-equality checks stop meaning anything; use relative tolerance in server plausibility checks and keep conservation checks (`legacyPoints + spending = earned`) on small integers.
4. **Notation.** Extend `SUFFIXES` past `Sx` (Sp, Oc, No, Dc, then aa, ab…), add a Settings switch for suffix / scientific / engineering, and unify the K threshold (`formatNumber` starts at 10,000, `formatHeaderAmount` at 1,000).
5. **Milestone multipliers with varied thresholds.** For example a permanent x2 at 50, 100, 200 and 400 owned tiles, and building-count thresholds that differ per biome ([18](18-biome-buildings-and-material-tiers.md)). This keeps old-biome buildings relevant after rebirth 5 and breaks the "newest generator dominates" pattern. Run the sim's `idle` and `casual` profiles before and after, since a milestone shifts pacing.
6. **Check the Ember formula against marginal cost.** The sqrt term alone would need 4x the tiles to double the gain, which costs roughly `4^5.5` (about 2,000x) the gold in the `n^4.5` tail. The surplus term is linear instead: 0.02 per tile over the requirement, i.e. one extra `3·(C−5)` Ember per 50 tiles. So late gain per gold falls steeply and the castle level `(C−5)` dominates the decision, which the castle timers already bound. Fine if intended; confirm with the `human-rebirth*` profiles that nobody is rewarded for waiting past the requirement.
7. **Doc check.** The table in [03 §9](../reference/economy.md) (castle 6: 14 / 20 / 24 Embers for 100 / 200 / 300 tiles) cannot come from the current `REBIRTH.gain` for those inputs, because rebirth needs 400+ tiles. Regenerate it with `npm run report` or relabel the columns.
8. **An endless Ember sink.** The Ember shop is finite (four items, level 10, cost `x1.4` per level) and each Ember adds only +6 % additively, so income grows about linearly in total Embers. Paragon ([13](13-rebirth-reset-and-paragon.md)) is the endless sink; if "crazy numbers" is a goal, give it or Idol mastery a compounding term, not only a flat bonus.
9. **Autobuyers and bulk buy.** Auto-battle exists after rebirth 1. Candidates: "buy the cheapest tile", auto-build, "buy next N tiles" with a cost preview. The closed-form bulk sum only works inside one cost stage, so sum stage by stage or use a prefix table.
10. **Offline overflow.** The planned report says "capped, N h earned nothing". An option from the weak evidence: store the overflow as a small time bank the player can spend. Optional, and it needs server work in the ledger.
11. **Softcap audit.** Every `LIMITS` / `HARD_LIMITS` entry is a softcap in disguise. After each biome ships, run `idle` and `casual` and check that no early stage stalls.
12. **Keep the economy simple to read.** Everything is additive inside one `(1 + Σ)` per bucket ([03 §3](../reference/economy.md)); adding a fifth bucket multiplies totals, so add one only on purpose and show it in the "Where the income comes from" panel.

## 5. Suggested pairing with the roadmap

Items 1-4 are groundwork that ships before any new multiplier source, so that [18](18-biome-buildings-and-material-tiers.md), [13](13-rebirth-reset-and-paragon.md) and [22](22-glossary-and-mastery.md) are designed against a known number range. Item 5 fits the biome building work (doc 18, release steps P1-P3). Items 6-7 are a small sim and doc pass. Items 8-10 attach to paragon and the offline report ([21](21-classes-avatars-achievements-offline-report.md)). Nothing here changes the agreed rules in ROADMAP: additive save fields only, no new per-click server calls.
