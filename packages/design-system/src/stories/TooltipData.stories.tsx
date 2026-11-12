import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
	BuildingTooltip,
	ChestTooltip,
	DsRoot,
	ItemTooltip,
	MonsterTooltip,
	ResourceTooltip,
	TileTooltip,
	TipCostList,
	TipDiff,
	TipLine,
	TooltipStack,
} from '../index';

const I = (n: string) => `/pixel/icons/${n}.png`;

const meta = {
	title: 'Design System/Tooltips with game data',
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<DsRoot style={{ padding: 24, minHeight: 320, background: '#0b1022', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
				<Story />
			</DsRoot>
		),
	],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** An owned tile: output with the green bonus, adjacency, the purple castle lines and the amber upgrade timer. */
export const OwnedTile: Story = {
	render: () => (
		<TileTooltip
			icon={I('wood')}
			name='Forest'
			castleLevel={4}
			resources={[
				{ icon: I('wood'), name: 'Wood', own: '0.80/s', bonus: '+0.32/s' },
				{ icon: I('food'), name: 'Food', own: '0.20/s' },
			]}
			adjacency='Bonus: 3 adjacent Forest'
			castleLines={[
				'Castle area: +20% production',
				'Castle Bonus: 35% all resource generation',
				'Castle area: +20% production on every tile within 2 tiles (level 5 doubles it)',
			]}
			upgrading='Upgrading to level 5: 4m 12s left'
		/>
	),
};

/** Unexplored land: the cost list (green when affordable, red when not) with the amber discount and the call to action. */
export const UnexploredTile: Story = {
	render: () => (
		<TileTooltip
			icon={I('stone')}
			name='Unexplored Land'
			unexplored
			costs={[
				{ label: 'Gold', icon: I('gold'), have: 5200, cost: 4100, text: '4,100', discount: '-12%' },
				{ label: 'Wood', icon: I('wood'), have: 900, cost: 1500, text: '1,500', discount: '-12%' },
				{ label: 'Stone', icon: I('stone'), have: 2000, cost: 1000, text: '1,000' },
			]}
			cta='Click to explore'
		/>
	),
};

export const Chest: Story = { render: () => <ChestTooltip icon={I('gems')} rows={[{ label: 'May hold', value: 'Gold, XP, an item' }]} /> };

/** A normal monster that is still growing, and a boss with its clock. */
export const Monsters: Story = {
	render: () => (
		<>
			<MonsterTooltip
				icon={I('meat')}
				name='Mossback Wolf'
				subtitle='Lv 12 · Forest'
				hp='640 HP'
				rows={[
					{ label: 'Damage', value: '34 / hit' },
					{ label: 'Your win chance', value: '82%', tone: 'green' },
				]}
				drops={[
					{ label: 'Gold', value: '120' },
					{ label: 'Ragged Feather', value: '4' },
				]}
				defeated={142}
				growth='Level 12 of 20, grows in 8 min'
				cta='Click to fight · Shift + click to queue'
			/>
			<MonsterTooltip
				icon={I('hide')}
				name='The Great Auroch'
				subtitle='Lv 30 · Boss'
				hp='12,400 HP'
				rows={[{ label: 'Damage', value: '210 / hit' }]}
				drops={[{ label: 'Cracked Beast Claw', value: '5', tone: 'gold' }]}
				boss
				defeated={3}
				growth='Fully grown'
				bossLine='Crits 8%, resists Stun 40%. Beat it within 90 seconds'
				cta='In the queue (2)'
				wip
			/>
		</>
	),
};

export const Building: Story = {
	render: () => (
		<BuildingTooltip
			icon={I('wood')}
			name='Lumber camp'
			subtitle='Level 3 · Forest'
			rows={[{ label: 'Wood', value: '+240 / h' }]}
			nextLevel={4}
			next={[
				{ label: 'Cost', value: '1,200 gold' },
				{ label: 'Pays back in', value: '5h' },
			]}
			biomeBonus='Forest bonus: +12% (owned tiles)'
			idolText='Idol of the grove: +4% wood (coming soon: not applied yet)'
			rebirthNote='Its level is kept when you rebirth; rebuild it free'
			cta='Click to open and upgrade'
		/>
	),
};

/** A sword with the primary stat and its changes, blue affixes, lost properties, set changes and the set block, next to the worn piece. */
export const ItemWithCompare: Story = {
	render: () => (
		<TooltipStack>
			<ItemTooltip
				rarity='epic'
				icon={I('menu_equipment')}
				name='Cloudwalker Blade'
				type='Epic sword · Main hand'
				levelLine='Item Level 38 · Quality 91%'
				primary={{ label: 'Damage', value: '86', diff: 12 }}
				speed={[
					{ label: 'Attacks per second', value: '1.20', diff: -0.1, lowerIsBetter: false },
					{ label: 'DPS', value: '103.2', diff: 9.4 },
				]}
				groups={[
					{ heading: 'Offence', rows: [{ label: 'Crit chance', value: <TipDiff value='9%' diff={2} /> }] },
					{ heading: 'Utility', rows: [{ label: 'Luck', value: <TipDiff value='6' diff={-1} /> }] },
				]}
				affixes={[{ text: '+14 Fire damage', name: 'of Embers' }]}
				lost={['+3% Life leech']}
				setChanges={[{ label: 'Cloudwalker', from: 2, to: 3, size: 5 }]}
				set={{
					title: 'Cloudwalker set (3/5)',
					pieces: [
						{ name: 'Cloudwalker Blade', worn: true },
						{ name: 'Cloudwalker Helm', worn: true },
						{ name: 'Cloudwalker Boots', worn: true },
						{ name: 'Cloudwalker Mantle', worn: false },
						{ name: 'Cloudwalker Ring', worn: false },
					],
					bonuses: [
						{ count: 2, text: '+4% Income', active: true },
						{ count: 4, text: '+8% Kill rewards', active: false },
					],
				}}
				flavor='Light as weather.'
				hints='Dbl-click equip · Shift + click sell'
				footer={['Sells for 2,420', '']}
			/>
			<ItemTooltip
				rarity='rare'
				icon={I('menu_equipment')}
				name='Steel Longsword'
				type='Rare sword · Main hand'
				equippedLabel
				primary={{ label: 'Damage', value: '74' }}
				rows={[{ label: 'Crit chance', value: '7%' }]}
				footer={['Sells for 640', '']}
			/>
		</TooltipStack>
	),
};

/** A legendary with its story, and a potion with the Drink button. */
export const LegendaryAndPotion: Story = {
	render: () => (
		<>
			<ItemTooltip
				rarity='legendary'
				icon={I('menu_equipment')}
				name='Emberbrand'
				type='Legendary sword · Main hand'
				levelLine='Item Level 45'
				primary={{ label: 'Damage', value: '120' }}
				flavor='Forged in a dying star. Still warm.'
				lore='The smith who forged it asked the dying star for one favour: stay warm. The star kept its word.'
				footer={['Sells for 48,000', '']}
			/>
			<ItemTooltip
				rarity='uncommon'
				icon={I('food')}
				name='Greater Healing Potion'
				type='Consumable'
				rows={[{ label: 'Restores', value: '90 health', tone: 'green' }]}
				onDrink={() => undefined}
				hints='Dbl-click drink · Shift + click sell'
				footer={['Sells for 90', '']}
			/>
		</>
	),
};

/** A resource tip with the per-source income lines (IDL-314). */
export const ResourceWithSources: Story = {
	render: () => (
		<ResourceTooltip
			icon={I('wood')}
			name='Wood'
			rows={[
				{ label: 'Stock', value: '12.4K' },
				{ label: 'Income', value: '+8.6/s', tone: 'gold' },
				{ label: 'Per hour', value: '+31K' },
			]}
			sources={[
				{ label: 'Tiles', value: '+5.4/s' },
				{ label: 'Castle range', value: '+1.1/s' },
				{ label: 'Foreman +3%', value: '+0.3/s' },
				{ label: 'Set bonus +6%', value: '+0.5/s', tone: 'green' },
			]}
			footer={['Sells for 0.75', 'Click to open Merchant']}
		/>
	),
};

/** The small building blocks on their own. */
export const Pieces: Story = {
	render: () => (
		<div style={{ width: 260 }}>
			<TipLine tone='purple'>Level 4 Castle</TipLine>
			<TipLine tone='amber'>Upgrading to level 5: 4m left</TipLine>
			<TipLine tone='green'>Bonus: 3 adjacent Forest</TipLine>
			<TipLine tone='blue'>+14 Fire damage of Embers</TipLine>
			<TipLine tone='gold'>Click to explore</TipLine>
			<TipCostList
				costs={[
					{ label: 'Gold', have: 10, cost: 5 },
					{ label: 'Wood', have: 1, cost: 5, discount: '-10%' },
				]}
			/>
		</div>
	),
};
