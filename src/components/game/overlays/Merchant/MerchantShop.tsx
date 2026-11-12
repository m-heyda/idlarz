import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { MERCHANT_UPGRADES, MERCHANT_UPGRADE_GROUPS, type MerchantUpgradeId } from '@/config/merchant';
import { formatNumber } from '@/utils/formatters';
import { merchantLevel, merchantUpgradeCost } from '@/utils/game/merchant';
import ResourceIcon from '../../ResourceIcon';

interface BoughtProps {
	onBought: (what: string, price: number) => void;
}

const UPGRADE_IDS = Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[];
const UPGRADE_GROUPS = Object.keys(MERCHANT_UPGRADE_GROUPS) as (keyof typeof MERCHANT_UPGRADE_GROUPS)[];

/** One permanent bonus: what it gives now and next, and the gold for the next level. */
const UpgradeCard: React.FC<BoughtProps & { id: MerchantUpgradeId }> = ({ id, onBought }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const level = useGameStore((state) => merchantLevel(state.merchantUpgrades, id));
	const buy = useGameStore((state) => state.buyMerchantUpgrade);
	const def = MERCHANT_UPGRADES[id];
	const maxed = level >= def.maxLevel;
	const cost = merchantUpgradeCost(id, level);
	return (
		<div className='px-card text-white'>
			<h3 className='font-semibold mb-1 text-sm'>
				{def.label}{' '}
				<span className='text-[#a89878]'>
					({level}/{def.maxLevel})
				</span>
			</h3>
			<p className='text-sm text-[#d8c8a0] mb-1'>Now: {level > 0 ? def.description(level) : 'nothing yet'}</p>
			{!maxed && <p className='text-xs text-[#a89878] mb-3'>Next level: {def.description(level + 1)}</p>}
			{maxed ? (
				<div className='text-purple-300 text-sm text-center'>Max level</div>
			) : (
				<div className='flex justify-between items-center text-sm mt-2'>
					<p className='text-yellow-400 font-medium'>
						<span className='inline-flex items-center gap-1'>
							{formatNumber(cost)} <ResourceIcon resource='gold' />
						</span>
					</p>
					<button
						className='px-btn px-btn-sm'
						disabled={gold < cost}
						onClick={() => {
							if (buy(id)) onBought(`${def.label} level ${level + 1}`, cost);
						}}
					>
						{gold >= cost ? 'Purchase' : 'Get more gold!'}
					</button>
				</div>
			)}
		</div>
	);
};

/** The permanent bonuses (economy, combat, rebirth), under a heading per group. They lay out in the two columns of the Upgrades tab. */
export const MerchantUpgradeCards: React.FC<BoughtProps> = ({ onBought }) => (
	<>
		{UPGRADE_GROUPS.map((group) => (
			<React.Fragment key={group}>
				<h3 className='col-span-2 px-h text-center mt-2'>{MERCHANT_UPGRADE_GROUPS[group]}</h3>
				{UPGRADE_IDS.filter((id) => MERCHANT_UPGRADES[id].group === group).map((id) => (
					<UpgradeCard key={id} id={id} onBought={onBought} />
				))}
			</React.Fragment>
		))}
	</>
);
