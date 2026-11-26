/**
 * The pace sim's engine (`scripts/pace/run.ts`): a bot drives the **real store** (the same actions the buttons call) with a seeded RNG and a game clock it moves itself. What makes it fast:
 *
 * - **Clicks are batched.** The old sim called `clickForGold` for every click (1.4 million store updates for 12 days of `hardcore`). Here a private copy of the click limiter ({@link createClickLimiter}, the same two buckets) decides how many of
 *   the step's clicks are paid, one real `clickForGold` gives the gold of a click, and one `addResources` pays the rest.
 * - **The clock jumps to the next thing that can change.** A step is 20 s in the first quarter hour of a run, 60 s while the player plays, 300 s (the store's longest tick) while away, and is cut short at the next whole hour (the playing
 *   windows start and end on one), at the end of a castle or building timer, and at the next decision of a person who only checks in now and then.
 * - **Away time follows the server's rule** for the profiles with `away` (the `human*` ones): the kingdom pays `offlineEfficiency` of its income for at most `offlineCapHours` of a gap, the timers run at full speed, and the player buys nothing.
 *
 * What the bot also plays now: **Builder #2** and the daily gems (Gem shop), the Ember shop **plans** and the merchant's gold upgrades, and the **rocks** (one per 15 minutes, room for one per 100 tiles; their clicks are taken from the gold clicks).
 * Rocks pay stone and coal (`rollRockLoot`); the ingredients are counted, not spent. The fights use the gear schedule below; Luck is 0.
 *
 * @title The pace sim engine
 * @category Pacing/The sim
 * @order 1
 */
import './env';
import { mulberry32 } from '../../src/lib/rng';
import { createClickLimiter } from '../../src/lib/clickLimiter';
import { limitOf } from '../../src/lib/limits';
import { HARD_LIMITS } from '../../src/config/limits';
import { ROCK, ROCK_TIERS } from '../../src/config/rocks';
import { rockCap, rockIntervalSec, rollRockLoot, rollRockTier, miningPower, takeClicks, type ClickBucket } from '../../src/lib/rocks';
import type { RockTier } from '../../src/config/rocks';
import { STARTER_REWARDS } from '../../src/catalog/tutorial';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER } from '../../src/config/playerClasses';
import { ownedRowMajor, tileAt } from '../../src/utils/world';
import { loadConfig, loadUtils, type GameConfig, type GameUtils } from '../lib/loadGame';
import type { Profile } from './profiles';
import * as policy from './policies';
import type { Bot, Store } from './policies';

export type Milestones = Record<string, number | null>; // key -> game day (fractional), null if never

/** What one run measured: the milestones, the magnitudes at the checkpoints and the tile-wait diagnostic. */
export interface RunResult {
	milestones: Milestones;
	magnitudes: Record<string, number | string>;
	tileWaits: Record<string, Record<string, number>>;
}

/** The loaded game: config, maths and the store, once per process. */
export interface Ctx {
	cfg: GameConfig;
	utils: GameUtils;
	bld: typeof import('../../src/lib/buildings');
	store: Store;
	monsters: typeof import('../../src/lib/monsters');
	combatCfg: typeof import('../../src/config/combatConfig');
	kill: typeof import('../../src/lib/loot/kill');
	gearEco: typeof import('../../src/lib/gearEconomy');
	fightSim: typeof import('../../src/lib/fightSim');
	limitCtx: typeof import('../../src/stores/game/base').limitCtx;
	/** The hero class every profile plays (`--class=`); `none` is the neutral baseline the committed numbers are measured with */
	playerClass: string;
	maxDays: number;
}

export interface CtxOptions {
	playerClass?: string;
	maxDays?: number;
	/** `--set=Path.to.value=1.5`: try a tweak without editing files */
	overrides?: string[];
}

/** Loads the game once. The class is checked against `PLAYER_CLASSES`. */
export const loadCtx = async (options: CtxOptions = {}): Promise<Ctx> => {
	const playerClass = options.playerClass ?? 'none';
	if (playerClass !== 'none' && !(playerClass in PLAYER_CLASSES)) throw new Error(`--class must be none or one of ${PLAYER_CLASS_ORDER.join(', ')}`);
	const cfg = await loadConfig();
	const utils = await loadUtils();
	const { useGameStore } = await import('../../src/stores/gameStore');
	useGameStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });
	(options.overrides ?? []).forEach((o) => applyOverride(cfg, o));
	return {
		cfg,
		utils,
		bld: await import('../../src/lib/buildings'),
		store: useGameStore,
		monsters: await import('../../src/lib/monsters'),
		combatCfg: await import('../../src/config/combatConfig'),
		kill: await import('../../src/lib/loot/kill'),
		gearEco: await import('../../src/lib/gearEconomy'),
		fightSim: await import('../../src/lib/fightSim'),
		limitCtx: (await import('../../src/stores/game/base')).limitCtx,
		playerClass,
		maxDays: options.maxDays ?? 300,
	};
};

/** `Path.to.value=1.5` sets a config number; `castleCostScale=1.2` scales every castle cost. */
const applyOverride = (cfg: object, spec: string): void => {
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
};

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

/** First 20-second steps of a run, then a minute while playing (a decision is as late as that) */
const FINE_STEP_SEC = 900;
const PLAY_STEP_SEC = 60;
/** The store's own longest tick (`MAX_CATCHUP_SEC`) */
const AWAY_STEP_SEC = 300;
const LEVEL_MARKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// Level and lifetime XP at fixed game times (hours): `lvl@4.5h`, `xp@4.5h` ...
const SNAPSHOTS_H = [1, 4.5, 24, 72, 168, 336, 576];
const FIRST_FINISH_CASTLE = 6; // the first finish line (castle 6 + best click + the rebirth territory) is unchanged by castle levels 7-10

/** Plays one profile for one seed and returns what it measured. */
export const runProfile = (name: string, profile: Profile, ctx: Ctx, seed = 0): RunResult => {
	const { cfg, utils, store, monsters, combatCfg, kill, gearEco, fightSim, bld } = ctx;
	const realRandom = Math.random;
	Math.random = mulberry32(12345 + seed * 7919);
	try {
		return play(name, profile, ctx, { cfg, utils, store, monsters, combatCfg, kill, gearEco, fightSim, bld });
	} finally {
		Math.random = realRandom;
	}
};

type Parts = Pick<Ctx, 'cfg' | 'utils' | 'store' | 'monsters' | 'combatCfg' | 'kill' | 'gearEco' | 'fightSim' | 'bld'>;

const play = (name: string, profile: Profile, ctx: Ctx, { cfg, utils, store, monsters, combatCfg, kill, gearEco, fightSim, bld }: Parts): RunResult => {
	const api = () => store.getState();
	api().resetGame();
	// the class picker: a class the store does not know has no passives (classPassives), which is the neutral baseline
	store.setState({ playerClass: ctx.playerClass as never });

	const milestones: Milestones = {};
	const mag: Record<string, number | string> = {};
	const tileWaits: Record<string, Record<string, number>> = {};
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
	// the castle level run N rebirths at: the schedule entry of that rebirth (the last one repeats), else the fixed level
	const castleTargetFor = (n: number): number | undefined =>
		profile.rebirthAtMaxCastle
			? limitOf('castleMaxLevel', ctx.limitCtx(api()))
			: profile.endAtCastle10 && n > (profile.rebirths ?? 1)
				? cfg.CASTLE_UPGRADE.maxLevel
				: profile.rebirthSchedule
					? profile.rebirthSchedule[Math.min(n - 1, profile.rebirthSchedule.length - 1)]
					: profile.rebirthAtCastle;
	let runStart = 0;
	let t = 0; // game seconds

	const bot: Bot = {
		name,
		profile,
		cfg,
		utils,
		bld,
		store,
		api,
		t: 0,
		run: 1,
		castleCeiling: () => castleTargetFor(run) ?? cfg.CASTLE_UPGRADE.maxLevel,
		mark: (key, at) => {
			const k = run === 1 ? key : `r${run}.${key}`;
			if (milestones[k] == null) milestones[k] = (at - runStart) / 86400;
		},
		frontier: null,
		frontierDirty: true,
		gems: 0,
		builder2: false,
		gemDay: 0,
		gemStreak: 0,
		gifts: { tile: false, castle: false, farm: false },
		tileWaits,
	};
	if (profile.gems === 'day0') {
		bot.builder2 = true;
		store.setState({ gemBuilders: 1 });
	}
	// the Paragon points are the ledger's record: set from the start, and again after every rebirth
	if (profile.paragon) store.setState({ paragonSpent: { ...profile.paragon } });

	// ---- the player's day --------------------------------------------------------------------------------
	const hourOf = (sec: number) => ((sec + (profile.startHour ?? 0) * 3600) % 86400) / 3600;
	const isActive = (sec: number) => profile.windows.some(([a, b]) => hourOf(sec) >= a && hourOf(sec) < b);
	/** Seconds to the next whole hour: the playing windows start and end on one, so a step never straddles an edge */
	const toHourEdge = (sec: number) => 3600 - ((sec + (profile.startHour ?? 0) * 3600) % 3600);

	// ---- clicks, batched ------------------------------------------------------------------------------------
	const limiter = createClickLimiter(cfg.CLICK_LIMIT);
	let eventId = 0;
	/** Paid clicks among `n` made over `step` seconds (the same two buckets the store has) */
	const paidClicks = (n: number, step: number): number => {
		const gap = (step * 1000) / Math.max(n, 1);
		let paid = 0;
		for (let i = 0; i < n; i++) if (limiter.take({ eventId: ++eventId, now: t * 1000 + i * gap, trusted: true })) paid++;
		return paid;
	};
	/** One real click gives the gold of a click (rates do not change inside a step); the other paid clicks are added in one go. */
	const clickGold = (paid: number) => {
		if (paid <= 0) return;
		const one = api().clickForGold({ eventId: ++eventId + 1e9, now: t * 1000, trusted: true });
		if (paid > 1 && one > 0) api().addResources({ gold: one * (paid - 1) });
	};

	// ---- rocks ------------------------------------------------------------------------------------------------
	let rocks: { tier: RockTier; left: number; bucket: ClickBucket }[] = [];
	let nextRockAt = 0;
	const resetRocks = () => {
		rocks = [];
		nextRockAt = t + rockIntervalSec(0);
	};
	/** A rock appears every `rockIntervalSec` of play time while there is room (`rockCap`); only while the player is playing, which is the cautious reading of the server rule. */
	const spawnRocks = () => {
		const owned = utils.economyTiles(api().tiles, api().freeTiles);
		while (t >= nextRockAt) {
			if (rocks.length < rockCap(owned)) {
				const tier = rollRockTier(0, Math.random);
				rocks.push({ tier, left: ROCK_TIERS[tier].clicks, bucket: {} });
			}
			nextRockAt += rockIntervalSec(0);
		}
	};
	/** Spends up to `clicks` on the waiting rocks (the server lets in `ROCK.maxCps` a second per rock); returns the clicks that are left for the gold. */
	const mineRocks = (clicks: number, step: number): number => {
		let left = clicks;
		const power = miningPower(api().prestige);
		while (left > 0 && rocks.length > 0) {
			const rock = rocks[0];
			const wanted = Math.min(left, Math.ceil(rock.left / power), ROCK.maxBatch);
			const got = takeClicks(rock.bucket, wanted, t + ((clicks - left) / Math.max(clicks, 1)) * step);
			rock.bucket = { tokens: got.tokens, hitAt: t };
			rock.left -= got.accepted * power;
			left -= wanted;
			if (got.accepted < wanted) break; // the rock's own click limit: the rest of the clicks go to the gold
			if (rock.left <= 0) {
				const rates = api().resourceRates.total;
				const loot = rollRockLoot(rock.tier, { rates: { stone: rates.stone, coal: rates.coal }, luck: 0 }, Math.random);
				api().addResources({ stone: loot.resources.stone, coal: loot.resources.coal });
				milestones.rocksMined = (milestones.rocksMined ?? 0) + 1;
				for (const q of Object.values(loot.stash)) milestones.rockIngredients = (milestones.rockIngredients ?? 0) + q;
				rocks.shift();
			}
		}
		return left;
	};

	// ---- fights (profile.combat) ---------------------------------------------------------------------------------
	/**
	 * The server spawns a normal monster every COMBAT.spawn.intervalSec and a boss every bossIntervalSec, and auto-battle fights them while the player plays.
	 * A monster waits, growing a level per growth interval, until it is fought.
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
		const gear = [...GEAR_SCHEDULE].reverse().find((g) => t / 86400 >= g.day) ?? GEAR_SCHEDULE[0];
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
					gearEco.gearIncome(equipment),
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
			const r = kill.killIncome(
				{ type: m.type, level },
				{ goldPerSec: rates.gold, xpPerSec: xpRate, hidePerSec: rates.hide, luck: 0, killRewardPct: gearEco.gearEconomy(api().equipment).killRewardPct },
			);
			store.setState((st) => ({
				resources: { ...st.resources, gold: st.resources.gold + r.gold, xp: st.resources.xp + r.xp, hide: st.resources.hide + r.hide },
			}));
			if (m.type === 'bossGreatAuroch') nextKingAt = t + spawn.bossIntervalSec;
			milestones[`kills${m.type}`] = (milestones[`kills${m.type}`] ?? 0) + 1;
		}
		waiting = left;
	};
	if (profile.combat) resetCombat();
	if (profile.rocks) resetRocks();

	// ---- one decision --------------------------------------------------------------------------------------------
	const decide = (active: boolean) => {
		bot.t = t;
		bot.run = run;
		let s = api();
		// Chests (only while the player is playing)
		if (active && s.activeChests > 0) {
			for (const { x, y, tile } of ownedRowMajor(s.tiles)) if (tile.hasChest) api().collectChest(x, y);
			s = api();
		}
		policy.spendEmbers(bot);
		if (profile.buyMerchant) policy.buyMerchantUpgrades(bot);
		policy.gemShop(bot, active);
		// Stat points -> Charisma / Intelligence
		s = api();
		while (s.characterStats.availablePoints > 0) {
			api().addStatPoint(s.characterStats.charisma <= s.characterStats.intelligence ? 'charisma' : 'intelligence');
			s = api();
		}
		policy.castle(bot, STARTER_REWARDS);
		policy.buildings(bot);
		const castleLevel = tileAt(api().tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level ?? 1;
		if ([6, 8, 10].includes(castleLevel)) recordMagnitude(`r${run}.c${castleLevel}`);
		policy.clickPower(bot);
		policy.farm(bot);
		policy.tiles(bot, STARTER_REWARDS);
		policy.sellExcess(bot);
	};

	const finished = () => {
		const s = api();
		const castle = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y).level ?? 1;
		return castle >= FIRST_FINISH_CASTLE && s.clickLevel >= cfg.CLICK_LADDER.length - 1 && utils.economyTiles(s.tiles, s.freeTiles) >= cfg.REBIRTH.minTiles;
	};

	/** The rebirth gate of the profile: the castle level of this run, the territory of this rebirth (`REBIRTH.tilesNeeded`), no castle upgrade running. Records the pace of the rebirth. */
	const maybeRebirth = (castleNow: number): boolean => {
		const totalRebirths = profile.rebirthAtCastle ? (profile.rebirths ?? 1) : 0;
		if (!profile.rebirthAtCastle || run > totalRebirths) return false;
		const s = api();
		const needed = cfg.REBIRTH.tilesNeeded(s.prestige.rebirths);
		const territory = utils.economyTiles(s.tiles, s.freeTiles) >= needed;
		// the moment a rebirth is possible at all (castle 6 and the territory), whether or not the bot waits for a higher castle
		if (castleNow >= cfg.REBIRTH.minCastleLevel && territory) bot.mark('rebirthPossible', t);
		if (!(castleNow >= (castleTargetFor(run) ?? profile.rebirthAtCastle) && territory && !s.castleUpgrade)) return false;
		bot.mark('rebirth', t);
		// what the run built up to: the map, the income and the buildings at the moment of the rebirth (the maximized run reads them)
		milestones[`tilesAtRebirth${run}`] = utils.economyTiles(s.tiles, s.freeTiles);
		milestones[`gpsAtRebirth${run}`] = s.resourceRates.total.gold;
		milestones[`buildingLevels${run}`] = bld.builtBuildings(s.tiles).reduce((sum, x) => sum + x.level, 0);
		const before = s.prestige.legacyEarned;
		const levelBefore = s.level.level;
		const xpBefore = s.resources.xp;
		if (!api().rebirth()) return false;
		const gain = api().prestige.legacyEarned - before;
		milestones[`lvlAtRebirth${run}`] = levelBefore;
		milestones[`embers${run}`] = gain;
		mag[`r${run}.gain`] = gain;
		mag[`r${run}.gainCastle`] = castleNow;
		mag[`lifetime.${run}`] = api().prestige.legacyEarned;
		milestones[`rebirthDay${run}`] = t / 86400;
		milestones[`xpAtRebirth${run}`] = xpBefore;
		run++;
		runStart = t;
		bot.frontierDirty = true;
		// Builder #2 is the ledger's record: it survives the reset
		if (bot.builder2) store.setState({ gemBuilders: 1 });
		if (profile.paragon) store.setState({ paragonSpent: { ...profile.paragon } });
		if (profile.combat) resetCombat();
		if (profile.rocks) resetRocks();
		return true;
	};

	// ---- away time -----------------------------------------------------------------------------------------------
	let awayStart: number | null = null;
	/** The server's away rule for `step` seconds of absence: income is scaled by the efficiency until the gap passes the cap, the timers run at full speed. */
	const tickAway = (step: number) => {
		const s = api();
		const lctx = ctx.limitCtx(s);
		const capSec = Math.min(HARD_LIMITS.offlineCapHours, limitOf('offlineCapHours', lctx)) * 3600;
		const eff = Math.min(HARD_LIMITS.offlineEfficiency, limitOf('offlineEfficiency', lctx));
		const gone = t - (awayStart ?? t);
		const paidShare = Math.min(1, Math.max(0, (capSec - gone) / step));
		const scale = eff * paidShare;
		const original = s.resourceRates;
		const scaled = { ...original, total: Object.fromEntries(Object.entries(original.total).map(([k, v]) => [k, (v as number) * scale])) } as typeof original;
		store.setState({ resourceRates: scaled });
		api().tick(step * 1000);
		// a timer that finished inside the step has recomputed the rates; keep those, restore ours otherwise
		if (api().resourceRates === scaled) store.setState({ resourceRates: original });
	};

	// ---- the loop ----------------------------------------------------------------------------------------------------
	let lastDecision = -1e9;
	let castleBusy = false;
	let castleIdleSince = 0;
	let wasActive = false;
	while (t < ctx.maxDays * 86400) {
		bot.t = t;
		const active = isActive(t);
		if (active && !wasActive) awayStart = null;
		if (!active && wasActive) awayStart = t;
		wasActive = active;

		const realAway = !!profile.away && !active;
		const fine = t - runStart < FINE_STEP_SEC;
		let step = active ? (fine ? 20 : PLAY_STEP_SEC) : AWAY_STEP_SEC;
		if (profile.windows.length > 0) step = Math.min(step, toHourEdge(t));
		// the end of a timer is the next thing that can change what the bot does
		const castleLeft = api().castleUpgrade?.remainingSec;
		if (castleLeft != null && castleLeft > 1) step = Math.min(step, castleLeft);
		for (const job of api().buildingUpgrades) if (job.remainingSec > 1) step = Math.min(step, job.remainingSec);
		// a person who only checks in every `decisionSec` has nothing to do in between: the step runs to the next visit, a fight spawn or a rock
		if (profile.human && active) step = Math.min(step, Math.max(20, lastDecision + profile.human.decisionSec - t));
		step = Math.max(1, Math.ceil(step));

		// Clicks during the step: rocks first (the player breaks what is on the map), the rest earn gold
		if (active && profile.cps > 0) {
			let n = Math.floor(profile.cps * step);
			if (profile.rocks && rocks.length > 0) n = mineRocks(n, step);
			clickGold(paidClicks(n, step));
		}
		if (realAway) tickAway(step);
		else api().tick(step * 1000);
		t += step;
		bot.t = t;

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
		if (profile.rocks && active) spawnRocks();

		const decisionGap = profile.human ? profile.human.decisionSec : step;
		// a bot that plays by the away rules buys nothing while away; the others decide at every step as the old sim did
		const mayDecide = profile.human || profile.away ? active : true;
		if (t - lastDecision >= decisionGap && mayDecide) {
			lastDecision = t;
			decide(active);
			const lvl = api().level.level;
			LEVEL_MARKS.forEach((n) => lvl >= n && milestones[`level${n}`] == null && (milestones[`level${n}`] = t / 86400));
			SNAPSHOTS_H.forEach((h) => {
				if (t >= h * 3600 && milestones[`lvl@${h}h`] == null) {
					milestones[`lvl@${h}h`] = lvl;
					milestones[`xp@${h}h`] = api().resources.xp;
				}
			});
			if (finished()) bot.mark('finished', t);
			const castleNow = castleLevelNow();
			maybeRebirth(castleNow);
			const totalRebirths = profile.rebirthAtCastle ? (profile.rebirths ?? 1) : 0;
			if (totalRebirths > 0) {
				const lastRunDone = profile.endAtCastle10 ? `r${run}.castle${cfg.CASTLE_UPGRADE.maxLevel}` : `r${run}.finished`;
				if (run > totalRebirths && milestones[lastRunDone] != null) break;
			} else if (castleNow >= cfg.CASTLE_UPGRADE.maxLevel) {
				bot.mark(`castle${cfg.CASTLE_UPGRADE.maxLevel}`, t);
				break;
			}
		}
	}
	return { milestones, magnitudes: mag, tileWaits };
};
