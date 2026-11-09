# Reference: generated from the code's JSDoc

**This folder is generated. Do not edit it.** It is rebuilt from the JSDoc blocks that sit next to the code by `npm run docs:code`, and a git pre-commit
hook (`.githooks/pre-commit`) runs that for every commit. The JSDoc in `src/`, `scripts/`, `e2e/` is the **single source of truth** for how the game works;
the planning documents in `docs/plan/` (ROADMAP, RELEASE-PLAN, drafts) are the only hand-written docs left, because they describe what is *not built*.

Open [index.html](index.html) for the searchable version, or read the Markdown pages below. [symbols.md](symbols.md) maps every documented function to its
file and line; [reference.json](reference.json) is the same data for tools; [code-map.md](code-map.md) lists every source file with its first comment.

## How to document something

Write a JSDoc block directly above the function, constant or type that implements the rule, and add `@category`:

```ts
/**
 * Gold price of the next tile. One sentence a human or an agent can read first.
 *
 * Any markdown prose: rules, why, edge cases. Name other documented symbols with {@link calculateTileCost}.
 *
 * @category Economy/Tiles
 * @formula
 * price(n) = floor(55 x 1.13^min(m,15) x ...)
 * @example price(10) = 186
 * @table tile-price-examples
 * @see calculateTileCost
 * @knownissue IDL-221 what is wrong and what decides it
 */
export const tilePrice = ...
```

| Tag | Meaning |
| --- | --- |
| `@category Top/Sub` | **Required.** `Top` is one of the categories below, `Sub` is the section inside its page (free text, created on first use). |
| `@title Text` | Only for a free-standing topic: a block with no declaration under it (a rule that spans several functions, the threat model, a file overview). |
| `@formula` | A multi-line formula or rule table, rendered as a code block. |
| `@example` | A worked example, rendered as a code block. Prefer `@table` for numbers: a table is computed from the real code and cannot go stale. |
| `@table id` | Embeds a table computed from the live config by `scripts/docs/tables.ts` (add the id there). |
| `@see a, b` | Related symbols or files. A documented symbol becomes a link. |
| `@knownissue text` | An open code-side finding. Collected on [known-issues.md](known-issues.md). |
| `@order n` | Sort position inside its section (default: file order). |
| `{@link name}` | In prose, a link to another documented symbol. |

Rules: describe what the code does *now*, not plans (plans go in `docs/plan/`); never repeat a number the config holds in a long list, use `@table`;
when the code changes, change the block in the same edit. `tests/docs/reference.test.ts` fails when the committed reference is stale.

## Pages

- [Overview](overview.md) (2): What the game is and how the loop fits together.
- [Economy](economy.md) (61): Income, tiles, buildings, castle, farm, merchant, clicks, chests and Luck.
- [Combat](combat.md) (30): The player's numbers, the server's fight engine, auto-battle, skills and win chance.
- [Monsters](monsters.md) (14): The roster, levels, growth, spawning and what a kill pays.
- [Loot](loot.md) (21): The loot pipeline, rarities, affixes, sets, sell values and how to add content.
- [Progression](progression.md) (19): Levels, attributes, skills, rebirth, Embers, limits and gems.
- [Saves & Server](saves-and-server.md) (23): The save, cloud-save checks, the ledger, sealed rolls, away time and the threat model.
- [Architecture](architecture.md) (6): Stack, state, the tick loop, the map, rendering and the art pipeline.
- [Pacing](pacing.md) (3): The pace the economy is tuned for, and the bot simulation that checks it.
- [Ops](ops.md) (5): Commands, CI, the pacing guard, season resets and the E2E test account.
- [Known issues](known-issues.md): open code-side findings
- [Symbol index](symbols.md): function → file and line
- [Code map](code-map.md): every source file
