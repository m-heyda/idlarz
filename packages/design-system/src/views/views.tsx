import React, { useEffect, useState } from 'react';
import {
	Button,
	AddSlot,
	HeroIdentity,
	Modal,
	AvatarGrid,
	BadgeTitlePicker,
	XpBar,
	CraftStash,
	type StashEntry,
	ContextMenu,
	EquipGroup,
	type MenuState,
	Slider,
	CollapsibleGroup,
	CraftQueue,
	type CraftQueueEntry,
	TipRows,
	type AvatarCard,
	type BadgeOption,
	type TitleChoice,
	ChipGroup,
	GlyphButton,
	TopBar,
	Dock,
	ResourceStat,
	HoverTip,
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

const STASH_START: StashEntry[] = [
	{ id: 'vial', name: 'Glass Vial', icon: I('comp_glass_vial'), qty: 3470, kind: 'component' },
	{ id: 'scraps', name: 'Bound scraps', icon: I('item_bound_scraps'), qty: 214, kind: 'component' },
	{ id: 'hp2', name: 'Greater Potion', icon: I('item_potion_greater'), qty: 36, kind: 'potion', stack: 20 },
	{ id: 'cloth', name: 'Cloth bolt', icon: R('cloth'), qty: 12, kind: 'good', stack: 20 },
	{ id: 'dye', name: 'Dye', icon: R('dye'), qty: 3, kind: 'good', stack: 20 },
	{ id: 'bone', name: 'Bone token', icon: I('item_bone_token'), qty: 5, kind: 'special' },
	{ id: 'acorn', name: 'Acorn charm', icon: I('item_acorn_charm'), qty: 1, kind: 'special' },
];

const ARMOR_SLOTS = ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet'];
const JEWELRY_SLOTS = ['neck', 'ring', 'charm', 'belt', 'cape'];

interface BagItem {
	icon: string;
	name: string;
	type: string;
	rarity?: Rarity;
	count?: number;
	/** potions are drunk, everything else is equipped */
	drink?: boolean;
	sell: number;
	rows: { label: string; value: string }[];
}
const BAG_START: BagItem[] = [
	{
		icon: I('item_potion_hp'),
		name: 'Health Potion',
		type: 'Common · Potion',
		count: 88,
		drink: true,
		sell: 12,
		rows: [
			{ label: 'Restores', value: '120 HP' },
			{ label: 'Cooldown', value: '8 s' },
		],
	},
	{
		icon: I('item_wooden_sword'),
		name: 'Wooden Sword',
		type: 'Uncommon · One-handed',
		rarity: 'uncommon',
		sell: 40,
		rows: [
			{ label: 'Damage', value: '12 - 18' },
			{ label: 'Attack speed', value: '0.9/s' },
		],
	},
	{
		icon: I('item_bronze_hammer'),
		name: 'Warden’s Maul',
		type: 'Rare · Two-handed',
		rarity: 'rare',
		sell: 4200,
		rows: [
			{ label: 'Damage', value: '84 - 112' },
			{ label: 'Strength', value: '+6' },
		],
	},
	{
		icon: I('item_cloth_robe'),
		name: 'Dusk Robe',
		type: 'Epic · Chest',
		rarity: 'epic',
		sell: 9800,
		rows: [
			{ label: 'Armor', value: '34' },
			{ label: 'Intelligence', value: '+9' },
		],
	},
	{
		icon: I('item_emberbrand'),
		name: 'Emberbrand',
		type: 'Legendary · Sword',
		rarity: 'legendary',
		sell: 40000,
		rows: [
			{ label: 'Damage', value: '210 - 260' },
			{ label: 'Fire damage', value: '+18%' },
		],
	},
	{ icon: I('item_wooden_ring'), name: 'Wooden Ring', type: 'Common · Ring', sell: 8, rows: [{ label: 'Luck', value: '+1' }] },
	{
		icon: I('item_cloth_hat'),
		name: 'Pointed Hat',
		type: 'Uncommon · Head',
		rarity: 'uncommon',
		sell: 90,
		rows: [
			{ label: 'Armor', value: '6' },
			{ label: 'Mana', value: '+12' },
		],
	},
];

const H = (n: string) => `/pixel/new_assets/heroes/${n}.png`;
const A = (n: string) => `/pixel/new_assets/achievements/${n}.png`;
/** Mock of the game's avatar catalog for an elf ranger: its own two starters open, the other classes' starters dimmed, rewards earned or silhouettes, then empty "soon" cards. */
const AVATAR_CARDS: AvatarCard[] = [
	{ id: 'knight', name: 'Knight', portrait: H('avatar_red_haired_knight'), state: 'class', note: 'Needs the Warrior class' },
	{ id: 'druid', name: 'Druid', portrait: H('avatar_green_horned_elf'), state: 'class', note: 'Needs the Mage class' },
	{ id: 'scout', name: 'Scout', portrait: H('avatar_red_plume_lady'), state: 'open' },
	{ id: 'scholar', name: 'Scholar', portrait: H('avatar_winged_helm_veteran'), state: 'class', note: 'Needs the Mage class' },
	{ id: 'miner', name: 'Miner', portrait: H('avatar_dwarf_knight_orange_eyes'), state: 'class', note: 'Needs the Warrior class' },
	{ id: 'farmer', name: 'Farmer', portrait: H('avatar_chain_knight_woman'), state: 'class', note: 'Needs the Paladin class' },
	{ id: 'bard', name: 'Bard', portrait: H('avatar_purple_elf_lady'), state: 'open' },
	{ id: 'alchemist', name: 'Alchemist', portrait: H('avatar_blue_plume_knight'), state: 'class', note: 'Needs the Paladin class' },
	{ id: 'architect', name: 'Architect', portrait: H('avatar_gold_lion_knight'), state: 'open' },
	{ id: 'reborn', name: 'Reborn', portrait: H('avatar_horned_scarred_woman'), state: 'locked', note: 'Rebirth for the first time' },
	{ id: 'boss_slayer', name: 'Boss slayer', portrait: H('avatar_horned_brute_dark'), state: 'locked', note: 'Defeat The Great Auroch' },
	{ id: 'early_tester', name: 'Early tester', portrait: H('avatar_horned_chainmail'), state: 'open' },
	{ id: 'beta_tester', name: 'Beta tester', portrait: H('avatar_beta_tester'), state: 'locked', note: 'Played in the closed beta' },
	{ id: 's1', name: 'Soon', portrait: '', state: 'soon' },
	{ id: 's2', name: 'Soon', portrait: '', state: 'soon' },
	{ id: 's3', name: 'Soon', portrait: '', state: 'soon' },
];
const avatarOf = (id: string) => AVATAR_CARDS.find((a) => a.id === id)?.portrait ?? H('avatar_red_plume_lady');
const BADGES: BadgeOption[] = [
	{ id: 'early_tester', title: 'Early tester', img: A('badge_early_tester_special') },
	{ id: 'castle_10', title: 'Architect', img: A('badge_castle_10_gold') },
	{ id: 'first_rebirth', title: 'Reborn', img: A('badge_first_rebirth_fire') },
	{ id: 'first_blood', title: 'First blood', img: A('badge_sword_shield_bronze') },
];
const TITLES: TitleChoice[] = [
	{ id: 'architect', name: 'Architect' },
	{ id: 'reborn', name: 'Reborn' },
	{ id: 'first_blood', name: 'First blood' },
];

const GREEN = '#17561f';
const GOLD = '#6a3f00';
const BLUE = '#1a3f92';
const PURPLE = '#4d2490';
const RED = '#8a2018';
const INK = '#2b1d0e';
type PaperRow = { l: string; v: string; c: string };
const OFFENSE: PaperRow[] = [
	{ l: 'Damage', v: '106.6 per hit', c: GOLD },
	{ l: 'Physical ATK', v: '+24.0%', c: GOLD },
	{ l: 'Magic ATK', v: '+24.0%', c: PURPLE },
	{ l: 'Spell power', v: '0.0%', c: PURPLE },
	{ l: 'ATK speed', v: '0.64/s (+2.50%)', c: BLUE },
	{ l: 'Crit chance', v: '36.6%', c: GOLD },
	{ l: 'Crit damage', v: 'x2.79', c: GOLD },
	{ l: 'Super crit chance', v: '8.0% of crits', c: PURPLE },
	{ l: 'Super crit damage', v: 'x6.98', c: PURPLE },
	{ l: 'Life leech', v: '0.5%', c: RED },
];
const DEFENSE: PaperRow[] = [
	{ l: 'HP', v: '278 / 278', c: GREEN },
	{ l: 'MP', v: '101 / 101', c: BLUE },
	{ l: 'Armor', v: '85 (-59% damage)', c: INK },
	{ l: 'Dodge', v: '2.1%', c: BLUE },
	{ l: 'HP regen', v: '3/s', c: GREEN },
	{ l: 'Mana regen', v: '1.25/s', c: BLUE },
];
const FORTUNE: PaperRow[] = [
	{ l: 'Luck', v: '64', c: PURPLE },
	{ l: 'Chest rate', v: '+25.6%', c: GREEN },
	{ l: 'Rare drop odds', v: '+25.6%', c: PURPLE },
	{ l: 'Gem find in chests', v: '6.8%', c: BLUE },
	{ l: 'Golden monster chance', v: '5.2%', c: GOLD },
	{ l: 'Gold find', v: '10.0%', c: GOLD },
	{ l: 'XP gain', v: '25.50%', c: GREEN },
];
const REALM: PaperRow[] = [
	{ l: 'Tiles owned', v: '350', c: BLUE },
	{ l: 'Tile discount', v: '25.00%', c: BLUE },
	{ l: 'Income (set bonus)', v: '+6%', c: BLUE },
	{ l: 'Kill rewards (set bonus)', v: '+12% gold and XP', c: GREEN },
	{ l: 'Offline progress', v: 'up to 8 h at 50%', c: PURPLE },
	{ l: 'Crafting level', v: '1', c: INK },
	{ l: 'Rebirths', v: '0 (+0%)', c: INK },
];

const PaperBlock: React.FC<{ title: string; rows: PaperRow[] }> = ({ title, rows }) => (
	<div>
		<div className='ds-capi'>{title}</div>
		{rows.map((r) => (
			<div className='ds-paper-row' key={r.l}>
				<span>{r.l}</span>
				<b style={{ color: r.c }}>{r.v}</b>
			</div>
		))}
	</div>
);

const ATTRS = [
	{ k: 'str', n: 'Strength', c: RED },
	{ k: 'dex', n: 'Dexterity', c: GREEN },
	{ k: 'int', n: 'Intelligence', c: BLUE },
	{ k: 'vit', n: 'Vitality', c: GOLD },
	{ k: 'cha', n: 'Charisma', c: PURPLE },
];

/** Stats tab: paper ledger. Attribute cards with spend buttons, then Offense / Defense / Fortune / Realm as ruled tables in two columns. */
const StatsTab: React.FC<{ pts: number; attrs: Record<string, number>; onSpend: (k: string) => void }> = ({ pts, attrs, onSpend }) => (
	<Panel parchment className='ds-ledger'>
		<div className='ds-paper-head'>
			<div className='ds-capi' style={{ flex: 1 }}>
				Attributes
			</div>
			<span className='ds-pill'>{pts > 0 ? `${pts} ${pts === 1 ? 'point' : 'points'} to spend` : 'No points to spend'}</span>
		</div>
		<div className='ds-attrs'>
			{ATTRS.map((a) => (
				<div className='ds-attr' key={a.k}>
					<span className='ds-attr-text'>
						<small>{a.n}</small>
						<b style={{ color: a.c }}>{attrs[a.k]}</b>
					</span>
					<button type='button' className='ds-plus' aria-label={`Add point to ${a.n}`} disabled={pts < 1} onClick={() => onSpend(a.k)} />
				</div>
			))}
		</div>
		<div className='ds-paper-cols'>
			<div>
				<PaperBlock title='Offense' rows={OFFENSE} />
				<PaperBlock title='Defense' rows={DEFENSE} />
			</div>
			<div>
				<PaperBlock title='Fortune' rows={FORTUNE} />
				<PaperBlock title='Realm' rows={REALM} />
			</div>
		</div>
	</Panel>
);

interface Recipe {
	id: string;
	name: string;
	kind: string;
	hold: string;
	text: string;
	icon: string;
	secEach: number;
	cost: [string, number][];
}
const RECIPE_GROUPS: { id: string; title: string; sub?: string; items: Recipe[] }[] = [
	{
		id: 'components',
		title: 'Components',
		items: [
			{
				id: 'vial',
				name: 'Glass Vial',
				kind: 'Component',
				hold: '3,470',
				text: 'A small flask of fire-blown glass. Every potion needs one.',
				icon: I('comp_glass_vial'),
				secEach: 10,
				cost: [
					['stone', 10],
					['coal', 5],
				],
			},
		],
	},
	{
		id: 'potions',
		title: 'Potions',
		items: [
			{
				id: 'hp',
				name: 'Health Potion',
				kind: 'Potion',
				hold: '88',
				text: 'Restores 120 HP over 3 seconds.',
				icon: I('item_potion_hp'),
				secEach: 20,
				cost: [
					['food', 12],
					['coal', 4],
				],
			},
			{
				id: 'hp2',
				name: 'Greater Potion',
				kind: 'Potion',
				hold: '6',
				text: 'Restores 340 HP over 3 seconds.',
				icon: I('item_potion_greater'),
				secEach: 40,
				cost: [
					['food', 40],
					['coal', 20],
				],
			},
		],
	},
	{
		id: 'goods',
		title: 'Trade goods',
		items: [
			{
				id: 'cloth',
				name: 'Cloth bolt',
				kind: 'Trade good',
				hold: '12',
				text: 'Woven cloth, sells well at the merchant.',
				icon: R('cloth'),
				secEach: 15,
				cost: [
					['hide', 6],
					['food', 4],
				],
			},
			{
				id: 'dye',
				name: 'Dye',
				kind: 'Trade good',
				hold: '3',
				text: 'Bright dye for cloth and banners.',
				icon: R('dye'),
				secEach: 15,
				cost: [
					['coal', 8],
					['food', 6],
				],
			},
		],
	},
	{
		id: 'gear',
		title: 'Gear',
		sub: 'Starter · from crafting level 1',
		items: [
			{
				id: 'sw',
				name: 'Wooden Sword',
				kind: 'Gear · starter',
				hold: '1',
				text: 'Starter gear, from crafting level 1.',
				icon: I('item_wooden_sword'),
				secEach: 30,
				cost: [
					['wood', 30],
					['stone', 8],
				],
			},
			{
				id: 'rg',
				name: 'Wooden Ring',
				kind: 'Gear · starter',
				hold: '0',
				text: 'A plain ring carved from oak.',
				icon: I('item_wooden_ring'),
				secEach: 30,
				cost: [
					['wood', 20],
					['stone', 5],
				],
			},
		],
	},
];
const ALL_RECIPES = RECIPE_GROUPS.flatMap((g) => g.items);

interface MockBatch {
	id: number;
	recipeId: string;
	count: number;
	done: number;
	secEach: number;
}

/**
 * Crafting tab: level bar, then the queue (running batches with progress; Collect all sits at the top and lights up when something has finished), then the recipe picker (collapsible
 * groups, small icons) next to a paper ticket with cost, amount and Queue/Craft. Mock: batches tick once a second so Collect can be tested.
 */
const CraftTab: React.FC = () => {
	const [sel, setSel] = useState('vial');
	const [amt, setAmt] = useState(1);
	const [open, setOpen] = useState<Record<string, boolean>>({ components: true, potions: true, goods: false, gear: true });
	const [batches, setBatches] = useState<MockBatch[]>([
		{ id: 1, recipeId: 'hp', count: 6, done: 6, secEach: 20 },
		{ id: 2, recipeId: 'vial', count: 40, done: 12, secEach: 10 },
	]);
	const [next, setNext] = useState(3);
	useEffect(() => {
		const t = setInterval(() => setBatches((b) => b.map((x) => (x.done < x.count ? { ...x, done: x.done + 1 } : x))), 1000);
		return () => clearInterval(t);
	}, []);
	const item = ALL_RECIPES.find((i) => i.id === sel) ?? ALL_RECIPES[0];
	const slots = 3;
	const collect = (id: number) =>
		setBatches((b) => b.flatMap((x) => (x.id !== id ? [x] : x.count - x.done <= 0 ? [] : [{ ...x, count: x.count - x.done, done: 0 }])));
	const collectAll = () => setBatches((b) => b.flatMap((x) => (x.count - x.done <= 0 ? [] : [{ ...x, count: x.count - x.done, done: 0 }])));
	const entries: CraftQueueEntry[] = batches.map((x) => {
		const r = ALL_RECIPES.find((i) => i.id === x.recipeId) as Recipe;
		return {
			id: x.id,
			name: r.name,
			icon: r.icon,
			count: x.count,
			done: x.done,
			status: x.done >= x.count ? 'done' : `${(x.count - x.done) * x.secEach}s left`,
		};
	});
	return (
		<div className='ds-craft'>
			<div className='ds-craft-top'>
				<span className='ds-gold-text'>Crafting level 10</span>
				<XpBar level={10} value={415} max={3901} label='10%' compact />
				<span className='ds-dim' style={{ fontSize: 12 }}>
					415 / 3,901 XP
				</span>
			</div>
			<CraftQueue
				entries={entries}
				slots={slots}
				onCollect={(id) => collect(Number(id))}
				onCollectAll={collectAll}
				onCancel={(id) => setBatches((b) => b.filter((x) => x.id !== Number(id)))}
			/>
			<div className='ds-craft-body'>
				<Inset className='ds-craft-list'>
					{RECIPE_GROUPS.map((g) => (
						<CollapsibleGroup key={g.id} title={g.title} count={g.items.length} open={open[g.id]} onToggle={() => setOpen({ ...open, [g.id]: !open[g.id] })}>
							{g.sub ? <div className='ds-craft-sub'>{g.sub}</div> : null}
							<div className='ds-craft-grid'>
								{g.items.map((i) => (
									<Slot key={i.id} icon={i.icon} title={i.name} active={i.id === sel} onClick={() => setSel(i.id)} />
								))}
							</div>
						</CollapsibleGroup>
					))}
				</Inset>
				<Panel parchment className='ds-ledger ds-craft-ticket'>
					<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
						<Slot large icon={item.icon} />
						<div>
							<div className='ds-paper-title'>{item.name}</div>
							<div className='ds-paper-sub'>
								{item.kind} · you hold {item.hold}
							</div>
						</div>
					</div>
					<p className='ds-paper-text'>{item.text}</p>
					<div>
						<div className='ds-capi'>Cost</div>
						<div style={{ display: 'flex', gap: 20, paddingTop: 6 }}>
							{item.cost.map(([res, n]) => (
								<span key={res} className='ds-paper-cost'>
									<img src={R(res)} alt={res} />
									{compact(n * amt)}
								</span>
							))}
						</div>
					</div>
					<div>
						<label className='ds-capi' htmlFor='ds-amt' style={{ display: 'block' }}>
							Amount
						</label>
						<div style={{ paddingTop: 8 }}>
							<Slider id='ds-amt' tone='paper' min={1} max={500} value={amt} onChange={setAmt} />
						</div>
					</div>
					<div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
						<span style={{ color: GREEN, fontWeight: 600 }}>+{2 * amt} XP</span>
						<span style={{ color: '#5a4326' }}>
							{item.secEach}s each · {amt * item.secEach}s total
						</span>
					</div>
					<Button
						tone='gold'
						style={{ marginTop: 'auto', minHeight: 40 }}
						disabled={batches.length >= slots}
						onClick={() => {
							setBatches((b) => [...b, { id: next, recipeId: item.id, count: amt, done: 0, secEach: item.secEach }]);
							setNext(next + 1);
						}}
					>
						{batches.length >= slots ? 'Queue full' : `Queue ${amt}`}
					</Button>
				</Panel>
			</div>
		</div>
	);
};

/**
 * The compact character screen in a resizable, draggable window. Left: name plaque, equipment around a full-height silhouette, vitals, hands and skills centred under it, XP bar, stats.
 * Right: Bag (slots + free-slot shortcut to buy more), Stats (paper ledger, spend points) or Crafting. Everything is fluid: shrink the window and the slots scale down, below a width the
 * two columns stack.
 */
export const HeroWindowView: React.FC<{ initialTab?: 'bag' | 'stats' | 'craft' }> = ({ initialTab = 'bag' }) => {
	const [tab, setTab] = useState<string>(initialTab);
	const [pts, setPts] = useState(1);
	const [attrs, setAttrs] = useState<Record<string, number>>({ str: 17, dex: 15, int: 15, vit: 15, cha: 50 });
	const [avatarId, setAvatarId] = useState('scout');
	const [badgeId, setBadgeId] = useState<string | null>('castle_10');
	const [titleId, setTitleId] = useState<string | null>('architect');
	const [dialog, setDialog] = useState<'avatar' | 'badge' | null>(null);
	const [bag, setBag] = useState<(BagItem | null)[]>(() => Array.from({ length: 40 }, (_, i) => BAG_START[i] ?? null));
	const [menu, setMenu] = useState<MenuState | null>(null);
	const [bagView, setBagView] = useState<'bag' | 'craft'>('bag');
	const [stash, setStash] = useState<StashEntry[]>(STASH_START);
	const [note, setNote] = useState<string | null>(null);
	const say = (t: string) => {
		setNote(t);
		setTimeout(() => setNote(null), 3500);
	};
	const patch = (i: number, n: number) =>
		setBag((b) => b.map((x, k) => (k !== i || !x ? x : (x.count ?? 1) - n <= 0 ? null : { ...x, count: (x.count ?? 1) - n })));
	const openMenu = (e: React.MouseEvent, i: number) => {
		e.preventDefault();
		const it = bag[i];
		if (!it) return;
		const qty = it.count ?? 1;
		setMenu({
			x: e.clientX,
			y: e.clientY,
			title: it.name,
			items: [
				{
					id: 'use',
					label: it.drink ? 'Drink' : 'Equip',
					onSelect: () => {
						patch(i, it.drink ? 1 : qty);
						say(`${it.drink ? 'Drank' : 'Equipped'} ${it.name}`);
					},
				},
				{
					id: 'sell',
					label: qty > 1 ? 'Sell one' : 'Sell',
					hint: `${compact(it.sell)} gold`,
					onSelect: () => {
						patch(i, 1);
						say(`Sold ${it.name} for ${compact(it.sell)} gold`);
					},
				},
				...(qty > 1
					? [
							{
								id: 'sellAll',
								label: `Sell all (${qty})`,
								hint: `${compact(it.sell * qty)} gold`,
								onSelect: () => {
									patch(i, qty);
									say(`Sold ${qty} x ${it.name} for ${compact(it.sell * qty)} gold`);
								},
							},
						]
					: []),
				{
					id: 'discard',
					label: 'Discard...',
					danger: true,
					separator: true,
					onSelect: () => {
						patch(i, qty);
						say(`Discarded ${it.name}`);
					},
				},
			],
		});
	};
	const hints: Record<string, string> = { bag: '', stats: 'Spend points to grow stronger', craft: 'Recipes unlock with crafting level' };
	return (
		<DsRoot style={{ padding: 24, background: '#0b1022', minHeight: '100vh', boxSizing: 'border-box' }}>
			<WindowShell
				title='Hero'
				width={1100}
				height={800}
				bar={
					<Tabs
						active={tab}
						onChange={setTab}
						items={[
							{ id: 'bag', label: 'Bag' },
							{ id: 'stats', label: 'Stats', badge: pts || undefined },
							{ id: 'craft', label: 'Crafting' },
						]}
					/>
				}
				barRight={<span className='ds-dim ds-bar-hint'>{hints[tab]}</span>}
			>
				<div className='ds-hero'>
					<Panel className='ds-hero-left'>
						<HeroIdentity
							avatar={avatarOf(avatarId)}
							name='Insane'
							classLabel='Elf Ranger'
							badge={BADGES.find((b) => b.id === badgeId)?.img}
							title={TITLES.find((t) => t.id === titleId)?.name ?? null}
							onAvatar={() => setDialog('avatar')}
							onBadge={() => setDialog('badge')}
						/>
						<Divider />
						<div className='ds-eq-bars'>
							<XpBar level={31} value={66} max={100} label='Level 31 · 66% · 20.07M / 30.10M' />
							<ProgressBar value={278} max={278} label='HP 278 / 278' />
							<ProgressBar value={101} max={101} tone='mana' label='MP 101 / 101' />
						</div>
						<div className='ds-equip'>
							<EquipGroup title='Armor' cols={6}>
								{ARMOR_SLOTS.map((s) => (
									<Slot key={s} icon={I(`equip_${s}`)} empty title={s} />
								))}
							</EquipGroup>
							<EquipGroup title='Jewelry' cols={5}>
								{JEWELRY_SLOTS.map((s) => (
									<Slot key={s} icon={I(`equip_${s}`)} empty title={s} />
								))}
							</EquipGroup>
							<EquipGroup title='Hands' cols={2} gap={14}>
								<Slot icon={I('equip_mainHand')} rarity='rare' title='Main hand' />
								<Slot icon={I('equip_offHand')} rarity='epic' title='Off hand' />
							</EquipGroup>
							<EquipGroup title='Skills' cols={2} gap={14}>
								<Slot label='Heal' sub='80 MP' title='Heal' />
								<Slot label='Stun' sub='19 MP' title='Stun' />
							</EquipGroup>
						</div>
						<Inset style={{ display: 'flex', justifyContent: 'space-around' }}>
							<Stat label='Damage' value='106.6' tone='damage' />
							<Stat label='Armor' value='85' tone='armor' />
							<Stat label='Crit' value='36.6%' />
							<Stat label='Item lvl' value='19.8' />
						</Inset>
					</Panel>
					<Panel className='ds-hero-right'>
						{tab === 'bag' ? (
							<>
								<div className='ds-subtabs' role='tablist'>
									<button type='button' role='tab' aria-selected={bagView === 'bag'} data-active={bagView === 'bag'} onClick={() => setBagView('bag')}>
										Bag
									</button>
									<button type='button' role='tab' aria-selected={bagView === 'craft'} data-active={bagView === 'craft'} onClick={() => setBagView('craft')}>
										Crafting bag
									</button>
								</div>
								{bagView === 'bag' ? (
									<>
										<Inset className='ds-baggrid'>
											{bag.map((it, i) =>
												it ? (
													<HoverTip
														key={i}
														tip={
															<ItemTooltip
																rarity={it.rarity ?? 'common'}
																icon={it.icon}
																name={it.name}
																type={it.type}
																rows={it.rows}
																footer={['Right-click for more', `Sell ${compact(it.sell)}`]}
															/>
														}
													>
														<Slot icon={it.icon} rarity={it.rarity} count={it.count} onContextMenu={(e) => openMenu(e, i)} />
													</HoverTip>
												) : (
													<Slot key={i} />
												),
											)}
											<AddSlot
												tip={
													<Tooltip className='ds-tip-compact' title='More bag space' icon={I('menu_bag_scroll')} subtitle='Merchant upgrade: Pack Rat'>
														<TipRows
															rows={[
																{ label: 'Next level', value: '+4 slots' },
																{ label: 'Cost', value: <span className='ds-gold-text'>1.90M gold</span> },
															]}
														/>
													</Tooltip>
												}
											/>
										</Inset>
										<div className='ds-bag-foot'>
											<span className='ds-dim'>{bag.filter(Boolean).length} of 40 slots used</span>
											<span className='ds-bag-actions'>
												<Button>Organise</Button>
												<Button tone='danger'>Sell junk</Button>
											</span>
											<span className='ds-dim ds-bag-hint'>{note ?? 'Right-click an item for more.'}</span>
										</div>
									</>
								) : (
									<Inset className='ds-stash-wrap'>
										<CraftStash
											entries={stash}
											onTake={(id, n) => {
												const it = stash.find((x) => x.id === id);
												setStash((st) => st.map((x) => (x.id === id ? { ...x, qty: x.qty - Math.min(n, x.qty) } : x)));
												say(`Took ${Math.min(n, it?.qty ?? n)} x ${it?.name} into the bag`);
											}}
										/>
									</Inset>
								)}
							</>
						) : tab === 'stats' ? (
							<StatsTab
								pts={pts}
								attrs={attrs}
								onSpend={(k) => {
									if (pts > 0) {
										setPts(pts - 1);
										setAttrs({ ...attrs, [k]: attrs[k] + 1 });
									}
								}}
							/>
						) : (
							<CraftTab />
						)}
					</Panel>
				</div>
			</WindowShell>
			<ContextMenu menu={menu} onClose={() => setMenu(null)} />
			{dialog === 'avatar' ? (
				<Modal title='Choose your avatar' width={620} onClose={() => setDialog(null)}>
					<p className='ds-dim' style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 13 }}>
						Your face in the header and the rankings. Faces of other classes stay disabled, and the locked rewards are earned in the game.
					</p>
					<AvatarGrid cards={AVATAR_CARDS} value={avatarId} onPick={setAvatarId} />
				</Modal>
			) : null}
			{dialog === 'badge' ? (
				<Modal title='Badge and title' width={620} onClose={() => setDialog(null)}>
					<p className='ds-dim' style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 13 }}>
						Shown next to your name in the game and in the rankings. You can hide the badge completely.
					</p>
					<BadgeTitlePicker
						badges={BADGES}
						titles={TITLES}
						badgeId={badgeId}
						titleId={titleId}
						onChange={(n) => {
							setBadgeId(n.badgeId);
							setTitleId(n.titleId);
						}}
					/>
				</Modal>
			) : null}
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
