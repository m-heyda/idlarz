# Idle Explorer — design & technical docs

Stack: Next.js 15.5 (App Router) · React 19 · Tailwind 4 · Zustand 5 · Supabase (accounts, cloud saves, server ledger) · localStorage text saves with export / import. The game is played with an account only. Live build and server setup: see the [root README](../README.md).

These documents describe the game **as the code behaves**. Numbers are traceable to a file; the large tables and the pacing numbers are generated from the real config (`npm run docs:gen`) so they can be refreshed after tuning. Prefer linking to `generated/` over copying numbers into prose, because copied numbers go stale.

| Doc | What it answers |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Code layout, state shape, tick loop, server layer, persistence, rendering |
| [02-mechanics.md](02-mechanics.md) | Every player-visible mechanic and its rules |
| [03-formulas-and-scaling.md](03-formulas-and-scaling.md) | Every formula and constant |
| [06-pacing-targets.md](06-pacing-targets.md) | What pace the economy is tuned for, and the early-game targets |
| [07-saves-and-security.md](07-saves-and-security.md) | Save format and migrations, validation, what the client checks and what the server owns, how to add saved fields safely |
| [09-cloud-saves.md](09-cloud-saves.md) | Account saves: pipeline, history, sync timing, verification |
| [10-loot-system.md](10-loot-system.md) | Loot profiles, rarity, item level, affixes, pools, and how to add items |
| [11-server-authority.md](11-server-authority.md) | Everything the server decides: offline progress, spawn tickets, fights, sealed rolls, gems, Luck, the threat model |
| [12-rebirth-biomes.md](12-rebirth-biomes.md) | *Draft.* Five rebirth-unlocked biomes, distance rules, T2 materials, monster slots |
| [13-rebirth-reset-and-paragon.md](13-rebirth-reset-and-paragon.md) | *Draft.* Respec, +20 points, inventory wipe on rebirth, Paragon after level 100 |
| [14-server-audit-and-data-plan.md](14-server-audit-and-data-plan.md) | *Draft.* What is server-side, what must move, catalogs, free-plan budget, save compatibility |
| [15-leaderboard-and-world-preview.md](15-leaderboard-and-world-preview.md) | *Draft.* Rankings from `player_stats`, preview of another player's map |
| [16-landing-and-play-route.md](16-landing-and-play-route.md) | *Draft.* Landing page, auth-protected `/play`, account and avatar polish |
| [17-crafting.md](17-crafting.md) | *Draft.* Luck/Intelligence crafting with a persistent crafting level |
| [18-biome-buildings-and-material-tiers.md](18-biome-buildings-and-material-tiers.md) | *Draft.* Three buildings per biome, upgrade timers, material tiers T0-T4, shorter castle timers |
| [19-first-build-steps.md](19-first-build-steps.md) | *Spec.* Step A shorter castle timers (with the in-progress-upgrade trap), Step B resource-key registry |
| [20-monster-families-and-rewards.md](20-monster-families-and-rewards.md) | *Draft.* Monster families per biome, capped absolute rewards scaled by level, goods and tiered drops, spawn pressure |
| [ROADMAP.md](ROADMAP.md) | Open work: known issues, balance backlog, the building rework, server migration, planned features |
| [generated/](generated/) | Auto-generated: `balance-tables.md`, `sim-milestones.md`, `item-catalog.md`, `loot-sim.md`, `fight-sim.md` |

## Commands

```bash
npm run docs:gen              # regenerate everything in docs/generated (the five commands below, in order)
npm run report                # docs/generated/balance-tables.md from the config
npm run sim                   # bot simulation on the real store -> docs/generated/sim-milestones.md
npm run sim -- --seeds=3 hardcore         # median and min-max over 3 seeds (profiles: idle casual hardcore autoclicker human human-rebirth6 human-rebirth8 hardcore-rebirth6 hardcore-rebirth6-x10 hardcore-rebirth10)
npm run sim -- --maxdays=60 hardcore      # stop early
npm run sim -- --no-write hardcore        # print only, leave the file alone
npm run sim -- --legacy hardcore          # approximate the pre-rebalance game
npm run sim -- --set=SCALING_CONFIG.growthLate=1.25 castleCostScale=...   # try a tweak without editing files
npm run catalog-report        # the two sets, their items, affixes, loot sources -> docs/generated/item-catalog.md (tests/catalogDoc.test.ts keeps it current)
npm run fight-sim -- --md     # fight balance tables -> docs/generated/fight-sim.md (without --md it only prints)
npm run loot-sim -- --md      # seeded loot simulation -> docs/generated/loot-sim.md (without --md it only prints)
npm run perf                  # timings of the map at 5k / 50k / 250k tiles
npm run lint
npm test                      # node:test over tests/**/*.test.ts
```

Run `npm run docs:gen` and commit the diff whenever balance values change.

## Conventions

- Rates are per second and *before* modifiers unless stated; modifiers are fractions (0.25 = +25 %).
- Anything that moves resources must be validated in the store action and covered in `tests/economy.test.ts`; anything that is saved must be validated in `src/lib/sanitizeSave.ts` ([07](07-saves-and-security.md)); anything that decides a reward or a fight lives on the server side ([11](11-server-authority.md)).
- When a doc and the code disagree, the code wins; fix the doc in the same change.
