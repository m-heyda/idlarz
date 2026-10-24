import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { FARM_UPGRADES, type FarmUpgradeId } from '@/config/gameConfig';
import { formatNumber } from '@/utils/formatters';
import { canAffordBundle, farmUpgradeCost, farmUpgradeLevel } from '@/utils/gameUtils';
import audioManager from '@/utils/audioManager';
import ResourceIcon from '../ResourceIcon';

const IDS = Object.keys(FARM_UPGRADES) as FarmUpgradeId[];

/** The farm's upgrade shelf along the bottom of the scene: feed, hen house, dairy, tannery and the pen. */
const FarmUpgradeDock: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const upgrades = useGameStore((state) => state.farmUpgrades);
	const buy = useGameStore((state) => state.buyFarmUpgrade);
	const [open, setOpen] = useState(true);

	return (
		<div className='farm-dock' data-open={open}>
			<button className='farm-dock-toggle' onClick={() => setOpen(!open)} aria-expanded={open}>
				Upgrades {open ? '▼' : '▲'}
			</button>
			{open && (
				<div className='farm-dock-row'>
					{IDS.map((id) => {
						const def = FARM_UPGRADES[id];
						const level = farmUpgradeLevel(upgrades, id);
						const maxed = level >= def.maxLevel;
						const cost = farmUpgradeCost(id, level);
						const affordable = !maxed && canAffordBundle(resources, cost);
						return (
							<div key={id} className='farm-up' data-ok={affordable} data-maxed={maxed}>
								<div className='farm-up-head'>
									<span className='farm-up-name'>{def.label}</span>
									<span className='farm-up-lvl'>
										{level}/{def.maxLevel}
									</span>
								</div>
								<div className='farm-up-effect'>
									{level > 0 ? def.description(level) : 'not built yet'}
									{!maxed && <span className='farm-up-next'> {'→'} {def.description(level + 1)}</span>}
								</div>
								{maxed ? (
									<div className='farm-up-max'>Max</div>
								) : (
									<button
										className='px-btn px-btn-sm w-full'
										disabled={!affordable}
										onClick={() => {
											if (buy(id)) {
												audioManager.playSound('purchase');
											}
										}}>
										<span className='farm-up-cost'>
											{(Object.entries(cost) as [keyof typeof resources, number][]).map(([resource, amount]) => (
												<span
													key={resource}
													data-short={resources[resource] < amount}
													className='inline-flex items-center gap-1'>
													{formatNumber(amount)} <ResourceIcon resource={resource} />
												</span>
											))}
										</span>
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default FarmUpgradeDock;
