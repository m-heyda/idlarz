import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore, type MenuTab } from '@/stores/uiStore';
import { useMenuAttention } from '@/hooks/useMenuAttention';
import audioManager from '@/utils/audioManager';
import PixelModal from '../PixelModal';
import PixelIcon from '../PixelIcon';
import PixelTabs, { type PixelTabItem } from '../PixelTabs';
import CharacterOverlay from './CharacterOverlay';
import StatisticsOverlay from './StatisticsOverlay';
import MerchantOverlay from './Merchant/MerchantOverlay';
import FarmOverlay from './FarmOverlay';

/**
 * The main menu: one window with a tab per area (Character, Stats, Merchant, Farm). Only the active tab is mounted,
 * so the farm scene measures its real body and its critters only roam while you look at it.
 */
const MenuOverlay: React.FC = () => {
	const open = useUiStore((state) => state.menuOpen);
	const tab = useUiStore((state) => state.menuTab);
	const setMenuTab = useUiStore((state) => state.setMenuTab);
	const closeMenu = useUiStore((state) => state.closeMenu);
	const attention = useMenuAttention();
	const level = useGameStore((state) => state.level.level);

	// The level-up fanfare belongs to the game, not to one tab: it plays whichever tab is open (or none)
	const prevLevel = useRef(level);
	useEffect(() => {
		if (level > prevLevel.current) audioManager.playSound('fanfare');
		prevLevel.current = level;
	}, [level]);

	if (!open) return null;

	const tabs: PixelTabItem<MenuTab>[] = [
		{ id: 'character', label: 'Character', icon: 'menu_character' },
		{
			id: 'stats',
			label: 'Stats',
			icon: 'menu_stats',
			notify: attention.stats,
			notifyLabel: 'Unassigned stat points',
		},
		{ id: 'merchant', label: 'Merchant', icon: 'menu_merchant' },
		{
			id: 'farm',
			label: 'Farm',
			icon: 'menu_farm',
			notify: attention.farm,
			notifyLabel: 'An animal or upgrade is affordable',
		},
	];
	const current = tabs.find((t) => t.id === tab) ?? tabs[0];

	return (
		<PixelModal
			title={current.label}
			icon={<PixelIcon name={current.icon} alt='' />}
			size='lg'
			flush={tab === 'farm'}
			onClose={closeMenu}
			tabs={<PixelTabs tabs={tabs} active={current.id} onSelect={setMenuTab} />}>
			{current.id === 'character' && <CharacterOverlay />}
			{current.id === 'stats' && <StatisticsOverlay />}
			{current.id === 'merchant' && <MerchantOverlay />}
			{current.id === 'farm' && <FarmOverlay />}
		</PixelModal>
	);
};

export default MenuOverlay;
