/**
 * How the game copes with a big map: builds synthetic worlds of 5,000 / 50,000 / 250,000 tiles and times the things that
 * happen while playing (a purchase, a tick, rates, saving, loading, picking a chest spot, a highlight, the minimap).
 *
 *     npm run perf
 *
 * Budgets (50,000 tiles): purchase < 40 ms, tick < 5 ms, save < 150 ms, minimap paint < 100 ms.
 */
import '../tests/helpers';
import { performance } from 'node:perf_hooks';
import { useGameStore } from '../src/stores/gameStore';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { decodeSave, encodeSave } from '../src/lib/saveFormat';
import { pickChestSpot } from '../src/lib/chests';
import { castleLevelOf } from '../src/lib/castleWard';
import { minimapLayout, minimapMarkers, paintChestGlow, paintMinimap } from '../src/lib/minimap';
import { calculateResourceRates, calculateXpGain } from '../src/utils/gameUtils';
import { connectedCluster } from '../src/utils/cluster';
import { chunkSignature, chunkSprites } from '../src/utils/terrain';
import { hasOwnedNeighbour, isOwnedAt, ownedBounds, ownedCount, ownedEntries, patchTile } from '../src/utils/world';
import { syntheticWorld } from '../src/utils/worldGen';
import { XP_CAP } from '../src/config/gameConfig';

const api = () => useGameStore.getState();

const time = <T>(fn: () => T): [T, number] => {
	const t0 = performance.now();
	const out = fn();
	return [out, performance.now() - t0];
};

const median = (fn: () => void, n = 7): number => {
	const samples: number[] = [];
	for (let i = 0; i < n; i++) samples.push(time(fn)[1]);
	return samples.sort((a, b) => a - b)[Math.floor(n / 2)];
};

const ms = (v: number) => `${v.toFixed(1).padStart(8)} ms`;

for (const count of [5_000, 50_000, 250_000]) {
	api().resetGame();
	const [world, build] = time(() => syntheticWorld(count, 1));
	let xp = 0;
	for (let k = 2; k <= count; k++) xp += calculateXpGain(k);
	useGameStore.setState((s) => ({ tiles: world, freeTiles: 1, resources: { ...s.resources, xp: Math.min(xp * 1.01, XP_CAP) } }));
	api().tick(1000);

	// the next tile to buy: any open neighbour of the explored land
	const b = ownedBounds(world)!;
	let spot: [number, number] | null = null;
	for (let y = b.minY - 1; y <= b.maxY + 1 && !spot; y++) for (let x = b.minX - 1; x <= b.maxX + 1; x++) if (!isOwnedAt(world, x, y) && hasOwnedNeighbour(world, x, y)) { spot = [x, y]; break; }

	const rich = () => useGameStore.setState((s) => ({ resources: { ...s.resources, gold: 1e20, wood: 1e20, stone: 1e20, coal: 1e20, food: 1e20 } }));
	rich();
	const [, buy] = time(() => api().buyTile(spot![0], spot![1]));
	const tick = median(() => api().tick(100));
	const rates = median(() => void calculateResourceRates(api().tiles, api().characterStats, api().farmLevels, api().prestige, api().farmUpgrades));
	const chest = median(() => void pickChestSpot(api().tiles, new Set(), castleLevelOf(api().tiles)), 3);
	const persisted = pickPersisted(api());
	const [text, encodeFirst] = time(() => encodeSave(persisted));
	const encodeAgain = median(() => void encodeSave({ ...persisted, playSeconds: persisted.playSeconds + 1 }));
	const [loaded, decode] = time(() => decodeSave(text));
	const layout = minimapLayout(ownedBounds(api().tiles), { w: 176, h: 132 });
	const paint = median(() => paintMinimap(new Uint8ClampedArray(layout.width * layout.height * 4), api().tiles, layout), 3);
	// the same overview with 500 chests and 8 monsters on it: clustered into dots, painted, plus the glow picture
	let chested = api().tiles;
	const entries = ownedEntries(chested);
	for (let i = 0; i < 500; i++) {
		const e = entries[(i * 7919) % entries.length];
		if (e.tile.biome !== 'castle') chested = patchTile(chested, e.x, e.y, { hasChest: true });
	}
	const monsterSpots = entries.slice(0, 8).map((e) => ({ x: e.x, y: e.y }));
	const dots = median(() => {
		const markers = minimapMarkers(chested, monsterSpots, layout);
		paintMinimap(new Uint8ClampedArray(layout.width * layout.height * 4), chested, layout, markers);
		paintChestGlow(new Uint8ClampedArray(layout.width * layout.height * 4), layout, markers.chests);
	}, 3);
	const cluster = median(() => void connectedCluster(api().tiles, 25, 26), 3);
	const cx = Math.floor(25 / 16);
	const chunk = median(() => void [chunkSignature(api().tiles, cx, cx), chunkSprites(api().tiles, cx, cx)]);

	console.log(`\n${count.toLocaleString('en')} tiles (owned now ${ownedCount(api().tiles).toLocaleString('en')})`);
	console.log(`  build the synthetic world ${ms(build)}`);
	console.log(`  buy one tile              ${ms(buy)}`);
	console.log(`  tick (100 ms of game)     ${ms(tick)}`);
	console.log(`  income rates              ${ms(rates)}`);
	console.log(`  pick a chest spot         ${ms(chest)}`);
	console.log(`  save: encode / re-encode  ${ms(encodeFirst)} /${ms(encodeAgain)}   (${(text.length / 1000).toFixed(0)}k characters)`);
	console.log(`  save: decode + validate   ${ms(decode)}   ${loaded.ok ? 'ok' : 'FAILED: ' + loaded.reason}`);
	console.log(`  minimap paint             ${ms(paint)}`);
	console.log(`  minimap + chest/monster dots ${ms(dots)}`);
	console.log(`  highlight area (cluster)  ${ms(cluster)}`);
	console.log(`  one terrain chunk (data)  ${ms(chunk)}`);
}
