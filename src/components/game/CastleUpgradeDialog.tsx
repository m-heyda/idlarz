import React from 'react';
import type { FC } from 'react';
import { CASTLE_UPGRADE } from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber, formatTime } from '@/utils/formatters';
import { castleModifier, castleUpgradeDuration } from '@/utils/gameUtils';
import { castleAreaBonus, castleLevelOf, castleRangeRadius } from '@/lib/castleWard';
import audioManager from '@/utils/audioManager';
import PixelModal from './PixelModal';
import ResourceIcon from './ResourceIcon';
import CastleSprite from './CastleSprite';

interface CastleUpgradeDialogProps {
	onClose: () => void;
}

const CastleUpgradeDialog: FC<CastleUpgradeDialogProps> = ({ onClose }) => {
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
	const nextLevelCosts =
		!isMaxLevel && nextLevelIndex < CASTLE_UPGRADE.upgradeCosts.length
			? CASTLE_UPGRADE.upgradeCosts[nextLevelIndex]
			: null;

	// Get the costs for the level after next (for preview)
	const afterNextLevelIndex = castleLevel;
	const afterNextLevelCosts =
		!isNextToMaxLevel && afterNextLevelIndex < CASTLE_UPGRADE.upgradeCosts.length
			? CASTLE_UPGRADE.upgradeCosts[afterNextLevelIndex]
			: null;

	// Check if player has enough resources
	const isUpgrading = !!castleUpgrade;
	const canAfford =
		!isUpgrading && nextLevelCosts
			? Object.entries(nextLevelCosts).every(
					([resource, amount]) => resources[resource as keyof typeof resources] >= (amount || 0)
			  )
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

	const CostGrid: React.FC<{ costs: Partial<Record<string, number>>; muted?: boolean }> = ({
		costs,
		muted,
	}) => (
		<div className='grid grid-cols-3 gap-2'>
			{(Object.entries(costs) as [string, number][]).map(([resource, amount]) => (
				<div
					key={resource}
					className={`flex items-center gap-1 text-sm ${
						muted
							? 'text-[#7a6a52]'
							: resources[resource as keyof typeof resources] >= amount
							? 'text-green-400'
							: 'text-red-400'
					}`}>
					<ResourceIcon resource={resource} />
					{formatNumber(amount)}
				</div>
			))}
		</div>
	);

	return (
		<PixelModal
			title={`Castle ${castleLevel}/${CASTLE_UPGRADE.maxLevel}`}
			size='sm'
			onClose={onClose}>
			<div className='flex items-end justify-center gap-6 mb-4 min-h-[88px]'>
				<div className='flex flex-col items-center gap-1'>
					<CastleSprite level={castleLevel} variant='inline' />
					<span className='text-xs text-[#a89878]'>Level {castleLevel}</span>
				</div>
				{!isMaxLevel && (
					<>
						<span className='text-2xl text-[#f0d27a] pb-6'>→</span>
						<div className='flex flex-col items-center gap-1 opacity-80'>
							<CastleSprite level={castleLevel + 1} variant='inline' />
							<span className='text-xs text-[#f0d27a]'>Level {castleLevel + 1}</span>
						</div>
					</>
				)}
			</div>
			<div className='text-sm text-[#a89878] mb-1'>
				Current bonus:{' '}
				<span className='text-green-400'>+{(currentMultiplier * 100).toFixed(0)}%</span> to all
				resources
			</div>
			<div className='text-sm text-[#a89878] mb-3'>
				Castle XP: <span className='text-amber-400'>+{currentXpBonus.toFixed(1)} XP/s</span> flat
			</div>

			{castleUpgrade && (
				<div className='px-card mb-3 text-center'>
					<div className='px-h'>Upgrading to level {castleUpgrade.toLevel}</div>
					<div className='text-amber-300 text-lg'>{formatTime(castleUpgrade.remainingSec)}</div>
					<div className='text-xs text-[#a89878]'>The castle keeps its current bonus until the work is done.</div>
				</div>
			)}

			{!isMaxLevel && nextLevelCosts ? (
				<>
					<div className='text-sm text-[#a89878] mb-1'>
						Next level:{' '}
						<span className='text-green-400'>+{(nextMultiplier * 100).toFixed(0)}%</span> to
						all resources
					</div>
					<div className='text-sm text-[#a89878] mb-3'>
						Castle XP: <span className='text-amber-400'>+{nextXpBonus.toFixed(1)} XP/s</span> flat
						{nextRange > currentRange && (
							<div>
								Castle range: <span className='text-violet-300'>{rangeLabel(currentRange)}</span> {'→'}{' '}
								<span className='text-violet-300'>{rangeLabel(nextRange)}</span>
							</div>
						)}
						{castleAreaBonus(castleLevel + 1) > castleAreaBonus(castleLevel) && (
							<div>
								Castle area production: <span className='text-violet-300'>+{castleAreaBonus(castleLevel) * 100}%</span> {'→'}{' '}
								<span className='text-violet-300'>+{castleAreaBonus(castleLevel + 1) * 100}%</span>
							</div>
						)}
					</div>

					{!isNextToMaxLevel && afterNextLevelCosts && (
						<div className='text-[#7a6a52] text-xs mb-3'>
							Level {castleLevel + 2}: +{(afterNextMultiplier * 100).toFixed(0)}% to all
							resources, +{afterNextXpBonus.toFixed(1)} XP/s
						</div>
					)}

					<div className='px-card mb-3'>
						<div className='px-h'>Upgrade Cost</div>
						<CostGrid costs={nextLevelCosts} />
						<div className='text-xs text-[#a89878] mt-2'>Build time: {formatTime(duration)}</div>
					</div>

					{!isNextToMaxLevel && afterNextLevelCosts && (
						<>
							<div className='text-xs text-[#a89878] mb-1'>Next upgrade cost</div>
							<CostGrid costs={afterNextLevelCosts} muted />
						</>
					)}

					<div className='flex justify-between mt-5'>
						<button onClick={onClose} className='px-btn px-btn-red'>
							Cancel
						</button>
						<button onClick={handleUpgrade} disabled={!canAfford} className='px-btn'>
							Upgrade Castle
						</button>
					</div>
				</>
			) : (
				<>
					<div className='text-amber-400 mb-4'>Your castle has reached its maximum level!</div>
					<div className='flex justify-center'>
						<button onClick={onClose} className='px-btn px-btn-blue'>
							Close
						</button>
					</div>
				</>
			)}
		</PixelModal>
	);
};

export default CastleUpgradeDialog;
