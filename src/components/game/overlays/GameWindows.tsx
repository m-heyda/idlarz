import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useWindowStore } from '@/stores/windowStore';
import audioManager from '@/utils/audioManager';
import PixelWindow from '../PixelWindow';
import PixelIcon from '../PixelIcon';
import CastleUpgradeDialog from '../CastleUpgradeDialog';
import CharacterOverlay from './CharacterOverlay';
import StatisticsOverlay from './StatisticsOverlay';
import MerchantOverlay from './Merchant/MerchantOverlay';
import FarmOverlay from './FarmOverlay';
import CraftingOverlay from './CraftingOverlay';

/**
 * Every game window, each open or not on its own: Equipment, Character, Merchant, Farm and the castle upgrade. They sit side by side,
 * can be dragged and resized from the bottom right corner, and the one you click comes to the front (see PixelWindow and the window store). A closed window is not mounted, so
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
				<PixelWindow id='equipment' title='Equipment' icon={<PixelIcon name='menu_character' alt='' />} width={1040} height={720}>
					<CharacterOverlay />
				</PixelWindow>
			)}
			{open.includes('character') && (
				<PixelWindow id='character' title='Character' icon={<PixelIcon name='menu_stats' alt='' />} width={1180}>
					<StatisticsOverlay />
				</PixelWindow>
			)}
			{open.includes('merchant') && (
				<PixelWindow id='merchant' title='Merchant' icon={<PixelIcon name='menu_merchant' alt='' />} width={980} height={720}>
					<MerchantOverlay />
				</PixelWindow>
			)}
			{open.includes('farm') && (
				<PixelWindow id='farm' title='Farm' icon={<PixelIcon name='menu_farm' alt='' />} width={1120} height={760} flush>
					<FarmOverlay />
				</PixelWindow>
			)}
			{open.includes('crafting') && (
				<PixelWindow id='crafting' title='Crafting' icon={<PixelIcon name='menu_crafting' alt='' />} width={860} height={560}>
					<CraftingOverlay />
				</PixelWindow>
			)}
			{open.includes('castle') && <CastleUpgradeDialog />}
		</>
	);
};

export default GameWindows;
