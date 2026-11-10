# Working in this repo

**The JSDoc in the code is the single source of truth for how the game works.** Find a rule before you change it: open `docs/reference/symbols.md` (function to file and line) or the category page
(`docs/reference/economy.md`, `combat.md`, `monsters.md`, `loot.md`, `progression.md`, `saves-and-server.md`, `architecture.md`, `pacing.md`, `ops.md`). `docs/reference/` is **generated** from JSDoc blocks that carry a
`@category` tag; never edit it by hand.

- Changing a formula, constant or rule? Edit its JSDoc block in the same change (`@category Top/Section`, `@formula`, `@table id` for numbers computed from the live config; the tag list is in `docs/reference/README.md`).
- `npm run docs:code` regenerates the reference; the pre-commit hook (`.githooks/pre-commit`, installed by `npm install`) does it for every commit and stages the result. `tests/docs/reference.test.ts` fails on a stale reference.
- Tables in the reference come from `scripts/docs/tableDefs.ts` (they call the real config and maths); add one there instead of typing numbers into prose.
- `docs/plan/` (ROADMAP, RELEASE-PLAN, drafts) are the only hand-written docs: they describe what is **not built**. Do not rewrite them when documenting code.
- `docs/generated/` is measured output of `npm run docs:gen` (sim, balance tables, ...); never edit it by hand.
- Before you push, `npm run verify` runs what CI checks (format, types, lint, tests, reference docs) side by side in about a minute; the `pre-push` hook does it for you (skip once with `SKIP_VERIFY=1 git push`). When a file the generators read changed it also regenerates `docs/generated` (several minutes) and writes `docs/generated/inputs.sha256`; commit both. CI recomputes that hash: fresh means the sims are skipped, stale (you did not run it, or `main` moved) means CI runs the full regeneration (slow, as before). The full regeneration always runs on `main`, nightly and on a PR labelled `verify-generated`.
- Code is pure config + pure functions where possible; anything that decides a reward or a fight lives on the server side (`src/lib/offline/`).

# Release notes

Player-facing release notes are one `.md` file per version in `content/changelog/` (`<version>.md`; the format is in `content/changelog/README.md`). The landing page's Changelog window shows them, newest version first, read at build time. When the owner asks for them, collect the PRs merged since the last version, keep only what players can see, and write `content/changelog/<next version>.md`. `tests/ui/changelog.test.ts` rejects a malformed file.
