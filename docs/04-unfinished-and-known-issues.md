# 04 · Unfinished mechanics & open issues

Only what is **still open** is listed here; items that were fixed are removed (see the PR / git history). Legend: 🚧 unfinished feature · 🔧 small fix · ⚠️ needs a decision. The order in which to tackle them is in [08](08-followup-plan.md).

## A. Unfinished features (shipped half-built; left as they are for the next pass)

| # | Feature | State today | Where | To finish |
| --- | --- | --- | --- | --- |
| U1 | **Items beyond gear** | equipment, the 36-slot bag, drops and potions work (Damage / Armor / Max HP only); no selling, upgrading, crafting or bag expansion; gear gives no resource income | `itemCatalog.ts`, `inventory.ts` | see the roadmap in the combat spec; rebirth keeps gear (decided) |
| U2 | **Merchant → Upgrade Items** | "Coming soon" | `MerchantOverlay.tsx` | needs U1; gold/resource sink |
| U3 | **Merchant → Quests** | placeholder | same | quest model, rewards (items), tracking in store |
| U4 | **Merchant → Gambling** | placeholder | same | RNG games using `luck`; must stay inside the exploit rules ([07](07-security-and-exploits.md)) |
| U5 | **Stat points in combat** | click combat exists (rats, Rat King) but fight damage and armor come from gear only; `physicalAtk, magicAtk, mp, def, magicDef, critChance, critDmg, atkSpeed` are still display-only; `vitality` adds a little HP, `luck` raises kill gold | `calculateCombatStats`, `combat.ts` (`damagePerClick` is the hook) | stat rework: let the five stats feed damage, armor, crit and speed |
| U6 | **Reputation** | +100 per tile (derived on load); shown; nothing reads it | `StatisticsOverlay.tsx` | tie to quests/merchant discounts or remove |
| U9 | **Offline progress** | none (a closed tab does not progress; a throttled tab catches up in 5-min steps) | `tick`, `saveVault.ts` | needs trusted time (see [07 §6](07-security-and-exploits.md)) to avoid a clock exploit; cap e.g. 8 h at 50 % |
| U13 | **Building management** | buildings are permanent (no demolish/swap/upgrade) | `Tile.tsx`, `BuildingSelectionDialog.tsx` | demolish with refund, building levels |
| U14 | **Mobile / small screens** | pixel UI is desktop-first; touch pan exists, rest untested | `Grid.tsx`, modals | responsive pass |

## B. Open issues

| # | Issue | Notes |
| --- | --- | --- |
| 🔧 B4 | The castle upgrade is only visible inside the castle dialog and tooltip | add a small timer badge on the castle tile / header |
| ⚠️ B6 | Chests and tile taps are small next to the rest of the economy | decide whether they should scale with progress ([05](05-balance-backlog-and-roadmap.md)) |
| ⚠️ B7 | `sim.ts` bots tap tiles, catch map/farm critter gifts and buy Legacy upgrades, but they do not use the class picker, the stat-point allocation is a fixed policy, and their play style (reserve resources for the castle, top up with the merchant) is one reasonable strategy, not the optimum | fine for pacing checks, extend the bot before tuning small effects |
| 🔧 B8 | Rebirth wipes the character level, stat points and class-bound progress; the class itself is kept | decide with the equipment work (U1) what a rebirth keeps |
| 🔧 B9 | Rebirth has no confirmation of unspent legacy points beyond the dialog; there is no "undo" or respec of the Legacy shop | add a respec (costs one rebirth) if players complain |

## C. Technical risks

- **Performance**: every visible `Tile` re-renders on each tick (subscribes to `tiles` + `resources`). Save writes are already debounced, so only rendering remains; use per-tile selectors if the viewport grows. The ambient critters add at most 5 small DOM nodes and no timers beyond one spawn timeout.
- **No UI tests**: logic is covered by `npm test` (limiter, economy/exploit, save validation/crypto, castle, rebirth, ambient). Components are verified manually; add Playwright if the UI starts changing a lot.
- **Save compatibility**: the loader refuses invalid saves silently (falls back to the previous slot, then a new game). Any change to persisted fields needs `sanitizeSave` + a `SAVE_VERSION` decision ([07 §7](07-security-and-exploits.md)). `prestige` is optional in saves, so it needed no version bump.
- **Float drift**: resources are doubles capped at 10¹⁵. With castle 10 and Legacy bonuses the income grows by orders of magnitude, so watch the cap if more multipliers are added.
- **Dependencies held back**: Next 16, TypeScript 7, ESLint 10 (see [05 §3](05-balance-backlog-and-roadmap.md)).

## D. Combat and items: known limits

- Monsters are one family (rats); there is one weapon per tier of rarity and no item selling or upgrading yet.
- The sim bots do not fight or equip, so combat rewards (gold / XP as seconds of income) are not part of `docs/generated/sim-milestones.md`; measure before tuning them ([05 BL12](05-balance-backlog-and-roadmap.md)).
- A fight does not survive a reload (the monster is full HP again); your HP does.
- The Rat King is unkillable by design until the weapon cap and the King's HP are revisited together (guarded by `tests/kingInvariant.test.ts`).
- Ability slots are locked placeholders; MP has no use yet.
