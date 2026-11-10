import { RESOURCES, type ResourceDef, type ResourceKey } from '@/catalog/resources';

/** The tiers whose resources the header shows only once the player has met them: the extracts (T3) and the tiers planned beyond. */
const HIDDEN_UNTIL_MET = new Set(['t2', 't3', 't4']);

/**
 * Whether the header lists this resource: always for the currencies, base materials and farm products; a T2-T4 material only once the player holds some or makes some (`amount` or `rate` above 0),
 * so a new player's header does not list seven things they have never seen. Once met it stays (a stock can be spent to 0 while the rate stays above 0; a spent stock of a stopped source is the edge case, shown until reload).
 */
export const resourceDiscovered = (key: ResourceKey, amount: number, rate: number | undefined): boolean => {
	const tier = (RESOURCES[key] as ResourceDef).tier;
	if (!tier || !HIDDEN_UNTIL_MET.has(tier)) return true;
	return amount > 0 || (rate ?? 0) > 0;
};
