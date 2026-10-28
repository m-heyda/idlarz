import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatHeaderAmount, formatNumber } from '@/utils/formatters';
import { MAX_LEVEL } from '@/config/gameConfig';
import { rebirthStatus, xpToNextLevel } from '@/utils/gameUtils';
import { useMenuAttention } from '@/hooks/useMenuAttention';
import { useUiStore } from '@/stores/uiStore';
import { openMenuAt } from '@/lib/globalMenu';
import { cn } from '@/lib/utils';
import PixelIcon from './PixelIcon';
import LevelOrb from './LevelOrb';
import NotifyDot from './NotifyDot';
import CharacterPortrait from './CharacterPortrait';
import HeaderTip, { TipLine } from './HeaderTip';

// Inner width of the XP frame sprite (80px wide, 3px border each side)
const XP_BAR_INNER_PX = 74;

/**
 * The hero: just the portrait and the level orb. A click opens the character screen, a double-click the class picker. The
 * name and the XP bar are in the tooltip. The orange dot on top says something in the menu needs you (stat points, a farm purchase).
 */
export const PlayerCard: React.FC = () => {
	const xp = useGameStore((state) => state.resources.xp);
	const level = useGameStore((state) => state.level);
	const playerName = useGameStore((state) => state.playerName);
	const availablePoints = useGameStore((state) => state.characterStats.availablePoints);
	const attention = useMenuAttention();
	const openMenu = useUiStore((state) => state.openMenu);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	const statsOpen = useUiStore((state) => state.menuOpen && state.menuTab === 'stats');
	const [levelUpActive, setLevelUpActive] = useState(false);
	const [prevAvailablePoints, setPrevAvailablePoints] = useState(0);

	// A single click opens the character screen; hold it back a moment so a double-click
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
	const handleDoubleClick = () => {
		cancelClick();
		openClassDialog();
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
	const needed = level.level >= MAX_LEVEL ? 0 : xpToNextLevel(level.level);
	const into = Math.floor(level.progress * needed);

	return (
		<div
			className='pixel-profile hdr-has-tip'
			data-active={statsOpen}
			role='button'
			tabIndex={0}
			aria-label={`${playerName}, level ${level.level}. Opens the character screen`}
			onClick={handleProfileClick}
			onDoubleClick={handleDoubleClick}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					openMenu('stats');
				}
			}}>
			<span className='pixel-avatar'>
				<CharacterPortrait variant='bust' scale={0.7} interactive={false} />
				<span className='pixel-avatar-orb'>
					<LevelOrb level={level.level} scale={0.75} className={levelUpActive ? 'animate-pulse-ring' : undefined} />
				</span>
				<NotifyDot show={attention.any} label='Something needs your attention' />
			</span>
			<HeaderTip align='start' width={200}>
				<div className='px-tip-title'>{playerName}</div>
				<TipLine label='Level' value={level.level} />
				<div className='pixel-xp my-1' aria-hidden>
					<div className='pixel-xp-fill' style={{ width: `${Math.round(level.progress * XP_BAR_INNER_PX)}px` }} />
				</div>
				<div className='text-xs text-[#f1e6c8]'>
					{needed > 0 ? `XP ${formatNumber(into)} / ${formatNumber(needed)}` : 'Max level'}
					<span className='px-tip-muted'> ({formatNumber(xp)} in total)</span>
				</div>
				{(attention.stats || attention.farm) && (
					<div className='pt-1 mt-1 border-t px-rule space-y-1 text-xs text-[#f0d27a]'>
						{attention.stats && <div>{availablePoints} unspent stat point{availablePoints === 1 ? '' : 's'}</div>}
						{attention.farm && <div>A farm purchase is affordable</div>}
					</div>
				)}
				<div className='px-tip-muted text-xs mt-1'>Click: character. Double-click: change class.</div>
			</HeaderTip>
		</div>
	);
};

/** The Rebirth button (always there, greyed out until a rebirth is possible) and the Settings menu. */
export const HeaderButtons: React.FC = () => {
	const settingsOpen = useUiStore((state) => state.settingsOpen);
	const rebirthOpen = useUiStore((state) => state.rebirthOpen);
	const toggleRebirth = useUiStore((state) => state.toggleRebirth);
	const tiles = useGameStore((state) => state.tiles);
	const freeTiles = useGameStore((state) => state.freeTiles);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	// recomputed when the map, a castle upgrade or the merchant changes, not on every income tick
	const status = useMemo(
		() => rebirthStatus({ tiles, freeTiles, castleUpgrade, merchantUpgrades }),
		[tiles, freeTiles, castleUpgrade, merchantUpgrades]
	);
	const reached = status.requirements.every((r) => r.met);

	return (
		<div className='flex items-center gap-1.5 shrink-0'>
			<div className='hdr-has-tip flex'>
				<div
					className={cn('pixel-slot pixel-slot-sm', !status.canRebirth && 'is-disabled')}
					data-active={rebirthOpen}
					role='button'
					tabIndex={0}
					aria-disabled={!status.canRebirth}
					aria-label={status.canRebirth ? 'Rebirth' : 'Rebirth (not available yet)'}
					onClick={() => (status.canRebirth || rebirthOpen) && toggleRebirth()}
					onKeyDown={(event) => {
						if ((event.key === 'Enter' || event.key === ' ') && (status.canRebirth || rebirthOpen)) {
							event.preventDefault();
							toggleRebirth();
						}
					}}>
					<PixelIcon name='menu_legacy' alt='' scale={0.6} />
				</div>
				<HeaderTip align='end' width={240}>
					<div className='px-tip-title'>Rebirth</div>
					<div className='text-xs px-tip-muted mb-1'>
						{status.canRebirth ? 'Ready: start over for a permanent bonus.' : 'Locked until you meet the requirements:'}
					</div>
					<div className='space-y-0.5 text-xs'>
						{status.requirements.map((req) => (
							<div key={req.id} className={cn('flex justify-between gap-3', req.met ? 'text-green-400' : 'text-red-400')}>
								<span>
									{req.met ? '✓' : '✗'} {req.label}
								</span>
								{req.id !== 'idle' && (
									<span>
										{formatHeaderAmount(req.current)} / {req.needed}
									</span>
								)}
							</div>
						))}
					</div>
					{reached && (
						<div className='pt-1 mt-1 border-t px-rule text-xs text-[#9be26a]'>
							Rebirth now for {formatHeaderAmount(status.gain)} Ember{status.gain === 1 ? '' : 's'}
						</div>
					)}
				</HeaderTip>
			</div>

			{/* data-ctx-anchor: a second click closes the dropdown instead of reopening it */}
			<div
				className='pixel-slot pixel-slot-sm'
				data-active={settingsOpen}
				data-ctx-anchor=''
				title='Game menu: settings, save, export'
				role='button'
				tabIndex={0}
				aria-label='Game menu: settings, save, export'
				onClick={(event) => {
					const ui = useUiStore.getState();
					if (ui.contextMenu) return ui.closeContextMenu();
					const box = event.currentTarget.getBoundingClientRect();
					openMenuAt(box.right - 4, box.bottom + 4, 'Menu', [], true);
				}}>
				<PixelIcon name='menu_settings' alt='' scale={0.6} />
			</div>
		</div>
	);
};
