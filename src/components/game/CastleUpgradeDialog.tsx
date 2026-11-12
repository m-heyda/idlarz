import React from 'react';
import type { FC } from 'react';
import { sortedCostEntries } from '@/catalog';
import { CASTLE_UPGRADE } from '@/config/castle';
import { useGameStore } from '@/stores/gameStore';
import { formatCompact, formatNumber, formatPercent, formatTime } from '@/utils/formatters';
import { castleModifier, castleUpgradeDuration } from '@/utils/game/castle';
import { castleAreaBonus, castleLevelOf, castleRangeRadius } from '@/lib/castleWard';
import audioManager from '@/utils/audioManager';
import GameWindow from './GameWindow';
import { Button } from '../../../packages/design-system/src/components/primitives';
import '@/styles/BuildModal.css';
import { useWindowStore } from '@/stores/windowStore';
import ResourceIcon from './ResourceIcon';
import CastleSprite from './CastleSprite';

/** The castle upgrade window (opened from the castle tile): one of the game's windows, so it can stay open beside the merchant. */
const CastleUpgradeDialog: FC = () => {
	const onClose = () => useWindowStore.getState().closeWindow('castle');
	// Get the castle tile level (which should be the first tile in the grid, at center)
	const tiles = useGameStore((state) => state.tiles);
	const resources = useGameStore((state) => state.resources);
	const upgradeCastle = useGameStore((state) => state.upgradeCastle);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const prestige = useGameStore((state) => state.prestige);

	const castleLevel = castleLevelOf(tiles);

	const isMaxLevel = castleLevel >= CASTLE_UPGRADE.maxLevel;
	const isNextToMaxLevel = castleLevel >= CASTLE_UPGRADE.maxLevel - 1;

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

	const CostGrid: React.FC<{ costs: Partial<Record<string, number>>; muted?: boolean }> = ({ costs, muted }) => (
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 12px' }}>
			{sortedCostEntries(costs).map(([resource, amount]) => (
				<div
					key={resource}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 6,
						color: muted ? '#7a7f90' : resources[resource as keyof typeof resources] >= amount ? '#5ee07a' : '#ff7a6a',
					}}
				>
					<ResourceIcon resource={resource} />
					{formatNumber(amount)}
				</div>
			))}
		</div>
	);

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
		<GameWindow id='castle' title={`Castle ${castleLevel}/${CASTLE_UPGRADE.maxLevel}`} width={600} height={700}>
			<div className='bw-main' style={{ gap: 14 }}>
				<div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 28, minHeight: 96 }}>
					<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
						<CastleSprite level={castleLevel} variant='inline' />
						<span className='ds-dim' style={{ fontSize: 12 }}>
							Level {castleLevel}
						</span>
					</div>
					{!isMaxLevel && (
						<>
							<span style={{ fontSize: 26, color: '#f4d57e', paddingBottom: 26 }}>→</span>
							<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.85 }}>
								<CastleSprite level={castleLevel + 1} variant='inline' />
								<span style={{ fontSize: 12, color: '#f4d57e' }}>Level {castleLevel + 1}</span>
							</div>
						</>
					)}
				</div>

				{castleUpgrade && (
					<div className='ds-listrow bw-upgrade'>
						<div className='bw-label'>Upgrading to level {castleUpgrade.toLevel}</div>
						<div className='bw-bar'>
							<div className='bw-bar-fill' style={{ width: `${Math.round(progress * 100)}%` }} />
						</div>
						<div className='bw-note'>{formatTime(castleUpgrade.remainingSec)} left. The castle keeps its current bonus until the work is done.</div>
					</div>
				)}

				<div className='ds-listrow'>
					<div className='bw-table'>
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
					{!isMaxLevel && !isNextToMaxLevel && afterNextLevelCosts && (
						<div className='bw-note'>
							Level {castleLevel + 2}: +{formatPercent(afterNextMultiplier * 100)} to all resources, +{formatCompact(afterNextXpBonus)} XP/s
						</div>
					)}
				</div>

				{!isMaxLevel && nextLevelCosts ? (
					<>
						<div className='ds-listrow bw-upgrade'>
							<div className='bw-label'>Upgrade to level {castleLevel + 1}</div>
							<CostGrid costs={nextLevelCosts} />
							<div className='bw-foot'>
								<span className='bw-time'>Takes {formatTime(duration)}</span>
							</div>
						</div>

						{!isNextToMaxLevel && afterNextLevelCosts && (
							<div className='ds-listrow'>
								<div className='bw-label' style={{ color: '#7a7f90' }}>
									Next upgrade cost
								</div>
								<CostGrid costs={afterNextLevelCosts} muted />
							</div>
						)}

						<div className='bw-foot' style={{ marginTop: 4 }}>
							<Button onClick={onClose}>Cancel</Button>
							<Button tone='gold' onClick={handleUpgrade} disabled={!canAfford} data-tutorial='castle-upgrade'>
								Upgrade castle
							</Button>
						</div>
					</>
				) : (
					<div className='ds-listrow' style={{ textAlign: 'center' }}>
						<div className='bw-up'>Your castle has reached its maximum level!</div>
						<div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
							<Button onClick={onClose}>Close</Button>
						</div>
					</div>
				)}
			</div>
		</GameWindow>
	);
};

export default CastleUpgradeDialog;
