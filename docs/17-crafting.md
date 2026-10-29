# 17 · Crafting (design draft, nothing built)

A late-game system: spend run materials to craft gear. Luck decides rarity, Intelligence the affixes, a **crafting level that never resets** decides what can be crafted and at which item level. It is the answer to the gear wipe at every rebirth ([13](13-rebirth-reset-and-paragon.md)) and the sink for the T2 materials ([12](12-rebirth-biomes.md)).

> **Content will grow.** About ten new items (with new monsters and biomes) are planned, so crafting must not be built around today's item list. Recipes are **data keyed by tag and tier** (`craftable` tag, base family, tier window, extract and material costs), never by item id; the first version may list the current bases, but adding an item or a monster-dropped set is one catalog entry, not a code change. Crafting tiers, item-level windows and the T3 extracts are the stable vocabulary ([18](18-biome-buildings-and-material-tiers.md), [20](20-monster-families-and-rewards.md)); the items are the content that fills it. Do not tune the crafting numbers against the current gear (steel, obsidian, Rattatui) only.

## 1. Building blocks that already exist (reuse, do not rebuild)
- The **loot pipeline** (`lib/loot/generate.ts`, [10](10-loot-system.md)): profile -> item level -> eligible bases -> rarity draw -> base -> affixes -> `ItemInstance { base, level, rarity, quality, affixes[] }`. Crafting is a new **source** (`craft`) with its own profile, not a second generator.
- Five rarities (`catalog/rarity.ts`: common 0, uncommon 1, rare 2-3, epic 3-4, legendary 4-5 affixes) and `rarityLevelGate` (a rarity can be gated above an item level). Item level 1-100 (`MAX_ITEM_LEVEL`).
- Prefix/suffix affixes with power and item-level gates (`catalog/affixes.ts`); Luck helpers (`lib/luck.ts`: `rarityLuckMultiplier`, cap 1.6).
- Sealed, idempotent server rolls (`lib/offline/seal.ts`) and the ledger inventory with `applyOp` (`lib/inventory.ts`).
- The merchant's **Quests / Gambling** tabs are placeholders; crafting gets its own overlay (header menu) rather than a merchant tab.

## 2. The loop
1. Pick a **recipe** (a slot/base family and a tier), see its material cost and the odds panel (rarity chances at your Luck, item-level range at your crafting level).
2. **Craft** (basic): materials are spent, the server rolls the result, the item lands in the bag (full bag -> the usual overflow-to-gold rule). Crafting XP is awarded **only for crafting**.
3. **Craft enchanted** (locked for now): costs Ichor ([12](12-rebirth-biomes.md)); rolls or improves affixes. The button is present and disabled with the reason ("Needs Ichor from the Blight").

### Stats
| Stat | Effect on crafting |
|---|---|
| **Luck** | the rarity draw, using `rarityLuckMultiplier` on the craft profile's weights (same cap as loot, so crafting cannot out-scale drops) |
| **Intelligence** | where in its range each affix magnitude rolls (a small bias toward the top) and, for enchanted crafts later, the chance of an extra affix. **Not** the rarity, so the two stats stay different decisions |
| **Crafting level** | unlocks tiers and sets the item level (below) |

### Item level and tiers
`itemLevel = clamp(craftingLevel x 1.0 + luckBonus)`, where `luckBonus` is a small roll (0 to +5, weighted by Luck) and the result never exceeds 100. Tiers unlock at crafting levels (proposal: starter 1, steel 15, cloth/leather tier 30, obsidian 50, legendary bases 80+). A recipe lists which base family it makes (`LOOT_POOLS`), so the existing item catalog is the recipe book: no new item definitions are needed for the first version, only a `craftable` flag/tag per base and a cost.

Rarity floor and ceiling by tier prevent the early recipes from giving legendaries (`rarityLevelGate` already supports this): common..rare at the starter tier, epic from 50, legendary only from 70 and only from legendary-capable bases.

## 3. Materials

> The tier ladder (T0 base, T1 farm, T2 biome goods, T3 extracts from the biome Extractors, T4 relics) and the extract list are in [18](18-biome-buildings-and-material-tiers.md). Recipes name their extracts: Iron Ore and Scrap Steel for metal, Salt for tanning, Sap/Venom for coatings, Herbs/Spores/Royal Jelly for potions and enchant prep, Pearls/Frostshard for trinkets, Dye for cloth tiers, Corrupted Core with Ichor for enchanted crafts. This also settles the "iron" question: Iron Ore comes from the Hills' Deep Mine.
Basic craft costs: **wood, stone, hide** (T0/T1, available from the first run) for early tiers; **iron/copper-type ore** is not in the game (the reserved `iron` icon exists; `copper` does not). Proposal: introduce **Iron** later as a hills output, or use **coal** and **stone** as the metal stand-in until then. Higher tiers add the T2 materials: **Hardwood** (weapons/handles), **Cloth** (armor, cloaks), **Honey** (potions, polish and enchant-prep reagents), **War Medals** (set pieces and the legendary tier). **Ichor** is the enchanting reagent.

Each recipe's cost is a few **minutes of income** at the matching tier (the rule used for tiles: "minutes to cover" in the sim), so a rebirthed player can afford early tiers on day 1 of a run and the high tiers only in the later part of a run. Because the **materials reset with the run but the level does not**, crafting speed is bounded by run economy: that is what stretches progression past a month without a timer.

## 4. Crafting level and pacing (target: 1 month or more to max, never reset)
- XP only from crafting: `xp = baseXp(tier) x (1 + 0.1 x min(rarityRank, 4))`, with a small bonus when the craft's item level is within 5 of the player's current tier ceiling (so crafting the highest unlocked tier is the best XP, but not by much).
- Curve as anchors (same technique as `LEVELING.anchors`), **proposal for a daily active player**: level 10 after day 1, 30 after about 1 week, 60 after about 3 weeks, 80 after about 4-5 weeks, **100 after about 6 weeks**; faster than that only with the paragon-style bonuses later. The real durations come from a `scripts/craft-sim.ts` (new): a seeded bot that crafts the best affordable recipe each visit on top of the economy sim's per-day material income. The target is then enforced by tests like `fightBalance.test.ts`.
- The level is character progression: **kept on rebirth**, shown with its own XP bar in the crafting overlay and a line in the Character window. It is stored on the server (section 5).

## 5. Server and data
- **State**: `player_ledger.craft jsonb` `{ xp, ord, pity }` (additive nullable column, migration `crafting_ledger.sql`, applied before the deploy; rows without it are read as zeros, like `inv`). Crafting level is derived from `xp` (never stored independently).
- **Request**: `POST /api/craft { key, recipeId, count (1-10) }`. The server checks the recipe, tier unlocked at the ledger's crafting level, and rolls with a seed `HMAC(LOOT_SECRET, userId / "craft" / ord)`. **`ord` is lifetime, not per run**: the per-run counters (`ord_chest`, `ord_kill`) restart with a rebirth under a new `run_id`; crafting must not, or every run would roll the same sequence. The result goes into the ledger bag through `receiveInto` like a chest item; the answer includes the new `inv` and `craft` state. The same key replays the same answer.
- **Materials are the weak point.** Resources are still client-held (the economy is the browser's, [ROADMAP](ROADMAP.md) items 2 and 4), so the server cannot deduct them. First version, same trade-off as `buyShop`: the browser pays the materials, the server records the spend in `granted.spent` (a new total) and the save verifier counts it in the spending audit (`audit_ratio`), so a client that does not pay is flagged and unranked. The proper fix is the server-priced merchant / server-owned resources; crafting is a strong reason to schedule it, so mark it as the dependency for *enforced* crafting.
- **Limits**: max 10 crafts per request, 1 request per second per player, the bag-full rule, and a daily craft count in the ledger purely as a guard (no gameplay cap).
- **Rankings**: crafting level may become a ranking column later ([15](15-leaderboard-and-world-preview.md)); it is derived from the ledger, never from the client.

## 6. Impact checks before building
- **Loot economy**: crafted gear competes with drops. The craft profile's rarity weights must stay at or below the Rat King and chest weights for the same item level, or crafting makes bosses pointless. Add the craft source to `npm run loot-sim`.
- **Wipe synergy**: a run starts with no gear; the cheapest craftable tier must be good enough to fight the first rats. Starter recipes at crafting level 1 should produce roughly the starter kit.
- **Sell value**: crafted items sell for gold like others (`sellValueOf`); the craft cost must exceed the sell value of the average result, or crafting is a gold printer.
- **Ichor/medals** do not exist before the Blight and Battlefield (rebirths 4 and 5), so "enhanced" crafting and the legendary tier are naturally late.

## 7. Open questions
1. Iron: add as a real material (a hills/Battlefield output) or use stone/coal as the metal stand-in?
2. Should Intelligence also affect the *number* of affixes in basic crafts, or only magnitudes (proposed)?
3. Crafting progression target: is "about 6 weeks for a daily player" the right reading of "1 month+ to craft top-tier legendaries"?
4. Ship order: crafting before or together with the gear wipe ([13](13-rebirth-reset-and-paragon.md))? (Recommended: crafting first, or the same release.)
