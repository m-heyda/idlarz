# Idle Realm: docs

Stack: Next.js 15.5 (App Router), React 19, Tailwind 4, Zustand 5, Supabase (accounts, cloud saves, server ledger). Live build and server setup: see the [root README](../README.md).

## One source of truth: the JSDoc in the code

How the game works (formulas, rules, numbers, the server's guarantees, the operator guides) is documented **in JSDoc blocks next to the functions and constants that implement it**, and nowhere else.
`npm run docs:code` collects those blocks into [reference/](reference/README.md); a git pre-commit hook runs it for every commit, so the reference is never older than the code.

| Folder | What it holds |
| --- | --- |
| [reference/](reference/README.md) | **Generated, never edited by hand.** One page per category (economy, combat, monsters, loot, progression, saves and server, architecture, pacing, ops), a [symbol index](reference/symbols.md) (function to file and line), a [code map](reference/code-map.md), [known issues](reference/known-issues.md), `index.html` (searchable) and `reference.json` (for tools). |
| [generated/](generated/) | Measured by `npm run docs:gen`, never edited by hand: balance tables, the bot simulation, item catalog, loot/fight/kill simulations, monster ladder, stat audit. |
| [plan/](plan/ROADMAP.md) | The plans for what is **not built**: [ROADMAP](plan/ROADMAP.md), [RELEASE-PLAN](plan/RELEASE-PLAN.md), drafts, research and the art prompt sheets. These are the only hand-written documents; a built draft leaves `plan/` and is described in the JSDoc. |

## Changing a rule? Change its JSDoc in the same edit

Add `@category Top/Section` to the block above the function (the tags are listed in [reference/README.md](reference/README.md#how-to-document-something)), embed computed numbers with `@table`, commit: the hook regenerates and stages `docs/reference`.
`tests/docs/reference.test.ts` fails when the committed reference is stale, and `tests/docs/links.test.ts` fails when a relative link in `docs/` or the root README does not resolve.
