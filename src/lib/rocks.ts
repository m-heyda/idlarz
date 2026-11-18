import { ROCK, ROCK_DROPS, ROCK_TIERS, ROCK_TIER_ORDER, type RockTier } from '@/config/rocks';
import { isInWard } from '@/lib/castleWard';
import { rarityLuckMultiplier } from '@/lib/luck';
import type { Rng } from '@/lib/rng';
import { ownedRowMajor, type World } from '@/utils/world';

// Mineable rocks: where they stand, how rare they are, how fast they may be hit and what they drop. Pure, with an injectable random source; the server runs it (`src/lib/offline/*`) and tests/rocks has the unit tests.

/**
 * The tiles a rock could stand on: owned land that is not the castle, water (a lake), the castle's ward, nor taken (`taken` holds the "x,y" keys of the monsters, boss, chests and rocks already standing) and has no building.
 *
 * @category Economy/Rocks and Mining
 * @order 4
 */
export const rockSpots = (world: World, taken: ReadonlySet<string>, castleLevel: number): { x: number; y: number }[] => {
	const spots: { x: number; y: number }[] = [];
	for (const { x, y, tile } of ownedRowMajor(world)) {
		if (tile.biome === 'castle' || tile.biome === 'lake' || tile.hasChest || tile.building || taken.has(`${x},${y}`) || isInWard(x, y, castleLevel)) continue;
		spots.push({ x, y });
	}
	return spots;
};

/** Where the next rock goes: one of the free tiles, picked evenly; null when the land has no room. A tile near the castle is as likely as a far one, so the whole map fills. */
export const pickRockSpot = (world: World, taken: ReadonlySet<string>, castleLevel: number, rng: Rng): { x: number; y: number } | null => {
	const spots = rockSpots(world, taken, castleLevel);
	if (spots.length === 0) return null;
	return spots[Math.floor(rng() * spots.length) % spots.length];
};

/**
 * Seconds of play time between two new rocks.
 *
 * @category Economy/Rocks and Mining
 * @order 5
 * @formula
 * interval = 150 s x max(0.6, 1 / (1 + 0.004 x Luck))
 */
export const rockIntervalSec = (luck: number): number => ROCK.intervalSec * Math.max(0.6, 1 / (1 + Math.max(0, luck) * 0.004));

/**
 * The most rocks that wait at once on a map with `free` tiles a monster could stand on.
 *
 * @category Economy/Rocks and Mining
 * @order 6
 * @formula
 * room = min(15, max(2, floor(free land x 12%)))
 */
export const rockCap = (free: number): number => Math.min(ROCK.maxOnMap, Math.max(ROCK.minAllowed, Math.floor(free * ROCK.landShare)));

/**
 * The tier of a new rock: weighted, with the rare and better tiers made likelier by Luck like the rarity of gear.
 *
 * @category Economy/Rocks and Mining
 * @order 7
 * @formula
 * weight(tier) = base weight x (min(1.6, 1 + 0.004 x Luck) for every tier but common)
 */
export const rollRockTier = (luck: number, rng: Rng): RockTier => {
	const boost = rarityLuckMultiplier(luck);
	const weights = ROCK_TIER_ORDER.map((tier) => ROCK_TIERS[tier].weight * (tier === 'common' ? 1 : boost));
	let pick = rng() * weights.reduce((sum, w) => sum + w, 0);
	for (let i = 0; i < ROCK_TIER_ORDER.length; i++) {
		pick -= weights[i];
		if (pick < 0) return ROCK_TIER_ORDER[i];
	}
	return ROCK_TIER_ORDER[ROCK_TIER_ORDER.length - 1];
};

/** What a rock's click bucket holds: clicks still allowed now, and the clock it was last topped up at (epoch seconds). */
export interface ClickBucket {
	tokens?: number;
	hitAt?: number;
}

/**
 * How many of `clicks` the server lets in for a rock at `nowSec`: a bucket of `burst` clicks that refills at `maxCps` per second (a new rock starts full). The rest are dropped, so a rock cannot be broken faster than a person clicks.
 *
 * @category Economy/Rocks and Mining
 * @order 8
 * @formula
 * allowed = min(48, tokens + seconds since the last batch x 24);  accepted = min(clicks, floor(allowed))
 */
export const takeClicks = (bucket: ClickBucket, clicks: number, nowSec: number): { accepted: number; tokens: number } => {
	const asked = Math.max(0, Math.min(ROCK.maxBatch, Math.floor(Number.isFinite(clicks) ? clicks : 0)));
	const since = bucket.hitAt === undefined ? 0 : Math.max(0, nowSec - bucket.hitAt);
	const allowed = Math.min(ROCK.burst, (bucket.tokens ?? ROCK.burst) + since * ROCK.maxCps);
	const accepted = Math.min(asked, Math.floor(allowed));
	return { accepted, tokens: allowed - accepted };
};

/** What a broken rock pays: resources for the totals, ingredients for the crafting bag (crafting bag key -> amount). */
export interface RockLoot {
	resources: { stone: number; coal: number };
	stash: Record<string, number>;
}

/**
 * Rolls what a broken rock drops, line by line of its tier's table ({@link ROCK_DROPS}); every line draws the same number of random values whether it hits or not, so adding a line later never shifts the rest.
 * Stone and coal are minutes of the player's income (never under the floor of the line); an ingredient has a chance per rock, raised by Luck.
 *
 * @category Economy/Rocks and Mining
 * @order 9
 * @formula
 * stone or coal = max(floor, floor(income per second x U(minutes) x 60 x (1 + 0.005 x Luck)))
 * ingredient    = chance x (1 + 0.005 x Luck) per rock;  quantity = U(min..max)
 */
export const rollRockLoot = (tier: RockTier, ctx: { rates: { stone: number; coal: number }; luck: number }, rng: Rng): RockLoot => {
	const luck = 1 + Math.max(0, ctx.luck) * 0.005;
	const loot: RockLoot = { resources: { stone: 0, coal: 0 }, stash: {} };
	for (const drop of ROCK_DROPS[tier]) {
		if (drop.kind === 'resource') {
			const minutes = drop.minutes[0] + rng() * (drop.minutes[1] - drop.minutes[0]);
			loot.resources[drop.id] += Math.max(drop.floor, Math.floor(ctx.rates[drop.id] * minutes * 60 * luck));
		} else {
			const hit = rng() < drop.chance * luck;
			const qty = drop.qty[0] + Math.floor(rng() * (drop.qty[1] - drop.qty[0] + 1));
			if (hit) loot.stash[drop.id] = (loot.stash[drop.id] ?? 0) + qty;
		}
	}
	return loot;
};
