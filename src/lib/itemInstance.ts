import type { AffixDef } from '@/catalog/affixes';
import type { RarityDef } from '@/catalog/rarity';
import { MAX_ITEM_LEVEL, STAT_KEYS, affixMagnitude, affixesValue, levelScale, qualityValue, valueCurve, qualityMultiplier, roundStat, scaleStats, type ItemStats } from '@/catalog/stats';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import { lerp } from '@/lib/rng';
import type { ItemDef, ItemInstance } from '@/types/game';

// An ItemInstance stores choices only; everything below derives the numbers from the catalog and the level curve.

export interface ResolvedAffix {
	id: string;
	name: string;
	position: 'prefix' | 'suffix';
	stat: keyof ItemStats;
	value: number;
}

export interface ResolvedItem {
	instance: ItemInstance;
	def: ItemDef;
	rarity: RarityDef;
	/** The base stats at this level and quality (no affixes) */
	baseStats: ItemStats;
	affixes: ResolvedAffix[];
	/** Base stats plus affixes: what wearing it gives */
	stats: ItemStats;
	/** "Keen Iron Sword of Precision" */
	name: string;
}

/** The value of one rolled affix at an item level. */
export const affixValue = (affix: AffixDef, roll: number, itemLevel: number): number =>
	roundStat(affix.stat, affixMagnitude(affix.stat, itemLevel) * affix.power * lerp(affix.roll[0], affix.roll[1], Math.min(100, Math.max(0, roll)) / 100));

/** Whether an affix can roll on an item of this level and rarity (tags, level, rank, enabled). */
export const affixFits = (affix: AffixDef, item: ItemDef, itemLevel: number, rarity: RarityDef): boolean =>
	affix.enabled &&
	itemLevel >= affix.minItemLevel &&
	rarity.order >= (affix.minRarityRank ?? 0) &&
	(affix.tags.length === 0 || affix.tags.some((tag) => item.tags?.includes(tag)));

/** The authored stats of a base at an item level, with the quality and rarity multipliers. A legacy instance (authored level, quality 50) returns the authored values exactly. */
export const baseStatsAt = (def: ItemDef, level: number, quality: number, rarity: RarityDef): ItemStats =>
	scaleStats(def.stats ?? {}, levelScale(level) / levelScale(def.minItemLevel ?? 1), qualityMultiplier(quality) * rarity.statMultiplier);

const sumBlocks = (blocks: ItemStats[]): ItemStats => {
	const out: ItemStats = {};
	for (const key of STAT_KEYS) {
		const total = blocks.reduce((sum, block) => sum + (block[key] ?? 0), 0);
		if (total) out[key] = Math.round(total * 100) / 100;
	}
	return out;
};

const cache = new WeakMap<ItemInstance, ResolvedItem>();

/** Derives everything about an instance. Cached per instance object when the default data is used; null if the instance does not match the data. */
export const resolveItem = (instance: ItemInstance, data: LootData = LOOT_DATA): ResolvedItem | null => {
	const useCache = data === LOOT_DATA;
	const hit = useCache ? cache.get(instance) : undefined;
	if (hit) return hit;
	const def = data.items[instance.base];
	const rarity = data.rarities[instance.rarity];
	if (!def || !rarity || !def.slot) return null;

	const baseStats = baseStatsAt(def, instance.level, instance.quality, rarity);
	const affixes: ResolvedAffix[] = [];
	for (const roll of instance.affixes) {
		const affix = data.affixes[roll.id];
		if (!affix) return null;
		affixes.push({ id: affix.id, name: affix.name, position: affix.position, stat: affix.stat, value: affixValue(affix, roll.roll, instance.level) });
	}
	const stats = sumBlocks([baseStats, ...affixes.map((a) => ({ [a.stat]: a.value }) as ItemStats)]);
	const prefix = affixes.find((a) => a.position === 'prefix');
	const suffix = affixes.find((a) => a.position === 'suffix');
	const name = [prefix?.name, def.name, suffix?.name].filter(Boolean).join(' ');

	const resolved: ResolvedItem = { instance, def, rarity, baseStats, affixes, stats, name };
	if (useCache) cache.set(instance, resolved);
	return resolved;
};

/**
 * What a merchant pays for an instance: the rarity's value at level 1, grown with the item level (`valueCurve`), then by the
 * quality roll and by every affix, so a well rolled rare is worth clearly more than a plain one. Always at least 1.
 */
export const sellValueOf = (instance: ItemInstance, data: LootData = LOOT_DATA): number => {
	const rarity = data.rarities[instance.rarity];
	if (!rarity) return 0;
	const value = rarity.sellValue * valueCurve(instance.level) * qualityValue(instance.quality) * affixesValue(instance.affixes.map((a) => a.roll));
	return Math.max(1, Math.round(value));
};

/** The item an old save held when it only stored an id: the base at its authored level, neutral quality, its old rarity, no affixes. Resolves to the old stats exactly. */
export const legacyInstance = (id: string, rarity: string, data: LootData = LOOT_DATA): ItemInstance | null => {
	const def = data.items[id];
	if (!def || !def.slot) return null;
	return { base: id, level: def.minItemLevel ?? 1, rarity, quality: 50, affixes: [] };
};

/** A base item as a plain instance: its authored level, neutral quality, no affixes. Common unless it is a named item. For starter kits, shop stock, tools and tests. */
export const plainItem = (id: string, data: LootData = LOOT_DATA): ItemInstance => {
	const def = data.items[id];
	if (!def || !def.slot) throw new Error(`plainItem: ${id} is not gear`);
	return { base: id, level: def.minItemLevel ?? 1, rarity: def.fixedRarity ?? 'common', quality: 50, affixes: [] };
};

const isInt = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/**
 * Checks that an instance is something the generator could have produced (a save, an import, a server upload).
 * Returns the reason it is not, or null. Deliberately no LOWER bound on the affix count, so migrated items stay valid.
 */
export const instanceProblem = (instance: ItemInstance, data: LootData = LOOT_DATA): string | null => {
	const def = data.items[instance.base];
	if (!def || !def.slot || def.kind === 'consumable') return 'unknown item';
	const rarity = data.rarities[instance.rarity];
	if (!rarity || !rarity.enabled) return 'unknown rarity';
	const min = def.minItemLevel ?? 1;
	const max = def.maxItemLevel ?? MAX_ITEM_LEVEL;
	if (!isInt(instance.level, min, max)) return 'item level out of range';
	if (def.generation === 'named' ? instance.rarity !== def.fixedRarity : !def.allowedRarities?.includes(instance.rarity)) return 'rarity not allowed';
	if (!isInt(instance.quality, 0, 100)) return 'quality out of range';
	if (!Array.isArray(instance.affixes) || instance.affixes.length > (def.generation === 'named' ? 0 : rarity.maxAffixes)) return 'too many affixes';
	const groups = new Set<string>();
	for (const roll of instance.affixes) {
		const affix = roll && typeof roll.id === 'string' ? data.affixes[roll.id] : undefined;
		if (!affix || !isInt(roll.roll, 0, 100)) return 'bad affix';
		if (!affixFits(affix, def, instance.level, rarity)) return 'affix does not fit';
		if (groups.has(affix.group)) return 'duplicate affix group';
		groups.add(affix.group);
	}
	return null;
};
