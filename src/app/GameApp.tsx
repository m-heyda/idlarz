'use client';
/**
 * Conventions that hold for the whole code base.
 *
 * - Rates are per second and before modifiers unless stated; modifiers are fractions (0.25 = +25 %).
 * - Anything that moves resources is validated in the store action and covered in `tests/economy/economy.test.ts`; anything that is saved is validated in `src/lib/sanitizeSave.ts` ({@link sanitizeSave});
 *   anything that decides a reward or a fight lives on the server side (`src/lib/offline/`).
 * - **Documentation lives in the JSDoc next to the code** (this reference is generated from it, see the README of this folder). When the code changes, change its block in the same edit; a pre-commit hook regenerates `docs/reference`.
 *   `docs/plan/` holds the plans for what is not built; a built draft leaves `plan/` and is described here, in the JSDoc.
 * - Config is data, maths is pure functions. Tutorial, stat tooltips and cost lists are generated from config constants so they cannot drift from the rules.
 * - Reports measured from the game (`docs/generated/*`, written by `npm run docs:gen`) are never edited by hand; prefer a link to them over copying numbers into prose, and prefer `@table` over numbers typed into JSDoc.
 *
 * @title Conventions
 * @category Overview/The game
 * @order 2
 */
/**
 * Idle Realm (code name idlarz) is an idle/incremental map game for signed-in players. Everything here describes **only what the code does now**, with the symbol each number comes from.
 *
 * **The loop of the game**
 *
 * 1. You start with a castle and the four tiles beside it on an unbounded map, 125 gold and 1,000 gems. Gold, other resources and XP trickle in ({@link BASE_GENERATION_RATES}).
 * 2. Gold (plus wood, stone, coal, food and hide from tile 15 up) buys adjacent tiles ({@link tilePrice}); each becomes a randomly rolled biome ({@link rollBiome}) and adds income. Buildings stand on tiles and add output. Same-biome neighbours add 25% each.
 * 3. The **castle** is a timed upgrade (level 1-10) that adds a big modifier to every resource, a range bonus on nearby tiles, and a ward from level 7 that keeps monsters out ({@link CASTLE_UPGRADE}).
 * 4. The **farm** turns food into animals that make meat and small amounts of eggs, milk and hide ({@link ANIMALS}). The **merchant** buys resources, sells gear and potions, and sells permanent upgrades for gold ({@link MERCHANT_UPGRADES}).
 * 5. **Clicks** on the map and **chests** add active gold ({@link clickGold}, {@link CHEST}). Every level gives attribute points (Strength, Dexterity, Intelligence, Vitality, Charisma) that add income, combat strength, Luck and a tile discount ({@link CHARACTER_STAT_CONFIG}).
 * 6. **Monsters** appear on owned land ({@link advanceBank}). You click one and the server runs the fight ({@link runCombat}); wins pay gold, XP, hide and gear ({@link killIncome}, {@link generateLoot}). Gear comes only from fights, chests and the merchant's shelf.
 * 7. **Rebirth** (castle 6 and 400+ tiles) restarts the map for Embers: a permanent income bonus and a shop ({@link REBIRTH}). Level, XP, Embers and shop levels stay; map, gear and merchant upgrades (except Pack Rat) do not.
 *
 * **Time scale.** Timers that set the pace: castle upgrades 30 min to 3.5 days per level; a monster every 15 minutes and a boss every 3 hours (`COMBAT.spawn`); a chest every 10 minutes (`CHEST.intervalSec`); away time paid up to 8 hours at 50% (`LIMITS`).
 * Measured pacing from the bot simulation is in `docs/generated/sim-milestones.md`; targets are on the Pacing page.
 *
 * **Where the numbers live.** Config is data (`src/config/*`, `src/catalog/*`), maths is pure functions next to it (`src/utils/game/*`, `src/lib/*`), the server engine is `src/lib/offline/*` + `src/app/api/*`. This reference points at all of them; the generated
 * [code-map.md](code-map.md) lists every file with its first comment.
 *
 * **Not in the game yet**: hills, coast and lake monsters; jungle, fields, orchard, blight and battlefield biomes (dev-only entries); the Producer/Extractor/Idol building rework; quests; gambling; achievements, glossary and mastery;
 * real class bonuses; paragon levels; rankings and the preview map; landing page and `/play` route; the guided tutorial rework; gem sinks. Details: `docs/plan/ROADMAP.md`. Crafting (queue, recipes) exists but is still a first draft: `docs/plan/crafting-v0.md`.
 *
 * @title The game at a glance
 * @category Overview/The game
 * @order 1
 * @table stack-versions
 */

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import Grid from '@/components/game/Grid';
import GameWindows from '@/components/game/overlays/GameWindows';
import { useWindowStore } from '@/stores/windowStore';
import LevelUpNotification from '@/components/game/overlays/LevelUpNotification';
import LoadingScreen from '@/components/game/overlays/LoadingScreen';
import GameDebug from '@/components/game/GameDebug';
import { TICK_RATE } from '@/config/economy';
import GameHeader from '@/components/game/GameHeader';
import ChestNotification from '@/components/game/overlays/ChestNotification';
import FloatingText from '@/components/game/FloatingText';
import ClassPickerDialog from '@/components/game/ClassPickerDialog';
import SaveMenuDialog from '@/components/game/overlays/SaveMenuDialog';
import SettingsDialog from '@/components/game/overlays/SettingsDialog';
import RebirthDialog from '@/components/game/overlays/RebirthDialog';
import TutorialDialog from '@/components/game/overlays/TutorialDialog';
import { useSettingsStore } from '@/stores/settingsStore';
import TabLockOverlay from '@/components/game/overlays/TabLockOverlay';
import { useSingleTab } from '@/hooks/useSingleTab';
import { useCtrlSequence } from '@/hooks/useCtrlSequence';
import { useUiStore } from '@/stores/uiStore';
import { useGlobalContextMenu } from '@/hooks/useGlobalContextMenu';
import ContextMenu from '@/components/game/ContextMenu';
import BuildDialog from '@/components/game/BuildDialog';
import ConfirmDialogs from '@/components/game/ConfirmDialogs';
import BottomRightStack from '@/components/game/BottomRightStack';
import CastleCompass from '@/components/game/CastleCompass';
import Toast from '@/components/game/Toast';
import type { Profile } from '@/lib/authClient';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useOfflineClaim } from '@/hooks/useOfflineClaim';
import { useSpawnSync } from '@/hooks/useSpawnSync';
import OfflineDialog from '@/components/game/overlays/OfflineDialog';

interface GameAppProps {
	/** The account's name and hero, given to a brand-new game only (never to one that has been played). */
	profile: Profile;
	/** The signed-in account whose cloud save follows this game (the game is played with an account only). */
	userId: string;
}

/**
 * The tick loop. `GameApp` runs `setInterval(..., 100 ms)` **only** in the owning tab (one tab owns the game through a Web Lock, `useSingleTab`) and only after the save is loaded and the offline claim is done.
 * Each interval computes `deltaTime = performance.now() - last` (monotonic) and calls `store.tick(deltaTime)`; `tick` clamps the delta to `0 ... MAX_CATCHUP_SEC` (300 s), so a throttled background tab catches up in 5-minute steps
 * but a changed system clock can neither skip nor reverse time. Offline progress is not computed here: a player's absence is claimed from the server before the loop starts ({@link computeOfflineGrant}).
 *
 * `tick` order: accumulate resources -> XP (with `xpGainMultiplier`) -> castle upgrade timer (finishing recomputes the rates) -> age the monsters on the map (`advanceMonsters`; the server places them) -> HP / mana regeneration and cooldowns
 * (in a fight the server's HP is left alone) -> merchant stock rotation -> level / stat points -> one `set()`. **The tick does not spawn chests or monsters and does not run fights.**
 *
 * `useSpawnSync` polls `/api/spawn` (it waits until the next ticket is due, 20 to 600 s; an open fight is polled once, when the plan it was sent says it ends (a fight the server could not plan: every 2 s, a minimized one every 8 s), and the boss timer and the bars run on the browser between answers; a fight action also triggers an immediate sync): the server answers with the chests and monsters
 * that have appeared (`applyServerTickets` -> `reconcileMap` places them on the map), the gem balance and the combat view (HP, mana, cooldowns, the open fight). A click on a monster calls `startFight`, which asks `/api/fight` to open the fight;
 * from then on the server swings both ways in fixed ticks, with or without the browser.
 *
 * **Clicks.** `useClickIncome` (called by `GameHeader`) registers one window `click` listener. A click counts only if it is trusted and lands inside `[data-click-area]` (the map). It calls `clickForGold`, which asks the limiter ({@link createClickLimiter})
 * with the event's `timeStamp` as id, so one physical click costs one token. Nothing hits a monster by clicking: a click on a monster only opens the fight.
 *
 * **Persistence.** `persist` + `saveStorage`: state objects are kept as-is in memory and encoded to one line of text only when written (debounced 2 s, and synchronously on `pagehide`). On start the storage reads `current` (or `backup`, or the old IndexedDB vault once),
 * decodes and validates it with `sanitizeSave`, `merge` rebuilds rates and sets `isHydrated`; `onRehydrateStorage` then enables writing. The initial in-memory world is a fixed placeholder (so the server render and the first client render match);
 * a player without a save gets a random start in `merge`. The browser copy is a cache and the export path; the account holds the verified copy.
 *
 * @title The tick loop and persistence
 * @category Architecture/The loop
 * @order 1
 * @see computeOfflineGrant, SAVE_SCHEMA
 */
export default function GameApp({ profile, userId }: GameAppProps) {
	const tick = useGameStore((state) => state.tick);
	const isHydrated = useGameStore((state) => state.isHydrated);
	const { status: tabStatus, takeOver } = useSingleTab();
	const toggleSaveMenu = useUiStore((state) => state.toggleSaveMenu);
	const loadSettings = useSettingsStore((state) => state.load);
	useEffect(() => loadSettings(), [loadSettings]);
	const loadPrefs = useUiStore((state) => state.loadPrefs);
	useEffect(() => loadPrefs(), [loadPrefs]);
	const loadWindowPositions = useWindowStore((state) => state.loadPositions);
	useEffect(() => loadWindowPositions(), [loadWindowPositions]);
	// no browser menu anywhere: the right click belongs to the game (tiles and bag slots add their own entries)
	useGlobalContextMenu();
	// Hidden shortcut: Control x5 within 2.5 s opens the save tools (export / import / reset)
	useCtrlSequence(5, 2500, toggleSaveMenu);
	// Chest rewards queue in the ui store (one notice per chest, each with its own timer)
	const chestNotices = useUiStore((state) => state.chestNotices);
	const dismissChestNotice = useUiStore((state) => state.dismissChestNotice);
	// Monotonic clock: changing the system clock must not change game speed
	const lastTickTime = useRef(performance.now());

	// What the absence was worth is claimed before the game starts running and before the first upload (the claim changes the game)
	const claim = useOfflineClaim(userId, isHydrated && tabStatus === 'owner');
	useCloudSync(userId, isHydrated && tabStatus === 'owner' && claim === 'done');
	// ... and from then on the server says when a chest or a monster appears (and what is in it), and runs the fights
	useSpawnSync(userId, isHydrated && tabStatus === 'owner' && claim === 'done');
	const applyProfileToFreshGame = useGameStore((state) => state.applyProfileToFreshGame);
	useEffect(() => {
		// Before the first tick: a brand-new game becomes the account's character (a played game is never touched)
		if (!isHydrated || tabStatus !== 'owner') return;
		applyProfileToFreshGame(profile.characterName, profile.playerClass);
	}, [profile, isHydrated, tabStatus, applyProfileToFreshGame]);

	useEffect(() => {
		// Only the owning tab runs the game, and only once the saved game has been loaded
		if (!isHydrated || tabStatus !== 'owner' || claim !== 'done') return;
		lastTickTime.current = performance.now();
		const gameLoop = () => {
			const currentTime = performance.now();
			const deltaTime = currentTime - lastTickTime.current;
			lastTickTime.current = currentTime;

			tick(deltaTime);
		};

		const interval = setInterval(gameLoop, TICK_RATE);
		return () => clearInterval(interval);
	}, [tick, isHydrated, tabStatus, claim]);

	return (
		<main className='h-screen w-screen overflow-hidden relative'>
			{/* z-50 puts the header above the window backdrop (z-45): resources stay visible and the Menu button toggles */}
			<div className='fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-sm'>
				<GameHeader />
			</div>
			<Grid />
			<FloatingText />
			<GameWindows />
			<ClassPickerDialog />
			<LevelUpNotification />
			<LoadingScreen />
			<GameDebug />
			<SaveMenuDialog />
			<SettingsDialog />
			<RebirthDialog />
			<OfflineDialog />
			<TutorialDialog />
			<BuildDialog />
			<ConfirmDialogs />
			<BottomRightStack />
			<CastleCompass />
			<ContextMenu />
			{tabStatus === 'blocked' && <TabLockOverlay onTakeOver={takeOver} />}
			{/* one stack for every notice: chest rewards, fight loot, and the short messages (merchant, bag, saves) */}
			<div className='notice-stack'>
				{chestNotices.map((notice) => (
					<ChestNotification key={notice.id} loot={notice.loot} onClose={() => dismissChestNotice(notice.id)} />
				))}
				<Toast />
			</div>
		</main>
	);
}
