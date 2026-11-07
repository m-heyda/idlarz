# 28 · Reuse items: asset manifest, disabled catalog entries, names and new stats (draft)

*Written 2026-11-07. Everything here is prepared and switched off: the game still drops, sells and equips the legacy items. Names, tiers, stats and set homes are proposals to confirm in the brainstorm (Linear IDL-20, IDL-39, IDL-149, IDL-160).*

## 1. What landed

- The 122 icons of PR #66 (`public/pixel/reuse/`) were reviewed picture by picture and **115 were moved with `git mv`** to `public/pixel/items/<slot>/<id>.png` with readable snake_case ids. Ids follow the catalog rule: stable once shipped, never reused.
- `public/pixel/reuse/misc/` is untouched (instructions to come). One file stays behind in `reuse/legendary/`: `sprite-fusion-b4884690-…png` (a flame axe). It is 65x65 with 1567 colours, so it is probably not pixel art and is **not registered**. Decide: redraw, crop to 64x64, or drop.
- Art is **64x64 and registered at its native size** (`config/itemArt.ts`, icon name `art_<id>`, path resolved in `config/pixelIcons.ts`). 64 does not scale to the 40 px grid without blurring (art rule 3), so frames that show these icons need a 64 px cell. That is the IDL-19 spike; for now nothing in the game shows them.
- The new folder is not touched by `scripts/pixel/build.py` (which prunes `public/pixel/icons`).
- **Disabled catalog entries**: `catalog/items/reuse.ts` has 91 items (`feet 9, legs 12, neck 12, ring 11, shields 12, swords 12, maces/mauls 12, legendary 11`), all with `enabled: false`. They are in `ITEMS` and `ITEM_CATALOG` (ids resolve, stats are checked by the catalog tests) but excluded from every loot pool, chest and the shop. `tests/reserveItems.test.ts` proves it. Enabling a group later means removing `enabled: false` for it, tuning, and regenerating `docs/generated/item-catalog.md`.
- Belt (12) and potion (12) art is registered but has **no catalog entries**: the belt slot does not exist yet (IDL-21, IDL-153/154) and potions only support `healHp` until the effect model lands (IDL-155).

## 2. Items with a catalog entry

Tier 1-4 are the material tiers of `catalog/stats.ts` (1 wood/cloth, 2 steel, 3 obsidian, 4 Rattatui-level). Stats use only the 13 existing item stat keys.

| Id | Name | Slot / type | Tier | Stats | Art |
| --- | --- | --- | --- | --- | --- |
| `frostglass_boots` | Frostglass Boots | feet | 3 | armor 3, maxMana 18, manaRegen 0.45 | `items/feet/frostglass_boots.png` |
| `sunsilk_boots` | Sunsilk Boots | feet | 4 | armor 4, maxHp 8, goldFind 9 | `items/feet/sunsilk_boots.png` |
| `plated_sabatons` | Plated Sabatons | feet | 3 | armor 5, maxHp 4 | `items/feet/plated_sabatons.png` |
| `fur_lined_boots` | Fur-lined Boots | feet | 2 | armor 2, maxHp 3, regen 0.4 | `items/feet/fur_lined_boots.png` |
| `mossweave_boots` | Mossweave Boots | feet | 2 | armor 2, maxHp 2, luck 2 | `items/feet/mossweave_boots.png` |
| `drake_scale_boots` | Drake-scale Boots | feet | 4 | armor 6, maxHp 8, critChance 4 | `items/feet/drake_scale_boots.png` |
| `ironbound_boots` | Ironbound Boots | feet | 2 | armor 4, maxHp 2 | `items/feet/ironbound_boots.png` |
| `shadowstep_boots` | Shadowstep Boots | feet | 3 | armor 2, dodge 2 | `items/feet/shadowstep_boots.png` |
| `wanderer_boots` | Wanderer's Boots | feet | 1 | armor 1, maxHp 3 | `items/feet/wanderer_boots.png` |
| `verdant_greaves` | Verdant Greaves | legs | 4 | armor 6, maxHp 9, regen 1.2 | `items/legs/verdant_greaves.png` |
| `patched_trousers` | Patched Trousers | legs | 1 | armor 1, maxHp 2 | `items/legs/patched_trousers.png` |
| `drover_breeches` | Drover's Breeches | legs | 1 | armor 1, maxHp 3 | `items/legs/drover_breeches.png` |
| `tanned_leather_pants` | Tanned Leather Pants | legs | 2 | armor 2, maxHp 3 | `items/legs/tanned_leather_pants.png` |
| `chainmail_leggings` | Chainmail Leggings | legs | 2 | armor 5, maxHp 3 | `items/legs/chainmail_leggings.png` |
| `ranger_pants` | Ranger Pants | legs | 2 | armor 3, maxHp 3, critChance 2 | `items/legs/ranger_pants.png` |
| `runed_skirt` | Runed Skirt | legs | 3 | armor 2, maxMana 18, spellPower 10 | `items/legs/runed_skirt.png` |
| `shadow_trousers` | Shadow Trousers | legs | 3 | armor 3, dodge 2 | `items/legs/shadow_trousers.png` |
| `knightly_legguards` | Knightly Legguards | legs | 3 | armor 6, maxHp 5 | `items/legs/knightly_legguards.png` |
| `steel_legplates` | Steel Legplates | legs | 3 | armor 7, maxHp 4 | `items/legs/steel_legplates.png` |
| `royal_silk_trousers` | Royal Silk Trousers | legs | 4 | armor 3, maxHp 8, goldFind 9 | `items/legs/royal_silk_trousers.png` |
| `fur_trimmed_leggings` | Fur-trimmed Leggings | legs | 2 | armor 3, maxHp 3, regen 0.4 | `items/legs/fur_trimmed_leggings.png` |
| `winged_sapphire_pendant` | Winged Sapphire Pendant | neck | 3 | maxHp 6, spellPower 10 | `items/neck/winged_sapphire_pendant.png` |
| `amethyst_shard_necklace` | Amethyst Shard Necklace | neck | 2 | maxMana 12, spellPower 7 | `items/neck/amethyst_shard_necklace.png` |
| `sun_locket` | Sun Locket | neck | 3 | maxHp 5, goldFind 6 | `items/neck/sun_locket.png` |
| `moon_pendant` | Moon Pendant | neck | 3 | maxMana 18, manaRegen 0.45 | `items/neck/moon_pendant.png` |
| `fang_necklace` | Fang Necklace | neck | 2 | critChance 2, lifeLeech 1 | `items/neck/fang_necklace.png` |
| `heartstone_pendant` | Heartstone Pendant | neck | 3 | maxHp 8, regen 0.8 | `items/neck/heartstone_pendant.png` |
| `seraph_collar` | Seraph Collar | neck | 4 | armor 3, maxHp 12, dodge 3 | `items/neck/seraph_collar.png` |
| `ember_medallion` | Ember Medallion | neck | 3 | maxHp 4, critChance 3 | `items/neck/ember_medallion.png` |
| `ruby_teardrop` | Ruby Teardrop | neck | 3 | maxHp 4, superCrit 2 | `items/neck/ruby_teardrop.png` |
| `emerald_amulet` | Emerald Amulet | neck | 3 | maxHp 5, luck 3 | `items/neck/emerald_amulet.png` |
| `nightshard_pendant` | Nightshard Pendant | neck | 4 | superCrit 3, lifeLeech 1.5 | `items/neck/nightshard_pendant.png` |
| `leaf_amulet` | Leaf Amulet | neck | 2 | maxHp 3, regen 0.4 | `items/neck/leaf_amulet.png` |
| `ruby_signet` | Ruby Signet | ring | 2 | maxHp 3, critChance 2 | `items/ring/ruby_signet.png` |
| `sapphire_teardrop_ring` | Sapphire Teardrop Ring | ring | 4 | maxMana 26, spellPower 14 | `items/ring/sapphire_teardrop_ring.png` |
| `iron_band` | Iron Band | ring | 1 | armor 1, maxHp 2 | `items/ring/iron_band.png` |
| `gold_signet` | Gold Signet | ring | 2 | maxHp 2, goldFind 4 | `items/ring/gold_signet.png` |
| `turquoise_band` | Turquoise Band | ring | 2 | maxHp 2, dodge 1.5 | `items/ring/turquoise_band.png` |
| `emerald_signet` | Emerald Signet | ring | 2 | maxHp 2, luck 2 | `items/ring/emerald_signet.png` |
| `crimson_crown_ring` | Crimson Crown Ring | ring | 4 | critChance 4, superCrit 3 | `items/ring/crimson_crown_ring.png` |
| `steel_sapphire_ring` | Steel Sapphire Ring | ring | 3 | armor 2, maxHp 5 | `items/ring/steel_sapphire_ring.png` |
| `thornvine_ring` | Thornvine Ring | ring | 2 | maxHp 2, regen 0.4 | `items/ring/thornvine_ring.png` |
| `skull_ring` | Skull Ring | ring | 3 | maxHp 3, lifeLeech 1.5 | `items/ring/skull_ring.png` |
| `amethyst_ring` | Amethyst Ring | ring | 3 | maxMana 18, manaRegen 0.45 | `items/ring/amethyst_ring.png` |
| `lionguard_shield` | Lionguard Shield | offHand / shield | 3 | armor 10, maxHp 4 | `items/offHand/lionguard_shield.png` |
| `battered_buckler` | Battered Buckler | offHand / shield | 1 | armor 3, maxHp 2 | `items/offHand/battered_buckler.png` |
| `thornspike_shield` | Thornspike Shield | offHand / shield | 4 | armor 9, maxHp 8, lifeLeech 1.5 | `items/offHand/thornspike_shield.png` |
| `oak_roundshield` | Oak Roundshield | offHand / shield | 1 | armor 4, maxHp 2 | `items/offHand/oak_roundshield.png` |
| `crusader_shield` | Crusader Shield | offHand / shield | 2 | armor 8, maxHp 2 | `items/offHand/crusader_shield.png` |
| `bronze_crossbar_shield` | Bronze Crossbar Shield | offHand / shield | 2 | armor 6, maxHp 3 | `items/offHand/bronze_crossbar_shield.png` |
| `ironbound_pavise` | Ironbound Pavise | offHand / shield | 3 | armor 12, maxHp 2 | `items/offHand/ironbound_pavise.png` |
| `verdant_kite_shield` | Verdant Kite Shield | offHand / shield | 3 | armor 7, maxHp 6, regen 0.8 | `items/offHand/verdant_kite_shield.png` |
| `runeward_roundel` | Runeward Roundel | offHand / shield | 4 | armor 8, maxHp 6, maxMana 18 | `items/offHand/runeward_roundel.png` |
| `frostcrystal_aegis` | Frostcrystal Aegis | offHand / shield | 4 | armor 9, maxMana 18, dodge 3 | `items/offHand/frostcrystal_aegis.png` |
| `steel_tower_shield` | Steel Tower Shield | offHand / shield | 3 | armor 11, maxHp 2 | `items/offHand/steel_tower_shield.png` |
| `royal_lion_crest` | Royal Lion Crest | offHand / shield | 4 | armor 11, maxHp 8, goldFind 9 | `items/offHand/royal_lion_crest.png` |
| `gilded_longsword` | Gilded Longsword | mainHand / sword | 4 | damage 24, critChance 3 | `items/mainHand/sword/gilded_longsword.png` |
| `voidiron_blade` | Voidiron Blade | mainHand / sword | 4 | damage 22, superCrit 3 | `items/mainHand/sword/voidiron_blade.png` |
| `rusty_broadsword` | Rusty Broadsword | mainHand / sword | 1 | damage 6 | `items/mainHand/sword/rusty_broadsword.png` |
| `runed_jade_blade` | Runed Jade Blade | mainHand / sword | 3 | damage 18, luck 3 | `items/mainHand/sword/runed_jade_blade.png` |
| `old_rusted_blade` | Old Rusted Blade | mainHand / sword | 1 | damage 7 | `items/mainHand/sword/old_rusted_blade.png` |
| `arming_sword` | Arming Sword | mainHand / sword | 2 | damage 12 | `items/mainHand/sword/arming_sword.png` |
| `notched_broadsword` | Notched Broadsword | mainHand / sword | 2 | damage 14 | `items/mainHand/sword/notched_broadsword.png` |
| `seraph_blade` | Seraph Blade | mainHand / sword | 4 | damage 23, lifeLeech 1.5 | `items/mainHand/sword/seraph_blade.png` |
| `frostbrand` | Frostbrand | mainHand / sword | 3 | damage 17, critChance 3 | `items/mainHand/sword/frostbrand.png` |
| `blue_pommel_longsword` | Blue Pommel Longsword | mainHand / sword | 2 | damage 12, critChance 2 | `items/mainHand/sword/blue_pommel_longsword.png` |
| `cinderfang_sword` | Cinderfang Sword | mainHand / sword | 3 | damage 19, critChance 3 | `items/mainHand/sword/cinderfang_sword.png` |
| `silver_scimitar` | Silver Scimitar | mainHand / sword | 2 | damage 11, critChance 3 | `items/mainHand/sword/silver_scimitar.png` |
| `stone_hammer` | Stone Hammer | mainHand / maul | 1 | damage 12 | `items/mainHand/maul/stone_hammer.png` |
| `spiked_mace` | Spiked Mace | mainHand / mace | 2 | damage 17 | `items/mainHand/mace/spiked_mace.png` |
| `iron_warhammer` | Iron Warhammer | mainHand / maul | 2 | damage 19 | `items/mainHand/maul/iron_warhammer.png` |
| `verdigris_mace` | Verdigris Mace | mainHand / mace | 2 | damage 17 | `items/mainHand/mace/verdigris_mace.png` |
| `sunburst_mace` | Sunburst Mace | mainHand / mace | 3 | damage 25, goldFind 6 | `items/mainHand/mace/sunburst_mace.png` |
| `knotted_cudgel` | Knotted Cudgel | mainHand / mace | 1 | damage 9 | `items/mainHand/mace/knotted_cudgel.png` |
| `frostcrystal_mace` | Frostcrystal Mace | mainHand / mace | 3 | damage 24, critChance 3 | `items/mainHand/mace/frostcrystal_mace.png` |
| `magma_flail` | Magma Flail | mainHand / mace | 4 | damage 32, critChance 4 | `items/mainHand/mace/magma_flail.png` |
| `gnarled_club` | Gnarled Club | mainHand / mace | 1 | damage 9 | `items/mainHand/mace/gnarled_club.png` |
| `deathgrin_mace` | Deathgrin Mace | mainHand / mace | 4 | damage 30, lifeLeech 1.5 | `items/mainHand/mace/deathgrin_mace.png` |
| `runed_warhammer` | Runed Warhammer | mainHand / maul | 3 | damage 30 | `items/mainHand/maul/runed_warhammer.png` |
| `iron_morningstar` | Iron Morningstar | mainHand / mace | 2 | damage 18, critChance 2 | `items/mainHand/mace/iron_morningstar.png` |
| `runeforged_titanhammer` | Runeforged Titanhammer | mainHand / maul | 5 | damage 44, critChance 4, superCrit 6 | `items/legendary/runeforged_titanhammer.png` |
| `cindercrescent_glaive` | Cindercrescent Glaive | mainHand / spear | 5 | damage 30, critChance 8, superCrit 6 | `items/legendary/cindercrescent_glaive.png` |
| `frostbloom_fan` | Frostbloom Fan | mainHand / wand | 5 | damage 20, spellPower 18, manaRegen 0.9 | `items/legendary/frostbloom_fan.png` |
| `voidrune_blade` | Voidrune Blade | mainHand / sword | 5 | damage 31, critChance 8, superCrit 8 | `items/legendary/voidrune_blade.png` |
| `reapers_crescent` | Reaper's Crescent | mainHand / axe | 5 | damage 34, critChance 6, lifeLeech 3 | `items/legendary/reapers_crescent.png` |
| `nightfall_edge` | Nightfall Edge | mainHand / sword | 5 | damage 32, critChance 10, superCrit 6 | `items/legendary/nightfall_edge.png` |
| `tidecaller_axe` | Tidecaller Axe | mainHand / axe | 5 | damage 33, critChance 6, dodge 4 | `items/legendary/tidecaller_axe.png` |
| `stormtrident` | Stormtrident | mainHand / spear | 5 | damage 29, critChance 12, superCrit 8 | `items/legendary/stormtrident.png` |
| `amethyst_spire` | Amethyst Spire | mainHand / staff | 5 | damage 26, spellPower 18, maxMana 36 | `items/legendary/amethyst_spire.png` |
| `dawnbringer_trident` | Dawnbringer Trident | mainHand / spear | 5 | damage 30, luck 6, goldFind 12 | `items/legendary/dawnbringer_trident.png` |
| `cinderflight_bow` | Cinderflight Bow | mainHand / bow | 5 | damage 25, critChance 18, superCrit 10 | `items/legendary/cinderflight_bow.png` |

Legendaries (tier 5) are `named`, `fixedRarity: 'legendary'`, pool `legendary_weapons`; the three legacy legendaries (Emberbrand, Starfall Bow, Titan Maul) are unchanged and still the only ones that drop.

## 3. Belt (12 art files, waiting for the slot)

Belt stat identity decided in IDL-138: potion capacity and small capped bag slots, potion cooldown floor 4 s. Proposed names and homes:

| Id | Name idea | Home |
| --- | --- | --- |
| `worn_leather_belt`, `tanned_sash` | starter belts | Woodland |
| `ironbuckle_belt` | steel buckle belt | Knight |
| `studded_nightbelt` | black studs | Obsidian-like dark set |
| `chain_girdle` | chain links | Knight |
| `warden_plate_belt` | steel plate on red leather | Ashen Warlord |
| `ruby_cincture` | ruby on gold | Ashen Warlord / Sunhoney |
| `sunforged_cincture` | gold sun with a chain | Sunhoney |
| `crownguard_belt` | crowned gold plate | Sunhoney (top tier) |
| `runebound_girdle` | blue runes | Apprentice / frost line |
| `hunter_trophy_belt` | pouches and teeth | Blightbound / hunter line |
| `alchemist_bandolier` | vials and scrolls | the potion belt: carries the most potion stats |

## 4. Potions (12 art files, waiting for the effect model)

| Id | Idea | Status |
| --- | --- | --- |
| `healing_flask`, `greater_healing_flask` | HP potions (replace the two legacy flasks' art) | needs only the icon swap |
| `mana_potion` | mana (IDL-155) | |
| `vitality_heart` | regen over time | |
| `hourglass_draught` | **speeds up castle building by 1 h** (user idea; candidate for the utility set, IDL-160) | economy/utility, server-owned |
| `phoenix_elixir` | revive on defeat once | rare find |
| `stoneskin_tonic` | Ironskin buff | IDL-156 |
| `starwater_elixir` | Keen Eye or Haste buff | IDL-156 |
| `arcane_swirl` | spell power / mana buff | IDL-156 |
| `prism_shard` | Chest Beacon or a gem-like utility | IDL-160 |
| `venom_flask`, `toxin_vial` | monster debuff or thrown item; maybe skip | open |

## 5. Set homes (IDL-39)

The three planned special sets get a palette from what exists:

- **Sunhoney** (gold, sun, silk): `sunsilk_boots`, `royal_silk_trousers`, `sun_locket`, `gold_signet`, `sunburst_mace`, `royal_lion_crest`, `gilded_longsword`, `sunforged_cincture`, `crownguard_belt`.
- **Ashen Warlord** (red, fire, black iron): `drake_scale_boots`, `ember_medallion`, `ruby_signet`, `crimson_crown_ring`, `magma_flail`, `cinderfang_sword`, `thornspike_shield`, `warden_plate_belt`.
- **Blightbound** (green, thorn, toxic): `mossweave_boots`, `verdant_greaves`, `leaf_amulet`, `thornvine_ring`, `emerald_amulet`, `verdant_kite_shield`, `hunter_trophy_belt`. **Update 2026-11-07 (IDL-23): Blightbound is violet-black with a toxic-green glow, so these green pieces are palette-swap candidates, not set pieces as they are.**
- **Frost line** (ice, fur, silver; not planned yet): `frostglass_boots`, `fur_lined_boots`, `fur_trimmed_leggings`, `moon_pendant`, `frostbrand`, `frostcrystal_mace`, `frostcrystal_aegis`, `runebound_girdle`.
- Plain families (no bonus): the rest, graded by tier.

## 6. Legendary perk drafts (IDL-42, IDL-149)

Perks are not wired and are not in the stats. **Roster decided 2026-11-07 (owner, IDL-144/146/149):** one headline family per item (no two legendaries share a family), fixed numbers per tier (a perk does not scale with item level), 11 items, two special-effect handlers at launch. The Rattatui set is deleted (see below), so the 35 % damage anchor is gone; the damage cap of 45 % is now met by S2 (38) or S3 (40) plus one 10 % legendary, which keeps "set or legendary".

| Item | Headline perk | Tier | Source |
| --- | --- | --- | --- |
| `dawnbringer_trident` | +25 % income | top | boss / T4 relic |
| `runeforged_titanhammer` | −25 % building time (shares the −60 % combined cap with Embers and Idols) | top | boss / T4 relic |
| `reapers_crescent` | +25 % kill reward (cap 60 %) | top | boss / T4 relic |
| `frostbloom_fan` | +15 % XP | mid | chest / rare monster |
| `voidrune_blade` | +15 points offline efficiency | mid | chest / rare monster |
| `nightfall_edge` | +15 % click gold | mid | chest / rare monster |
| `tidecaller_axe` | −15 % chest interval (floor 8 min) | mid | chest / rare monster |
| `stormtrident` | +15 % max HP | mid | chest / rare monster |
| `cinderflight_bow` | +15 Gold Find | mid | chest / rare monster |
| `cindercrescent_glaive` | +10 % damage and **Burn** | combat | chest / rare monster |
| `amethyst_spire` | **Potion refund** 15 % | handler | chest / rare monster |

Handlers (launch set of two, deterministic from the sealed fight stream):
- **Burn**: a critical hit sets the monster alight for 3 s; it takes 30 % of that hit per second. A re-crit refreshes, never stacks.
- **Potion refund**: a drunk potion is not consumed with 15 % chance (rolled from the same sealed stream; never refunds a buff potion that has a cooldown).

Sources and pity (IDL-146): top-tier items come only from bosses and T4 relics (pity as `king_legendary`: 5 % + 1 % per miss, max +10 %); the first legendary is guaranteed from the first boss kill after level 15. Mid and handler items come from the `legendary_weapons` pool through the 1.9 % chest replace roll and the 0.2 % to 1 % monster legendary rarity weight (level gate 12 to 15). Everything wipes at rebirth except the one Vault item (IDL-148). Unique: a second copy of the same id never drops while one is in the bag, gear or Vault.

Classic legendaries (`emberbrand`, `starfall_bow`, `titan_maul`) stay as stat-only legendaries without perks.

**Rattatui set removed (2026-11-07, owner):** it was for beta testers while rats existed. Drops stop with IDL-55 (out of every pool and boss source); the definitions are deleted at the epoch reset (IDL-76) because every bag is wiped there, so no `retired` compatibility flag is needed beyond that.

## 7. New item stats (decided 2026-11-07)

None of these exists yet; adding one means `STAT_DEFS`, `STAT_BASE_BY_TIER`, a combat/economy consumer, the server profile and the stat-audit pins. Tracked in Linear (IDL-175 decision, IDL-176 build task).

| Stat | Slots | Hook | Notes |
| --- | --- | --- | --- |
| Crit Damage % | rings, neck | `critDamagePercent` in the fight engine (attributes only today) | easy |
| Armor Penetration % | main-hand weapons | monster armor in the damage step | matters once monsters carry real armor |
| Thorns % | shields | monster-swing step in `fight.ts` | needs balance against fast monsters |
| Build Speed % | hands, chest | castle upgrade timer | shares the -60 % combined cap with Embers and Idols (IDL-149); legendary perk of the same family |
| Tile Discount % | cape, neck | `effectiveTileDiscount` | stays under the 45 % cap with Charisma and Bulk |
| Farm Yield % | hands | `calculateFarmOutput` | client maths today; the server only rebuilds rates |
| Heal on Kill % | rings, charm | kill step (`payKill`) in the server fight engine | sustains auto-battle |
| Boss Timer +s | head, shoulder | boss clock in `fight.ts` (180 s) | needs a cap |
| Potion Cooldown %, Bag Slots | belt | already decided in IDL-138 | floor 4 s; small capped bag slots |

Not taken (stay out of the plan for now): Potion Power %, Sell Price %, and Chest Speed % as a rolled stat (chest speed stays a legendary perk family only).

## 8. Asset gaps (nothing in `reuse/` covers these)

head, shoulder, chest, hands, cape, charm, axe, spear, dagger, bow, crossbow, staff, wand, tome. They stay on the legacy items; generation prompts are in `docs/item-resource-art-prompts.md` (Linear IDL-32..36).

## 9. Enabling checklist

1. Settle the frame size (64 px cell) and the palette gate for the special sets (IDL-19, IDL-23).
2. Pick the first group (for example rings or feet), set tier and stats, remove `enabled: false`.
3. `npm run catalog-report`, `npm run loot-sim`, `npm test`.
4. Retire the old art only after the new is wired (art rule 6).

## 10. Special set bonuses (decided 2026-11-07, IDL-39; numbers are placeholders until `fight-sim` and `sim` have run)

14 pieces each (13 slots plus the belt), thresholds **3 / 6 / 9 / 12 / 14**, `SetDef` shape as in `catalog/sets.ts` (every reached threshold applies, so the rows add up). **Power rule: a full set reaches 70-90 % of its family caps by itself** (caps of IDL-149: income 50, XP 40, kill reward 60, click 40, damage 45), so one top legendary still tips a family over the cap: set or legendary is a choice, but a special set is clearly stronger than Obsidian (income 26, XP 25, kill reward 37) and Rattatui (damage 35). Only existing stat keys are used; the new stats of section 7 (Crit Damage, Armor Penetration, Thorns, Build Speed, Tile Discount, Farm Yield) are added to these rows after IDL-176, one small step each, inside the same caps.

| Set | 3 | 6 | 9 | 12 | 14 (full) | Full-set totals |
|---|---|---|---|---|---|---|
| **S1 Sunhoney** (economy, no defence) | income 8, gold find 10 | XP 10, click 8 | kill reward 20, offline eff 10, income 10 | income 10, XP 10, offline cap 3 h, gold find 10, click 6 | income 10, XP 12, kill reward 28, offline eff 10, offline cap 3 h, gold find 10, click 6 | income 38, XP 32, kill reward 48, offline eff 20, offline cap +6 h, click 20, gold find 30 |
| **S2 Ashen Warlord** (combat plate) | damage 6, armor 6 | max HP 10 %, crit 4 | damage 12, armor 8, regen 2 | damage 10, max HP 8 %, crit 4, armor 6 | damage 10, max HP 7 %, crit 4, regen 2, kill reward 10, armor 4 | damage 38, max HP 25 %, armor 24, crit 12, regen 4, kill reward 10 |
| **S3 Blightbound** (caster/leech, fragile: no armor, no max HP) | damage 8, luck 3 | leech 3, crit 4 | damage 12, luck 5, super crit 4 | damage 10, leech 2, crit 3, luck 4 | damage 10, leech 3, crit 3, luck 3, super crit 6 | damage 40, leech 8, luck 15, crit 10, super crit 10 |

Checks before the numbers are final: `fight-sim` for S2 and S3 damage (also with one top legendary on top, which must stop at the cap of 45) against Rattatui's 35; `npm run sim` with an S1 profile (income, XP and kill reward caps, run-2 ratio 60-70 %, pacing guard +-15 %); a test that no set bonus pushes a family past its `HARD_LIMITS`. Sources and piece acquisition (boss, relic, war medal, Blight Ichor) belong to IDL-146; the Rattatui retirement stays in IDL-55.
