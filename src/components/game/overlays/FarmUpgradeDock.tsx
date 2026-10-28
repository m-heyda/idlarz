import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { FARM_UPGRADES, type FarmUpgradeId } from '@/config/gameConfig';
import { canAffordBundle, farmUpgradeCost, farmUpgradeLevel } from '@/utils/gameUtils';
import audioManager from '@/utils/audioManager';
import CostList from '../CostList';
import { TipButton } from './Merchant/TipButton';

const IDS = Object.keys(FARM_UPGRADES) as FarmUpgradeId[];

interface FarmUpgradeDockProps {
	open: boolean;
	onToggle: () => void;
}

/** The farm's upgrade shelf along the bottom of the scene: feed, hen house, dairy, tannery and the pen. The next level and the price are in each button's hover card. */
const FarmUpgradeDock: React.FC<FarmUpgradeDockProps> = ({ open, onToggle }) => {
	const resources = useGameStore((state) => state.resources);
	const upgrades = useGameStore((state) => state.farmUpgrades);
	const buy = useGameStore((state) => state.buyFarmUpgrade);

	return (
		<div className='farm-dock' data-open={open}>
			<button className='farm-dock-toggle' onClick={onToggle} aria-expanded={open}>
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
								<div className='farm-up-effect'>{level > 0 ? def.description(level) : 'not built yet'}</div>
								<TipButton
									className='px-btn px-btn-sm w-full'
									label={maxed ? 'Max' : 'Upgrade'}
									disabled={!affordable}
									onClick={() => {
										if (buy(id)) {
											audioManager.playSound('purchase');
										}
									}}
									tip={
										<>
											<div className='px-tip-title'>
												{def.label} {level}/{def.maxLevel}
											</div>
											{maxed ? (
												<div className='px-tip-muted'>Fully upgraded.</div>
											) : (
												<>
													<div className='text-[#7ac27a]'>Next: {def.description(level + 1)}</div>
													<CostList cost={cost} />
													{!affordable && <div className='px-tip-muted'>Not enough resources.</div>}
												</>
											)}
										</>
									}
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default FarmUpgradeDock;
