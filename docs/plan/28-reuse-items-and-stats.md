# 28 · Items and sets: what is left (the reuse roster and the new stats are built; special sets, the Vault and the art gaps are open)

Reviewed against the code on 2026-11-26; everything built was removed. **Built** (the code and its JSDoc are the record: `src/catalog/items/ladder.ts`, `src/catalog/items/reuse.ts`, `src/catalog/stats.ts`, `src/catalog/sets.ts`, the item icons in `src/config/itemIcons/`): the reuse roster of tiered gear with its art, the belt slot, the legendary roster with its perks and handlers, and the new item stats (Crit Damage, Armor Penetration, Thorns, Build Speed, Tile Discount, Farm Yield, Heal on Kill, Boss Timer, belt stats) with their accessory themes and affix rules. The old tables of items, names and stats are gone from this file: read the catalog.

## What is open

### 1. The special sets S1 to S3 (IDL-39; decided 2026-11-07)

The three planned special sets exist as definitions in `src/catalog/sets.ts` with their pieces **disabled**: nothing drops them yet. 14 pieces each (13 slots plus the belt), thresholds **3 / 6 / 9 / 12 / 14**, the `SetDef` shape of the catalog (every reached threshold applies, so the rows add up).

**Power rule:** a full set reaches 70 to 90 % of its family caps by itself (caps of IDL-149: income 50, XP 40, kill reward 60, click 40, damage 45), so one top legendary still tips a family over the cap: set or legendary is a choice, but a special set is clearly stronger than Obsidian (income 26, XP 25, kill reward 37). The numbers below are placeholders until `fight-sim` and `sim` have run.

| Set | 3 | 6 | 9 | 12 | 14 (full) | Full-set totals |
|---|---|---|---|---|---|---|
| **S1 Sunhoney** (economy, no defence) | income 8, gold find 10 | XP 10, click 8 | kill reward 20, offline eff 10, income 10 | income 10, XP 10, offline cap 3 h, gold find 10, click 6 | income 10, XP 12, kill reward 28, offline eff 10, offline cap 3 h, gold find 10, click 6 | income 38, XP 32, kill reward 48, offline eff 20, offline cap +6 h, click 20, gold find 30 |
| **S2 Ashen Warlord** (combat plate) | damage 6, armor 6 | max HP 10 %, crit 4 | damage 12, armor 8, regen 2 | damage 10, max HP 8 %, crit 4, armor 6 | damage 10, max HP 7 %, crit 4, regen 2, kill reward 10, armor 4 | damage 38, max HP 25 %, armor 24, crit 12, regen 4, kill reward 10 |
| **S3 Blightbound** (caster and leech, fragile: no armor, no max HP) | damage 8, luck 3 | leech 3, crit 4 | damage 12, luck 5, super crit 4 | damage 10, leech 2, crit 3, luck 4 | damage 10, leech 3, crit 3, luck 3, super crit 6 | damage 40, leech 8, luck 15, crit 10, super crit 10 |

- S2 (38) and S3 (40) sit below the 45 % damage cap; the damage legendary is a main-hand weapon, so wearing it costs the 14th piece and the total stays at 38 or 40.
- **Set homes** (palette, from the art that exists): Sunhoney is gold, sun and silk (the Sunhoney boots, trousers, locket, signet, mace, crest, longsword and the two top belts); Ashen Warlord is red, fire and black iron (drake-scale boots, ember medallion, ruby and crimson rings, magma flail, cinderfang sword, thornspike shield, warden belt); Blightbound is **violet-black with a toxic-green glow** (IDL-23), so the green reuse pieces (mossweave, verdant, leaf, thornvine, emerald) are palette-swap candidates, not set pieces as they are. A fourth **Frost line** (ice, fur, silver) is possible from existing art, not planned.
- Checks before the numbers are final: `fight-sim` for S2 and S3 damage (also with one top legendary on top, which must stop at the cap of 45); `npm run sim` with an S1 profile (income, XP and kill reward caps, run-2 ratio 60 to 70 %, pacing guard +-15 %); a test that no set bonus pushes a family past its `HARD_LIMITS`; the new stats of the catalog may be added to these rows, one small step each, inside the same caps.
- Sources and piece acquisition (boss, relic, War Medal, Blight Ichor) are IDL-146; S2 and S3 pieces drop from their biome bosses (IDL-44, [20](20-monster-families-and-rewards.md) section 8).

### 2. The Vault and the relic exchange (IDL-146, IDL-111, IDL-148)

Legendaries wipe at rebirth except one item in the **Vault**. Five relics from any bosses exchange at the Vault for a chosen top-tier legendary (income, building time or kill reward); the relics themselves are in [20](20-monster-families-and-rewards.md) section 8. The legendary acquisition model is **two pools** so a roll can never hand out the wrong tier: `legendary_top` (the three top-tier items) is used only by the boss bonus table (pity 5 % plus 1 % per miss, up to +10 %) and by the relic exchange, and the first legendary is guaranteed from the first boss kill after level 15; `legendary_mid` is used by the chest replace roll and a `fixed`-mode monster bonus table (0.2 % per kill, item-level gate 15). A second copy of the same id never drops while one is in the bag, gear or Vault. The Vault slot is an Ember shop item (IDL-97, [18](18-biome-buildings-and-material-tiers.md) section 3). The eight non-top legendaries can also be crafted late for War Medals ([17](17-crafting.md)).

### 3. Stat follow-ups (IDL-387, IDL-172)

The catalog's rolled-stat ranges and the affix level scale are the open design questions (IDL-172 item 3 is unanswered), and some of the new stats need balance against the live sims (Thorns against fast monsters, Armor Penetration once monsters carry real armor, Boss Timer needs its cap). The decided rules stand: economy stats are fixed base stats on their own slots, never random affixes; random affixes among the new stats are Crit Damage (ring, neck), Armor Penetration (weapons), Thorns (shields) and Heal on Kill (ring, charm); the tooltip shows a tier label derived from item level (I 1-19, II 20-39, III 40-59, IV 60-79, V 80+). Not taken: Potion Power %, Sell Price %, and Chest Speed % as a rolled stat.

### 4. Art gaps

No art covers head, shoulder, chest, hands, cape, charm, axe, spear, dagger, bow, crossbow, staff, wand and tome in the reuse set; they stay on the legacy items. Prompts are in [item-resource-art-prompts](item-resource-art-prompts.md) (IDL-32..36). The 64x64 icons are registered at native size (they do not scale to the 40 px grid, art rule 3). One flame-axe picture still waits in `public/pixel/reuse/legendary/` (65x65 with 1567 colours, probably not pixel art, not registered): redraw, crop or drop. New pictures follow the Sprite Fusion rule in `CLAUDE.md`.

### 5. Potions with effects

The potion art is registered but only `healHp` potions exist; mana, regen, buff potions and the **Hourglass draught** (speeds up castle building by 1 h, a candidate for the utility set) wait for the effect model (IDL-155, IDL-156, IDL-160, IDL-177).
