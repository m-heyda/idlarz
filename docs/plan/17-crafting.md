# 17 · Crafting: what is left (the system is built; salvage, the end-game costs and server enforcement are open)

Reviewed against the code on 2026-11-26; everything built was removed. **Built** (the code and its JSDoc are the record: `@category Economy/Crafting` in `src/catalog/recipes.ts` and `src/catalog/refined.ts`, `src/config/crafting.ts`, `src/lib/offline/craft.ts`, `scripts/craft-sim.ts` with [craft-sim](../generated/craft-sim.md)): recipes as data (potions, components, trade goods and gear, one gear recipe per grade, slot and item type), the queue with its Ember-shop slots and the workbench upgrades, the crafting level (maximum 80, never reset, slow XP) with its own Rankings board, sealed server rolls on a lifetime counter in the ledger's `craft` record, the pity per tier, Luck for rarity and Intelligence for affix quality, the enchanted craft (reroll or add one affix, for Ichor, IDL-120) and the War Medal legendary craft. [crafting-v0](crafting-v0.md) holds the first slice and the later rework notes.

**The principle that still stands: content will grow.** About ten new items, new monsters and biomes are planned, so crafting must never be tuned against today's gear alone. Recipes are data keyed by tag and tier (`craftable` tag, base family, tier window, extract and material costs), never by item id; adding an item or a set is one catalog entry, not a code change.

## What is open

### 1. Rebirth salvage (IDL-151; decided 2026-11-07)

Each unworn item gives its sell value / 4 in T0 and T1 materials (wood, stone, coal, hide; equal gold value at merchant prices) when the run restarts. The total is capped at 20 minutes of early-run income, tuned by the run-2 ratio (60 to 70 %); legendaries are never salvaged (the Vault or lost). **Order inside `/api/rebirth`:** the salvage is computed from the inventory as it is before the wipe, recorded in the ledger as one sealed grant keyed by the rebirth id, then applied on top of the new run's starting resources after the resource reset; a replayed call returns the same grant and never grants twice.

### 2. The end-game costs (IDL-349, IDL-379)

The top tiers need recipe costs ten times higher or more, with a `craft-sim` retune (the Jewelry category shipped in 0.9.0); monster reward and cost tuning belong to IDL-379. The extract amounts per recipe, the XP per craft by tier and rarity (`xpScale` in `src/config/crafting.ts`, IDL-274), the rarity ceiling per tier and the pity curve (per-miss bonus and cap) are set with `craft-sim` and the Extractor rates, not from prose.

### 3. Materials are still paid by the browser

Resources are client-held, so the server cannot deduct them: the browser pays and the spend is checked by the spending audit (a client that does not pay is flagged and unranked). **Enforced crafting** needs the server-priced merchant (IDL-121) or the server-owned economy (IDL-134); crafting is a strong reason to schedule them.

### 4. Skill materials (IDL-359)

Boss fragments and crafted cores, the prerequisite of Skills v2 (IDL-352).

## Rules that still stand

- **Loot economy:** crafted gear competes with drops. The craft profile's rarity weights stay at or below the boss and chest weights for the same item level, or crafting makes bosses pointless; the craft source is in `npm run loot-sim`.
- **No gold printer:** the craft cost must exceed the sell value of the average result.
- **Wipe synergy:** a run starts with no gear, so the cheapest craftable tier must be good enough to fight the first monsters; starter recipes at crafting level 1 roughly give the starter kit.
- **Tier unlocks by crafting level, per grade** (decided 2026-11-07, live in `src/catalog/recipes.ts`): G1 1, G2 8, G3 15, G4 25, G5 35, G6 50, G7 65, G8 80; G7 and G8 are craft-only (nothing drops them) and G9 comes only through the legendary recipes. A plain craft never rolls legendary; the eight non-top legendaries can be crafted late for War Medals, the three top-tier ones are boss and relic drops only.
