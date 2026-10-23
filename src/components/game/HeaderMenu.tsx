import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import { ANIMALS, BASE_XP_PER_LEVEL, XP_GROWTH_FACTOR } from '@/config/gameConfig';
import { calculateAnimalCost } from '@/utils/gameUtils';
import PixelIcon from './PixelIcon';
import type { PixelIconName } from '@/config/pixelIcons';
import LevelOrb from './LevelOrb';
import NotifyDot from './NotifyDot';
import CharacterPortrait from './CharacterPortrait';
import EditableName from './EditableName';
import { useUiStore } from '@/stores/uiStore';
import { REBIRTH } from '@/config/gameConfig';
import { GRID_CENTER_X, GRID_CENTER_Y } from '@/config/gameConfig';

// Inner width of the XP frame sprite (72px wide, 3px border each side)
const XP_BAR_INNER_PX = 66;

const HeaderMenu: React.FC = () => {
	const {
		resources,
		level,
		toggleCharacterWindow,
		toggleStatisticsWindow,
		toggleMerchantWindow,
		showMerchantWindow,
		showStatisticsWindow,
		showCharacterWindow,
		showFarmWindow,
		toggleFarmWindow,
		characterStats,
		farmLevels,
	} = useGameStore((state) => state);

	// Something on the farm is affordable: a new animal or an upgrade
	const farmAffordable = ANIMALS.some(
		(animal) => resources.food >= calculateAnimalCost(animal, farmLevels[animal.id] || 0)
	);

	const [levelUpActive, setLevelUpActive] = useState(false);
	const settingsOpen = useUiStore((state) => state.settingsOpen);
	const toggleSettings = useUiStore((state) => state.toggleSettings);
	const legacyOpen = useUiStore((state) => state.legacyOpen);
	const toggleLegacy = useUiStore((state) => state.toggleLegacy);
	const castleLevel = useGameStore((state) => state.tiles[GRID_CENTER_Y]?.[GRID_CENTER_X]?.level ?? 1);
	const rebirths = useGameStore((state) => state.prestige.rebirths);
	const legacyVisible = castleLevel >= REBIRTH.minCastleLevel || rebirths > 0;

	// A single click opens the statistics; hold it back a moment so a double-click (rename / class picker)
	// can cancel it instead of flashing the window open and shut.
	const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelClick = () => {
		if (clickTimer.current) clearTimeout(clickTimer.current);
		clickTimer.current = null;
	};
	const handleProfileClick = () => {
		cancelClick();
		clickTimer.current = setTimeout(toggleStatisticsWindow, 220);
	};
	useEffect(() => cancelClick, []);
	const [prevAvailablePoints, setPrevAvailablePoints] = useState(0);

	// Detect level up based on available points
	useEffect(() => {
		if (characterStats.availablePoints > prevAvailablePoints) {
			setLevelUpActive(true);
		} else if (characterStats.availablePoints === 0 && levelUpActive) {
			setLevelUpActive(false);
		}
		setPrevAvailablePoints(characterStats.availablePoints);
	}, [characterStats.availablePoints, prevAvailablePoints, levelUpActive]);

	const menuButtons: { icon: PixelIconName; title: string; active: boolean; onClick: () => void }[] = [
		{
			icon: 'menu_character',
			title: 'Character',
			active: showCharacterWindow,
			onClick: toggleCharacterWindow,
		},
		{
			icon: 'menu_merchant',
			title: 'Merchant',
			active: showMerchantWindow,
			onClick: toggleMerchantWindow,
		},
		{
			icon: 'menu_farm',
			title: 'Farm',
			active: showFarmWindow,
			onClick: toggleFarmWindow,
			notify: farmAffordable,
			notifyLabel: 'An animal or upgrade is affordable',
		},
		...(legacyVisible
			? [
					{
						icon: 'menu_legacy' as PixelIconName,
						title: castleLevel >= REBIRTH.minCastleLevel ? 'Legacy (rebirth available)' : 'Legacy',
						active: legacyOpen,
						onClick: toggleLegacy,
					},
			  ]
			: []),
		{
			icon: 'menu_settings' as PixelIconName,
			title: 'Settings',
			active: settingsOpen,
			onClick: toggleSettings,
		},
	];

	return (
		<div className='pixel-divider-right flex items-center gap-3 shrink-0 pr-6'>
			<div
				className='pixel-profile max-w-64'
				data-active={showStatisticsWindow}
				onClick={handleProfileClick}
				onDoubleClick={cancelClick}>
				<span className='pixel-avatar'>
					<CharacterPortrait variant='bust' />
				</span>
				<div className='flex flex-col text-[#ecdcb4] items-start justify-center select-none'>
					<div className='flex items-center gap-2 mb-1'>
						<EditableName className='pixel-name' />
						<LevelOrb
							level={level.level}
							notify={characterStats.availablePoints > 0}
							notifyLabel={`${characterStats.availablePoints} unassigned stat points`}
							className={levelUpActive ? 'animate-pulse-ring' : undefined}
						/>
					</div>

					<div
						className='pixel-xp'
						title={`XP: ${formatNumber(resources.xp)} / ${formatNumber(
							Math.floor(
								BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_FACTOR, level.level - 1)
							)
						)}`}>
						<div
							className='pixel-xp-fill'
							style={{ width: `${Math.round(level.progress * XP_BAR_INNER_PX)}px` }}
						/>
					</div>
				</div>
			</div>

			{menuButtons.map((button) => (
				<div
					key={button.icon}
					className='pixel-slot'
					data-active={button.active}
					title={button.title}
					onClick={button.onClick}>
					<PixelIcon name={button.icon} alt={button.title} />
					<NotifyDot show={'notify' in button && button.notify} label={'notifyLabel' in button ? button.notifyLabel : undefined} />
				</div>
			))}
		</div>
	);
};

export default HeaderMenu;
