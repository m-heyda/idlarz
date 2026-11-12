import React from 'react';
import { ResourceChip, Tabs } from '../../../../packages/design-system/src/components/primitives';
import { compact } from '../../../../packages/design-system/src/logic';
import { MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/merchant';
import { CLICK_LADDER } from '@/config/economy';
import { pixelIconSrc } from '@/config/pixelIcons';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { MerchantTab } from '@/types/game';
import { merchantLevel, merchantUpgradeCost } from '@/utils/game/merchant';
import GameWindow from '../GameWindow';
import MerchantOverlay from '../overlays/Merchant/MerchantOverlay';
import MerchantResourcesTab from './MerchantResourcesTab';

const TABS: { id: MerchantTab; label: string; title: string }[] = [
	{ id: 'resources', label: 'Resources', title: 'Sell your resources for gold, or buy them back in packs' },
	{ id: 'goods', label: 'Goods', title: 'Gear and potions on one shelf that changes through the day, and selling from your bag' },
	{ id: 'upgrades', label: 'Upgrades', title: 'Click power and permanent merchant bonuses' },
	{ id: 'quests', label: 'Quests', title: 'Take on special assignments for rewards' },
	{ id: 'gambling', label: 'Gambling', title: 'Test your luck for a chance at riches' },
];

/** How many upgrades the player can buy right now (the click power step and every merchant upgrade not yet maxed): the badge on the Upgrades tab. */
const useAffordableUpgrades = (): number =>
	useGameStore((state) => {
		const gold = state.resources.gold;
		const nextClick = CLICK_LADDER[state.clickLevel + 1];
		let n = nextClick && gold >= nextClick.price ? 1 : 0;
		for (const id of Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[]) {
			const level = merchantLevel(state.merchantUpgrades, id);
			if (level < MERCHANT_UPGRADES[id].maxLevel && gold >= merchantUpgradeCost(id, level)) n += 1;
		}
		return n;
	});

/**
 * The Merchant window (design system `WindowShell`, window id `merchant`): tabs along the top and the gold purse. Resources is the new ledger and trade ticket; Goods, Upgrades, Quests and Gambling keep their own
 * look inside the new window until they are rebuilt, one tab at a time.
 */
const MerchantWindow: React.FC = () => {
	const tab = useUiStore((state) => state.merchantTab);
	const setTab = useUiStore((state) => state.setMerchantTab);
	const gold = useGameStore((state) => state.resources.gold);
	const waiting = useAffordableUpgrades();
	return (
		<GameWindow
			id='merchant'
			title='Merchant'
			width={1100}
			height={720}
			bar={
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as MerchantTab)}
					items={TABS.map((t) => ({ id: t.id, label: t.label, title: t.title, badge: t.id === 'upgrades' && waiting > 0 ? waiting : undefined }))}
				/>
			}
			barRight={<ResourceChip icon={pixelIconSrc('gold')} value={compact(Math.floor(gold))} title='Your gold' />}
		>
			{tab === 'resources' ? <MerchantResourcesTab /> : <MerchantOverlay />}
		</GameWindow>
	);
};

export default MerchantWindow;
