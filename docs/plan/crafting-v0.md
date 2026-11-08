# Crafting v0 (potions first)

Status: v0.0 built in three PRs (data and pure logic, server, overlay). The long-term design is [17-crafting](17-crafting.md) (gear, tiers, Ichor); this file is the small first slice and wins where they differ for v0.

## Owner decision (2026-11-08)
Crafting makes three things: **usable items**, **half-products** and **sellable goods**. v0 starts with **potions only**, then components and goods, then gear.

## Kinds
| Kind | Output lives in | v0.0 |
|---|---|---|
| `potion` | the bag, as a stack (consumable, `stackMax` 20) | yes |
| `component` | a ledger counter `craft.stock` (never in the bag) | yes |
| `good` | the bag, sellable (later) | no |
| `gear` | the bag, through the loot pipeline ([17](17-crafting.md)) | no |

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
- **Crafting level** comes only from crafting, is kept on rebirth, and is derived from lifetime crafting XP (never stored separately). The curve is anchors in `src/config/crafting.ts` (level 10 at 7,500 XP, 30 at 200k, 60 at 5M, **80 at 30M = the maximum**), solved like `LEVELING`. Decided 2026-11-09 (owner): the level **never resets** (one crafting level for the whole account, a long-term goal across rebirths), the cap is 80, and XP is slow: level 10 is roughly 1,250 minor potions.
- **Limits** (PR 2): 1 to 10 crafts per request, 1 request per second, idempotent by key.
- **Bag full.** A potion craft that needs a new bag slot when none is free is refused and nothing is charged (the stack is topped up first, so a full bag with room in the potion stack still works).
- **Materials are client-held**, so the browser pays the resources. `buyShop` records no spend and `verify.ts` has no spending audit yet, so v0.0 only counts the gold value of the resources in `craft.spent` (the data a later audit needs); it does not touch `granted` or the verifier ([17](17-crafting.md) section 5). Components are the exception: they are server state (`craft.stock`), so the server checks and takes them itself.
- **No failure and no randomness in v0.0.** A craft always succeeds, so there is no seed or pity yet (`craft.ord` and `craft.pity` are reserved in the column for gear).

## Server shape (PR 2)
`player_ledger.craft jsonb { xp, ord, stock, pity, spent, last }` (`last` = the 1 request per second limit), nullable; a row without it reads as zeros. `POST /api/craft { key, recipeId, count }` answers with the new `inv` and `craft` state.

## Progression and rankings (owner, 2026-11-08)
- **Crafting is a grind with gates.** New recipes unlock only at a crafting level (`Recipe.unlock`), and the level comes only from crafting, so the player has to craft the cheap recipes in volume to reach the better ones. Each tier of recipes is a step up in cost and in XP per craft, but the XP needed per level grows faster than the XP per craft, so the same recipe is not enough for long. Rule for new recipes: the first craft of a recipe is reachable after a day or more of the previous tier, never by one big purchase.
- **Crafting level is a ranking column later** ([15](15-leaderboard-and-world-preview.md)). It is derived from `craft.xp` in the ledger, never from the save, so it is enforced and not poisoned by a forged upload; the leaderboard row would copy the level when the ledger changes. Not in v0.0.

## Timed batch queue (v0.1, owner request 2026-11-08)
Linear: IDL-233 (queue, urgent), IDL-235 (upgrades).
**Built (IDL-233).** `craft.queue` is a list of `{ recipeId, count, startedAt, timeSec }` inside the existing `craft` jsonb column (no migration). `POST /api/craft` queues a batch of a timed recipe (instant recipes still craft at once), `POST /api/craft/claim { key, slot? }` pays what is finished (a claim moves `startedAt` forward and lowers `count`, so there is no stored `done`), `POST /api/craft/cancel { key, slot? }` pays the finished part and refunds the rest (components to the stock, resources named in the answer for the browser). The limits are `craftBatchCap` (10, hard 1,000), `craftQueueSlots` (1, hard 5), `craftOfflineHours` (8, hard 72) and `craftSpeed` (1, hard 4) in `config/limits.ts`. A rebirth empties the queue with the stock. Items per hour, hours per level and gold burned per hour: [craft-sim](../generated/craft-sim.md).
v0.0 crafts instantly (1 to 10 per request) but is built so the next step is a **queue**, not a rewrite:
- **A craft takes time per item** (`Recipe.timeSec`, 0 = instant in v0.0). The player queues a **batch of up to 1,000 items** (for example 1,000 potions at 14 s each is about 4 h) and the batch **keeps running while the player is away**, like the offline grant.
- **The server owns the clock.** The ledger holds one queue entry `{ recipeId, count, startedAt, timeSec }`; the output is not stored as a timer per item but derived: `done = min(count, floor((now - startedAt) / timeSec))`. A claim (opening the overlay, `POST /api/craft/claim`) pays the finished items with the usual bag-full rule (the rest waits in the queue, it is never converted to gold), adds the XP and shortens the entry. Idempotent by key, like every route.
- **The resources are paid up front for the whole batch** (the browser pays, the server counts it in `craft.spent`); cancelling refunds the unfinished part (browser-held resources: the cancel answer names the refund and the browser adds it). Components are taken from `craft.stock` when the batch is queued.
- **Limits stay data**, so upgrades can raise them: queue length (slots), the batch cap (10 now, 1,000 later), the offline run cap (hours the queue may run unattended), and a speed multiplier on `timeSec`.
- **Upgrade hooks** (all optional, Ember shop or building shaped, `limitOf` with a `HARD_LIMITS` ceiling): *Workbench* (faster crafts), *Second queue slot*, *Apprentice* (longer offline run), *Efficient hands* (a chance or a flat % off the resource cost, which must keep the no-printer rule). Resources are the other lever: scarcer inputs make a batch a real decision.
- **Pacing.** With time per item the crafting level is limited by time as well as by material; `craft-sim` must report items per hour, hours per level and the gold value burned per hour, so a 4 h batch pays about the same XP per hour as hand-crafting.
- Open: do crafts of a running batch count for the `ord` seed of gear; does the batch pause during a fight (proposal: no, crafting is a workshop and runs on its own).

## Open questions
1. Is one vial per potion the right ratio, or should a vial craft yield two? It decides how often the vial recipe is pressed.
2. XP per recipe and the anchors are a first draft; check them against real play and the 10-week target in [17](17-crafting.md).
3. Where do goods (sellable) and the second component families (herbs, extracts from [18](18-biome-buildings-and-material-tiers.md)) enter, and at which crafting level?
4. Should the crafted potion carry a "crafted" marker, or stay identical to the shop's so the stacks merge (v0.0 assumes identical)?
5. Do crafted potions need the sell-junk filter to ignore them?
