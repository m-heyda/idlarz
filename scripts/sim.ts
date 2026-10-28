/**
 * Headless balance simulation. Drives the REAL game store (same actions the UI calls) with a bot,
 * a mocked clock and a seeded RNG, for several player profiles, and prints / writes a milestone table.
 *
 *   npx tsx scripts/sim.ts                  all profiles
 *   npx tsx scripts/sim.ts hardcore casual  selected profiles
 *   npx tsx scripts/sim.ts --legacy hardcore   approximate the pre-rebalance game (sanity check of the sim)
 *   npx tsx scripts/sim.ts --no-write hardcore-rebirth6 --maxdays=500   do not touch docs/generated (for tuning runs)
 *
 * Output: docs/generated/sim-milestones.md (not written for --legacy).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getTile, isOwnedAt, ownedBounds, ownedRowMajor, tileAt } from '../src/utils/world';

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
	const monsters = await import('../src/lib/monsters');
	const combatCfg = await import('../src/config/combatConfig');
	const kill = await import('../src/lib/loot/kill');
	const gearEco = await import('../src/lib/gearEconomy');
	const fightSim = await import('../src/lib/fightSim');
	const { useGameStore } = await import('../src/stores/gameStore');

	useGameStore.persist.setOptions({
		storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
	});

	if (legacy) applyLegacy(cfg);
	overrides.forEach((o) => applyOverride(cfg, o));

	const PROFILES: Record<string, Profile> = {
		idle: { cps: 0, windows: [] },
		casual: { cps: 1, windows: [[19, 22]] },
		hardcore: { cps: 4, windows: HARDCORE_WINDOWS },
		autoclicker: { cps: 20, windows: [[0, 24]] },
		// the dedicated player who rebirths as early as possible / after pushing the castle to the end
		'hardcore-rebirth6': { cps: 4, windows: HARDCORE_WINDOWS, rebirthAtCastle: 6, rebirths: 3 },
		'hardcore-rebirth10': { cps: 4, windows: HARDCORE_WINDOWS, rebirthAtCastle: 10, rebirths: 1 },
		// the long game: ten rebirths, to see the character level (carried over each rebirth) reach the soft cap and the maximum
		'hardcore-rebirth6-x10': { cps: 4, windows: HARDCORE_WINDOWS, rebirthAtCastle: 6, rebirths: 10 },
		// the owner's pace (docs/06): a person who checks in a few times a day, fights with auto-battle, never optimises
		human: { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, startHour: 18 },
		'human-rebirth6': { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, startHour: 18, rebirthAtCastle: 6, rebirths: 5 },
		'human-rebirth8': { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, startHour: 18, rebirthAtCastle: 8, rebirths: 4 },
	};
	const selected = names.length ? names : Object.keys(PROFILES);

	const seedsArg = args.find((a) => a.startsWith('--seeds='));
	const seeds = seedsArg ? Math.max(1, Number(seedsArg.slice(8))) : 1;

	const results: Record<string, Milestones> = {};
	const spreads: Record<string, Record<string, [number, number]>> = {};
	for (const name of selected) {
		const profile = PROFILES[name];
		if (!profile) throw new Error(`unknown profile ${name}`);
		const started = Date.now();
		const runs: Milestones[] = [];
		for (let seed = 0; seed < seeds; seed++) {
			runs.push(runProfile(name, profile, { cfg, utils, store: useGameStore, monsters, combatCfg, kill, gearEco, fightSim }, legacy, seed));
		}
		// median per milestone, plus the min-max over seeds
		results[name] = {};
		spreads[name] = {};
		const keys = new Set(runs.flatMap((r) => Object.keys(r)));
		keys.forEach((key) => {
			const values = runs.map((r) => r[key]).filter((v): v is number => v != null).sort((a, b) => a - b);
			if (values.length < Math.ceil(runs.length / 2)) {
				results[name][key] = null;
				return;
			}
			results[name][key] = values[Math.floor((values.length - 1) / 2)];
			spreads[name][key] = [values[0], values[values.length - 1]];
		});
		console.error(`${name}: done in ${((Date.now() - started) / 1000).toFixed(1)}s (${seeds} seed${seeds > 1 ? 's' : ''})`);
	}

	const md = renderMarkdown(results, legacy, seeds > 1 ? spreads : undefined);
	console.log(md);
	if (!legacy && !args.includes('--no-write')) {
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
	rebirthAtCastle?: number; // rebirth as soon as the castle reaches this level (and keep playing the next run)
	rebirths?: number; // how many rebirths to simulate (default 1 when rebirthAtCastle is set)
	/** A person, not a script: decides only this often while playing, buys at most `tilesPerVisit` tiles per visit, keeps `hoard` x what it might need */
	human?: { decisionSec: number; hoard: number; tilesPerVisit: number };
	/** Fight the rat and the Rat King the way the server's auto-battle does (see GEAR_SCHEDULE) */
	combat?: boolean;
	/** Hour of the day the game starts at (a new player starts playing at once; the bots start at midnight) */
	startHour?: number;
}

type Milestones = Record<string, number | null>; // key -> game day (fractional), null if never

/** Minutes the income needs to pay each part of the next tile, read at tile counts (the hide-versus-gold diagnostic). */
const tileWaits: Record<string, Record<string, Record<string, number>>> = {};

/**
 * What the player wears, by game day: the strongest rat they beat, the Rat King win chance (docs/generated/fight-sim.md: the
 * starter kit beats level 5 rats, knight gear level 9-10 rats but never the King, obsidian gear the King always).
 */
const GEAR_SCHEDULE: { day: number; maxRat: number; king: number; set?: string; weapon?: string }[] = [
	{ day: 0, maxRat: 5, king: 0 },
	{ day: 1.5, maxRat: 10, king: 0 },
	// the full Obsidian set is worn from here on, so its economy bonuses (income, XP, kill rewards) count in the sim too
	{ day: 5, maxRat: 10, king: 1, set: 'obsidian', weapon: 'obsidian_maul' },
];

interface Ctx {
	kill: typeof import('../src/lib/loot/kill');
	gearEco: typeof import('../src/lib/gearEconomy');
	fightSim: typeof import('../src/lib/fightSim');
	monsters: typeof import('../src/lib/monsters');
	combatCfg: typeof import('../src/config/combatConfig');
	cfg: typeof import('../src/config/gameConfig');
	utils: typeof import('../src/utils/gameUtils');
	store: typeof import('../src/stores/gameStore').useGameStore;
}

const HARDCORE_WINDOWS: [number, number][] = [
	[7, 9],
	[12, 13],
	[18, 23],
];
// SIM_DECISION / SIM_HOARD: calibration knobs (docs/06: a person who checks in hourly while playing, buys a few tiles per visit and never sells surplus (calibrated to the owner: ~185 tiles after 3.3 days))
const HUMAN = { decisionSec: Number(process.env.SIM_DECISION ?? 3600), hoard: Number(process.env.SIM_HOARD ?? 1e9), tilesPerVisit: Number(process.env.SIM_TILES ?? 8) };
const HUMAN_WINDOWS: [number, number][] = [
	[8, 9],
	[12, 13],
	[18, 23],
];
let MAX_DAYS = 300;
const FINE_STEP_DAYS = 45; // 20 s steps for the first weeks, coarser afterwards (keeps long runs fast)
const FIRST_FINISH_CASTLE = 6; // the first finish line (castle 6 + best click + the rebirth territory) is unchanged by castle levels 7-10

const mulberry32 = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function runProfile(name: string, profile: Profile, ctx: Ctx, legacy: boolean, seed = 0): Milestones {
	const { cfg, utils, store, monsters, combatCfg, kill, gearEco, fightSim } = ctx;
	const realRandom = Math.random;
	Math.random = mulberry32(12345 + seed * 7919);

	const api = () => store.getState();
	api().resetGame();

	const milestones: Milestones = {};
	let run = 1; // 1 = first run; after a rebirth keys get an `rN.` prefix and are relative to the rebirth
	let runStart = 0;
	const mark = (key: string, t: number) => {
		const k = run === 1 ? key : `r${run}.${key}`;
		if (milestones[k] == null) milestones[k] = (t - runStart) / 86400;
	};
	const TILE_MARKS = [10, 16, 20, 25, 30, 35, 40, 50, 75, 100, 150, 200, 300, 400];
	// The character level is lifetime progress (it carries over a rebirth), so its milestones are absolute game days, not per run
	const LEVEL_MARKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
	// Level and lifetime XP at fixed game times (hours): `lvl@4.5h`, `xp@4.5h` ...
	const SNAPSHOTS_H = [1, 4.5, 24, 72, 168, 336, 576];
	const snapshotsTaken = new Set<number>();

	let t = 0; // game seconds
	let eventId = 0;
	let ownedTiles: [number, number][] = [];
	const refreshOwned = () => {
		ownedTiles = [];
		for (const { x, y } of ownedRowMajor(api().tiles)) ownedTiles.push([x, y]);
	};
	let frontier: [number, number] | null = null;
	let frontierDirty = true;
	let buildingCursor = 0;
	const BUILD_ORDER = ['market', 'farm', 'lumbermill', 'mine', 'blacksmith', 'workshop'];

	const isActive = (sec: number) => {
		const hour = ((sec + (profile.startHour ?? 0) * 3600) % 86400) / 3600;
		return profile.windows.some(([a, b]) => hour >= a && hour < b);
	};

	const findFrontier = (): [number, number] | null => {
		const { tiles } = api();
		let best: [number, number] | null = null;
		let bestD = Infinity;
		const b = ownedBounds(tiles);
		if (!b) return null;
		for (let y = b.minY - 1; y <= b.maxY + 1; y++) {
			for (let x = b.minX - 1; x <= b.maxX + 1; x++) {
				if (isOwnedAt(tiles, x, y)) continue;
				const adj = [
					[x - 1, y],
					[x + 1, y],
					[x, y - 1],
					[x, y + 1],
				].some(([ax, ay]) => isOwnedAt(tiles, ax, ay));
				if (!adj) continue;
				const d = Math.abs(x - cfg.CASTLE_X) + Math.abs(y - cfg.CASTLE_Y);
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
			for (const { x, y, tile } of ownedRowMajor(s.tiles)) if (tile.hasChest) api().collectChest(x, y);
			s = api();
		}

		// Ember shop: spend Embers as they come, Master Builders first
		for (let guard = 0; guard < 50; guard++) {
			const order: ('builders' | 'thrift' | 'mastery' | 'provisions')[] = ['builders', 'thrift', 'mastery', 'provisions'];
			const target = order.find((id) => (s.prestige.upgrades[id] ?? 0) <= (s.prestige.upgrades.builders ?? 0));
			if (!target || !api().buyEmberUpgrade(target)) break;
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
		const castle = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
		const castleCeiling = profile.rebirthAtCastle ?? cfg.CASTLE_UPGRADE.maxLevel; // a player who rebirths at castle N does not start N+1
		if (!s.castleUpgrade && (castle.level ?? 1) < castleCeiling && castle.upgradeCost) {
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

		// Farm upgrades: once the resources are there with room to spare (never what the castle needs)
		for (const id of Object.keys(cfg.FARM_UPGRADES) as (keyof typeof cfg.FARM_UPGRADES)[]) {
			const level = utils.farmUpgradeLevel(s.farmUpgrades, id);
			if (level >= cfg.FARM_UPGRADES[id].maxLevel) continue;
			const cost = utils.farmUpgradeCost(id, level);
			const roomy = Object.entries(cost).every(
				([r, v]) => s.resources[r as keyof typeof s.resources] >= (v ?? 0) * 1.5 + (castleNeed[r] ?? 0)
			);
			if (roomy && api().buyFarmUpgrade(id)) s = api();
		}

		// Buildings: on the first explored tile that can take one, while the gold is comfortably there (the price rises with every one)
		{
			const bc = utils.calculateBuildingCost(s.tiles, s.prestige);
			if (utils.canAffordBundle(s.resources, bc) && s.resources.gold > (bc.gold ?? 0) * 3) {
				const spot = ownedTiles.find(([x, y]) => utils.canBuildOn(getTile(s.tiles, x, y)));
				if (spot && api().buildOnTile(spot[0], spot[1], BUILD_ORDER[buildingCursor % BUILD_ORDER.length])) {
					buildingCursor++;
					s = api();
				}
			}
		}

		// Tile purchases: as many as affordable
		for (let guard = 0; guard < (profile.human?.tilesPerVisit ?? 20); guard++) {
			if (frontierDirty || !frontier) {
				frontier = findFrontier();
				frontierDirty = false;
			}
			if (!frontier) break;
			const owned = utils.economyTiles(s.tiles, s.freeTiles);
			const cost = utils.calculateTileCost(owned, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades));
			const bundle = utils.tileCostAsResources(cost);
			if (!utils.canAffordBundle(s.resources, bundle)) {
				if (!topUp(bundle)) break;
				s = api();
			}
			// A sensible player does not let tiles eat the resources the next castle level needs
			const castleTile = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
			if (!s.castleUpgrade && (castleTile.level ?? 1) < cfg.CASTLE_UPGRADE.maxLevel && castleTile.upgradeCost) {
				const after = utils.subtractBundle(s.resources, bundle);
				const blocked = Object.entries(castleTile.upgradeCost).some(
					([r, v]) => r !== 'gold' && s.resources[r as keyof typeof s.resources] >= (v ?? 0) && after[r as keyof typeof after] < (v ?? 0)
				);
				if (blocked) break;
			}
			const ok = api().buyTile(frontier[0], frontier[1]);
			if (!ok) break;
			frontierDirty = true;
			s = api();
			const ownedNow = utils.economyTiles(s.tiles, s.freeTiles);
			TILE_MARKS.forEach((n) => ownedNow >= n && mark(`tiles${n}`, t));
			if (run === 1) recordTileWait(s, ownedNow);
		}

		// Sell what the bot does not need (keeps a reserve for the castle and the next few tiles)
		sellExcess(s);
	};

	const sellExcess = (s: ReturnType<typeof api>) => {
		const hoard = profile.human?.hoard ?? 1;
		const castle = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
		const need: Record<string, number> = { ...((castle.upgradeCost ?? {}) as Record<string, number>) };
		const owned = utils.economyTiles(s.tiles, s.freeTiles);
		for (let k = 0; k < 3; k++) {
			const c = utils.calculateTileCost(owned + k, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades));
			Object.entries(c.resources).forEach(([r, v]) => {
				need[r] = Math.max(need[r] ?? 0, (v ?? 0) * 1.1);
			});
		}
		(['wood', 'stone', 'coal', 'meat'] as const).forEach((r) => {
			const keep = (need[r] ?? 0) * 1.1 * hoard;
			const excess = s.resources[r] - keep;
			if (excess > 50) api().sellResources(r, Math.floor(excess));
		});
		// Farm products: keep what the next hen house / dairy / tannery level needs, sell the rest
		const productUpgrade = { eggs: 'coop', milk: 'dairy', hide: 'tannery' } as const;
		(['eggs', 'milk', 'hide'] as const).forEach((r) => {
			const id = productUpgrade[r];
			const next = utils.farmUpgradeCost(id, utils.farmUpgradeLevel(s.farmUpgrades, id))[r] ?? 0;
			const excess = api().resources[r] - Math.max(next * 1.6, (need[r] ?? 0) * 1.1) * hoard; // the next tiles may cost hide too
			if (excess > 5) api().sellResources(r, Math.floor(excess));
		});
		// Food: keep what animals/castle/tiles might need (2 days of income) and sell the rest
		const foodKeep = (Math.max(need.food ?? 0, 0) * 1.1 + 20000) * hoard;
		const foodExcess = api().resources.food - foodKeep;
		if (foodExcess > 5000 && !cfg.ANIMALS.some((a) => api().resources.food >= utils.calculateAnimalCost(a, api().farmLevels[a.id] || 0)))
			api().sellResources('food', Math.floor(foodExcess));
	};

	/** Minutes the income needs to cover what is still missing of each part of the next tile; recorded once per tile mark of the first run. */
	const WAIT_MARKS = [100, 150, 200, 300, 400];
	const recordTileWait = (s: ReturnType<typeof api>, owned: number) => {
		const mark = WAIT_MARKS.filter((n) => owned >= n).pop();
		const key = mark ? String(mark) : null;
		if (!key) return;
		const byName = (tileWaits[name] ??= {});
		if (byName[key]) return;
		const cost = utils.calculateTileCost(owned, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades));
		const need = utils.tileCostAsResources(cost) as Record<string, number>;
		const rate = s.resourceRates.total as unknown as Record<string, number>;
		// what is still missing after the purchase just made, over the income: the biggest number is what holds the next tile back
		const stock = s.resources as unknown as Record<string, number>;
		byName[key] = Object.fromEntries(Object.entries(need).map(([r, v]) => [r, rate[r] > 0 ? Math.round(Math.max(0, v - stock[r]) / rate[r] / 60) : Infinity]));
	};

	// Fights (profile.combat): the server spawns a rat every COMBAT.spawn.intervalSec and a Rat King every bossIntervalSec, and
	// auto-battle fights them while the player plays. A monster waits, growing a level per growth interval, until it is fought.
	const spawn = combatCfg.COMBAT.spawn;
	let nextRatAt = 0;
	let nextKingAt = spawn.bossIntervalSec;
	let kingRetryAt = 0;
	let waiting: { type: 'rat' | 'ratKing'; at: number; spawnLevel: number }[] = [];
	const resetCombat = () => {
		nextRatAt = t + spawn.firstSec;
		nextKingAt = t + spawn.bossIntervalSec;
		kingRetryAt = 0;
		waiting = [];
	};
	const castleLevelNow = () => tileAt(api().tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level ?? 1;
	const spawnMonsters = () => {
		const owned = utils.economyTiles(api().tiles, api().freeTiles);
		if (owned < 5) return;
		// the spawn timers pause while monsters and chests fill SPAWN_LIMIT.maxFraction of the free tiles
		const cap = Math.max(cfg.SPAWN_LIMIT.minAllowed, Math.floor(cfg.SPAWN_LIMIT.maxFraction * owned)) - 1;
		while (t >= nextRatAt && waiting.filter((m) => m.type === 'rat').length < Math.max(1, cap - 1)) {
			const { min, max } = monsters.spawnLevelRange('rat', castleLevelNow());
			waiting.push({ type: 'rat', at: nextRatAt, spawnLevel: Math.round((min + max) / 2) });
			nextRatAt += spawn.intervalSec;
		}
		if (t >= nextRatAt) nextRatAt = t + spawn.intervalSec;
		if (t >= nextKingAt && !waiting.some((m) => m.type === 'ratKing')) {
			const { min, max } = monsters.spawnLevelRange('ratKing', castleLevelNow());
			waiting.push({ type: 'ratKing', at: t, spawnLevel: Math.round((min + max) / 2) });
		}
	};
	/** Fights what is waiting with the gear the schedule says the player has; pays the kill like lib/loot/kill.ts does. */
	let wearing = '';
	const fightWaiting = () => {
		const day = t / 86400;
		const gear = [...GEAR_SCHEDULE].reverse().find((g) => day >= g.day) ?? GEAR_SCHEDULE[0];
		if (gear.set && wearing !== gear.set) {
			wearing = gear.set;
			const equipment = fightSim.fullSet(gear.set, gear.weapon);
			store.setState((st) => ({
				equipment,
				resourceRates: utils.calculateResourceRates(st.tiles, st.characterStats, st.farmLevels, st.prestige, st.farmUpgrades, st.merchantUpgrades, gearEco.gearIncomePct(equipment)),
			}));
		}
		const rates = api().resourceRates.total;
		const xpRate = rates.xp * (1 + gearEco.xpGainPct(api().characterStats, api().equipment) / 100);
		waiting.sort((a, b) => a.spawnLevel - b.spawnLevel);
		const left: typeof waiting = [];
		for (const m of waiting) {
			const level = monsters.levelAtAge(m.spawnLevel, t - m.at);
			let won = false;
			if (m.type === 'rat') won = level <= gear.maxRat;
			else if (t >= kingRetryAt && gear.king > 0) {
				won = Math.random() < gear.king;
				if (!won) kingRetryAt = t + combatCfg.COMBAT.auto.bossRetryCooldownSec;
			}
			if (!won) {
				left.push(m);
				continue;
			}
			const r = killReward(m.type, level, { gold: rates.gold, xp: xpRate, hide: rates.hide });
			store.setState((st) => ({
				resources: {
					...st.resources,
					gold: st.resources.gold + r.gold,
					xp: st.resources.xp + r.xp,
					hide: st.resources.hide + r.hide,
				},
			}));
			if (m.type === 'ratKing') nextKingAt = t + spawn.bossIntervalSec;
			milestones[`kills${m.type}`] = (milestones[`kills${m.type}`] ?? 0) + 1;
		}
		waiting = left;
	};
	const killReward = (type: 'rat' | 'ratKing', level: number, rates: { gold: number; xp: number; hide: number }) =>
		kill.killIncome({ type, level }, { goldPerSec: rates.gold, xpPerSec: rates.xp, hidePerSec: rates.hide, luck: 0, killRewardPct: gearEco.gearEconomy(api().equipment).killRewardPct });
	if (profile.combat) resetCombat();

	const finished = () => {
		const s = api();
		const castle = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level ?? 1;
		return (
			castle >= FIRST_FINISH_CASTLE &&
			s.clickLevel >= cfg.CLICK_LADDER.length - 1 &&
			utils.economyTiles(s.tiles, s.freeTiles) >= cfg.REBIRTH.minTiles
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
				`[${name}] day ${lastTraceDay} tiles ${utils.economyTiles(s.tiles, s.freeTiles)} castle ${tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level} up=${s.castleUpgrade ? Math.round(s.castleUpgrade.remainingSec / 3600) + 'h' : '-'} lvl ${s.level.level} click${s.clickLevel} gold ${Math.round(s.resources.gold)} (+${r.gold.toFixed(1)}/s) wood ${Math.round(s.resources.wood)} stone ${Math.round(s.resources.stone)} coal ${Math.round(s.resources.coal)} food ${Math.round(s.resources.food)} (+${r.food.toFixed(1)}) hide ${Math.round(s.resources.hide)} (+${r.hide.toFixed(2)}) meat ${Math.round(s.resources.meat)} (+${r.meat.toFixed(1)}) farm ${JSON.stringify(s.farmLevels)}`
			);
		}
		const active = isActive(t);
		const step = active ? (t < FINE_STEP_DAYS * 86400 ? 20 : 60) : 120;

		// Clicks during the step (each one is a separate physical click for the limiter)
		if (active && profile.cps > 0) {
			// Attempts above what the limiter could ever pay are skipped (they would all be denied anyway)
			const n = Math.min(Math.floor(profile.cps * step), Math.ceil(cfg.CLICK_LIMIT.refillPerSec * 1.2 * step));
			const gap = (step * 1000) / Math.max(n, 1);
			if (ownedTiles.length === 0 || frontierDirty) refreshOwned();
			for (let i = 0; i < n; i++) {
				const input = { eventId: ++eventId, now: t * 1000 + i * gap, trusted: true };
				api().clickForGold(input);
			}
		}
		api().tick(step * 1000);
		t += step;
		if (profile.combat) {
			spawnMonsters();
			if (active) fightWaiting();
		}

		const decisionGap = profile.human ? profile.human.decisionSec : step;
		if (t - lastDecision >= decisionGap && (active || !profile.human)) {
			lastDecision = t;
			decide(active);
			const lvl = api().level.level;
			LEVEL_MARKS.forEach((n) => lvl >= n && milestones[`level${n}`] == null && (milestones[`level${n}`] = t / 86400));
			SNAPSHOTS_H.forEach((h) => {
				if (t >= h * 3600 && !snapshotsTaken.has(h)) {
					snapshotsTaken.add(h);
					milestones[`lvl@${h}h`] = lvl;
					milestones[`xp@${h}h`] = api().resources.xp;
				}
			});
			if (finished()) mark('finished', t);
			const castleNow = tileAt(api().tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level ?? 1;
			const totalRebirths = profile.rebirthAtCastle ? profile.rebirths ?? 1 : 0;
			const territory = utils.economyTiles(api().tiles, api().freeTiles) >= cfg.REBIRTH.minTiles;
			if (profile.rebirthAtCastle && run <= totalRebirths && castleNow >= profile.rebirthAtCastle && territory && !api().castleUpgrade) {
				mark('rebirth', t);
				const before = api().prestige.legacyEarned;
				const levelBefore = api().level.level;
				const xpBefore = api().resources.xp;
				if (api().rebirth()) {
					milestones[`lvlAtRebirth${run}`] = levelBefore;
					milestones[`embers${run}`] = api().prestige.legacyEarned - before;
					milestones[`rebirthDay${run}`] = t / 86400;
					milestones[`xpAtRebirth${run}`] = xpBefore;
					run++;
					runStart = t;
					frontierDirty = true;
					buildingCursor = 0;
					if (profile.combat) resetCombat();
				}
			}
			if (totalRebirths > 0) {
				if (run > totalRebirths && milestones[`r${run}.finished`] != null) break;
			} else if (castleNow >= cfg.CASTLE_UPGRADE.maxLevel) {
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
	'tiles75',
	'tiles100',
	'tiles150',
	'tiles200',
	'tiles300',
	'tiles400',
	'castle6',
	'castle7',
	'castle8',
	'castle9',
	'castle10',
	'level10',
	'level20',
	'level30',
	'level50',
	'level80',
	'level90',
	'level100',
	'finished',
];

function renderMarkdown(
	results: Record<string, Milestones>,
	legacy: boolean,
	spreads?: Record<string, Record<string, [number, number]>>
): string {
	const names = Object.keys(results);
	const fmt = (d: number | null | undefined) =>
		d == null ? '—' : d < 1 ? `${(d * 24).toFixed(1)} h` : `${d.toFixed(1)} d`;
	const lines: string[] = [];
	lines.push(`# Simulation milestones${legacy ? ' (LEGACY parameters — sanity check only)' : ''}`);
	lines.push('');
	lines.push(
		'> Generated by `npm run sim` (scripts/sim.ts): the real game store driven by a bot with a seeded RNG. ' +
			'Time to first reach each milestone, in game time. "finished" = castle 6 + max click power + the rebirth territory (REBIRTH.minTiles); the run continues to the last castle level.'
	);
	lines.push('');
	lines.push(`| milestone | ${names.join(' | ')} |`);
	lines.push(`| --- | ${names.map(() => '---').join(' | ')} |`);
	// after a rebirth only the headline milestones of each further run are listed
	const extraKeys = Array.from(
		new Set(
			names.flatMap((n) =>
				Object.keys(results[n]).filter((k) => !ORDER.includes(k) && /^(embers[0-9]+|kills.*|rebirth|rebirthDay[0-9]+|lvlAtRebirth[0-9]+|xpAtRebirth[0-9]+|(lvl|xp)@[0-9.]+h|r[0-9]+[.](castle6|tiles100|finished))$/.test(k))
			)
		)
	).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
	[...ORDER, ...extraKeys].forEach((key) => {
		if (!names.some((n) => results[n][key] != null) && !ORDER.includes(key)) return;
		const isCount = /^(embers|lvl|kills)/.test(key);
		const isXp = /^xp/.test(key);
		const cell = (n: string) => {
			if (isCount) return String(results[n][key] ?? '—');
			if (isXp) return results[n][key] == null ? '—' : Number(results[n][key]).toExponential(2);
			const spread = spreads?.[n]?.[key];
			const base = fmt(results[n][key]);
			return spread && results[n][key] != null ? `${base} (${fmt(spread[0])} - ${fmt(spread[1])})` : base;
		};
		lines.push(`| ${key} | ${names.map(cell).join(' | ')} |`);
	});
	lines.push('');
	const waitNames = names.filter((n) => tileWaits[n]);
	if (waitNames.length) {
		lines.push('');
		lines.push('Minutes the income needs to cover what is still missing of each part of the next tile, right after the purchase that reached that tile count (first run; the biggest number holds the player back):');
		lines.push('');
		lines.push('| profile | tiles | gold | wood | stone | coal | food | hide |');
		lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
		waitNames.forEach((n) =>
			Object.entries(tileWaits[n]).forEach(([tiles, w]) =>
				lines.push(`| ${n} | ${tiles} | ${['gold', 'wood', 'stone', 'coal', 'food', 'hide'].map((r) => (w[r] == null ? '—' : w[r])).join(' | ')} |`)
			)
		);
	}
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
