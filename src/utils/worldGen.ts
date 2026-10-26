import type { BiomeType, Tile } from '@/types/game';
import { CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { EMPTY_WORLD, isOwnedAt, ownedEntries, setTiles, tileKey, type Placed, type World } from './world';

/**
 * A synthetic world for tests, benchmarks and the admin "+N tiles" button: `count` explored tiles around the castle (which
 * stays at (CASTLE_X, CASTLE_Y)), grown one connected tile at a time with a slight pull to one side, so the blob is
 * irregular and reaches negative coordinates once it is big enough. Biomes form patches (a new tile usually continues the
 * biome of the tile it grew from). The same (count, seed) always gives the same world.
 */
export const syntheticWorld = (count: number, seed = 1, base: World = EMPTY_WORLD): World => {
	let state = seed >>> 0 || 1;
	const rnd = () => {
		// xorshift32: small, fast and deterministic
		state ^= state << 13;
		state >>>= 0;
		state ^= state >>> 17;
		state ^= state << 5;
		state >>>= 0;
		return state / 4294967296;
	};
	const land: BiomeType[] = ['plains', 'plains', 'forest', 'forest', 'hills', 'lake', 'swamp', 'tundra', 'coast'];
	const placed: Placed[] = [];
	// tiles a new one can grow from: what the base already holds plus everything added here
	const pool: Placed[] = [...ownedEntries(base)];
	const seen = new Set<number>();
	const add = (x: number, y: number, tile: Tile) => {
		placed.push({ x, y, tile });
		pool.push({ x, y, tile });
		seen.add(tileKey(x, y));
	};
	if (!isOwnedAt(base, CASTLE_X, CASTLE_Y)) add(CASTLE_X, CASTLE_Y, { biome: 'castle', isOwned: true, level: 1 });
	const dirs = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	];
	const drift = [2, 1, 1, 1]; // a pull to the left
	const drawDir = () => {
		let r = rnd() * 5;
		for (let i = 0; i < 4; i++) {
			r -= drift[i];
			if (r < 0) return dirs[i];
		}
		return dirs[3];
	};
	let guard = 0;
	while (placed.length < count && guard++ < count * 200) {
		const from = pool[Math.floor(rnd() * pool.length)];
		const [dx, dy] = drawDir();
		const x = from.x + dx;
		const y = from.y + dy;
		if (seen.has(tileKey(x, y)) || isOwnedAt(base, x, y)) continue;
		const biome: BiomeType =
			from.tile.biome !== 'castle' && rnd() < 0.75 ? from.tile.biome : land[Math.floor(rnd() * land.length)];
		add(x, y, { biome, isOwned: true });
	}
	return setTiles(
		base,
		placed.slice(0, count).map(({ x, y, tile }) => ({ x, y, tile }))
	);
};
