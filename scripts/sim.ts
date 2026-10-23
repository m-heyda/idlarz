/**
 * Headless balance simulation. Drives the REAL game store (same actions the UI calls) with a bot,
 * a mocked clock and a seeded RNG, for several player profiles, and prints / writes a milestone table.
 *
 *   npx tsx scripts/sim.ts                  all profiles
 *   npx tsx scripts/sim.ts hardcore casual  selected profiles
 *   npx tsx scripts/sim.ts --legacy hardcore   approximate the pre-rebalance game (sanity check of the sim)
 *
 * Output: docs/generated/sim-milestones.md (not written for --legacy).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// zustand's persist middleware needs *a* storage; the sim replaces it with a no-op one below
(globalThis as unknown as { localStorage: unknown }).localStorage = {
	getItem: () => null,
	setItem: () => undefined,
	removeItem: () => undefined,
};

const main = async () => {
	const args = process.argv.slice(2);
	const legacy = args.includes('--legacy');
	const names = args.filter((a) => !a.startsWith('--'));
	// --set Path.to.value=1.5   (tuning experiments without touching the config files)
	const overrides = args.filter((a) => a.startsWith('--set=')).map((a) => a.slice(6));
	const maxDays = args.find((a) => a.startsWith('--maxdays='));
	if (maxDays) MAX_DAYS = Number(maxDays.slice(10));

	const cfg = await import('../src/config/gameConfig');
	const utils = await import('../src/utils/gameUtils');
	const { useGameStore } = await import('../src/stores/gameStore');

	useGameStore.persist.setOptions({
		storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
	});

	if (legacy) applyLegacy(cfg);
	overrides.forEach((o) => applyOverride(cfg, o));

	const PROFILES: Record<string, Profile> = {
		idle: { cps: 0, windows: [] },
		casual: { cps: 1, windows: [[19, 22]] },
		hardcore: {
			cps: 4,
			windows: [
				[7, 9],
				[12, 13],
				[18, 23],
			],
		},
		autoclicker: { cps: 20, windows: [[0, 24]] },
	};
	const selected = names.length ? names : Object.keys(PROFILES);

	const results: Record<string, Milestones> = {};
	for (const name of selected) {
		const profile = PROFILES[name];
		if (!profile) throw new Error(`unknown profile ${name}`);
		const started = Date.now();
		results[name] = runProfile(name, profile, { cfg, utils, store: useGameStore }, legacy);
		console.error(`${name}: done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
	}

	const md = renderMarkdown(results, legacy);
	console.log(md);
	if (!legacy) {
		const target = resolve(
			dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
			'../docs/generated/sim-milestones.md'
		);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, md);
		console.error(`Wrote ${target}`);
	}
};

// ---------------------------------------------------------------------------------------------

interface Profile {
	cps: number; // intended clicks per second while active
	windows: [number, number][]; // hours of the day the player is actively playing
}

type Milestones = Record<string, number | null>; // key -> game day (fractional), null if never

interface Ctx {
	cfg: typeof import('../src/config/gameConfig');
	utils: typeof import('../src/utils/gameUtils');
	store: typeof import('../src/stores/gameStore').useGameStore;
}

let MAX_DAYS = 300;
const FINE_STEP_DAYS = 45; // 20 s steps for the first weeks, coarser afterwards (keeps long runs fast)
const FIRST_FINISH_CASTLE = 6; // the first finish line (castle 6 + best click + 40 tiles) is unchanged by castle levels 7-10

const mulberry32 = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function runProfile(name: string, profile: Profile, ctx: Ctx, legacy: boolean): Milestones {
	const { cfg, utils, store } = ctx;
	const realRandom = Math.random;
	Math.random = mulberry32(12345);

	const api = () => store.getState();
	api().resetGame();

	const milestones: Milestones = {};
	const mark = (key: string, t: number) => {
		if (milestones[key] == null) milestones[key] = t / 86400;
	};
	const TILE_MARKS = [10, 16, 20, 25, 30, 35, 40, 50];

	let t = 0; // game seconds
	let eventId = 0;
	let frontier: [number, number] | null = null;
	let frontierDirty = true;
	let buildingCursor = 0;
	let picks = 0;
	const BUILD_ORDER = ['market', 'farm', 'lumbermill', 'mine', 'blacksmith', 'workshop'];

	const isActive = (sec: number) => {
		const hour = (sec % 86400) / 3600;
		return profile.windows.some(([a, b]) => hour >= a && hour < b);
	};

	const findFrontier = (): [number, number] | null => {
		const { tiles } = api();
		let best: [number, number] | null = null;
		let bestD = Infinity;
		for (let y = 0; y < cfg.GRID_HEIGHT; y++) {
			for (let x = 0; x < cfg.GRID_SIZE; x++) {
				if (tiles[y][x].isOwned) continue;
				const adj = [
					[x - 1, y],
					[x + 1, y],
					[x, y - 1],
					[x, y + 1],
				].some(([ax, ay]) => tiles[ay]?.[ax]?.isOwned);
				if (!adj) continue;
				const d = Math.abs(x - cfg.GRID_CENTER_X) + Math.abs(y - cfg.GRID_CENTER_Y);
				if (d < bestD) {
					bestD = d;
					best = [x, y];
				}
			}
		}
		return best;
	};

	/** Buy missing resources from the merchant when the gold left over after paying `bundle` covers them. */
	const topUp = (bundle: Partial<Record<string, number>>) => {
		const s = api();
		let goldNeeded = bundle.gold ?? 0;
		const buys: [keyof typeof s.resources, number][] = [];
		for (const [r, v] of Object.entries(bundle)) {
			if (r === 'gold' || r === 'xp') continue;
			const have = s.resources[r as keyof typeof s.resources];
			const deficit = Math.ceil((v ?? 0) - have);
			if (deficit > 0) {
				const price = (cfg.MERCHANT_RESOURCE_PRICES as Record<string, number>)[r];
				if (!price) return false;
				goldNeeded += Math.ceil(deficit * price * cfg.MERCHANT_BUY_MULTIPLIER);
				buys.push([r as keyof typeof s.resources, deficit]);
			}
		}
		if (goldNeeded > s.resources.gold) return false;
		buys.forEach(([r, n]) => api().buyResource(r, n));
		return true;
	};

	const decide = (active: boolean) => {
		let s = api();

		// Chests (only while the player is playing)
		if (active && s.activeChests > 0) {
			for (let y = 0; y < cfg.GRID_HEIGHT; y++)
				for (let x = 0; x < cfg.GRID_SIZE; x++)
					if (s.tiles[y][x].hasChest) api().collectChest(x, y);
			s = api();
		}

		// Stat points -> Charisma / Intelligence
		while (s.characterStats.availablePoints > 0) {
			api().addStatPoint(
				s.characterStats.charisma <= s.characterStats.intelligence ? 'charisma' : 'intelligence'
			);
			s = api();
		}

		// Castle
		const castle = s.tiles[cfg.GRID_CENTER_Y][cfg.GRID_CENTER_X];
		if (!s.castleUpgrade && (castle.level ?? 1) < cfg.CASTLE_UPGRADE.maxLevel && castle.upgradeCost) {
			topUp(castle.upgradeCost as Partial<Record<string, number>>);
			if (api().upgradeCastle()) s = api();
		}
		mark(`castle${castle.level ?? 1}`, t);

		// Click power
		const nextClick = cfg.CLICK_LADDER[s.clickLevel + 1];
		if (nextClick && s.resources.gold >= nextClick.price * 1.3) {
			if (api().buyClickUpgrade()) {
				mark(`click${api().clickLevel}`, t);
				s = api();
			}
		}

		// Animals: first copy of each as soon as possible, extra copies when food is plentiful
		const castleNeed = (castle.upgradeCost ?? {}) as Partial<Record<string, number>>;
		for (const animal of cfg.ANIMALS) {
			const lvl = s.farmLevels[animal.id] || 0;
			const cost = utils.calculateAnimalCost(animal, lvl);
			const reserve = castleNeed.food ?? 0;
			if (lvl === 0 ? s.resources.food >= cost : s.resources.food >= cost * 3 + reserve) {
				if (api().purchaseAnimal(animal.id)) {
					mark(`${animal.id}${lvl + 1}`, t);
					s = api();
				}
			}
		}

		// Buildings on idle Grounds tiles
		for (let y = 0; y < cfg.GRID_HEIGHT; y++) {
			for (let x = 0; x < cfg.GRID_SIZE; x++) {
				const tile = s.tiles[y][x];
				if (tile.isOwned && tile.biome === 'grounds' && !tile.building) {
					const bc = utils.calculateBuildingCost(s.tiles);
					if (utils.canAffordBundle(s.resources, bc) && s.resources.gold > (bc.gold ?? 0) * 3) {
						if (api().upgradeGroundsTile(x, y, BUILD_ORDER[buildingCursor % BUILD_ORDER.length])) {
							buildingCursor++;
							s = api();
						}
					}
				}
			}
		}

		// Tile purchases: as many as affordable
		for (let guard = 0; guard < 20; guard++) {
			if (frontierDirty || !frontier) {
				frontier = findFrontier();
				frontierDirty = false;
			}
			if (!frontier) break;
			const owned = utils.countOwnedTiles(s.tiles);
			const cost = utils.calculateTileCost(owned, s.characterStats.tileCostDiscount);
			const bundle = utils.tileCostAsResources(cost);
			if (!utils.canAffordBundle(s.resources, bundle)) {
				if (!topUp(bundle)) break;
				s = api();
			}
			// A sensible player does not let tiles eat the resources the next castle level needs
			const castleTile = s.tiles[cfg.GRID_CENTER_Y][cfg.GRID_CENTER_X];
			if (!s.castleUpgrade && (castleTile.level ?? 1) < cfg.CASTLE_UPGRADE.maxLevel && castleTile.upgradeCost) {
				const after = utils.subtractBundle(s.resources, bundle);
				const blocked = Object.entries(castleTile.upgradeCost).some(
					([r, v]) => r !== 'gold' && s.resources[r as keyof typeof s.resources] >= (v ?? 0) && after[r as keyof typeof after] < (v ?? 0)
				);
				if (blocked) break;
			}
			const ok = api().buyTile(frontier[0], frontier[1]);
			if (!ok) break;
			if (api().biomeSelectionActive) {
				// pick-your-biome: first picks are Grounds (buildings), then Plains (food/meat)
				picks++;
				api().selectBiome(picks <= 3 ? 'grounds' : picks % 2 ? 'plains' : 'lake');
			}
			frontierDirty = true;
			s = api();
			const ownedNow = utils.countOwnedTiles(s.tiles);
			TILE_MARKS.forEach((n) => ownedNow >= n && mark(`tiles${n}`, t));
		}

		// Sell what the bot does not need (keeps a reserve for the castle and the next few tiles)
		sellExcess(s);
	};

	const sellExcess = (s: ReturnType<typeof api>) => {
		const castle = s.tiles[cfg.GRID_CENTER_Y][cfg.GRID_CENTER_X];
		const need: Record<string, number> = { ...((castle.upgradeCost ?? {}) as Record<string, number>) };
		const owned = utils.countOwnedTiles(s.tiles);
		for (let k = 0; k < 3; k++) {
			const c = utils.calculateTileCost(owned + k, s.characterStats.tileCostDiscount);
			Object.entries(c.resources).forEach(([r, v]) => {
				need[r] = Math.max(need[r] ?? 0, (v ?? 0) * 1.1);
			});
		}
		(['wood', 'stone', 'coal', 'meat'] as const).forEach((r) => {
			const keep = (need[r] ?? 0) * 1.1;
			const excess = s.resources[r] - keep;
			if (excess > 50) api().sellResources(r, Math.floor(excess));
		});
		// Food: keep what animals/castle/tiles might need (2 days of income) and sell the rest
		const foodKeep = Math.max(need.food ?? 0, 0) * 1.1 + 20000;
		const foodExcess = api().resources.food - foodKeep;
		if (foodExcess > 5000 && !cfg.ANIMALS.some((a) => api().resources.food >= utils.calculateAnimalCost(a, api().farmLevels[a.id] || 0)))
			api().sellResources('food', Math.floor(foodExcess));
	};

	const finished = () => {
		const s = api();
		const castle = s.tiles[cfg.GRID_CENTER_Y][cfg.GRID_CENTER_X].level ?? 1;
		return (
			castle >= FIRST_FINISH_CASTLE &&
			s.clickLevel >= cfg.CLICK_LADDER.length - 1 &&
			utils.countOwnedTiles(s.tiles) >= 40
		);
	};

	let lastDecision = -1e9;
	let lastTraceDay = -1;
	while (t < MAX_DAYS * 86400) {
		if (process.env.SIM_TRACE && Math.floor(t / 86400) !== lastTraceDay && Math.floor(t / 86400) % Number(process.env.SIM_TRACE) === 0) {
			lastTraceDay = Math.floor(t / 86400);
			const s = api();
			const r = s.resourceRates.total;
			console.error(
				`[${name}] day ${lastTraceDay} tiles ${utils.countOwnedTiles(s.tiles)} castle ${s.tiles[cfg.GRID_CENTER_Y][cfg.GRID_CENTER_X].level} up=${s.castleUpgrade ? Math.round(s.castleUpgrade.remainingSec / 3600) + 'h' : '-'} lvl ${s.level.level} click${s.clickLevel} gold ${Math.round(s.resources.gold)} (+${r.gold.toFixed(1)}/s) wood ${Math.round(s.resources.wood)} stone ${Math.round(s.resources.stone)} coal ${Math.round(s.resources.coal)} food ${Math.round(s.resources.food)} (+${r.food.toFixed(1)}) meat ${Math.round(s.resources.meat)} (+${r.meat.toFixed(1)}) farm ${JSON.stringify(s.farmLevels)}`
			);
		}
		const active = isActive(t);
		const step = active ? (t < FINE_STEP_DAYS * 86400 ? 20 : 60) : 120;

		// Clicks during the step (each one is a separate physical click for the limiter)
		if (active && profile.cps > 0) {
			// Attempts above what the limiter could ever pay are skipped (they would all be denied anyway)
			const n = Math.min(Math.floor(profile.cps * step), Math.ceil(cfg.CLICK_LIMIT.refillPerSec * 1.2 * step));
			const gap = (step * 1000) / Math.max(n, 1);
			for (let i = 0; i < n; i++) {
				api().clickForGold({ eventId: ++eventId, now: t * 1000 + i * gap, trusted: true });
			}
		}
		api().tick(step * 1000);
		t += step;

		if (t - lastDecision >= step) {
			lastDecision = t;
			decide(active);
			const lvl = api().level.level;
			[10, 20, 30].forEach((n) => lvl >= n && mark(`level${n}`, t));
			if (finished()) mark('finished', t);
			if ((api().tiles[cfg.GRID_CENTER_Y][cfg.GRID_CENTER_X].level ?? 1) >= cfg.CASTLE_UPGRADE.maxLevel) {
				mark(`castle${cfg.CASTLE_UPGRADE.maxLevel}`, t);
				break;
			}
		}
	}

	Math.random = realRandom;
	void name;
	void legacy;
	return milestones;
}

// ---------------------------------------------------------------------------------------------

const ORDER = [
	'tiles10',
	'tiles16',
	'tiles20',
	'castle2',
	'click1',
	'castle3',
	'tiles25',
	'chicken1',
	'cow1',
	'tiles30',
	'click2',
	'castle4',
	'tiles35',
	'click3',
	'castle5',
	'tiles40',
	'tiles50',
	'castle6',
	'castle7',
	'castle8',
	'castle9',
	'castle10',
	'level10',
	'level20',
	'level30',
	'finished',
];

function renderMarkdown(results: Record<string, Milestones>, legacy: boolean): string {
	const names = Object.keys(results);
	const fmt = (d: number | null | undefined) =>
		d == null ? '—' : d < 1 ? `${(d * 24).toFixed(1)} h` : `${d.toFixed(1)} d`;
	const lines: string[] = [];
	lines.push(`# Simulation milestones${legacy ? ' (LEGACY parameters — sanity check only)' : ''}`);
	lines.push('');
	lines.push(
		'> Generated by `npm run sim` (scripts/sim.ts): the real game store driven by a bot with a seeded RNG. ' +
			'Time to first reach each milestone, in game time. "finished" = castle 6 + max click power + 40 tiles; the run continues to the last castle level.'
	);
	lines.push('');
	lines.push(`| milestone | ${names.join(' | ')} |`);
	lines.push(`| --- | ${names.map(() => '---').join(' | ')} |`);
	ORDER.forEach((key) => {
		lines.push(`| ${key} | ${names.map((n) => fmt(results[n][key])).join(' | ')} |`);
	});
	lines.push('');
	lines.push(
		'Profiles: idle = never clicks; casual = 1 click/s for 3 h/day; hardcore = 4 clicks/s for 8 h/day; ' +
			'autoclicker = 20 clicks/s 24 h/day (the limiter should keep it at roughly hardcore pace).'
	);
	return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------

function applyOverride(cfg: object, spec: string) {
	const [path, raw] = spec.split('=');
	const value = Number(raw);
	if (path === 'castleCostScale') {
		const costs = (cfg as typeof import('../src/config/gameConfig')).CASTLE_UPGRADE.upgradeCosts as Record<string, number>[];
		costs.forEach((row) => Object.keys(row).forEach((k) => (row[k] = Math.round(row[k] * value))));
		return;
	}
	const keys = path.split('.');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let target: any = cfg;
	for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
	target[keys[keys.length - 1]] = value;
}

/** Approximate the game before the rebalance by overriding config at runtime (for validating the sim). */
function applyLegacy(cfg: typeof import('../src/config/gameConfig')) {
	const c = cfg as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	c.CLICK_LADDER.forEach((l: { power: number; price: number }, i: number) => {
		l.power = [2, 4, 8, 16][i];
		l.price = [0, 250000, 500000, 2000000][i];
	});
	c.CLICK_LIMIT.capacity = 1e9;
	c.CLICK_LIMIT.staminaCapacity = 1e15;
	c.CLICK_LIMIT.staminaRefillPerSec = 1e9;
	c.CLICK_LIMIT.refillPerSec = 1e9;
	c.MERCHANT_RESOURCE_PRICES.meat = 15;
	c.CASTLE_UPGRADE.durationsSec.fill(0);
	c.TILE_RESOURCE_COST.length = 0;
	c.BUILDING_COST.base = {};
	c.CHEST.minMinutes = 5;
	c.CHEST.maxMinutes = 50;
	c.SCALING_CONFIG.costFormula = (n: number) => {
		const tier = Math.floor(n / 24);
		const f = 1.42 * (1 + 0.01 * (tier > 20 ? tier : tier / 1.2));
		return Math.floor(55 * Math.pow(f, n));
	};
	c.BIOME_YIELD.scale = 1;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
