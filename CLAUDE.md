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

# Assets: how new pictures are made

**Sprite Fusion first.** New pictures are made in Sprite Fusion, or are existing images recoloured, resized or given a small detail (for example the empty equipment-slot icons `public/pixel/icons/equip_*.png` are the item art, shrunk and desaturated; `.px-equip-empty` in `src/app/globals.css` dims them further). Do not write a Python generator for a picture that can be made that way.

`scripts/pixel/*.py` is the **legacy** procedural pipeline. Do not run or extend it for ordinary work (`build.py` refuses to run without `--legacy`, because it rewrites hand-made files and deletes files it does not know). Use it only in a special case: a new kind of thing Sprite Fusion cannot make yet. Say so in the PR when you do. What it still owns: the starter `item_*` icons (`sprites_gear.py`, listed in `src/config/itemIcons/`), terrain and UI parts.

# Pull request checklist: save compatibility

From the New Chapter release on, saves and ledgers stay readable forever. A PR is **save-compatible** only if it is additive (a new optional field with a default, a new resource/item/monster/biome/building/avatar/achievement id appended and never removed, renamed or reordered, a changed number, a tolerant reader) and `tests/saves/saveFixtures.test.ts` and `tests/saves/appendOnly.test.ts` pass with the fixtures in `tests/fixtures/saves/` untouched (never edit or delete one to get green; retire content with a flag, keep its id; `HARD_LIMITS` only grow). If it cannot be additive, bump `SAVE_SCHEMA` and write the pure upgrade step (`src/lib/saveUpgrade.ts`), add a fixture of the new shape (`npm run gen-save-fixtures`), and for a bigger release use `npm run migrate-saves` and a SQL migration (nullable and additive, SQL before code, rollback file). Details: `docs/plan/save-compatibility.md`.

# Release notes

Player-facing release notes are one `.md` file per version in `content/changelog/` (`<version>.md`; the format is in `content/changelog/README.md`). The landing page's Changelog window shows them, newest version first, read at build time. When the owner asks for them, collect the PRs merged since the last version, keep only what players can see, and write `content/changelog/<next version>.md`. `tests/ui/changelog.test.ts` rejects a malformed file.
