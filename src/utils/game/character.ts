import { zeroResources } from '@/catalog/resourceKeys';
// Attributes, the level curve, XP and the combat stats derived from the attributes (part of the former utils/gameUtils.ts, split in IDL-15).
import { BASE_XP_PER_TILE, XP_CAP, XP_TILE } from '@/config/economy';
import { CHARACTER_STAT_CONFIG, INITIAL_CHARACTER_STATS, LEVELING, MAX_LEVEL } from '@/config/character';
import { STAT_RULES } from '@/config/combatConfig';
import { STAT_CATEGORIES, type StatCategory } from '@/catalog/stats';
import type { CharacterStats, Resources } from '@/types/game';
import { atkSpeedPercent, magicDamagePercent, physicalDamagePercent, statArmor, statMaxMana } from '@/lib/statBonuses';

const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

const R = STAT_RULES;

/** "+2.5% Stone & Coal production per point / +0.2% XP production per point / +0.2% XP gained per point" */
const resourceEffect = (stat: keyof typeof CHARACTER_STAT_CONFIG.resourceTargets): string => {
	const cfg = CHARACTER_STAT_CONFIG;
	const parts = [`+${+(cfg.resourceModifierPerPoint * 100).toFixed(2)}% ${cfg.resourceTargets[stat].map(titleCase).join(' & ')} production per point`];
	if (stat === 'intelligence' || stat === 'charisma') {
		parts.push(`+${+(cfg.xpModifierPerPoint[stat] * 100).toFixed(2)}% XP production per point`);
		parts.push(`+${cfg.xpGainPercentPerPoint[stat]}% XP gained per point`);
	}
	return parts.join(' / ');
};

/**
 * Gets the description for a character stat
 * @param stat The character stat key
 * @returns Description of what the stat does
 */
export const getStatDescription = (stat: keyof Omit<CharacterStats, 'availablePoints'>): string => {
	const descriptions: Record<keyof Omit<CharacterStats, 'availablePoints'>, string> = {
		// Resource, XP and discount effects come from CHARACTER_STAT_CONFIG (the same constants the maths uses)
		// Every number below is read from STAT_RULES / CHARACTER_STAT_CONFIG: the text cannot drift from the maths. Combat bonuses count points above 5.
		strength: `${resourceEffect('strength')} / +${R.physicalDamagePerStrength}% damage with physical weapons per point above ${R.base} / +${R.armorPerStrength} DEF per point above ${R.base} / +${R.critDamagePerPoint.strength}% Crit DMG per point above ${R.base}`,
		dexterity: `${resourceEffect('dexterity')} / +${R.armorPerDexterity} DEF per point above ${R.base} / +${R.atkSpeedPerDexterity}% ATK Speed per point above ${R.base} / +${CHARACTER_STAT_CONFIG.critChancePercentPerPoint.dexterity}% Crit Chance per point / +${R.critDamagePerPoint.dexterity}% Crit DMG per point above ${R.base}`,
		intelligence: `${resourceEffect('intelligence')} / +${R.magicDamagePerIntelligence}% damage with magic weapons (staves, wands) per point above ${R.base} / +${R.mana.perIntelligence} Max Mana per point / +${R.mana.regenPerIntelligence} Mana Regen per second per point`,
		vitality: `${resourceEffect('vitality')} / +${CHARACTER_STAT_CONFIG.hpPerPoint.vitality} HP per point / +${R.armorPerVitality} DEF per point above ${R.base}`,
		charisma: `${resourceEffect('charisma')} / +${CHARACTER_STAT_CONFIG.tileDiscountPercentPerCharisma}% Tile Cost Discount per point (max ${CHARACTER_STAT_CONFIG.tileDiscountCapPercent}%) / +1 Luck per point (bigger chests) / +${CHARACTER_STAT_CONFIG.hpPerPoint.charisma} HP per point / +${CHARACTER_STAT_CONFIG.critChancePercentPerPoint.charisma}% Crit Chance per point / +${R.critDamagePerPoint.charisma}% Crit DMG per point above ${R.base}`,
		// Combat stats
		physicalAtk: 'Bonus damage with physical weapons: swords, daggers, maces, mauls, axes, spears, bows and crossbows. Grows with Strength.',
		magicAtk: 'Bonus damage with magic weapons: staves and wands. Grows with Intelligence, a little faster than Strength does for physical ones.',
		hp: 'Hit Points. Your health that determines how much damage you can take.',
		mp: 'Mana. Skills like Heal and Stun spend it; it refills over time. Grows with Intelligence and magic gear.',
		def: 'Defense from your attributes, added to your gear armor: it cuts the damage monsters deal.',
		luck: 'Influences random events and rare item finds.',
		critChance: 'Percentage chance to land a critical hit for increased damage.',
		atkSpeedIncrease: 'Percentage increase to attack speed. Clicks do not use it yet: it is the base for the speed-based combat.',
		xpGainMultiplier: 'Percentage increase to experience points gained from all sources.',
		tileCostDiscount: 'Percentage discount when purchasing new tiles.',
	};

	return descriptions[stat];
};

/** Which kind of effect one line of a stat description is (the same categories item tooltips group by) */
const descriptionCategory = (line: string): StatCategory => {
	if (/production|XP gained|Discount|Luck|chest/i.test(line)) return 'economy';
	if (/Mana|magic weapons/i.test(line)) return 'magic';
	if (/damage|DMG|Crit|ATK Speed/i.test(line)) return 'combat';
	return 'defense';
};

/** The description of an attribute split into its effects and grouped by kind: Generators (income, XP), Combat, Defense, Magic. */
export const getStatDescriptionGroups = (stat: keyof Omit<CharacterStats, 'availablePoints'>) => {
	const lines = getStatDescription(stat)
		.split(' / ')
		.map((line) => line.trim());
	return STAT_CATEGORIES.map((category) => ({ category, lines: lines.filter((line) => descriptionCategory(line) === category.id) })).filter(
		(group) => group.lines.length > 0,
	);
};

/**
 * Calculate XP gain scaling based on owned tiles
 * The more tiles owned, the more XP gained
 *
 * XP a tile purchase gives, for the `k`-th purchase (`BASE_XP_PER_TILE` 45, `XP_TILE` in `src/config/economy.ts`); multiplied by `1 + XP gain %` of the character.
 * Tile XP is small on purpose: levels come from passive XP, kills and rebirth-paced play, see {@link LEVELING}.
 *
 * @category Economy/Tiles
 * @order 5
 * @formula
 * xp(k) = 45 x 1.02^(min(k,300) - 1) x min(k,300) / 4        times (k / 300)^1.5 beyond 300
 */
export const calculateXpGain = (ownedTiles: number): number => {
	/**
	 * Basic XP gain increases with the number of tiles owned: each tile contributes XP that grows slightly with more tiles.
	 * Up to XP_TILE.growthUntil tiles that is exponential (1.02 per tile); beyond it a polynomial tail keeps it finite.
	 */
	const k = Math.min(ownedTiles, XP_TILE.growthUntil);
	const xp = BASE_XP_PER_TILE * Math.pow(XP_TILE.growth, k - 1) * (k / 4);
	return ownedTiles > XP_TILE.growthUntil ? xp * Math.pow(ownedTiles / XP_TILE.growthUntil, XP_TILE.tailExponent) : xp;
};

/**
 * The XP steps of the level curve, index L - 1 = XP to go from level L to L + 1. Built once from LEVELING.anchors: from one anchor to the
 * next every step is the one before times a constant ratio, solved (bisection) so the steps add up to the anchor's XP; the ratio also
 * applies at the join, so the steps only ever grow. Only additions, multiplications and floor: the same table on every device and on the server.
 */
const buildLevelSteps = (): number[] => {
	const steps: number[] = [];
	let last = LEVELING.firstStepXp;
	let level = 1;
	let xp = 0;
	for (const [toLevel, toXp] of LEVELING.anchors) {
		const n = toLevel - level;
		const total = toXp - xp;
		// the sum of n steps: the first is `first`, each next one is the one before times r
		const first = (r: number) => (level === 1 ? LEVELING.firstStepXp : last * r);
		const sumFor = (r: number) => {
			let step = first(r);
			let sum = 0;
			for (let i = 0; i < n; i++) {
				sum += step;
				step *= r;
			}
			return sum;
		};
		let lo = 1;
		let hi = 4;
		for (let i = 0; i < 200; i++) {
			const mid = (lo + hi) / 2;
			if (sumFor(mid) < total) lo = mid;
			else hi = mid;
		}
		const r = (lo + hi) / 2;
		let step = first(r);
		for (let i = 0; i < n; i++) {
			steps.push(Math.floor(step));
			last = step;
			step *= r;
		}
		level = toLevel;
		xp = toXp;
	}
	return steps;
};
const LEVEL_STEPS = buildLevelSteps();

/**
 * The attribute points a character that has reached `level` has earned in all (a level gives 1; the early levels give extra, see LEVELING).
 *
 * `reconcileCharacter` hands every point back when a character holds more than its level has earned.
 *
 * @category Progression/Levels
 * @order 3
 * @formula
 * totalStatPoints(level) = (level - 1) + (min(level, 30) - 1) x 2
 * @table stat-points-examples
 * @see reconcileCharacter
 */
export const totalStatPoints = (level: number): number => {
	const l = Math.max(1, Math.min(Math.floor(level), LEVELING.maxLevel));
	return l - 1 + Math.max(0, Math.min(l, LEVELING.earlyBonusUntil) - 1) * LEVELING.earlyBonusPoints;
};

const ATTRIBUTES = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

/**
 * Puts a character's attributes in line with an XP total: when more points are spent (and left to spend) than that XP's level has earned
 * (the XP was lowered: the server clamped an impossible total, or a curve change), the attributes go back to their start value and every
 * point the level has earned is left to spend again. A character that is within its points is returned as it is.
 *
 * @category Progression/Levels
 * @order 6
 */
export const reconcileCharacter = (stats: CharacterStats, xp: number): CharacterStats => {
	const level = calculateLevel(xp).level;
	const expected = ATTRIBUTES.length * INITIAL_CHARACTER_STATS.strength + totalStatPoints(level);
	const total = ATTRIBUTES.reduce((sum, key) => sum + stats[key], 0) + stats.availablePoints;
	if (total <= expected) return stats;
	const next: CharacterStats = { ...stats, availablePoints: totalStatPoints(level) };
	for (const key of ATTRIBUTES) next[key] = INITIAL_CHARACTER_STATS[key];
	return Object.assign(next, calculateCombatStats(next));
};

/**
 * XP to go from `level` to the next one (Infinity at the maximum level). The one place the level curve lives (see LEVELING in the config);
 * everything that shows or checks a level threshold uses this.
 *
 * @category Progression/Levels
 * @order 2
 * @formula
 * step(level -> level+1) = previous step x ratio of its anchor segment      (ratio solved so the segment sums to the anchor)
 * cumulativeXp(level)    = sum of steps up to level                         hits every LEVELING.anchors entry exactly
 */
export const xpToNextLevel = (level: number): number => {
	if (!(level >= 1)) return LEVEL_STEPS[0];
	if (level >= LEVELING.maxLevel) return Infinity;
	return LEVEL_STEPS[Math.floor(level) - 1];
};

/**
 * The total XP at which `level` is reached (level 1 is 0).
 *
 * @category Progression/Levels
 * @order 4
 */
export const cumulativeXp = (level: number): number => {
	let total = 0;
	for (let l = 1; l < Math.min(level, LEVELING.maxLevel); l++) total += xpToNextLevel(l);
	return total;
};

/**
 * Level from total XP: each level needs more than the one before (see `xpToNextLevel`), up to MAX_LEVEL, where the bar is full.
 *
 * @category Progression/Levels
 * @order 5
 */
export const calculateLevel = (xp: number): { level: number; progress: number } => {
	let level = 1;
	let remainingXp = Number.isFinite(xp) ? Math.max(0, Math.min(xp, XP_CAP)) : XP_CAP;
	let step = xpToNextLevel(level);

	while (level < MAX_LEVEL && remainingXp >= step) {
		remainingXp -= step;
		level++;
		step = xpToNextLevel(level);
	}
	if (level >= MAX_LEVEL) return { level, progress: 1 };
	return { level, progress: step > 0 ? remainingXp / step : 0 };
};

// Resource Management
// Calculate stat-based resource modifiers
/**
 * What the five attributes add to the income modifier of each resource (all points count, not only those above 5).
 *
 * @category Progression/Attributes
 * @order 2
 * @formula
 * modifier[r] += 0.025 per attribute point on each resource the attribute feeds; xp: +0.2% (Int) / +0.25% (Cha) per point
 */
export const calculateStatResourceModifiers = (stats: CharacterStats): Resources => {
	const modifiers: Resources = zeroResources();

	const cfg = CHARACTER_STAT_CONFIG;
	(Object.keys(cfg.resourceTargets) as (keyof typeof cfg.resourceTargets)[]).forEach((stat) => {
		cfg.resourceTargets[stat].forEach((resource) => {
			modifiers[resource] += stats[stat] * cfg.resourceModifierPerPoint;
		});
	});
	modifiers.xp += stats.intelligence * cfg.xpModifierPerPoint.intelligence;
	modifiers.xp += stats.charisma * cfg.xpModifierPerPoint.charisma;

	return modifiers;
};

// Calculate combat stats from base stats
/**
 * The combat numbers the attributes give (max HP and mana pools, crit chance, ...), from all points or the points above 5 as each rule says.
 *
 * @category Progression/Attributes
 * @order 3
 */
export const calculateCombatStats = (stats: CharacterStats): Partial<CharacterStats> => {
	return {
		// the combat ones come from lib/statBonuses.ts (the same functions the fight uses); bonuses count points above 5
		physicalAtk: physicalDamagePercent(stats),
		magicAtk: magicDamagePercent(stats),
		hp: stats.vitality * CHARACTER_STAT_CONFIG.hpPerPoint.vitality + stats.charisma * CHARACTER_STAT_CONFIG.hpPerPoint.charisma,
		mp: statMaxMana(stats),
		def: statArmor(stats),
		luck: stats.charisma, // +1 per charisma
		critChance:
			stats.dexterity * CHARACTER_STAT_CONFIG.critChancePercentPerPoint.dexterity + stats.charisma * CHARACTER_STAT_CONFIG.critChancePercentPerPoint.charisma,
		atkSpeedIncrease: atkSpeedPercent(stats),
		xpGainMultiplier:
			stats.intelligence * CHARACTER_STAT_CONFIG.xpGainPercentPerPoint.intelligence + stats.charisma * CHARACTER_STAT_CONFIG.xpGainPercentPerPoint.charisma,
		tileCostDiscount: Math.min(stats.charisma * CHARACTER_STAT_CONFIG.tileDiscountPercentPerCharisma, CHARACTER_STAT_CONFIG.tileDiscountCapPercent),
	};
};
