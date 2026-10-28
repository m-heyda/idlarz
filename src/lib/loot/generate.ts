import type { BonusTable, ItemLevelDef, LootProfile, RollsDef, SourceLevelDef } from '@/catalog/lootConfig';
import type { RarityDef } from '@/catalog/rarity';
import { MAX_ITEM_LEVEL, clampItemLevel } from '@/catalog/stats';
import { affixFits } from '@/lib/itemInstance';
import { LUCK } from '@/config/gameConfig';
import { dropChanceMultiplier, rarityLuckMultiplier } from '@/lib/luck';
import { randomInt, weightedPick, type Rng } from '@/lib/rng';
import type { Drop, ItemDef, ItemInstance } from '@/types/game';
import { LOOT_DATA, type LootData } from './data';
import { eligibleCandidates, type Candidate } from './pools';

// The one loot pipeline (docs/10-loot-system.md). Every source (rat, Rat King, chest) goes through it:
//   profile -> roll count -> source level -> item level -> eligible items -> rarity -> item -> instance (+ bonus tables)
// Quantity, rarity, level and eligibility are separate steps; nothing here names a rarity, an item or a monster.

export type LootDrop = Drop;

export interface LootRequest {
	sourceId: string;
	/** The monster's level (sets the item level of what it drops and the per-level chances); omitted for a chest or the shelf */
	level?: number;
	/** The world level: castle level, 1-10 */
	castleLevel?: number;
	/** No item rolled for this request gets a higher item level than this (the merchant's shelf is held to the player's gear) */
	maxItemLevel?: number;
	/** Base item ids the player already has (bag + worn), for tables that prefer missing pieces */
	owned?: readonly string[];
	/** Bad-luck counters from the save, by `profile:table` */
	pity?: Readonly<Record<string, number>>;
	/** The player's Luck: raises the chance of the general gear roll and moves the rarity odds toward rare and better (src/lib/luck.ts) */
	luck?: number;
	/** Extra guaranteed rolls on the general pool (a lucky monster) */
	extraGearRolls?: number;
}

/** Why one roll gave what it gave (dev tools, the simulator, bug reports). */
export interface RollTrace {
	table: string;
	sourceId: string;
	profileId: string;
	sourceLevel: number;
	itemLevel: number;
	poolId: string;
	/** Eligible items per rarity (rolled mode) or in total (fixed mode, key `all`) */
	eligible: Record<string, number>;
	/** The rarity chances actually used, normalised to 1 */
	rarityChances: Record<string, number>;
	rarity?: string;
	itemId?: string;
	quality?: number;
	affixes?: string[];
	note?: string;
}

export interface LootResult {
	drops: LootDrop[];
	sourceLevel: number;
	/** The pity counters after this kill (the same object shape the request took) */
	pity: Record<string, number>;
	trace: RollTrace[];
	/** Configuration problems met while rolling (an empty pool...). Never silently substituted. */
	warnings: string[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** The level of a chest or shelf: its base plus steps for the world (castle) level. Never the player's level. */
export const resolveSourceLevel = (level: SourceLevelDef, castleLevel = 1): number =>
	clampItemLevel(level.base + level.perCastleLevel * (Math.max(1, castleLevel) - 1));

/** Rolls the item level around the source level, inside the profile's bounds. */
export const rollItemLevel = (sourceLevel: number, def: Pick<ItemLevelDef, 'offset' | 'variance'> & Partial<Pick<ItemLevelDef, 'min' | 'max'>>, rng: Rng): number => {
	const centre = sourceLevel + def.offset;
	const rolled = def.variance > 0 ? randomInt(rng, centre - def.variance, centre + def.variance) : centre;
	return Math.min(def.max ?? MAX_ITEM_LEVEL, Math.max(def.min ?? 1, clampItemLevel(rolled)));
};

/** How many of a roll group succeed: a random count in min..max, the first `guaranteed` always, the rest by chance. */
const countSuccesses = (rolls: RollsDef, level: number, rng: Rng, chanceMultiplier = 1): number => {
	const count = randomInt(rng, rolls.min, rolls.max);
	const chance = clamp01((rolls.chancePerRoll + (rolls.chancePerLevel ?? 0) * (level - 1)) * chanceMultiplier);
	let hits = 0;
	for (let i = 0; i < count; i++) {
		if (i < (rolls.guaranteed ?? 0) || chance >= 1 || rng() < chance) hits++;
	}
	return hits;
};

/** Rolls the affixes of an item: a count from the rarity, picked without replacement, one per group, respecting item level and tags. */
const rollAffixes = (def: ItemDef, level: number, rarity: RarityDef, data: LootData, rng: Rng): { id: string; roll: number }[] => {
	if (def.generation === 'named') return [];
	const want = randomInt(rng, rarity.minAffixes, rarity.maxAffixes);
	const picked: { id: string; roll: number }[] = [];
	const groups = new Set<string>();
	for (let i = 0; i < want; i++) {
		const options = Object.values(data.affixes).filter((affix) => !groups.has(affix.group) && affixFits(affix, def, level, rarity));
		const affix = weightedPick(options, (a) => a.weight, rng);
		if (!affix) break; // fewer compatible affixes than the rarity wants: take what exists (the validator reports it)
		groups.add(affix.group);
		picked.push({ id: affix.id, roll: randomInt(rng, 0, 100) });
	}
	return picked;
};

const makeInstance = (def: ItemDef, level: number, rarityId: string, data: LootData, rng: Rng): ItemInstance => {
	const rarity = data.rarities[rarityId];
	const quality = randomInt(rng, 0, 100);
	return { base: def.id, level, rarity: rarityId, quality, affixes: rollAffixes(def, level, rarity, data, rng) };
};

interface Ctx {
	data: LootData;
	req: LootRequest;
	profile: LootProfile;
	sourceLevel: number;
	/** The monster's level (1 for sources without one): drives the per-level chances */
	level: number;
	rng: Rng;
	taken: Set<string>;
	trace: RollTrace[];
	warnings: string[];
}

const baseTrace = (ctx: Ctx, table: string, poolId: string, itemLevel: number): RollTrace => ({
	table,
	sourceId: ctx.req.sourceId,
	profileId: ctx.profile.id,
	sourceLevel: ctx.sourceLevel,
	itemLevel,
	poolId,
	eligible: {},
	rarityChances: {},
});

/** One equipment roll from a pool with the rarity rolled from the profile's weights (the general path). */
const rollRarityGear = (ctx: Ctx, table: string, poolId: string, itemLevel: number): LootDrop | null => {
	const { data, profile } = ctx;
	const trace = baseTrace(ctx, table, poolId, itemLevel);
	ctx.trace.push(trace);
	const all = eligibleCandidates(data, poolId, itemLevel);

	const byRarity: Record<string, Candidate[]> = {};
	const weights: { id: string; weight: number }[] = [];
	for (const [id, weight] of Object.entries(profile.rarityWeights)) {
		const rarity = data.rarities[id];
		if (!rarity?.enabled || !(weight > 0)) continue;
		if (itemLevel < (profile.rarityLevelGate?.[id] ?? 1)) continue;
		// Luck moves the odds toward rare and better; the weights are normalised after, so the other rarities lose share, not weight
		const lucky = rarity.order >= LUCK.rarityFromOrder ? rarityLuckMultiplier(ctx.req.luck ?? 0) : 1;
		const candidates = all.filter((c) => c.def.generation === 'base' && c.def.allowedRarities?.includes(id));
		trace.eligible[id] = candidates.length;
		if (candidates.length === 0) continue;
		byRarity[id] = candidates;
		weights.push({ id, weight: weight * lucky });
	}
	const total = weights.reduce((sum, w) => sum + w.weight, 0);
	for (const w of weights) trace.rarityChances[w.id] = w.weight / total;

	const rarityId = weightedPick(weights, (w) => w.weight, ctx.rng)?.id;
	if (!rarityId) {
		trace.note = 'no eligible item for any weighted rarity';
		ctx.warnings.push(`${ctx.req.sourceId}/${table}: nothing eligible in pool ${poolId} at item level ${itemLevel}`);
		return null;
	}
	const def = weightedPick(byRarity[rarityId], (c) => c.weight, ctx.rng)!.def;
	const item = makeInstance(def, itemLevel, rarityId, data, ctx.rng);
	trace.rarity = rarityId;
	trace.itemId = def.id;
	trace.quality = item.quality;
	trace.affixes = item.affixes.map((a) => a.id);
	return { kind: 'gear', item };
};

/** One item from a pool as the item defines itself: a named piece with its fixed rarity, or a consumable with its quantity. */
const rollFixed = (ctx: Ctx, table: BonusTable, itemLevel: number): LootDrop | null => {
	const { data } = ctx;
	const pool = data.pools[table.poolId];
	const trace = baseTrace(ctx, table.id, table.poolId, itemLevel);
	ctx.trace.push(trace);
	let candidates = eligibleCandidates(data, table.poolId, itemLevel);
	trace.eligible.all = candidates.length;
	if (table.preferMissing) {
		const missing = candidates.filter((c) => !ctx.taken.has(c.def.id));
		if (missing.length) candidates = missing;
	}
	const pick = weightedPick(candidates, (c) => c.weight, ctx.rng);
	if (!pick) {
		trace.note = 'pool empty at this item level';
		ctx.warnings.push(`${ctx.req.sourceId}/${table.id}: pool ${table.poolId} has nothing at item level ${itemLevel}`);
		return null;
	}
	return drawFixed(ctx, trace, pick.def, itemLevel, pool?.quantities?.[pick.def.id] ?? 1);
};

const drawFixed = (ctx: Ctx, trace: RollTrace, def: ItemDef, itemLevel: number, qty: number): LootDrop => {
	trace.itemId = def.id;
	if (def.kind === 'consumable' || !def.slot) return { kind: 'consumable', id: def.id, qty };
	ctx.taken.add(def.id);
	const rarityId = def.fixedRarity ?? Object.keys(ctx.data.rarities)[0];
	const item = makeInstance(def, itemLevel, rarityId, ctx.data, ctx.rng);
	trace.rarity = rarityId;
	trace.quality = item.quality;
	trace.affixes = item.affixes.map((a) => a.id);
	return { kind: 'gear', item };
};

const capped = (ctx: Ctx, def: ItemLevelDef): ItemLevelDef => ({ ...def, max: Math.min(def.max ?? MAX_ITEM_LEVEL, ctx.req.maxItemLevel ?? MAX_ITEM_LEVEL) });

/** Runs one bonus table; returns what it dropped and whether it triggered. */
const runTable = (ctx: Ctx, table: BonusTable): { drops: LootDrop[]; triggered: boolean } => {
	const key = `${ctx.profile.id}:${table.id}`;
	const misses = ctx.req.pity?.[key] ?? 0;
	const pityBonus = table.pity ? Math.min(table.pity.maxBonus, table.pity.perMiss * misses) : 0;
	const chance = clamp01((table.chance ?? 1) + (table.chancePerLevel ?? 0) * (ctx.level - 1) + pityBonus);
	const triggered = chance >= 1 || ctx.rng() < chance;
	if (!triggered) return { drops: [], triggered: false };

	const levelDef = capped(ctx, { ...ctx.profile.itemLevel, ...table.itemLevel });
	const drops: LootDrop[] = [];
	if (table.takeAll) {
		const itemLevel = rollItemLevel(ctx.sourceLevel, levelDef, ctx.rng);
		const pool = ctx.data.pools[table.poolId];
		for (const c of eligibleCandidates(ctx.data, table.poolId, itemLevel)) {
			const trace = baseTrace(ctx, table.id, table.poolId, itemLevel);
			ctx.trace.push(trace);
			drops.push(drawFixed(ctx, trace, c.def, itemLevel, pool?.quantities?.[c.def.id] ?? 1));
		}
		return { drops, triggered: true };
	}
	const hits = countSuccesses(table.rolls ?? { min: 1, max: 1, chancePerRoll: 1 }, ctx.level, ctx.rng);
	for (let i = 0; i < hits; i++) {
		const itemLevel = rollItemLevel(ctx.sourceLevel, levelDef, ctx.rng);
		const drop = table.mode === 'rolled' ? rollRarityGear(ctx, table.id, table.poolId, itemLevel) : rollFixed(ctx, table, itemLevel);
		if (drop) drops.push(drop);
	}
	return { drops, triggered: true };
};

/** Everything one source gives. `data` and `rng` are injectable so tests and the simulator are reproducible. */
export const generateLoot = (req: LootRequest, rng: Rng, data: LootData = LOOT_DATA): LootResult => {
	const warnings: string[] = [];
	const source = data.sources[req.sourceId];
	const profile = source ? data.profiles[source.lootProfileId] : undefined;
	if (!source || !profile || !profile.enabled) {
		warnings.push(source ? `${req.sourceId}: loot profile ${source.lootProfileId} is missing or disabled` : `unknown loot source ${req.sourceId}`);
		return { drops: [], sourceLevel: 1, pity: { ...req.pity }, trace: [], warnings };
	}

	const level = Math.max(1, Math.floor(req.level ?? 1));
	if (req.level === undefined && !source.level) warnings.push(`${req.sourceId}: the source has no level of its own and the caller gave none`);
	const sourceLevel = req.level !== undefined ? clampItemLevel(req.level) : source.level ? resolveSourceLevel(source.level, req.castleLevel ?? 1) : 1;
	const ctx: Ctx = { data, req, profile, sourceLevel, level, rng, taken: new Set(req.owned ?? []), trace: [], warnings };
	const pity: Record<string, number> = { ...req.pity };

	let drops: LootDrop[] = [];
	if (profile.generalPoolId) {
		const hits = countSuccesses(profile.rolls, level, rng, dropChanceMultiplier(req.luck ?? 0)) + Math.max(0, Math.floor(req.extraGearRolls ?? 0));
		for (let i = 0; i < hits; i++) {
			const itemLevel = rollItemLevel(sourceLevel, capped(ctx, profile.itemLevel), rng);
			const drop = rollRarityGear(ctx, 'general', profile.generalPoolId, itemLevel);
			if (drop) drops.push(drop);
		}
	}

	for (const table of profile.bonusTables) {
		const placement = table.placement ?? 'extra';
		if (placement === 'fallback' && drops.some((d) => d.kind === 'gear')) continue;
		const { drops: extra, triggered } = runTable(ctx, table);
		if (table.pity) {
			const key = `${profile.id}:${table.id}`;
			pity[key] = triggered ? 0 : (pity[key] ?? 0) + 1;
		}
		if (placement === 'replace' && triggered && extra.length) drops = drops.filter((d) => d.kind !== 'gear');
		drops.push(...extra);
	}
	return { drops, sourceLevel, pity, trace: ctx.trace, warnings };
};

