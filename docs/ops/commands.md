# Commands

Generated reports go to `docs/generated` and are never edited by hand. Run `npm run docs:gen` and commit the diff whenever balance values change; CI (job `generated`) fails a PR whose `docs/generated` differs from a fresh run.

```bash
npm run docs:gen              # regenerate everything in docs/generated (the five commands below, in order)
npm run docs:check            # docs:gen, then git diff --exit-code docs/generated: the gate CI runs, in one local command (about 9 minutes, the sim is most of it)
npm run report                # docs/generated/balance-tables.md from the config
npm run sim                   # bot simulation on the real store -> docs/generated/sim-milestones.md
npm run sim -- --seeds=3 hardcore         # median and min-max over 3 seeds (profiles: idle casual hardcore autoclicker human human-rebirth6 human-rebirth8 hardcore-rebirth6 hardcore-rebirth6-x10 hardcore-rebirth10)
npm run sim -- --maxdays=60 hardcore      # stop early
npm run sim -- --no-write hardcore        # print only, leave the file alone
npm run sim -- --legacy hardcore          # approximate the pre-rebalance game
npm run sim -- --set=SCALING_CONFIG.growthLate=1.25 castleCostScale=...   # try a tweak without editing files
npm run catalog-report        # the two sets, their items, affixes, loot sources -> docs/generated/item-catalog.md (tests/catalog/catalogDoc.test.ts keeps it current)
npm run fight-sim -- --md     # fight balance tables -> docs/generated/fight-sim.md (without --md it only prints)
npm run monster-ladder -- --md # which gear tier beats which monster at which level -> docs/generated/monster-ladder.md
npm run loot-sim -- --md      # seeded loot simulation -> docs/generated/loot-sim.md (without --md it only prints)
npm run perf                  # timings of the map at 5k / 50k / 250k tiles
npm run lint
npm test                      # node:test over tests/**/*.test.ts
```

**The pacing guard.** `npm run sim` writes `docs/generated/sim-baseline.json`; CI (job `generated`) runs `scripts/pacing-guard.ts`, which compares it with the copy on the base branch and fails the PR when a guarded milestone moves by more than ±15 % **or by more than 5 game days** (`PACING_MAX_DRIFT_DAYS` in `scripts/pacingCompare.ts`; without it a milestone at day 220 could drift for a month inside 15 %). The job log starts with a table per profile (guarded milestones, how many moved, the largest move in percent and days). Regenerating the baseline cannot hide a change, because the comparison is against the base branch. An intended pacing change carries the `pacing-change` label: the guard then prints the report and passes. The label only takes effect on a new run, so **re-run the job after adding it**.


Other operator guides: [reset-players-cli.md](reset-players-cli.md) (season restart), [e2e-test-account.md](e2e-test-account.md) (the browser test account).
