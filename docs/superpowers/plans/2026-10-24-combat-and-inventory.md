# Combat, Monsters, Items and Character Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-combat against map monsters (Rats, Rat King), a persisted item/equipment/36-slot bag system with the Rattatui beta set, and a reworked Character window.

**Architecture:** Pure logic modules in `src/lib` (`inventory`, `combat`, `monsters`, `loot`, `combatFx`) with tunables in `src/config` (`combatConfig`, `itemCatalog`); thin actions in the single `gameStore`; items are saved by id reference and validated in `sanitizeSave`. Fights are transient state; monsters, gear, bag and `playerHp` are persisted.

**Tech Stack:** Next.js 15 / React 19 / TypeScript strict, Zustand 5 (persist + encrypted IndexedDB vault), `node:test` via `tsx`, Python pixel pipeline (`scripts/pixel`).

**Spec:** `docs/superpowers/specs/2026-10-24-combat-and-inventory-design.md` (read it first; this plan only records decisions the spec leaves open).

## Global Constraints

- Defeat (HP 0): fight ends, `playerHp` = `round(0.3 * maxHp)`, monster stays at full HP (never persisted damaged), nothing is lost. Fleeing resets the monster the same way.
- Wooden Sword `damage 2`; Wooden Shield `armor 2`; Rattatui Fang Blade `damage 3`; no weapon may exceed `COMBAT.maxWeaponDamage = 3` in the MVP.
- Rat 100 HP, tiers x1.5 HP, tier every 1800 s of map age, max tier 5; Rat King 1000 HP, `timeLimitSec 60`, one at a time; `maxMonsters 8`; bag exactly 36 slots; potion stack max 20, heal 35 HP, 8 s shared fight cooldown.
- Armor mitigation `armor / (armor + 40)`; `maxHp = round(85 + characterStats.hp + gear maxHp)`; regen 1 HP/s outside fights only; fight steps clamp dt to 1 s.
- Spawns: first rat 120 s after >= 5 owned tiles, then every 900 s; never on the castle, a chest tile or a monster tile.
- Combat clicks use the shared `clickLimiter` (`CLICK_LIMIT`: capacity 8, 5/s, `requireTrusted`).
- Save: `SAVE_VERSION` stays 12; new persisted fields are optional on load (missing equipment+bag -> starter kit); item ids are validated against `ITEM_CATALOG`, never trusted for stats.
- Gear, bag and potions survive rebirth; monsters, fight and HP reset (HP to full).
- Store action named `drinkPotion` (not `usePotion`: react-hooks lint). Taunt lines are mild (see Task 1).
- UI uses `PixelModal` and the `.px-*` kit only (no ad-hoc Tailwind greys), text >= 12px, integer sprite scales, motion is transform/opacity and honours `prefers-reduced-motion`.
- Commands: tests `npx tsx --test tests/<file>.ts` (all: `npm test`), types `npx tsc --noEmit`, `npm run lint`, `npm run build`. Commit with `git -c commit.gpgsign=false commit` (user instruction for this session: no GPG).

## Review Focus

1. A 300 s catch-up tick (background tab) while a fight is open must not kill the player or fire dozens of attacks (Task 7 test).
2. Loot arriving with a full bag, and unequipping with a full bag, must never lose or duplicate items (Tasks 2, 7).
3. Stale or duplicate fight actions: hitting with no fight, starting a fight on a monster that was just killed, starting a second fight, drinking a potion with `qty 0` or a non-consumable index (Task 7).
4. Rebirth or reset while a fight is open: fight and monsters cleared, gear kept (Task 7).
5. Loading an old v12 save without the new fields, and forged saves (unknown item id, wrong slot, bag of 35, stack of 21, two kings, `playerHp` above max, monster on the castle) (Task 6).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types/game.ts` (modify) | New types; remove old `Item`/`Equipment`/`inventory` |
| `src/config/combatConfig.ts` (create) | `COMBAT`, `MONSTERS` tunables |
| `src/config/itemCatalog.ts` (create) | `ITEM_CATALOG`, `RATTATUI_SET`, starter kit, slot layout/labels |
| `src/lib/inventory.ts` (create) | Pure bag/equipment operations + `aggregateStats` |
| `src/lib/monsters.ts` (create) | Tiers, stats, spawn tile, aging/evolution |
| `src/lib/combat.ts` (create) | Max HP, damage, mitigation, regen, fight state machine |
| `src/lib/loot.ts` (create) | Kill rewards and drops |
| `src/lib/combatFx.ts` (create) | Window event bus for hit/hurt/heal effects |
| `src/lib/sanitizeSave.ts`, `src/stores/gameStore.ts`, `src/config/gameConfig.ts` (modify) | Persistence, actions, tick integration |
| `src/components/game/{ItemSlot,ItemTooltip,Bag,MonsterSprite}.tsx` (create) | Inventory + map UI |
| `src/components/game/overlays/{CharacterOverlay,FightModal}.tsx` | Rewrite / create |
| `src/styles/{Inventory,Monsters,Fight}.css` (create) | Styling |
| `scripts/pixel/sprites_monsters.py` (create), `sprites_equipment.py` (modify) | Art |

---

### Task 1: Types, config and item catalog

**Files:**
- Modify: `src/types/game.ts` (replace `EquipmentSlot`, `Equipment`, `Item`; add types below; `GameState` edited in Task 6), `src/config/gameConfig.ts` (delete `EQUIPMENT_SLOT_INFO`, `INITIAL_INVENTORY_ITEMS`, now-unused imports; keep `EQUIPMENT_RARITY_COLORS`)
- Create: `src/config/combatConfig.ts`, `src/config/itemCatalog.ts`
- Test: `tests/items.test.ts`

**Interfaces:**
- Produces (types/game.ts):
  `EquipmentSlot = 'head'|'shoulder'|'chest'|'hands'|'legs'|'feet'|'neck'|'cape'|'ring1'|'ring2'|'charm'|'mainHand'|'offHand'`; `ItemStats = {damage?: number; armor?: number; maxHp?: number}`; `ItemDef {id; name; slot?: EquipmentSlot|'ring'; rarity: EquipmentRarity; stats?: ItemStats; set?: string; description?: string; consumable?: {healHp: number}; stackMax?: number; sellValue: number; icon?: PixelIconName}`; `Equipment = Partial<Record<EquipmentSlot, string>>`; `BagSlot = {id: string; qty: number} | null`; `MonsterType = 'rat'|'ratKing'`; `Monster {id: number; type: MonsterType; tier: number; x: number; y: number; ageSec: number}`; `KillSummary {gold: number; xp: number; items: {id: string; qty: number}[]; convertedGold: number}`; `FightPhase = 'active'|'won'|'knockedOut'|'timeout'`; `FightState {monsterId: number; type: MonsterType; tier: number; monsterHp: number; monsterMaxHp: number; attackTimer: number; timeLeftSec: number|null; potionCd: number; phase: FightPhase; summary: KillSummary|null; taunt: string|null}`.
- Produces (combatConfig.ts):
  `COMBAT = {baseHp: 85, regenPerSec: 1, knockoutHpFraction: 0.3, armorK: 40, fightStepClampSec: 1, maxWeaponDamage: 3, bagSize: 36, maxMonsters: 8, potionCooldownSec: 8, spawn: {firstSec: 120, intervalSec: 900, minOwnedTiles: 5}, tierIntervalSec: 1800, maxTier: 5, drops: {setPieceBase: 0.08, setPieceTierBonus: 0.01, potionBase: 0.25, potionTierBonus: 0.03}, rewards: {minGold: 10, minXp: 5}}`;
  `MONSTERS = {rat: {label: 'Rat', hp: 100, hpGrowth: 1.5, attack: 4, attackGrowth: 1.25, attackIntervalSec: 2, rewardSec: 90, rewardGrowth: 1.5}, ratKing: {label: 'Rat King', hp: 1000, attack: 5, attackIntervalSec: 3.5, rewardSec: 3600, timeLimitSec: 60, evolveChance: 0.35, evolveCheckSec: 600, taunts: [...4 mild lines]}}`.
- Produces (itemCatalog.ts): `ITEM_CATALOG: Record<string, ItemDef>`; `RATTATUI_SET = {id: 'rattatui', label: 'Rattatui Set', size: 13, pieces: string[] /* 12 item ids, ring listed once */, bonuses: {6: {maxHp: 10}, 13: {maxHp: 15}}}`; `STARTER_EQUIPMENT: Equipment = {mainHand: 'wooden_sword', offHand: 'wooden_shield'}`; `STARTER_BAG_ITEMS = [{id: 'potion_minor', qty: 2}]`; `EQUIPMENT_LAYOUT = {left: ['head','shoulder','chest','hands','legs','feet'], right: ['neck','cape','ring1','ring2','charm'], bottom: ['mainHand','offHand']}`; `EQUIPMENT_SLOT_LABEL: Record<EquipmentSlot, string>` (mainHand 'Weapon', offHand 'Shield').

Catalog contents (ids): `wooden_sword` (mainHand, common, damage 2), `wooden_shield` (offHand, common, armor 2), `potion_minor` (consumable healHp 35, stackMax 20, sellValue 20), and the 12 Rattatui ids `rattatui_cap` (head), `_shoulderpads`, `_tunic` (chest), `_gloves`, `_trousers` (legs), `_boots`, `_amulet` (neck), `_cloak` (cape), `_ring` (slot `'ring'`), `_charm`, `_fang_blade` (mainHand, damage 3), `_buckler` (offHand). Per-piece `{armor, maxHp}` and rarity: cap 3/4 uncommon, shoulderpads 3/3 uncommon, tunic 6/8 rare, gloves 2/2 uncommon, trousers 4/5 uncommon, boots 2/3 uncommon, amulet 0/8 rare, cloak 2/3 uncommon, ring 0/5 rare, charm 2/10 epic, buckler 5/4 rare, fang blade damage 3 rare. `sellValue`: common 5, uncommon 60, rare 150, epic 400. Names are "Rattatui Cap", "Rattatui Trousers", ... "Rattatui Fang Blade"; every set piece has `set: 'rattatui'`. `icon` left unset (UI falls back to the slot silhouette until Task 11). Taunts: "Squeak! Is that all you've got?", "Haha, come back when you're stronger!", "The King is not impressed.", "Run along, little knight!".

- [ ] **Step 1: Write the failing test** `tests/items.test.ts` with tests: `catalog keys equal ids`; `gear has a slot, consumables have healHp and stackMax`; `Rattatui pieces cover all 13 slots (ring covers ring1 and ring2)`; `no weapon exceeds COMBAT.maxWeaponDamage and the starter weapon deals 2`; `starter shield has armor 2`; `fang blade damage equals COMBAT.maxWeaponDamage`.
- [ ] **Step 2: Run** `npx tsx --test tests/items.test.ts` -> FAIL (modules missing).
- [ ] **Step 3: Add the types, `combatConfig.ts` and `itemCatalog.ts` as specified above; delete the old equipment exports.** Fix compile errors in `CharacterOverlay.tsx` and `gameStore.ts` only as far as needed to keep `npx tsc --noEmit` clean (the store keeps its old `equipment`/`inventory` fields until Task 6; use a local `unknown`-free shim, e.g. type them as `Record<string, never>`/`never[]`).
- [ ] **Step 4: Run** `npx tsx --test tests/items.test.ts` -> PASS; `npx tsc --noEmit` -> no errors.
- [ ] **Step 5: Commit** `feat(items): item catalog, combat config and types`.

---

### Task 2: Inventory logic

**Files:** Create `src/lib/inventory.ts`; Test `tests/inventory.test.ts`.

**Interfaces:**
- Consumes: `ITEM_CATALOG`, `COMBAT.bagSize`, `RATTATUI_SET`, types from Task 1.
- Produces:
  `emptyBag(): BagSlot[]` (36 nulls); `starterBag(): BagSlot[]` (from `STARTER_BAG_ITEMS`);
  `addToBag(bag: BagSlot[], id: string, qty?: number): {bag: BagSlot[]; added: number; overflow: number}` (fills existing stacks up to `stackMax`, then first empty slots; gear is `qty 1` per slot; unknown id -> `overflow = qty`);
  `removeFromBag(bag, index: number, qty?: number): BagSlot[]`;
  `moveSlot(bag, from: number, to: number): BagSlot[]` (swap; merge same consumable up to `stackMax`);
  `equipFromBag(bag, equipment: Equipment, index: number): {bag: BagSlot[]; equipment: Equipment} | null` (slot from item def; `'ring'` goes to `ring1`, else `ring2` if `ring1` taken, else swaps `ring1`; the displaced item goes into the bag index just freed; null for consumables/empty/invalid index);
  `unequip(bag, equipment, slot: EquipmentSlot): {bag: BagSlot[]; equipment: Equipment} | null` (null if slot empty or bag full);
  `aggregateStats(equipment: Equipment): {damage: number; armor: number; maxHp: number; setCount: number}` (sums stats, adds `RATTATUI_SET.bonuses` for thresholds reached, `setCount` counts equipped set pieces with both rings counting).
  All functions are pure (never mutate arguments).

- [ ] **Step 1: Write failing tests** in `tests/inventory.test.ts`: `addToBag stacks potions to 20 then spills into a new slot`; `addToBag reports overflow when all 36 slots are full`; `gear never stacks`; `equipFromBag swaps with the equipped item and nothing is lost`; `two rings go to ring1 then ring2, a third swaps ring1`; `equipFromBag rejects consumables and bad indexes`; `unequip refuses when the bag is full and loses nothing`; `moveSlot merges stacks and swaps others`; `aggregateStats sums starter kit to damage 2 armor 2`; `aggregateStats applies the 6-piece and 13-piece set bonuses`; `functions do not mutate their inputs` (deep-freeze inputs).
- [ ] **Step 2: Run** `npx tsx --test tests/inventory.test.ts` -> FAIL.
- [ ] **Step 3: Implement `src/lib/inventory.ts`** with the signatures above.
- [ ] **Step 4: Run** the test file -> PASS.
- [ ] **Step 5: Commit** `feat(items): pure inventory and equipment operations`.

---

### Task 3: Combat maths and fight state machine

**Files:** Create `src/lib/monsters.ts` (only `monsterStats` here; rest in Task 4), `src/lib/combat.ts`; Test `tests/combat.test.ts`.

**Interfaces:**
- Consumes: `aggregateStats`, `COMBAT`, `MONSTERS`, `FightState`.
- Produces (monsters.ts): `monsterStats(type: MonsterType, tier: number): {maxHp: number; attack: number; attackIntervalSec: number; rewardSec: number}` (rat: `round(100 * 1.5^(tier-1))` HP, `round(4 * 1.25^(tier-1))` attack, `90 * 1.5^(tier-1)` rewardSec; king ignores tier).
- Produces (combat.ts):
  `maxHp(characterStats: CharacterStats, equipment: Equipment): number`;
  `damagePerClick(equipment: Equipment): number` (weapon damage, minimum 1);
  `armorOf(equipment: Equipment): number`;
  `mitigate(rawDamage: number, armor: number): number` (`max(1, round(raw * (1 - armor/(armor + COMBAT.armorK))))`);
  `regen(hp: number, max: number, dtSec: number): number` (clamped to `max`);
  `newFight(monster: Pick<Monster,'id'|'type'|'tier'>): FightState` (phase `'active'`, `attackTimer 0`, `potionCd 0`, `timeLeftSec = timeLimitSec` for king else null);
  `applyHit(fight: FightState, damage: number): {fight: FightState; killed: boolean}` (no-op unless phase `'active'`; sets nothing but `monsterHp` — the store sets `'won'`);
  `type CombatEvent = {kind: 'hurt'; amount: number} | {kind: 'knockedOut'} | {kind: 'timeout'}`;
  `stepFight(fight: FightState, dtSec: number, playerHp: number, armor: number, rng: () => number): {fight: FightState; playerHp: number; events: CombatEvent[]}` (no-op unless `'active'`; `dt = min(dtSec, COMBAT.fightStepClampSec)`; `potionCd` and king `timeLeftSec` decrease by `dt`; `attackTimer += dt`, one hit of `mitigate(attack, armor)` per elapsed interval; `playerHp <= 0` -> phase `'knockedOut'` (hp left at 0, store restores it); king `timeLeftSec <= 0` -> phase `'timeout'`, `taunt` = pick from `MONSTERS.ratKing.taunts` via `rng`).

- [ ] **Step 1: Write failing tests**: `maxHp is 101 for a fresh character with the starter kit` (uses `INITIAL_CHARACTER_STATS` + `calculateCombatStats`); `damagePerClick is 2 with the wooden sword, 1 without a weapon, 3 with the fang blade`; `mitigate: armor 2 turns 4 into 4, armor 40 halves 10 to 5, never below 1`; `rat stats: T1 100 HP, T5 506 HP`; `stepFight: rat deals one mitigated hit every 2 s`; `stepFight clamps dt: a 300 s step yields at most one attack`; `potion cooldown counts down only in steps`; `knockout when hp hits 0`; `king times out after 60 s of steps and sets a taunt from the config`; `regen stops at max`.
- [ ] **Step 2: Run** `npx tsx --test tests/combat.test.ts` -> FAIL.
- [ ] **Step 3: Implement** `monsterStats` and the `combat.ts` functions above.
- [ ] **Step 4: Run** -> PASS.
- [ ] **Step 5: Commit** `feat(combat): damage, mitigation, regen and fight step logic`.

---

### Task 4: Monster lifecycle logic

**Files:** Modify `src/lib/monsters.ts`; Test `tests/monsters.test.ts`.

**Interfaces:**
- Consumes: `COMBAT`, `MONSTERS`, `Tile[][]`, `Monster`.
- Produces:
  `tierFor(type: MonsterType, ageSec: number): number` (rat `min(5, 1 + floor(age / 1800))`; king 1);
  `monsterAt(monsters: Monster[], x: number, y: number): Monster | undefined`;
  `pickSpawnTile(tiles: Tile[][], monsters: Monster[], rng: () => number): {x: number; y: number} | null` (owned, not castle, no `hasChest`, no monster);
  `spawnThreshold(nextMonsterId: number): number` (`firstSec` when `nextMonsterId === 1`, else `intervalSec`);
  `advanceMonsters(monsters: Monster[], dtSec: number, rng: () => number, frozenId: number | null): Monster[]` (adds `dtSec` to every `ageSec` except `frozenId`, recomputes `tier`; each rat crossing a `7200 + k*600` s age boundary rolls `evolveChance`; a success converts that rat to `{type:'ratKing', tier:1}` on the same tile only if no king exists; at most one evolution per call);
  `tierSecondsLeft(m: Monster): number | null` (null for king/tier 5).

- [ ] **Step 1: Write failing tests**: `tierFor ages 0/1799/1800/7200/99999 -> 1/1/2/5/5`; `pickSpawnTile never returns the castle, chest tiles, monster tiles or unowned tiles` (build small tiles with `freshGame`/`growTo` from helpers); `pickSpawnTile returns null when nothing is eligible`; `spawnThreshold first vs later`; `advanceMonsters ages and retiers`; `a frozen monster does not age`; `evolution needs tier 5 age and no existing king` (rng 0 forces success); `only one king ever exists`; `tierSecondsLeft`.
- [ ] **Step 2: Run** `npx tsx --test tests/monsters.test.ts` -> FAIL.
- [ ] **Step 3: Implement** the functions in `src/lib/monsters.ts`.
- [ ] **Step 4: Run** -> PASS.
- [ ] **Step 5: Commit** `feat(monsters): spawn tile, tiers and evolution logic`.

---

### Task 5: Loot and combat event bus

**Files:** Create `src/lib/loot.ts`, `src/lib/combatFx.ts`; Test `tests/loot.test.ts`.

**Interfaces:**
- Produces:
  `KillContext = {goldPerSec: number; xpPerSec: number; luck: number}`;
  `rollKillLoot(monster: Pick<Monster,'type'|'tier'>, ctx: KillContext, rng: () => number): {gold: number; xp: number; items: {id: string; qty: number}[]}` — `gold = floor(max(minGold, goldPerSec * rewardSec * (1 + luck * CHEST.luckBonusPerPoint)))`, `xp = max(minXp, xpPerSec * rewardSec)`; set piece with probability `setPieceBase + (tier-1) * setPieceTierBonus` (uniform over `RATTATUI_SET.pieces`), potion (qty 1) with `potionBase + (tier-1) * potionTierBonus`, each rolled independently with one `rng()` call each;
  (combatFx.ts) `COMBAT_EVENT = 'idlarz:combat'`; `type CombatFx = {kind:'hit'; damage:number; killed:boolean} | {kind:'hurt'; amount:number} | {kind:'heal'; amount:number}`; `emitCombat(fx: CombatFx): void` (no-op without `window`, CustomEvent otherwise, like `lib/floatText.ts`).

- [ ] **Step 1: Write failing tests**: `rng 0 drops both a set piece and a potion, rng 0.999 drops nothing`; `gold scales with income and tier (T2 = 1.5x T1)`; `min gold and xp apply at zero income`; `set piece id is always a member of RATTATUI_SET.pieces`; `luck raises gold`.
- [ ] **Step 2: Run** `npx tsx --test tests/loot.test.ts` -> FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** -> PASS.
- [ ] **Step 5: Commit** `feat(combat): kill loot and combat event bus`.

---

### Task 6: Store state, persistence and equipment actions

**Files:** Modify `src/types/game.ts` (`GameState`), `src/stores/gameStore.ts`, `src/lib/sanitizeSave.ts`; Tests: `tests/saves.test.ts` (add), `tests/equipment.test.ts` (create).

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces `GameState` fields: `equipment: Equipment; bag: BagSlot[]; playerHp: number; monsters: Monster[]; monsterSpawnTimer: number; nextMonsterId: number; fight: FightState | null` (fight is transient). Remove `inventory`. New actions: `equipItem(bagIndex: number): boolean; unequipItem(slot: EquipmentSlot): boolean; moveBagItem(from: number, to: number): boolean` (all return false while `fight !== null`; after a change `playerHp` is clamped to the new `maxHp`).
- `createInitialData(prestige)`: `equipment {...STARTER_EQUIPMENT}`, `bag starterBag()`, `playerHp maxHp(...)`, `monsters []`, `monsterSpawnTimer 0`, `nextMonsterId 1`, `fight null`. `rebirth()` keeps `equipment` and `bag` from the old state and sets `playerHp` to full.
- `PERSISTED_KEYS` += `equipment, bag, playerHp, monsters, monsterSpawnTimer, nextMonsterId` (grep for other users of `PERSISTED_KEYS` and `INITIAL_INVENTORY_ITEMS`, fix them).
- `sanitizeSave` (new section after the character block): if both `equipment` and `bag` are absent -> starter kit, `playerHp` = max, no monsters; if only one is present -> reject. Otherwise validate: every equipment value is a catalog id whose slot fits (a `'ring'` item in `ring1`/`ring2`); `bag` has length `COMBAT.bagSize`; each entry `null` or `{id, qty}` with a catalog id, integer `qty` in `1..(stackMax ?? 1)`; `playerHp` finite in `0..maxHp` (recomputed from sanitized stats and equipment); `monsters` at most `COMBAT.maxMonsters`, unique integer ids below `nextMonsterId`, type known, tier `1..maxTier` (king `1`), tile owned, not castle, no `hasChest`, at most one tile per monster, at most one `ratKing`, `ageSec` in `0..1e8`; `monsterSpawnTimer` in `0..COMBAT.spawn.intervalSec`; `nextMonsterId` integer `>= 1`. Tile validation for chests stays as is; additionally no chest on a monster tile.

- [ ] **Step 1: Write failing tests.** In `tests/equipment.test.ts`: `new game starts with sword and shield equipped and 2 potions`; `equipItem swaps and keeps playerHp within the new maxHp`; `equip actions are refused during a fight` (set `fight` via `store.setState`); `rebirth keeps equipment, bag and resets playerHp to full`. In `tests/saves.test.ts`: `an old save without the new fields loads with the starter kit`; `a played game with gear, a monster and damaged HP round-trips`; and `rejects(...)` cases: unknown item id, sword in the `head` slot, ring item in `mainHand`, bag of 35, potion stack of 21, gear with `qty 2`, `playerHp` above max, `playerHp` NaN, monster on the castle, monster on an unowned tile, monster on a chest tile, two `ratKing`s, nine monsters, monster tier 6, duplicate monster ids, equipment without bag.
- [ ] **Step 2: Run** `npx tsx --test tests/equipment.test.ts tests/saves.test.ts` -> FAIL.
- [ ] **Step 3: Implement** the state, actions (thin wrappers over `equipFromBag`/`unequip`/`moveSlot`), `createInitialData`, `rebirth`, `PERSISTED_KEYS` and the sanitize section. Temporarily adapt `CharacterOverlay.tsx` so it compiles (render equipped item names from `ITEM_CATALOG`; the real UI comes in Task 8).
- [ ] **Step 4: Run** `npm test` -> all PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(items): persisted equipment, bag and HP with save validation`.

---

### Task 7: Fight actions and tick integration

**Files:** Modify `src/types/game.ts` (actions), `src/stores/gameStore.ts`; Tests: `tests/fight.test.ts`, `tests/kingInvariant.test.ts` (create).

**Interfaces:**
- Consumes: all lib modules; module-level `clickLimiter` already in `gameStore.ts`.
- Produces actions: `startFight(monsterId: number): boolean` (false if a fight exists, monster missing, or `playerHp <= 0`); `hitMonster(input: ClickInput): {damage: number; killed: boolean} | null` (null when no `'active'` fight or the limiter refuses; on kill: phase `'won'`, monster removed, gold/xp added (gold capped by `RESOURCE_CAP`), loot added with `addToBag`, overflow converted at `sellValue` into `summary.convertedGold`, `emitCombat`); `leaveFight(): void` (sets `fight` to null; the monster is untouched); `drinkPotion(bagIndex: number): boolean` (item must be consumable with `qty >= 1`; in an `'active'` fight requires `potionCd === 0` and then sets it to `COMBAT.potionCooldownSec`; heals up to `maxHp`; fails at full HP; `emitCombat` heal).
- Tick (`tick()` in `gameStore.ts`), after chests and before level calculation: (1) chest spawn eligibility also excludes monster tiles; (2) `advanceMonsters(monsters, secondsElapsed, Math.random, fight?.monsterId ?? null)`; (3) spawn timer: runs only when owned tiles `>= COMBAT.spawn.minOwnedTiles` and `monsters.length < maxMonsters`, resets to 0 on spawn using `pickSpawnTile`/`spawnThreshold`; (4) if `fight` is `'active'` -> `stepFight(...)` and apply events (`hurt` -> `emitCombat`; `knockedOut` -> `playerHp = round(knockoutHpFraction * maxHp)`; `timeout` -> nothing more, king untouched); otherwise `playerHp = regen(...)`. `resetGame`/`rebirth` set `fight` to null.
- Fight dt is `secondsElapsed` passed to `stepFight` (which clamps itself).

- [ ] **Step 1: Write failing tests** in `tests/fight.test.ts` (stub `Math.random` with `mock.method` where needed; helper `hit(n)` calls `hitMonster` with `eventId = i`, `now = i * 250`, `trusted: true`): `50 hits at 2 damage kill a tier-1 rat and 49 do not`; `untrusted clicks and clicks over the limiter rate do nothing` (20 hits at the same `now` count at most 8); `hitMonster without a fight returns null`; `startFight on a missing or already killed monster, or while fighting, is false`; `leaveFight then startFight gives the monster full HP`; `kill pays gold, xp and loot` (random stub 0 -> set piece + potion in bag); `loot with a full bag converts to gold and loses no items` (fill all 36 slots with non-stackable gear first); `drinkPotion heals, respects the 8 s cooldown, rejects qty 0, non-consumables and full HP`; `tick(300000) during a fight deals at most one attack`; `knockout restores 30 % HP and blocks further hits`; `regen only outside fights`; `rebirth and resetGame clear fight and monsters but keep gear`; `first rat spawns after 120 s with >= 5 tiles, never on castle/chest tiles, cap 8`; `chests never spawn on a monster tile`; `king: 61 s of ticks give phase timeout with a config taunt, king still on the map at full HP`. In `tests/kingInvariant.test.ts`: `best possible clicks x best weapon damage < king HP` (`CLICK_LIMIT.capacity + CLICK_LIMIT.refillPerSec * 60` times the largest `stats.damage` among catalog weapons, must be `< MONSTERS.ratKing.hp`); `starter-kit king fight ends by timeout not knockout` (damage over 60 s with starter armor `< maxHp`).
- [ ] **Step 2: Run** `npx tsx --test tests/fight.test.ts tests/kingInvariant.test.ts` -> FAIL.
- [ ] **Step 3: Implement** the actions and tick changes.
- [ ] **Step 4: Run** `npm test` -> all PASS.
- [ ] **Step 5: Commit** `feat(combat): fights, monster spawning and tick integration`.

---

### Task 8: Character window rework

**Files:** Create `src/components/game/ItemSlot.tsx`, `ItemTooltip.tsx`, `Bag.tsx`, `src/styles/Inventory.css`; Rewrite `src/components/game/overlays/CharacterOverlay.tsx`; Modify `src/components/game/LevelDetails.tsx` (HP flask value `playerHp`, max `maxHp(...)`), `src/components/game/overlays/StatisticsOverlay.tsx` (HP row shows `playerHp / maxHp`, MP unchanged), `src/config/pixelIcons.ts` (add `equip_shoulder|hands|cape|charm` fallbacks mapped to existing sprites until Task 11).

**Interfaces:**
- Consumes: store (`equipment`, `bag`, `playerHp`, `equipItem`, `unequipItem`, `moveBagItem`, `characterStats`), `aggregateStats`, `ITEM_CATALOG`, `EQUIPMENT_LAYOUT`, `EQUIPMENT_SLOT_LABEL`, `RARITY_GLOW` colours (move the map from the old overlay into `ItemSlot.tsx`).
- Produces: `ItemSlot({itemId, qty, slot, onClick, onDoubleClick, onContextMenu, draggable, onDragStart, onDrop, locked, label}: ItemSlotProps)` (uses `/pixel/ui/slot_frame.png`; empty equipment slot shows the dim silhouette via `EQUIPMENT_PIXEL_ICONS`; rarity glow; qty badge; `locked` renders a padlock look with tooltip "Abilities - coming soon"); `ItemTooltip({itemId})` rendered through `createPortal` to `document.body` near the pointer (name in rarity colour, slot, damage/armor/max HP lines, "Rattatui Set (n/13)" with owned pieces highlighted and bonus lines, description, sell value); `Bag()` (6x6 grid, HTML5 drag between slots, double-click/right-click equips or, for potions, drinks via `drinkPotion`).
- Layout: `PixelModal size='lg'`; left panel: hero alcove (`LevelDetails`) flanked by `EQUIPMENT_LAYOUT.left`/`right` columns, bottom row weapon, 2 locked ability slots, shield; Damage / Armor / Max HP readouts under the hero; "Stats" button opens the Statistics window; right panel "Items Bag". Click an equipped slot to unequip (toast via `emitFloat`-style text if the bag is full: reuse existing `.px-toast` pattern). Class picker double-click on the hero stays.

- [ ] **Step 1: Implement the components and styles** following the spec section 8 and `.px-*` kit.
- [ ] **Step 2: Verify types and lint**: `npx tsc --noEmit` and `npm run lint` -> clean.
- [ ] **Step 3: Verify visually** with `preview_start` (dev server) and the in-app browser: open Character, use `window.__game.getState().addResources`/`equipItem` from the console to confirm: equip by double-click, unequip by click, drag-rearrange, tooltip, locked ability slots, full-bag unequip refused. Screenshot and check at the default window size; fix overflow.
- [ ] **Step 4: Run** `npm test` -> PASS (no regressions).
- [ ] **Step 5: Commit** `feat(ui): reworked character window with 36-slot bag, tooltips and ability slots`.

---

### Task 9: Monsters on the map

**Files:** Create `src/components/game/MonsterSprite.tsx`, `src/styles/Monsters.css`; Modify `src/components/game/Tile.tsx`, `src/config/pixelIcons.ts` (`MONSTER_PIXEL_ICONS: Record<MonsterType, PixelIconName>` pointing at `animal_chicken`/`animal_pig` placeholders until Task 11), `src/components/game/GameDebug.tsx`.

**Interfaces:**
- Consumes: `monsterAt`, `tierSecondsLeft`, `startFight`.
- Produces: `MonsterSprite({type, tier}: {type: MonsterType; tier: number})` (idle bob via transform, tier badge showing the tier, king drawn larger with a gold glow).
- `Tile.tsx`: selector `useGameStore((s) => { const m = monsterAt(s.monsters, x, y); return m ? `${m.id}:${m.type}:${m.tier}` : ''; })` (string, so ticks do not re-render); in `handleClick`, after the biome-selection branch and before the chest branch: if the tile has a monster -> `startFight(id)`, play `click`, return (no tap, no chest). The tile tooltip (map tip layer) shows `Rat - Tier 2 - 160 HP - next tier in 12 min - Click to fight` / `Rat King - 1000 HP - Click to fight`. Cursor pointer on monster tiles.
- `GameDebug.tsx` (dev only): buttons `Spawn Rat`, `Spawn Rat King` (refused when one exists), `Give Rattatui set` (adds all pieces to the bag), `Heal`.

- [ ] **Step 1: Implement** the sprite, tile integration and debug buttons.
- [ ] **Step 2: Verify**: `npx tsc --noEmit`, `npm run lint`; then in the dev server spawn a rat via the debug button, hover (tooltip, tier text), click (store `fight` becomes non-null; the modal comes in Task 10, so check via `window.__game.getState().fight`), confirm a monster tile does not also grant a gold tap.
- [ ] **Step 3: Commit** `feat(map): monsters on tiles with tier badge, tooltip and click-to-fight`.

---

### Task 10: Fight modal and effects

**Files:** Create `src/components/game/overlays/FightModal.tsx`, `src/styles/Fight.css`; Modify `src/app/page.tsx` (mount `<FightModal />`).

**Interfaces:**
- Consumes: store (`fight`, `playerHp`, `bag`, `equipment`, `characterStats`, `hitMonster`, `leaveFight`, `drinkPotion`), `COMBAT_EVENT`, `audioManager` keys `click`, `wrong`, `purchase`, `fanfare`, `MONSTER_PIXEL_ICONS`, `MONSTERS`.
- Produces: `FightModal` (renders when `fight !== null` through `PixelModal size='md'`, `onClose = leaveFight`, Esc/backdrop = Flee). Content: monster sprite at integer scale (3) as a `button` whose `onClick` calls `hitMonster({eventId: e.nativeEvent.timeStamp, now: performance.now(), trusted: e.nativeEvent.isTrusted})`; monster HP bar with a delayed trail (second layer transitions after 400 ms); player HP bar; potion buttons for up to 3 bag stacks with consumables (hotkeys `1`-`3`, cooldown sweep from `fight.potionCd`); Flee button; king countdown from `fight.timeLeftSec`. Effects from `COMBAT_EVENT`: hit -> blood burst (8 small squares from a pooled array, CSS animation, removed on end) + white flash + floating damage number; hurt -> `.fight-shake` class on the modal for 300 ms (transform translate steps) + red vignette; heal -> green number. `prefers-reduced-motion`: no shake/burst, colour flash only. End panels by `fight.phase`: `won` (gold, xp, drop icons via `ItemSlot`, converted-gold line), `knockedOut` ("Knocked out - the rat shrugs it off"), `timeout` (shows `fight.taunt`), each with a Close button that calls `leaveFight`. Sounds: hit `click`, hurt `wrong`, potion `purchase`, win `fanfare`.

- [ ] **Step 1: Implement** the modal, styles and mount.
- [ ] **Step 2: Verify**: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3: Play-test in the dev server**: spawn a rat, click it ~50 times (HP bar trail, blood, damage numbers, shake on hits, potion use with hotkey 1, win panel with rewards, drops appear in the Character bag); knock yourself out by setting `playerHp` to 1 via `window.__game.setState`; spawn the king, let the 60 s run out (countdown, taunt, king stays); Esc during a fight flees. Check reduced-motion by emulating `prefers-reduced-motion`. Screenshot each state.
- [ ] **Step 4: Run** `npm test` -> PASS.
- [ ] **Step 5: Commit** `feat(combat): fight modal with blood, shake, potions and Rat King countdown`.

---

### Task 11: Final art

**Files:** Create `scripts/pixel/sprites_monsters.py`; Modify `scripts/pixel/sprites_equipment.py`, `scripts/pixel/materials.py`, `scripts/pixel/build.py` (`SPRITES`), `src/config/pixelIcons.ts` (`PIXEL_ICON_SIZES`, `MONSTER_PIXEL_ICONS`), `src/config/itemCatalog.ts` (`icon` per item), `scripts/pixel/reference/STYLE.md`; Output: `public/pixel/icons/*.png`.

**Interfaces / sprite names and sizes:** `monster_rat` (2-frame idle sheet, 2 x 40x40 -> 80x40), `monster_ratking` (2 x 56x56 -> 112x56, crowned), `item_potion_hp` (40), `equip_shoulder`, `equip_hands`, `equip_cape`, `equip_charm` (40, dim-silhouette source), `item_wooden_sword`, `item_wooden_shield` (wood re-skin), and 12 `item_rattatui_<piece>` icons re-skinning the matching slot geometry with new materials `rat_fur`, `rat_fur_dk`, `rat_pink` (grey-brown ramp, pink accent) following the 5-tone ramp and coloured-outline rules in `STYLE.md`. Sprite functions return a `Scene.render()` image like the existing ones.

- [ ] **Step 1: Write the sprite functions** and render previews for `monster_rat`, `monster_ratking` and `item_rattatui_tunic` only: `python scripts/pixel/build.py monster_rat monster_ratking item_rattatui_tunic` (previews land in git-ignored `scripts/pixel/previews/`).
- [ ] **Step 2: STOP - show the three previews to the user** (SendUserFile, upscaled) and wait for approval or art direction. Do not build the rest before this (rule in `STYLE.md`).
- [ ] **Step 3: After approval build everything**: `python scripts/pixel/build.py`; register sizes in `PIXEL_ICON_SIZES`, replace the placeholder `MONSTER_PIXEL_ICONS`, set `icon` on every catalog item, drop the temporary `equip_*` fallbacks; the fight modal and `MonsterSprite` use the 2-frame sheets via the same technique as `AmbientLife` (`background-size` + steps animation).
- [ ] **Step 4: Verify**: `npx tsc --noEmit`, `npm run lint`, `npm test`; check all icons in the Character window, tooltip, bag, map and fight modal in the dev server.
- [ ] **Step 5: Run** `python scripts/pixel/build.py --refs`, update `STYLE.md` (new sprites, monsters, item icons), **Commit** `feat(art): rat, rat king, potion and Rattatui set sprites`.

---

### Task 12: Docs and final verification

**Files:** Modify `docs/01-architecture.md` (file map, state, tick order, persistence), `docs/02-mechanics.md` (combat, monsters, items), `docs/03-formulas-and-scaling.md` (damage, armor, rewards, tiers, king invariant), `docs/04-unfinished-and-known-issues.md` (mark A4 resolved; add: stat points inert for combat, auto-sell not implemented), `docs/05-balance-backlog-and-roadmap.md` and `docs/08-followup-plan.md` (combat balance backlog; link to the spec's roadmap), `docs/07-security-and-exploits.md` (new save validation surface, limiter reuse, fight dt clamp), `README.md` if it lists features.

- [ ] **Step 1: Update the docs** listed above, copying numbers from `combatConfig.ts` (no invented values).
- [ ] **Step 2: Run the full check**: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` -> all pass.
- [ ] **Step 3: Run** `npm run sim -- --seeds=1` and `git diff --stat docs/generated`; economy numbers must not change (combat adds no income to bots). If they do, find out why before continuing.
- [ ] **Step 4: Final play-through** in the dev server from a new game: first rat appears (use `Fast forward +1 hour` debug button to skip), fight it, equip a drop, reload the page (HP, gear, bag, monsters persist; fight does not), rebirth (gear stays).
- [ ] **Step 5: Commit** `docs: combat, monsters and inventory`.
