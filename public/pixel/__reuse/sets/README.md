# __reuse/sets (63 prepared equipment sets, 990 sprites)

Three 64 px sprite sheets supplied by the owner on 2026-11-16 (a **knight**, a **samurai** and a **shinobi** sheet; 16 columns x 21 rows of 64x64 cells). Every **row of a sheet is one matching set** (same colours and trim from helmet to boots to weapons), so each row became a folder here and each non-empty cell a PNG named by its role. The sprites are the 64x64 cells exactly as drawn, which is the game's item art size (`ITEM_ART_SIZE`), so a piece can be wired by copying it to `public/pixel/items/<slot>/` and registering it (`src/config/itemIcons/README.md`).

In Storybook: Assets > Equipment sets, *Gallery* (every piece as a card, filter by status or slot) and *BySet* (one row per set). Nothing here is a game set yet: **no set has a bonus**, and the names are proposals (the colour of the chest plus one word per row). Linear: IDL-347.

## Roles (file names)

| Group | Roles |
| ----- | ----- |
| armor | `head`, `chest`, `legs` (trousers), `leg_guards` (greaves), `shoulder`, `hands`, `feet` |
| accessories | `belt`, `neck` (gorget, knight sheet), `mask` (face mask: samurai mempo, shinobi scarf), `misc` (whetstones, rings, bombs, some shields), `gourd` |
| weapons | knight: `spear`, `polearm`, `glaive`, `halberd`, `javelins`, `sword`; samurai: `sword`, `sword_short`, `dagger`, `spear`, `polearm`, `bow`, `club`, `fan`; shinobi: `staff`, `tonfa`, `nunchaku`, `knuckles`, `baton`, `kunai` |

Weapon roles follow the column a weapon stands in on its sheet; some rows put an unusual weapon there (kusarigama, hooks, wheels), so look at the picture before wiring a weapon. A set does **not** have to be used whole: the idea is separate sets for armor and weapons and for accessories only, so a character is built from several sets (plus legendary attributes late in the game) instead of one linear ladder. The grouping is in `scripts/assets/equipment-sets.json` (`id`, `name`, `theme`, `sheet`, `row`, `pieces`); trim or regroup it there and in this folder when a set is decided.

Knight sheet rows 14 and 15 have no gorget, and the last row (20) is only four pieces; the slicer knows (`pieces` lists what exists).

## Already wired as item icons

About 70 old built 40 px stand-ins use pieces from these sheets: rag hood, hide cap, iron cap, leather cap, cloth hat, steel and obsidian helm; rag tunic, hide jerkin, iron mail, leather vest, cloth robe, steel and obsidian cuirass; wraps, gloves, gauntlets; leggings, trousers, greaves; boots, slippers, sabatons; patched mantle, hide pauldrons, iron spaulders; steel gorget; iron sword, obsidian blade, daggers, spears, bows, club, mace, maul, staves, two shields. The file under `items/` is a copy; the piece here is tagged `used` in Storybook with the icon name. The list is `scripts/assets/equipment-used.json`.

## The sets

### knight (sheet 33, 21 sets)

| Row | Set | Folder | Pieces |
| --- | --- | ------ | ------ |
| 0 | Brown Recruit | `brown_recruit/` | 16 |
| 1 | Steel Guard | `steel_guard/` | 16 |
| 2 | Steel Warden | `steel_warden/` | 16 |
| 3 | Steel Sentinel | `steel_sentinel/` | 16 |
| 4 | Steel Vanguard | `steel_vanguard/` | 16 |
| 5 | Crimson Champion | `crimson_champion/` | 16 |
| 6 | Steel Marshal | `steel_marshal/` | 16 |
| 7 | Crimson Templar | `crimson_templar/` | 16 |
| 8 | Crimson Crusader | `crimson_crusader/` | 16 |
| 9 | Green Bulwark | `green_bulwark/` | 16 |
| 10 | Steel Legionnaire | `steel_legionnaire/` | 16 |
| 11 | Teal Paladin | `teal_paladin/` | 16 |
| 12 | Steel Lancer | `steel_lancer/` | 16 |
| 13 | Silver Captain | `silver_captain/` | 16 |
| 14 | Crimson Defender | `crimson_defender/` | 15 |
| 15 | Tan Banneret | `tan_banneret/` | 15 |
| 16 | Silver Justicar | `silver_justicar/` | 16 |
| 17 | Tan Dragoon | `tan_dragoon/` | 16 |
| 18 | Steel Castellan | `steel_castellan/` | 16 |
| 19 | Silver Herald | `silver_herald/` | 16 |
| 20 | Iron Squire | `iron_squire/` | 4 |

### samurai (sheet 34, 21 sets)

| Row | Set | Folder | Pieces |
| --- | --- | ------ | ------ |
| 0 | Steel Ashigaru | `steel_ashigaru/` | 16 |
| 1 | Steel Bushi | `steel_bushi/` | 16 |
| 2 | Brown Ronin | `brown_ronin/` | 16 |
| 3 | Steel Kensei | `steel_kensei/` | 16 |
| 4 | Steel Hatamoto | `steel_hatamoto/` | 16 |
| 5 | Steel Daimyo | `steel_daimyo/` | 16 |
| 6 | Steel Shogun | `steel_shogun/` | 16 |
| 7 | Steel Oni Hunter | `steel_oni_hunter/` | 16 |
| 8 | Crimson Tenku | `crimson_tenku/` | 16 |
| 9 | Navy Kage | `navy_kage/` | 16 |
| 10 | Silver Yari Guard | `silver_yari_guard/` | 16 |
| 11 | Crimson Taisho | `crimson_taisho/` | 16 |
| 12 | Steel Ryujin | `steel_ryujin/` | 16 |
| 13 | Silver Karasu | `silver_karasu/` | 16 |
| 14 | Steel Raijin | `steel_raijin/` | 16 |
| 15 | Steel Fujin | `steel_fujin/` | 16 |
| 16 | Crimson Kitsune | `crimson_kitsune/` | 16 |
| 17 | Crimson Tora | `crimson_tora/` | 16 |
| 18 | White Okami | `white_okami/` | 16 |
| 19 | Pink Ame | `pink_ame/` | 16 |
| 20 | Tan Hotaru | `tan_hotaru/` | 12 |

### shinobi (sheet 35, 21 sets)

| Row | Set | Folder | Pieces |
| --- | --- | ------ | ------ |
| 0 | Brown Genin | `brown_genin/` | 16 |
| 1 | Tan Chunin | `tan_chunin/` | 16 |
| 2 | Iron Jonin | `iron_jonin/` | 16 |
| 3 | Silver Wanderer | `silver_wanderer/` | 16 |
| 4 | Crimson Shadow | `crimson_shadow/` | 16 |
| 5 | Silver Monk | `silver_monk/` | 16 |
| 6 | Steel Scout | `steel_scout/` | 16 |
| 7 | Steel Mist | `steel_mist/` | 16 |
| 8 | Orange Viper | `orange_viper/` | 16 |
| 9 | Blue Crane | `blue_crane/` | 16 |
| 10 | Pink Tiger | `pink_tiger/` | 16 |
| 11 | Brown Heron | `brown_heron/` | 16 |
| 12 | Red Moth | `red_moth/` | 16 |
| 13 | Steel Fox | `steel_fox/` | 16 |
| 14 | Steel Raven | `steel_raven/` | 16 |
| 15 | Navy Sparrow | `navy_sparrow/` | 16 |
| 16 | Green Lotus | `green_lotus/` | 16 |
| 17 | Steel Bamboo | `steel_bamboo/` | 16 |
| 18 | White Willow | `white_willow/` | 16 |
| 19 | Silver Cicada | `silver_cicada/` | 16 |
| 20 | Steel Drifter | `steel_drifter/` | 16 |

Licence: provided by the owner, free to use for the game (same terms as the rest of `public/pixel`).
