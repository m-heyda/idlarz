// The pure part of the gem economy sim (scripts/gem-sim.ts, tests/economy/gemSim.test.ts, IDL-229, docs/plan/30-gem-sinks.md sections 3 and 9): what the faucets pay per day, what a player has after 7 / 30 / 90 / 180 days,
// and how many days of income each price of the gem shop is. No dice: every number is an expectation, so the output is exact and a price edit shows up in review.
import { ACHIEVEMENTS } from '../src/catalog/achievements';
import { DEED_MILESTONES } from '../src/catalog/deedMilestones';
import { BIOME_GOALS, MASTERY_BIOMES, masteryTiersOf, biomeRoster } from '../src/catalog/mastery';
import { DAILY_BONUS_GEMS, GEM_SHOP, type GemShopTab } from '../src/config/gemShop';
import { STARTING_GEMS } from '../src/config/economy';
import { CHEST, LUCK } from '../src/config/spawns';
import { chestIntervalSec, gemChance } from '../src/lib/luck';

/** Expected gems of one gem find: `LUCK.gem.min..max`, skewed low (`rollGemAmount`: min + floor(n x u^2), n = max - min + 1). Exact, not sampled. */
export const expectedGemFind = (): number => {
	const { min, max } = LUCK.gem;
	const n = max - min + 1;
	let sum = 0;
	for (let j = 0; j < n; j++) sum += (min + j) * (Math.sqrt((j + 1) / n) - Math.sqrt(j / n));
	return sum;
};

/** Gems per day from chests: chests per day (a full day of the chest timer at this Luck) x the share the player picks up x the gem chance x the expected find. */
export const chestGemsPerDay = (luck: number, collected: number): number => (86_400 / chestIntervalSec(luck)) * collected * gemChance(luck) * expectedGemFind();

/** Gems per day from the daily first-login bonus when the player claims it every `everyDays` days: a streak only climbs when the claims are on consecutive days, so any longer gap pays day 1 each time. */
export const dailyGemsPerDay = (everyDays: number): number =>
	everyDays <= 1 ? DAILY_BONUS_GEMS.reduce((a, b) => a + b, 0) / DAILY_BONUS_GEMS.length : DAILY_BONUS_GEMS[0] / everyDays;

/** The one-off pools: gems that are paid once per account whatever the pace (the totals of the catalogs). */
export interface GemPools {
	/** Every achievement and deed tier except the manual tester marks (their 200 gems are a gift of the new chapter, not a goal) */
	achievements: number;
	/** The Hall of Deeds point milestones */
	milestones: number;
	/** Bestiary mastery: monster ladders and boss ladders, plus the biome goals; reached by thousands of kills, so it is listed but not counted in the horizons */
	mastery: number;
}

export const gemPools = (): GemPools => {
	const achievements = ACHIEVEMENTS.filter((a) => a.when.kind !== 'manual').reduce((sum, a) => sum + a.rewards.gems, 0);
	const milestones = DEED_MILESTONES.reduce((sum, m) => sum + m.gems, 0);
	const types = MASTERY_BIOMES.flatMap((biome) => biomeRoster(biome));
	const mastery =
		types.reduce((sum, type) => sum + masteryTiersOf(type).reduce((s, t) => s + t.gems, 0), 0) +
		MASTERY_BIOMES.length * BIOME_GOALS.reduce((s, g) => s + g.gems, 0);
	return { achievements, milestones, mastery };
};

/**
 * How much of the achievement and milestone pool a player has claimed by day N (a guess, listed so it can be argued with: the pacing sim has no deed model yet). Between two listed days the share grows in a straight line; after the last one it stays.
 */
export const CLAIMED_SHARE: readonly (readonly [day: number, share: number])[] = [
	[0, 0],
	[7, 0.05],
	[30, 0.2],
	[90, 0.45],
	[180, 0.7],
];

export const claimedShare = (day: number): number => {
	for (let i = 1; i < CLAIMED_SHARE.length; i++) {
		const [d0, s0] = CLAIMED_SHARE[i - 1];
		const [d1, s1] = CLAIMED_SHARE[i];
		if (day <= d1) return s0 + ((s1 - s0) * (day - d0)) / (d1 - d0);
	}
	return CLAIMED_SHARE[CLAIMED_SHARE.length - 1][1];
};

/** A kind of player: how much Luck they have, how many of the chests they pick up, how often they claim the daily bonus (1 = every day, 2 = every other day). */
export interface GemProfile {
	id: string;
	label: string;
	luck: number;
	collected: number;
	dailyEveryDays: number;
}

export const GEM_PROFILES: readonly GemProfile[] = [
	{ id: 'casual', label: 'Casual', luck: 0, collected: 0.5, dailyEveryDays: 2 },
	{ id: 'regular', label: 'Regular', luck: 100, collected: 0.5, dailyEveryDays: 1 },
	{ id: 'dedicated', label: 'Dedicated', luck: 300, collected: 1, dailyEveryDays: 1 },
];

/** The days the report looks at. */
export const HORIZONS = [7, 30, 90, 180] as const;

export interface PerDay {
	chests: number;
	daily: number;
	total: number;
}

export const perDayOf = (p: GemProfile): PerDay => {
	const chests = chestGemsPerDay(p.luck, p.collected);
	const daily = dailyGemsPerDay(p.dailyEveryDays);
	return { chests, daily, total: chests + daily };
};

/** Gems earned by day N (the 1,000 start purse is not counted: it is a gift, not a budget): the daily income so far plus the claimed share of the achievement and milestone pool. */
export const earnedBy = (p: GemProfile, day: number, pools: GemPools = gemPools()): number =>
	perDayOf(p).total * day + claimedShare(day) * (pools.achievements + pools.milestones);

/** The first whole day by which the player has earned `price` (null: not within ten years). */
export const daysToEarn = (p: GemProfile, price: number, pools: GemPools = gemPools()): number | null => {
	for (let day = 1; day <= 3650; day++) if (earnedBy(p, day, pools) >= price) return day;
	return null;
};

/** One thing the shop sells, with the level of a tiered item split into its own row. */
export interface PriceRow {
	id: string;
	name: string;
	tab: GemShopTab | 'planned';
	price: number;
	/** Not built yet: priced from docs/plan/30 (Cap Breaks), shown to check the plan, left out of the "whole list" */
	planned: boolean;
}

/** The planned Cap Breaks (docs/plan/30 section 4, IDL-231): 300 x 2.5^(n-1) for the n-th break of a ladder, three per ladder, five economy ladders. */
export const CAP_BREAK = { base: 300, growth: 2.5, perLadder: 3, ladders: 5 };

export const priceBook = (): PriceRow[] => {
	const rows: PriceRow[] = [];
	for (const item of GEM_SHOP) {
		if (item.tiers)
			item.tiers.forEach((price, i) => rows.push({ id: `${item.id}#${i + 1}`, name: `${item.name} ${i + 1}`, tab: item.tab, price, planned: false }));
		else rows.push({ id: item.id, name: item.name, tab: item.tab, price: item.price, planned: false });
	}
	for (let n = 1; n <= CAP_BREAK.perLadder; n++)
		rows.push({
			id: `cap_break#${n}`,
			name: `Cap Break ${n} (per ladder, x${CAP_BREAK.ladders} ladders)`,
			tab: 'planned',
			price: Math.ceil(CAP_BREAK.base * CAP_BREAK.growth ** (n - 1)),
			planned: true,
		});
	return rows;
};

export interface Check {
	id: string;
	text: string;
	ok: boolean;
	detail: string;
}

export interface GemSimResult {
	pools: GemPools;
	perDay: Record<string, PerDay>;
	earned: Record<string, Record<number, number>>;
	book: (PriceRow & { days: Record<string, number | null> })[];
	/** Everything the shop sells today, summed, and the days to earn it (planned rows left out) */
	wholeList: { total: number; days: Record<string, number | null> };
	/** The planned Cap Breaks of every ladder, summed */
	capBreaksAll: number;
	checks: Check[];
}

const cheapest = <T extends PriceRow>(rows: T[], tab: PriceRow['tab']): T =>
	rows.filter((r) => r.tab === tab && r.price > 0).sort((a, b) => a.price - b.price)[0];

export const runGemSim = (): GemSimResult => {
	const pools = gemPools();
	const profiles = GEM_PROFILES;
	const book = priceBook().map((row) => ({ ...row, days: Object.fromEntries(profiles.map((p) => [p.id, daysToEarn(p, row.price, pools)])) }));
	const built = book.filter((r) => !r.planned);
	const total = built.reduce((sum, r) => sum + r.price, 0);
	const wholeList = { total, days: Object.fromEntries(profiles.map((p) => [p.id, daysToEarn(p, total, pools)])) };
	const capBreaksAll = CAP_BREAK.ladders * book.filter((r) => r.planned).reduce((sum, r) => sum + r.price, 0);
	const identity = cheapest(book, 'identity');
	const upgrade = cheapest(book, 'upgrades');
	const firstBreak = book.find((r) => r.planned)!;
	const dayOf = (row: PriceRow & { days: Record<string, number | null> }, id: string) => row.days[id];
	const purse = built.filter((r) => r.price >= STARTING_GEMS * 0.8 && r.price <= STARTING_GEMS);
	const checks: Check[] = [
		{
			id: 'identity-week1',
			text: 'An identity item is affordable in the first week (earnings only, Regular)',
			ok: (dayOf(identity, 'regular') ?? 9999) <= 7,
			detail: `${identity.name} (${identity.price} gems) on day ${dayOf(identity, 'regular')}`,
		},
		{
			id: 'qol-week2',
			text: 'The first upgrade (QoL) is affordable in week 2 (Regular)',
			ok: (dayOf(upgrade, 'regular') ?? 9999) <= 14,
			detail: `${upgrade.name} (${upgrade.price} gems) on day ${dayOf(upgrade, 'regular')}`,
		},
		{
			id: 'cap-break-week4-8',
			text: 'A first Cap Break is not out of reach before week 8 (the rebirth gate decides the day; planned, Regular)',
			ok: (dayOf(firstBreak, 'regular') ?? 9999) <= 56,
			detail: `${firstBreak.price} gems on day ${dayOf(firstBreak, 'regular')}`,
		},
		{
			id: 'whole-list-months',
			text: 'The whole shop is a multi-month goal for Regular (90+ days) and still finite for Dedicated',
			ok: (wholeList.days.regular ?? 9999) >= 90 && wholeList.days.dedicated !== null,
			detail: `${wholeList.total.toLocaleString('en-US')} gems: Regular day ${wholeList.days.regular}, Dedicated day ${wholeList.days.dedicated}`,
		},
		{
			id: 'purse-day1',
			text: `No item takes the whole ${STARTING_GEMS}-gem start purse on day 1 (price within 80-100% of it)`,
			ok: purse.length === 0,
			detail: purse.length === 0 ? 'none' : purse.map((r) => `${r.name} (${r.price})`).join(', '),
		},
	];
	return {
		pools,
		perDay: Object.fromEntries(profiles.map((p) => [p.id, perDayOf(p)])),
		earned: Object.fromEntries(profiles.map((p) => [p.id, Object.fromEntries(HORIZONS.map((d) => [d, earnedBy(p, d, pools)]))])),
		book,
		wholeList,
		capBreaksAll,
		checks,
	};
};

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
const day = (d: number | null) => (d === null ? 'never' : `${d}`);

export const renderGemSim = (r: GemSimResult): string => {
	const lines: string[] = [];
	const out = (s = '') => lines.push(s);
	out('# Gem economy sim (IDL-229)');
	out();
	out(
		`Faucets against the gem shop's price book (\`src/config/gemShop.ts\`), written by \`npm run gem-sim -- --md\`. Everything is an expectation (no dice), so a price or faucet edit changes these numbers and shows in review. Gems earned here do **not** include the ${STARTING_GEMS.toLocaleString('en-US')}-gem start purse: it is a gift, not a spending budget (docs/plan/30 section 9).`,
	);
	out();
	out('## Faucets per day');
	out();
	out(
		`Chests: a chest ticket every ${CHEST.intervalSec} s at Luck 0 (faster with Luck, never below half), a gem roll on each (\`min(15%, 3% + 0.06% x Luck)\`) of ${expectedGemFind().toFixed(1)} gems on average (\`LUCK.gem\`, ${LUCK.gem.min}-${LUCK.gem.max}, skewed low). Daily bonus: ${DAILY_BONUS_GEMS.join(', ')} gems over a 7-day streak (${(DAILY_BONUS_GEMS.reduce((a, b) => a + b, 0) / 7).toFixed(1)} a day when claimed every day, ${DAILY_BONUS_GEMS[0]} per claim when the streak never builds).`,
	);
	out();
	out('| Profile | Luck | Chests picked up | Daily bonus | Chest gems / day | Daily gems / day | Total / day |');
	out('|---|---:|---:|---|---:|---:|---:|');
	for (const p of GEM_PROFILES) {
		const d = r.perDay[p.id];
		out(
			`| ${p.label} | ${p.luck} | ${Math.round(p.collected * 100)}% | ${p.dailyEveryDays === 1 ? 'every day' : `every ${p.dailyEveryDays} days`} | ${n0(d.chests)} | ${n0(d.daily)} | ${n0(d.total)} |`,
		);
	}
	out();
	out('### Chest gems per day, Luck against how many chests are picked up');
	out();
	out('| Luck | 50% of chests | 100% of chests |');
	out('|---:|---:|---:|');
	for (const luck of [0, 100, 300]) out(`| ${luck} | ${n0(chestGemsPerDay(luck, 0.5))} | ${n0(chestGemsPerDay(luck, 1))} |`);
	out();
	out('## One-off pools');
	out();
	out(
		`Achievement and deed tiers: **${n0(r.pools.achievements)}** gems (the manual tester marks excluded). Deed milestones: **${n0(r.pools.milestones)}**. Bestiary mastery (monster and boss ladders plus biome goals): **${n0(r.pools.mastery)}**, but each tier needs hundreds to thousands of kills of one type, so it is left out of the horizons below. The share of the first two a player has claimed by a day is a guess (\`CLAIMED_SHARE\`): ${CLAIMED_SHARE.slice(
			1,
		)
			.map(([d, s]) => `day ${d}: ${Math.round(s * 100)}%`)
			.join(', ')}.`,
	);
	out();
	out('## Gems earned by day');
	out();
	out(`| Profile | ${HORIZONS.map((d) => `Day ${d}`).join(' | ')} |`);
	out(`|---|${HORIZONS.map(() => '---:').join('|')}|`);
	for (const p of GEM_PROFILES) out(`| ${p.label} | ${HORIZONS.map((d) => n0(r.earned[p.id][d])).join(' | ')} |`);
	out();
	out('## The price book against the faucets');
	out();
	out(
		'The day a player has earned the price (alone, with nothing else bought first). **Cap Breaks are planned, not built** (docs/plan/30 section 4): they are priced here from the plan to check it, and are left out of the whole-list total.',
	);
	out();
	out(`| Item | Tab | Price | ${GEM_PROFILES.map((p) => p.label).join(' | ')} |`);
	out(`|---|---|---:|${GEM_PROFILES.map(() => '---:').join('|')}|`);
	for (const row of r.book)
		out(`| ${row.name}${row.planned ? ' (planned)' : ''} | ${row.tab} | ${n0(row.price)} | ${GEM_PROFILES.map((p) => day(row.days[p.id])).join(' | ')} |`);
	out();
	out(
		`**Whole shop today: ${n0(r.wholeList.total)} gems** = day ${GEM_PROFILES.map((p) => `${day(r.wholeList.days[p.id])} (${p.label})`).join(', ')}. Planned Cap Breaks on every ladder add ${n0(r.capBreaksAll)} gems.`,
	);
	out();
	out('## Targets (docs/plan/30 section 9)');
	out();
	out('| Target | Result | Detail |');
	out('|---|---|---|');
	for (const c of r.checks) out(`| ${c.text} | ${c.ok ? 'ok' : '**watch**'} | ${c.detail} |`);
	out();
	return lines.join('\n');
};
