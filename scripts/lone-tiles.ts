/**
 * Report: how many owned tiles are 1x1 biome specks (no same-biome 4-neighbour) after growing many seeded maps, and how
 * many start rings hold water. `npx tsx scripts/lone-tiles.ts [seeds] [purchases]`
 */
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { growWorld, loneTileStats, saddleCount, type BuyPolicy } from '../src/utils/growWorld';
import { RING } from '../src/utils/biomeRules';
import { getTile } from '../src/utils/world';

const seeds = Number(process.argv[2] ?? 200);
const purchases = Number(process.argv[3] ?? 200);

for (const policy of ['nearest', 'random'] as BuyPolicy[]) {
	for (const n of [20, purchases]) {
		let lone = 0;
		let stuck = 0;
		let total = 0;
		let worst = 0;
		let ringWater = 0;
		let saddles = 0;
		for (let s = 0; s < seeds; s++) {
			const w = growWorld(n, s, policy);
			const st = loneTileStats(w);
			lone += st.lone;
			stuck += st.stuck;
			saddles += saddleCount(w);
			total += st.total;
			worst = Math.max(worst, st.lone);
			if (RING.some(([dx, dy]) => getTile(w, CASTLE_X + dx, CASTLE_Y + dy)?.biome === 'lake')) ringWater++;
		}
		console.log(
			`${policy.padEnd(8)} ${String(n).padStart(4)} purchases: ${((100 * lone) / total).toFixed(2)}% lone tiles ` +
				`(${(lone / seeds).toFixed(1)} per map, worst ${worst}), stuck ${(stuck / seeds).toFixed(2)} per map; corner-only pinches ${(saddles / seeds).toFixed(1)} per map; start rings with a lake: ${ringWater}/${seeds}`
		);
	}
}
