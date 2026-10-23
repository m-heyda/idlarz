# 02 · Mechanics

Exact rules as implemented. Constants live in [`src/config/gameConfig.ts`](../src/config/gameConfig.ts); formulas and tables are in [03](03-formulas-and-scaling.md). The in-game tutorial (`Tutorial.tsx`) is generated from the same constants, so it always matches this document.

## 1. The loop in one paragraph

You start with a castle on a 50×50 map and 125 gold. Gold, other resources and XP trickle in every second. Gold (plus wood/stone/coal later) buys **adjacent unexplored tiles**, each of which becomes a biome and adds income. The **castle** is a big timed upgrade that multiplies everything. **Farm animals** turn food into meat, the **merchant** converts anything into gold (and back, at a loss), **clicking the map** and **chests** add active bonuses, and every **level** gives a stat point. First finish line = castle 6, best click power and ~40+ tiles (about 4 weeks for an active player, [06](06-playtest-and-pacing-report.md)). After that the game continues with castle levels 7–10 and **Rebirth** (§13), which restarts the map for permanent Legacy bonuses.

## 2. Map & buying tiles

- Grid 50×50, castle at (25, 25) owned from the start; drag to pan, mouse wheel to zoom (four fixed steps).
- A tile can be bought only if it is **4-neighbour adjacent** to an owned tile and you can pay its whole cost: gold, plus **extra resources from larger territories** (`TILE_RESOURCE_COST`: wood + stone from the 15th owned tile, coal from 30, food from 40). Charisma discounts every part of the cost (0.5 %/point, max 25 %). The hover card and the biome picker show all costs, green when affordable.
- Cost curve: ×1.45 per owned tile up to 20 tiles, ×1.27 up to 40, ×1.17 per tile after that ([03 §1](03-formulas-and-scaling.md#1-tile-cost)).
- Not enough → shake + `wrong` sound. Success → `purchase` sound, XP, +100 reputation.
- **Biome assignment**: random (weighted) among the 8 non-special biomes, except when `owned % 4 === 3` (owned = 3, 7, 11 … because the castle counts): then you **choose**. Nothing is charged until you choose; cancel is free; only offered biomes are accepted. **Weights** (`BIOME_SPAWN`): every biome 1, Coast 0.6; next to an owned Lake, Lake and Coast ×3; next to an owned Coast, Lake and Coast ×2 - so water clusters into bays with beaches. Water/coast are placeholders for later mechanics (fishing huts etc.).
- Name prompt + tutorial at exactly 2 owned tiles while the name is still `Explorer`.

## 3. Biomes, adjacency, buildings

| Biome | Output / s (before adjacency & modifiers) |
| --- | --- |
| Castle (unique) | gold 0.1, wood 0.05, stone 0.1, food 0.05, xp 0.5 (not scaled) |
| Grounds | xp 0.195, gold 0.065, wood 0.065 |
| Forest | gold 0.13, wood 0.39 |
| Plains | gold 0.13, food 0.39 (+5 % meat modifier per Plains tile) |
| Hills | gold 0.065, stone 0.39, coal 0.26 |
| Swamp | food 0.13, wood 0.26 |
| Tundra | gold 0.13, coal 0.455 |
| Lake | gold 0.065, food 0.325 |
| Coast | gold 0.13, food 0.26 |

(Config values × `BIOME_YIELD.scale` = 1.3.) **Adjacency**: each owned same-biome 4-neighbour adds +25 % to that tile's output, including its building.

**Grounds + buildings**: click an owned Grounds tile once to pick a permanent building. Buildings now **cost resources** (500 gold, 250 wood, 150 stone for the first, ×1.6 for every further one) and the dialog shows the price. Building output (×1.3 yield scale, plus adjacency): Farm food 0.2 · Mine stone/coal 0.2 · Lumber Mill wood 0.2 · Market gold 0.2 · Blacksmith 0.07 of all five · Workshop xp 0.2.

## 4. Resources

Gold, wood, stone, coal, food, meat, xp. All except gold/xp can be sold to the merchant; all except xp can be bought (at 2× the sell price). The header hides xp (it is the level bar). No stockpile can exceed 10¹⁵.

## 5. Castle

- Max level 10. **Each upgrade is a timed build**: resources are paid up front, then the castle works for 1 h, 4 h, 12 h, 36 h and 72 h (levels 2–6, 5 d 5 h in total), then 3 d, 4 d, 5 d and 7 d for levels 7–10 (24 d 5 h in total). Master Builders (Legacy) shortens these times. It keeps its current bonus meanwhile and only one upgrade runs at a time. The timer is advanced by the game tick (never by the system clock), is saved, and is shown in the castle dialog and its tooltip.
- Effect of level L: the modifier of every resource doubles each level up to 6 (+20 % … +640 %), then grows by a flat +320 % per level (+960 % at 7 … +1920 % at 10), plus **+0.5 XP/s per level above 1** (flat). The castle sprite glows brighter from level 6 on, and level 10 gets sparks and the gold border.
- Costs: see [03 §4](03-formulas-and-scaling.md#4-castle) (gold, wood, stone, coal from level 2→3, food + meat from 3→4; levels 7–10 cost about 1.6× the previous step).

## 6. Farm

- Each purchase adds **one more animal** of that kind (production = base × count). First cost in food: chicken 10 K, deer 50 K, pig 200 K, cow 1 M; each next one of the same kind costs ×1.5 / 1.6 / 1.7 / 1.8 more.
- Meat income = `Σ production × (1 + castle modifier + 0.05 × Plains tiles)`.
- While the Farm window is open a critter wanders by every 20–40 s (one at a time, 10 s lifetime): click it for a gift (golden ones ×2). The store decides the amount (about 10 s of income, never less than the critter's minimum) and enforces an 8 s cooldown for the window; the click limiter applies.

## 7. Merchant

- Sell: wood 0.5, stone 0.5, coal 1, food 0.75, meat 1 gold per unit (`floor(amount × price)`).
- Buy: 2× the sell price, rounded **up**. Buying then selling (or the reverse) can never gain gold — covered by tests.
- **Click power** upgrades (gold per click as a % of your gold/s): 50 % → 90 % (750 K) → 130 % (2.5 M) → 180 % (10 M).
- Three tabs (Upgrade Items / Quests / Gambling) are still placeholders ([04](04-unfinished-and-known-issues.md)). The window always opens on the Sell tab.

## 8. Clicking

- A **real click on the map** pays `gold/s × click power`. A click on an owned tile also taps it: `0.5 s` of that tile's output (each tile has a 1.2 s cooldown; critical "lucky" taps use your crit stats).
- Clicks on menus, the header, buttons and dialogs never pay. Script-dispatched (untrusted) clicks never pay.
- **Rate limit** (token buckets, shared by gold click and tile tap): up to 8 clicks in a burst, 5 clicks/s sustained, plus a long-run allowance (20 000 clicks bank, refilling 1.5 clicks/s ≈ 130 K paid clicks/day). A fast human is never limited; an auto-clicker is capped at roughly a dedicated human ([07](07-security-and-exploits.md)).

## 9. Chests

A chest appears on a random owned non-castle tile every 10 min (the timer only runs while fewer than 5 chests wait). The chest is drawn as a glowing, gently bobbing treasure chest on the tile. Collect it by clicking the tile: reward = `passive gold/s × random 10–60 min × (1 + 0.5 % × Luck)`. Chests are saved with the map.

## 10. XP, levels and stat points

XP comes from passive income (`total.xp × (1 + xpGainMultiplier)`) and from every tile purchase. Level N → N+1 needs `floor(750 × 1.3^(N−1))` XP; each level gives one stat point (also when the level-up comes from a tile purchase).

## 11. Character stats

| Stat | Per point |
| --- | --- |
| Strength | stone & coal +2.5 % |
| Dexterity | wood & food +2.5 % |
| Intelligence | gold +2.5 %, XP production +0.2 %, XP gained +0.2 % |
| Vitality | wood & food +2.5 % |
| Charisma | gold & coal +2.5 %, XP production +0.25 %, XP gained +0.25 %, tile cost −0.5 % (max −25 %), Luck +1 (chests) |

All text in tooltips and the tutorial comes from `CHARACTER_STAT_CONFIG`. Other derived stats (HP, MP, attack, defence, crit, reputation …) are display-only for now.

## 12. UI surfaces

Header (avatar → Statistics, Character, Merchant, Farm; resource counters with base/modifier/total tooltips), map with tile hover cards, castle dialog (with timer), building dialog (with cost), biome picker (with all costs), level-up and chest toasts, loading screen (until the save is loaded), name prompt + tutorial, class picker, dev-only debug panel, and the **hidden save tools** (press Control five times): export / import / reset ([07](07-security-and-exploits.md)). Also Settings, Legacy (rebirth + shop) and the re-openable tutorial. A small orange **notify dot** on the level orb (unspent stat points) and on the Farm button (an animal or upgrade is affordable) marks things that need attention.

## 13. Rebirth and Legacy

- Available when the castle is level 6 or more and you own at least 20 tiles (and no castle upgrade is running). The **Legacy** button in the header (visible from castle 6, or after the first rebirth) opens the dialog.
- **Legacy points** gained = `floor(4.5 × (castle level − 5) × sqrt(tiles / 10))`, for example castle 6 / 40 tiles = 9, castle 10 / 50 tiles = 50 ([03 §9](03-formulas-and-scaling.md#9-rebirth-and-legacy)). The dialog shows the preview before you confirm.
- **Resets**: map, resources, castle, animals, buildings, level / XP / stat points, click upgrades, chests, the castle timer. **Keeps**: name, class, play time, all Legacy progress, settings.
- **Permanent bonus**: +5 % of total income for every Legacy point *earned* (spending points never lowers income).
- **Shop** (spend points, ten levels each, price grows ×1.4 per level): *Thrift* −2 % tile and building cost per level; *Master Builders* −5 % castle build time; *Click Mastery* +10 % click power; *Provisions* start each run with a bundle of gold, wood and stone. The Thrift discount and Charisma share one cap of 45 %.
- Expected pace (sim, [06](06-playtest-and-pacing-report.md)): the second run reaches castle 6 in about 70 % of the first run's time, later runs get shorter but flatten.

## 14. Settings and ambient life

- **Settings** (header): sound on/off, volume, ambient life on/off, buttons for Save tools (same as Control ×5) and the tutorial. Stored in the browser (`idlarz-settings`), separate from the game save.
- **Ambient life**: every 4–9 s a butterfly, bee, ladybug or rabbit (chosen by biome; Coast gets butterflies and bees) wanders over an owned tile in view for 6–10 s. About 1 in 12 is golden and glows; clicking it gives about 5 s of income (store-decided, 20 s cooldown, shares the click limiter, real clicks only). Off in Settings, with a hidden tab, or with reduced-motion.
