import React, { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { FARM_UPGRADES, type FarmUpgradeId } from '@/config/farm';
import { canAffordBundle } from '@/utils/game/costs';
import { farmUpgradeCost, farmUpgradeLevel } from '@/utils/game/farm';
import { Button, SectionLabel } from '../../../../packages/design-system/src/components/primitives';
import { UpgradeTile } from '../../../../packages/design-system/src/components/upgrade';
import { compact } from '../../../../packages/design-system/src/logic';
import { RESOURCES, sortedCostEntries } from '@/catalog';
import { resourceIconUrl } from '../hero/recipeUi';

const IDS = Object.keys(FARM_UPGRADES) as FarmUpgradeId[];

interface FarmUpgradeDockProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** The tiles of the upgrade window. They follow the store (resources tick ten times a second), so they are only mounted while the window shows. */
const UpgradeTiles: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const upgrades = useGameStore((state) => state.farmUpgrades);
	const buy = useGameStore((state) => state.buyFarmUpgrade);

	return (
		<div className='ds-ups-grid'>
			{IDS.map((id) => {
				const def = FARM_UPGRADES[id];
				const level = farmUpgradeLevel(upgrades, id);
				const maxed = level >= def.maxLevel;
				const cost = farmUpgradeCost(id, level);
				const affordable = !maxed && canAffordBundle(resources, cost);
				const entries = sortedCostEntries<keyof typeof resources>(cost);
				return (
					<UpgradeTile
						key={id}
						name={def.label}
						level={level}
						maxLevel={def.maxLevel}
						now={level > 0 ? def.description(level) : undefined}
						next={maxed ? undefined : def.description(level + 1)}
						state={maxed ? 'maxed' : affordable ? 'ready' : 'short'}
						cost={0}
						costText=''
						have={0}
						shortText='Not enough'
						costNode={
							<span className='farm-ups-cost'>
								{entries.map(([key, amount]) => (
									<span key={key} className='ds-cost' title={RESOURCES[key].label} style={{ color: (resources[key] ?? 0) >= amount ? undefined : '#ff8d7c' }}>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img src={resourceIconUrl(key)} alt='' />
										{compact(amount)}
									</span>
								))}
							</span>
						}
						onBuy={() => {
							buy(id);
						}}
					/>
				);
			})}
		</div>
	);
};

/**
 * The farm's upgrades: a button along the bottom edge opens a window over the whole farm (the animal shop included) on a blurred backdrop, laid out like the merchant's Upgrades tab (a tile per upgrade with its diamonds, Now and Next lines
 * and the price), so more upgrades can be added as more tiles. Esc or the Close button shuts it; a second Esc closes the Farm window (the modal listens on window).
 */
const FarmUpgradeDock: React.FC<FarmUpgradeDockProps> = ({ open, onOpenChange }) => {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.stopPropagation();
			onOpenChange(false);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onOpenChange]);

	return (
		<>
			<div className='farm-dock' data-open={open}>
				<Button size='sm' className='farm-dock-toggle' onClick={() => onOpenChange(!open)} aria-expanded={open}>
					Upgrades ▲
				</Button>
			</div>
			{open && (
				<div className='farm-ups' role='dialog' aria-label='Farm upgrades'>
					<div className='farm-ups-head'>
						<SectionLabel>
							<span className='farm-ups-title'>Farm upgrades</span>
						</SectionLabel>
						<Button size='sm' onClick={() => onOpenChange(false)}>
							Close ▼
						</Button>
					</div>
					<div className='farm-ups-body'>
						<UpgradeTiles />
					</div>
				</div>
			)}
		</>
	);
};

export default FarmUpgradeDock;
