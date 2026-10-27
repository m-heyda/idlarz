import { STAT_DEFS, MAX_ITEM_LEVEL } from '@/catalog/stats';
import type { RollsDef } from '@/catalog/lootConfig';
import { EQUIPMENT_LAYOUT } from '@/catalog';
import { affixFits } from '@/lib/itemInstance';
import { LOOT_DATA, type LootData } from './data';
import { eligibleCandidates, poolMembers } from './pools';
import { resolveSourceLevel } from './generate';

export interface LootValidation {
	/** The configuration is broken: loading it would drop wrong items or crash */
	errors: string[];
	/** Legal but probably not what was meant (an affix no item can roll, a rarity that gets fewer affixes than it asks for) */
	warnings: string[];
}

export interface ValidateOptions {
	/** Highest monster tier a source can reach (COMBAT.maxTier) */
	maxTier?: number;
	/** Highest castle level (the world level a source's level grows with) */
	maxCastleLevel?: number;
}

const SLOTS = new Set<string>([...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom, 'ring']);
const isProb = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

/**
 * Checks the whole loot configuration (docs/10-loot-system.md): references resolve, weights and ranges make sense, and every
 * weighted rarity has an eligible item at every item level a source can reach. Run by the tests (and so CI) and available
 * to the dev tooling; pure and cheap.
 */
export const validateLootData = (data: LootData = LOOT_DATA, { maxTier = 5, maxCastleLevel = 10 }: ValidateOptions = {}): LootValidation => {
	const errors: string[] = [];
	const warnings: string[] = [];
	const err = (msg: string) => errors.push(msg);

	// ---- rarities
	const ranks = new Set<number>();
	for (const [id, r] of Object.entries(data.rarities)) {
		if (r.id !== id) err(`rarity ${id}: id field is ${r.id}`);
		if (ranks.has(r.order)) err(`rarity ${id}: rank ${r.order} is used twice`);
		ranks.add(r.order);
		if (!(r.minAffixes >= 0) || !(r.maxAffixes >= r.minAffixes)) err(`rarity ${id}: bad affix range ${r.minAffixes}-${r.maxAffixes}`);
		if (!(r.statMultiplier > 0)) err(`rarity ${id}: statMultiplier must be positive`);
		if (r.enabled && (!r.label || !r.color || !r.glow || !(r.sellValue >= 0))) err(`rarity ${id}: enabled but missing label, colour, glow or sell value`);
	}

	// ---- affixes
	const allTags = new Set(Object.values(data.items).flatMap((item) => item.tags ?? []));
	for (const [id, a] of Object.entries(data.affixes)) {
		if (a.id !== id) err(`affix ${id}: id field is ${a.id}`);
		if (!(a.stat in STAT_DEFS)) err(`affix ${id}: unknown stat ${a.stat}`);
		if (!(a.power > 0) || !(a.roll[0] > 0) || a.roll[1] < a.roll[0]) err(`affix ${id}: bad power or roll range`);
		if (!(a.weight > 0)) err(`affix ${id}: weight must be positive`);
		if (!a.group) err(`affix ${id}: no group`);
		if (!(a.minItemLevel >= 1 && a.minItemLevel <= MAX_ITEM_LEVEL)) err(`affix ${id}: bad minItemLevel`);
		for (const tag of a.tags) if (!allTags.has(tag)) err(`affix ${id}: no item has the tag ${tag}`);
	}

	// ---- items
	for (const [id, item] of Object.entries(data.items)) {
		if (item.id !== id) err(`item ${id}: id field is ${item.id}`);
		if (!item.generation) continue; // consumables
		const min = item.minItemLevel;
		const max = item.maxItemLevel;
		if (!item.slot || !SLOTS.has(item.slot)) err(`item ${id}: unknown slot ${item.slot}`);
		if (min === undefined || max === undefined || !(min >= 1) || !(max <= MAX_ITEM_LEVEL) || min > max) err(`item ${id}: bad item level window ${min}-${max}`);
		if (!item.tags?.length) err(`item ${id}: no tags`);
		if (!(item.poolWeight && item.poolWeight > 0)) err(`item ${id}: poolWeight must be positive`);
		if (item.generation === 'base') {
			if (!item.allowedRarities?.length) err(`item ${id}: a base needs allowedRarities`);
			for (const r of item.allowedRarities ?? []) if (!data.rarities[r]) err(`item ${id}: unknown rarity ${r}`);
		} else {
			if (!item.fixedRarity || !data.rarities[item.fixedRarity]) err(`item ${id}: named item needs a known fixedRarity`);
			if (!item.pools?.length) err(`item ${id}: named item is in no pool`);
		}
		for (const pool of item.pools ?? []) if (!data.pools[pool]) err(`item ${id}: unknown pool ${pool}`);
	}

	// ---- pools
	for (const [id, pool] of Object.entries(data.pools)) {
		if (pool.id !== id) err(`pool ${id}: id field is ${pool.id}`);
		for (const ref of [...(pool.includeIds ?? []), ...(pool.excludeIds ?? []), ...Object.keys(pool.weights ?? {}), ...Object.keys(pool.quantities ?? {}), ...Object.keys(pool.minLevels ?? {})]) {
			if (!data.items[ref]) err(`pool ${id}: unknown item ${ref}`);
		}
		if (pool.enabled && poolMembers(data, id).length === 0) err(`pool ${id}: enabled but has no items`);
	}

	// ---- profiles and sources
	const checkRolls = (where: string, rolls: RollsDef) => {
		if (!(Number.isInteger(rolls.min) && Number.isInteger(rolls.max) && rolls.min >= 0 && rolls.max >= rolls.min)) err(`${where}: bad roll count ${rolls.min}-${rolls.max}`);
		if ((rolls.guaranteed ?? 0) > rolls.max) err(`${where}: guaranteed rolls exceed the maximum`);
		if (!isProb(rolls.chancePerRoll)) err(`${where}: chancePerRoll must be 0-1`);
	};
	for (const [id, profile] of Object.entries(data.profiles)) {
		const at = `profile ${id}`;
		if (profile.id !== id) err(`${at}: id field is ${profile.id}`);
		checkRolls(at, profile.rolls);
		const lv = profile.itemLevel;
		if (!(lv.min >= 1 && lv.max <= MAX_ITEM_LEVEL && lv.min <= lv.max && lv.variance >= 0)) err(`${at}: bad item level bounds`);
		if (profile.generalPoolId && !data.pools[profile.generalPoolId]) err(`${at}: unknown general pool ${profile.generalPoolId}`);
		let positive = 0;
		for (const [r, w] of Object.entries(profile.rarityWeights)) {
			if (!data.rarities[r]) err(`${at}: weight for unknown rarity ${r}`);
			else if (!(Number.isFinite(w) && w >= 0)) err(`${at}: weight of ${r} must be non-negative`);
			else if (w > 0 && data.rarities[r].enabled) positive++;
		}
		for (const r of Object.keys(profile.rarityLevelGate ?? {})) if (!data.rarities[r]) err(`${at}: level gate for unknown rarity ${r}`);
		if (profile.generalPoolId && positive === 0) err(`${at}: no enabled rarity has a positive weight`);
		const tableIds = new Set<string>();
		for (const t of profile.bonusTables) {
			const tat = `${at} table ${t.id}`;
			if (tableIds.has(t.id)) err(`${tat}: duplicate table id`);
			tableIds.add(t.id);
			if (!data.pools[t.poolId]) err(`${tat}: unknown pool ${t.poolId}`);
			if (t.chance !== undefined && !isProb(t.chance)) err(`${tat}: chance must be 0-1`);
			if (t.rolls) checkRolls(tat, t.rolls);
			if (t.pity && !(t.pity.perMiss >= 0 && t.pity.maxBonus >= 0)) err(`${tat}: bad pity`);
			if (t.mode === 'rolled' && !t.poolId) err(`${tat}: rolled tables need a pool`);
		}
	}
	for (const [id, source] of Object.entries(data.sources)) {
		if (source.id !== id) err(`source ${id}: id field is ${source.id}`);
		if (!data.profiles[source.lootProfileId]) err(`source ${id}: unknown loot profile ${source.lootProfileId}`);
	}

	// ---- coverage: every weighted rarity needs an eligible base at every item level the source can produce
	for (const source of Object.values(data.sources)) {
		const profile = data.profiles[source.lootProfileId];
		if (!profile?.enabled || !profile.generalPoolId || !data.pools[profile.generalPoolId]) continue;
		const levels = new Set<number>();
		for (let tier = 1; tier <= maxTier; tier++) {
			for (let castle = 1; castle <= maxCastleLevel; castle++) {
				const base = resolveSourceLevel(source.level, tier, castle) + profile.itemLevel.offset;
				for (let d = -profile.itemLevel.variance; d <= profile.itemLevel.variance; d++) {
					levels.add(Math.min(profile.itemLevel.max, Math.max(profile.itemLevel.min, base + d)));
				}
			}
		}
		for (const level of [...levels].sort((a, b) => a - b)) {
			const candidates = eligibleCandidates(data, profile.generalPoolId, level).filter((c) => c.def.generation === 'base');
			let any = false;
			for (const [r, w] of Object.entries(profile.rarityWeights)) {
				const rarity = data.rarities[r];
				if (!rarity?.enabled || !(w > 0) || level < (profile.rarityLevelGate?.[r] ?? 1)) continue;
				const fits = candidates.filter((c) => c.def.allowedRarities?.includes(r));
				if (fits.length === 0) err(`source ${source.id}: rarity ${r} has weight but no eligible item at item level ${level}`);
				else any = true;
				for (const c of fits) {
					const room = Object.values(data.affixes).filter((a) => affixFits(a, c.def, level, rarity)).length;
					const groups = new Set(Object.values(data.affixes).filter((a) => affixFits(a, c.def, level, rarity)).map((a) => a.group)).size;
					if (groups < rarity.minAffixes) warnings.push(`item ${c.def.id} at level ${level} can only roll ${groups} affix group(s) of the ${rarity.minAffixes} ${r} asks for (${room} affixes fit)`);
				}
			}
			if (!any) err(`source ${source.id}: nothing can drop at item level ${level}`);
		}
	}

	return { errors, warnings: [...new Set(warnings)] };
};
