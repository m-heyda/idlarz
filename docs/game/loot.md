

## 6. Adding content (data only)

- **A base item**: add `gear(id, name, slot, rarity, stats, { tier, ... })` to a file in `src/catalog/items/`. Its stats are authored at the first level of its tier's window (`LEVEL_WINDOW_BY_TIER`). It joins the general pool automatically (tags `gear`, not `named`). Register its icon as one line in `src/config/itemIcons/<slot>.json` if it has art (see its README).
- **A named item** (fixed identity and rarity): same builder with `named: true, pools: ['some_pool']`, then put the pool in a profile's `bonusTables`.
- **An affix**: one row in `src/catalog/affixes.ts` (`pair(...)` makes a prefix and a suffix of a stat).
- **A rarity**: one row in `RARITIES`, then a weight for it in each profile that should drop it, and `allowedRarities` already includes every rarity key for bases. No generator change (`tests/loot/lootGenerate.test.ts` proves it with a fake rarity).
- **A profile / source** (elite monster, premium chest): add the profile and a `LOOT_SOURCES` entry, then point the monster or chest at it.
- **Tuning**: weights, chances, levels and curve are all config. Run `npm run loot-sim -- --md`.

`validateLootData` (src/lib/loot/validate.ts, run by `tests/loot/lootValidate.test.ts`) checks: sources reference profiles, profiles reference pools and rarities, weights are non-negative with at least one positive, roll counts and guarantees, level windows, known slots/tags/rarities, no empty enabled pool, and that every weighted rarity has an eligible base at **every item level the source can reach** (a monster source's `levels` range, or castle 1-10 for chests and the shelf).
