# 04 · Unfinished mechanics & open issues

Only what is **still open** is listed here; items that were fixed are removed (see the PR / git history). Legend: 🚧 unfinished feature · 🔧 small fix · ⚠️ needs a decision. The order in which to tackle them is in [08](08-followup-plan.md).

## A. Unfinished features (shipped half-built; left as they are for the next pass)

| # | Feature | State today | Where | To finish |
| --- | --- | --- | --- | --- |
| U1 | **Items beyond gear** | equipment, the 36-slot bag, drops and potions work (Damage / Armor / Max HP / Crit / Super Crit / Regen / Luck); the merchant buys and sells bag items and Pack Rat expands the bag; no upgrading or crafting; gear gives no resource income | `src/catalog`, `inventory.ts` | see the roadmap in the combat spec; rebirth keeps gear (decided) |
| U2 | **Item upgrading** | not built: the merchant's Upgrades tab holds click power and the merchant bonuses, not gear enhancement | `MerchantOverlay.tsx` | needs U1; gold/resource sink (salvage and reroll are in [10](10-loot-system.md)) |
| U3 | **Merchant → Quests** | placeholder | same | quest model, rewards (items), tracking in store |
| U4 | **Merchant → Gambling** | placeholder | same | RNG games using `luck`; must stay inside the exploit rules ([07](07-security-and-exploits.md)) |
| U5 | **Stat points in combat** | auto-combat on the server (rats, Rat King): damage and armor come from gear and the five attributes (Strength/Intelligence for damage, Dexterity for attack speed and armor); `physicalAtk, magicAtk, mp, def, magicDef, critChance, critDmg, atkSpeed` are still display-only; `vitality` adds a little HP, `luck` raises kill gold | `calculateCombatStats`, `combat.ts` (`damagePerClick` is the hook) | stat rework: let the five stats feed damage, armor, crit and speed |
| U6 | **Reputation** | +100 per tile (derived on load); shown; nothing reads it | `StatisticsOverlay.tsx` | tie to quests/merchant discounts or remove |
| U9 | ~~**Offline progress**~~ | **built**: the server pays an absence (8 h at 50 %, the Ember shop raises both), see [11](11-offline-and-sealed-rolls.md) | `lib/offline/` | - |
| U13 | **Building management** | buildings are permanent (no demolish/swap/upgrade) | `Tile.tsx`, `BuildingSelectionDialog.tsx` | demolish with refund, building levels |
| U14 | **Mobile / small screens** | pixel UI is desktop-first; touch pan exists, rest untested | `Grid.tsx`, modals | responsive pass |

## B. Open issues

| # | Issue | Notes |
| --- | --- | --- |
| 🔧 B4 | The castle upgrade is only visible inside the castle dialog and tooltip | add a small timer badge on the castle tile / header |
| ⚠️ B6 | Chests and tile taps are small next to the rest of the economy | decide whether they should scale with progress ([05](05-balance-backlog-and-roadmap.md)) |
| ⚠️ B7 | `sim.ts` bots tap tiles, catch map/farm critter gifts and buy Ember upgrades, but they build on the first free explored tile (round-robin through six buildings), they do not use the class picker, the stat-point allocation is a fixed policy, and their play style (reserve resources for the castle, top up with the merchant) is one reasonable strategy, not the optimum | fine for pacing checks, extend the bot before tuning small effects |
| ✅ B8 | ~~Rebirth wiped the character level, stat points and class-bound progress~~ | decided: a rebirth keeps lifetime XP, the level, the attributes and the unspent points (the level curve is paced over rebirths, see 02 §10) |
| 🔧 B9 | Rebirth has no confirmation of unspent embers beyond the dialog; there is no "undo" or respec of the Ember shop | add a respec (costs one rebirth) if players complain |

## C. Technical risks

- **Performance on a big map**: measured with `npm run perf` (Node) and in the browser with synthetic maps (admin panel: +500 / +5k / +50k tiles). At 50,000 tiles: a purchase ~16 ms, the income pass ~11 ms, saving 12 ms (75 KB of text, a repeat save of the same map 2 ms), loading and validating a save ~80 ms, the minimap ~4 ms, a tick ~0 ms; the screen mounts ~550 tile elements and ~20 terrain canvases. Panning stays at 60 fps with an occasional 33-60 ms frame while tiles enter the view (mounting ~25 tile components per tile of travel) or a terrain chunk is drawn; the first picture after loading a big map fills in over a few seconds (flat colours first). Known follow-ups if it matters: make plain explored tiles one lightweight component or use event delegation, recompute income incrementally on a purchase instead of in one pass, draw chunks off the main thread (OffscreenCanvas). The ambient critters add at most 5 small DOM nodes and no timers beyond one spawn timeout.
- **No UI tests**: logic is covered by `npm test` (limiter, economy/exploit, save validation/crypto, castle, rebirth, ambient). Components are verified manually; add Playwright if the UI starts changing a lot.
- **Save compatibility**: a save that cannot be read falls back to the backup, then to a new game, and the damaged text is kept and offered in the Save dialog. A new field is optional in `sanitizeSave` (no bump); a renamed or removed one needs `SAVE_SCHEMA` + `MIGRATIONS` and a frozen fixture ([07 §7](07-security-and-exploits.md)). Content that is removed from the game (an item, a building) still makes `sanitizeSave` reject old saves unless a migration replaces it.
- **Float drift**: resources are doubles capped at 10²¹ (`RESOURCE_CAP`; it was 10¹⁵ until the tile price was made payable past ~157 tiles). With castle 10 and Ember bonuses the income grows by orders of magnitude, so watch the cap if more multipliers are added. Numbers above 10²¹ show in scientific form, ∞ is never shown by accident.
- **Map size limits**: ±16,000 tiles from the origin (`COORD_LIMIT`, 768,000 px, well inside what CSS transforms and canvas coordinates handle) and 250,000 explored tiles (`MAX_OWNED_TILES`; a full map saves as ~350 KB and loads in ~0.3 s). Zoom 0.5 for overview is deferred (the minimap covers it); the wheel zoom is four fixed steps.
- **Dependencies held back**: Next 16, TypeScript 7, ESLint 10 (see [05 §3](05-balance-backlog-and-roadmap.md)).

## D. Combat and items: known limits

- Monsters are one family (rats) plus one boss (the Rat King); there is one weapon per tier of rarity and no item upgrading yet.
- The sim bots do not fight or equip, so combat rewards (gold / XP as seconds of income) are not part of `docs/generated/sim-milestones.md`; measure before tuning them ([05 BL12](05-balance-backlog-and-roadmap.md)).
- A fight is run and held by the server (`player_ledger.combat`, `/api/fight`), not by the browser; see [11](11-offline-and-sealed-rolls.md) and [12](12-roadmap-features-and-bugs.md) (R4-R8).
- The Rat King (1000 HP behind 15 armor, 75 s) is the only source of Rattatui pieces. Fights are server-run and automatic, so there are no fight clicks to automate (the old click guard `lib/hitGuard.ts` is gone). When gear or monsters change, rerun `npm run fight-sim`.
- Heal and Stun are the only skills; the Equipment tab's two ability slots hold them (Heal is castable there, out of fights). More skills, class-specific skills and weapon-speed combat are open; classes are still cosmetic.
