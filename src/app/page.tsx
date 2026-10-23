'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import Grid from '@/components/game/Grid';
import CharacterOverlay from '@/components/game/overlays/CharacterOverlay';
import FightModal from '@/components/game/overlays/FightModal';
import StatisticsOverlay from '@/components/game/overlays/StatisticsOverlay';
import LevelUpNotification from '@/components/game/overlays/LevelUpNotification';
import LoadingScreen from '@/components/game/overlays/LoadingScreen';
import NamePrompt from '@/components/game/overlays/NamePrompt';
import GameDebug from '@/components/game/GameDebug';
import { TICK_RATE } from '@/config/gameConfig';
import { calculateTileCost, effectiveTileDiscount } from '@/utils/gameUtils';
import MerchantOverlay from '@/components/game/overlays/Merchant/MerchantOverlay';
import FarmOverlay from '@/components/game/overlays/FarmOverlay';
import GameHeader from '@/components/game/GameHeader';
import BiomeSelectionDialog from '@/components/game/BiomeSelectionDialog';
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

export default function Home() {
	const tick = useGameStore((state) => state.tick);
	const isHydrated = useGameStore((state) => state.isHydrated);
	const { status: tabStatus, takeOver } = useSingleTab();
	const toggleSaveMenu = useUiStore((state) => state.toggleSaveMenu);
	const loadSettings = useSettingsStore((state) => state.load);
	useEffect(() => loadSettings(), [loadSettings]);
	// Hidden shortcut: Control x5 within 2.5 s opens the save tools (export / import / reset)
	useCtrlSequence(5, 2500, toggleSaveMenu);
	const lastChestReward = useGameStore((state) => state.lastChestReward);
	const lastChestGoldRate = useGameStore((state) => state.lastChestGoldRate);
	const lastChestMinutesAwarded = useGameStore((state) => state.lastChestMinutesAwarded);
	// Monotonic clock: changing the system clock must not change game speed
	const lastTickTime = useRef(performance.now());
	const [showChestNotification, setShowChestNotification] = useState(false);
	const [chestRewardAmount, setChestRewardAmount] = useState(0);
	const [minutesAwarded, setMinutesAwarded] = useState(0);
	const [goldPerSecond, setGoldPerSecond] = useState(0);
	const prevLastChestRewardRef = useRef(0);

	const biomeSelectionActive = useGameStore((state) => state.biomeSelectionActive);
	const selectableBiomes = useGameStore((state) => state.selectableBiomes);
	const selectBiome = useGameStore((state) => state.selectBiome);
	const cancelBiomeSelection = useGameStore((state) => state.cancelBiomeSelection);
	const pendingTileCoords = useGameStore((state) => state.pendingTileCoords);
	const characterStats = useGameStore((state) => state.characterStats);
	const prestige = useGameStore((state) => state.prestige);
	const tiles = useGameStore((state) => state.tiles);
	const [clickPosition, setClickPosition] = React.useState<{x: number, y: number} | undefined>(undefined);
	
	const tileCost = calculateTileCost(
		tiles.flat().filter((tile) => tile.isOwned).length,
		effectiveTileDiscount(characterStats, prestige)
	);

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
		if (biomeSelectionActive && pendingTileCoords) {
			// Get the tile element by its coordinates
			const tileElement = document.getElementById(`tile-${pendingTileCoords.x}-${pendingTileCoords.y}`);
			if (tileElement) {
				const rect = tileElement.getBoundingClientRect();
				setClickPosition({
					x: rect.left + rect.width / 2,
					y: rect.top
				});
			}
		} else {
			setClickPosition(undefined);
		}
	}, [biomeSelectionActive, pendingTileCoords]);

	useEffect(() => {
		// Only proceed if there's a real change (not just initial value)
		// and if the reward is greater than zero
		if (lastChestReward > 0 && lastChestReward !== prevLastChestRewardRef.current) {
			// Update the notification values
			setChestRewardAmount(lastChestReward);
			setGoldPerSecond(lastChestGoldRate);
			setMinutesAwarded(lastChestMinutesAwarded);
			
			// Show the notification
			setShowChestNotification(true);
			
			// Store the current value for future comparison
			prevLastChestRewardRef.current = lastChestReward;
			
			// Auto-hide after 3 seconds
			const timer = setTimeout(() => {
				setShowChestNotification(false);
			}, 3000);
			
			return () => clearTimeout(timer);
		}
	}, [lastChestReward, lastChestGoldRate, lastChestMinutesAwarded]);

	return (
		<main className='h-screen w-screen overflow-hidden relative'>
			<div className='fixed top-0 left-0 right-0 z-10 bg-gray-900/80 backdrop-blur-sm'>
				<GameHeader />
			</div>
			<Grid />
			<FloatingText />
			<CharacterOverlay />
			<FightModal />
			<StatisticsOverlay />
			<MerchantOverlay />
			<FarmOverlay />
			<ClassPickerDialog />
			<LevelUpNotification />
			<LoadingScreen />
			<NamePrompt />
			<GameDebug />
			<SaveMenuDialog />
			<SettingsDialog />
			<LegacyDialog />
			<TutorialDialog />
			{tabStatus === 'blocked' && <TabLockOverlay onTakeOver={takeOver} />}
			<ChestNotification 
				show={showChestNotification} 
				amount={chestRewardAmount} 
				goldPerSecond={goldPerSecond}
				minutesAwarded={minutesAwarded}
				onClose={() => setShowChestNotification(false)}
			/>
			{/* Biome Selection Dialog */}
			{biomeSelectionActive && selectableBiomes && (
				<BiomeSelectionDialog
					availableBiomes={selectableBiomes}
					onSelect={selectBiome}
					onCancel={cancelBiomeSelection}
					cost={tileCost}
					position={clickPosition}
				/>
			)}
		</main>
	);
}
