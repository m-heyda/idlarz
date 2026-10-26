# 08 · Follow-up plan

Everything that was **not** part of the endgame / settings / ambient batch, ordered so each item can be picked up on its own. Sizes: S ≈ half a day, M ≈ 1–2 days, L ≈ a week. Open issues are described in [04](04-unfinished-and-known-issues.md), balance questions in [05](05-balance-backlog-and-roadmap.md).

## Phase A — small polish and safety nets

| # | Item | Size | Acceptance |
| --- | --- | --- | --- |
| A1 | **Castle-timer badge** on the castle tile and in the header (B4) | S | remaining time visible without opening the dialog; updates each second; hidden when no upgrade runs |
| A2 | **Legacy respec** (B9) | S | costs one rebirth or a fixed fee; point-conservation check in `sanitizeSave` still holds; test added |
| A3 | **Reputation has a use** (U6): small merchant discount or quest gate, or remove it from the statistics | S | either read by one formula (documented in 03) or gone |
| A4 | ~~**HP/MP bars** decision (U5)~~ **done**: the HP flask and the Statistics window show live HP; MP stays full until skills exist | S | no bar that is always full |
| A5 | **CI**: GitHub Action running `tsc`, `lint`, `test`, `build`, plus `sim -- --maxdays=30 hardcore` as a pacing guard | S | PR fails when the first-finish time of the dedicated profile moves by more than ±15 % |
| A6 | **Playwright smoke test**: new game, click, buy tile, open Settings and Legacy, reload keeps state | M | runs in CI; uses `window.__game` only in dev builds |
| A7 | **Per-tile selectors** so a tick does not re-render every visible tile (performance backlog in 05) | M | React profiler shows a tick touches only changed tiles |
| A8 | **Next 16 / TypeScript 7 / ESLint 10** upgrades, one at a time | M | build, tests and sim output unchanged; both PostCSS advisories gone from `npm audit` |

## Phase B — balance (one topic per PR, each re-runs the sim)

B1 active-vs-idle gap (BL1) · B2 levels and stat points (BL2) · B3 chests and tile taps (BL3) · B4 animal engine (BL4) · B5 sinks (BL5) · B6 merchant saturation (BL6) · B7 biome specialisation (BL8) · B8 first ten minutes: check the tutorial flow, first tile at ~1 min, first animal before the first castle upgrade · B9 more Legacy shop shapes (BL9, BL10) · B10 biome luck and the 24 h player (BL11): do this first, it decides how stable the other sim comparisons are.

Rule for every B item: change one parameter group, run `npm run sim -- --seeds=3`, compare with `docs/generated/sim-milestones.md`, keep the early-game targets of [06 §0](06-playtest-and-pacing-report.md) (100 tiles in the first day, 200-300 tiles in 2-3 days, a clearly slower climb after 300, first rebirth at castle 6 + 100 tiles in about a week, each rebirth run faster than the last).

## Phase C — content

Order matters because each step needs the previous one.

1. ~~**C1 Equipment and inventory**~~ **done** (combat, monsters, items, bag, Character window; rebirth keeps gear). Next steps and the longer roadmap (stat rework, monster families, skills, item upgrades; selling is done) are in [superpowers/specs/2026-10-24-combat-and-inventory-design.md](superpowers/specs/2026-10-24-combat-and-inventory-design.md) §13.
2. **C2 Upgrade items** (U2, M): gold/resource sink; ties to the merchant.
3. **C3 Quests** (U3, L): early guidance, item rewards, tracking in the store.
4. **C4 Building levels / demolish** (U13, M): another resource sink (BL5).
5. **C5 Gambling** (U4, M): uses `luck`; every payout computed in the store, limited by cooldown and the click limiter.
6. ~~**C6 Combat decision**~~ **decided**: click combat on the map (rats, Rat King). Remaining: let the stat points feed combat (U5) and balance it with a fighting bot (05 BL12).
7. **C7 Offline progress** (U9, M): needs trusted time (Phase D) or a conservative cap (8 h at 50 %).
8. **C8 Mobile layout** (U14, L): responsive modals, bigger tap targets, test on a real phone.

## Phase D — server-verified saves (only if leaderboards or online features are planned)

Server issues a signed time and verifies deltas between saves; saves carry a signature the client cannot forge. Makes offline progress safe and turns the exploit model in [07](07-security-and-exploits.md) from "client-side deterrent" into real enforcement. Size L.

## Ambient life ideas (cheap, optional)

Weather (rain tint), day/night tint by real clock, castle flag animation, more critters per biome. Keep each switchable under Settings → ambient and covered by `prefers-reduced-motion`.
