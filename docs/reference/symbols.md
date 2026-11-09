# Symbol index

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Every documented function, constant and topic, with the file to open. Search this page first when you look for where a rule lives.

| Name | Category | Source | What |
| --- | --- | --- | --- |
| `acceptSave` | Saves & Server / Accepting a save | [`src/lib/cloudSave/pipeline.ts:200`](../../src/lib/cloudSave/pipeline.ts) | Accepts a save from a client that says it was based on revision `baseRev` (0 = this account has no save yet). |
| `addBuff` | Combat / Consumables | [`src/lib/buffs.ts:63`](../../src/lib/buffs.ts) | Adds one buff effect to the running buffs. |
| Adding loot content (data only) | Loot / Adding content | [`src/catalog/lootConfig.ts:161`](../../src/catalog/lootConfig.ts) | Adding loot content is data only; |
| `advanceBank` | Monsters / Spawning | [`src/lib/offline/tickets.ts:143`](../../src/lib/offline/tickets.ts) | Runs the timers for `dtSec` seconds and mints the tickets that come due, in the order they come (a chest every ~10 minutes (shorter with Luck), a n... |
| `animalOutput` | Economy / Farm | [`src/utils/game/farm.ts:59`](../../src/utils/game/farm.ts) | Output of `count` animals of one kind (every purchase adds one more animal). |
| `ANIMALS` | Economy / Farm | [`src/config/farm.ts:17`](../../src/config/farm.ts) | The farm: |
| `applyUse` | Combat / Consumables | [`src/lib/offline/consumables.ts:27`](../../src/lib/offline/consumables.ts) | Drinks the potion in bag slot `index`, at the server clock `nowSec` (the combat in `input` has already been brought up to now). |
| `armorOf` | Combat / Player numbers | [`src/lib/combat.ts:159`](../../src/lib/combat.ts) | Armor against monster hits: |
| `armorReduction` | Combat / Player numbers | [`src/lib/combat.ts:190`](../../src/lib/combat.ts) | The share (0-0.75) of a hit that `armor` takes away: |
| `attacksPerSecond` | Combat / Player numbers | [`src/lib/combat.ts:103`](../../src/lib/combat.ts) | Attacks per second: |
| `autoBattleUnlocked` | Combat / A fight | [`src/lib/combat.ts:45`](../../src/lib/combat.ts) | Auto-battle (the server picking the next monster) is a reward for the first rebirth; |
| `autoUse` | Combat / Potions and skills | [`src/lib/offline/fightSteps.ts:67`](../../src/lib/offline/fightSteps.ts) | Auto-use's rules for one tick: |
| `bandOf` | Monsters / Spawning | [`src/lib/distance.ts:13`](../../src/lib/distance.ts) | The band a castle distance falls in. |
| `BASE_GENERATION_RATES` | Economy / Income | [`src/config/economy.ts:158`](../../src/config/economy.ts) | Income of the realm itself, per second, before any tile: |
| Basics: tick, caps, start | Economy / Basics | [`src/config/economy.ts:22`](../../src/config/economy.ts) | Game constants the economy runs on: |
| `bestWornGrade` | Economy / Merchant | [`src/lib/merchant.ts:61`](../../src/lib/merchant.ts) | The best ladder grade the player wears (G1 with nothing worn, or only pieces outside the ladder). |
| `BIOME_LOOT` | Loot / Config | [`src/catalog/lootConfig.ts:124`](../../src/catalog/lootConfig.ts) | The grades a biome's normal monsters may drop (docs/plan/26-next-updates-plan.md C1: |
| `BIOME_YIELD` | Economy / Income | [`src/config/economy.ts:141`](../../src/config/economy.ts) | Biome and building output is multiplied by `scale` (1.3). |
| `BIOMES` | Economy / Biomes | [`src/config/biomes.ts:30`](../../src/config/biomes.ts) | Every biome with its config output per second. |
| `BUFF_FAMILIES` | Combat / Consumables | [`src/catalog/buffs.ts:25`](../../src/catalog/buffs.ts) | The buff families. |
| `buffTotals` | Combat / Consumables | [`src/lib/buffs.ts:84`](../../src/lib/buffs.ts) | The summed bonus per stat of the running buffs: |
| `BUILDING_COST` | Economy / Buildings | [`src/config/buildings.ts:111`](../../src/config/buildings.ts) | The building price constants: |
| `buildingCostFactor` | Economy / Buildings | [`src/utils/game/costs.ts:63`](../../src/utils/game/costs.ts) | Price factor of the next building when `built` buildings stand: |
| `BUILDINGS` | Economy / Buildings | [`src/config/buildings.ts:40`](../../src/config/buildings.ts) | Buildings: |
| `buyCost` | Economy / Merchant | [`src/utils/game/merchant.ts:61`](../../src/utils/game/merchant.ts) | Gold for buying `units` of a resource from the merchant: |
| `calculateAnimalCost` | Economy / Farm | [`src/utils/game/farm.ts:14`](../../src/utils/game/farm.ts) | Food cost of the next animal of a kind when `level` of them are owned: |
| `calculateBuildingCost` | Economy / Buildings | [`src/utils/game/costs.ts:82`](../../src/utils/game/costs.ts) | Cost of the next building: |
| `calculateCombatStats` | Progression / Attributes | [`src/utils/game/character.ts:267`](../../src/utils/game/character.ts) | The combat numbers the attributes give (max HP and mana pools, crit chance, ...), from all points or the points above 5 as each rule says. |
| `calculateFarmOutput` | Economy / Farm | [`src/utils/game/farm.ts:79`](../../src/utils/game/farm.ts) | The whole farm's output per second: |
| `calculateLevel` | Progression / Levels | [`src/utils/game/character.ts:210`](../../src/utils/game/character.ts) | Level from total XP: |
| `calculateResourceBreakdown` | Economy / Income | [`src/utils/game/income.ts:133`](../../src/utils/game/income.ts) | Income per second of every resource, split into its sources and modifiers (the one place the income formula lives). |
| `calculateStatResourceModifiers` | Progression / Attributes | [`src/utils/game/character.ts:234`](../../src/utils/game/character.ts) | What the five attributes add to the income modifier of each resource (all points count, not only those above 5). |
| `calculateTileCost` | Economy / Tiles | [`src/utils/game/costs.ts:18`](../../src/utils/game/costs.ts) | Everything buying the next tile costs, given how many tiles are owned and the Charisma discount (percent). |
| `calculateTileOutput` | Economy / Income | [`src/utils/game/income.ts:80`](../../src/utils/game/income.ts) | The one place a single tile's output is priced; |
| `calculateXpGain` | Economy / Tiles | [`src/utils/game/character.ts:84`](../../src/utils/game/character.ts) | Calculate XP gain scaling based on owned tiles The more tiles owned, the more XP gained |
| `canSpawnOn` | Monsters / Spawning | [`src/lib/monsters.ts:150`](../../src/lib/monsters.ts) | Whether a monster of this type may stand on this tile: |
| `CASTLE_AREA_BONUS` | Economy / Castle | [`src/config/castle.ts:36`](../../src/config/castle.ts) | Area bonus: |
| `CASTLE_FORTRESS` | Economy / Castle | [`src/config/castle.ts:46`](../../src/config/castle.ts) | The ward: |
| `CASTLE_RANGE` | Economy / Castle | [`src/config/castle.ts:24`](../../src/config/castle.ts) | The castle range (violet area): |
| `CASTLE_UPGRADE` | Economy / Castle | [`src/config/castle.ts:62`](../../src/config/castle.ts) | The castle: |
| `castleAreaBonus` | Economy / Castle | [`src/lib/castleWard.ts:41`](../../src/lib/castleWard.ts) | The extra output (as a fraction: |
| `castleModifier` | Economy / Castle | [`src/utils/game/castle.ts:16`](../../src/utils/game/castle.ts) | Bonus (as a fraction) the castle adds to the modifier of every resource: |
| `castleRangeRadius` | Economy / Castle | [`src/lib/castleWard.ts:22`](../../src/lib/castleWard.ts) | How far (tiles, every side) the violet range area reaches: |
| `castleUpgradeDuration` | Economy / Castle | [`src/utils/game/castle.ts:34`](../../src/utils/game/castle.ts) | Seconds the castle needs to go from `fromLevel` to `fromLevel + 1`. |
| `CHARACTER_STAT_CONFIG` | Progression / Attributes | [`src/config/character.ts:92`](../../src/config/character.ts) | Attributes. |
| Checking live saves before a release | Ops / Operator guides | [`scripts/check-live-saves.ts:1`](../../scripts/check-live-saves.ts) | Before a reset or a release that tightens the save rules: |
| `CHEST` | Economy / Chests and Luck | [`src/config/spawns.ts:34`](../../src/config/spawns.ts) | Chests. |
| `chestIntervalSec` | Economy / Chests and Luck | [`src/lib/luck.ts:16`](../../src/lib/luck.ts) | Seconds between two chests: |
| `chestSpots` | Economy / Chests and Luck | [`src/lib/chests.ts:31`](../../src/lib/chests.ts) | The tiles a chest could go on, with their weights. |
| `CLICK_LADDER` | Economy / Clicks | [`src/config/economy.ts:170`](../../src/config/economy.ts) | Clicking: |
| `CLICK_LIMIT` | Economy / Clicks | [`src/config/economy.ts:203`](../../src/config/economy.ts) | The click rate limit: |
| `clickGold` | Economy / Clicks | [`src/config/economy.ts:186`](../../src/config/economy.ts) | Gold of one click at a ladder level: |
| Combat overview and tunables | Combat / Overview | [`src/config/combatConfig.ts:20`](../../src/config/combatConfig.ts) | Combat tunables. |
| Commands and documentation generation | Ops / Commands | [`scripts/docs-reference.ts:1`](../../scripts/docs-reference.ts) | Commands. |
| `computeOfflineGrant` | Saves & Server / Away time | [`src/lib/offline/grant.ts:70`](../../src/lib/offline/grant.ts) | The grant for an absence of `gapSec`, or null when it is shorter than the minimum (nothing to show). |
| Conventions | Overview / The game | [`src/app/GameApp.tsx:2`](../../src/app/GameApp.tsx) | Conventions that hold for the whole code base. |
| `CRAFT_GEAR` | Progression / Crafting | [`src/config/crafting.ts:46`](../../src/config/crafting.ts) | Gear crafting (IDL-241, docs/plan/17-crafting.md sections 2 and 7): |
| `CRAFTING` | Progression / Crafting | [`src/config/crafting.ts:14`](../../src/config/crafting.ts) | Crafting: |
| `createClickLimiter` | Economy / Clicks | [`src/lib/clickLimiter.ts:35`](../../src/lib/clickLimiter.ts) | Creates the click rate limiter: |
| `createSaveStorage` | Saves & Server / The save | [`src/lib/saveStorage.ts:75`](../../src/lib/saveStorage.ts) | Where the save lives: |
| `critOdds` | Combat / Player numbers | [`src/lib/combat.ts:122`](../../src/lib/combat.ts) | Chance (0-1) that a swing crits, and that a crit becomes a super crit: |
| `cumulativeXp` | Progression / Levels | [`src/utils/game/character.ts:198`](../../src/utils/game/character.ts) | The total XP at which `level` is reached (level 1 is 0). |
| `damagePerHit` | Combat / Player numbers | [`src/lib/combat.ts:92`](../../src/lib/combat.ts) | Damage of one swing (before crits): |
| `dangerBonus` | Monsters / Level scaling | [`src/lib/monsters.ts:74`](../../src/lib/monsters.ts) | Levels added to a monster that appears `distance` tiles (Chebyshev) from the castle: |
| `dismissTicket` | Combat / A fight | [`src/lib/offline/fight.ts:145`](../../src/lib/offline/fight.ts) | Takes a monster off the map without a fight (a monster that cannot be beaten, or that is in the way). |
| `DISTANCE_BANDS` | Monsters / Spawning | [`src/config/distanceBands.ts:25`](../../src/config/distanceBands.ts) | Distance bands: |
| `dodgeChance` | Combat / Player numbers | [`src/lib/combat.ts:222`](../../src/lib/combat.ts) | Chance (0-1) that a monster's hit misses: |
| `drink` | Combat / Consumables | [`src/lib/buffs.ts:125`](../../src/lib/buffs.ts) | Drinks one potion: |
| `dropChanceMultiplier` | Economy / Chests and Luck | [`src/lib/luck.ts:40`](../../src/lib/luck.ts) | Multiplier on a monster's gear drop chance. |
| `economyTiles` | Economy / Tiles | [`src/utils/game/tiles.ts:28`](../../src/utils/game/tiles.ts) | Owned-tile count as the economy sees it: |
| `effectiveTileDiscount` | Economy / Tiles | [`src/utils/game/rebirth.ts:63`](../../src/utils/game/rebirth.ts) | Percent off tile cost: |
| `eligibleCandidates` | Loot / Pipeline | [`src/lib/loot/pools.ts:37`](../../src/lib/loot/pools.ts) | Members that exist at this item level (item window and the pool's own minimum), with their weights. |
| `EMBER_MODEL` | Saves & Server / Accepting a save | [`src/lib/cloudSave/emberModel.ts:29`](../../src/lib/cloudSave/emberModel.ts) | The server's model of how many Embers (and rebirths) an account can hold. |
| `EMBER_UPGRADES` | Progression / Ember shop | [`src/config/rebirth.ts:58`](../../src/config/rebirth.ts) | The Ember shop: |
| `emberGain` | Progression / Rebirth | [`src/utils/game/rebirth.ts:91`](../../src/utils/game/rebirth.ts) | Embers a rebirth gives: |
| `emberIncomeBonus` | Progression / Rebirth | [`src/utils/game/rebirth.ts:48`](../../src/utils/game/rebirth.ts) | The income bonus (0.5 = +50 %) that `earned` Embers ever earned give: |
| `emberUpgradeCost` | Progression / Ember shop | [`src/utils/game/rebirth.ts:25`](../../src/utils/game/rebirth.ts) | Cost in Embers of buying the next level of an upgrade, given its current level. |
| `endFight` | Combat / A fight | [`src/lib/offline/fightSteps.ts:86`](../../src/lib/offline/fightSteps.ts) | Closes the open fight as `defeated`, `timeout` or `retreat`: |
| Endpoints (the API routes) | Saves & Server / Endpoints | [`src/lib/offline/service.ts:1`](../../src/lib/offline/service.ts) | The endpoints under `src/app/api`. |
| `ENFORCEMENT` | Saves & Server / Accepting a save | [`src/lib/cloudSave/verify.ts:113`](../../src/lib/cloudSave/verify.ts) | The kill switch and the allowlist for enforcement (IDL-112). |
| `engage` | Combat / A fight | [`src/lib/offline/fightTargets.ts:113`](../../src/lib/offline/fightTargets.ts) | The next fight: |
| `ensureSeasonReset` | Saves & Server / Away time | [`src/lib/offline/season.ts:33`](../../src/lib/offline/season.ts) | Resets the player's game when a season reset happened that their ledger does not know about. |
| `estimateWin` | Combat / Win chance | [`src/lib/offline/winChance.ts:60`](../../src/lib/offline/winChance.ts) | The player's chance against a monster of this type and level, starting with `hp` and with these potions to drink. |
| `FARM_UPGRADES` | Economy / Farm | [`src/config/farm.ts:81`](../../src/config/farm.ts) | Farm upgrades: |
| `farmUpgradeCost` | Economy / Farm | [`src/utils/game/farm.ts:34`](../../src/utils/game/farm.ts) | Cost of the next level of a farm upgrade, given its current level (one entry per resource). |
| `fightStep` | Combat / A fight | [`src/lib/offline/fightSteps.ts:106`](../../src/lib/offline/fightSteps.ts) | One tick of the open fight. |
| `FLAG_POLICY` | Saves & Server / Accepting a save | [`src/lib/cloudSave/verify.ts:87`](../../src/lib/cloudSave/verify.ts) | The flags and what the server does with each. |
| `GameState` | Architecture / State | [`src/types/game.ts:348`](../../src/types/game.ts) | State. |
| `gear` | Loot / Adding content | [`src/catalog/items/define.ts:101`](../../src/catalog/items/define.ts) | The builder every piece of gear is authored with. |
| `GEAR_RECIPES` | Economy / Crafting | [`src/catalog/recipes.ts:337`](../../src/catalog/recipes.ts) | The gear recipes (IDL-241): |
| `gearItemLevels` | Progression / Crafting | [`src/lib/craftGear.ts:37`](../../src/lib/craftGear.ts) | The item level a recipe of this grade makes, by crafting level: |
| `gearOdds` | Progression / Crafting | [`src/lib/craftGear.ts:140`](../../src/lib/craftGear.ts) | What the Crafting window's odds panel shows for a recipe: |
| `gemChance` | Economy / Chests and Luck | [`src/lib/luck.ts:50`](../../src/lib/luck.ts) | Chance (0-1) that a chest also holds gems. |
| `generateLoot` | Loot / Pipeline | [`src/lib/loot/generate.ts:317`](../../src/lib/loot/generate.ts) | Everything one source gives. |
| `generateMerchantStock` | Economy / Merchant | [`src/lib/merchant.ts:90`](../../src/lib/merchant.ts) | A new shelf of goods, rolled at the world (castle) level and the player's gear, and stamped with the play time it was made. |
| `generateStartRing` | Economy / Biomes | [`src/utils/biomeRules.ts:186`](../../src/utils/biomeRules.ts) | The castle's four starting neighbours for a new game: |
| `gradeLegacyItems` | Loot / Items | [`src/catalog/items/ladder.ts:316`](../../src/catalog/items/ladder.ts) | Puts the legacy families on the ladder (IDL-243), so the grade ceilings of the biome pools and the merchant hold for every piece: |
| `gradeLevels` | Loot / Items | [`src/catalog/items/grades.ts:79`](../../src/catalog/items/grades.ts) | The item level window an item of this grade is generated in. |
| `gradeRarities` | Loot / Items | [`src/catalog/items/grades.ts:94`](../../src/catalog/items/grades.ts) | The rarities an item of this grade may roll as: |
| `healAmount` | Combat / Potions and skills | [`src/lib/skills.ts:19`](../../src/lib/skills.ts) | HP a Heal restores: |
| `INITIAL_RESOURCES` | Economy / Basics | [`src/config/economy.ts:148`](../../src/config/economy.ts) | What a new game starts with: |
| `isAutoSold` | Loot / Pipeline | [`src/lib/loot/autoSell.ts:10`](../../src/lib/loot/autoSell.ts) | Whether the auto-sell filter takes a piece of gear: |
| `isNonProduction` | Saves & Server / Accepting a save | [`src/lib/cloudSave/environment.ts:12`](../../src/lib/cloudSave/environment.ts) | Is this server a production server? Decided from the server's own environment only; |
| `judgeRebase` | Saves & Server / Uploading | [`src/lib/cloudRecovery.ts:31`](../../src/lib/cloudRecovery.ts) | Whether a refused upload (409, "the account has a newer save") may be resolved without asking the player, and how. |
| `killIncome` | Monsters / Rewards | [`src/lib/loot/kill.ts:51`](../../src/lib/loot/kill.ts) | Rewards for a kill. |
| `kit` | Loot / Items | [`src/lib/fightSim.ts:57`](../../src/lib/fightSim.ts) | A full kit of one ladder grade: |
| `Ledger` | Saves & Server / The ledger | [`src/lib/offline/ledger.ts:78`](../../src/lib/offline/ledger.ts) | The ledger: |
| `levelAtAge` | Monsters / Level scaling | [`src/lib/monsters.ts:93`](../../src/lib/monsters.ts) | The level of a monster of this age: |
| `LEVELING` | Progression / Levels | [`src/config/character.ts:55`](../../src/config/character.ts) | Character level 1-100 (`maxLevel`). |
| `levelScale` | Loot / Items | [`src/catalog/stats.ts:195`](../../src/catalog/stats.ts) | Power multiplier of an item level (1 at level 1). |
| `lifeLeechPercent` | Combat / Player numbers | [`src/lib/combat.ts:173`](../../src/lib/combat.ts) | The Life Leech in %, the gear's and the merchant's together, never above the cap. |
| `limitOf` | Progression / Limits | [`src/lib/limits.ts:34`](../../src/lib/limits.ts) | The current value of a limit: |
| `LIMITS` | Progression / Limits | [`src/config/limits.ts:14`](../../src/config/limits.ts) | Limits that upgrades raise. |
| `LIVE_GRADES` | Loot / Items | [`src/catalog/items/grades.ts:51`](../../src/catalog/items/grades.ts) | The grade ladder's live grades (IDL-220, IDL-224, IDL-243, IDL-238): |
| `LOOT_PROFILES` | Loot / Config | [`src/catalog/lootConfig.ts:198`](../../src/catalog/lootConfig.ts) | Profiles: |
| `LOOT_SOURCES` | Loot / Config | [`src/catalog/lootConfig.ts:278`](../../src/catalog/lootConfig.ts) | Keyed by the `DropSource` (a monster type, `chest` or the merchant's `merchant` shelf). |
| `losesProgress` | Saves & Server / Accepting a save | [`src/lib/cloudSave/pipeline.ts:75`](../../src/lib/cloudSave/pipeline.ts) | True when a new save holds less than the one it replaces: |
| `LUCK` | Economy / Chests and Luck | [`src/config/spawns.ts:74`](../../src/config/spawns.ts) | Luck = Charisma + Lucky Charm + gear Luck. |
| `luckyRatChance` | Economy / Chests and Luck | [`src/lib/luck.ts:67`](../../src/lib/luck.ts) | Chance (0-1) that a newly arrived rat is a lucky one. |
| `MAGNITUDE_BANDS` | Pacing / Magnitude targets | [`scripts/sim.ts:792`](../../scripts/sim.ts) | The bands of the magnitude targets (IDL-128): |
| `MANUAL_CLOUD_COOLDOWN_MS` | Saves & Server / Uploading | [`src/lib/manualCloudSave.ts:15`](../../src/lib/manualCloudSave.ts) | "Save game" in the menu: |
| Map lab | Architecture / Art | [`src/app/map-lab/page.tsx:2`](../../src/app/map-lab/page.tsx) | Map lab (`/map-lab`): |
| `MAX_ACTIVE_BUFFS` | Combat / Consumables | [`src/lib/buffs.ts:18`](../../src/lib/buffs.ts) | How many different buffs can run at once. |
| `MAX_CATCHUP_SEC` | Economy / Basics | [`src/config/economy.ts:35`](../../src/config/economy.ts) | A tick never advances the game by more than this many seconds (device sleep, clock edits). |
| `maxHp` | Combat / Player numbers | [`src/lib/combat.ts:34`](../../src/lib/combat.ts) | The player's numbers (all pure functions in `src/lib/combat.ts`, used by the server engine and the UI): |
| `MERCHANT_BUY_MULTIPLIER` | Economy / Merchant | [`src/config/merchant.ts:221`](../../src/config/merchant.ts) | The merchant sells wood, stone, coal, food and meat at this multiple of the price it pays (so buying and selling can never print gold). |
| `MERCHANT_GOODS` | Economy / Merchant | [`src/config/merchant.ts:193`](../../src/config/merchant.ts) | The goods shelf and its refresh rules (generateMerchantStock). |
| `MERCHANT_RESOURCE_PRICES` | Economy / Merchant | [`src/config/merchant.ts:18`](../../src/config/merchant.ts) | The merchant buys resources at these gold prices per unit. |
| `MERCHANT_UPGRADES` | Economy / Merchant | [`src/config/merchant.ts:43`](../../src/config/merchant.ts) | Merchant upgrades are bought with gold; |
| `merchantUpgradeCost` | Economy / Merchant | [`src/utils/game/merchant.ts:23`](../../src/utils/game/merchant.ts) | Gold price of the next level of a merchant upgrade. |
| `MIN_SAVE_INTERVAL_MS` | Saves & Server / Accepting a save | [`src/lib/cloudSave/pipeline.ts:83`](../../src/lib/cloudSave/pipeline.ts) | Saves from one player are accepted at most this often (an honest client sends every ~90 s). |
| `mitigate` | Combat / Player numbers | [`src/lib/combat.ts:203`](../../src/lib/combat.ts) | Damage of one monster hit after armor: |
| `MONSTERS` | Monsters / Roster | [`src/config/combatConfig.ts:350`](../../src/config/combatConfig.ts) | The roster: |
| `monsterStats` | Monsters / Level scaling | [`src/lib/monsters.ts:117`](../../src/lib/monsters.ts) | HP, attack, armor, crit and stun resistance of a monster at a level (the reward is `monsterReward`). |
| Pacing targets | Pacing / Targets | [`scripts/sim.ts:16`](../../scripts/sim.ts) | What pace the economy is tuned for, why, and how to check it. |
| `payKill` | Combat / A fight | [`src/lib/offline/reward.ts:35`](../../src/lib/offline/reward.ts) | Pays the kill of ticket `n`: |
| `PERSISTED_KEYS` | Saves & Server / The save | [`src/lib/sanitizeSave.ts:60`](../../src/lib/sanitizeSave.ts) | The part of the game state that is saved. |
| `pickTarget` | Combat / A fight | [`src/lib/offline/fightTargets.ts:41`](../../src/lib/offline/fightTargets.ts) | The next monster to engage: |
| `pityMultiplier` | Progression / Crafting | [`src/lib/craftGear.ts:78`](../../src/lib/craftGear.ts) | The pity multiplier on the grade's best rarity after `misses` crafts that missed it. |
| Pixel art pipeline | Architecture / Art | [`src/config/pixelIcons.ts:1`](../../src/config/pixelIcons.ts) | All sprites, frames and the map terrain (textures, dual-grid shape atlases, trees, rocks, docks) are generated, not drawn by hand: |
| `placeTickets` | Monsters / Spawning | [`src/lib/offline/placement.ts:75`](../../src/lib/offline/placement.ts) | Looks at the land: |
| `playerProfile` | Combat / A fight | [`src/lib/offline/profile.ts:62`](../../src/lib/offline/profile.ts) | Freezes everything a fight needs about the player into a `PlayerProfile` (max HP and mana, damage per hit, crit odds, attack speed, armor, dodge, l... |
| `POISON_FLAGS` | Saves & Server / Accepting a save | [`src/lib/cloudSave/verify.ts:128`](../../src/lib/cloudSave/verify.ts) | Flags that make an account ineligible for rankings for good. |
| `projectFight` | Combat / A fight | [`src/lib/offline/fightProject.ts:32`](../../src/lib/offline/fightProject.ts) | The open fight carried to its end with the same ticks the real request would take (so the real result is the same unless the player commands someth... |
| `qualityBiasOf` | Progression / Crafting | [`src/lib/craftGear.ts:57`](../../src/lib/craftGear.ts) | Intelligence's lean on the quality and the affix magnitudes of a craft, for `rollLeaning`. |
| `queueTicket` | Combat / A fight | [`src/lib/offline/fightTargets.ts:88`](../../src/lib/offline/fightTargets.ts) | A click while a fight is open: |
| `RARITIES` | Loot / Items | [`src/catalog/rarity.ts:34`](../../src/catalog/rarity.ts) | Rarities: |
| `rarityLuckMultiplier` | Economy / Chests and Luck | [`src/lib/luck.ts:30`](../../src/lib/luck.ts) | What the weight of every rarity above Common/Uncommon is multiplied by (the roll is normalised afterwards, so it moves odds toward rare gear). |
| `readBuffs` | Combat / Consumables | [`src/lib/buffs.ts:30`](../../src/lib/buffs.ts) | Cleans a stored buff list: |
| `REBIRTH` | Progression / Rebirth | [`src/config/rebirth.ts:22`](../../src/config/rebirth.ts) | Rebirth: |
| `rebirthStatus` | Progression / Rebirth | [`src/utils/game/rebirth.ts:122`](../../src/utils/game/rebirth.ts) | Can the player rebirth, and if not what is missing. |
| `receiveDrops` | Loot / Pipeline | [`src/lib/loot/receive.ts:24`](../../src/lib/loot/receive.ts) | Hands drops to the player: |
| `reconcileCharacter` | Progression / Levels | [`src/utils/game/character.ts:166`](../../src/utils/game/character.ts) | Puts a character's attributes in line with an XP total: |
| `refreshCost` | Economy / Merchant | [`src/lib/merchant.ts:32`](../../src/lib/merchant.ts) | The gold the next paid refresh costs, when `refreshesBought` have been bought: |
| `regen` | Combat / Player numbers | [`src/lib/combat.ts:211`](../../src/lib/combat.ts) | HP regeneration outside fights: |
| Rendering the map | Architecture / Rendering | [`src/components/game/Grid.tsx:1`](../../src/components/game/Grid.tsx) | Rendering notes. |
| `resolveConflict` | Saves & Server / Uploading | [`src/lib/cloudClient.ts:215`](../../src/lib/cloudClient.ts) | After a 409, decide whether it needs the player. |
| `resolveSourceLevel` | Loot / Pipeline | [`src/lib/loot/generate.ts:99`](../../src/lib/loot/generate.ts) | The level of a chest or shelf: |
| `RESOURCE_CAP` | Economy / Basics | [`src/config/economy.ts:43`](../../src/config/economy.ts) | The most any stockpile (XP included) can hold; |
| `restThrough` | Combat / Results and rest | [`src/lib/offline/fight.ts:164`](../../src/lib/offline/fight.ts) | After an absence the player is back on their feet: |
| `rewardWeights` | Economy / Chests and Luck | [`src/lib/chests.ts:93`](../../src/lib/chests.ts) | Relative chances with Luck shifted from plain gold toward the lucky chest and the item. |
| `rngFor` | Combat / A fight | [`src/lib/offline/fightContext.ts:81`](../../src/lib/offline/fightContext.ts) | The next random stream of a fight: |
| `rollBiome` | Economy / Biomes | [`src/utils/biomeRules.ts:126`](../../src/utils/biomeRules.ts) | The biome of a random purchase on (x, y): |
| `rollChestLoot` | Economy / Chests and Luck | [`src/lib/chests.ts:110`](../../src/lib/chests.ts) | Rolls the contents of a chest. |
| `rollGear` | Progression / Crafting | [`src/lib/craftGear.ts:114`](../../src/lib/craftGear.ts) | One crafted piece: |
| `rollItemLevel` | Loot / Pipeline | [`src/lib/loot/generate.ts:110`](../../src/lib/loot/generate.ts) | Rolls the item level around the source level, inside the profile's bounds. |
| `rollLeaning` | Loot / Pipeline | [`src/lib/loot/generate.ts:88`](../../src/lib/loot/generate.ts) | A 0-100 roll that leans toward the top with `bias` (0 is the plain uniform roll with the same single draw, so nothing else shifts). |
| `rollSpawnLevel` | Monsters / Level scaling | [`src/lib/monsters.ts:56`](../../src/lib/monsters.ts) | The level a new monster starts at. |
| `runCombat` | Combat / A fight | [`src/lib/offline/fight.ts:61`](../../src/lib/offline/fight.ts) | Brings the player's combat up to `env.nowSec`, then applies what the player asked for (switches, hotkeys) and starts the next fight when auto-battl... |
| `sanitizeSave` | Saves & Server / The save | [`src/lib/sanitizeSave.ts:193`](../../src/lib/sanitizeSave.ts) | Validates and normalises a loaded/imported save. |
| Save and Backup dialog | Saves & Server / The save | [`src/components/game/overlays/SaveMenuDialog.tsx:1`](../../src/components/game/overlays/SaveMenuDialog.tsx) | The Save & Backup dialog (Settings, *Save & backup*, or Control x5). |
| `SAVE_SCHEMA` | Saves & Server / The save | [`src/lib/saveFormat.ts:35`](../../src/lib/saveFormat.ts) | The save in the browser. |
| `sealedRng` | Saves & Server / The ledger | [`src/lib/offline/seal.ts:18`](../../src/lib/offline/seal.ts) | A random source for one reward: |
| Season restart (reset-players) | Ops / Operator guides | [`scripts/reset-players.ts:1`](../../scripts/reset-players.ts) | Season restart: |
| `sellPayout` | Economy / Merchant | [`src/utils/game/merchant.ts:51`](../../src/utils/game/merchant.ts) | Gold for selling `qty` of something worth `unit` each. |
| `sellValueOf` | Loot / Items | [`src/lib/itemInstance.ts:106`](../../src/lib/itemInstance.ts) | What a merchant pays for an instance: |
| `shopPriceOf` | Economy / Merchant | [`src/lib/merchant.ts:22`](../../src/lib/merchant.ts) | What a piece of gear costs at the merchant: |
| `SKILLS` | Combat / Potions and skills | [`src/catalog/skills.ts:34`](../../src/catalog/skills.ts) | Potions and skills. |
| `spawnLevelRange` | Monsters / Level scaling | [`src/lib/monsters.ts:39`](../../src/lib/monsters.ts) | The levels a new monster of this type can appear at in a world of this castle level (both ends included). |
| `STARTING_GEMS` | Progression / Gems | [`src/config/economy.ts:219`](../../src/config/economy.ts) | Gems every player starts with (also granted to saves from before Gems existed). |
| `swing` | Combat / Player numbers | [`src/lib/combat.ts:140`](../../src/lib/combat.ts) | One swing: |
| `SYNC` | Saves & Server / Uploading | [`src/lib/syncPolicy.ts:17`](../../src/lib/syncPolicy.ts) | When the game is copied to the account's cloud save. |
| The bot simulation | Pacing / The sim | [`scripts/sim.ts:1`](../../scripts/sim.ts) | The sim (`scripts/sim.ts`): |
| The end-to-end test account | Ops / Operator guides | [`e2e/account.ts:23`](../../e2e/account.ts) | The one account every end-to-end test signs in with (docs/reference/ops.md). |
| The game at a glance | Overview / The game | [`src/app/GameApp.tsx:17`](../../src/app/GameApp.tsx) | Idle Realm (code name idlarz) is an idle/incremental map game for signed-in players. |
| The map (World) | Architecture / State | [`src/utils/world.ts:32`](../../src/utils/world.ts) | The map has no edge. |
| The pacing guard and CI sharding | Ops / CI | [`scripts/pacing-guard.ts:1`](../../scripts/pacing-guard.ts) | The pacing guard, and how CI generates the docs. |
| The server's rule and the threat model | Saves & Server / Threat model | [`src/lib/cloudSave/pipeline.ts:1`](../../src/lib/cloudSave/pipeline.ts) | What the browser keeps, what the server keeps, and what the server decides. |
| The tick loop and persistence | Architecture / The loop | [`src/app/GameApp.tsx:111`](../../src/app/GameApp.tsx) | The tick loop. |
| `ticketCap` | Monsters / Spawning | [`src/lib/offline/tickets.ts:103`](../../src/lib/offline/tickets.ts) | How many more tickets may wait: |
| `TILE_RESOURCE_COST` | Economy / Tiles | [`src/config/economy.ts:126`](../../src/config/economy.ts) | Extra resources a tile purchase costs: |
| `tilePrice` | Economy / Tiles | [`src/config/economy.ts:106`](../../src/config/economy.ts) | Gold price of the next tile when `ownedTiles` are owned, before discounts: |
| `totalStatPoints` | Progression / Levels | [`src/utils/game/character.ts:151`](../../src/utils/game/character.ts) | The attribute points a character that has reached `level` has earned in all (a level gives 1; |
| `TRADE_GOODS` | Economy / Crafting | [`src/catalog/recipes.ts:36`](../../src/catalog/recipes.ts) | The trade goods crafting makes (IDL-227): |
| `trustedEconomy` | Saves & Server / Accepting a save | [`src/lib/cloudSave/trustedEconomy.ts:37`](../../src/lib/cloudSave/trustedEconomy.ts) | `ratio` is the net-worth check's `required / allowed` (over 1 = the save claims more than its time can explain). |
| `typeWeights` | Monsters / Spawning | [`src/lib/offline/spawnWeights.ts:49`](../../src/lib/offline/spawnWeights.ts) | Weight of each type for this player and castle level, in the order given. |
| `UNCLAIMED_SEC` | Combat / Results and rest | [`src/lib/offline/grant.ts:46`](../../src/lib/offline/grant.ts) | The longest gap the server treats as the same session: |
| `validateLootData` | Loot / Pipeline | [`src/lib/loot/validate.ts:35`](../../src/lib/loot/validate.ts) | Checks the whole loot configuration (docs/reference/loot.md): |
| `valueCurve` | Loot / Items | [`src/catalog/stats.ts:168`](../../src/catalog/stats.ts) | Value multiplier of an item level (1 at level 1). |
| `verifyTransition` | Saves & Server / Accepting a save | [`src/lib/cloudSave/verify.ts:176`](../../src/lib/cloudSave/verify.ts) | Runs every plausibility check between two consecutive saves and returns the flags that fired; |
| `WEAPON_ATTACK_SPEED` | Combat / Player numbers | [`src/catalog/weapons.ts:13`](../../src/catalog/weapons.ts) | Attacks per second of a one-hand weapon by type (a plain weapon uses its type's speed; |
| `withBuffs` | Combat / Consumables | [`src/lib/offline/profile.ts:96`](../../src/lib/offline/profile.ts) | A profile with the running potion buffs on top (buffTotals): |
| `withPushLock` | Saves & Server / Uploading | [`src/lib/pushLock.ts:19`](../../src/lib/pushLock.ts) | One upload at a time per browser. |
| `XP_MODEL` | Saves & Server / Accepting a save | [`src/lib/cloudSave/xpModel.ts:21`](../../src/lib/cloudSave/xpModel.ts) | The server's model of how much XP a character can have. |
| `xpToNextLevel` | Progression / Levels | [`src/utils/game/character.ts:186`](../../src/utils/game/character.ts) | XP to go from `level` to the next one (Infinity at the maximum level). |
