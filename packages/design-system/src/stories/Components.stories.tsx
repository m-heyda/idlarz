import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
	AmountInput,
	clampAmount,
	parseAmountText,
	ChipGroup,
	Dock,
	GlyphButton,
	HoverTip,
	MiniMap,
	NotifyBadge,
	ResourceTooltip,
	TopBar,
	Badge,
	Button,
	DiamondLevel,
	DsRoot,
	Frame,
	HintTooltip,
	IconButton,
	ItemTooltip,
	Panel,
	ProgressBar,
	RARITIES,
	ResourceChip,
	Slot,
	Stat,
	Tabs,
	UpgradeTile,
	WindowShell,
} from '../index';

const I = (n: string) => `/pixel/icons/${n}.png`;

const meta = {
	title: 'Design System/Components',
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<DsRoot style={{ padding: 24, minHeight: 300, background: '#0b1022' }}>
				<Story />
			</DsRoot>
		),
	],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Frames and panels: window frame (stone + gold), inner panel, parchment panel. */
export const Frames: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
			<Frame style={{ width: 320, height: 200 }}>Frame (a)</Frame>
			<Frame variant='b' style={{ width: 320, height: 200 }}>
				Frame (b)
			</Frame>
			<Panel style={{ width: 220, height: 140 }}>Panel</Panel>
			<Panel parchment style={{ width: 220, height: 140 }}>
				Parchment panel
			</Panel>
		</div>
	),
};

/** Buttons in every tone, plus disabled. */
export const Buttons: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 12 }}>
			<Button>Stone</Button>
			<Button tone='gold'>Gold</Button>
			<Button tone='wood'>Wood</Button>
			<Button tone='dark' disabled>
				Need 148K more
			</Button>
		</div>
	),
};

/** Tabs with a notification badge; click to switch. */
export const TabsStory: Story = {
	name: 'Tabs',
	render: () => <TabsDemo />,
};

const TabsDemo: React.FC = () => {
	const [a, setA] = React.useState('bag');
	return (
		<Tabs
			active={a}
			onChange={setA}
			items={[
				{ id: 'bag', label: 'Bag' },
				{ id: 'stats', label: 'Stats', badge: 1 },
				{ id: 'craft', label: 'Crafting' },
			]}
		/>
	);
};

/** Item slots: empty, plain and one per rarity (rare and above glow). */
export const Slots: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 10 }}>
			<Slot icon={I('equip_head')} empty />
			{RARITIES.map((r) => (
				<Slot key={r} icon={I('item_bronze_hammer')} rarity={r} count={r === 'common' ? 12 : undefined} />
			))}
			<Slot icon={I('item_bronze_hammer')} locked />
		</div>
	),
};

/** Diamond level indicator: in progress (yellow) and maxed (purple). */
export const LevelGems: Story = {
	render: () => (
		<div style={{ display: 'grid', gap: 10 }}>
			<DiamondLevel level={0} max={8} />
			<DiamondLevel level={3} max={8} />
			<DiamondLevel level={8} max={8} />
		</div>
	),
};

/** Upgrade tiles: ready, short on gold, maxed. */
export const UpgradeTiles: Story = {
	render: () => (
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 340px)', gap: 12 }}>
			<UpgradeTile
				name='Haggler'
				icon={I('gold')}
				level={3}
				maxLevel={10}
				now='+9% gold on sales'
				next='+12% gold on sales'
				cost={50000}
				costText='50K'
				costIcon={I('gold')}
				have={102000}
			/>
			<UpgradeTile
				name='Pack Rat'
				icon={I('gold')}
				level={1}
				maxLevel={4}
				now='+4 bag slots'
				next='+8 bag slots'
				cost={1900000}
				costText='1.90M'
				costIcon={I('gold')}
				have={102000}
				shortText='Need 1.80M more'
			/>
			<UpgradeTile name='Tinker' icon={I('gold')} level={4} maxLevel={4} now='+20% craft speed' cost={0} costText='' have={0} />
		</div>
	),
};

/** Small pieces: resource chips, bars, stats, badge, menu icon buttons, hint tooltip. */
export const SmallParts: Story = {
	render: () => (
		<div style={{ display: 'grid', gap: 16, width: 420 }}>
			<div style={{ display: 'flex', gap: 8 }}>
				<ResourceChip icon={I('gold')} value='102K' />
				<ResourceChip icon={'/pixel/resources/wood.png'} value='487K' rate='+299/s' />
			</div>
			<ProgressBar value={278} max={278} label='HP 278 / 278' />
			<ProgressBar value={101} max={101} tone='mana' label='MP 101 / 101' />
			<ProgressBar value={66} max={100} tone='xp' label='Level 31 · 66%' />
			<div style={{ display: 'flex', gap: 24 }}>
				<Stat label='Damage' value='106.6' />
				<Stat label='Crit' value='36.6%' />
				<Badge count={3} />
			</div>
			<div style={{ display: 'flex', gap: 8 }}>
				<IconButton icon={I('menu_character')} label='Hero' badge={1} />
				<IconButton icon={I('menu_merchant')} label='Merchant' />
			</div>
			<HintTooltip title='Organise bag' text='Stacks potions, sorts gear by slot.' />
		</div>
	),
};

/** Tooltip with rarity glow, one per rarity. */
export const TooltipRarities: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
			{RARITIES.map((r) => (
				<ItemTooltip
					key={r}
					rarity={r}
					icon={I('item_bronze_hammer')}
					name={`${r[0].toUpperCase()}${r.slice(1)} Maul`}
					type={`${r} · Two-handed`}
					rows={[{ label: 'Damage', value: '84 - 112' }]}
				/>
			))}
		</div>
	),
};

/** The window shell on its own. */
export const Window: Story = {
	render: () => (
		<div style={{ paddingTop: 20 }}>
			<WindowShell
				title='Window'
				width={700}
				height={360}
				bar={
					<Tabs
						active='a'
						items={[
							{ id: 'a', label: 'One' },
							{ id: 'b', label: 'Two' },
						]}
					/>
				}
			>
				<Panel style={{ height: '100%' }}>Body</Panel>
			</WindowShell>
		</div>
	),
};

/** The orange glowing notification counter, on its own and pinned to an icon button. */
export const NotificationBadge: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
			<NotifyBadge count={1} />
			<NotifyBadge count={8} />
			<NotifyBadge count={24} />
			<div style={{ position: 'relative' }}>
				<IconButton icon={I('menu_merchant')} label='Merchant' badge={8} />
			</div>
		</div>
	),
};

/** Glyph buttons in every tone. */
export const GlyphButtons: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 12 }}>
			<GlyphButton glyph='★' label='Deeds' />
			<GlyphButton glyph='⚙' label='Settings' tone='wood' />
			<GlyphButton glyph='✕' label='Close' tone='stone' />
		</div>
	),
};

/** The wooden top bar with cut-out resource groups, hover a chip for its tooltip. */
export const TopBarWithGroups: Story = {
	render: () => (
		<TopBar
			right={
				<>
					<GlyphButton glyph='★' label='Deeds' />
					<GlyphButton glyph='⚙' label='Settings' />
				</>
			}
		>
			<ChipGroup>
				<HoverTip tip={<ResourceTooltip icon={I('gold')} name='Gold' rows={[{ label: 'Stock', value: '102,000' }]} />}>
					<ResourceChip icon={I('gold')} value='102K' />
				</HoverTip>
				<ResourceChip icon={I('diamond')} value='2.80K' />
			</ChipGroup>
			<ChipGroup>
				<ResourceChip icon='/pixel/resources/wood.png' value='487K' />
				<ResourceChip icon='/pixel/resources/stone.png' value='560K' />
			</ChipGroup>
		</TopBar>
	),
};

/** The stone dock with its gold frame. */
export const MenuDock: Story = {
	render: () => (
		<Dock>
			<IconButton icon={I('menu_equipment')} label='Hero' badge={1} />
			<IconButton icon={I('menu_merchant')} label='Merchant' badge={8} />
			<IconButton icon={I('menu_farm')} label='Realm' />
		</Dock>
	),
};

/** Minimap with the counters laid over the map. */
export const MiniMapStory: Story = {
	name: 'MiniMap',
	render: () => (
		<MiniMap
			stats={[
				{ tone: 'bad', text: '▮ 10' },
				{ tone: 'gold', text: '▮ 1' },
				{ tone: 'dim', text: '350 tiles' },
			]}
		>
			<div style={{ height: '100%', background: 'linear-gradient(#e8f1f8 0 40%, #4f9a4c 40%)' }} />
		</MiniMap>
	),
};

/** The amount of a trade: presets (1K, 1M, Max), a typed field with k / m / b suffixes (typed wins over a preset), a slider and an invalid state. */
export const AmountInputStory: Story = {
	name: 'AmountInput',
	render: function Render() {
		const [text, setText] = React.useState('');
		const [preset, setPreset] = React.useState<string | number | null>(1000);
		const max = 2_450_000;
		const typed = text.trim() === '' ? null : parseAmountText(text);
		const value = clampAmount(typed ?? (preset === 'max' ? max : Number(preset ?? 0)), max);
		return (
			<div style={{ width: 460 }}>
				<AmountInput
					value={value}
					max={max}
					text={text}
					onTextChange={setText}
					presets={[
						{ id: 1000, label: '1K' },
						{ id: 1_000_000, label: '1M' },
						{ id: 'max', label: 'Max' },
					]}
					activePreset={preset}
					onPreset={(id) => {
						setPreset(id);
						setText('');
					}}
					onSlider={(n) => setText(String(n))}
				/>
				<p style={{ color: '#9aa4bd', fontSize: 12, marginTop: 12 }}>Amount: {value.toLocaleString('en-US')}</p>
			</div>
		);
	},
};
