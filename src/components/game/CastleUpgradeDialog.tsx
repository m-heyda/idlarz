import React, { useState } from 'react';
import type { FC } from 'react';
import { CASTLE_UPGRADE } from '@/config/castle';
import { limitOf } from '@/lib/limits';
import { useGameStore } from '@/stores/gameStore';
import { formatCompact, formatPercent, formatTime } from '@/utils/formatters';
import { castleModifier, castleUpgradeDuration } from '@/utils/game/castle';
import { castleAreaBonus, castleLevelOf, castleRangeRadius } from '@/lib/castleWard';
import audioManager from '@/utils/audioManager';
import GameWindow from './GameWindow';
import { Button, DiamondLevel, Tabs } from '../../../packages/design-system/src/components/primitives';
import '@/styles/BuildModal.css';
import { useWindowStore } from '@/stores/windowStore';
import CostGrid from './CostGrid';
import CastleSkinsSection from './CastleSkinsSection';
import CastleSprite from './CastleSprite';

/** The castle upgrade window (opened from the castle tile): one of the game's windows, so it can stay open beside the merchant. */
const CastleUpgradeDialog: FC = () => {
	const [tab, setTab] = useState<'overview' | 'skins'>('overview');
	const onClose = () => useWindowStore.getState().closeWindow('castle');
	// Get the castle tile level (which should be the first tile in the grid, at center)
	const tiles = useGameStore((state) => state.tiles);
	const resources = useGameStore((state) => state.resources);
	const upgradeCastle = useGameStore((state) => state.upgradeCastle);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const prestige = useGameStore((state) => state.prestige);

	const castleLevel = castleLevelOf(tiles);

	const castleCap = limitOf('castleMaxLevel', { prestige }); // 10, up to 15 with the Castle Expansion (Ember shop)
	const isMaxLevel = castleLevel >= castleCap;
	const isNextToMaxLevel = castleLevel >= castleCap - 1;

	// Get the required resources for the next level
	const nextLevelIndex = castleLevel - 1;
	const nextLevelCosts = !isMaxLevel && nextLevelIndex < CASTLE_UPGRADE.upgradeCosts.length ? CASTLE_UPGRADE.upgradeCosts[nextLevelIndex] : null;

	// Get the costs for the level after next (for preview)
	const afterNextLevelIndex = castleLevel;
	const afterNextLevelCosts =
		!isNextToMaxLevel && afterNextLevelIndex < CASTLE_UPGRADE.upgradeCosts.length ? CASTLE_UPGRADE.upgradeCosts[afterNextLevelIndex] : null;

	// Check if player has enough resources
	const isUpgrading = !!castleUpgrade;
	const canAfford =
		!isUpgrading && nextLevelCosts
			? Object.entries(nextLevelCosts).every(([resource, amount]) => resources[resource as keyof typeof resources] >= (amount || 0))
			: false;

	const handleUpgrade = () => {
		if (canAfford && !isMaxLevel && upgradeCastle) {
			const success = upgradeCastle();
			if (success) {
				audioManager.playSound('purchase');
				onClose();
			}
		}
	};

	// Bonus to all resources now, after the next upgrade and after the one after that
	const currentMultiplier = castleModifier(castleLevel);
	const nextMultiplier = castleModifier(castleLevel + 1);
	const afterNextMultiplier = castleModifier(castleLevel + 2);

	// Flat XP/s granted by the castle: xpBonus for every level above 1
	const currentXpBonus = CASTLE_UPGRADE.xpBonus * (castleLevel - 1);
	const nextXpBonus = CASTLE_UPGRADE.xpBonus * castleLevel;
	const afterNextXpBonus = CASTLE_UPGRADE.xpBonus * (castleLevel + 1);

	const duration = castleUpgradeDuration(castleLevel, prestige);

	// The violet range area grows from level 8 (3x3 -> 5x5 -> 7x7 -> 9x9)
	const currentRange = castleRangeRadius(castleLevel);
	const nextRange = castleRangeRadius(castleLevel + 1);
	const rangeLabel = (radius: number) => `${radius * 2 + 1}x${radius * 2 + 1}`;

	// the rows of the bonus table: what the castle gives now and at the next level
	const rows: { label: string; now: React.ReactNode; next: React.ReactNode; tone?: string }[] = [
		{ label: 'All resources', now: `+${formatPercent(currentMultiplier * 100)}`, next: `+${formatPercent(nextMultiplier * 100)}`, tone: '#5ee07a' },
		{ label: 'Castle XP / s', now: `+${formatCompact(currentXpBonus)}`, next: `+${formatCompact(nextXpBonus)}`, tone: '#ffb24a' },
		...(nextRange > currentRange ? [{ label: 'Castle range', now: rangeLabel(currentRange), next: rangeLabel(nextRange), tone: '#c9a6ff' }] : []),
		...(castleAreaBonus(castleLevel + 1) > castleAreaBonus(castleLevel)
			? [
					{
						label: 'Area production',
						now: `+${formatPercent(castleAreaBonus(castleLevel) * 100)}`,
						next: `+${formatPercent(castleAreaBonus(castleLevel + 1) * 100)}`,
						tone: '#c9a6ff',
					},
				]
			: []),
	];
	const total = castleUpgrade ? castleUpgradeDuration(castleUpgrade.toLevel - 1, prestige) : 0;
	const progress = castleUpgrade && total > 0 ? Math.min(1, Math.max(0, 1 - castleUpgrade.remainingSec / total)) : 0;

	return (
		<GameWindow
			id='castle'
			title={`Castle ${castleLevel}/${castleCap}`}
			width={700}
			height={700}
			bar={
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as 'overview' | 'skins')}
					items={[
						{ id: 'overview', label: 'Overview' },
						{ id: 'skins', label: 'Skins' },
					]}
				/>
			}
		>
			{tab === 'skins' ? (
				<CastleSkinsSection />
			) : (
				<div className='bw-main' style={{ gap: 14 }}>
					<div className='bw-castle-sprites'>
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
							<CastleSprite level={castleLevel} variant='inline' />
							<span className='ds-dim' style={{ fontSize: 12 }}>
								Level {castleLevel}
							</span>
						</div>
						{!isMaxLevel && (
							<>
								<div className='bw-arrow'>
									<span className='bw-arrow-time' title='How long the upgrade takes'>
										<svg viewBox='0 0 16 16' width='15' height='15' fill='none' stroke='currentColor' strokeWidth='1.6' aria-hidden>
											<circle cx='8' cy='8' r='6.2' />
											<path d='M8 4.2 V8 L10.6 9.6' strokeLinecap='round' />
										</svg>
										{formatTime(duration)}
									</span>
									<span className='bw-arrow-sign'>→</span>
								</div>
								<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.85 }}>
									<CastleSprite level={castleLevel + 1} variant='inline' plain />
									<span style={{ fontSize: 12, color: '#f4d57e' }}>Level {castleLevel + 1}</span>
								</div>
							</>
						)}
					</div>

					{castleUpgrade && (
						<div className='bw-sec bw-upgrade'>
							<div className='bw-label'>Upgrading to level {castleUpgrade.toLevel}</div>
							<div className='bw-bar'>
								<div className='bw-bar-fill' style={{ width: `${Math.round(progress * 100)}%` }} />
							</div>
							<div className='bw-note'>{formatTime(castleUpgrade.remainingSec)} left. The castle keeps its current bonus until the work is done.</div>
						</div>
					)}

					<div className='bw-sec'>
						<div className='bw-table bw-table-3'>
							<span className='bw-label'>Castle bonus</span>
							<span className='bw-col'>Now</span>
							<span className='bw-col'>{isMaxLevel ? '' : `Level ${castleLevel + 1}`}</span>
							{rows.map((row) => (
								<React.Fragment key={row.label}>
									<span>{row.label}</span>
									<span className='bw-num' style={{ color: row.tone }}>
										{row.now}
									</span>
									<span className='bw-num' style={{ color: row.tone }}>
										{isMaxLevel ? '' : row.next}
									</span>
								</React.Fragment>
							))}
						</div>
					</div>

					{!isMaxLevel && nextLevelCosts ? (
						<>
							{castleUpgrade && (
								<div className='bw-card bw-card-dim'>
									<div className='bw-label'>
										Current upgrade, already paid: level {castleLevel} → {castleUpgrade.toLevel}
									</div>
									<CostGrid cost={nextLevelCosts} muted />
								</div>
							)}
							{castleUpgrade ? (
								afterNextLevelCosts && castleUpgrade.toLevel < castleCap ? (
									<div className='bw-card bw-card-main'>
										<div className='bw-sechead'>
											<span className='bw-label'>
												Next upgrade: level {castleUpgrade.toLevel} → {castleUpgrade.toLevel + 1}
											</span>
											<DiamondLevel level={castleUpgrade.toLevel} max={castleCap} />
										</div>
										<div className='bw-gets'>
											You get: <b>+{formatPercent(afterNextMultiplier * 100)}</b> to all resources, <b>+{formatCompact(afterNextXpBonus)}</b> castle XP / s
										</div>
										<CostGrid cost={afterNextLevelCosts} />
									</div>
								) : null
							) : (
								<>
									<div className='bw-card bw-card-main'>
										<div className='bw-sechead'>
											<span className='bw-label'>Upgrade to level {castleLevel + 1}</span>
											<DiamondLevel level={castleLevel} max={castleCap} />
										</div>
										<div className='bw-gets'>
											You get: <b>+{formatPercent(nextMultiplier * 100)}</b> to all resources, <b>+{formatCompact(nextXpBonus)}</b> castle XP / s
										</div>
										<CostGrid cost={nextLevelCosts} />
									</div>

									{!isNextToMaxLevel && afterNextLevelCosts && (
										<div className='bw-card bw-card-dim'>
											<div className='bw-label'>Then: level {castleLevel + 2}</div>
											<div className='bw-gets'>
												+{formatPercent(afterNextMultiplier * 100)} to all resources, +{formatCompact(afterNextXpBonus)} castle XP / s
											</div>
											<CostGrid cost={afterNextLevelCosts} muted />
										</div>
									)}
								</>
							)}

							<div className='bw-foot' style={{ marginTop: 4 }}>
								<Button onClick={onClose}>Cancel</Button>
								<Button tone='gold' onClick={handleUpgrade} disabled={!canAfford} data-tutorial='castle-upgrade'>
									Upgrade castle
								</Button>
							</div>
						</>
					) : (
						<div className='bw-sec' style={{ textAlign: 'center' }}>
							<div className='bw-up'>Your castle has reached its maximum level!</div>
							<div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
								<Button onClick={onClose}>Close</Button>
							</div>
						</div>
					)}
				</div>
			)}
		</GameWindow>
	);
};

export default CastleUpgradeDialog;
