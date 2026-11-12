import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useWindowStore } from '@/stores/windowStore';
import audioManager from '@/utils/audioManager';
import '@idlarz/design-system';
import PixelWindow from '../PixelWindow';
import PixelIcon from '../PixelIcon';
import CastleUpgradeDialog from '../CastleUpgradeDialog';
import HeroWindow from '../hero/HeroWindow';
import StatisticsOverlay from './StatisticsOverlay';
import MerchantOverlay from './Merchant/MerchantOverlay';
import FarmOverlay from './FarmOverlay';
import CraftingOverlay from './CraftingOverlay';
import AchievementsOverlay from './AchievementsOverlay';
import WindowErrorBoundary from '../WindowErrorBoundary';

/**
 * Every game window, each open or not on its own: Equipment, Character, Merchant, Farm and the castle upgrade. They sit side by side,
 * can be dragged and resized from the bottom right corner, and the one you click comes to the front (see PixelWindow, its design-system twin GameWindow, and the window store). Windows move from PixelWindow to GameWindow one at a time as their new look is wired in (IDL-324). A closed window is not mounted, so
 * the farm scene measures its real body and its critters only roam while the Farm is open.
 */
const GameWindows: React.FC = () => {
	const open = useWindowStore((state) => state.order);
	const level = useGameStore((state) => state.level.level);

	// The level-up fanfare belongs to the game, not to one window: it plays whichever windows are open (or none)
	const prevLevel = useRef(level);
	useEffect(() => {
		if (level > prevLevel.current) audioManager.playSound('fanfare');
		prevLevel.current = level;
	}, [level]);

	return (
		<>
			{open.includes('equipment') && (
				<WindowErrorBoundary name='Hero'>
					<HeroWindow />
				</WindowErrorBoundary>
			)}
			{open.includes('character') && (
				<PixelWindow id='character' title='Character' icon={<PixelIcon name='menu_stats' alt='' />} width={1180}>
					<WindowErrorBoundary name='Character'>
						<StatisticsOverlay />
					</WindowErrorBoundary>
				</PixelWindow>
			)}
			{open.includes('merchant') && (
				<PixelWindow id='merchant' title='Merchant' icon={<PixelIcon name='menu_merchant' alt='' />} width={980} height={720}>
					<WindowErrorBoundary name='Merchant'>
						<MerchantOverlay />
					</WindowErrorBoundary>
				</PixelWindow>
			)}
			{open.includes('farm') && (
				<PixelWindow id='farm' title='Farm' icon={<PixelIcon name='menu_farm' alt='' />} width={1120} height={760} flush>
					<WindowErrorBoundary name='Farm'>
						<FarmOverlay />
					</WindowErrorBoundary>
				</PixelWindow>
			)}
			{open.includes('crafting') && (
				<PixelWindow id='crafting' title='Crafting' icon={<PixelIcon name='menu_crafting' alt='' />} width={860} height={560}>
					<WindowErrorBoundary name='Crafting'>
						<CraftingOverlay />
					</WindowErrorBoundary>
				</PixelWindow>
			)}
			{open.includes('achievements') && (
				<PixelWindow id='achievements' title='Achievements' icon={<PixelIcon name='menu_achievements' alt='' scale={0.5} />} width={560} height={620}>
					<WindowErrorBoundary name='Achievements'>
						<AchievementsOverlay />
					</WindowErrorBoundary>
				</PixelWindow>
			)}
			{open.includes('castle') && <CastleUpgradeDialog />}
		</>
	);
};

export default GameWindows;
