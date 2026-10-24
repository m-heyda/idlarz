# Combat, monsters, items and the character window - design

Status: approved in conversation 2026-10-24, awaiting review of this written spec.
Scope: MVP of basic click combat (Rats and the Rat King), a persisted item/equipment/bag system, and a reworked Character window. Stat points stay inert in this iteration. A roadmap of follow-ups is at the end.

## 1. Goals and non-goals

**Goals**
- Rare monsters spawn on owned tiles (like chests, but rarer; max 8 on the map). Clicking one opens a fight modal. Every click deals the equipped weapon's damage.
- Monsters hit back, the player's HP regenerates over time, potions heal mid-fight, the screen shakes when the player is hit.
- Kills give XP, gold and rare item drops, including a "Rattatui" beta-tester set with one piece per equipment slot.
- Rats gain tiers while they sit on the map; a tier-5 rat can evolve into the Rat King (one at a time, 1000 HP, 60 s limit, unkillable in the MVP).
- Items, equipment and a 36-slot bag are persisted and validated. The Character window is reworked in the style of the reference screenshot (paper doll + bag + tooltips + 2 future ability slots), in the game's own pixel UI kit.
- Statistics keeps HP/MP; the HP flask shows real current HP.

**Non-goals (MVP)**
- Stat points affecting combat (the allocation UI stays; derived stats keep their current formulas).
- Crits, attack speed, skills, mana use, baby rats, item selling/upgrading, bag expansion, monster families other than rats.
- Offline combat.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| Defeat (HP 0) | Knocked out: fight ends, player returns to ~30 % max HP, monster resets to full HP. No loss of gold or items. |
| Fleeing | Same reset for the monster; no penalty. Prevents risk-free chip damage. |
| Rebirth | Equipment, bag and potions are kept (character progression). HP resets to full. Land, resources and monsters reset with the rest of the run. |
| Taunts | Mild default lines in config (`COMBAT.king.taunts`); wording is freely editable. |
| Baby rats | Roadmap, not MVP. |
| Architecture | Pure logic modules + thin store actions (approach B of the design discussion). |

## 3. Architecture

New files (all pure functions unless noted, unit-testable like `tests/economy.test.ts`):

```
src/config/combatConfig.ts   COMBAT, MONSTERS, KING, LOOT tables, REGEN, POTION constants (all tunables)
src/config/itemCatalog.ts    ITEM_CATALOG (id -> ItemDef), RATTATUI_SET, STARTER_ITEMS, EQUIPMENT_SLOTS layout
src/lib/combat.ts            stepFight(), damagePerClick(), mitigate(), maxHp(), regen()
src/lib/monsters.ts          pickSpawnTile(), tierFor(ageSec), monsterStats(type, tier), shouldEvolve()
src/lib/loot.ts              rollKillLoot(rng, monster, luck) -> {gold, xp, items[]}
src/lib/inventory.ts         addToBag(), removeFromBag(), equip(), unequip(), moveSlot(), aggregateStats()
src/lib/combatFx.ts          tiny module-level event queue (hit, hurt, heal, toast) consumed by the modal; same idea as lib/floatText.ts
src/components/game/overlays/FightModal.tsx
src/components/game/overlays/CharacterOverlay.tsx   (rewritten)
src/components/game/MonsterSprite.tsx               (map entity, rendered in Grid)
src/components/game/ItemSlot.tsx, ItemTooltip.tsx, Bag.tsx
```

Store (`gameStore.ts`) gains thin actions that validate, call these modules and `set()`:
`startFight(monsterId)`, `hitMonster(input: ClickInput)`, `leaveFight()`, `drinkPotion(bagIndex)` (not `usePotion`: the react-hooks lint rule treats `use*` as a hook), `equipItem(bagIndex)`, `unequipItem(slot)`, `moveBagItem(from, to)`, plus the monster/regen/fight steps inside `tick()`.
`tick()` order becomes: resources -> XP -> castle timer -> chests -> **monsters (spawn, age, evolve)** -> **fight step or regen** -> level/stat points -> one `set()`.

## 4. Data model and persistence

```ts
type EquipmentSlot = 'head'|'shoulder'|'chest'|'hands'|'legs'|'feet'|'neck'|'cape'|'ring1'|'ring2'|'charm'|'mainHand'|'offHand';
type ItemStats = { damage?: number; armor?: number; maxHp?: number };
interface ItemDef { id: string; name: string; slot?: EquipmentSlot | 'ring'; /* 'ring' fits ring1 or ring2 */ rarity: EquipmentRarity;
                    stats?: ItemStats; set?: string; description?: string;
                    consumable?: { healHp: number; cooldownSec: number }; stackMax?: number; sellValue: number; icon: PixelIconName }
type BagSlot = { id: string; qty: number } | null;     // saved by reference
interface Monster { id: number; type: 'rat'|'ratKing'; tier: number; x: number; y: number; ageSec: number }
```

New state: `equipment: Partial<Record<EquipmentSlot, string>>` (item ids), `bag: BagSlot[]` (length 36), `playerHp: number`, `monsters: Monster[]`, `monsterSpawnTimer: number`, `nextMonsterId: number`.
Transient (not saved): `fight: { monsterId, monsterHp, attackTimer, kingTimeLeft?, potionCd } | null`.
The old `Item`/`inventory`/`INITIAL_INVENTORY_ITEMS` (resource-per-second stats, never saved, never equippable) are removed.

**Save format**: the new fields are added to `PERSISTED_KEYS` as *optional on load* so existing v12 saves stay valid (`SAVE_VERSION` unchanged). On load, missing `equipment`/`bag` get the starter kit equipped; missing `playerHp` = max.
`sanitizeSave` validates: every id exists in `ITEM_CATALOG`; an equipped item's slot matches (a `'ring'` item in ring1/ring2); bag length is exactly 36; `qty` is an integer in `1..stackMax`, and only consumables stack (gear is `qty 1`, duplicates are separate bag entries); `playerHp` in `0..maxHp`; monsters: type known, `tier` 1-5 (king tier 1), tile owned, not castle, no chest on the same tile, at most 8 monsters and at most one `ratKing`, `ageSec` bounded. Derived values (max HP, damage, armor) are recomputed, never trusted.

## 5. Combat rules

All numbers live in `combatConfig.ts`.

- **Damage per click**: `weaponDamage` (equipped main hand; 0 without weapon -> falls back to 1). Starter Wooden Sword = 2. No crits in the MVP; `damagePerClick()` is the single hook the stat rework will extend.
- **Click validation**: `hitMonster` takes the same `ClickInput` as `clickForGold` and consumes a token from the shared `clickLimiter` (untrusted or rate-limited clicks do nothing).
- **Monster attack**: attack timer in game seconds. Rat: about 4 damage every 2.0 s (tier raises it). Damage taken = `round(raw * (1 - armor / (armor + 40)))`, minimum 1.
- **Max HP**: `COMBAT.baseHp (85) + characterStats.hp + gear maxHp` (about 100 at game start). `characterStats.hp` keeps its current vitality formula until the stat rework.
- **Regeneration**: about 1 HP/s while no fight is active, none during a fight. Persisted `playerHp` prevents reload-heals.
- **Potions**: Minor Healing Potion restores 35 HP; shared 8 s cooldown (fight-scoped, starts at 0 on fight start). Usable outside fights too. Stack max 20.
- **Fight step clamp**: `stepFight` receives `min(dt, 1 s)` so a throttled/background tab slows the fight instead of fast-forwarding the monster's attacks (and the king timer) across a 300 s catch-up. Resource income still uses the normal catch-up path.
- **Defeat**: `playerHp` -> 30 % of max, fight cleared, monster reset to full HP (it was never persisted damaged), "Knocked out" panel then modal closes.
- **Victory**: monster removed; rewards applied in one `set()`; kill toast shows gold/XP/items.
- **Rewards** (scaled like chests, "seconds of income"): gold = `max(minGold, goldPerSec * rewardSec(tier) * luckBonus)`, XP = `max(minXp, xpPerSec * rewardSec(tier))`, `rewardSec` grows with tier. Rat T1 ~ 90 s of income. Item drops: ~8 % one random Rattatui piece, ~25 % a Minor Healing Potion (rates rise slightly with tier). Bag full -> the item is converted to its `sellValue` in gold and the toast says so.

Balance check (design target, tuned in config): an unarmored T1 rat fight of ~15 s costs ~30-40 HP; regeneration restores that in ~30-40 s; a T3+ rat starts making a potion worthwhile.

## 6. Spawning, tiers, Rat King

- **Spawn**: `monsterSpawnTimer` runs in `tick()` only while `monsters.length < 8`. First spawn after `COMBAT.spawn.firstSec` (120 s) once at least 5 tiles are owned, then every `COMBAT.spawn.intervalSec` (900 s; chests are 600 s). Tile: random owned, non-castle tile with no chest and no monster. `GameDebug` gets a "spawn rat" helper.
- **Aging / tiers**: `ageSec` advances in tick delta; `tier = min(5, 1 + floor(ageSec / 1800))`. `monsterStats(type, tier)`: HP x1.5 per tier (100 -> ~506 at T5), attack and rewards scale up per tier. Tier shown as a badge and in the tooltip with time to next tier.
- **Evolution**: a tier-5 rat rolls every `KING.evolveCheckSec` (600 s of age beyond tier 5) with `KING.evolveChance` (35 %), only if no king exists; on success that monster becomes the Rat King on the same tile.
- **Rat King**: 1000 HP, `KING.timeLimitSec = 60`, never tiers or evolves, attack tuned so the timer (not player HP) is the normal loss condition. On timeout *or* knockout: random taunt toast, fight cleared, king stays at full HP.
- **Unkillable invariant**: weapon damage in the MVP catalog is capped at 3 per click. Max clicks in the time limit = `CLICK_LIMIT.capacity + CLICK_LIMIT.refillPerSec * 60 = 308`; 308 x 3 = 924 < 1000. A unit test computes this from the real constants and the catalog's best possible gear and fails if a change makes the king killable. Intended to be lifted deliberately in a later iteration.

## 7. Items

Equipment layout (from the reference): left column head, shoulder, chest, hands, legs, feet; right column neck, cape, ring, ring, charm; bottom weapon (`mainHand`) and shield (`offHand`) with two locked ability slots between them.

- **Starter kit** (equipped at new game / on first load of an old save): Wooden Sword (`damage 2`, common) and Wooden Shield (`armor 2`, common).
- **Rattatui Set** (beta-tester set, 13 pieces): Rattatui Cap (head), Shoulderpads, Tunic (chest), Gloves (hands), Trousers (legs), Boots (feet), Amulet (neck), Cloak (cape), Ring x2 (same item, either ring slot), Charm, Fang Blade (mainHand, damage 3, the damage cap), Buckler (offHand). Rarity uncommon-epic, small `armor`/`maxHp` per piece. Tooltips list "Rattatui Set (n/13)" with owned pieces highlighted. One or two small set bonuses (e.g. 6 pieces: +10 max HP; 13: +15 max HP) via the same `aggregateStats()` so there is no second code path.
- **Minor Healing Potion**: consumable, stack 20.
- `aggregateStats(equipment)` is the only place that sums gear; `damagePerClick`, `mitigate`, `maxHp` and the Character window read it.

## 8. UI

**Map entity** (`MonsterSprite`, rendered with the tile like the chest): idle-animated rat, tier badge, tooltip in the existing `MapTipLayer` ("Rat - Tier 2 - 160 HP - next tier in 12 min - Click to fight"). Click stops propagation: opens the fight, no tile tap, no gold click. Only trusted clicks count.

**FightModal** (`PixelModal`, md, portal to body like the castle dialog):
- large rat sprite at an integer scale; each hit plays a blood burst (CSS squares from a small pool, no sprites needed), a white hit-flash and a floating damage number;
- monster HP bar with a delayed trail, player HP bar, 3 potion buttons (1-3 hotkeys) with cooldown sweep, Flee button; Rat King shows its 60 s countdown;
- when the player is hit the modal shakes (transform only); `prefers-reduced-motion` replaces shake and burst with a colour flash;
- Esc/backdrop = Flee. Defeat and victory panels.

**Character window** (rewritten, `lg`): hero alcove (`LevelDetails`) centred between two slot columns; weapon/ability/ability/shield row beneath; Damage / Armor / Max HP readouts; right panel "Items Bag" 6x6. Interactions: hover tooltip (name in rarity colour, slot, stats, set progress, description, sell value), double-click or right-click equips, click an equipped slot to unequip, drag to rearrange the bag. Empty equipment slots show the dim silhouette from the existing pipeline. The old "Equipment Bonuses" per-second panel is removed. The class picker keeps its double-click on the hero; a small Stats button opens the Statistics window.

**Flask / Statistics**: `LevelDetails` HP flask uses `playerHp / maxHp`; Statistics' Combat Stats shows live `HP: current / max` (resolves follow-up item A4 in docs/08).

## 9. Art (scripts/pixel)

New sprites: `monster_rat` (2-frame idle sheet), `monster_ratking` (crowned, larger), `item_potion_hp`, empty-slot silhouettes `equip_shoulder/hands/cape/charm`, and 13 Rattatui item icons generated by re-skinning the existing slot geometry with rat-themed materials (grey-brown fur, pink accents). Wooden sword/shield reuse the existing icons with wood materials. Per `reference/STYLE.md`: samples of the rat, the king and one Rattatui piece are shown for approval before the full build; after approval `build.py --refs` runs and STYLE.md is updated. Icons are registered in `src/config/pixelIcons.ts`.

## 10. Testing

New tests under `tests/`: `combat.test.ts` (damage, mitigation, retaliation, potion cooldown, knockout/flee reset, timer clamp), `monsters.test.ts` (spawn cap and eligible tiles, tier by age, evolution only with no king), `loot.test.ts` (deterministic RNG tables, bag-full fallback), `inventory.test.ts` (equip/unequip/swap, ring slots, stack rules), `saves.test.ts` additions (forged item ids, wrong slot, oversized bag/stack, too many monsters/kings, HP out of range, old v12 save without the new fields), `kingInvariant.test.ts` (unkillable check from real constants). Click limiter reuse is covered by asserting `hitMonster` consumes tokens. Existing sim/balance scripts get no combat bot in the MVP; the rewards formula uses income seconds so the economy comparison in docs/generated stays valid (documented as a balance backlog item).

## 11. Docs

Update `docs/01-architecture.md` (file map, state, loop order, persistence), `02-mechanics.md` (combat, monsters, items), `03-formulas-and-scaling.md` (damage, armor, rewards, tiers), `04` (resolved A4, new known issues), `05`/`08` (new backlog and roadmap), `07` (new save validation surface), and `scripts/pixel/reference/STYLE.md` (new sprites).

## 12. Delivery plan (milestones, each merge-ready)

1. **Item foundation**: catalog, store state, equip/bag actions, save validation, tests (no UI change except a tooltip-less Character window update).
2. **Character window rework**: paper doll, bag, tooltips, drag/drop, aggregate readouts.
3. **Combat core**: monsters state, spawn/aging, map sprite (placeholder art), FightModal, retaliation, regen, potions, knockout/flee, rewards and loot, tests.
4. **Rat King + polish**: king rules, taunts, shake/blood FX, reduced-motion path, sounds.
5. **Final art + docs**: approved sprites, STYLE.md/docs update, balance pass notes.

## 13. Roadmap (not in this iteration)

- **Stat rework**: Strength/Dexterity/etc. feed damage, armor, crit, attack speed; `damagePerClick()` and `aggregateStats()` are the extension points.
- **Monster families** per biome (wolves in forest, crabs on the coast, bog things in swamp), a bestiary with kill counts, and monster-specific loot tables.
- **Rat nests / baby rats**: tier 3+ rats occasionally spawn a baby rat (subject to the 8 cap) for a swarm-pressure mechanic.
- **Skills**: the 2 ability slots hold active skills with mana cost and cooldown (heal, power strike), using the existing MP value; passive skill tree later.
- **Items**: upgrade/enchant as a gold sink, selling to the merchant, crafting at the blacksmith building, more sets and set bonuses, bag expansion ("Add 5 slots"), item levels and random affixes.
- **Combat depth**: crits and weapon speed, monster abilities (bleed, enrage), boss rotation with the Rat King becoming beatable via a deliberate damage-cap lift and its own loot.
- **Quests/achievements** tied to kills (docs/08 C3), daily bounty monster.
- **Auto-battle** unlock for idle play (rate-limited, weaker than manual) and offline-safe combat once server-verified saves exist (docs/08 Phase D).
- **Mobile layout** for the fight modal and bag (docs/08 C8).
