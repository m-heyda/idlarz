# Idle Explorer — design & technical docs

Live build: https://idlarz.vercel.app · Stack: Next.js 15.5 (App Router) · React 19 · Tailwind 4 · Zustand 5 · encrypted IndexedDB saves.

These documents describe the game **as the code behaves**. Numbers are traceable to a file; the large tables and the pacing numbers are generated from the real config so they can be refreshed after tuning.

| Doc | What it answers |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Code layout, state shape, tick loop, persistence, how clicks flow |
| [02-mechanics.md](02-mechanics.md) | Every player-visible mechanic and its exact rules |
| [03-formulas-and-scaling.md](03-formulas-and-scaling.md) | Every formula and constant with tables |
| [04-unfinished-and-known-issues.md](04-unfinished-and-known-issues.md) | Half-built features and open issues (only what is still open) |
| [05-balance-backlog-and-roadmap.md](05-balance-backlog-and-roadmap.md) | Remaining balance questions, upgrade notes |
| [06-playtest-and-pacing-report.md](06-playtest-and-pacing-report.md) | Why the old game finished in ~3 days, what the rebalance changed, simulated results incl. castle 7–10 and Rebirth |
| [07-security-and-exploits.md](07-security-and-exploits.md) | Save vault, validation, hidden save tools, exploit audit, server-verified saves (later) |
| [08-followup-plan.md](08-followup-plan.md) | What to build next, in order, with sizes and acceptance criteria |
| [generated/balance-tables.md](generated/balance-tables.md) | Auto-generated tables (tile cost, levels, castle, animals, biomes, rates, Rebirth/Legacy) |
| [generated/sim-milestones.md](generated/sim-milestones.md) | Auto-generated milestone times per simulated player profile |

## Commands

```bash
npm run report   # regenerate docs/generated/balance-tables.md from the config
npm run sim      # bot simulation on the real store -> docs/generated/sim-milestones.md
npm run sim -- --seeds=3 hardcore         # median and min-max over 3 seeds (profiles: idle casual hardcore autoclicker hardcore-rebirth6 hardcore-rebirth10)
npm run sim -- --maxdays=60 hardcore      # stop early
npm run sim -- --legacy hardcore          # approximate the pre-rebalance game
npm run sim -- --set=SCALING_CONFIG.growthLate=1.25 castleCostScale=...   # try a tweak without editing files
npm test         # click limiter, economy/exploit, save-validation, castle, rebirth and ambient tests
```

Re-run `report` and `sim` and commit the diff whenever balance values change.

## Conventions

- Rates are per second and *before* modifiers unless stated; modifiers are fractions (0.25 = +25 %).
- Anything that moves resources must be validated in the store action and covered in `tests/economy.test.ts`; anything that is saved must be validated in `src/lib/sanitizeSave.ts` ([07](07-security-and-exploits.md)).
