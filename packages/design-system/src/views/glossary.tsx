import React, { useState } from 'react';
import { Badge, Button, DiamondLevel, DsRoot, Inset, Panel, ProgressBar, SectionLabel, WindowShell, compact } from '../index';

const A = (n: string) => `/pixel/new_assets/achievements/${n}.png`;
const E = (biome: string, n: string) => `/pixel/enemies/${biome}/${n}.png`;
const GREEN = '#17561f';
const INK = '#2b1d0e';
const MUTED = '#8a7a5a';

/* ============================== Hall of Deeds ============================== */

interface Deed {
	id: string;
	cat: string;
	name: string;
	desc: string;
	icon: string;
	goals: number[];
	rewards: string[];
	cur: number;
	/** tiers completed */
	tier: number;
	lore: string;
	how: string;
	when: string;
	/** a finished tier is waiting to be claimed */
	claim?: boolean;
	lock?: boolean;
}
const DEEDS: Deed[] = [
	{
		id: 'slayer',
		cat: 'combat',
		name: 'Slayer',
		desc: 'Defeat monsters of any kind.',
		icon: A('badge_skull_bronze'),
		goals: [100, 500, 2500, 10000],
		rewards: ['10 pts', '25 pts · +1% gold', '50 pts · +2% gold', '100 pts · title "Slayer"'],
		cur: 1842,
		tier: 2,
		lore: 'Every blade grows dull before its wielder does. Count the fallen and the realm will remember you.',
		how: 'Any kill counts, including auto-fights while you are away. Golden monsters count double.',
		when: 'Tier 2 done 3 days ago',
	},
	{
		id: 'wolfsbane',
		cat: 'combat',
		name: 'Wolfsbane',
		desc: 'Slay Grey Wolves.',
		icon: A('badge_sword_silver'),
		goals: [50, 200, 1000],
		rewards: ['5 pts', '15 pts · +2% hide', '40 pts · wolf pet'],
		cur: 142,
		tier: 1,
		lore: 'The forests east of your keep howl at night. Make them quiet.',
		how: 'Wolves roam forest tiles at level 10 to 18. Send your hero to a forest tile and let the fight run.',
		when: 'Tier 1 done yesterday',
	},
	{
		id: 'untouched',
		cat: 'combat',
		name: 'Untouched',
		desc: 'Win a fight without taking damage.',
		icon: A('badge_shield_silver'),
		goals: [1, 25, 100],
		rewards: ['5 pts', '20 pts · +1% dodge', '50 pts'],
		cur: 25,
		tier: 2,
		lore: 'Armor is for those who get hit.',
		how: 'High dodge or killing before the first enemy swing both count.',
		when: 'Tier 2 just completed',
		claim: true,
	},
	{
		id: 'landlord',
		cat: 'realm',
		name: 'Landlord',
		desc: 'Own tiles.',
		icon: A('badge_map_flag_bronze'),
		goals: [50, 200, 500, 1000],
		rewards: ['5 pts', '15 pts', '40 pts · −1% tile cost', '100 pts · −3% tile cost'],
		cur: 350,
		tier: 2,
		lore: 'A realm is just land that agreed to be yours.',
		how: 'Buy any tile from the map. Rebirths keep this count.',
		when: 'Tier 2 done 12 days ago',
	},
	{
		id: 'hoarder',
		cat: 'economy',
		name: 'Hoarder',
		desc: 'Hold gold at one time.',
		icon: A('badge_chest_bronze'),
		goals: [100000, 1000000, 10000000],
		rewards: ['5 pts', '20 pts · +1% gold find', '60 pts'],
		cur: 102000,
		tier: 1,
		lore: 'Dragons had the right idea.',
		how: 'Your purse at any moment, not total earned. Selling resources is the fastest way.',
		when: 'Tier 1 done today',
		claim: true,
	},
	{
		id: 'market',
		cat: 'economy',
		name: 'Market Day',
		desc: 'Sell resources to the merchant.',
		icon: A('badge_star_silver'),
		goals: [1000000, 10000000, 100000000],
		rewards: ['5 pts', '20 pts · +1% sell price', '60 pts'],
		cur: 4200000,
		tier: 1,
		lore: 'He will always take it. The price is the question.',
		how: 'Counts units sold, any resource. Use the trade ticket with Max to move stock in bulk.',
		when: 'Tier 1 done 2 days ago',
	},
	{
		id: 'smith',
		cat: 'craft',
		name: 'Apprentice Smith',
		desc: 'Craft items.',
		icon: A('badge_hammer_bronze'),
		goals: [100, 1000, 10000],
		rewards: ['5 pts', '20 pts · +5% craft speed', '60 pts'],
		cur: 3470,
		tier: 1,
		lore: 'Ten thousand vials before the first potion worth drinking.',
		how: 'Every crafted unit counts, components included.',
		when: 'Tier 1 done 5 days ago',
	},
	{
		id: 'reborn',
		cat: 'rebirth',
		name: 'Reborn',
		desc: 'Complete a rebirth.',
		icon: A('badge_first_rebirth_fire'),
		goals: [1, 5, 20],
		rewards: ['20 pts · +2% rebirth bonus', '50 pts', '150 pts'],
		cur: 0,
		tier: 0,
		lore: 'The realm ends. You do not.',
		how: 'Rebirth is offered from level 40. You keep deeds, bestiary and merchant upgrades.',
		when: 'Not started',
		lock: true,
	},
	{
		id: 'scholar',
		cat: 'bestiary',
		name: 'Scholar',
		desc: 'Fill bestiary entries.',
		icon: A('badge_scroll_check_silver'),
		goals: [5, 15, 30],
		rewards: ['5 pts', '25 pts · +5% XP', '80 pts · title "Scholar"'],
		cur: 7,
		tier: 1,
		lore: 'Know a thing and it is half beaten.',
		how: 'An entry counts as filled when its first kill tier is reached. See the Bestiary.',
		when: 'Tier 1 done 8 days ago',
	},
];
const DEED_CATS: [string, string][] = [
	['all', 'All deeds'],
	['combat', 'Combat'],
	['realm', 'Realm'],
	['economy', 'Economy'],
	['craft', 'Crafting'],
	['bestiary', 'Bestiary'],
	['rebirth', 'Rebirth'],
];
const ptsOf = (reward: string) => Number(reward.split(' ')[0]) || 0;

/**
 * Hall of Deeds (replaces Achievements): a summary bar (deeds completed, deed points, bonus, Claim all), a category list, the deeds with tier gems, progress and a Claim button when a tier
 * is done, and a paper detail with lore, the tier ladder and how to progress. Mock state: picking a category or deed and claiming work.
 */
export const DeedsView: React.FC = () => {
	const [cat, setCat] = useState('all');
	const [sel, setSel] = useState('slayer');
	const [deeds, setDeeds] = useState(DEEDS);
	const [points, setPoints] = useState(185);
	const claimable = deeds.filter((d) => d.claim);
	const doneCount = deeds.filter((d) => d.tier > 0).length;
	const list = deeds.filter((d) => cat === 'all' || d.cat === cat);
	const d = deeds.find((x) => x.id === sel) ?? deeds[0];
	const claim = (ids: string[]) => {
		setPoints((p) => p + deeds.filter((x) => ids.includes(x.id)).reduce((a, x) => a + ptsOf(x.rewards[Math.max(0, x.tier - 1)]), 0));
		setDeeds((all) => all.map((x) => (ids.includes(x.id) ? { ...x, claim: false } : x)));
	};
	return (
		<DsRoot style={{ padding: 24, background: '#0b1022', minHeight: '100vh', boxSizing: 'border-box' }}>
			<WindowShell
				title='Hall of Deeds'
				width={1120}
				height={700}
				minWidth={640}
				bar={
					<div className='ds-sumbar'>
						<span className='ds-sum-crown'>
							<img src={A('badge_star_bronze')} alt='' />
						</span>
						<div className='ds-sum-progress'>
							<span className='ds-dim'>Deeds completed</span>
							<ProgressBar value={doneCount} max={deeds.length} tone='gold' label={`${doneCount} / ${deeds.length}`} height={16} />
						</div>
						<div className='ds-sum-cell'>
							<span className='ds-dim'>Deed points</span>
							<b>{points}</b>
						</div>
						<div className='ds-sum-cell'>
							<span className='ds-dim'>Bonus from deeds</span>
							<b className='ds-good'>+4% gold & XP</b>
						</div>
						<div className='ds-sum-claim'>
							<span className='ds-dim'>Ready to claim</span>
							{claimable.length ? <Badge count={claimable.length} /> : null}
							<Button
								tone='gold'
								disabled={claimable.length === 0}
								className={claimable.length ? 'ds-collect-glow' : undefined}
								onClick={() => claim(claimable.map((x) => x.id))}
							>
								Claim all
							</Button>
						</div>
					</div>
				}
			>
				<div className='ds-gloss'>
					<Inset className='ds-cats'>
						{DEED_CATS.map(([id, label]) => (
							<button key={id} type='button' data-active={cat === id} onClick={() => setCat(id)}>
								<span>{label}</span>
								<span className='ds-dim'>{id === 'all' ? deeds.length : deeds.filter((x) => x.cat === id).length}</span>
							</button>
						))}
						<p className='ds-cats-note'>Tiered deeds grow with you: finish a tier, the next one opens with a bigger reward.</p>
					</Inset>
					<div className='ds-gloss-list'>
						{list.map((x) => {
							const done = x.tier >= x.goals.length;
							const goal = done ? x.goals[x.goals.length - 1] : x.goals[x.tier];
							const prev = x.tier > 0 ? x.goals[x.tier - 1] : 0;
							return (
								<div
									key={x.id}
									role='button'
									tabIndex={0}
									className='ds-deed'
									data-active={x.id === sel}
									data-done={done}
									data-lock={!!x.lock}
									onClick={() => setSel(x.id)}
									onKeyDown={(e) => e.key === 'Enter' && setSel(x.id)}
								>
									<span className='ds-deed-icon'>
										<img src={x.icon} alt='' />
									</span>
									<span className='ds-deed-main'>
										<span className='ds-deed-name'>
											{x.name}
											<DiamondLevel level={x.tier} max={x.goals.length} />
										</span>
										<span className='ds-deed-desc'>{x.desc}</span>
										<ProgressBar
											value={done ? 1 : Math.max(0, x.cur - prev)}
											max={done ? 1 : goal - prev}
											tone='gold'
											height={14}
											label={done ? 'Complete' : `${compact(Math.min(x.cur, goal))} / ${compact(goal)}`}
										/>
									</span>
									<span className='ds-deed-side'>
										<b>{done ? 'All claimed' : x.rewards[x.tier].split(' · ')[0]}</b>
										{x.claim ? (
											<Button
												tone='gold'
												onClick={(e) => {
													e.stopPropagation();
													claim([x.id]);
												}}
											>
												Claim
											</Button>
										) : null}
									</span>
								</div>
							);
						})}
					</div>
					<Panel parchment className='ds-ledger ds-detail'>
						<div className='ds-detail-head'>
							<span className='ds-deed-icon ds-deed-icon-lg'>
								<img src={d.icon} alt='' />
							</span>
							<div>
								<div className='ds-paper-title'>{d.name}</div>
								<div className='ds-paper-sub'>
									{DEED_CATS.find((c) => c[0] === d.cat)?.[1]} · {d.tier >= d.goals.length ? 'All tiers complete' : `Tier ${d.tier + 1} of ${d.goals.length}`}
								</div>
							</div>
						</div>
						<p className='ds-paper-text'>{d.lore}</p>
						<div className='ds-capi'>Tiers</div>
						{d.goals.map((g, i) => (
							<div className='ds-paper-row' key={g} style={{ color: i < d.tier ? GREEN : i === d.tier ? INK : MUTED }}>
								<span>
									Tier {i + 1} · {compact(g)}
								</span>
								<b>{d.rewards[i]}</b>
							</div>
						))}
						<div className='ds-capi' style={{ marginTop: 12 }}>
							How to progress
						</div>
						<p className='ds-paper-text'>{d.how}</p>
						<div className='ds-paper-foot ds-detail-foot'>
							<span>Lifetime: {compact(d.cur)}</span>
							<span>{d.when}</span>
						</div>
					</Panel>
				</div>
			</WindowShell>
		</DsRoot>
	);
};

/* ================================ Bestiary ================================ */

interface Monster {
	id: string;
	name: string;
	type: string;
	lv: number;
	where: string;
	icon: string;
	kills: number;
	deaths: number;
	best: string;
	lore: string;
	unlocks: string[];
	stats: [string, string][];
	drops: [string, string, string][];
	tags: [string, string][];
}
const GOALS = [10, 100, 500, 2000];
const MONSTERS: Monster[] = [
	{
		id: 'wolf',
		name: 'Grey Wolf',
		type: 'Beast',
		lv: 14,
		where: 'Forest',
		icon: E('forest', 'mossback-wolf'),
		kills: 142,
		deaths: 3,
		best: '4.2s',
		lore: 'Runs in threes. The one you see is never the one that bites.',
		unlocks: ['Entry: stats revealed', '+2% hide from beasts', 'Drop table revealed · +2% gold find', 'Title "Wolfsbane" · wolf pet'],
		stats: [
			['HP', '1,840'],
			['Damage', '22 – 31'],
			['Armor', '12'],
			['Speed', 'Fast'],
		],
		drops: [
			['Hide ×3–6', '80%', INK],
			['Meat ×2', '60%', INK],
			['Wolf fang', '6%', '#4d2490'],
		],
		tags: [
			['Hostile', '#8a2018'],
			['Pack', '#6a3f00'],
		],
	},
	{
		id: 'spider',
		name: 'Thorn Spider',
		type: 'Vermin',
		lv: 11,
		where: 'Forest edge',
		icon: E('forest', 'bramble-imp'),
		kills: 612,
		deaths: 1,
		best: '2.1s',
		lore: 'Webs between the pines. Burn them and the forest smells of honey.',
		unlocks: ['Entry: stats revealed', '+2% coal from forest tiles', 'Drop table revealed · +1% crit', 'Title "Exterminator"'],
		stats: [
			['HP', '620'],
			['Damage', '9 – 14'],
			['Armor', '4'],
			['Speed', 'Normal'],
		],
		drops: [
			['Silk ×1–2', '50%', INK],
			['Venom sac', '8%', '#4d2490'],
		],
		tags: [
			['Hostile', '#8a2018'],
			['Poison', '#17561f'],
		],
	},
	{
		id: 'ghost',
		name: 'Frost Wraith',
		type: 'Undead',
		lv: 22,
		where: 'Snowfields',
		icon: E('tundra', 'rime-wraith'),
		kills: 38,
		deaths: 9,
		best: '11.8s',
		lore: 'It remembers being cold. It wants you to remember too.',
		unlocks: ['Entry: stats revealed', '+3% XP from undead', 'Drop table revealed · +5% magic ATK', 'Title "Warden of the North"'],
		stats: [
			['HP', '6,200'],
			['Damage', '48 – 70'],
			['Armor', '0 · immune to bleed'],
			['Speed', 'Slow'],
		],
		drops: [
			['Ectoplasm', '70%', INK],
			['Frozen heart', '3%', '#4d2490'],
		],
		tags: [
			['Hostile', '#8a2018'],
			['Magic', '#1a3f92'],
		],
	},
	{
		id: 'fox',
		name: 'Snow Fox',
		type: 'Beast',
		lv: 16,
		where: 'Snowfields',
		icon: E('tundra', 'frost-hare'),
		kills: 9,
		deaths: 0,
		best: '6.0s',
		lore: 'Rare, white, and faster than your hero on his best day.',
		unlocks: ['Entry: stats revealed', '+1% gold find', 'Drop table revealed', 'Fox pet'],
		stats: [
			['HP', '?'],
			['Damage', '?'],
			['Armor', '?'],
			['Speed', '?'],
		],
		drops: [['Unknown', '?', MUTED]],
		tags: [['Skittish', '#6a3f00']],
	},
	{
		id: 'ent',
		name: 'Rootwalker',
		type: 'Plant',
		lv: 11,
		where: 'Forest',
		icon: E('forest', 'rotcap-stag'),
		kills: 230,
		deaths: 2,
		best: '7.4s',
		lore: 'An old tree that decided to stop being patient.',
		unlocks: ['Entry: stats revealed', '+3% wood from forest tiles', 'Drop table revealed', 'Title "Lumberjack"'],
		stats: [
			['HP', '3,100'],
			['Damage', '18 – 40'],
			['Armor', '30 · weak to fire'],
			['Speed', 'Very slow'],
		],
		drops: [
			['Wood ×20–40', '100%', INK],
			['Heartwood', '10%', '#1a3f92'],
		],
		tags: [
			['Hostile', '#8a2018'],
			['Armored', INK],
		],
	},
	{
		id: 'bush',
		name: 'Bramble Lurker',
		type: 'Plant',
		lv: 8,
		where: 'Meadow',
		icon: E('plains', 'thistle-boar'),
		kills: 1204,
		deaths: 0,
		best: '1.3s',
		lore: 'Looks like a bush. Is mostly teeth.',
		unlocks: ['Entry: stats revealed', '+2% food from farms', 'Drop table revealed', 'Title "Gardener"'],
		stats: [
			['HP', '300'],
			['Damage', '5 – 9'],
			['Armor', '2'],
			['Speed', 'None'],
		],
		drops: [
			['Berries ×2–5', '90%', INK],
			['Thorn', '20%', INK],
		],
		tags: [['Hostile', '#8a2018']],
	},
	{
		id: 'dark',
		name: 'Shade Hound',
		type: 'Demon',
		lv: 19,
		where: 'Night only',
		icon: E('jungle', 'eye-horror'),
		kills: 2,
		deaths: 4,
		best: '19s',
		lore: 'Found only after dusk. Finds you first.',
		unlocks: ['Entry: stats revealed', '+3% night income', 'Drop table revealed', 'Title "Nightwatch"'],
		stats: [
			['HP', '?'],
			['Damage', '?'],
			['Armor', '?'],
			['Speed', '?'],
		],
		drops: [['Unknown', '?', MUTED]],
		tags: [
			['Hostile', '#8a2018'],
			['Night', '#4d2490'],
		],
	},
	{
		id: 'heron',
		name: 'Marsh Heron',
		type: 'Bird',
		lv: 6,
		where: 'Lakeshore',
		icon: E('swamp', 'rot-heron'),
		kills: 77,
		deaths: 0,
		best: '1.9s',
		lore: 'Peaceful until you build a farm on its lake.',
		unlocks: ['Entry: stats revealed', '+2% eggs', 'Drop table revealed', 'Heron statue'],
		stats: [
			['HP', '180'],
			['Damage', '3 – 6'],
			['Armor', '0'],
			['Speed', 'Flies'],
		],
		drops: [
			['Eggs ×1–3', '70%', INK],
			['Feather', '30%', INK],
		],
		tags: [['Passive', '#17561f']],
	},
	{
		id: 'crab',
		name: 'Tide Crab',
		type: 'Crustacean',
		lv: 9,
		where: 'Beach',
		icon: E('coast', 'wreck-crab'),
		kills: 0,
		deaths: 0,
		best: '—',
		lore: '???',
		unlocks: ['Entry: stats revealed', '?', '?', '?'],
		stats: [
			['HP', '?'],
			['Damage', '?'],
			['Armor', '?'],
			['Speed', '?'],
		],
		drops: [['Unknown', '?', MUTED]],
		tags: [['Undiscovered', MUTED]],
	},
];
const tierOf = (k: number) => GOALS.filter((g) => k >= g).length;
const FILTERS: [string, string][] = [
	['all', 'All'],
	['found', 'Discovered'],
	['new', 'Near tier'],
	['beast', 'Beasts'],
	['undead', 'Undead'],
];

/**
 * Bestiary: a summary bar (entries discovered, active mastery bonuses, filters), a grid of monster cards (level tag, art, mastery gems, kills toward the next tier) and a paper detail with lore,
 * personal records, the mastery ladder (a reached tier shows Claim until you take its reward), stats and drops. Undiscovered monsters are silhouettes with "???".
 */
export const BestiaryView: React.FC = () => {
	const [filter, setFilter] = useState('all');
	const [sel, setSel] = useState('wolf');
	const [claimed, setClaimed] = useState<Record<string, number>>({ wolf: 1, spider: 3, ghost: 1, ent: 2, bush: 3, heron: 1, fox: 1, dark: 0, crab: 0 });
	const cards = MONSTERS.filter((m) => {
		const t = tierOf(m.kills);
		if (filter === 'found') return m.kills > 0;
		if (filter === 'new') return t < GOALS.length && m.kills >= GOALS[t] * 0.6;
		if (filter === 'beast') return m.type === 'Beast';
		if (filter === 'undead') return m.type === 'Undead' || m.type === 'Demon';
		return true;
	});
	const m = MONSTERS.find((x) => x.id === sel) ?? MONSTERS[0];
	const t = tierOf(m.kills);
	const unk = m.kills === 0;
	const got = claimed[m.id] ?? 0;
	const found = MONSTERS.filter((x) => x.kills > 0).length;
	const ready = MONSTERS.reduce((n, x) => n + Math.max(0, tierOf(x.kills) - (claimed[x.id] ?? 0)), 0);
	return (
		<DsRoot style={{ padding: 24, background: '#0b1022', minHeight: '100vh', boxSizing: 'border-box' }}>
			<WindowShell
				title='Bestiary'
				width={1120}
				height={700}
				minWidth={640}
				bar={
					<div className='ds-sumbar'>
						<div className='ds-sum-progress'>
							<span className='ds-dim'>Entries discovered</span>
							<ProgressBar value={found} max={MONSTERS.length} tone='gold' label={`${found} / ${MONSTERS.length}`} height={16} />
						</div>
						<div className='ds-sum-cell' style={{ flex: 1 }}>
							<span className='ds-dim'>Mastery bonuses active</span>
							<b className='ds-good'>+6% gold · +3% XP · +4% hide</b>
						</div>
						{ready > 0 ? (
							<div className='ds-sum-claim'>
								<span className='ds-dim'>Rewards ready</span>
								<Badge count={ready} />
							</div>
						) : null}
						<div className='ds-filters'>
							<span className='ds-dim' style={{ fontSize: 12 }}>
								Show
							</span>
							{FILTERS.map(([id, label]) => (
								<button key={id} type='button' data-active={filter === id} onClick={() => setFilter(id)}>
									{label}
								</button>
							))}
						</div>
					</div>
				}
			>
				<div className='ds-gloss ds-gloss-2'>
					<Inset className='ds-mons'>
						{cards.map((x) => {
							const tt = tierOf(x.kills);
							const none = x.kills === 0;
							const waiting = tt - (claimed[x.id] ?? 0);
							return (
								<button key={x.id} type='button' className='ds-mon' data-active={x.id === sel} data-unk={none} onClick={() => setSel(x.id)}>
									<span className='ds-mon-lv'>Lv {x.lv}</span>
									{waiting > 0 && !none ? <span className='ds-mon-ready' title='Reward ready' /> : null}
									<span className='ds-mon-art'>
										<img src={none ? '/pixel/enemies/placeholder/silhouette.png' : x.icon} alt='' />
									</span>
									<span className='ds-mon-name'>{none ? '???' : x.name}</span>
									<DiamondLevel level={tt} max={GOALS.length} />
									<span className='ds-dim ds-mon-k'>
										{none ? 'Not met' : `${compact(x.kills)}${tt < GOALS.length ? ` / ${compact(GOALS[tt])}` : ' · max'}`}
									</span>
								</button>
							);
						})}
					</Inset>
					<Panel parchment className='ds-ledger ds-detail'>
						<div className='ds-detail-head'>
							<span className='ds-deed-icon ds-deed-icon-lg'>
								<img src={unk ? '/pixel/enemies/placeholder/silhouette.png' : m.icon} alt='' />
							</span>
							<div>
								<div className='ds-paper-title'>{unk ? '???' : m.name}</div>
								<div className='ds-paper-sub'>{unk ? 'Not yet encountered' : `${m.type} · Level ${m.lv} · ${m.where}`}</div>
								<div className='ds-tags'>
									{m.tags.map(([l, c]) => (
										<span key={l} style={{ background: c }}>
											{l}
										</span>
									))}
								</div>
							</div>
						</div>
						<p className='ds-paper-text' style={{ fontStyle: 'italic' }}>
							{m.lore}
						</p>
						<div className='ds-recs'>
							<div>
								<small>Kills</small>
								<b>{unk ? '—' : m.kills}</b>
							</div>
							<div>
								<small>Deaths to it</small>
								<b>{unk ? '—' : m.deaths}</b>
							</div>
							<div>
								<small>Best time</small>
								<b>{m.best}</b>
							</div>
						</div>
						<div className='ds-capi' style={{ marginTop: 10 }}>
							Mastery · Tier {Math.min(t + 1, GOALS.length)} of {GOALS.length}
						</div>
						{GOALS.map((g, i) => {
							const status = i < got ? 'Unlocked' : i < t ? 'claim' : i === t ? 'Next' : 'Locked';
							return (
								<div className='ds-mastery' key={g} data-status={status === 'claim' ? 'claim' : status.toLowerCase()}>
									<b>{compact(g)} kills</b>
									<span>{unk && i > 0 ? '?' : m.unlocks[i]}</span>
									{status === 'claim' ? (
										<Button tone='gold' onClick={() => setClaimed({ ...claimed, [m.id]: i + 1 })}>
											Claim
										</Button>
									) : (
										<em>{status}</em>
									)}
								</div>
							);
						})}
						<div style={{ marginTop: 6 }}>
							<ProgressBar
								value={Math.min(m.kills, GOALS[Math.min(t, GOALS.length - 1)])}
								max={GOALS[Math.min(t, GOALS.length - 1)]}
								tone='gold'
								height={16}
								label={`${m.kills} / ${GOALS[Math.min(t, GOALS.length - 1)]}`}
							/>
						</div>
						<div className='ds-paper-cols' style={{ marginTop: 10 }}>
							<div>
								<div className='ds-capi'>Stats</div>
								{m.stats.map(([l, v]) => (
									<div className='ds-paper-row' key={l}>
										<span>{l}</span>
										<b style={{ color: INK }}>{t >= 1 ? v : '?'}</b>
									</div>
								))}
							</div>
							<div>
								<div className='ds-capi'>{t >= 3 ? 'Drops' : 'Drops · 500 kills to reveal'}</div>
								{m.drops.map(([l, v, c]) => (
									<div className='ds-paper-row' key={l}>
										<span>{t >= 3 ? l : '?'}</span>
										<b style={{ color: c }}>{t >= 3 ? v : '?'}</b>
									</div>
								))}
							</div>
						</div>
					</Panel>
				</div>
			</WindowShell>
		</DsRoot>
	);
};

export { SectionLabel };
