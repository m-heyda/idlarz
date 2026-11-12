import React from 'react';
import { SectionLabel } from '../../../../packages/design-system/src/components/primitives';
import { UpgradeTile } from '../../../../packages/design-system/src/components/upgrade';
import { compact } from '../../../../packages/design-system/src/logic';
import { CLICK_LADDER } from '@/config/economy';
import { MERCHANT_UPGRADES, MERCHANT_UPGRADE_GROUPS, type MerchantUpgradeId } from '@/config/merchant';
import { pixelIconSrc } from '@/config/pixelIcons';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber, formatPercent } from '@/utils/formatters';
import { merchantLevel, merchantUpgradeCost } from '@/utils/game/merchant';

type Group = keyof typeof MERCHANT_UPGRADE_GROUPS;
const GROUPS = Object.keys(MERCHANT_UPGRADE_GROUPS) as Group[];
const IDS = Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[];

interface Entry {
	id: string;
	group: Group;
	name: string;
	level: number;
	maxLevel: number;
	now?: string;
	next?: string;
	cost: number;
	buy: () => void;
}

const power = (p: number) => formatPercent(p * 100);

/**
 * The Upgrades tab: the permanent bonuses in their groups (Economy, Combat, Rebirth), each as a tile with diamond level gems, what it gives now and at the next level, and its price. Inside a group the ones you can afford come first and the
 * maxed ones last. Click Power (the gold-per-click ladder) is the first Economy tile. A purchase is announced by the shared toast, as before.
 */
const MerchantUpgradesTab: React.FC = () => {
	const gold = useGameStore((state) => state.resources.gold);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const clickLevel = useGameStore((state) => state.clickLevel);
	const buyMerchantUpgrade = useGameStore((state) => state.buyMerchantUpgrade);
	const buyClickUpgrade = useGameStore((state) => state.buyClickUpgrade);
	const showToast = useUiStore((state) => state.showToast);

	const entries: Entry[] = [];
	// the click power ladder: level 0 is the start, each step after it is bought
	const nextClick = CLICK_LADDER[clickLevel + 1];
	entries.push({
		id: 'click',
		group: 'economy',
		name: 'Click Power',
		level: clickLevel,
		maxLevel: CLICK_LADDER.length - 1,
		now: `${power(CLICK_LADDER[clickLevel].power)} of your gold/s per click`,
		next: nextClick ? `${power(nextClick.power)} of your gold/s per click` : undefined,
		cost: nextClick?.price ?? 0,
		buy: () => {
			if (nextClick && buyClickUpgrade()) showToast(`Purchased Click Power Level ${clickLevel + 1} for ${formatNumber(nextClick.price)} Gold`);
		},
	});
	for (const id of IDS) {
		const def = MERCHANT_UPGRADES[id];
		const level = merchantLevel(merchantUpgrades, id);
		const cost = merchantUpgradeCost(id, level);
		entries.push({
			id,
			group: def.group as Group,
			name: def.label,
			level,
			maxLevel: def.maxLevel,
			now: level > 0 ? def.description(level) : undefined,
			next: level < def.maxLevel ? def.description(level + 1) : undefined,
			cost,
			buy: () => {
				if (buyMerchantUpgrade(id)) showToast(`Purchased ${def.label} level ${level + 1} for ${formatNumber(cost)} Gold`);
			},
		});
	}

	// inside a group: not maxed before maxed, then what you can afford before what you cannot
	const rank = (e: Entry) => Number(e.level >= e.maxLevel) * 2 + Number(e.cost > gold);

	return (
		<div className='ds-ups'>
			{GROUPS.map((group) => {
				const list = entries.filter((e) => e.group === group).sort((a, b) => rank(a) - rank(b));
				if (list.length === 0) return null;
				return (
					<div key={group}>
						<div className='ds-ups-head'>
							<SectionLabel>{MERCHANT_UPGRADE_GROUPS[group]}</SectionLabel>
							<span className='ds-dim' style={{ fontSize: 12 }}>
								Permanent. Sorted by what you can afford first.
							</span>
						</div>
						<div className='ds-ups-grid'>
							{list.map((e) => (
								<UpgradeTile
									key={e.id}
									name={e.name}
									level={e.level}
									maxLevel={e.maxLevel}
									now={e.now}
									next={e.next}
									cost={e.cost}
									costText={compact(e.cost)}
									costIcon={pixelIconSrc('gold')}
									have={gold}
									shortText={`Need ${compact(e.cost - gold)} more`}
									onBuy={e.buy}
								/>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default MerchantUpgradesTab;
