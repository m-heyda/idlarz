/**
 * The sim (`scripts/sim.ts`): a bot drives the **real store** with a seeded RNG and a mocked clock. Profiles: `idle`, `casual`, `hardcore`, `autoclicker` (24 h of perfect play, an upper bound), `human` (one click a second, plays 8-9, 12-13 and 18-23,
 * a visit once an hour, at most 8 tiles per visit, never sells surplus; calibrated to about 185 tiles after 3.3 days like the owner's real run), `human-rebirth6` / `-rebirth8`, `hardcore-rebirth6` / `-rebirth10` and `hardcore-rebirth6-x10`
 * (ten runs, used to fit the level anchors). "finished" in the milestone table = castle 6 + best click power + the Rebirth territory.
 *
 * Flags: `--seeds=3` (median and min-max over 3 seeds), `--no-write` (print only), `--maxdays=60` (stop early), `--legacy` (approximate the pre-rebalance game), `--except=a,b` (every profile but the named ones), `--list` (print the profile names), `--class=mage` (every profile plays that hero class; the default `none` is the neutral baseline, and a class run writes nothing: `npm run sim:classes` measures all four against it, IDL-78),
 * `--dump=file.json` (run the profiles and save the raw results only: a CI shard), `--merge=dir` (run nothing: merge the dumps in dir, every profile exactly once, and write the docs), `--set=SCALING_CONFIG.growthLate=1.25` (try a tweak without editing files).
 *
 * **Rules for a balance change**: change one parameter group, run `npm run sim -- --seeds=3`, compare with the committed `sim-milestones.md`, keep the targets, then `npm run docs:gen` and commit the diff. The pacing guard (`comparePacing`) compares the
 * baseline with the base branch in CI.
 *
 * @title The bot simulation
 * @category Pacing/The sim
 * @order 1
 */
/**
 * What pace the economy is tuned for, why, and how to check it. The measured numbers are **not** copied here: they live in `docs/generated/sim-milestones.md` (`npm run sim`, refreshed by `npm run docs:gen`) and `docs/generated/balance-tables.md`.
 * Open balance questions are in `docs/plan/ROADMAP.md`.
 *
 * | Stage | Target |
 * | --- | --- |
 * | First ~100 tiles | easy: hours for an active bot, between a day and a half and two days for the `human` profile (the four free start tiles make the first hours a little slower than the old 3x3 start) |
 * | 200-300 tiles | a 2-3 day project |
 * | After 300 tiles | clearly steeper (the `(n/300)^3.5` tail, {@link tilePrice}); a map of tens of thousands of tiles stays buyable |
 * | First Rebirth (castle 6 + 400 tiles) | around day 5-7 for a person who checks in a few times a day (to become about day 4-6 when the shorter castle timers and cheaper early castle costs of `docs/plan/19-first-build-steps.md` ship; the sim measured 4.6 d for the `human` profile) |
 * | Every later run | faster than the run before it (castle 6 again in roughly 60-70 % of the first run), flattening after the third run because the castle timers bound it |
 * | Level 80 / 100 | about the 3rd / 10th rebirth (the level curve is lifetime and carries over a rebirth, {@link LEVELING}) |
 * | First 10 minutes | first tile at about a minute, first animal before the first castle upgrade |
 *
 * **What the pace rests on**
 *
 * - **Castle timers are the floor of the first run.** Levels 2-6 take 30 min, 2 h, 6 h, 12 h and 24 h (1 d 20 h 30 min in all), levels 7-10 another 1.5, 2, 2.5 and 3.5 days (11 d 8 h 30 min to castle 10); Master Builders shortens them.
 *   The cost of 5 to 6 is what a player who plays a few times a day must be able to pay while the 4 to 5 timer runs, so a player who hoards instead of selling must not be locked out of it (the sim's `human` never sells surplus on purpose).
 * - **Tile price in materials** ({@link TILE_RESOURCE_COST}). The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (table at the end of `sim-milestones.md`).
 *   Gold must stay the biggest number; if hide or stone becomes the limiter, adjust the farm (deer and pigs make hide, Tannery +25 %, Pasture +8 %) rather than the share.
 * - **Tile XP is small on purpose** (`BASE_XP_PER_TILE` 45) and the level curve is slow and lifetime, so levels come from passive XP, kills and rebirth-paced play, not from buying tiles.
 * - **Combat is in the sim**: the `human*` profiles fight a normal monster every 900 s and the plains boss every 3 h with a gear schedule (starter kit, knight gear from day 1.5, obsidian from day 5; an assumption taken from `docs/generated/fight-sim.md`), paying the real kill income.
 *
 * **Caveats.** The `human` is one calibration point, not a measurement of players; the bots still beat it by 2-3x. After the first rebirth the sim bot spends its Embers builders-first and stops getting faster after the third run;
 * "max the rebirth shop" is a later design (ROADMAP). If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.
 *
 * @title Pacing targets
 * @category Pacing/Targets
 * @order 1
 * @see MAGNITUDE_BANDS, CASTLE_UPGRADE
 */
/**
 * Headless balance simulation. Drives the REAL game store (same actions the UI calls) with a bot,
 * a mocked clock and a seeded RNG, for several player profiles, and prints / writes a milestone table.
 *
 *   npx tsx scripts/sim.ts                  all profiles
 *   npx tsx scripts/sim.ts hardcore casual  selected profiles
 *   npx tsx scripts/sim.ts --legacy hardcore   approximate the pre-rebalance game (sanity check of the sim)
 *   npx tsx scripts/sim.ts --no-write hardcore-rebirth6 --maxdays=500   do not touch docs/generated (for tuning runs)
 *
 *   npx tsx scripts/sim.ts --except=hardcore-rebirth6-x10   all profiles but the named ones (comma separated)
 *   npx tsx scripts/sim.ts --dump=shard.json hardcore   run the selected profiles and save their raw results, write nothing else
 *   npx tsx scripts/sim.ts --merge=dir   run nothing: merge the --dump files in dir (every profile exactly once) and write the docs as a full run does
 *
 * Output: docs/generated/sim-milestones.md and sim-baseline.json (not written for --legacy).
 * CI runs the profiles as parallel shards (--dump) and merges them (--merge): the result is byte-identical to one full run.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isOwnedAt, ownedBounds, ownedRowMajor, tileAt } from '../src/utils/world';
import { mulberry32 } from '../src/lib/rng';
import { STARTER_REWARDS } from '../src/catalog/tutorial';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER } from '../src/config/playerClasses';
import { loadConfig, loadUtils, type GameConfig, type GameUtils } from './lib/loadGame';

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
	// --class=warrior|paladin|ranger|mage|none: the hero class every profile plays (IDL-78). The default `none` is the neutral baseline (no passives), so the committed profiles stay comparable.
	const classArg = args.find((a) => a.startsWith('--class='))?.slice(8) ?? 'none';
	if (classArg !== 'none' && !(classArg in PLAYER_CLASSES)) throw new Error(`--class must be none or one of ${PLAYER_CLASS_ORDER.join(', ')}`);
	simClass = classArg;
	if (maxDays) MAX_DAYS = Number(maxDays.slice(10));

	const cfg = await loadConfig();
	const utils = await loadUtils();
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
		// the owner's pace (docs/reference/pacing.md): a person who checks in a few times a day, fights with auto-battle, never optimises
		human: { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, startHour: 18 },
		'human-rebirth6': { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, startHour: 18, rebirthAtCastle: 6, rebirths: 5 },
		'human-rebirth8': { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, startHour: 18, rebirthAtCastle: 8, rebirths: 4 },
	};
	// --list: the profile names, one per line (scripts/sim-parallel.ts asks for them so its list cannot drift from this one)
	if (args.includes('--list')) {
		console.log(Object.keys(PROFILES).join('\n'));
		return;
	}
	const except = new Set((args.find((a) => a.startsWith('--except='))?.slice(9) ?? '').split(',').filter(Boolean));
	for (const name of except) if (!PROFILES[name]) throw new Error(`--except names an unknown profile ${name}`);
	const mergeDir = args.find((a) => a.startsWith('--merge='))?.slice(8);
	const dumpFile = args.find((a) => a.startsWith('--dump='))?.slice(7);
	const selected = mergeDir ? Object.keys(PROFILES) : names.length ? names : Object.keys(PROFILES).filter((n) => !except.has(n));

	const seedsArg = args.find((a) => a.startsWith('--seeds='));
	const seeds = seedsArg ? Math.max(1, Number(seedsArg.slice(8))) : 1;

	const results: Record<string, Milestones> = {};
	const spreads: Record<string, Record<string, [number, number]>> = {};
	// --merge: the shards' raw results in place of a run; every profile must be there exactly once, so a profile added to PROFILES but missing from a CI shard fails loudly
	if (mergeDir) {
		const shards = readdirSync(mergeDir)
			.filter((f) => f.endsWith('.json'))
			.sort()
			.map((f) => JSON.parse(readFileSync(resolve(mergeDir, f), 'utf8')) as SimDump);
		for (const name of selected) {
			const found = shards.filter((d) => d.results[name]);
			if (found.length !== 1) throw new Error(`--merge: profile ${name} is in ${found.length} shard files under ${mergeDir}, expected exactly 1`);
			results[name] = found[0].results[name];
			spreads[name] = found[0].spreads[name];
			if (found[0].magnitudes[name]) magnitudes[name] = found[0].magnitudes[name];
			if (found[0].tileWaits[name]) tileWaits[name] = found[0].tileWaits[name];
		}
		for (const d of shards)
			for (const name of Object.keys(d.results)) if (!selected.includes(name)) throw new Error(`--merge: shard has unknown profile ${name}`);
	}
	for (const name of mergeDir ? [] : selected) {
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
			const values = runs
				.map((r) => r[key])
				.filter((v): v is number => v != null)
				.sort((a, b) => a - b);
			if (values.length < Math.ceil(runs.length / 2)) {
				results[name][key] = null;
				return;
			}
			results[name][key] = values[Math.floor((values.length - 1) / 2)];
			spreads[name][key] = [values[0], values[values.length - 1]];
		});
		console.error(`${name}: done in ${((Date.now() - started) / 1000).toFixed(1)}s (${seeds} seed${seeds > 1 ? 's' : ''})`);
	}

	if (dumpFile) {
		writeFileSync(resolve(dumpFile), JSON.stringify({ results, spreads, magnitudes, tileWaits } satisfies SimDump));
		console.error(`Wrote ${resolve(dumpFile)} (${selected.join(', ')}); nothing else`);
		return;
	}

	const md = renderMarkdown(results, legacy, seeds > 1 ? spreads : undefined);
	console.log(md);
	for (const w of renderMagnitudes(selected).warnings) console.error(`WARNING outside the docs/reference/pacing.md band: ${w}`);
	// The milestones of every selected profile as data (game days, rounded so a rerun on another machine writes the same bytes): scripts/pacing-guard.ts compares it against the base branch's copy
	const json = JSON.stringify(
		{
			note: 'Written by npm run sim (scripts/sim.ts); compared by scripts/pacing-guard.ts. Game days, rounded to 6 significant digits.',
			profiles: results,
		},
		(_key, value) => (typeof value === 'number' ? Number(value.toPrecision(6)) : value),
		1,
	);
	if (!legacy && simClass === 'none' && !args.includes('--no-write')) {
		const dir = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../docs/generated');
		mkdirSync(dir, { recursive: true });
		writeFileSync(resolve(dir, 'sim-milestones.md'), md);
		writeFileSync(resolve(dir, 'sim-baseline.json'), json + '\n');
		console.error(`Wrote ${resolve(dir, 'sim-milestones.md')} and sim-baseline.json`);
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
	/** Fight a normal monster and the boss the way the server's auto-battle does (see GEAR_SCHEDULE) */
	combat?: boolean;
	/** Hour of the day the game starts at (a new player starts playing at once; the bots start at midnight) */
	startHour?: number;
}

type Milestones = Record<string, number | null>; // key -> game day (fractional), null if never

/** Magnitudes measured per profile (docs/reference/pacing.md "Magnitude targets", IDL-128): gold/s, stock hours, Embers; rendered and checked against the bands by `renderMagnitudes`. The last seed of a profile wins. */
const magnitudes: Record<string, Record<string, number | string>> = {};

/** What one CI shard saves for `--merge`: the raw per-profile results and the two side tables the markdown renders. */
interface SimDump {
	results: Record<string, Milestones>;
	spreads: Record<string, Record<string, [number, number]>>;
	magnitudes: Record<string, Record<string, number | string>>;
	tileWaits: Record<string, Record<string, Record<string, number>>>;
}

/** Minutes the income needs to pay each part of the next tile, read at tile counts (the hide-versus-gold diagnostic). */
const tileWaits: Record<string, Record<string, Record<string, number>>> = {};

/**
 * What the player wears, by game day: the strongest normal monster level they beat (`maxRat`), the boss win chance (`king`; docs/generated/fight-sim.md: the
 * starter kit beats level 5 monsters, knight gear level 9-10 ones but never the boss, obsidian gear the boss always).
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
	cfg: GameConfig;
	utils: GameUtils;
	store: typeof import('../src/stores/gameStore').useGameStore;
}

const HARDCORE_WINDOWS: [number, number][] = [
	[7, 9],
	[12, 13],
	[18, 23],
];
// SIM_DECISION / SIM_HOARD: calibration knobs (docs/reference/pacing.md: a person who checks in hourly while playing, buys a few tiles per visit and never sells surplus (calibrated to the owner: ~185 tiles after 3.3 days))
const HUMAN = {
	decisionSec: Number(process.env.SIM_DECISION ?? 3600),
	hoard: Number(process.env.SIM_HOARD ?? 1e9),
	tilesPerVisit: Number(process.env.SIM_TILES ?? 8),
};
const HUMAN_WINDOWS: [number, number][] = [
	[8, 9],
	[12, 13],
	[18, 23],
];
let MAX_DAYS = 300;
/** The hero class the profiles play (`--class=`); `none` is the neutral baseline the committed numbers are measured with. */
let simClass = 'none';
const FINE_STEP_DAYS = 45; // 20 s steps for the first weeks, coarser afterwards (keeps long runs fast)
const FIRST_FINISH_CASTLE = 6; // the first finish line (castle 6 + best click + the rebirth territory) is unchanged by castle levels 7-10

function runProfile(name: string, profile: Profile, ctx: Ctx, legacy: boolean, seed = 0): Milestones {
	const { cfg, utils, store, monsters, combatCfg, kill, gearEco, fightSim } = ctx;
	const realRandom = Math.random;
	Math.random = mulberry32(12345 + seed * 7919);

	const api = () => store.getState();
	api().resetGame();
	// the class picker: a class the store does not know has no passives (classPassives), which is the neutral baseline
	store.setState({ playerClass: simClass as never });

	const milestones: Milestones = {};
	const mag: Record<string, number | string> = (magnitudes[name] = {});
	/** Gold per second, unspent gold and stocks (in hours of their production), Embers and tiles at this moment, under the key prefix. Once per prefix. */
	const recordMagnitude = (prefix: string) => {
		if (`${prefix}.gps` in mag) return;
		const s = api();
		const total = s.resourceRates.total as unknown as Record<string, number>;
		const stock = s.resources as unknown as Record<string, number>;
		mag[`${prefix}.gps`] = total.gold;
		mag[`${prefix}.goldH`] = total.gold > 0 ? stock.gold / total.gold / 3600 : 0;
		let worst = 0;
		let what = '-';
		for (const r of Object.keys(total)) {
			if (r === 'gold' || r === 'xp' || !(r in stock) || !(total[r] > 0)) continue;
			const hours = stock[r] / total[r] / 3600;
			if (hours > worst) [worst, what] = [hours, r];
		}
		mag[`${prefix}.stockH`] = worst;
		mag[`${prefix}.stockRes`] = what;
		mag[`${prefix}.embers`] = s.prestige.legacyEarned;
		mag[`${prefix}.tiles`] = utils.economyTiles(s.tiles, s.freeTiles);
	};
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
	let frontier: [number, number] | null = null;
	let frontierDirty = true;

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

	// The tutorial's starter bundles (IDL-74): the server pays each once per account, the bot receives them at the same events. The potions at the last step do not matter to the economy.
	const gifts = { tile: false, castle: false };
	const gift = (which: 'tile' | 'castle') => {
		if (gifts[which]) return;
		gifts[which] = true;
		const bundle: { gold?: number; wood?: number } = STARTER_REWARDS[which];
		store.setState((st) => ({ resources: { ...st.resources, gold: st.resources.gold + (bundle.gold ?? 0), wood: st.resources.wood + (bundle.wood ?? 0) } }));
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
			api().addStatPoint(s.characterStats.charisma <= s.characterStats.intelligence ? 'charisma' : 'intelligence');
			s = api();
		}

		// Castle
		const castle = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
		const castleCeiling = profile.rebirthAtCastle ?? cfg.CASTLE_UPGRADE.maxLevel; // a player who rebirths at castle N does not start N+1
		if (!s.castleUpgrade && (castle.level ?? 1) < castleCeiling && castle.upgradeCost) {
			topUp(castle.upgradeCost as Partial<Record<string, number>>);
			if (api().upgradeCastle()) {
				gift('castle');
				s = api();
			}
		}
		mark(`castle${castle.level ?? 1}`, t);
		if ([6, 8, 10].includes(castle.level ?? 1)) recordMagnitude(`r${run}.c${castle.level}`);

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
			const roomy = Object.entries(cost).every(([r, v]) => s.resources[r as keyof typeof s.resources] >= (v ?? 0) * 1.5 + (castleNeed[r] ?? 0));
			if (roomy && api().buyFarmUpgrade(id)) s = api();
		}

		// Tile purchases: as many as affordable
		for (let guard = 0; guard < (profile.human?.tilesPerVisit ?? 20); guard++) {
			if (frontierDirty || !frontier) {
				frontier = findFrontier();
				frontierDirty = false;
			}
			if (!frontier) break;
			const owned = utils.economyTiles(s.tiles, s.freeTiles);
			const cost = utils.calculateTileCost(owned, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades, s.playerClass));
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
					([r, v]) => r !== 'gold' && s.resources[r as keyof typeof s.resources] >= (v ?? 0) && after[r as keyof typeof after] < (v ?? 0),
				);
				if (blocked) break;
			}
			const ok = api().buyTile(frontier[0], frontier[1]);
			if (!ok) break;
			gift('tile');
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
			const c = utils.calculateTileCost(owned + k, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades, s.playerClass));
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
		const cost = utils.calculateTileCost(owned, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades, s.playerClass));
		const need = utils.tileCostAsResources(cost) as Record<string, number>;
		const rate = s.resourceRates.total as unknown as Record<string, number>;
		// what is still missing after the purchase just made, over the income: the biggest number is what holds the next tile back
		const stock = s.resources as unknown as Record<string, number>;
		byName[key] = Object.fromEntries(Object.entries(need).map(([r, v]) => [r, rate[r] > 0 ? Math.round(Math.max(0, v - stock[r]) / rate[r] / 60) : Infinity]));
	};

	/**
	 * Fights (profile.combat): the server spawns a normal monster every COMBAT.spawn.intervalSec and a boss every bossIntervalSec, and
	 * auto-battle fights them while the player plays. A monster waits, growing a level per growth interval, until it is fought.
	 */
	const spawn = combatCfg.COMBAT.spawn;
	let nextRatAt = 0;
	let nextKingAt = spawn.bossIntervalSec;
	let kingRetryAt = 0;
	let waiting: { type: 'thistleBoar' | 'bossGreatAuroch'; at: number; spawnLevel: number }[] = [];
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
		while (t >= nextRatAt && waiting.filter((m) => m.type === 'thistleBoar').length < Math.max(1, cap - 1)) {
			const { min, max } = monsters.spawnLevelRange('thistleBoar', castleLevelNow());
			waiting.push({ type: 'thistleBoar', at: nextRatAt, spawnLevel: Math.round((min + max) / 2) });
			nextRatAt += spawn.intervalSec;
		}
		if (t >= nextRatAt) nextRatAt = t + spawn.intervalSec;
		if (t >= nextKingAt && !waiting.some((m) => m.type === 'bossGreatAuroch')) {
			const { min, max } = monsters.spawnLevelRange('bossGreatAuroch', castleLevelNow());
			waiting.push({ type: 'bossGreatAuroch', at: t, spawnLevel: Math.round((min + max) / 2) });
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
				resourceRates: utils.calculateResourceRates(
					st.tiles,
					st.characterStats,
					st.farmLevels,
					st.prestige,
					st.farmUpgrades,
					st.merchantUpgrades,
					gearEco.gearIncomePct(equipment),
				),
			}));
		}
		const rates = api().resourceRates.total;
		const xpRate = rates.xp * (1 + gearEco.xpGainPct(api().characterStats, api().equipment, api().playerClass) / 100);
		waiting.sort((a, b) => a.spawnLevel - b.spawnLevel);
		const left: typeof waiting = [];
		for (const m of waiting) {
			const level = monsters.levelAtAge(m.spawnLevel, t - m.at);
			let won = false;
			if (m.type === 'thistleBoar') won = level <= gear.maxRat;
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
			if (m.type === 'bossGreatAuroch') nextKingAt = t + spawn.bossIntervalSec;
			milestones[`kills${m.type}`] = (milestones[`kills${m.type}`] ?? 0) + 1;
		}
		waiting = left;
	};
	const killReward = (type: 'thistleBoar' | 'bossGreatAuroch', level: number, rates: { gold: number; xp: number; hide: number }) =>
		kill.killIncome(
			{ type, level },
			{ goldPerSec: rates.gold, xpPerSec: rates.xp, hidePerSec: rates.hide, luck: 0, killRewardPct: gearEco.gearEconomy(api().equipment).killRewardPct },
		);
	if (profile.combat) resetCombat();

	const finished = () => {
		const s = api();
		const castle = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level ?? 1;
		return castle >= FIRST_FINISH_CASTLE && s.clickLevel >= cfg.CLICK_LADDER.length - 1 && utils.economyTiles(s.tiles, s.freeTiles) >= cfg.REBIRTH.minTiles;
	};

	let lastDecision = -1e9;
	let lastTraceDay = -1;
	// Diagnostic: hours between "the previous castle timer finished" and "the next upgrade started" (= waiting for resources), first run only
	let castleBusy = false;
	let castleIdleSince = 0;
	while (t < MAX_DAYS * 86400) {
		if (process.env.SIM_TRACE && Math.floor(t / 86400) !== lastTraceDay && Math.floor(t / 86400) % Number(process.env.SIM_TRACE) === 0) {
			lastTraceDay = Math.floor(t / 86400);
			const s = api();
			const r = s.resourceRates.total;
			console.error(
				`[${name}] day ${lastTraceDay} tiles ${utils.economyTiles(s.tiles, s.freeTiles)} castle ${tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level} up=${s.castleUpgrade ? Math.round(s.castleUpgrade.remainingSec / 3600) + 'h' : '-'} lvl ${s.level.level} click${s.clickLevel} gold ${Math.round(s.resources.gold)} (+${r.gold.toFixed(1)}/s) wood ${Math.round(s.resources.wood)} stone ${Math.round(s.resources.stone)} coal ${Math.round(s.resources.coal)} food ${Math.round(s.resources.food)} (+${r.food.toFixed(1)}) hide ${Math.round(s.resources.hide)} (+${r.hide.toFixed(2)}) meat ${Math.round(s.resources.meat)} (+${r.meat.toFixed(1)}) farm ${JSON.stringify(s.farmLevels)}`,
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
				const input = { eventId: ++eventId, now: t * 1000 + i * gap, trusted: true };
				api().clickForGold(input);
			}
		}
		api().tick(step * 1000);
		t += step;
		const upgrade = api().castleUpgrade;
		if (!!upgrade !== castleBusy) {
			castleBusy = !!upgrade;
			if (upgrade && run === 1) milestones[`waitHcastle${upgrade.toLevel - 1}`] = Math.round(((t - castleIdleSince) / 3600) * 10) / 10;
			if (!upgrade) castleIdleSince = t;
		}
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
			const totalRebirths = profile.rebirthAtCastle ? (profile.rebirths ?? 1) : 0;
			const territory = utils.economyTiles(api().tiles, api().freeTiles) >= cfg.REBIRTH.minTiles;
			if (profile.rebirthAtCastle && run <= totalRebirths && castleNow >= profile.rebirthAtCastle && territory && !api().castleUpgrade) {
				mark('rebirth', t);
				const before = api().prestige.legacyEarned;
				const levelBefore = api().level.level;
				const xpBefore = api().resources.xp;
				if (api().rebirth()) {
					milestones[`lvlAtRebirth${run}`] = levelBefore;
					milestones[`embers${run}`] = api().prestige.legacyEarned - before;
					mag[`r${run}.gain`] = api().prestige.legacyEarned - before;
					mag[`r${run}.gainCastle`] = castleNow;
					mag[`lifetime.${run}`] = api().prestige.legacyEarned;
					milestones[`rebirthDay${run}`] = t / 86400;
					milestones[`xpAtRebirth${run}`] = xpBefore;
					run++;
					runStart = t;
					castleIdleSince = t;
					frontierDirty = true;
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

/**
 * The bands of the magnitude targets (IDL-128): the table below is their one copy, the sim prints them next to the measured value.
 *
 * Magnitude targets (decided 2026-11-07, IDL-128): measured with the real store (`casual`, trace to day 16; `human-rebirth8`, `hardcore-rebirth6-x10`) and set as the design ceiling every cap decision is checked against.
 * "Income multiplier" is total income at castle 10 relative to run 1 at castle 10, all sources together (Embers, gear, Idols, Monument, Paragon). The bands are the constants below: they are the only copy, the sim prints them next to the measured value
 * with a status (lines outside a band are also printed as `WARNING` on stderr, the run does not fail).
 *
 * | Checkpoint | Gold per second | Income multiplier | Lifetime Embers | Unspent gold |
 * | --- | --- | --- | --- | --- |
 * | Run 1, castle 10 (day ~13, ~850 tiles) | 3,000 to 6,000 (was 2,500 to 5,000 before the gentler tile tail, IDL-181) | x1 | 0 | <= 4 h |
 * | Rebirth 5 (run 6 at castle 10) | x3 to x6 of run 1 | **x4** | about 90 to 140 with rebirths at castle 6, 350 to 500 at castle 8 | <= 4 h |
 * | Rebirth 10 (run 11 at castle 10) | x7 to x15 of run 1 | **x10** | about 190 to 300 with rebirths at castle 6 | <= 4 h |
 *
 * - **Embers per rebirth** (fits the decided formula, IDL-183, with the +50 tiles per rebirth of IDL-181): castle 6 about 18 to 28 (400 to 460 tiles), castle 8 about 70 to 100 (450 tiles), castle 10 about 400 to 650 (850 to 1,000 tiles). See {@link emberGain}.
 * - **Stocks**: any non-gold resource at most 24 hours of its production rate at castle 10; above it the sim warns. The merchant, auto-sell and the Monument are the sinks.
 * - **Ember path alone** (`1 + 0.1 x E^0.6`): x4 to x6 at 300 to 600 lifetime Embers; capped gear, Idols and the Monument add about x2.5 on top, which is how x10 at rebirth 10 is reached without Paragon doing the heavy lifting.
 * - **Finding to keep in mind**: `human-rebirth8` finishes run 2 in 99 % of run 1's time (castle timers set the pace), while hardcore falls to 48 to 72 %. The run-2 ratio of 60 to 70 % is therefore a hardcore-profile target;
 *   humans feel the Ember gain as bigger numbers and a larger map, not as shorter runs.
 * - The multiplier compares the same castle level in two runs because the bots rebirth before castle 10, so it is an indication. The existing +-15 % pacing guard (IDL-17) is separate.
 *
 * @category Pacing/Magnitude targets
 * @order 1
 */
const MAGNITUDE_BANDS = {
	gpsRun1Castle10: [3000, 6000], // was 2,500-5,000 before the gentler tile tail of IDL-181 (casual and hardcore measure 5,480)
	unspentGoldHours: 4,
	stockHours: 24,
	// from `REBIRTH.gain` = 3 x (castle - 5)^1.3 x (sqrt(tiles / 10) + 0.02 x surplus) at the territory the bots rebirth with (400-460 tiles at castle 6 and 8, ~850-1,000 at castle 10)
	embersPerRebirth: { 6: [18, 28], 8: [70, 100], 10: [400, 650] } as Record<number, [number, number]>,
	// lifetime Embers after the 5th / 10th rebirth, by the castle level the bot rebirths at (about n x the per-rebirth band)
	lifetimeEmbers: { 5: { 6: [90, 140], 8: [350, 500] }, 10: { 6: [190, 300] } } as Record<number, Record<number, [number, number]>>,
	incomeMultiplier: { 5: [3, 6], 10: [7, 15] } as Record<number, [number, number]>,
};

/** The magnitude table of docs/reference/pacing.md, per profile, with a status per line; `warnings` lists the lines outside their band. */
function renderMagnitudes(names: string[]): { lines: string[]; warnings: string[] } {
	const rows: string[] = [];
	const warnings: string[] = [];
	const num = (profile: string, key: string) => {
		const v = magnitudes[profile]?.[key];
		return typeof v === 'number' ? v : null;
	};
	const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en') : String(Math.round(v * 10) / 10));
	const row = (profile: string, what: string, value: number, band: string, ok: boolean | null) => {
		// null: no band applies (shown as a plain number, never a warning)
		rows.push(`| ${profile} | ${what} | ${fmt(value)} | ${band} | ${ok == null ? 'n/a' : ok ? 'ok' : '**outside**'} |`);
		if (ok === false) warnings.push(`${profile}: ${what} = ${fmt(value)}, band ${band}`);
	};
	const inBand = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
	for (const p of names) {
		// run 1 at castle 10
		const gps = num(p, 'r1.c10.gps');
		if (gps != null) {
			const [lo, hi] = MAGNITUDE_BANDS.gpsRun1Castle10;
			row(p, 'run 1, castle 10: gold per second', gps, `${lo}-${hi}`, inBand(gps, [lo, hi]));
			const goldH = num(p, 'r1.c10.goldH') ?? 0;
			row(p, 'run 1, castle 10: unspent gold (hours of income)', goldH, `<= ${MAGNITUDE_BANDS.unspentGoldHours}`, goldH <= MAGNITUDE_BANDS.unspentGoldHours);
			const stockH = num(p, 'r1.c10.stockH') ?? 0;
			row(
				p,
				`run 1, castle 10: biggest stock (${magnitudes[p]['r1.c10.stockRes']}, hours of production)`,
				stockH,
				`<= ${MAGNITUDE_BANDS.stockHours}`,
				stockH <= MAGNITUDE_BANDS.stockHours,
			);
		}
		// Embers per rebirth, by the castle level it happened at
		for (let run = 1; num(p, `r${run}.gain`) != null; run++) {
			const castle = num(p, `r${run}.gainCastle`)!;
			const band = MAGNITUDE_BANDS.embersPerRebirth[castle];
			if (band)
				row(p, `rebirth ${run} at castle ${castle}: Embers gained`, num(p, `r${run}.gain`)!, `${band[0]}-${band[1]}`, inBand(num(p, `r${run}.gain`)!, band));
		}
		// lifetime Embers after the 5th and the 10th rebirth
		for (const [n, byCastle] of Object.entries(MAGNITUDE_BANDS.lifetimeEmbers)) {
			const v = num(p, `lifetime.${n}`);
			const castle = num(p, `r${n}.gainCastle`);
			const band = castle == null ? undefined : byCastle[castle];
			if (v != null && band) row(p, `after rebirth ${n} at castle ${castle}: lifetime Embers`, v, `${band[0]}-${band[1]}`, inBand(v, band));
		}
		// income multiplier: run N+1 against run 1 at the highest castle level both reached (docs/reference/pacing.md defines it at castle 10; the sim bot rebirths earlier)
		for (const [n, band] of Object.entries(MAGNITUDE_BANDS.incomeMultiplier)) {
			const run = Number(n) + 1;
			for (const c of [10, 8, 6]) {
				const first = num(p, `r1.c${c}.gps`);
				const later = num(p, `r${run}.c${c}.gps`);
				if (first && later != null) {
					row(
						p,
						`after rebirth ${n}: income multiplier at castle ${c} (run ${run} over run 1)`,
						later / first,
						c === 10 ? `x${band[0]}-${band[1]}` : `(x${band[0]}-${band[1]} is for castle 10)`,
						c === 10 ? inBand(later / first, band) : null,
					);
					break;
				}
			}
		}
	}
	const lines = ['', '## Magnitude targets (docs/reference/pacing.md, IDL-128)', ''];
	if (rows.length === 0) {
		lines.push('No selected profile reached a checkpoint (castle 10 in run 1, a rebirth, lifetime Embers at rebirth 5 or 10).', '');
		return { lines, warnings };
	}
	lines.push(
		'Measured with the real store at the checkpoints of docs/reference/pacing.md; the last seed of each profile. The income multiplier compares the same castle level in two runs (the bots rebirth before castle 10), so below castle 10 it is an indication with no status.',
		'',
	);
	lines.push('| profile | checkpoint | measured | band | status |', '| --- | --- | --- | --- | --- |', ...rows, '');
	if (warnings.length) lines.push(`${warnings.length} line${warnings.length > 1 ? 's' : ''} outside the band.`, '');
	return { lines, warnings };
}

function renderMarkdown(results: Record<string, Milestones>, legacy: boolean, spreads?: Record<string, Record<string, [number, number]>>): string {
	const names = Object.keys(results);
	const fmt = (d: number | null | undefined) => (d == null ? '—' : d < 1 ? `${(d * 24).toFixed(1)} h` : `${d.toFixed(1)} d`);
	const lines: string[] = [];
	lines.push(`# Simulation milestones${legacy ? ' (LEGACY parameters — sanity check only)' : ''}`);
	lines.push('');
	lines.push(
		'> Generated by `npm run sim` (scripts/sim.ts): the real game store driven by a bot with a seeded RNG. ' +
			'Time to first reach each milestone, in game time. "finished" = castle 6 + max click power + the rebirth territory (REBIRTH.minTiles); the run continues to the last castle level.',
	);
	lines.push('');
	lines.push(
		'> Class picker (IDL-78, RELEASE-PLAN B7): these profiles play with no class, the neutral baseline. `npm run sim:classes` plays `idle` and `casual` with each class and fails when a guarded milestone moves more than ±15 % (or 5 game days) from this baseline; the sim models the XP, tile-discount and fight passives, not offline efficiency or chest speed (both are server-side only).',
	);
	lines.push('');
	lines.push(`| milestone | ${names.join(' | ')} |`);
	lines.push(`| --- | ${names.map(() => '---').join(' | ')} |`);
	// after a rebirth only the headline milestones of each further run are listed
	const extraKeys = Array.from(
		new Set(
			names.flatMap((n) =>
				Object.keys(results[n]).filter(
					(k) =>
						!ORDER.includes(k) &&
						/^(embers[0-9]+|kills.*|rebirth|rebirthDay[0-9]+|waitHcastle[0-9]+|lvlAtRebirth[0-9]+|xpAtRebirth[0-9]+|(lvl|xp)@[0-9.]+h|r[0-9]+[.](castle6|tiles100|finished))$/.test(
							k,
						),
				),
			),
		),
	).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
	[...ORDER, ...extraKeys].forEach((key) => {
		if (!names.some((n) => results[n][key] != null) && !ORDER.includes(key)) return;
		const isCount = /^(embers|lvl|kills|waitH)/.test(key); // waitHcastleN = hours the castle idled waiting for resources before upgrade N -> N+1
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
	// How much faster each further run reaches "finished" than the first one (target band 60-70 %, docs/reference/pacing.md; used to tune the Ember curve)
	const ratioRows = names.flatMap((n) => {
		const first = results[n].finished;
		if (first == null) return [];
		const cells: string[] = [];
		for (let run = 2; results[n][`r${run}.finished`] != null; run++)
			cells.push(`run ${run}: ${Math.round((Number(results[n][`r${run}.finished`]) / first) * 100)} %`);
		return cells.length ? [`| ${n} | ${cells.join(', ')} |`] : [];
	});
	if (ratioRows.length) {
		lines.push('Time to "finished" in each further run as a share of the first run:');
		lines.push('');
		lines.push('| profile | share of run 1 |');
		lines.push('| --- | --- |');
		lines.push(...ratioRows);
		lines.push('');
	}
	const waitNames = names.filter((n) => tileWaits[n]);
	if (waitNames.length) {
		lines.push('');
		lines.push(
			'Minutes the income needs to cover what is still missing of each part of the next tile, right after the purchase that reached that tile count (first run; the biggest number holds the player back):',
		);
		lines.push('');
		lines.push('| profile | tiles | gold | wood | stone | coal | food | hide |');
		lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
		waitNames.forEach((n) =>
			Object.entries(tileWaits[n]).forEach(([tiles, w]) =>
				lines.push(`| ${n} | ${tiles} | ${['gold', 'wood', 'stone', 'coal', 'food', 'hide'].map((r) => (w[r] == null ? '—' : w[r])).join(' | ')} |`),
			),
		);
	}
	lines.push(...renderMagnitudes(names).lines);
	lines.push(
		'Profiles: idle = never clicks; casual = 1 click/s for 3 h/day; hardcore = 4 clicks/s for 8 h/day; ' +
			'autoclicker = 20 clicks/s 24 h/day (the limiter should keep it at roughly hardcore pace).',
	);
	return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------

function applyOverride(cfg: object, spec: string) {
	const [path, raw] = spec.split('=');
	const value = Number(raw);
	if (path === 'castleCostScale') {
		const costs = (cfg as GameConfig).CASTLE_UPGRADE.upgradeCosts as Record<string, number>[];
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
function applyLegacy(cfg: GameConfig) {
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
