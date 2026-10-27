'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import Grid from '@/components/game/Grid';
import MenuOverlay from '@/components/game/overlays/MenuOverlay';
import FightModal from '@/components/game/overlays/FightModal';
import VictoryToast from '@/components/game/overlays/VictoryToast';
import LevelUpNotification from '@/components/game/overlays/LevelUpNotification';
import LoadingScreen from '@/components/game/overlays/LoadingScreen';
import NamePrompt from '@/components/game/overlays/NamePrompt';
import GameDebug from '@/components/game/GameDebug';
import { TICK_RATE } from '@/config/gameConfig';
import GameHeader from '@/components/game/GameHeader';
import ChestNotification from '@/components/game/overlays/ChestNotification';
import FloatingText from '@/components/game/FloatingText';
import ClassPickerDialog from '@/components/game/ClassPickerDialog';
import SaveMenuDialog from '@/components/game/overlays/SaveMenuDialog';
import SettingsDialog from '@/components/game/overlays/SettingsDialog';
import LegacyDialog from '@/components/game/overlays/LegacyDialog';
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

interface GameAppProps {
	/** The account's name and hero, given to a brand-new game only (never to one that has been played). */
	profile: Profile | null;
	/** The signed-in account whose cloud save follows this game (null: play without an account, nothing is synced). */
	userId: string | null;
}

export default function GameApp({ profile, userId }: GameAppProps) {
	const tick = useGameStore((state) => state.tick);
	const isHydrated = useGameStore((state) => state.isHydrated);
	const { status: tabStatus, takeOver } = useSingleTab();
	const toggleSaveMenu = useUiStore((state) => state.toggleSaveMenu);
	const loadSettings = useSettingsStore((state) => state.load);
	useEffect(() => loadSettings(), [loadSettings]);
	const loadPrefs = useUiStore((state) => state.loadPrefs);
	useEffect(() => loadPrefs(), [loadPrefs]);
	// no browser menu anywhere: the right click belongs to the game (tiles and bag slots add their own entries)
	useGlobalContextMenu();
	// Hidden shortcut: Control x5 within 2.5 s opens the save tools (export / import / reset)
	useCtrlSequence(5, 2500, toggleSaveMenu);
	const lastChestLoot = useGameStore((state) => state.lastChestLoot);
	// Monotonic clock: changing the system clock must not change game speed
	const lastTickTime = useRef(performance.now());
	const [showChestNotification, setShowChestNotification] = useState(false);
	const shownLootRef = useRef<typeof lastChestLoot>(null);

	useCloudSync(userId, isHydrated && tabStatus === 'owner');
	const applyProfileToFreshGame = useGameStore((state) => state.applyProfileToFreshGame);
	useEffect(() => {
		// Before the first tick: a brand-new game becomes the account's character (a played game is never touched)
		if (!profile || !isHydrated || tabStatus !== 'owner') return;
		applyProfileToFreshGame(profile.characterName, profile.playerClass);
	}, [profile, isHydrated, tabStatus, applyProfileToFreshGame]);

	useEffect(() => {
		// Only the owning tab runs the game, and only once the saved game has been loaded
		if (!isHydrated || tabStatus !== 'owner') return;
		lastTickTime.current = performance.now();
		const gameLoop = () => {
			const currentTime = performance.now();
			const deltaTime = currentTime - lastTickTime.current;
			lastTickTime.current = currentTime;

			tick(deltaTime);
		};

		const interval = setInterval(gameLoop, TICK_RATE);
		return () => clearInterval(interval);
	}, [tick, isHydrated, tabStatus]);

	useEffect(() => {
		// A new chest result (a fresh object every time one is opened) shows the toast for 3 seconds
		if (!lastChestLoot || lastChestLoot === shownLootRef.current) return;
		shownLootRef.current = lastChestLoot;
		setShowChestNotification(true);
		const timer = setTimeout(() => setShowChestNotification(false), 3000);
		return () => clearTimeout(timer);
	}, [lastChestLoot]);

	return (
		<main className='h-screen w-screen overflow-hidden relative'>
			{/* z-50 puts the header above the window backdrop (z-45): resources stay visible and the Menu button toggles */}
			<div className='fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-sm'>
				<GameHeader />
			</div>
			<Grid />
			<FloatingText />
			<MenuOverlay />
			<FightModal />
			<VictoryToast />
			<ClassPickerDialog />
			<LevelUpNotification />
			<LoadingScreen />
			{/* with an account the name comes from the profile; the old prompt is only for play without one */}
				{!profile && <NamePrompt />}
			<GameDebug />
			<SaveMenuDialog />
			<SettingsDialog />
			<LegacyDialog />
			<TutorialDialog />
			<BuildDialog />
			<ConfirmDialogs />
			<BottomRightStack />
			<CastleCompass />
			<ContextMenu />
			<Toast />
			{tabStatus === 'blocked' && <TabLockOverlay onTakeOver={takeOver} />}
			<ChestNotification loot={lastChestLoot} show={showChestNotification} onClose={() => setShowChestNotification(false)} />
		</main>
	);
}
