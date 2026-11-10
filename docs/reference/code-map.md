# Code map

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Every source file with the first sentence of its leading comment. A leading `~` means the file has none and the line is the first JSDoc found in it: give the file a comment of its own.

## src/


**src/app/**

- [`GameApp.tsx`](../../src/app/GameApp.tsx) — ~ The account's name and hero, given to a brand-new game only (never to one that has been played).

**src/app/api/auth/epoch/**

- [`route.ts`](../../src/app/api/auth/epoch/route.ts) — ~ The "A new chapter" confirm:

**src/app/api/auth/login/**

- [`route.ts`](../../src/app/api/auth/login/route.ts)

**src/app/api/auth/logout/**

- [`route.ts`](../../src/app/api/auth/logout/route.ts)

**src/app/api/auth/me/**

- [`route.ts`](../../src/app/api/auth/me/route.ts) — ~ Who is signed in (from the cookie only), their own profile row and the data epoch state (`epoch`, `needsReset`, see `config/epoch.ts`).

**src/app/api/auth/profile/**

- [`route.ts`](../../src/app/api/auth/profile/route.ts) — ~ Creates or replaces the signed-in player's own profile row (the id is always the cookie's user, never from the body).

**src/app/api/auth/register/**

- [`route.ts`](../../src/app/api/auth/register/route.ts) — ~ Creates the account, signs the player in (Confirm email must be off in Supabase, otherwise there is no session) and writes their profile row.

**src/app/api/chest/**

- [`route.ts`](../../src/app/api/chest/route.ts) — ~ Opens the chest on one tile:

**src/app/api/craft/cancel/**

- [`route.ts`](../../src/app/api/craft/cancel/route.ts) — ~ Cancel a crafting batch:

**src/app/api/craft/claim/**

- [`route.ts`](../../src/app/api/craft/claim/route.ts) — ~ Claim a crafting batch:

**src/app/api/craft/**

- [`route.ts`](../../src/app/api/craft/route.ts) — ~ Crafts:

**src/app/api/craft/stash/**

- [`route.ts`](../../src/app/api/craft/stash/route.ts) — ~ Withdraw crafted potions or trade goods from the crafting stash into the bag:

**src/app/api/fight/**

- [`route.ts`](../../src/app/api/fight/route.ts) — ~ `{ key, action, ...

**src/app/api/inventory/**

- [`route.ts`](../../src/app/api/inventory/route.ts) — ~ One of the player's own changes to what they carry:

**src/app/api/offline/**

- [`route.ts`](../../src/app/api/offline/route.ts) — ~ An idempotency key:

**src/app/api/rebirth/**

- [`route.ts`](../../src/app/api/rebirth/route.ts) — ~ The server runs the player's rebirth:

**src/app/api/rebirths/**

- [`route.ts`](../../src/app/api/rebirths/route.ts) — ~ The signed-in player's rebirth history, newest first.

**src/app/api/save/**

- [`route.ts`](../../src/app/api/save/route.ts) — ~ The account's cloud save (text the client imports, plus headline numbers for the start hub), or `{ empty:

**src/app/api/spawn/**

- [`route.ts`](../../src/app/api/spawn/route.ts) — ~ The chests and monsters the server says have appeared, when to ask again, and the player's combat as of now.

**src/app/**

- [`layout.tsx`](../../src/app/layout.tsx)

**src/app/map-lab/**

- [`CombatPreview.tsx`](../../src/app/map-lab/CombatPreview.tsx) — ~ Same list as the lab's spawn dropdown:
- [`LabPanel.tsx`](../../src/app/map-lab/LabPanel.tsx)
- [`layout.tsx`](../../src/app/map-lab/layout.tsx)
- [`page.tsx`](../../src/app/map-lab/page.tsx) — ~ /map-lab:

**src/app/**

- [`page.tsx`](../../src/app/page.tsx) — ~ The gate in front of the game:

**src/catalog/**

- [`affixes.ts`](../../src/catalog/affixes.ts) — ~ Affixes:
- [`buffs.ts`](../../src/catalog/buffs.ts) — Consumable effects and the buff families (IDL-155).
- [`index.ts`](../../src/catalog/index.ts) — ~ Slots a full set fills (both rings count, so 12 items fill 13 slots)

**src/catalog/items/**

- [`cloth.ts`](../../src/catalog/items/cloth.ts)
- [`consumables.ts`](../../src/catalog/items/consumables.ts)
- [`define.ts`](../../src/catalog/items/define.ts) — ~ The item level window of a material tier.
- [`grades.ts`](../../src/catalog/items/grades.ts) — ~ Name of the grade in the planning doc
- [`index.ts`](../../src/catalog/items/index.ts) — ~ Every item in the game, in display order.
- [`ladder.ts`](../../src/catalog/items/ladder.ts) — ~ The set a special grade's pieces belong to (SetDef ids in catalog/sets.ts)
- [`legendary.ts`](../../src/catalog/items/legendary.ts)
- [`obsidian.ts`](../../src/catalog/items/obsidian.ts)
- [`reuse.ts`](../../src/catalog/items/reuse.ts) — ~ Grade of a reserve item = the grade its art is registered with (config/itemIcons), so one table says it
- [`starter.ts`](../../src/catalog/items/starter.ts)
- [`steel.ts`](../../src/catalog/items/steel.ts)

**src/catalog/**

- [`loot.ts`](../../src/catalog/loot.ts) — ~ Items the merchant sells, cheapest first (a disabled item is never sold, whatever its `shop` price).
- [`lootConfig.ts`](../../src/catalog/lootConfig.ts) — ~ A set of items a profile can draw from.
- [`monsters.ts`](../../src/catalog/monsters.ts) — ~ The monster roster:
- [`perkCaps.ts`](../../src/catalog/perkCaps.ts) — ~ The stat families whose gear bucket is capped (IDL-149 / IDL-252).
- [`rarity.ts`](../../src/catalog/rarity.ts) — ~ Everything the game knows about a rarity, in one place:
- [`recipes.ts`](../../src/catalog/recipes.ts) — Crafting recipes (docs/plan/crafting-v0.md).
- [`resourceArt.ts`](../../src/catalog/resourceArt.ts) — The resource art roster:
- [`resourceKeys.ts`](../../src/catalog/resourceKeys.ts) — ~ The one list of the resources a save and the ledger store (gold ...
- [`resources.ts`](../../src/catalog/resources.ts) — Every resource and currency the player can hold:
- [`sets.ts`](../../src/catalog/sets.ts) — ~ Armour sets.
- [`skills.ts`](../../src/catalog/skills.ts) — Skills: the things a character can cast with mana. Data only; the rules (damage-free, so nothing here touches the click combat)
- [`stats.ts`](../../src/catalog/stats.ts) — ~ Every stat an item or a set bonus can carry.
- [`weapons.ts`](../../src/catalog/weapons.ts) — ~ Attacks per second of a one-hand weapon by type (a plain weapon uses its type's speed; an item can override it with `attackSpeed`).

**src/components/auth/**

- [`AuthUnavailable.tsx`](../../src/components/auth/AuthUnavailable.tsx) — ~ An outage may pass on its own:
- [`NewChapterScreen.tsx`](../../src/components/auth/NewChapterScreen.tsx) — ~ The account's current hero:
- [`SaveHub.tsx`](../../src/components/auth/SaveHub.tsx) — ~ local:
- [`StartDialog.tsx`](../../src/components/auth/StartDialog.tsx) — ~ 'profile':

**src/components/game/**

- [`AmbientLife.tsx`](../../src/components/game/AmbientLife.tsx) — ~ Sprite sheets of every ambient critter (2 frames each:
- [`Bag.tsx`](../../src/components/game/Bag.tsx) — ~ The 6x6 bag.
- [`BiomeTooltip.tsx`](../../src/components/game/BiomeTooltip.tsx)
- [`BottomRightStack.tsx`](../../src/components/game/BottomRightStack.tsx) — ~ The bottom right corner:
- [`BuffRow.tsx`](../../src/components/game/BuffRow.tsx) — ~ The potion buffs running, each with the time left (the server's list from the last combat answer, counted down by this browser's clock).
- [`BuildDialog.tsx`](../../src/components/game/BuildDialog.tsx) — ~ The build dialog of one explored tile, opened from its right-click menu ("Build here").
- [`CastleCompass.tsx`](../../src/components/game/CastleCompass.tsx) — ~ Breathing room (px) between the header and the free part of the screen
- [`CastleFortress.tsx`](../../src/components/game/CastleFortress.tsx) — ~ The castle's fortress (castle level 7+):
- [`CastleRange.tsx`](../../src/components/game/CastleRange.tsx) — ~ Violet patch drawn over the tiles the castle's range bonus covers (the bonus itself comes later):
- [`CastleSprite.tsx`](../../src/components/game/CastleSprite.tsx) — ~ `tile`:
- [`CastleTimerBadge.tsx`](../../src/components/game/CastleTimerBadge.tsx) — ~ The castle upgrade's remaining time, drawn on the castle tile (no need to open the dialog).
- [`CastleUpgradeDialog.tsx`](../../src/components/game/CastleUpgradeDialog.tsx) — ~ The castle upgrade window (opened from the castle tile):
- [`CharacterPortrait.tsx`](../../src/components/game/CharacterPortrait.tsx) — ~ 'full' = the whole figure (56x80), 'bust' = head and shoulders (40x40)
- [`ClassPickerDialog.tsx`](../../src/components/game/ClassPickerDialog.tsx) — ~ Four heroes to choose from; picking one applies at once (cosmetic for now, abilities come later).
- [`CollapsibleSection.tsx`](../../src/components/game/CollapsibleSection.tsx) — ~ A titled block whose header toggles the body; the open/closed choice is remembered per `id` (localStorage).
- [`ConfirmDialogs.tsx`](../../src/components/game/ConfirmDialogs.tsx) — ~ "Dismiss this monster?":
- [`ContextMenu.tsx`](../../src/components/game/ContextMenu.tsx) — ~ The one right-click / dropdown menu.
- [`CostList.tsx`](../../src/components/game/CostList.tsx) — ~ A bundle of resource costs; each entry is green when affordable and red when not.
- [`CraftStash.tsx`](../../src/components/game/CraftStash.tsx) — ~ The bag's Crafting tab:
- [`EmberIcon.tsx`](../../src/components/game/EmberIcon.tsx) — ~ 0.5 = 20px inline icon (default), 1 = the full 40px sprite
- [`FloatingText.tsx`](../../src/components/game/FloatingText.tsx) — ~ Renders "+N <icon>" popups where the player clicked.
- [`GameDebug.tsx`](../../src/components/game/GameDebug.tsx) — ~ Rolls the loot of a source through the real pipeline at the current castle level, puts it in the bag and logs why it dropped (console.table).
- [`GameHeader.tsx`](../../src/components/game/GameHeader.tsx) — ~ One compact row:
- [`GemIcon.tsx`](../../src/components/game/GemIcon.tsx) — ~ 0.5 = 20px inline icon (default), 1 = the full 40px sprite
- [`Grid.tsx`](../../src/components/game/Grid.tsx) — ~ Wheel zoom.
- [`HeaderMenu.tsx`](../../src/components/game/HeaderMenu.tsx) — ~ The hero:
- [`HeaderTip.tsx`](../../src/components/game/HeaderTip.tsx) — ~ Which edge of the control the card lines up with:
- [`HighlightLayer.tsx`](../../src/components/game/HighlightLayer.tsx) — ~ The "Highlight" tint:
- [`ItemSlot.tsx`](../../src/components/game/ItemSlot.tsx) — ~ A piece of gear (an instance) ...
- [`ItemTooltip.tsx`](../../src/components/game/ItemTooltip.tsx) — ~ A signed change in parentheses, green for a gain and red for a loss:
- [`LevelDetails.tsx`](../../src/components/game/LevelDetails.tsx) — ~ The text of an XP bar:
- [`LevelOrb.tsx`](../../src/components/game/LevelOrb.tsx) — ~ The level shown inside the orb; leave out for a plain orb
- [`LevelUpTimer.tsx`](../../src/components/game/LevelUpTimer.tsx)
- [`MapTipLayer.tsx`](../../src/components/game/MapTipLayer.tsx) — ~ The layer that map tooltips are drawn into.
- [`Minimap.tsx`](../../src/components/game/Minimap.tsx) — ~ Size of the overview (css px)
- [`MonsterArt.tsx`](../../src/components/game/MonsterArt.tsx) — ~ A monster's picture (public/pixel/enemies); `scale` 1 is the size it has on the map, bigger ones are for the fight window.
- [`MonsterSprite.tsx`](../../src/components/game/MonsterSprite.tsx) — ~ A monster standing on its tile:
- [`NotifyDot.tsx`](../../src/components/game/NotifyDot.tsx) — ~ Render nothing when false, so callers can pass the condition straight through
- [`OrganizeButton.tsx`](../../src/components/game/OrganizeButton.tsx) — ~ Tidies the bag from the left:
- [`PixelIcon.tsx`](../../src/components/game/PixelIcon.tsx) — ~ A one-row sprite sheet from the icon set (its size is the whole sheet)
- [`PixelModal.tsx`](../../src/components/game/PixelModal.tsx) — ~ True while a real modal (a confirmation, settings ...) is open:
- [`PixelWindow.tsx`](../../src/components/game/PixelWindow.tsx) — ~ Windows narrower than this screen are laid out one at a time, centered (no room for dragging them side by side)
- [`ResourceDisplay.tsx`](../../src/components/game/ResourceDisplay.tsx) — ~ Room for the longest ordinary amount ("12.3K") at the small header size, so a chip keeps its width while its number ticks
- [`ResourceIcon.tsx`](../../src/components/game/ResourceIcon.tsx) — ~ 0.6 = 24px inline icon (default), 1 = full 40px sprite
- [`StableNumber.tsx`](../../src/components/game/StableNumber.tsx) — ~ Reserve room for at least this much text (CSS length), so a short number does not make the chip shrink and grow
- [`TerrainLayer.tsx`](../../src/components/game/TerrainLayer.tsx) — ~ The map's ground:
- [`Tile.tsx`](../../src/components/game/Tile.tsx)
- [`TileMenu.ts`](../../src/components/game/TileMenu.ts) — ~ The monster on the tile; undefined:
- [`TileMonster.tsx`](../../src/components/game/TileMonster.tsx) — ~ The monster on the map with its growth shown:
- [`TileStatus.tsx`](../../src/components/game/TileStatus.tsx)
- [`TileTooltip.tsx`](../../src/components/game/TileTooltip.tsx) — ~ Hover card of a monster:
- [`Toast.tsx`](../../src/components/game/Toast.tsx) — ~ Short messages ("Game saved") under the header; `showToast` in the ui store puts one up for a couple of seconds, and several stack.
- [`WaterLayer.tsx`](../../src/components/game/WaterLayer.tsx) — ~ Visible tile range (inclusive-exclusive), so only the ripples on screen are in the DOM
- [`WindowErrorBoundary.tsx`](../../src/components/game/WindowErrorBoundary.tsx) — ~ Keeps one window's crash from blanking the whole game:
- [`itemUi.ts`](../../src/components/game/itemUi.ts) — ~ Rarity colours come from the catalog (catalog/rarity.ts); kept here as a lookup the item UI imports.
- [`mapSource.tsx`](../../src/components/game/mapSource.tsx) — ~ What the map components read from the game.

**src/components/game/overlays/**

- [`CharacterOverlay.tsx`](../../src/components/game/overlays/CharacterOverlay.tsx)
- [`ChestNotification.tsx`](../../src/components/game/overlays/ChestNotification.tsx) — ~ The toast after opening a chest:
- [`CombatPanel.tsx`](../../src/components/game/overlays/CombatPanel.tsx) — ~ How long a bar takes to run to a new number:
- [`CombatWidget.tsx`](../../src/components/game/overlays/CombatWidget.tsx) — ~ "1 min 12 s" or "45 s"
- [`CraftingOverlay.tsx`](../../src/components/game/overlays/CraftingOverlay.tsx) — ~ Components have no catalog item, so their sprite is named here.
- [`FarmAnimalDock.tsx`](../../src/components/game/overlays/FarmAnimalDock.tsx) — ~ Width the scene keeps clear on the right while the panel is open (panel width plus its margin)
- [`FarmHud.tsx`](../../src/components/game/overlays/FarmHud.tsx) — ~ Corner readout over the farm scene:
- [`FarmOverlay.tsx`](../../src/components/game/overlays/FarmOverlay.tsx) — ~ The Farm window:
- [`FarmScene.tsx`](../../src/components/game/overlays/FarmScene.tsx) — ~ Animals drawn for a count:
- [`FarmUpgradeDock.tsx`](../../src/components/game/overlays/FarmUpgradeDock.tsx) — ~ How long the drawer takes to slide shut (a little over the transition in Farm.css)
- [`GameWindows.tsx`](../../src/components/game/overlays/GameWindows.tsx) — ~ Every game window, each open or not on its own:
- [`LevelUpNotification.tsx`](../../src/components/game/overlays/LevelUpNotification.tsx) — ~ Level-up celebration:
- [`LoadingScreen.tsx`](../../src/components/game/overlays/LoadingScreen.tsx) — ~ The splash while the saved game loads (needs the game store; the start gate uses LoadingView, which does not).
- [`LoadingView.tsx`](../../src/components/game/overlays/LoadingView.tsx) — ~ Hydration splash:

**src/components/game/overlays/Merchant/**

- [`MerchantItemsSection.tsx`](../../src/components/game/overlays/Merchant/MerchantItemsSection.tsx) — ~ Sell bag items for gold:
- [`MerchantOverlay.tsx`](../../src/components/game/overlays/Merchant/MerchantOverlay.tsx)
- [`MerchantResources.tsx`](../../src/components/game/overlays/Merchant/MerchantResources.tsx) — ~ How much one Sell or Buy click moves:
- [`MerchantShop.tsx`](../../src/components/game/overlays/Merchant/MerchantShop.tsx) — ~ How many places stand on one plank of the shelf.
- [`MerchantTabButtons.tsx`](../../src/components/game/overlays/Merchant/MerchantTabButtons.tsx)
- [`TipButton.tsx`](../../src/components/game/overlays/Merchant/TipButton.tsx) — ~ A small button with a hover card (the price, the gold a sale pays ...), in the look of the item hover cards.

**src/components/game/overlays/**

- [`OfflineDialog.tsx`](../../src/components/game/overlays/OfflineDialog.tsx) — ~ "Hours as a number":
- [`RebirthDialog.tsx`](../../src/components/game/overlays/RebirthDialog.tsx) — ~ Rebirth and the Ember shop.
- [`RebirthsPanel.tsx`](../../src/components/game/overlays/RebirthsPanel.tsx) — ~ One run as a card:
- [`SaveMenuDialog.tsx`](../../src/components/game/overlays/SaveMenuDialog.tsx) — ~ Save & backup:
- [`SettingsDialog.tsx`](../../src/components/game/overlays/SettingsDialog.tsx) — ~ Visible settings:
- [`StatisticsOverlay.tsx`](../../src/components/game/overlays/StatisticsOverlay.tsx) — ~ One label / value line; `muted` for the small print inside a breakdown.
- [`TabLockOverlay.tsx`](../../src/components/game/overlays/TabLockOverlay.tsx) — ~ Shown in a tab that does not own the game (another tab is running it).
- [`Tutorial.tsx`](../../src/components/game/overlays/Tutorial.tsx) — ~ The in-game guide.
- [`TutorialDialog.tsx`](../../src/components/game/overlays/TutorialDialog.tsx) — ~ The full guide, reopened on demand from Settings.
- [`farmGeometry.ts`](../../src/components/game/overlays/farmGeometry.ts) — Geometry of the farm pasture drawn by scripts/pixel/sprites_farm.py (keep the constants and prop lists in sync with that file).

**src/config/**

- [`biomePalette.ts`](../../src/config/biomePalette.ts) — One colour per biome, the single place for them:
- [`biomeRules.ts`](../../src/config/biomeRules.ts) — How the map grows:
- [`biomeStage.ts`](../../src/config/biomeStage.ts) — Which biomes are part of the game today and which exist only for development (the map lab).
- [`biomes.ts`](../../src/config/biomes.ts) — The map: tile size, biome list and spawn weights, and the ambient critters.
- [`branding.ts`](../../src/config/branding.ts) — The public name of the game, in one place. UI text, page metadata and the README read it from here, so a rename is a one-line change.
- [`buildings.ts`](../../src/config/buildings.ts) — Buildings and what they cost.
- [`castle.ts`](../../src/config/castle.ts) — The castle: its position, base output, area, and the timed upgrade.
- [`character.ts`](../../src/config/character.ts) — The player: default name, starting attributes, the level curve and what an attribute point gives.
- [`combatConfig.ts`](../../src/config/combatConfig.ts) — ~ Combat tunables.
- [`crafting.ts`](../../src/config/crafting.ts) — Crafting: the crafting level curve and the per-request limits. First draft (docs/plan/crafting-v0.md): level 10 in the first days of
- [`distanceBands.ts`](../../src/config/distanceBands.ts) — Named bands of castle distance (Chebyshev tiles), so biome, monster and chest rules all share one vocabulary and a tweak is a
- [`economy.ts`](../../src/config/economy.ts) — Tile prices and XP, the resource caps, clicks and the starting gems: the numbers the economy runs on.
- [`epoch.ts`](../../src/config/epoch.ts) — ~ The data epoch the server is on.
- [`farm.ts`](../../src/config/farm.ts) — The farm: animals, pen and farm upgrades.
- [`itemCatalog.ts`](../../src/config/itemCatalog.ts) — The item catalog lives in src/catalog (items, sets, rarities, stats, resources, loot config). This file only derives the

**src/config/itemIcons/**

- [`index.ts`](../../src/config/itemIcons/index.ts) — The item icon registry. One JSON file per slot (and per weapon type under mainHand) in this folder, one line per icon, so art PRs

**src/config/**

- [`limits.ts`](../../src/config/limits.ts) — Bounds and caps that later upgrades and the rebirth system are meant to raise (more bag room, longer monster growth, a bigger
- [`merchant.ts`](../../src/config/merchant.ts) — The merchant: resource prices, upgrades, shop goods.
- [`monsterArtSize.ts`](../../src/config/monsterArtSize.ts) — How big a roster monster's picture is drawn on the map, in px (a tile is TILE_SIZE = 48 wide).
- [`pixelIcons.ts`](../../src/config/pixelIcons.ts) — Pixel-art sprite set (generated by scripts/pixel/build.py, rules in scripts/pixel/reference/STYLE.md).
- [`playerClasses.ts`](../../src/config/playerClasses.ts) — Hero classes the player can pick (double-click the character). Purely cosmetic for now - each has its own
- [`rebirth.ts`](../../src/config/rebirth.ts) — Rebirth and the Ember shop.
- [`resources.ts`](../../src/config/resources.ts) — The old views of catalog/resources.ts (icons and header tooltips) and the helper that builds them.
- [`slashFx.ts`](../../src/config/slashFx.ts) — The slash effects drawn over the fight stage (public/fx/slash, built by scripts/fx/build_slash_sheets.py):
- [`spawns.ts`](../../src/config/spawns.ts) — Chests, monster spawn limits and Luck.

**src/hooks/**

- [`useClickIncome.ts`](../../src/hooks/useClickIncome.ts) — ~ Click income:
- [`useCloudSync.ts`](../../src/hooks/useCloudSync.ts) — ~ Copies the game to the signed-in account's cloud save (cadence and limits:
- [`useCtrlSequence.ts`](../../src/hooks/useCtrlSequence.ts) — ~ Calls `onTrigger` when the Control key is pressed `count` times within `windowMs` (hidden menu shortcut).
- [`useGlobalContextMenu.ts`](../../src/hooks/useGlobalContextMenu.ts) — ~ Takes over the right click for the whole page:
- [`useHydration.ts`](../../src/hooks/useHydration.ts) — ~ True once the saved game has been loaded from the vault AND the splash has been shown for a moment.
- [`useMenuAttention.ts`](../../src/hooks/useMenuAttention.ts) — ~ Which tabs of the main menu have something waiting:
- [`useOfflineClaim.ts`](../../src/hooks/useOfflineClaim.ts) — ~ The game waits this long for the server before it starts anyway (a late answer is still applied when it arrives).
- [`useRestCountdown.ts`](../../src/hooks/useRestCountdown.ts) — ~ "1 min 12 s" or "45 s"
- [`useSingleTab.ts`](../../src/hooks/useSingleTab.ts) — ~ Only one tab may run the game.
- [`useSpawnSync.ts`](../../src/hooks/useSpawnSync.ts) — ~ The one poll of the game.

**src/lib/**

- [`ambientLife.ts`](../../src/lib/ambientLife.ts) — ~ Visible part of the map in tile coordinates (inclusive).
- [`authClient.ts`](../../src/lib/authClient.ts) — ~ The browser side of /api/auth/*:
- [`authRoute.ts`](../../src/lib/authRoute.ts) — ~ The auth service cannot be reached or is not set up:
- [`authValidation.ts`](../../src/lib/authValidation.ts) — ~ Same limit as the in-game name (applyProfileToFreshGame) and the `profiles.character_name` check constraint.
- [`buffs.ts`](../../src/lib/buffs.ts) — ~ One running buff as it is stored (the `player_ledger.buffs` column of PR 2):
- [`castleFinder.ts`](../../src/lib/castleFinder.ts) — ~ Finding the castle again on a map without edges:
- [`castleTimer.ts`](../../src/lib/castleTimer.ts) — ~ The short text of the castle upgrade timer ("2h 5m", "4m 10s"), or null when no upgrade is running.
- [`castleWard.ts`](../../src/lib/castleWard.ts) — ~ How far (tiles, every side) the violet range area reaches:
- [`chests.ts`](../../src/lib/chests.ts) — ~ A tile with a building:
- [`clickLimiter.ts`](../../src/lib/clickLimiter.ts) — ~ Click limiter made of two token buckets (a paid click needs a token from both).
- [`clipboard.ts`](../../src/lib/clipboard.ts) — Copies text to the clipboard.
- [`cloudClient.ts`](../../src/lib/cloudClient.ts) — ~ The browser side of /api/save.
- [`cloudRecovery.ts`](../../src/lib/cloudRecovery.ts) — ~ The numbers of a game that say how far along it is.

**src/lib/cloudSave/**

- [`emberModel.ts`](../../src/lib/cloudSave/emberModel.ts) — ~ The server's model of how many Embers (and rebirths) an account can hold.
- [`environment.ts`](../../src/lib/cloudSave/environment.ts)
- [`netWorth.ts`](../../src/lib/cloudSave/netWorth.ts) — ~ The spending check:
- [`pipeline.ts`](../../src/lib/cloudSave/pipeline.ts) — ~ Accepted saves are copied into the history when this long passed since the last copy (not every N revisions:
- [`rebirthHistory.ts`](../../src/lib/cloudSave/rebirthHistory.ts) — ~ One rebirth, as the Rebirths tab lists it.
- [`serverRebirth.ts`](../../src/lib/cloudSave/serverRebirth.ts) — ~ The server's own reading of "may this account rebirth, and what does it pay" (IDL-102), from the last STORED save (never from numbers the browser sends with the request):
- [`summary.ts`](../../src/lib/cloudSave/summary.ts) — ~ What the server derives from a save by itself (never from numbers the client sends):
- [`supabaseRepo.ts`](../../src/lib/cloudSave/supabaseRepo.ts) — ~ Null until the row's first save under the offline ledger; `DEFAULT_DERIVED` fills it
- [`trustedEconomy.ts`](../../src/lib/cloudSave/trustedEconomy.ts) — ~ What the server pays a save from when the save's own economy cannot be believed (IDL-167).
- [`verify.ts`](../../src/lib/cloudSave/verify.ts) — ~ Plausibility checks between two consecutive saves of one player, run on the SERVER with the SERVER's clock, from the summaries alone (no state is opened).
- [`xpModel.ts`](../../src/lib/cloudSave/xpModel.ts) — ~ The server's model of how much XP a character can have.

**src/lib/**

- [`combat.ts`](../../src/lib/combat.ts) — ~ The player's numbers (all pure functions in `src/lib/combat.ts`, used by the server engine and the UI):
- [`combatCursor.ts`](../../src/lib/combatCursor.ts) — ~ Which account the cursor belongs to (a cursor written for another account is ignored).
- [`combatFx.ts`](../../src/lib/combatFx.ts) — ~ The floating number of a hit the player lands:
- [`craftGear.ts`](../../src/lib/craftGear.ts) — Gear crafting maths, pure (IDL-241): the item level window, the rarity ceiling, the pity multiplier and the roll itself. The server (src/lib/offline/craft.ts) rolls with a sealed rng and the
- [`crafting.ts`](../../src/lib/crafting.ts) — Crafting maths, pure (no store, no server): the crafting level curve and what a recipe costs. The server (/api/craft) and the
- [`distance.ts`](../../src/lib/distance.ts) — ~ How far a tile is from the castle, the way the chest placement and the danger bonus measure it (Chebyshev:
- [`dragPaint.ts`](../../src/lib/dragPaint.ts) — ~ Press, hold and drag over the map to draw on it:
- [`effectiveStats.ts`](../../src/lib/effectiveStats.ts) — ~ Everything that decides the numbers shown for the character:
- [`epochFetch.ts`](../../src/lib/epochFetch.ts) — ~ `fetch` for the game's own /api routes:
- [`epochGuard.ts`](../../src/lib/epochGuard.ts) — ~ The browser's half of the data epoch.
- [`fightSim.ts`](../../src/lib/fightSim.ts) — ~ A character with attribute points spent on top of the starting 5 each (a level 30 character has about 25 to spend).
- [`floatText.ts`](../../src/lib/floatText.ts) — Tiny event bus for the "+N resource" popups that appear at the cursor.
- [`gearEconomy.ts`](../../src/lib/gearEconomy.ts) — ~ The economy effects of the worn gear (the set bonuses of catalog/sets.ts).
- [`globalMenu.ts`](../../src/lib/globalMenu.ts) — ~ Saves to this browser and, with an account signed in, to the cloud copy too (once every 10 minutes:
- [`inventory.ts`](../../src/lib/inventory.ts) — ~ What a character carries after a rebirth:
- [`inventoryDrag.ts`](../../src/lib/inventoryDrag.ts) — What is being dragged between the bag and the equipment slots (HTML5 drag and drop cannot read data during dragover).
- [`isRecord.ts`](../../src/lib/isRecord.ts) — A plain JSON object:
- [`itemInstance.ts`](../../src/lib/itemInstance.ts) — ~ The base stats at this level and quality (no affixes)
- [`limits.ts`](../../src/lib/limits.ts) — ~ What can raise a limit:

**src/lib/loot/**

- [`autoSell.ts`](../../src/lib/loot/autoSell.ts) — ~ Whether the auto-sell filter takes a piece of gear:
- [`data.ts`](../../src/lib/loot/data.ts) — ~ Everything the loot pipeline reads, as one injectable bundle.
- [`generate.ts`](../../src/lib/loot/generate.ts) — ~ The monster's level (sets the item level of what it drops and the per-level chances); omitted for a chest or the shelf
- [`index.ts`](../../src/lib/loot/index.ts) — The loot pipeline's public face. Content lives in src/catalog (lootConfig, affixes, items); this folder is the logic.
- [`kill.ts`](../../src/lib/loot/kill.ts) — ~ Hide per second of the farm; a kill pays a share of it (0 without deer and pigs)
- [`pools.ts`](../../src/lib/loot/pools.ts) — ~ Whether an item belongs to a pool:
- [`receive.ts`](../../src/lib/loot/receive.ts) — ~ What actually went into the bag
- [`validate.ts`](../../src/lib/loot/validate.ts) — ~ The configuration is broken:

**src/lib/**

- [`luck.ts`](../../src/lib/luck.ts) — ~ Seconds between two chests:
- [`manualCloudSave.ts`](../../src/lib/manualCloudSave.ts) — ~ "Save game" in the menu:
- [`mapEdit.ts`](../../src/lib/mapEdit.ts) — ~ Drawing on a World with a drag:
- [`mapView.ts`](../../src/lib/mapView.ts) — ~ The view of the map:
- [`merchant.ts`](../../src/lib/merchant.ts) — ~ What a piece of gear costs at the merchant:
- [`minimap.ts`](../../src/lib/minimap.ts) — ~ The minimap:
- [`monsters.ts`](../../src/lib/monsters.ts) — ~ Reduces the damage of every hit the player lands (same curve as the player's armor)

**src/lib/offline/**

- [`apply.ts`](../../src/lib/offline/apply.ts) — ~ What the welcome-back window shows besides the income.
- [`chapter.ts`](../../src/lib/offline/chapter.ts) — ~ The account's profile as the reset needs it:
- [`consumables.ts`](../../src/lib/offline/consumables.ts) — ~ Drinks the potion in bag slot `index`, at the server clock `nowSec` (the combat in `input` has already been brought up to now).
- [`craft.ts`](../../src/lib/offline/craft.ts) — ~ What rolling a gear craft needs besides the ledger:
- [`fight.ts`](../../src/lib/offline/fight.ts) — ~ What the last `fight` or `unqueue` command did to the queue (left out when there was none)
- [`fightContext.ts`](../../src/lib/offline/fightContext.ts) — ~ Server clock, epoch seconds
- [`fightProfile.ts`](../../src/lib/offline/fightProfile.ts) — ~ The potions auto-use would drink (none with auto-use off), for the win estimate.
- [`fightProject.ts`](../../src/lib/offline/fightProject.ts) — ~ The open fight carried to its end with the same ticks the real request would take (so the real result is the same unless the player commands something first), as the picture the browser animates:
- [`fightSteps.ts`](../../src/lib/offline/fightSteps.ts) — ~ Auto-use's rules for one tick:
- [`fightTargets.ts`](../../src/lib/offline/fightTargets.ts) — ~ A placed monster by ticket number, with what it is (null:
- [`fightTypes.ts`](../../src/lib/offline/fightTypes.ts) — ~ What the player brings to a fight, worked out from the last accepted save when the fight starts and then frozen for that fight.
- [`fightView.ts`](../../src/lib/offline/fightView.ts) — ~ The picture the browser is given:
- [`grant.ts`](../../src/lib/offline/grant.ts) — ~ What the server derived from the last accepted save (never sent by the client).
- [`inventory.ts`](../../src/lib/offline/inventory.ts) — ~ The bag size a save entitles its owner to (the base plus the Pack Rat bonus the save holds).
- [`ledger.ts`](../../src/lib/offline/ledger.ts) — ~ Everything the server ever granted (income while away, chest and kill rewards):
- [`limits.ts`](../../src/lib/offline/limits.ts) — ~ Hours of absence the kingdom works for the player (base 8, plus Night Watch), never above the hard ceiling.
- [`online.ts`](../../src/lib/offline/online.ts) — ~ The most time one online call will run the spawn timers forward.
- [`placement.ts`](../../src/lib/offline/placement.ts) — ~ What the rules depend on:
- [`profile.ts`](../../src/lib/offline/profile.ts) — ~ The character's stats with every derived number worked out again (a save only holds the attributes).
- [`reconcile.ts`](../../src/lib/offline/reconcile.ts) — ~ What changed on the map:
- [`reward.ts`](../../src/lib/offline/reward.ts) — ~ What the drops became:
- [`seal.ts`](../../src/lib/offline/seal.ts) — ~ A random source for one reward:
- [`season.ts`](../../src/lib/offline/season.ts) — ~ When the last season reset happened (epoch ms), or null when there never was one.
- [`secret.ts`](../../src/lib/offline/secret.ts) — ~ SHA-256 of the `LOOT_SECRET` that used to be committed in `.env.example`.
- [`service.ts`](../../src/lib/offline/service.ts) — ~ The server-only secret that seals rolls (LOOT_SECRET)
- [`spawnWeights.ts`](../../src/lib/offline/spawnWeights.ts) — ~ Win chance range that is worth a fight:
- [`stats.ts`](../../src/lib/offline/stats.ts) — SERVER ONLY. The lifetime counters of a player (`player_ledger.stats`): kills per monster type, chests opened, tiles bought and the income earned while playing.
- [`supabaseLedger.ts`](../../src/lib/offline/supabaseLedger.ts) — ~ The ledger in Supabase (service role:
- [`tickets.ts`](../../src/lib/offline/tickets.ts) — ~ Chests and monsters together that can wait at once, whatever the size of the map (keeps the stored row tiny).
- [`types.ts`](../../src/lib/offline/types.ts) — ~ What the server keeps of a player's things:
- [`winChance.ts`](../../src/lib/offline/winChance.ts) — ~ How sharply the chance rises with the time-to-survive over time-to-kill ratio (1 = a coin flip; the fight is a race of many swings, so it is steep).

**src/lib/**

- [`offlineClient.ts`](../../src/lib/offlineClient.ts) — ~ The browser side of /api/offline.
- [`offlineFlow.ts`](../../src/lib/offlineFlow.ts) — ~ 'done':
- [`offlineRoute.ts`](../../src/lib/offlineRoute.ts) — ~ An idempotency key:
- [`planPicture.ts`](../../src/lib/planPicture.ts) — ~ The hero's HP, the monster's HP and the hero's mana `elapsedSec` after the server's picture, read off the plan it sent (straight lines between the samples, the last sample held once the fight is over).
- [`playerRoute.ts`](../../src/lib/playerRoute.ts) — ~ The answer to a browser that belongs to an older data epoch (a tab left open across the new chapter flip):
- [`pushLock.ts`](../../src/lib/pushLock.ts) — ~ One upload at a time per browser.
- [`rebirthClient.ts`](../../src/lib/rebirthClient.ts) — ~ The player's rebirth history from the server, newest first; null when it could not be read (offline, signed out).
- [`rewardsClient.ts`](../../src/lib/rewardsClient.ts) — ~ `since`:
- [`rng.ts`](../../src/lib/rng.ts) — A random source:
- [`sanitizeSave.ts`](../../src/lib/sanitizeSave.ts) — ~ The part of the game state that is saved.
- [`saveEvents.ts`](../../src/lib/saveEvents.ts) — Tiny event bus for moments worth saving right away (a purchase, a castle upgrade, a rebirth, a level up).
- [`saveFormat.ts`](../../src/lib/saveFormat.ts) — ~ The save format:
- [`saveStorage.ts`](../../src/lib/saveStorage.ts) — ~ Where the game is kept:
- [`seenEpoch.ts`](../../src/lib/seenEpoch.ts) — ~ The epoch this browser last saw, or null when it never recorded one (a browser from before the guard, or a new one).
- [`serverRebirth.ts`](../../src/lib/serverRebirth.ts) — ~ The browser's side of the server-run rebirth (IDL-102, `POST /api/rebirth`).
- [`serverSession.ts`](../../src/lib/serverSession.ts) — A one-function bridge so the game store can say "the server wants an absence claimed first" without importing the code that claims
- [`skills.ts`](../../src/lib/skills.ts) — ~ HP a Heal restores:
- [`spawnLimits.ts`](../../src/lib/spawnLimits.ts) — ~ Tiles the ward keeps clear (the walled range around the castle, without the castle itself); 0 below the fortress level.
- [`startPlan.ts`](../../src/lib/startPlan.ts) — ~ Headline numbers of the account's cloud save (what GET /api/save sends next to the text).
- [`statBonuses.ts`](../../src/lib/statBonuses.ts) — ~ % more damage with physical weapons (swords, daggers, maces, mauls, axes, spears, bows, crossbows, bare hands).
- [`storageScope.ts`](../../src/lib/storageScope.ts) — Local development keeps its own browser storage: on localhost (any port, 127.0.0.1, [::1], *.localhost) every key this game writes

**src/lib/supabase/**

- [`admin.ts`](../../src/lib/supabase/admin.ts) — ~ The service-role client:
- [`server.ts`](../../src/lib/supabase/server.ts) — ~ Session cookies are for the server only:

**src/lib/**

- [`syncPolicy.ts`](../../src/lib/syncPolicy.ts) — ~ Browsers refuse a keepalive request body above 64 KiB (the fetch throws):
- [`terrainRenderer.ts`](../../src/lib/terrainRenderer.ts) — ~ Draws the map terrain one chunk at a time (CHUNK_TILES x CHUNK_TILES tiles per canvas; 1 canvas px = 1 art px = 1 world px, scaled by the world div's CSS transform, so pan and zoom never redraw).
- [`tipPlacement.ts`](../../src/lib/tipPlacement.ts) — Where a hover card goes: flush against the edge of the item box it belongs to, not under the cursor. Pure, so the
- [`uiPrefs.ts`](../../src/lib/uiPrefs.ts) — Remembered view options (not game state): plain booleans in localStorage, every access guarded
- [`utils.ts`](../../src/lib/utils.ts)

**src/stores/**

- [`craftStore.ts`](../../src/stores/craftStore.ts) — ~ One shared empty stock:

**src/stores/game/**

- [`base.ts`](../../src/stores/game/base.ts) — base.ts
- [`characterSlice.ts`](../../src/stores/game/characterSlice.ts) — characterSlice.ts
- [`chestSync.ts`](../../src/stores/game/chestSync.ts) — chestSync.ts
- [`clockSlice.ts`](../../src/stores/game/clockSlice.ts) — clockSlice.ts
- [`combatSlice.ts`](../../src/stores/game/combatSlice.ts) — combatSlice.ts
- [`combatSync.ts`](../../src/stores/game/combatSync.ts) — combatSync.ts
- [`economySlice.ts`](../../src/stores/game/economySlice.ts) — economySlice.ts
- [`farmSlice.ts`](../../src/stores/game/farmSlice.ts) — farmSlice.ts
- [`inventorySlice.ts`](../../src/stores/game/inventorySlice.ts) — inventorySlice.ts
- [`inventorySync.ts`](../../src/stores/game/inventorySync.ts) — inventorySync.ts
- [`mapSlice.ts`](../../src/stores/game/mapSlice.ts) — mapSlice.ts
- [`merchantSlice.ts`](../../src/stores/game/merchantSlice.ts) — merchantSlice.ts
- [`rebirthSlice.ts`](../../src/stores/game/rebirthSlice.ts) — rebirthSlice.ts

**src/stores/**

- [`gameStore.ts`](../../src/stores/gameStore.ts) — ~ The whole store:
- [`labStore.ts`](../../src/stores/labStore.ts) — ~ The map lab's world:
- [`rewardPendingStore.ts`](../../src/stores/rewardPendingStore.ts) — ~ How many rewards are on their way from the server (a chest being opened, a won fight whose result is not shown yet).
- [`settingsStore.ts`](../../src/stores/settingsStore.ts)
- [`uiStore.ts`](../../src/stores/uiStore.ts) — ~ Red entry for something destructive
- [`viewStore.ts`](../../src/stores/viewStore.ts) — ~ Where the map is on the screen (pan and zoom).
- [`windowStore.ts`](../../src/stores/windowStore.ts) — ~ The game's windows:

**src/types/**

- [`game.ts`](../../src/types/game.ts) — ~ One amount per stored resource; the keys come from the catalog (`stored:

**src/utils/**

- [`audioManager.ts`](../../src/utils/audioManager.ts) — Audio manager for handling game sound effects
- [`biomeRules.ts`](../../src/utils/biomeRules.ts) — ~ Whether a biome may turn up on one tile, and why not.
- [`cluster.ts`](../../src/utils/cluster.ts) — ~ The connected area of one biome around (x, y):
- [`formatters.ts`](../../src/utils/formatters.ts) — Suffixes for large numbers: thousand steps from K (the first at 10,000), then M, B, T, Qa, Qi, Sx; beyond that scientific

**src/utils/game/**

- [`castle.ts`](../../src/utils/game/castle.ts) — The castle's income bonus and upgrade time (part of the former utils/gameUtils.ts, split in IDL-15).
- [`character.ts`](../../src/utils/game/character.ts) — Attributes, the level curve, XP and the combat stats derived from the attributes (part of the former utils/gameUtils.ts, split in IDL-15).
- [`costs.ts`](../../src/utils/game/costs.ts) — What buying a tile or a building costs, and paying for it (part of the former utils/gameUtils.ts, split in IDL-15).
- [`farm.ts`](../../src/utils/game/farm.ts) — The farm: animal costs and output, pen and upgrades (part of the former utils/gameUtils.ts, split in IDL-15).
- [`income.ts`](../../src/utils/game/income.ts) — Income per second: what one tile produces, and the full breakdown and rates (part of the former utils/gameUtils.ts, split in IDL-15).
- [`merchant.ts`](../../src/utils/game/merchant.ts) — The merchant's upgrades, what selling pays and what buying costs (part of the former utils/gameUtils.ts, split in IDL-15).
- [`rebirth.ts`](../../src/utils/game/rebirth.ts) — Rebirth and the Ember shop: effects, costs, gain and the rebirth requirements (part of the former utils/gameUtils.ts, split in IDL-15).
- [`tiles.ts`](../../src/utils/game/tiles.ts) — Map-level counts and the new-game map (part of the former utils/gameUtils.ts, split in IDL-15).

**src/utils/**

- [`growWorld.ts`](../../src/utils/growWorld.ts) — ~ Seeded generator (mulberry32):
- [`terrain.ts`](../../src/utils/terrain.ts) — ~ Dual-grid terrain.
- [`water.ts`](../../src/utils/water.ts) — ~ Where the map's water ripples go:
- [`world.ts`](../../src/utils/world.ts) — ~ The map:
- [`worldGen.ts`](../../src/utils/worldGen.ts) — ~ A synthetic world for tests, benchmarks and the admin "+N tiles" button:

## scripts/


**scripts/assets/**

- [`manifest.ts`](../../scripts/assets/manifest.ts) — ~ used = live in the game now (enabled item, monster or resource; icon referenced by code); planned = its item/monster/resource exists but is disabled; retired = item no longer drops, old saves keep it; unused = registered art that nothing references (an icon no item uses, an icon no code mentions); placeholder = a stand-in silhouette; spare = generated art nobody asked for (`_name.png`); reuse = raw pack art, not wired.
- [`render.ts`](../../scripts/assets/render.ts) — Renders docs/assets/ (manifest.json, README.md and one page per category) from the manifest. Pure: same manifest in, same text out.
- [`sounds.ts`](../../scripts/assets/sounds.ts) — ~ The stable name to refer to this sound by

**scripts/**

- [`assets-catalog.ts`](../../scripts/assets-catalog.ts) — `npm run assets:catalog` writes docs/assets/; `--check` fails when the committed files differ (used by tests/docs/assets.test.ts and the pre-commit hook).
- [`balance-report.ts`](../../scripts/balance-report.ts) — Generates docs/generated/balance-tables.md from the REAL game config + utils, so the documentation can be regenerated after any tuning change.
- [`catalog-report.ts`](../../scripts/catalog-report.ts) — Writes docs/generated/item-catalog.md: the sets, their items and the drop pools, straight from src/catalog (never edit that file by hand).
- [`catalogDoc.ts`](../../scripts/catalogDoc.ts) — Renders docs/generated/item-catalog.md straight from src/catalog (never edit that file by hand): `npm run catalog-report` writes it and
- [`check-live-saves.ts`](../../scripts/check-live-saves.ts) — Dry run of today's save rules against the REAL rows (IDL-12), before a release that tightens them (the epoch reset IDL-76, the enforcement IDL-208).
- [`craft-sim.ts`](../../scripts/craft-sim.ts) — Craft simulator (first version): what each recipe costs against what it is worth, and how fast the crafting level moves.

**scripts/docs/**

- [`parse.ts`](../../scripts/docs/parse.ts) — Reads the JSDoc blocks that carry a `@category` tag out of the source files (the input of `npm run docs:code`).
- [`render.ts`](../../scripts/docs/render.ts) — Turns the parsed JSDoc entries into the files of docs/reference:
- [`structure.ts`](../../scripts/docs/structure.ts) — The shape of the generated reference:
- [`tableDefs.ts`](../../scripts/docs/tableDefs.ts) — The table definitions behind `@table <id>` (see tables.ts for the helpers and the registry).
- [`tables.ts`](../../scripts/docs/tables.ts) — Tables embedded in the reference with `@table <id>`.

**scripts/**

- [`docs-reference.ts`](../../scripts/docs-reference.ts) — Builds docs/reference from the JSDoc in the code (the single source of truth for how the game works).
- [`fight-sim.ts`](../../scripts/fight-sim.ts) — Fight balance table: loadouts x monsters, run through the server's own fight engine (src/lib/fightSim.ts -> src/lib/offline/fight.ts).
- [`kill-sim.ts`](../../scripts/kill-sim.ts) — Kill sim: how much of a player's income the monsters pay (docs/plan/20-monster-families-and-rewards.md sections 3 and 8, IDL-182).

**scripts/lib/**

- [`loadGame.ts`](../../scripts/lib/loadGame.ts) — The game's config and maths as one merged object each, for the scripts that read and override them by name (scripts/sim.ts).

**scripts/**

- [`liveSavesReport.ts`](../../scripts/liveSavesReport.ts) — The pure part of `scripts/check-live-saves.ts` (IDL-12):
- [`loot-sim.ts`](../../scripts/loot-sim.ts) — Loot simulator: seeded Monte Carlo over the real pipeline (src/lib/loot), per source and level. Use it to tune drop rates.
- [`monster-ladder.ts`](../../scripts/monster-ladder.ts) — Monster ladder: win rate of each gear tier against every monster at the levels it spawns at (docs/plan/ROADMAP.md, enemy rework).
- [`pacing-guard.ts`](../../scripts/pacing-guard.ts) — The pacing guard: fails (exit 1) when a key milestone of the sim moved by more than 15 % or more than 5 game days against a base. Prints a summary table first.
- [`pacingCompare.ts`](../../scripts/pacingCompare.ts) — The pure part of the pacing guard (scripts/pacing-guard.ts, tests/economy/pacingGuard.test.ts): compares two sim baselines
- [`perf-world.ts`](../../scripts/perf-world.ts) — How the game copes with a big map:
- [`perk-caps.ts`](../../scripts/perk-caps.ts) — Perk family cap sim (IDL-149): how the gear bucket of each family behaves against the set bonuses and a top legendary, for several cap candidates.
- [`reset-players.ts`](../../scripts/reset-players.ts) — Season restart:
- [`reset-test-account.ts`](../../scripts/reset-test-account.ts) — Clears the game data of the ONE account the end-to-end tests use (docs/reference/ops.md), so a test run starts from a new game.
- [`sim.ts`](../../scripts/sim.ts) — Headless balance simulation.
- [`spawnMix.ts`](../../scripts/spawnMix.ts) — What a hero of a given level meets on a castle level 1 map that owns all four biomes: the share of new spawns by the hero's chance to beat them,
- [`stat-audit.ts`](../../scripts/stat-audit.ts) — Writes docs/generated/stat-audit.md:

## e2e/


**e2e/**

- [`account.ts`](../../e2e/account.ts)
- [`smoke.spec.ts`](../../e2e/smoke.spec.ts) — Smoke test of the real game in a real browser (IDL-124). It runs against the Supabase project in .env.local with the ONE test account

## tests/


**tests/audit/**

- [`cheats.ts`](../../tests/audit/cheats.ts) — Cheating saves run through the real server pipeline (acceptSave) on an in-memory store: what does the server do with each?
- [`combat.test.ts`](../../tests/audit/combat.test.ts) — Stat audit, part 2: items, sets and combat numbers, one modifier at a time, against independent oracles.
- [`economy.test.ts`](../../tests/audit/economy.test.ts) — Stat audit, part 1: the economy under a strict environment.
- [`helpers.ts`](../../tests/audit/helpers.ts) — Stat audit helpers: a strict economy environment and independent oracles.
- [`perkCaps.test.ts`](../../tests/audit/perkCaps.test.ts) — Perk family caps (IDL-252): the gear bucket of income, XP, kill reward, click and damage is capped; client and server read the same capped number.
- [`server.test.ts`](../../tests/audit/server.test.ts) — Stat audit, part 3: what the server does with cheating saves.

**tests/**

- [`builders.ts`](../../tests/builders.ts) — Shared builders for the literals many tests used to copy: an in-memory ledger store and a monster standing near the castle.

**tests/catalog/**

- [`catalog.test.ts`](../../tests/catalog/catalog.test.ts)
- [`catalogDoc.test.ts`](../../tests/catalog/catalogDoc.test.ts)
- [`itemIcons.test.ts`](../../tests/catalog/itemIcons.test.ts) — ~ Files under public/pixel/items that are deliberately not registered:
- [`ladder.test.ts`](../../tests/catalog/ladder.test.ts)
- [`legacyGrades.test.ts`](../../tests/catalog/legacyGrades.test.ts)
- [`pixelIcons.test.ts`](../../tests/catalog/pixelIcons.test.ts) — ~ Width and height from a PNG's IHDR chunk
- [`resourceArt.test.ts`](../../tests/catalog/resourceArt.test.ts)

**tests/**

- [`checkLiveSaves.test.ts`](../../tests/checkLiveSaves.test.ts) — ~ What the database would hold after this player's save was accepted:

**tests/combat/**

- [`battleQueue.test.ts`](../../tests/combat/battleQueue.test.ts) — ~ A request at `t` seconds after the start.
- [`buffs.test.ts`](../../tests/combat/buffs.test.ts)
- [`clickLimiter.test.ts`](../../tests/combat/clickLimiter.test.ts)
- [`clientCombat.test.ts`](../../tests/combat/clientCombat.test.ts) — ~ The player's things as the server would hold them right now:
- [`combat.test.ts`](../../tests/combat/combat.test.ts)
- [`combatFloatText.test.ts`](../../tests/combat/combatFloatText.test.ts)
- [`curves.test.ts`](../../tests/combat/curves.test.ts) — ~ The three exponential stages written out from the config, kept here as the reference.
- [`defeatPause.test.ts`](../../tests/combat/defeatPause.test.ts) — ~ Runs second by second (the engine's own request limit) until `stop` says so or `maxSec` passed.
- [`effectiveStats.test.ts`](../../tests/combat/effectiveStats.test.ts)
- [`emberModel.test.ts`](../../tests/combat/emberModel.test.ts)
- [`fightBalance.test.ts`](../../tests/combat/fightBalance.test.ts) — ~ A full kit of one grade (a mace unless said otherwise), at the start of the grade window
- [`fightEngine.test.ts`](../../tests/combat/fightEngine.test.ts) — ~ Runs the clock forward `seconds` seconds, one request per `stepSec`, and returns the ledger and every event seen.
- [`fightPlan.test.ts`](../../tests/combat/fightPlan.test.ts)
- [`goldenFight.test.ts`](../../tests/combat/goldenFight.test.ts) — ~ Numbers are written to 6 decimals so a platform's last-bit noise cannot fail the comparison.
- [`leveling.test.ts`](../../tests/combat/leveling.test.ts)
- [`skills.test.ts`](../../tests/combat/skills.test.ts)
- [`spawnWeights.test.ts`](../../tests/combat/spawnWeights.test.ts) — ~ A hero nothing on the map can hurt:
- [`stats.test.ts`](../../tests/combat/stats.test.ts)
- [`useOp.test.ts`](../../tests/combat/useOp.test.ts)
- [`winChance.test.ts`](../../tests/combat/winChance.test.ts)
- [`xpModel.test.ts`](../../tests/combat/xpModel.test.ts) — ~ A summary of a character that bought `purchased` tiles and holds `xp`, `playSeconds` into the game.

**tests/crafting/**

- [`craftQueue.test.ts`](../../tests/crafting/craftQueue.test.ts)
- [`craftServer.test.ts`](../../tests/crafting/craftServer.test.ts) — ~ Queues `count` of a recipe at `at` seconds, waits until all of them are done and claims them.
- [`craftingOverlaySelectors.test.ts`](../../tests/crafting/craftingOverlaySelectors.test.ts)
- [`gearRecipes.test.ts`](../../tests/crafting/gearRecipes.test.ts) — ~ A state that has crafting level `level`
- [`recipes.test.ts`](../../tests/crafting/recipes.test.ts)

**tests/docs/**

- [`assets.test.ts`](../../tests/docs/assets.test.ts)
- [`links.test.ts`](../../tests/docs/links.test.ts)
- [`reference.test.ts`](../../tests/docs/reference.test.ts)

**tests/economy/**

- [`buildOnTile.test.ts`](../../tests/economy/buildOnTile.test.ts) — ~ The first explored non-castle tile, turned into `biome`.
- [`buildings.test.ts`](../../tests/economy/buildings.test.ts)
- [`castle.test.ts`](../../tests/economy/castle.test.ts) — ~ Pays for and waits out one castle upgrade with the real actions.
- [`castleFinder.test.ts`](../../tests/economy/castleFinder.test.ts) — ~ A view whose screen centre is the world point (wx, wy) in tiles.
- [`castleWard.test.ts`](../../tests/economy/castleWard.test.ts) — ~ Make all 8 tiles around the castle owned (growTo buys the nearest tiles, which is not always the full 3x3).
- [`costOrder.test.ts`](../../tests/economy/costOrder.test.ts)
- [`economy.test.ts`](../../tests/economy/economy.test.ts)
- [`farm.test.ts`](../../tests/economy/farm.test.ts)
- [`farmGeometry.test.ts`](../../tests/economy/farmGeometry.test.ts)
- [`gearEconomy.test.ts`](../../tests/economy/gearEconomy.test.ts) — ~ Puts gear on the character the way a loaded save does, with the rates that go with it.
- [`limitsAndSelling.test.ts`](../../tests/economy/limitsAndSelling.test.ts)
- [`merchantGoods.test.ts`](../../tests/economy/merchantGoods.test.ts)
- [`merchantShop.test.ts`](../../tests/economy/merchantShop.test.ts) — ~ What a plain item sells for at its first level (the shop's stock); consumables have their own price.
- [`merchantUpgrades.test.ts`](../../tests/economy/merchantUpgrades.test.ts)
- [`netWorth.test.ts`](../../tests/economy/netWorth.test.ts) — ~ An honest game:
- [`pacingGuard.test.ts`](../../tests/economy/pacingGuard.test.ts)
- [`rebirth.test.ts`](../../tests/economy/rebirth.test.ts) — ~ A run that has reached the rebirth line.
- [`startPlan.test.ts`](../../tests/economy/startPlan.test.ts)
- [`unbounded.test.ts`](../../tests/economy/unbounded.test.ts)

**tests/**

- [`helpers.ts`](../../tests/helpers.ts) — Test helpers: a store that never touches real storage, plus small builders.
- [`importCycles.test.ts`](../../tests/importCycles.test.ts) — ~ Strongly connected components with more than one file (Tarjan).

**tests/loot/**

- [`belt.test.ts`](../../tests/loot/belt.test.ts) — ~ A plain instance at a rarity the grade allows (plainItem is common, which the ladder's grades above G2 do not roll)
- [`biomePools.test.ts`](../../tests/loot/biomePools.test.ts) — ~ The data as it will be when every grade is live (IDL-238):
- [`chestRace.test.ts`](../../tests/loot/chestRace.test.ts) — ~ /api/chest answers only when `release` is called
- [`chests.test.ts`](../../tests/loot/chests.test.ts) — ~ A tiny territory:
- [`equipment.test.ts`](../../tests/loot/equipment.test.ts)
- [`inventory.test.ts`](../../tests/loot/inventory.test.ts)
- [`itemInstance.test.ts`](../../tests/loot/itemInstance.test.ts)
- [`items.test.ts`](../../tests/loot/items.test.ts) — ~ The weapons of the legacy families (some retired, some graded since IDL-243)
- [`loot.test.ts`](../../tests/loot/loot.test.ts)
- [`lootGenerate.test.ts`](../../tests/loot/lootGenerate.test.ts)
- [`lootValidate.test.ts`](../../tests/loot/lootValidate.test.ts)
- [`organizeBag.test.ts`](../../tests/loot/organizeBag.test.ts)
- [`reserveItems.test.ts`](../../tests/loot/reserveItems.test.ts) — ~ A reserve item is live when it is a base item of grade G1-G3; named ones (legendary folder) and G4+ stay disabled

**tests/monsters/**

- [`biomeSpawn.test.ts`](../../tests/monsters/biomeSpawn.test.ts) — ~ A 5x5 map with the given owned tiles around the centre (2,2):
- [`killReward.test.ts`](../../tests/monsters/killReward.test.ts)
- [`monsterCatalog.test.ts`](../../tests/monsters/monsterCatalog.test.ts)
- [`monsterConfig.test.ts`](../../tests/monsters/monsterConfig.test.ts)
- [`monsters.test.ts`](../../tests/monsters/monsters.test.ts)
- [`serverSpawns.test.ts`](../../tests/monsters/serverSpawns.test.ts)
- [`spawnLimits.test.ts`](../../tests/monsters/spawnLimits.test.ts)
- [`spawnPlacement.test.ts`](../../tests/monsters/spawnPlacement.test.ts)

**tests/saves/**

- [`auth.test.ts`](../../tests/saves/auth.test.ts)
- [`authClient.test.ts`](../../tests/saves/authClient.test.ts)
- [`cloudAdopt.test.ts`](../../tests/saves/cloudAdopt.test.ts)
- [`cloudConflict.test.ts`](../../tests/saves/cloudConflict.test.ts)
- [`cloudSave.test.ts`](../../tests/saves/cloudSave.test.ts) — ~ The same game with the castle at `level` and an upgrade to `level + 1` with `remaining` seconds left (null:
- [`epochGuard.test.ts`](../../tests/saves/epochGuard.test.ts) — ~ A fake browser:
- [`manualCloudSave.test.ts`](../../tests/saves/manualCloudSave.test.ts)
- [`saveEvents.test.ts`](../../tests/saves/saveEvents.test.ts)
- [`saveStorage.test.ts`](../../tests/saves/saveStorage.test.ts) — ~ A played game with buildings, a chest, gear and a monster, as a plain persisted slice.
- [`saveWorld.test.ts`](../../tests/saves/saveWorld.test.ts) — ~ The game with a synthetic map of `count` tiles that is valid for sanitizeSave (XP pays for it, stat points follow the level).
- [`saves.test.ts`](../../tests/saves/saves.test.ts) — ~ A plain JSON copy of a (valid) persisted game, as it would come out of a save file.
- [`storageScope.test.ts`](../../tests/saves/storageScope.test.ts)
- [`syncPolicy.test.ts`](../../tests/saves/syncPolicy.test.ts) — ~ A fake clock:

**tests/server/**

- [`clientInventory.test.ts`](../../tests/server/clientInventory.test.ts) — ~ A fetch whose answers the test gives, one request at a time.
- [`lifetimeStats.test.ts`](../../tests/server/lifetimeStats.test.ts)
- [`lootSecret.test.ts`](../../tests/server/lootSecret.test.ts)
- [`offline.test.ts`](../../tests/server/offline.test.ts) — ~ A bank whose land has plenty of tiles for monsters (a bank that has never looked at the land mints none).
- [`offlineClient.test.ts`](../../tests/server/offlineClient.test.ts) — ~ `n` chests the server has put on owned tiles (not the castle):
- [`offlineOnline.test.ts`](../../tests/server/offlineOnline.test.ts) — ~ A player who has been playing for `minutes` (so tickets have appeared), with the ledger seeded by the first save.
- [`offlineServer.test.ts`](../../tests/server/offlineServer.test.ts)
- [`serverBoundary.test.ts`](../../tests/server/serverBoundary.test.ts)
- [`serverInventory.test.ts`](../../tests/server/serverInventory.test.ts) — ~ A loot table that keeps a bad-luck counter (the only keys a save may hold in `lootPity`)
- [`serverRebirth.test.ts`](../../tests/server/serverRebirth.test.ts) — IDL-102: the server runs the rebirth. POST /api/rebirth judges the last stored save, computes the Embers, wipes the server's bag and gear once,
- [`serverTrust.test.ts`](../../tests/server/serverTrust.test.ts) — Server trust: enforcement (IDL-112), the trusted economy (IDL-167) and paid merchant levels (IDL-168).
- [`ticketBankUpgrade.test.ts`](../../tests/server/ticketBankUpgrade.test.ts)

**tests/**

- [`setBonus.ts`](../../tests/setBonus.ts) — ~ Runs `fn` with extra stats added to one set threshold, then puts the real bonus back.

**tests/ui/**

- [`headerFormat.test.ts`](../../tests/ui/headerFormat.test.ts)
- [`menuState.test.ts`](../../tests/ui/menuState.test.ts)
- [`tipPlacement.test.ts`](../../tests/ui/tipPlacement.test.ts)
- [`uiActions.test.ts`](../../tests/ui/uiActions.test.ts)

**tests/world/**

- [`ambient.test.ts`](../../tests/world/ambient.test.ts) — ~ A deterministic rng that walks through a fixed list of numbers.
- [`cluster.test.ts`](../../tests/world/cluster.test.ts)
- [`distance.test.ts`](../../tests/world/distance.test.ts)
- [`mapLab.test.ts`](../../tests/world/mapLab.test.ts)
- [`mapView.test.ts`](../../tests/world/mapView.test.ts)
- [`minimap.test.ts`](../../tests/world/minimap.test.ts) — ~ The castle with a straight row of plains to its east, x = CASTLE_X+1 ..
- [`terrain.test.ts`](../../tests/world/terrain.test.ts) — ~ Builds a tile grid from rows of letters (the parity fixture's names); '.' is not owned.
- [`terrainChunks.test.ts`](../../tests/world/terrainChunks.test.ts) — ~ Cells and sprites of a chunk computed from `g`, the way terrainRenderer / chunkSprites read them.
- [`water.test.ts`](../../tests/world/water.test.ts)
- [`world.test.ts`](../../tests/world/world.test.ts)

## supabase/


**supabase/migrations/**

- [`autosave_history_by_time.sql`](../../supabase/migrations/autosave_history_by_time.sql)
- [`combat_ledger.sql`](../../supabase/migrations/combat_ledger.sql)
- [`crafting_ledger.sql`](../../supabase/migrations/crafting_ledger.sql)
- [`inventory_ledger.sql`](../../supabase/migrations/inventory_ledger.sql)
- [`new_chapter_columns.sql`](../../supabase/migrations/new_chapter_columns.sql)
- [`new_chapter_columns_rollback.sql`](../../supabase/migrations/new_chapter_columns_rollback.sql)
- [`offline_ledger.sql`](../../supabase/migrations/offline_ledger.sql)
- [`player_ledger_buffs.sql`](../../supabase/migrations/player_ledger_buffs.sql)
- [`profiles_server_columns.sql`](../../supabase/migrations/profiles_server_columns.sql)
- [`rebirth_history.sql`](../../supabase/migrations/rebirth_history.sql)
- [`season_reset.sql`](../../supabase/migrations/season_reset.sql)

**supabase/**

- [`schema.sql`](../../supabase/schema.sql)
