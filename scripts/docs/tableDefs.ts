/**
 * The table definitions behind `@table <id>` (see tables.ts for the helpers and the registry). Each one reads the live config and runs the real maths,
 * so a number in the reference is never typed by hand. Imported for its side effect by render.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { ANIMALS, FARM, FARM_UPGRADES } from '../../src/config/farm';
import {
	BASE_GENERATION_RATES,
	BIOME_YIELD,
	CLICK_LADDER,
	GEMS_CAP,
	INITIAL_RESOURCES,
	MAX_CATCHUP_SEC,
	RESOURCE_CAP,
	SCALING_CONFIG,
	STARTING_GEMS,
	TICK_RATE,
	TILE_RESOURCE_COST,
	XP_CAP,
} from '../../src/config/economy';
import { BIOMES, REBIRTH_BIOME_OUTPUT } from '../../src/config/biomes';
import { DAILY_BONUS_GEMS, DAY_SEC, GEM_SHOP } from '../../src/config/gemShop';
import { BIOME_RULES } from '../../src/config/biomeRules';
import { BUILDING_RULES, IDOL_RULES } from '../../src/config/buildings';
import { IDOLS } from '../../src/catalog/idols';
import { idolValueText } from '../../src/lib/idolEconomy';
import { BUILDINGS } from '../../src/catalog/buildings';
import { buildingLevelCost, buildingUpgradeDuration, buildingOutput } from '../../src/lib/buildings';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER } from '../../src/config/playerClasses';
import { describeClassPassives } from '../../src/lib/classPassives';
import { CASTLE_BASE_RATES, CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { MERCHANT_BUY_MULTIPLIER, MERCHANT_RESOURCE_PRICES, MERCHANT_UPGRADE_GROUPS, MERCHANT_UPGRADES } from '../../src/config/merchant';
import { EMBER_UPGRADES } from '../../src/config/rebirth';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { MONSTERS } from '../../src/config/combatConfig';
import { SKILLS } from '../../src/catalog/skills';
import { ACHIEVEMENTS, type AchievementCondition } from '../../src/catalog/achievements';
import { TUTORIAL_LESSONS, TUTORIAL_PATH, type TutorialReward } from '../../src/catalog/tutorial';
import { RARITIES } from '../../src/catalog/rarity';
import { RESOURCE_TIERS, resourcesInTier } from '../../src/catalog/resources';
import { BOSS_LOOT, BOSS_SET_CHANCE, BOSS_UNIQUE_CHANCE, LOOT_PROFILES, LOOT_SOURCES, OPEN_SETS, bossSourceId } from '../../src/catalog/lootConfig';
import { CRAFT_SLOTS, CRAFT_GRADES, GEAR_RECIPES, GEAR_UNLOCK, type CraftGrade } from '../../src/catalog/recipes';
import { GRADE_INFO } from '../../src/catalog/items/grades';
import { CRAFT_GEAR } from '../../src/config/crafting';
import { gearItemLevels, gearOdds, pityRarityOf } from '../../src/lib/craftGear';
import { recipeCostGold } from '../../src/lib/crafting';
import { castleAreaBonus, castleRangeRadius } from '../../src/lib/castleWard';
import { castleModifier } from '../../src/utils/game/castle';
import { cumulativeXp, totalStatPoints } from '../../src/utils/game/character';
import { emberGain, emberIncomeBonus } from '../../src/utils/game/rebirth';
import { monsterStats, spawnLevelRange } from '../../src/lib/monsters';
import { COORD_LIMIT, MAX_OWNED_TILES } from '../../src/utils/world';
import { SELECTABLE_BIOMES } from '../../src/utils/biomeRules';
import { PERSISTED_KEYS } from '../../src/lib/sanitizeSave';
import { SYNC } from '../../src/lib/syncPolicy';
import { MANUAL_CLOUD_COOLDOWN_MS } from '../../src/lib/manualCloudSave';
import { ENFORCEMENT, FLAG_POLICY, POISON_FLAGS } from '../../src/lib/cloudSave/verify';
import { LEGENDARY_PERK_TIERS, PERK_CAPS, PERK_FAMILIES, WEAPON_LEGENDARY_DAMAGE_TOP } from '../../src/catalog/perkCaps';
import { STAT_DEFS } from '../../src/catalog/stats';
import { TABLES, fmt, mdTable } from './tables';

const ROOT = resolve(__dirname, '..', '..');
const sec = (s: number): string => {
	if (s >= 86400) return `${+(s / 86400).toFixed(2)} d`;
	if (s >= 3600) return `${+(s / 3600).toFixed(2)} h`;
	if (s >= 60) return `${+(s / 60).toFixed(1)} min`;
	return `${s} s`;
};
const res = (r: Record<string, number | undefined>): string =>
	Object.entries(r)
		.filter(([, v]) => v)
		.map(([k, v]) => `${k} ${fmt(v as number)}`)
		.join(', ');
const pct = (x: number): string => `${+(x * 100).toPrecision(4)}%`;

TABLES['economy-basics'] = () => ({
	title: 'Basics',
	md: mdTable(
		['Thing', 'Value', 'Source'],
		[
			['Game tick', `${TICK_RATE} ms; one tick never advances more than ${MAX_CATCHUP_SEC} s`, '`TICK_RATE`, `MAX_CATCHUP_SEC`'],
			['Stockpile cap (every resource and XP)', `${RESOURCE_CAP.toExponential(0)}`, '`RESOURCE_CAP`, `XP_CAP`' + (XP_CAP === RESOURCE_CAP ? '' : ' (differs)')],
			['Start', `${res(INITIAL_RESOURCES)}, ${fmt(STARTING_GEMS)} gems (gem cap ${GEMS_CAP.toExponential(0)})`, '`INITIAL_RESOURCES`, `STARTING_GEMS`'],
			['Income with nothing built', `${res(BASE_GENERATION_RATES)} per second`, '`BASE_GENERATION_RATES`'],
			['Castle position', `(${CASTLE_X}, ${CASTLE_Y})`, '`CASTLE_X`, `CASTLE_Y`'],
			['Map size', `unbounded; coordinates within +-${fmt(COORD_LIMIT)}, at most ${fmt(MAX_OWNED_TILES)} owned tiles`, '`COORD_LIMIT`, `MAX_OWNED_TILES`'],
			['Resource tiers', RESOURCE_TIERS.map((t) => `${t.label}: ${resourcesInTier(t.id).join(', ') || 'none yet'}`).join('; '), '`RESOURCE_TIERS`'],
		],
	),
});

const priceAt = (n: number): number => SCALING_CONFIG.costFormula(n);
TABLES['tile-price-examples'] = () => {
	const ns = [1, 10, 20, 50, 100, 200, 300, 400, 500, 1000];
	const cumulative = (n: number): number => {
		let sum = 0;
		for (let k = 1; k <= n; k++) sum += priceAt(k);
		return sum;
	};
	return {
		title: 'Gold price of the next tile (before any discount) and cumulative gold',
		md: mdTable(['Tiles owned (n)', 'price(n)', 'Cumulative gold for the first n tiles'], ns.map((n) => [n, fmt(priceAt(n)), n % 100 === 0 && n <= 500 ? fmt(cumulative(n)) : ''])),
	};
};

TABLES['tile-extra-resources'] = () => ({
	title: 'Extra resources per tile purchase (share of the gold price)',
	md: mdTable(['From tile', 'Resource', 'Share of the gold price'], TILE_RESOURCE_COST.map((c) => [c.from, c.resource, pct(c.share)])),
});

TABLES['biome-output'] = () => ({
	title: 'Config output per second (x BIOME_YIELD.scale for a real tile)',
	md: mdTable(
		['Biome', 'Config output / s'],
		[
			['Castle', `${res(CASTLE_BASE_RATES)} (not scaled)`],
			...SELECTABLE_BIOMES.map((b) => [BIOMES[b].label, res(BIOMES[b].resourceGeneration as Record<string, number>) || '-']),
			['(scale)', `x${BIOME_YIELD.scale}`],
		],
	),
});

TABLES['rebirth-biome-output'] = () => ({
	title: 'Rebirth biomes: unlock and output per second (x BIOME_YIELD.scale for a real tile)',
	md: mdTable(
		['Biome', 'Unlocks after rebirth', 'Measured against', 'Multiplier', 'Config output / s'],
		Object.entries(REBIRTH_BIOME_OUTPUT).map(([b, o]) => [BIOMES[b].label, BIOME_RULES.unlockAfterRebirths[b], o.measuredAgainst, `x${o.multiplier}`, res(BIOMES[b].resourceGeneration as Record<string, number>)]),
	),
});

TABLES['castle-levels'] = () => ({
	title: 'Castle levels',
	md: mdTable(
		['Level', 'Modifier on every resource', 'Range', 'Area bonus', 'Upgrade to next: time', 'Upgrade to next: cost'],
		Array.from({ length: CASTLE_UPGRADE.maxLevel }, (_, i) => {
			const L = i + 1;
			const r = castleRangeRadius(L);
			const cost = CASTLE_UPGRADE.upgradeCosts[i];
			return [L, `+${pct(castleModifier(L))}`, `${2 * r + 1}x${2 * r + 1}`, `+${pct(castleAreaBonus(L))}`, L < CASTLE_UPGRADE.maxLevel ? sec(CASTLE_UPGRADE.durationsSec[i]) : '-', cost ? res(cost) : '-'];
		}),
	),
});

TABLES['building-rules'] = () => ({
	title: 'Building levels (the building system, flag off)',
	md: mdTable(
		['Level', 'Castle level needed', 'Output x (of level 1)', 'Timer to reach it', 'Cost at 100 tiles'],
		Array.from({ length: BUILDING_RULES.maxLevel }, (_, i) => {
			const L = i + 1;
			return [L, L, `x${1 + BUILDING_RULES.producer.levelStep * i}`, L === 1 ? 'built at once' : sec(buildingUpgradeDuration(L - 1)), res(buildingLevelCost(L, 100) as Record<string, number>)];
		}),
	),
});

TABLES['building-catalog'] = () => ({
	title: 'The Producers and Extractors (one of each per home biome, level 1, with 0 and 25 owned tiles of the biome)',
	md: mdTable(
		['Building', 'Biome', 'Makes per second at 0 biome tiles', 'at 25 biome tiles'],
		BUILDINGS.map((b) => [
			b.label,
			BIOMES[b.biome].label,
			res(buildingOutput(b, 1, 0) as Record<string, number>),
			res(buildingOutput(b, 1, 25) as Record<string, number>),
		]),
	),
});

TABLES['idol-catalog'] = () => ({
	title: 'The twelve Idols (one per biome)',
	md: mdTable(
		['Idol', 'Biome', 'Effect per level', 'Level 5', 'Applied by the game'],
		IDOLS.map((i) => [
			i.label,
			BIOMES[i.biome]?.label ?? i.biome,
			idolValueText(i, 1),
			idolValueText(i, 5),
			i.applied ? 'yes' : 'coming soon',
		]),
	),
});

TABLES['idol-effects'] = () => {
	// "all Idols maxed" next to the Ember contribution (docs/plan/18 section 9): the same level on every Idol, against the income the Embers a first rebirth pays add
	const levels = [1, 2, 3, 4, 5];
	return {
		title: 'All Idols at one level, next to the Embers',
		md:
			mdTable(
				['Level of every Idol', 'XP gain', 'Kill rewards', 'Away income', 'Luck', 'Chest speed', 'Crafting XP', 'Damage', 'Max HP and armor', 'Build time'],
				levels.map((l) => {
					const pctText = `+${l * IDOL_RULES.perLevel} %`;
					return [l, pctText, pctText, `+${l * IDOL_RULES.perLevel} points`, `+${l * IDOL_RULES.luckPerLevel}`, pctText, pctText, pctText, pctText, `-${l * IDOL_RULES.perLevel} %`];
				}),
			) +
			`

For scale, the income bonus of the Embers ever earned (\`emberIncomeBonus\`, every resource but XP): ${[10, 25, 50, 100].map((e) => `${e} Embers +${+(emberIncomeBonus(e) * 100).toPrecision(3)} %`).join(', ')}. No Idol touches the income: the largest Idol bonus is +${5 * IDOL_RULES.perLevel} % at level 5, on one number each. The Dwarf Statue and Master Builders together never cut a timer by more than ${IDOL_RULES.buildTimeCap} %.
`,
	};
};

TABLES['farm-animals'] = () => ({
	title: `Animals (the pen holds ${FARM.baseCap} per kind)`,
	md: mdTable(
		['Animal', 'First cost (food)', 'Cost x per animal', 'Meat / s each', 'Product / s each'],
		ANIMALS.map((a) => [a.name, fmt(a.baseCost), a.costScaling, a.baseProduction, `${a.product.resource} ${a.product.perSec}`]),
	),
});

TABLES['farm-upgrades'] = () => ({
	title: 'Farm upgrades',
	md: mdTable(
		['Upgrade', 'Effect (1 level)', 'Max level', 'Base cost (level 1)', 'Growth'],
		Object.values(FARM_UPGRADES).map((u) => [u.label, u.description(1), u.maxLevel, res(u.cost as Record<string, number>), u.costGrowth]),
	),
});

const BUYABLE = new Set(['wood', 'stone', 'coal', 'food', 'meat']);
TABLES['merchant-prices'] = () => ({
	title: 'Merchant prices (gold per unit)',
	md: mdTable(
		['Resource', 'Sell price', 'Buy price'],
		Object.entries(MERCHANT_RESOURCE_PRICES).map(([k, v]) => [k, v, BUYABLE.has(k) ? Math.ceil(v * MERCHANT_BUY_MULTIPLIER) : 'not sold']),
	),
});

TABLES['merchant-upgrades'] = () => ({
	title: 'Merchant upgrades',
	md: mdTable(
		['Id (label)', 'Group', 'Per level', 'Max', 'Base cost', 'Growth'],
		Object.entries(MERCHANT_UPGRADES).map(([id, u]) => [`${id} (${u.label})`, MERCHANT_UPGRADE_GROUPS[u.group as keyof typeof MERCHANT_UPGRADE_GROUPS], u.description(1), u.maxLevel, fmt(u.baseCost), u.costGrowth]),
	),
});

TABLES['click-ladder'] = () => ({
	title: 'Click ladder',
	md: mdTable(['Level', 'Power (x gold/s)', 'Floor (gold)', 'Price (gold, merchant)'], CLICK_LADDER.map((l, i) => [i, l.power, l.floor, l.price ? fmt(l.price) : 'free'])),
});

TABLES['skills'] = () => ({
	title: 'Skills',
	md: mdTable(
		['Skill', 'Unlock level', 'Mana', 'Cooldown', 'Fights only', 'Effect'],
		Object.values(SKILLS).map((s) => [s.name, s.unlockLevel, s.manaCost, `${s.cooldownSec} s`, s.fightOnly ? 'yes' : 'no', s.healFraction ? `${pct(s.healFraction)} of max HP` : `${s.stunSec} s stun`]),
	),
});

TABLES['monster-roster'] = () => ({
	title: 'The roster (level 1 stats; bosses at their reference level)',
	md: mdTable(
		['Biome', 'Monster', 'Ref. level', 'HP', 'Attack', 'Armor', 'Speed / s', 'Spawn level window (castle 1 -> castle 10)'],
		Object.entries(MONSTERS).map(([type, d]) => {
			const t = type as keyof typeof MONSTERS;
			const s = monsterStats(t, d.refLevel);
			const a = spawnLevelRange(t, 1);
			const b = spawnLevelRange(t, 10);
			return [d.spawn.biomes.join(', '), d.grade === 'boss' ? `${d.label} (boss)` : d.label, d.refLevel, fmt(s.maxHp), s.attack, s.armor, +s.attackSpeed.toFixed(2), `${a.min}-${a.max} -> ${b.min}-${b.max}`];
		}),
	),
});

TABLES['kill-rewards'] = () => {
	const seen = new Set<string>();
	const rows: (string | number)[][] = [];
	for (const d of Object.values(MONSTERS)) {
		const key = d.grade === 'boss' ? 'boss' : d.spawn.biomes[0];
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push([key === 'boss' ? 'Boss (all)' : key, d.reward.gold.rewardSec, fmt(d.reward.gold.cap), fmt(d.reward.xp.cap), d.reward.levelMult]);
	}
	return { title: 'Kill rewards per biome', md: mdTable(['Biome', 'rewardSec', 'Gold cap (level 1; bosses at refLevel)', 'XP cap', 'levelMult'], rows) };
};

TABLES['level-curve-examples'] = () => ({
	title: 'Total XP to reach a level',
	md: mdTable(['Level', 'Total XP'], [2, 5, 10, 20, 30, 50, 80, 90, 99, 100].map((l) => [l, fmt(cumulativeXp(l))])),
});

TABLES['stat-points-examples'] = () => ({
	title: 'Attribute points earned by level',
	md: mdTable(['Level', 'Total points'], [2, 10, 30, 80, 100].map((l) => [l, totalStatPoints(l)])),
});

TABLES['gem-price-book'] = () => ({
	title: 'Gem shop price book',
	md: mdTable(
		['Item', 'Tab', 'Price (gems)', 'Cooldown', 'What it does'],
		GEM_SHOP.map((item) => [item.name, item.tab, item.price, item.cooldownSec > 0 ? `${item.cooldownSec / DAY_SEC} days` : 'none', item.blurb]),
	),
});

TABLES['gem-daily-ladder'] = () => ({
	title: 'Daily first-login bonus by day of the streak',
	md: mdTable(['Day', 'Gems'], DAILY_BONUS_GEMS.map((gems, i) => [i + 1, gems])),
});

TABLES['ember-gain-examples'] = () => ({
	title: 'Embers gained (no Ancestral Tithe)',
	md: mdTable(
		['Castle level', 'Tiles', 'Rebirths already done', 'Embers'],
		[
			[6, 400, 0],
			[6, 450, 0],
			[8, 500, 0],
			[10, 500, 0],
			[10, 1000, 0],
			[10, 450, 1],
		].map(([c, t, r]) => [c, t, r, emberGain(c, t, undefined, r)]),
	),
});

TABLES['ember-income-examples'] = () => ({
	title: 'Income bonus from Embers ever earned',
	md: mdTable(['Embers earned', 'Income bonus'], [10, 22, 47, 76, 170, 500].map((e) => [e, `+${Math.round(emberIncomeBonus(e) * 100)}%`])),
});

const EMBER_EFFECT: Record<string, (n: number) => string> = {
	thrift: (n) => `-${pct(n)} tile and building cost`,
	builders: (n) => `-${pct(n)} castle build time`,
	mastery: (n) => `+${pct(n)} gold per click`,
	provisions: (n) => `start every run with +${n} bundle(s) of ${res(EMBER_UPGRADES.provisions.bundle as Record<string, number>)}`,
	nightwatch: (n) => `+${n} hour of paid away time`,
	steward: (n) => `+${pct(n)} income while away`,
	deeppockets: (n) => `+${n} bag slots`,
};
TABLES['ember-shop'] = () => ({
	title: 'The Ember shop',
	md: mdTable(
		['Id', 'Label', 'Base cost (Embers)', 'Effect per level'],
		Object.entries(EMBER_UPGRADES).map(([id, u]) => [id, u.label, u.baseCost, EMBER_EFFECT[id] ? EMBER_EFFECT[id](u.effectPerLevel) : String(u.effectPerLevel)]),
	),
});

const RAISED_BY: Record<string, string> = {
	bagSize: 'Pack Rat +8 per level, Deep Pockets +4 per level',
	offlineCapHours: 'Night Watch +1 h per level, set bonus hours',
	offlineEfficiency: 'Steward +0.05 per level, set bonus points',
};
TABLES['limits'] = () => ({
	title: 'Limits (base values and hard caps)',
	md: mdTable(
		['Limit', 'Base', 'Hard cap', 'Raised by'],
		Object.entries(LIMITS).map(([k, v]) => [`\`${k}\``, fmt(v), k in HARD_LIMITS ? fmt((HARD_LIMITS as Record<string, number>)[k]) : 'n/a', RAISED_BY[k] ?? 'nothing yet']),
	),
});

TABLES['loot-sources'] = () => ({
	title: 'Loot sources',
	md: mdTable(
		['Source', 'Profile', 'Levels'],
		Object.values(LOOT_SOURCES).map((s) => [s.id, s.lootProfileId, s.level ? `own level: ${s.level.base} + ${s.level.perCastleLevel} per castle level above 1` : `the caller's level, range ${s.levels?.min}-${s.levels?.max}`]),
	),
});

TABLES['boss-loot'] = () => ({
	title: 'What each boss owns',
	md: mdTable(
		['Boss source', 'Boss levels', 'Unique (per kill)', 'Set (per kill)', 'General roll from'],
		Object.entries(BOSS_LOOT).map(([biome, d]) => [
			bossSourceId(biome),
			`${d.levels.min}-${d.levels.max}`,
			d.uniques.length ? `${d.uniques.join(', ')} (${pct(BOSS_UNIQUE_CHANCE)} + pity)` : 'none yet',
			d.setId ? `${d.setId} (${pct(BOSS_SET_CHANCE)} + pity)` : `none yet (open sets still in the general pools: ${OPEN_SETS.join(', ')})`,
			`boss_general_${biome}`,
		]),
	),
});

TABLES['loot-profiles'] = () => ({
	title: 'Loot profiles',
	md: mdTable(
		['Profile', 'Equipment rolls', 'Item level', 'Rarity weights', 'Bonus tables'],
		Object.values(LOOT_PROFILES).map((p) => [
			p.id,
			p.generalPoolId
				? `${p.rolls.min === p.rolls.max ? p.rolls.min : `${p.rolls.min}-${p.rolls.max}`} x ${pct(p.rolls.chancePerRoll)}${p.rolls.chancePerLevel ? ` +${pct(p.rolls.chancePerLevel)}/level` : ''}${p.rolls.guaranteed ? `, ${p.rolls.guaranteed} guaranteed` : ''} from ${p.generalPoolId}`
				: 'none',
			`source level ${p.itemLevel.offset >= 0 ? '+' : ''}${p.itemLevel.offset} +-${p.itemLevel.variance}`,
			Object.entries(p.rarityWeights)
				.map(([r, w]) => `${r} ${w}`)
				.join(', '),
			p.bonusTables.map((t) => `${t.id} (${t.poolId}, ${t.mode}${t.chance !== undefined ? `, ${pct(t.chance)}` : ''}${t.placement ? `, ${t.placement}` : ''})`).join('; ') || '-',
		]),
	),
});

TABLES['rarities'] = () => ({
	title: 'Rarities',
	md: mdTable(
		['Rarity', 'Rank', 'Sell value at item level 1', 'Affixes', 'Enabled'],
		Object.values(RARITIES)
			.sort((a, b) => a.order - b.order)
			.map((r) => [r.label, r.order, fmt(r.sellValue), r.minAffixes === r.maxAffixes ? r.minAffixes : `${r.minAffixes}-${r.maxAffixes}`, r.enabled ? 'yes' : 'no']),
	),
});

TABLES['persisted-keys'] = () => ({ title: 'PERSISTED_KEYS', md: PERSISTED_KEYS.map((k) => `\`${k}\``).join(', ') });

TABLES['sync-triggers'] = () => ({
	title: 'When the game is uploaded to the account',
	md: mdTable(
		['Trigger', 'Upload'],
		[
			['game start', `once, after ${SYNC.firstMs / 1000} s`],
			['milestone (tile, building, castle upgrade, rebirth, shop buys, level up, equip, claim ...)', `after a ${SYNC.eventSettleMs / 1000} s settle, never closer than ${SYNC.eventGapMs / 1000} s to the previous attempt`],
			['idle', `every ${SYNC.heartbeatMs / 60000} min`],
			['tab hidden', `at once unless an attempt was made in the last ${SYNC.hideGapMs / 1000} s; \`keepalive\` only below ${fmt(SYNC.keepaliveMaxBytes)} bytes`],
			['menu "Save game"', `at most once per ${MANUAL_CLOUD_COOLDOWN_MS / 60000} minutes`],
			['failure', `backoff ${SYNC.backoffMs.map((m) => sec(m / 1000)).join(', ')}`],
		],
	),
});

TABLES['flag-policy'] = () => ({
	title: 'What the server does with each flag',
	md: mdTable(
		['Flag', 'Decision', 'Refuses a save when enforcement is on', 'Un-ranks the account (poison)'],
		Object.entries(FLAG_POLICY).map(([f, d]) => [`\`${f}\``, d, d === 'reject' && ENFORCEMENT.reject.has(f as never) ? 'yes' : 'no', POISON_FLAGS.has(f as never) ? 'yes' : 'no']),
	),
});

TABLES['api-routes'] = () => {
	const rows: string[][] = [];
	const base = join(ROOT, 'src', 'app', 'api');
	const walk = (dir: string) => {
		for (const name of readdirSync(dir).sort()) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) walk(full);
			else if (name === 'route.ts') {
				const methods = [...readFileSync(full, 'utf8').matchAll(/export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
				rows.push([`\`/api/${dir.slice(base.length + 1).split(sep).join('/')}\``, methods.join(', '), `\`${full.slice(ROOT.length + 1).split(sep).join('/')}\``]);
			}
		}
	};
	walk(base);
	return { title: 'API routes (scanned from src/app/api)', md: mdTable(['Route', 'Methods', 'File'], rows) };
};

TABLES['tutorial-path'] = () => {
	const rewardText = (r?: TutorialReward) =>
		r ? [r.gold ? `${r.gold} gold` : '', r.wood ? `${r.wood} wood` : '', r.food ? `${r.food} food` : '', ...(r.items ?? []).map((i) => `${i.qty} x ${i.id}`)].filter(Boolean).join(', ') : '-';
	return {
		title: 'The starter path and its bundles',
		md: mdTable(
			['#', 'Step', 'Focus', 'Bundle (once per account)'],
			TUTORIAL_PATH.map((s, i) => [i + 1, `\`${s.id}\``, s.focus, rewardText(s.reward)]),
		),
	};
};
TABLES['tutorial-lessons'] = () => ({
	title: 'Milestone lessons',
	md: mdTable(
		['Lesson', 'Journal heading', 'Spotlight'],
		TUTORIAL_LESSONS.map((l) => [`\`${l.id}\``, l.title, typeof l.target === 'string' ? `\`${l.target}\`` : 'none']),
	),
});

TABLES['achievement-list'] = () => {
	const when = (c: AchievementCondition): string => {
		switch (c.kind) {
			case 'tutorial':
				return 'last step of the starter path done';
			case 'castle':
				return `castle level ${c.level}`;
			case 'kill':
				return `${c.min} x \`${c.monster}\``;
			case 'manual':
				return 'granted by the new chapter reset';
			default:
				return `${c.kind} >= ${c.min}`;
		}
	};
	const total = ACHIEVEMENTS.reduce((sum, a) => sum + a.rewards.gems, 0);
	return {
		title: `The launch achievements (${ACHIEVEMENTS.length}, ${total} gems in total)`,
		md: mdTable(
			['#', 'Id', 'Title', 'Condition', 'Gems', 'Avatar / title'],
			ACHIEVEMENTS.map((a, i) => [i + 1, `\`${a.id}\``, a.title, when(a.when), a.rewards.gems, [a.rewards.avatarId, a.rewards.titleId].filter(Boolean).join(' / ') || '-']),
		),
	};
};

TABLES['stack-versions'] = () => {
	const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
	const all = { ...pkg.dependencies, ...pkg.devDependencies };
	const rows = ['next', 'react', 'tailwindcss', 'zustand', '@supabase/supabase-js', '@supabase/ssr', 'typescript', 'eslint', 'tsx', '@playwright/test', 'prettier'].map((n) => [`\`${n}\``, all[n] ?? '-']);
	return { title: 'Stack (versions from package.json)', md: mdTable(['Package', 'Version'], rows) };
};

TABLES['npm-scripts'] = () => {
	const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
	return { title: 'npm scripts (from package.json)', md: mdTable(['Script', 'Runs'], Object.entries(pkg.scripts).map(([k, v]) => [`\`npm run ${k}\``, `\`${v}\``])) };
};

TABLES['craft-gear'] = () => ({
	title: 'Gear crafting by grade',
	md: mdTable(
		['Grade', 'Unlock (crafting level)', 'Item level at unlock / at the next unlock', 'Seconds each', 'Rarities', 'Rarity chances at Luck 0', 'at Luck 250 (cap)', 'Best rarity (pity)'],
		CRAFT_GRADES.map((grade) => {
			const target = { grade, slot: 'chest' } as const;
			const at = (luck: number) =>
				gearOdds(target, { craftLevel: GEAR_UNLOCK[grade], luck, intelligence: 5 })
					.rarities.map((r) => `${r.id} ${pct(r.chance)}`)
					.join(', ');
			const low = gearItemLevels(grade, GEAR_UNLOCK[grade]);
			const high = gearItemLevels(grade, 80);
			return [
				`${grade} ${GRADE_INFO[grade].label}`,
				GEAR_UNLOCK[grade],
				`${low.min}-${low.max} / ${high.min}-${high.max}`,
				CRAFT_GEAR.timeSec[grade],
				GRADE_INFO[grade].rarities.join(', '),
				at(0),
				at(250),
				pityRarityOf(grade, GEAR_UNLOCK[grade]) ?? 'none (one rarity)',
			];
		}),
	),
});

TABLES['craft-gear-recipes'] = () => ({
	title: 'Gear recipe costs (gold value of the inputs at merchant prices) and crafting XP',
	md: mdTable(
		['Slot', ...CRAFT_GRADES.map((g: CraftGrade) => `${g} cost / XP`)],
		CRAFT_SLOTS.map((slot) => [
			slot,
			...CRAFT_GRADES.map((grade: CraftGrade) => {
				const r = GEAR_RECIPES.find((x) => 'gear' in x.output && x.output.gear.grade === grade && x.output.gear.slot === slot)!;
				return `${fmt(recipeCostGold(r))} / ${r.xp}`;
			}),
		]),
	),
});

TABLES['perk-caps'] = () => ({
	title: 'Perk family caps',
	md: mdTable(
		['Family', 'Cap (% of the gear bucket)', 'Multiplier at the cap'],
		PERK_FAMILIES.map((f) => [STAT_DEFS[f].label, PERK_CAPS[f], `x${(1 + PERK_CAPS[f] / 100).toFixed(2)}`]),
	),
});

TABLES['class-passives'] = () => ({
	title: 'Class passives',
	md: mdTable(
		['Class', 'Combat', 'Economy'],
		PLAYER_CLASS_ORDER.map((id) => {
			const lines = describeClassPassives(id);
			return [PLAYER_CLASSES[id].label, lines.combat.join(', '), lines.economy.join(', ')];
		}),
	),
});

TABLES['perk-tiers'] = () => ({
	title: 'Legendary perk tiers',
	md: mdTable(
		['Family', 'Common', 'Rare', 'Top', 'Top legendaries to fill the cap'],
		PERK_FAMILIES.map((f): (string | number)[] => {
			const t = LEGENDARY_PERK_TIERS[f];
			return [STAT_DEFS[f].label, t.common, t.rare, t.top, Math.ceil(PERK_CAPS[f] / t.top)];
		}).concat([['Damage, weapon legendary', '', '', WEAPON_LEGENDARY_DAMAGE_TOP, Math.ceil(PERK_CAPS.damagePct / WEAPON_LEGENDARY_DAMAGE_TOP)]]),
	),
});
