import React from 'react';
import { upgradeState } from '../logic';
import { Button, DiamondLevel } from './primitives';

export interface UpgradeTileProps {
	name: string;
	icon?: string;
	level: number;
	maxLevel: number;
	/** Text for the current level ("+9% gold on everything you sell"); undefined shows "nothing yet" */
	now?: string;
	/** Text for the next level; hidden once maxed */
	next?: string;
	cost: number;
	costText: string;
	costIcon?: string;
	/** What the player has, in the same unit as `cost`, to pick ready or short */
	have: number;
	/** "Need 148K more" text for the short state */
	shortText?: string;
	buyLabel?: string;
	onBuy?: () => void;
}

/**
 * One upgrade (merchant perks, building levels): name with diamond level gems, a Now line and a Next line, then the cost and a Buy button.
 * Three states: ready (gold rim, Buy enabled), short (greyed button saying how much is missing), maxed (purple gems and rim, no cost).
 */
export const UpgradeTile: React.FC<UpgradeTileProps> = ({
	name,
	icon,
	level,
	maxLevel,
	now,
	next,
	cost,
	costText,
	costIcon,
	have,
	shortText,
	buyLabel = 'Upgrade',
	onBuy,
}) => {
	const state = upgradeState(level, maxLevel, cost, have);
	return (
		<div className='ds-upgrade' data-state={state}>
			<div className='ds-upgrade-head'>
				{icon ? <img className='ds-upgrade-icon' src={icon} alt='' /> : null}
				<span className='ds-upgrade-name'>{name}</span>
				<DiamondLevel level={level} max={maxLevel} />
			</div>
			<div className='ds-upgrade-line'>
				<b className='ds-good'>Now</b>
				{now ?? 'nothing yet'}
			</div>
			{state !== 'maxed' && next ? (
				<div className='ds-upgrade-line'>
					<b className='ds-gold-text'>Next</b>
					{next}
				</div>
			) : (
				<div className='ds-upgrade-line ds-dim'>Fully upgraded</div>
			)}
			<div className='ds-upgrade-foot'>
				{state === 'maxed' ? (
					<span className='ds-cost' style={{ color: 'var(--ds-r-epic)' }}>
						MAX
					</span>
				) : (
					<span className='ds-cost'>
						{costIcon ? <img src={costIcon} alt='' /> : null}
						{costText}
					</span>
				)}
				{state === 'ready' ? (
					<Button tone='gold' onClick={onBuy}>
						{buyLabel}
					</Button>
				) : state === 'short' ? (
					<Button tone='dark' disabled>
						{shortText ?? 'Not enough'}
					</Button>
				) : null}
			</div>
		</div>
	);
};
