import React, { useEffect, useState } from 'react';
import {
	Button,
	ChipGroup,
	GlyphButton,
	TopBar,
	Dock,
	ResourceStat,
	MiniMap,
	compact,
	DsRoot,
	IconButton,
	Inset,
	Panel,
	ProgressBar,
	ResourceChip,
	SectionLabel,
	Slot,
	Stat,
	Tabs,
	UpgradeTile,
	WindowShell,
	Divider,
	Badge,
	ItemTooltip,
	ResourceTooltip,
	MonsterTooltip,
	BuildingTooltip,
	HintTooltip,
	Tooltip,
	type Rarity,
} from '../index';

const I = (name: string) => `/pixel/icons/${name}.png`;
const R = (name: string) => `/pixel/resources/${name}.png`;

interface MockRes {
	id: string;
	name: string;
	icon: string;
	amount: number;
	/** income per second; 0 for things that do not accrue */
	rate: number;
	sources: { label: string; value: string }[];
	sell?: string;
}
const GROUPS: MockRes[][] = [
	[
		{
			id: 'gold',
			name: 'Gold',
			icon: I('gold'),
			amount: 102000,
			rate: 295.5,
			sources: [
				{ label: 'Tiles', value: '+240.0' },
				{ label: 'Haggler +9%', value: '+55.5' },
			],
		},
		{ id: 'gems', name: 'Gems', icon: I('diamond'), amount: 2800, rate: 0, sources: [{ label: 'Chests, deeds', value: 'rare' }] },
	],
	[
		{
			id: 'wood',
			name: 'Wood',
			icon: R('wood'),
			amount: 487210,
			rate: 299.8,
			sell: '0.82',
			sources: [
				{ label: '12 Lumber camps', value: '+240.0' },
				{ label: 'Foreman +3%', value: '+8.6' },
				{ label: 'Set bonus +6%', value: '+17.2' },
			],
		},
		{
			id: 'stone',
			name: 'Stone',
			icon: R('stone'),
			amount: 560400,
			rate: 148,
			sell: '0.98',
			sources: [
				{ label: '6 Quarries', value: '+130.0' },
				{ label: 'Foreman +3%', value: '+4.0' },
			],
		},
		{
			id: 'coal',
			name: 'Coal',
			icon: R('coal'),
			amount: 68500,
			rate: 831,
			sell: '1.20',
			sources: [
				{ label: '9 Coal pits', value: '+790.0' },
				{ label: 'Foreman +3%', value: '+23.7' },
			],
		},
		{
			id: 'food',
			name: 'Food',
			icon: R('food'),
			amount: 5820000,
			rate: 937.8,
			sell: '0.44',
			sources: [
				{ label: '14 Farms', value: '+900.0' },
				{ label: 'Foreman +3%', value: '+27.0' },
			],
		},
		{
			id: 'meat',
			name: 'Meat',
			icon: R('meat'),
			amount: 4410000,
			rate: 899.9,
			sell: '1.09',
			sources: [
				{ label: '10 Ranches', value: '+860.0' },
				{ label: 'Skinner +10%', value: '+30.0' },
			],
		},
	],
	[
		{ id: 'eggs', name: 'Eggs', icon: R('eggs'), amount: 124000, rate: 0, sources: [{ label: 'Chickens', value: 'farm' }] },
		{ id: 'milk', name: 'Milk', icon: R('milk'), amount: 229000, rate: 0, sources: [{ label: 'Cows', value: 'farm' }] },
		{ id: 'hide', name: 'Hide', icon: R('hide'), amount: 1110000, rate: 0, sources: [{ label: 'Hunting', value: 'monsters' }] },
	],
];

/** Counts up the mock stock once a second, so the tooltips can show income that really moves. */
const useLiveAmounts = (): Record<string, number> => {
	const [t, setT] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setT((v) => v + 1), 1000);
		return () => clearInterval(id);
	}, []);
	return Object.fromEntries(GROUPS.flat().map((r) => [r.id, r.amount + r.rate * t]));
};

const fmtInt = (n: number) => Math.floor(n).toLocaleString('en-US');

/**
 * The game screen: a clean top bar with resources only (hover one for stock, live income and sources) and Deeds + Settings on the right, the map filling the middle, a stone icon dock
 * for the windows along the bottom, a minimap with its counters laid over the map. The character sheet that used to sit on the left is a window now.
 */
export const GameHudView: React.FC<{ width?: number; height?: number }> = ({ width = 1280, height = 720 }) => {
	const live = useLiveAmounts();
	return (
		<DsRoot
			style={{ width, height, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 50% 45%, #2f6b3a, #1b4a2a 55%, #0d2a18)' }}
		>
			<TopBar
				right={
					<>
						<GlyphButton glyph='★' label='Deeds' />
						<GlyphButton glyph='⚙' label='Settings' />
					</>
				}
			>
				{GROUPS.map((g, gi) => (
					<ChipGroup key={gi}>
						{g.map((r) => (
							<ResourceStat
								key={r.id}
								icon={r.icon}
								name={r.name}
								value={compact(live[r.id])}
								rows={[
									{ label: 'Stock', value: fmtInt(live[r.id]) },
									{ label: 'Income', value: r.rate ? <span className='ds-good'>+{r.rate.toFixed(1)}/s</span> : 'none' },
									...(r.rate ? [{ label: 'Per hour', value: compact(r.rate * 3600) }] : []),
								]}
								sources={r.rate ? r.sources : undefined}
								footer={[r.sell ? `Sells for ${r.sell}` : r.sources[0].label, 'Click to open Merchant']}
							/>
						))}
					</ChipGroup>
				))}
			</TopBar>
			<div style={{ position: 'absolute', left: '50%', bottom: 2, transform: 'translateX(-50%)' }}>
				<Dock>
					<IconButton icon={I('menu_equipment')} label='Hero' badge={1} />
					<IconButton icon={I('menu_merchant')} label='Merchant' badge={8} />
					<IconButton icon={I('menu_farm')} label='Realm' />
					<IconButton icon={I('menu_crafting')} label='Fight' />
					<IconButton icon={I('menu_glossary')} label='Bestiary' />
					<IconButton icon={I('menu_achievements')} label='Deeds' badge={8} />
					<IconButton icon={I('menu_legacy')} label='Rebirth' />
				</Dock>
			</div>
			<div style={{ position: 'absolute', right: 14, bottom: 14 }}>
				<MiniMap
					width={200}
					height={128}
					stats={[
						{ tone: 'bad', text: '▮ 10' },
						{ tone: 'gold', text: '▮ 1' },
						{ tone: 'dim', text: '350 tiles' },
					]}
				>
					<div style={{ height: '100%', background: 'linear-gradient(#e8f1f8 0 40%, #4f9a4c 40%)' }} />
				</MiniMap>
			</div>
		</DsRoot>
	);
};

/** Placeholder hero figure: a dark human silhouette on a soft vignette, until class art is chosen. */
const Silhouette: React.FC = () => (
	<div
		style={{
			height: 210,
			display: 'grid',
			placeItems: 'end center',
			overflow: 'hidden',
			background: 'radial-gradient(ellipse at 50% 35%, #1d1a24, #0a0809 75%)',
			border: '1px solid #3a2c1c',
		}}
	>
		<svg viewBox='0 0 100 130' width='150' height='195' aria-label='Hero silhouette'>
			<path
				d='M50 6c-9 0-15 7-15 17 0 7 3 12 7 15v5c-14 3-26 8-30 22l-4 30c0 4 3 6 6 6h10l3 25h46l3-25h10c3 0 6-2 6-6l-4-30c-4-14-16-19-30-22v-5c4-3 7-8 7-15 0-10-6-17-15-17z'
				fill='#07060a'
				stroke='#241f2c'
				strokeWidth='1.5'
			/>
		</svg>
	</div>
);

const EQUIP_LEFT = ['head', 'neck', 'shoulder', 'hands', 'chest', 'legs'];
const EQUIP_RIGHT = ['cape', 'belt', 'ring', 'charm', 'feet', 'ring'];

const bagItems: { icon: string; rarity?: Rarity; count?: number }[] = [
	{ icon: I('item_potion_hp'), count: 88 },
	{ icon: I('item_wooden_sword'), rarity: 'uncommon' },
	{ icon: I('item_bronze_hammer'), rarity: 'rare' },
	{ icon: I('item_cloth_robe'), rarity: 'epic' },
	{ icon: I('item_emberbrand'), rarity: 'legendary' },
	{ icon: I('item_wooden_ring') },
	{ icon: I('item_cloth_hat'), rarity: 'uncommon' },
];

/**
 * The compact character screen: plaque with name and class, equipment ring around the portrait, vitals, hands and skills, XP bar, and a right panel with the Bag, Stats and Crafting tabs.
 */
export const HeroWindowView: React.FC = () => {
	const [tab, setTab] = useState('bag');
	return (
		<DsRoot style={{ padding: '30px 20px 20px', background: '#0b1022', width: 'fit-content' }}>
			<WindowShell
				title='Hero'
				width={1180}
				height={680}
				bar={
					<Tabs
						active={tab}
						onChange={setTab}
						items={[
							{ id: 'bag', label: 'Bag' },
							{ id: 'stats', label: 'Stats', badge: 1 },
							{ id: 'craft', label: 'Crafting' },
						]}
					/>
				}
				barRight={
					<span className='ds-dim' style={{ fontSize: 13 }}>
						9 of 40 slots used
					</span>
				}
			>
				<div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 12, height: '100%' }}>
					<Panel style={{ padding: 0 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 4 }}>
							<span className='ds-badge' style={{ width: 34, height: 34, fontSize: 15, background: '#6a22b3' }}>
								31
							</span>
							<div>
								<div style={{ fontSize: 18 }}>Insane</div>
								<div className='ds-dim ds-caps' style={{ fontSize: 11 }}>
									Angel Paladin
								</div>
							</div>
						</div>
						<Divider />
						<div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 6, alignItems: 'start' }} className='ds-slots-sm'>
							<div style={{ display: 'grid', gap: 4 }}>
								{EQUIP_LEFT.map((s) => (
									<Slot key={s} icon={I(`equip_${s}`)} empty />
								))}
							</div>
							<div>
								<Silhouette />
								<div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
									<ProgressBar value={278} max={278} label='HP 278 / 278' />
									<ProgressBar value={101} max={101} tone='mana' label='MP 101 / 101' />
								</div>
							</div>
							<div style={{ display: 'grid', gap: 4 }}>
								{EQUIP_RIGHT.map((s, i) => (
									<Slot key={i} icon={I(`equip_${s}`)} empty />
								))}
							</div>
						</div>
						<SectionLabel>Hands and skills</SectionLabel>
						<div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
							<Slot icon={I('equip_mainHand')} rarity='rare' />
							<Slot icon={I('equip_offHand')} rarity='epic' />
							<Slot title='Heal' />
							<Slot title='Stun' />
						</div>
						<div style={{ marginTop: 8 }}>
							<ProgressBar value={66} max={100} tone='xp' label='Level 31 · 66%' />
						</div>
						<Inset style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
							<Stat label='Damage' value='106.6' />
							<Stat label='Armor' value='85' />
							<Stat label='Crit' value='36.6%' />
							<Stat label='Item lvl' value='19.8' />
						</Inset>
					</Panel>
					<Panel style={{ display: 'flex', flexDirection: 'column' }}>
						<Inset
							style={{
								flex: 1,
								display: 'grid',
								gridTemplateColumns: 'repeat(10, 60px)',
								gridAutoRows: 60,
								justifyContent: 'space-evenly',
								gap: 6,
								alignContent: 'start',
							}}
						>
							{Array.from({ length: 40 }, (_, i) => {
								const it = bagItems[i];
								return <Slot key={i} icon={it?.icon} rarity={it?.rarity} count={it?.count} />;
							})}
						</Inset>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
							<Button>Organise</Button>
							<Button tone='gold'>Sell junk</Button>
							<span className='ds-dim' style={{ marginLeft: 'auto', fontSize: 12 }}>
								Double-click to equip or drink. Right-click for more. Drag to rearrange.
							</span>
						</div>
					</Panel>
				</div>
			</WindowShell>
		</DsRoot>
	);
};

const ledger = [
	{ icon: R('wood'), name: 'Wood', have: '484K', rate: '+299/s', sell: '0.82', buy: '1.90' },
	{ icon: R('stone'), name: 'Stone', have: '558K', rate: '+148/s', sell: '0.98', buy: '1.80' },
	{ icon: R('coal'), name: 'Coal', have: '683K', rate: '+831/s', sell: '1.20', buy: '2.20' },
	{ icon: R('food'), name: 'Food', have: '5.81M', rate: '+937/s', sell: '0.44', buy: '0.80' },
	{ icon: R('meat'), name: 'Meat', have: '4.40M', rate: '+899/s', sell: '1.09', buy: '2.00' },
];

const upgrades = [
	{ name: 'Bulk Discount', level: 0, max: 8, now: undefined, next: '-1% tile cost', cost: 250000, text: '250K' },
	{ name: 'Haggler', level: 3, max: 10, now: '+9% gold on everything you sell', next: '+12% gold on everything you sell', cost: 686000, text: '686K' },
	{ name: 'Click Power', level: 2, max: 8, now: 'a click pays 200% of your gold/s', next: 'a click pays 400% of your gold/s', cost: 730000, text: '730K' },
	{ name: 'Foreman', level: 3, max: 10, now: '+3% income from every resource', next: '+4% income from every resource', cost: 900000, text: '900K' },
	{ name: 'Lucky Charm', level: 3, max: 10, now: '+6 Luck for chests and kills', next: '+8 Luck for chests and kills', cost: 1030000, text: '1.03M' },
	{ name: 'Pack Rat', level: 1, max: 4, now: '+4 bag slots', next: '+8 bag slots', cost: 1900000, text: '1.90M' },
	{ name: 'Skinner', level: 2, max: 10, now: '+10% meat and hide from animals', next: '+15% meat and hide from animals', cost: 90000, text: '90K' },
	{ name: 'Tinker', level: 4, max: 4, now: '+20% craft speed', next: undefined, cost: 0, text: '' },
];

/**
 * The merchant: tabs along the top with the gold purse on the right. Resources shows a parchment stock ledger plus a trade ticket; Upgrades is a grid of upgrade tiles whose level
 * is shown as diamond gems (yellow, purple when maxed), sorted by what you can afford first.
 */
export const MerchantView: React.FC<{ initialTab?: 'resources' | 'upgrades' }> = ({ initialTab = 'upgrades' }) => {
	const [tab, setTab] = useState<string>(initialTab);
	const [sel, setSel] = useState(0);
	const gold = 102000;
	return (
		<DsRoot style={{ padding: '30px 20px 20px', background: '#0b1022', width: 'fit-content' }}>
			<WindowShell
				title='Merchant'
				width={1180}
				height={640}
				bar={
					<Tabs
						active={tab}
						onChange={setTab}
						items={[
							{ id: 'resources', label: 'Resources' },
							{ id: 'goods', label: 'Goods' },
							{ id: 'upgrades', label: 'Upgrades', badge: 1 },
							{ id: 'quests', label: 'Quests', badge: 8 },
							{ id: 'gambling', label: 'Gambling' },
						]}
					/>
				}
				barRight={<ResourceChip icon={I('gold')} value='102K' />}
			>
				{tab === 'upgrades' ? (
					<div style={{ padding: 6 }}>
						<p style={{ margin: '0 0 8px', fontSize: 13 }}>
							<span className='ds-gold-text ds-caps' style={{ marginRight: 8 }}>
								Economy
							</span>
							<span className='ds-dim'>Permanent. Sorted by what you can afford first.</span>
						</p>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
							{[...upgrades]
								.sort((a, b) => Number(a.cost > gold) - Number(b.cost > gold))
								.map((u) => (
									<UpgradeTile
										key={u.name}
										name={u.name}
										icon={I('gold')}
										level={u.level}
										maxLevel={u.max}
										now={u.now}
										next={u.next}
										cost={u.cost}
										costText={u.text}
										costIcon={I('gold')}
										have={gold}
										shortText={`Need ${Math.max(0, Math.round((u.cost - gold) / 1000))}K more`}
									/>
								))}
						</div>
					</div>
				) : (
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, minHeight: 500 }}>
						<Panel parchment style={{ overflow: 'hidden' }}>
							<SectionLabel>Stock ledger</SectionLabel>
							<div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 90px 60px 60px', gap: 4, padding: '8px 4px', fontSize: 11, opacity: 0.7 }}>
								<span />
								<span>RESOURCE</span>
								<span>YOU HAVE</span>
								<span>INCOME</span>
								<span>SELL</span>
								<span>BUY</span>
							</div>
							{ledger.map((r, i) => (
								<div
									key={r.name}
									onClick={() => setSel(i)}
									style={{
										display: 'grid',
										gridTemplateColumns: '28px 1fr 80px 90px 60px 60px',
										gap: 4,
										alignItems: 'center',
										padding: '6px 4px',
										borderTop: '1px solid rgba(74,53,22,.25)',
										background: sel === i ? 'rgba(120,80,160,.25)' : undefined,
										cursor: 'pointer',
										fontSize: 14,
									}}
								>
									<img src={r.icon} alt='' width={22} height={22} />
									<span>{r.name}</span>
									<span>{r.have}</span>
									<span style={{ color: '#2d7a3f' }}>{r.rate}</span>
									<span>{r.sell}</span>
									<span style={{ color: '#2b4ea8' }}>{r.buy}</span>
								</div>
							))}
						</Panel>
						<Panel>
							<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
								<Slot large icon={ledger[sel].icon} />
								<div>
									<div style={{ fontSize: 18 }}>{ledger[sel].name}</div>
									<div className='ds-dim' style={{ fontSize: 12 }}>
										You have {ledger[sel].have} · {ledger[sel].rate} income
									</div>
								</div>
							</div>
							<div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
								<Button tone='gold' style={{ flex: 1 }}>
									Sell
								</Button>
								<Button tone='dark' style={{ flex: 1 }}>
									Buy
								</Button>
							</div>
							<SectionLabel>Amount</SectionLabel>
							<div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
								<Button>10%</Button>
								<Button tone='gold'>25%</Button>
								<Button>50%</Button>
								<Button>Max</Button>
							</div>
							<Inset style={{ fontSize: 13 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between' }}>
									<span className='ds-dim'>121,120 × 0.82 gold</span>
									<span>91.1K</span>
								</div>
								<div style={{ display: 'flex', justifyContent: 'space-between' }}>
									<span className='ds-dim'>Haggler +9%</span>
									<span className='ds-good'>+8.2K</span>
								</div>
								<Divider />
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<span className='ds-gold-text ds-caps'>You receive</span>
									<span style={{ fontSize: 22, color: 'var(--ds-good)' }}>99.3K gold</span>
								</div>
							</Inset>
							<Button tone='gold' style={{ width: '100%', marginTop: 10, minHeight: 42 }}>
								Sell 121K wood
							</Button>
						</Panel>
					</div>
				)}
			</WindowShell>
		</DsRoot>
	);
};

/** Building upgrades: the same tile as the merchant, with gems for building level and gold + material costs; a tooltip appears on the first tile to show the pairing. */
export const BuildingUpgradesView: React.FC = () => {
	const b = [
		{ name: 'Lumber Camp', icon: I('menu_farm'), level: 3, max: 5, now: '+20 wood/s', next: '+26 wood/s', cost: 42000, text: '42K' },
		{ name: 'Quarry', icon: I('menu_crafting'), level: 1, max: 5, now: '+8 stone/s', next: '+12 stone/s', cost: 18000, text: '18K' },
		{ name: 'Smokehouse', icon: I('menu_merchant'), level: 5, max: 5, now: '+40 meat/s', next: undefined, cost: 0, text: '' },
		{ name: 'Barn', icon: I('menu_farm'), level: 0, max: 5, now: undefined, next: '+4 milk/s', cost: 2400000, text: '2.40M' },
		{ name: 'Mill', icon: I('menu_crafting'), level: 2, max: 5, now: '+14 food/s', next: '+20 food/s', cost: 96000, text: '96K' },
		{ name: 'Forge', icon: I('menu_equipment'), level: 4, max: 5, now: '+12 coal/s', next: '+16 coal/s', cost: 310000, text: '310K' },
	];
	return (
		<DsRoot style={{ padding: '30px 20px 20px', background: '#0b1022', width: 'fit-content' }}>
			<WindowShell
				title='Realm upgrades'
				width={1180}
				height={560}
				bar={
					<span className='ds-gold-text ds-caps' style={{ fontSize: 13 }}>
						Buildings
					</span>
				}
				barRight={<ResourceChip icon={I('gold')} value='102K' />}
			>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 6 }}>
					{b.map((u) => (
						<UpgradeTile
							key={u.name}
							name={u.name}
							icon={u.icon}
							level={u.level}
							maxLevel={u.max}
							now={u.now}
							next={u.next}
							cost={u.cost}
							costText={u.text}
							costIcon={I('gold')}
							have={102000}
							shortText='Need more'
						/>
					))}
				</div>
			</WindowShell>
		</DsRoot>
	);
};

/** Every tooltip in one board: items (each rarity glow), compare, resource, monster, building, upgrade/skill, hints. */
export const TooltipsView: React.FC = () => (
	<DsRoot style={{ padding: 24, background: 'radial-gradient(circle at 30% 20%, #1a2a4a, #0a0f1f)', width: 'fit-content' }}>
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 260px)', gap: 28, alignItems: 'start' }}>
			<ItemTooltip
				rarity='rare'
				icon={I('item_bronze_hammer')}
				name='Warden’s Maul'
				type='Rare · Two-handed · ilvl 15'
				rows={[
					{ label: 'Damage', value: '84 - 112' },
					{ label: 'Attack speed', value: '0.64/s' },
					{ label: 'Strength', value: '+6' },
				]}
				flavor='Forged for a gate that never opened.'
				footer={['Worn', 'Sell 4.2K']}
			/>
			<ItemTooltip
				rarity='epic'
				icon={I('item_emberbrand')}
				name='Thornheart Orb'
				type='Epic · Off-hand · ilvl 18'
				rows={[
					{ label: 'Magic ATK', value: '+31%' },
					{ label: 'Mana regen', value: '2.0/s' },
				]}
				compareWith='Spiked Orb'
				compare={[
					{ label: 'Magic ATK', value: <span className='ds-good'>+7%</span> },
					{ label: 'Armor', value: <span className='ds-bad'>-12</span> },
				]}
				footer={[
					<>
						<span className='ds-kbd'>Dbl-click</span>equip
					</>,
					<>
						<span className='ds-kbd'>Shift</span>+click sell
					</>,
				]}
			/>
			<ItemTooltip
				rarity='legendary'
				icon={I('item_emberbrand')}
				name='Emberbrand'
				type='Legendary · Sword · ilvl 30'
				rows={[
					{ label: 'Damage', value: '210 - 260' },
					{ label: 'Fire damage', value: '+18%' },
				]}
				flavor='It remembers every fire.'
				footer={['Bag', 'Sell 40K']}
			/>
			<Tooltip rarity='common' icon={I('item_potion_hp')} title='Health Potion' subtitle='Common · Potion · 52 in bag'>
				<div className='ds-tip-note'>Restores 120 HP over 3 s. Auto-drinks below 35% HP when enabled.</div>
			</Tooltip>
			<ResourceTooltip
				icon={R('wood')}
				name='Wood'
				rows={[
					{ label: 'Stock', value: '487,210' },
					{ label: 'Income', value: <span className='ds-good'>+299.8/s</span> },
				]}
				sources={[
					{ label: '12 Lumber camps', value: '+240.0' },
					{ label: 'Foreman +3%', value: '+8.6' },
				]}
				footer={['Sells for 0.82', 'Click to open Merchant']}
			/>
			<MonsterTooltip
				icon={I('bonus_wolf')}
				name='Grey Wolf'
				subtitle='Beast · Level 14 · Hostile'
				hp='1,840'
				rows={[
					{ label: 'Damage', value: '22 - 31' },
					{ label: 'Your odds', value: <span className='ds-good'>Easy</span> },
				]}
				drops={[
					{ label: 'Hide ×3–6', value: '80%' },
					{ label: 'Wolf fang', value: '6%' },
				]}
				footer={['Bestiary 142 / 200', 'Next: +2% gold find']}
			/>
			<BuildingTooltip
				icon={I('menu_farm')}
				name='Lumber Camp'
				subtitle='Tile 214 · Forest · Level 3'
				rows={[
					{ label: 'Produces', value: '+20 wood/s' },
					{ label: 'Upkeep', value: 'none' },
				]}
				nextLevel={4}
				next={[
					{ label: 'Output', value: '+20 → +26/s' },
					{ label: 'Cost', value: '42K gold' },
					{ label: 'Pays back in', value: '2h 10m' },
				]}
				footer={[
					<>
						<span className='ds-kbd'>Click</span>upgrade
					</>,
					<>
						<span className='ds-kbd'>R</span>rotate
					</>,
				]}
			/>
			<div style={{ display: 'grid', gap: 12 }}>
				<HintTooltip title='Organise bag' text='Stacks potions, sorts gear by slot.' />
				<HintTooltip title='Not enough gold' text='Need 648K more.' tone='bad' />
				<HintTooltip title='Offline earnings' text='8h cap · 50% income · 2h 14m banked' />
			</div>
		</div>
	</DsRoot>
);

export { Badge };
