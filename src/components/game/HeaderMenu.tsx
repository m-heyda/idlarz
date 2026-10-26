import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import { BASE_XP_PER_LEVEL, XP_GROWTH_FACTOR, REBIRTH } from '@/config/gameConfig';
import { useMenuAttention } from '@/hooks/useMenuAttention';
import { useUiStore } from '@/stores/uiStore';
import { openMenuAt } from '@/lib/globalMenu';
import { castleLevelOf } from '@/lib/castleWard';
import type { PixelIconName } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';
import LevelOrb from './LevelOrb';
import NotifyDot from './NotifyDot';
import CharacterPortrait from './CharacterPortrait';
import EditableName from './EditableName';

// Inner width of the XP frame sprite (80px wide, 3px border each side)
const XP_BAR_INNER_PX = 74;

/** Portrait, name, level orb and XP bar. A click opens the Stats tab; double-click renames / picks the class. */
export const PlayerCard: React.FC = () => {
	const xp = useGameStore((state) => state.resources.xp);
	const level = useGameStore((state) => state.level);
	const availablePoints = useGameStore((state) => state.characterStats.availablePoints);
	const openMenu = useUiStore((state) => state.openMenu);
	const statsOpen = useUiStore((state) => state.menuOpen && state.menuTab === 'stats');
	const [levelUpActive, setLevelUpActive] = useState(false);
	const [prevAvailablePoints, setPrevAvailablePoints] = useState(0);

	// A single click opens the stats; hold it back a moment so a double-click (rename / class picker)
	// can cancel it instead of flashing the window open and shut.
	const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelClick = () => {
		if (clickTimer.current) clearTimeout(clickTimer.current);
		clickTimer.current = null;
	};
	const handleProfileClick = () => {
		cancelClick();
		clickTimer.current = setTimeout(() => openMenu('stats'), 220);
	};
	useEffect(() => cancelClick, []);

	// Detect level up based on available points
	useEffect(() => {
		if (availablePoints > prevAvailablePoints) {
			setLevelUpActive(true);
		} else if (availablePoints === 0 && levelUpActive) {
			setLevelUpActive(false);
		}
		setPrevAvailablePoints(availablePoints);
	}, [availablePoints, prevAvailablePoints, levelUpActive]);

	// XP into the current level, out of what the level needs
	const needed = Math.floor(BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_FACTOR, level.level - 1));
	const into = Math.floor(level.progress * needed);

	return (
		<div
			className='pixel-profile'
			data-active={statsOpen}
			title='Statistics'
			onClick={handleProfileClick}
			onDoubleClick={cancelClick}>
			<span className='pixel-avatar'>
				<CharacterPortrait variant='bust' scale={0.8} />
				<span className='pixel-avatar-orb'>
					<LevelOrb
						level={level.level}
						notify={availablePoints > 0}
						notifyLabel={`${availablePoints} unassigned stat points`}
						className={levelUpActive ? 'animate-pulse-ring' : undefined}
					/>
				</span>
			</span>
			<div className='flex flex-col text-[#ecdcb4] items-start justify-center select-none gap-1 ml-1'>
				<EditableName className='pixel-name' />
				<div className='pixel-xp' title={`XP: ${formatNumber(into)} / ${formatNumber(needed)} (${formatNumber(xp)} in total)`}>
					<div className='pixel-xp-fill' style={{ width: `${Math.round(level.progress * XP_BAR_INNER_PX)}px` }} />
				</div>
			</div>
		</div>
	);
};

/** The three header buttons: the main menu (Character, Stats, Merchant, Farm), Legacy / rebirth and Settings. */
export const HeaderButtons: React.FC = () => {
	const attention = useMenuAttention();
	const menuOpen = useUiStore((state) => state.menuOpen);
	const toggleMenu = useUiStore((state) => state.toggleMenu);
	const settingsOpen = useUiStore((state) => state.settingsOpen);
	const legacyOpen = useUiStore((state) => state.legacyOpen);
	const toggleLegacy = useUiStore((state) => state.toggleLegacy);
	const castleLevel = useGameStore((state) => castleLevelOf(state.tiles));
	const rebirths = useGameStore((state) => state.prestige.rebirths);
	const legacyVisible = castleLevel >= REBIRTH.minCastleLevel || rebirths > 0;

	const buttons: {
		icon: PixelIconName;
		title: string;
		active: boolean;
		onClick: (event: React.MouseEvent<HTMLElement>) => void;
		/** Marks a button that opens the dropdown, so a second click on it closes the menu instead of reopening it */
		anchor?: boolean;
		notify?: boolean;
		notifyLabel?: string;
	}[] = [
		{
			icon: 'menu_main',
			title: 'Menu: character, stats, merchant and farm',
			active: menuOpen,
			onClick: toggleMenu,
			notify: attention.any,
			notifyLabel: 'Something needs your attention',
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
			icon: 'menu_settings',
			title: 'Game menu: settings, save, export, statistics',
			active: settingsOpen,
			anchor: true,
			onClick: (event) => {
				const ui = useUiStore.getState();
				if (ui.contextMenu) return ui.closeContextMenu();
				const box = event.currentTarget.getBoundingClientRect();
				openMenuAt(box.right - 4, box.bottom + 4, 'Menu');
			},
		},
	];

	return (
		<div className='flex items-center gap-2 shrink-0'>
			{buttons.map((button) => (
				<div
					key={button.icon}
					className='pixel-slot'
					data-active={button.active}
					title={button.title}
					data-ctx-anchor={button.anchor ? '' : undefined}
					onClick={button.onClick}>
					<PixelIcon name={button.icon} alt={button.title} scale={0.8} />
					<NotifyDot show={!!button.notify} label={button.notifyLabel} />
				</div>
			))}
		</div>
	);
};
