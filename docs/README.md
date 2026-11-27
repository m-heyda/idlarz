# Idle Realm: docs

Stack: Next.js 15.5 (App Router), React 19, Tailwind 4, Zustand 5, Supabase (accounts, cloud saves, server ledger). Live build and server setup: see the [root README](../README.md).

## One source of truth: the JSDoc in the code

How the game works (formulas, rules, numbers, the server's guarantees, the operator guides) is documented **in JSDoc blocks next to the functions and constants that implement it**, and nowhere else.
Find a rule with `grep -rn "@category" src scripts` (add the section, e.g. `@category Economy/Tiles`); nothing is generated from the blocks.

| Folder | What it holds |
| --- | --- |
| [generated/](generated/) | Measured by `npm run docs:gen`, never edited by hand: balance tables, the bot simulation, item catalog, loot/fight/kill simulations, monster ladder, stat audit. |
| [BONUSES.md](BONUSES.md) + [bonuses.html](bonuses.html) | Index of every bonus (base / additive / multiplicative), the order they combine in and every cap, for the economy, combat and loot. Hand-maintained; values are checked against the code by `tests/docs/bonuses.test.ts`. |
| [plan/](plan/ROADMAP.md) | The plans for what is **not built**: [ROADMAP](plan/ROADMAP.md), the [UI refresh layout/UX reference](plan/ui-refresh.md), [RELEASE-PLAN](plan/RELEASE-PLAN.md), drafts, research and the art prompt sheets. These are the only hand-written documents; a built draft leaves `plan/` and is described in the JSDoc. |

## Changing a rule? Change its JSDoc in the same edit

Add `@category Top/Section` to the block above the function and embed numbers by naming the config constant they come from (never type them into prose); `@formula` holds a multi-line rule.
`tests/docs/links.test.ts` fails when a relative link in `docs/` or the root README does not resolve.
