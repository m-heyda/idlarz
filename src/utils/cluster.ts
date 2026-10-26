import { getTile, keyX, keyY, tileKey, type World } from './world';

/**
 * The connected area of one biome around (x, y): the tile itself plus every owned tile of the same biome reachable through
 * 4-neighbour steps over tiles of that biome (a building does not change a tile's biome). Returned as tile keys.
 * The castle is not a biome area; an unexplored or castle position gives an empty set. Iterative, O(size of the area).
 */
export const connectedCluster = (world: World, x: number, y: number): Set<number> => {
	const start = getTile(world, x, y);
	const cluster = new Set<number>();
	if (!start || start.biome === 'castle') return cluster;
	const biome = start.biome;
	const stack = [tileKey(x, y)];
	cluster.add(stack[0]);
	while (stack.length) {
		const key = stack.pop() as number;
		const cx = keyX(key);
		const cy = keyY(key);
		for (const [dx, dy] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		]) {
			const nx = cx + dx;
			const ny = cy + dy;
			const t = getTile(world, nx, ny);
			if (!t || t.biome !== biome) continue;
			const nk = tileKey(nx, ny);
			if (cluster.has(nk)) continue;
			cluster.add(nk);
			stack.push(nk);
		}
	}
	return cluster;
};
