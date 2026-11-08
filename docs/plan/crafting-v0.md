# Crafting v0 (potions first)

Status: PR 1 (data and pure logic) built; server (PR 2) and overlay (PR 3) follow. The long-term design is [17-crafting](../17-crafting.md) (gear, tiers, Ichor); this file is the small first slice and wins where they differ for v0.

## Owner decision (2026-11-08)
Crafting makes three things: **usable items**, **half-products** and **sellable goods**. v0 starts with **potions only**, then components and goods, then gear.

## Kinds
| Kind | Output lives in | v0.0 |
|---|---|---|
| `potion` | the bag, as a stack (consumable, `stackMax` 20) | yes |
| `component` | a ledger counter `craft.stock` (never in the bag) | yes |
| `good` | the bag, sellable (later) | no |
| `gear` | the bag, through the loot pipeline ([17](../17-crafting.md)) | no |

A recipe (`src/catalog/recipes.ts`) is data: `kind`, `inputs` (merchant resources and components), one `output` (item id or component id plus quantity), the crafting level that unlocks it and the XP of one craft. Adding a recipe is one entry.

## Recipes
| Recipe | Inputs | Unlock | XP |
|---|---|---:|---:|
| Glass Vial (component) | 10 stone + 5 coal | 1 | 2 |
| Minor Healing Potion | 40 food + 1 Glass Vial | 1 | 6 |
| Greater Healing Potion | 150 food + 60 coal + 1 Glass Vial | 5 | 25 |

Numbers and the cost table: [generated/craft-sim.md](../generated/craft-sim.md) (`npm run craft-sim`).

## Rules
- **No printer.** A crafted potion costs less than the shop price and more than its sell value, with the inputs valued at the merchant buy-in price (a component counts at what its recipe costs). `tests/crafting` enforces it for every potion recipe. Today the cost is about 38 % of the shop price.
- **Crafted potions sit next to the shop's potions.** Same item ids, same stacks; the shop (IDL-158) is not touched.
- **Crafting level** comes only from crafting, is kept on rebirth, and is derived from lifetime crafting XP (never stored separately). The curve is anchors in `src/config/crafting.ts` (level 10 at 1,500 XP, 30 at 40k, 60 at 1M, 100 at 30M), solved like `LEVELING`. Level 10 is roughly 250 minor potions, the first days of play.
- **Limits** (PR 2): 1 to 10 crafts per request, 1 request per second, idempotent by key.
- **Bag full.** A potion craft that needs a new bag slot when none is free is refused and nothing is charged (the stack is topped up first, so a full bag with room in the potion stack still works).
- **Materials are client-held**, so the browser pays the resources and the server records the spend in `granted.spent` and the verifier counts it ([17](../17-crafting.md) section 5). Components are the exception: they are server state (`craft.stock`), so the server checks and takes them itself.
- **No failure and no randomness in v0.0.** A craft always succeeds, so there is no seed or pity yet (`craft.ord` and `craft.pity` are reserved in the column for gear).

## Server shape (PR 2)
`player_ledger.craft jsonb { xp, ord, stock, pity }`, nullable; a row without it reads as zeros. `POST /api/craft { key, recipeId, count }` answers with the new `inv` and `craft` state.

## Open questions
1. Is one vial per potion the right ratio, or should a vial craft yield two? It decides how often the vial recipe is pressed.
2. XP per recipe and the anchors are a first draft; check them against real play and the 10-week target in [17](../17-crafting.md).
3. Where do goods (sellable) and the second component families (herbs, extracts from [18](../18-biome-buildings-and-material-tiers.md)) enter, and at which crafting level?
4. Should the crafted potion carry a "crafted" marker, or stay identical to the shop's so the stacks merge (v0.0 assumes identical)?
5. Do crafted potions need the sell-junk filter to ignore them?
