# 02 · Mechanics

Exact rules as implemented. Constants live in [`src/config/gameConfig.ts`](../src/config/gameConfig.ts); formulas and tables are in [03](03-formulas-and-scaling.md). The in-game tutorial (`Tutorial.tsx`) is generated from the same constants, so it always matches this document.

## 1. The loop in one paragraph

You start with a castle and its eight neighbouring tiles on an unbounded map, and 125 gold. Gold, other resources and XP trickle in every second. Gold (plus wood/stone/coal later) buys **adjacent unexplored tiles**, each of which becomes a biome and adds income. The **castle** is a big timed upgrade that multiplies everything. **Farm animals** turn food into meat, the **merchant** converts anything into gold (and back, at a loss), **clicking the map** and **chests** add active bonuses, every **level** gives a stat point, and **monsters** on your land can be fought for XP, gold and gear (§15). First finish line = castle 6, best click power and ~40+ tiles (about 4 weeks for an active player, [06](06-playtest-and-pacing-report.md)). After that the game continues with castle levels 7–10 and **Rebirth** (§13), which restarts the map for permanent Legacy bonuses.

## 2. Map & buying tiles

- The map has no edge: castle at (25, 25) and its 8 neighbours owned from the start (see *Starting land* below), tiles can be bought in any direction, also to negative coordinates (limits: ±16,000 tiles from the origin and 250,000 explored tiles). Drag to pan, mouse wheel to zoom (four fixed steps), **right-click an explored tile to build on it** (see Buildings). Panning is limited to the explored land: the middle of the screen can go 6 tiles past its edge, so a long line of tiles bought to the left can be followed to its end (zoom out to find it), but there is no scrolling into endless emptiness. The **minimap** (bottom right, "Show minimap" in the global menu) shows every explored tile as a coloured square with a gold dot on the castle and purple dots on workshops, outlines the part on screen and moves the view when clicked or dragged.
- A tile can be bought only if it is **4-neighbour adjacent** to an owned tile and you can pay its whole cost: gold, plus **extra resources from larger territories** (`TILE_RESOURCE_COST`: wood + stone from the 15th tile, coal from 30, food from 40; tiles are counted as the **economy count**, see below). Charisma discounts every part of the cost (0.5 %/point, max 25 %). The hover card shows all costs, green when affordable.
- Cost curve: ×1.45 per owned tile up to 20 tiles, ×1.27 up to 40, ×1.17 per tile up to 100, then a slow polynomial tail (`(n/100)^2.5`, so a 1,000-tile map costs about 4e13 gold for the next tile and a 10,000-tile map about 1.4e16), capped far below the resource cap, so the map never stops being buyable by price ([03 §1](03-formulas-and-scaling.md#1-tile-cost), roadmap BL16).
- Not enough → shake + `wrong` sound. Success → `purchase` sound, XP, +100 reputation.
- **Biome assignment**: a purchase turns into a biome by the **placement rules** below, rolled when you buy (there is no biome picker any more: the old "every 4th tile you choose" step is gone). The cost is charged at once.
- Name prompt + tutorial at exactly 2 owned tiles while the name is still `Explorer`.

### Starting land and the economy count

A new game (and every rebirth) starts with the castle **and its 8 neighbours owned**. The ring is generated from the basic biomes (`BIOME_RULES.startRing`): plains 5 / forest 3 / hills 2 / lake 2 by weight, each ring tile continues the previous one 50 % of the time, so the ring forms a few patches; at least 3 plains and never more than 3 of any other biome. These 8 tiles are free (`GameState.freeTiles` = 9; an old save keeps 1).

Tile cost, the extra resource costs, XP per tile and the rebirth requirements all use the **economy count** `economyTiles = owned − freeTiles + 1` (purchases + the castle), so the first purchase still costs 55 gold and the curve is unchanged. Statistics, monster spawning and the map use the real owned count. A save is checked for this (`freeTiles` is 1, or 9 with the whole ring owned).

### Biome placement rules (`src/config/biomeRules.ts`, logic in `src/utils/biomeRules.ts`)

All numbers live in one config file; the rules apply to new purchases only (existing maps are not touched). "Purchased" = tiles bought so far.

1. **Unlocks.** Plains, Forest, Hills and Lake are available from the start. **Swamp** after 6 purchases, **Tundra** after 10. **Coast** only ever beside water (rule 3).
2. **Conflicts** (checked against all 8 neighbours that are owned): **Tundra ↔ Swamp**, **Tundra ↔ Coast** and **Hills ↔ Coast** may never touch. **Plains is neutral** and always fits, so a purchase always has at least one biome to become.
3. **Coast needs a Lake or Coast** among the 8 neighbours.
4. **Clustering (random purchases).** The candidates are the unlocked biomes the rules allow. First, with a chance of `base + 10 × (extra same-biome 4-neighbours)` (capped at 90 %), the tile **copies** one of its 4-neighbour biomes that is a candidate (Grounds, the old building lot, is never rolled any more). Base chances: Forest 60, Hills 55, Lake 50, Swamp 55, Tundra 65, Plains 45, Coast 40. Otherwise it rolls by the old weights (`BIOME_SPAWN`: every biome 1, Coast 0.6, water likelier beside water).

| Biome | Unlocks | May not touch | Needs |
| --- | --- | --- | --- |
| Plains | start | - | - |
| Forest, Lake | start | - | - |
| Hills | start | Coast | - |
| Swamp | 6 purchases | Tundra | - |
| Tundra | 10 purchases | Swamp, Coast | - |
| Coast | start | Tundra, Hills | Lake or Coast nearby |

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

**Buildings** (right-click build menu): **right-click any explored tile** (not the castle, not a lake, and not while a chest or a monster is on it; hovering shows "Right-click to build here") to open a menu with all 16 buildings, their output, the price of the next one and each building drawn on a patch of the tile's own biome. Click one to build it: **one permanent building per tile**; the tile keeps its biome and its output and the building adds its own on top (same x1.3 yield scale and adjacency bonus). The old Grounds biome no longer turns up on new maps; existing Grounds lots keep working and can be built on like any tile. Buildings **cost resources** (base 500 gold, 250 wood, 150 stone) and **every building costs more than the last**: the first four are cheap (x0.4, x0.6, x0.8, x1.0 of the base), then x1.35 per building for the next 12, x1.25 for the next 16 and x1.15 after that (the same three-stage shape as tile prices; building 5 = 675 gold, 10 = 3.0K, 16 = 18.3K, 20 = 44.7K, 32 = 651K, 40 = 2.0M; wood and stone scale the same way, Legacy Thrift lowers it). Output (config values, x1.3 yield scale plus adjacency): Farm food 0.2 · Mine stone/coal 0.2 · Lumber Mill wood 0.2 · Market gold 0.2 · Blacksmith 0.07 of all five · Workshop xp 0.2 · Lumber Camp wood 0.18 · Quarry stone 0.25 · Fishing Hut food 0.16 + gold 0.05 · Hunter's Lodge meat 0.15 · Tavern food 0.12 + xp 0.08 · Tower stone 0.08 + xp 0.12 · Well food 0.15 · Alchemy Lab xp 0.12 + gold 0.08 · Stone Craft stone 0.15 + gold 0.08 · Barracks gold 0.1 + xp 0.1. Every output is an existing resource; the ten newer buildings are first-pass numbers (see BL13 in [05](05-balance-backlog-and-roadmap.md)). The Hunter's Lodge is the only source of meat besides the Farm's animals.

**Foundation**: a building on any biome keeps that biome's ground and gets a small worked-ground **pad** in the style of that biome under it (plains: packed earth and cobbles, forest: leaf litter, hills: gravel, swamp: plank courses over mud, tundra: trampled snow, coast: sand with a plank landing), so a farm in a forest stands in a clearing and one on tundra stands in snow; building tiles carry no trees or rocks. An old built-on Grounds lot is still drawn on the biome around it - the most common land biome among its 8 neighbours (a lake counts as coast; ties go hills > forest > tundra > swamp > plains > coast; nothing around = plains) - with the same kind of pad. Ambient critters on a building tile are those of its biome (old lots: of their foundation biome). The sprite is 48×60 and its roof rises over the tile above.

## 4. Resources

Gold, wood, stone, coal (drawn as charcoal "fuel"), food, meat, the farm products **eggs, milk and hide**, and xp. All except gold/xp can be sold to the merchant; wood, stone, coal, food and meat can also be bought (at 2× the sell price); the farm products are only earned. The header shows every currency except xp (it is the level bar) as a small icon + amount pill (gold, wood, stone, coal, food, meat, eggs, milk, hide, Gems); hovering a pill explains what it is, what it is used for, where it comes from and its rates. No stockpile can exceed 10¹⁵. The icons come from a supplied pixel-art sheet (cut out by `scripts/pixel/extract_sheet.py`, 40×40, twinkle strips for the shiny ones). **Gems** (the green gem) are the rebirth currency, see §13; they are not a `Resources` key. **Reserved art** (not resources yet, nothing produces or spends them): iron, fish, mana, blue crystal, sapphire, ability shard and the random-item box exist as icons (`RESERVED_RESOURCES` in `pixelIcons.ts`) for a later end-game / rebirth system ([05](05-balance-backlog-and-roadmap.md) BL14).

## 5. Castle

- Max level 10. **Each upgrade is a timed build**: resources are paid up front, then the castle works for 1 h, 4 h, 12 h, 36 h and 72 h (levels 2–6, 5 d 5 h in total), then 3 d, 4 d, 5 d and 7 d for levels 7–10 (24 d 5 h in total). Master Builders (Legacy) shortens these times. It keeps its current bonus meanwhile and only one upgrade runs at a time. The timer is advanced by the game tick (never by the system clock), is saved, and is shown in the castle dialog and its tooltip.
- Effect of level L: the modifier of every resource doubles each level up to 6 (+20 % … +640 %), then grows by a flat +320 % per level (+960 % at 7 … +1920 % at 10), plus **+0.5 XP/s per level above 1** (flat). The castle sprite glows brighter from level 6 on, and level 10 gets sparks and the gold border.
- **Fortress (levels 7-10)**: from level 7 the castle grows over its whole 3x3 bonus area. The violet area marker is replaced by stone **walls** along the four edges, a **gatehouse** in the middle of the south wall and a **tower on every corner**; the keep itself is a detailed animated castle on its own (cobbled) tile that spills a few pixels over its neighbours. All eight surrounding biomes stay visible. The towers get richer every level (7 red cone roof, 8 slate roof with crown and banner, 9 gold roof with glowing slits, 10 crystal spire and two banners) and the walls turn gold-trimmed from level 9. The area is a **ward**: no monsters or chests spawn inside it, and monsters already standing there when level 7 is reached are driven out (a monster you are fighting stays until the fight ends).
- Costs: see [03 §4](03-formulas-and-scaling.md#4-castle) (gold, wood, stone, coal from level 2→3, food + meat from 3→4; levels 7–10 cost about 1.6× the previous step).

## 6. Farm

- Each purchase adds **one more animal** of that kind (production = base × count). First cost in food: chicken 10 K, deer 50 K, pig 200 K, cow 1 M; each next one of the same kind costs ×1.5 / 1.6 / 1.7 / 1.8 more. The pen holds **12 animals per kind** (more with Pen Expansion); a save that already has more keeps them.
- Every animal also yields a **farm product**: chickens eggs (0.02/s), cows milk (0.15/s), deer and pigs hide (0.025 / 0.05 per s). Sold, a product is worth about a third of the animal's meat.
- Meat and product income = `Σ production × upgrades × (1 + castle modifier + 0.05 × Plains tiles for meat)`.
- **Upgrades** (bought in the Farm window with resources, 10 levels, the pen 8): Feed Trough +5 % meat, Hen House +10 % eggs, Dairy +10 % milk, Tannery +10 % hide, Pen Expansion +4 animals per kind and +2 % all farm output per level. Each costs ×1.7–2 more per level; the product upgrades are paid partly in the product itself.
- **The window** is one scene: the pen fills it, hovering an animal shows its **buy card** (owned/limit, output, Buy ×1 / ×10 / Max), a corner readout shows the output and stock, and the upgrade shelf sits along the bottom.
- While the Farm window is open a critter wanders by every 60–120 s (one at a time, 10 s lifetime; the first after 45 s): click it for a gift (golden ones ×2). The store decides the amount (about 10 s of income, never less than the critter's minimum) and enforces an 8 s cooldown for the window; the click limiter applies.

## 7. Merchant

- Sell: wood 0.5, stone 0.5, coal 1, food 0.75, meat 1, eggs 3, milk 4, hide 6 gold per unit (`floor(amount × price × Haggler)`).
- Buy resource packs (wood, stone, coal, food, meat): 2× the sell price, rounded **up**. Buying then selling (or the reverse) can never gain gold, even with a maxed Haggler — covered by tests.
- **Sell items**: the Sell tab also lists your bag. Click an item to sell one, Shift-click for the stack, or "Sell common" / "Sell up to uncommon" to clear plain gear (potions and worn gear are never touched). Prices are flat per item (common 8, uncommon 90, rare 250, epic 700, legendary 2000, potion 20), refused during a fight.
- **Buy Goods** tab: **Click power** (gold per click as a % of your gold/s): 50 % → 90 % (750 K) → 130 % (2.5 M) → 180 % (10 M); four **bonuses** with level ladders (price ×1.9–3 per level): *Haggler* +3 % gold from everything you sell (10 levels), *Bulk Discount* −1 % tile and building cost (8, shares the 45 % cap with Charisma and Thrift), *Lucky Charm* +2 Luck (10), *Pack Rat* +4 bag slots (4); and a **gear shop**: Minor Healing Potion 80, Leather Cap / Gloves 400, Boots 450, Vest 800, Iron Sword (damage 3) 6000 gold. Every shop price is at least 3× the item's sell value. The bonuses start again on a rebirth, except Pack Rat (the bag stays).
- Two tabs (Quests / Gambling, and Upgrade Items) are still placeholders ([04](04-unfinished-and-known-issues.md)). The window always opens on the Sell tab.

## 8. Clicking

- A **real click on the map** pays `gold/s × click power`. A click on an owned tile also taps it: `0.5 s` of that tile's output (each tile has a 1.2 s cooldown; critical "lucky" taps use your crit stats).
- Clicks on menus, the header, buttons and dialogs never pay. Script-dispatched (untrusted) clicks never pay.
- **Rate limit** (token buckets, shared by gold click and tile tap): up to 8 clicks in a burst, 5 clicks/s sustained, plus a long-run allowance (20 000 clicks bank, refilling 1.5 clicks/s ≈ 130 K paid clicks/day). A fast human is never limited; an auto-clicker is capped at roughly a dedicated human ([07](07-security-and-exploits.md)).

## 9. Chests

A chest appears every 10 min (the timer only runs while fewer than 5 chests wait). **Where** (`pickChestSpot`): any owned tile except the castle, a building, a monster, another chest and (from castle level 7) the castle's ward; each tile weighs 1, **+3 if it touches land you have not bought**, +1 per 4 tiles of distance from the castle, ×0.3 if another chest is within 2 tiles - so chests lean toward the edge of your land and spread out. It is drawn as a banded wooden chest on a small grass patch (from the supplied sheet) with a soft glow, a bob and an animated lock and lid glint. Chests are saved with the map.

**What is inside** (`rollChestLoot`, chances in `CHEST.rewards`): **gold** 50 % (`passive gold/s × random 10–60 min × (1 + 0.5 % × Luck)`, as before) · **resource bundle** 25 % (1–2 of wood, stone, coal, food, each 10–30 min of its income, at least 25) · **XP** 12 % (10–30 min of XP income, at least 60) · **lucky chest** 10 % (gold ×1.5) · **gear** 8 % (an item from the catalog's `chest` pool into the bag: potions, wood, cloth, steel and obsidian gear by rarity weight, a rare legendary weapon - never Rattatui pieces; a full bag turns it into gold). Each Luck point (character, merchant and gear) shifts 1 % of the gold chance into lucky chests (80 %) and gear (20 %). A toast shows what was found; the last result is not saved.

## 10. XP, levels and stat points

The **Stats tab** is one framed page: the hero with an unspent-points badge laid over the portrait (so spending points never moves the layout), the five attributes with their + buttons and an overview (level, XP, gold, tiles, rebirths) beside him, then folding sections - Combat, Bonuses, Resource income (per second / minute / hour) and *Where the income comes from* (a row per resource with its pieces and bonuses). Each section's open/closed state is remembered in the browser (`idlarz.section.<id>`).

XP comes from passive income (`total.xp × (1 + xpGainMultiplier)`) and from every tile purchase. Level N → N+1 needs `floor(750 × 1.3^(N−1))` XP; each level gives one stat point (also when the level-up comes from a tile purchase).

## 11. Character stats

| Stat | Per point |
| --- | --- |
| Strength | stone & coal +2.5 % |
| Dexterity | wood & food +2.5 % |
| Intelligence | gold +2.5 %, XP production +0.2 %, XP gained +0.2 % |
| Vitality | wood & food +2.5 % |
| Charisma | gold & coal +2.5 %, XP production +0.25 %, XP gained +0.25 %, tile cost −0.5 % (max −25 %), Luck +1 (chests) |

All text in tooltips and the tutorial comes from `CHARACTER_STAT_CONFIG`. Stat points do not feed combat yet (see §15 and the roadmap). HP is live (current / max); the other derived stats (MP, attack, defence, crit, reputation …) are display-only for now.

## 12. UI surfaces

Header (one slim row: player card → Stats tab, an icon + amount pill per currency with a full tooltip (use, source, rates, modifier, merchant price), Menu / Legacy / Settings buttons; the Menu window has Character, Stats, Merchant and Farm tabs), map with tile hover cards, castle dialog (with timer), right-click build menu (with the next building's cost), Character window (paper doll + bag), fight modal, level-up and chest toasts, loading screen (until the save is loaded), name prompt + tutorial, class picker, dev-only debug panel, and **Save & Backup** (Settings, or press Control five times): autosave status, export / import as one line of text or a file, reset ([07](07-security-and-exploits.md)). Also Settings, Legacy (rebirth + shop) and the re-openable tutorial. A small orange **notify dot** on the level orb (unspent stat points) and on the Menu button and its Farm tab (an animal or upgrade is affordable) marks things that need attention.

## 13. Rebirth and Legacy

- Available when the castle is level 6 or more and you own at least 20 tiles (and no castle upgrade is running). The **Legacy** button in the header (visible from castle 6, or after the first rebirth) opens the dialog.
- **Gems** (the Legacy points, shown with the green gem icon) gained = `floor(4.5 × (castle level − 5) × sqrt(tiles / 10))`, for example castle 6 / 40 tiles = 9, castle 10 / 50 tiles = 50 ([03 §9](03-formulas-and-scaling.md#9-rebirth-and-legacy)). The dialog shows the preview before you confirm.
- **Resets**: map, resources, castle, animals, buildings, level / XP / stat points, click upgrades, chests, monsters and any open fight, the castle timer; HP is refilled. **Keeps**: name, class, play time, all Legacy progress, settings, and your **gear, bag and potions**.
- **Permanent bonus**: +5 % of total income for every Gem *earned* (spending points never lowers income).
- **Shop** (spend Gems, ten levels each, price grows ×1.4 per level): *Thrift* −2 % tile and building cost per level; *Master Builders* −5 % castle build time; *Click Mastery* +10 % click power; *Provisions* start each run with a bundle of gold, wood and stone. The Thrift discount and Charisma share one cap of 45 %.
- Expected pace (sim, [06](06-playtest-and-pacing-report.md)): the second run reaches castle 6 in about 70 % of the first run's time, later runs get shorter but flatten.

## 14. Settings and ambient life

- **Settings** (header): sound on/off, volume, ambient life on/off, buttons for Save & backup (same as Control ×5) and the tutorial. Stored in the browser (`idlarz-settings`), separate from the game save.
- **Right-click menus** (`ContextMenu`, one component for all of them): the browser's own menu never shows (except inside text fields). A right-click on an explored tile offers, above the global entries, *Highlight this <biome> area* (tints the connected area of that biome around the clicked tile, every tile of it that touches it side by side, with a translucent colour of its own for 3 s; no border; castle excluded), *Build here...* (opens the build window; greyed with "tile in use" while a chest or monster is on it, absent on built tiles and the castle), *Fight* / *Dismiss <monster>...* on a monster and *Open chest* on a chest; a bag item offers *Equip / Drink*, *Sell one* and *Discard...*. Everything else (empty map, unexplored tiles, the page) gets the global menu alone: **Settings, Guide, Save game, Export game save, Import / backup..., Show minimap, Show statistics** and, in development builds, **Show admin mode**. The same global menu opens as a dropdown from the gear button in the header.
- **Dismiss monster**: removes the monster from the map for good, with a confirmation, no loot and no XP (for a rat that is too strong while the map is at its monster cap). Refused for the monster being fought (`dismissMonster`).
- **Discard item**: destroys one item or the whole stack after a confirmation, pays no gold (`discardItem`, refused during a fight).
- **Save game / Export**: *Save game* writes the save at once (`saveNow`) and shows a toast; autosave (2 s after a change, and on close/hide of the tab) is unchanged. *Export game save* copies the same `IDLZ2.` text as Import / backup to the clipboard.
- **Statistics panel** ("Show statistics", remembered in the browser): FPS and the slowest frame of the last half second, tiles owned, monsters, time played (bottom right). **Admin panel** (development builds only): the cheat buttons in the game's own frame, folded into an icon with *Hide*; both choices are remembered (`idlarz.ui.*` in localStorage).
- **Map decor and water**: plains carry tiny flowers and grass tufts, swamps fallen dead trees (a second hash pass, purely visual), open lake water also glitters (a soft drifting-highlight strip over every open-water lake tile, `water_shimmer`), and open lake water plus deep swamp pools show small animated ripples (open water gets one to three per tile) (Settings > Life on the map turns the ripples and the critters off; reduced motion hides the ripples).
- **Ambient life**: every 14–30 s (the first after 6 s, at most 3 at once) a critter wanders over an owned tile in view for 6–10 s, chosen by biome: butterflies and bees on plains, forest, lake and coast, ladybugs on swamp and grounds, rabbits on hills, tundra and grounds (old lots), plus decoration-only **fish** (lakes, only on tiles with water on all four sides), **frogs** (swamp), **crabs** (coast), **goats** (hills) and **small wolves** (forest). A tile with a building uses its foundation biome. About 1 in 12 of the four farm critters (butterfly, bee, ladybug, rabbit) is golden and glows; clicking it gives about 5 s of income (store-decided, 20 s cooldown, shares the click limiter, real clicks only). Fish, frogs, crabs, goats and wolves never carry a gift. Off in Settings, with a hidden tab, or with reduced-motion.

## 15. Monsters and combat

- **Spawning**: once you own 5 tiles, the first rat appears after 2 minutes, then one every 15 minutes (chests: 10), on a random owned non-castle tile without a chest or another monster and, from castle level 7, outside the castle's ward. At most 8 monsters; the timer pauses while the map is full.
- **Growing**: a rat gains a tier every 30 minutes on the map (max tier 5): more HP, harder hits, better rewards. A tier-5 rat can evolve into the **Rat King** (35 % every 10 minutes of extra age, only one king at a time). The monster you are fighting does not age.
- **Fighting**: click a monster to open the fight. Every click hits for your gear's total damage (Wooden Sword 2, so a tier-1 rat needs 50 hits). **Fight clicks are not rate limited**: how fast you click is the skill; only real (trusted) clicks count. A click can **crit** (x2) with your Crit chance (the character's own, from Dexterity and Charisma, plus gear) and a crit can become a **super crit** (x5) with 5 % plus your gear's Super Crit. The monster attacks on a timer, reduced by your armor. There is no time limit on rats.
- **HP**: about 100 at the start (`85 + vitality HP + gear`). It regenerates about 1 HP/s while no fight is active; the gear stat **HP Regen** adds to that and also works during fights. **Minor Healing Potions** (35 HP) and **Greater Healing Potions** (90 HP) share an 8 s cooldown in a fight (hotkeys 1-3 for the first three potion stacks) and work in and out of fights.
- **Losing**: at 0 HP you are knocked out (30 % HP back), the monster is at full HP again and nothing is lost. Fleeing (Flee button or Esc) resets the monster the same way. A fight never survives a reload; your HP does.
- **Winning**: the monster is removed; gold and XP are a number of seconds of your income (so they keep up with the economy), plus a chance of a piece of **gear** from the `rat` pool (12 %, +2 % per tier; mostly wood and cloth, steel from tier 3, obsidian from tier 5) and of a potion (25 %, +3 % per tier; the Greater potion from tier 4). Rats never drop Rattatui pieces. A full bag turns the drops into gold.
- **Rat King** (the MVP monster; more monsters will follow, so nothing is balanced around him alone): 5200 HP, hits for 14 every 3 s, 75-second limit. On a timeout or a knockout he taunts you, resets and stays on the map. He needs gear and quick clicking: a starter kit never wins, full steel needs about 12 clicks/s, full obsidian about 7, the Rattatui set is comfortable at 7 and the best loadouts (Rattatui + a legendary) finish in about 35 s ([generated/fight-sim.md](generated/fight-sim.md), guarded by `tests/fightBalance.test.ts`). Winning always drops a **Rattatui piece** (preferring ones you do not own yet), 40 % for a second, 5 % a **legendary weapon**, and 2 Minor + 1 Greater potion; he is the only source of the set.
- **Feedback**: blood burst and a damage number per hit (crits are bigger and orange with a `!`, super crits bigger and pink with a larger burst), the fight window shakes with a red flash when you are hurt (reduced-motion: flash only).

## 16. Items and the Character window

- **Slots**: head, shoulder, chest, hands, legs, feet (left), neck, cape, ring, ring, charm (right), weapon and shield (bottom), plus two locked ability slots reserved for skills. A 36-slot bag holds everything else.
- **Stats** (`catalog/stats.ts`): items give Damage (weapons only), Armor, Max HP, Crit Chance (%), Super Crit (%), HP Regen (/s) and Luck. Damage, Armor, Max HP, Crit and Regen are shown under the hero; the Armor tooltip shows the damage reduction.
- **Starter kit**: Wooden Sword (damage 2), Wooden Shield (armor 2) and 2 potions. Old saves get it on load.
- **Rarities** (`catalog/rarity.ts`): common (gray), uncommon (green), rare (blue), epic (violet), legendary (orange). Higher rarities glow stronger in the slots; epic and legendary pulse softly (reduced-motion: no pulse).
- **Gear families** (`catalog/items/*.ts`, all 12 slot types each: head, shoulder, chest, hands, legs, feet, neck, cape, ring, charm, off hand; weapons are separate). Each has a set bonus (3 / 6 / 12 pieces worn; both rings count):
  - **Wood and leather** (common, the starter kit and the commonest drop): leather cap, pauldrons, vest, gloves, leggings, boots, wooden pendant, leather cloak, wooden ring, acorn charm, wooden shield.
  - **Apprentice cloth** (common): little armor, lots of HP, a bit of regen, luck and crit; hat, mantle, robe, gloves, trousers, slippers, amulet, cape, ring, charm, tome.
  - **Knight's steel** (uncommon): honest armor; helm, pauldrons, cuirass, gauntlets, greaves, sabatons, gorget, cloak, ring, charm, steel shield. Helm, cuirass, gauntlets, greaves, sabatons, shield and the Iron Sword are sold by the merchant.
  - **Obsidian** (rare, never sold; old rats and good chests): the fancy tier with crit stats and spikes.
  - **Rattatui** (epic, **only from the Rat King**): the best armor and HP in the game plus crit, regen and luck; 3 pieces +3 Armor, 6 pieces +1 Damage, +4 % Crit, +15 Max HP, all 13 slots +1 Damage, +6 % Super Crit, +1 HP/s, +25 Max HP.
- **Weapons** (main hand, by type; crit and super crit values are the point of the bows and daggers): sword, mace, maul, axe, spear, dagger, bow, crossbow, staff, wand in wood/cloth, steel and obsidian grades, the Rattatui Fang Blade, and three legendary weapons (Emberbrand, Starfall Bow, Titan Maul). Full numbers: [generated/item-catalog.md](generated/item-catalog.md).
- **Potions**: Minor (35 HP, common, 80 gold) and Greater (90 HP, uncommon, 360 gold).
- **Controls**: hover for a tooltip; double-click a bag item to equip it (or drink a potion), right-click it for Equip / Drink, Sell one and Discard; click an equipped item to take it off; drag to rearrange the bag, to equip, or to unequip. Gear cannot be changed during a fight; taking off gear needs a free bag slot.
