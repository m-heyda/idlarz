/**
 * The player profiles of the pace sim, as plain data. A profile says **who plays** (clicks per second, the hours of the day, how it spends) and **what it buys** (the Ember plan, the merchant's gold upgrades,
 * the Gem shop); `scripts/pace/run.ts` turns it into a run of the real store. A profile with `localOnly` is not in the default run, `--list`, the CI shards, the merge or `docs/generated`.
 *
 * | Group | Profiles |
 * | --- | --- |
 * | Reference bots | `idle`, `casual`, `hardcore`, `autoclicker` (24 h of perfect play, an upper bound) |
 * | One-run and rebirth bots | `hardcore-rebirth6`, `hardcore-rebirth10`, `hardcore-rebirth6-x10` (ten runs, fits the level anchors) |
 * | The owner's pace | `human`, `human-rebirth6`, `human-rebirth8`: one click a second, 8-9, 12-13 and 18-23, a visit once an hour, at most 8 tiles per visit, never sells surplus |
 * | The shop | `human-rebirth6-builder2` (Builder #2 bought on day 0), `human-rebirth6-gems` (Builder #2 bought when the daily bonus has paid 1000 gems), `human-rebirth6-economy`, `human-rebirth6-full` (the Ember plans) |
 * | The clicker | `hardcore-clicker`: 300 clicks a minute (the limiter's maximum) for 10 h a day, Click Mastery first, gold traded for every missing resource so tiles come before the castle, ten rebirths at castle 6 |
 * | Rocks | `hardcore-rebirth6-rocks`: the hardcore bot that also mines the rocks |
 * | Local probes | `maximized` (everything bought, rebirth at the highest castle the shop allows, 15 rebirths: how fast the numbers run away), the `max-*` optimisers and the long `x20` / `x10` runs: `npm run pace:local` |
 *
 * @title The pace profiles
 * @category Pacing/The sim
 * @order 3
 */
import type { EmberUpgradeId } from '../../src/config/rebirth';

/**
 * How a bot spends its Embers. `starter` is the old default (Master Builders first, then Thrift, Click Mastery and Provisions level by level in step);
 * every other plan is a strict priority list: each upgrade is bought up to its maximum before the next one.
 */
export type EmberPlan = 'starter' | 'time' | 'economy' | 'full' | 'maximized' | 'clicker';

/** The strict lists behind the Ember plans (`starter` is not a list: see `spendEmbers` in `scripts/pace/policies.ts`). */
export const EMBER_PLANS: Record<Exclude<EmberPlan, 'starter'>, readonly EmberUpgradeId[]> = {
	// the clicker: Click Mastery first (+50 % gold per click per level), then the cheap tile and time upgrades
	clicker: ['mastery', 'builders', 'thrift', 'provisions', 'startgold', 'overseer'],
	// time first: Master Builders, then the cheap tile and click upgrades
	time: ['builders', 'thrift', 'provisions', 'mastery'],
	// income first: what raises every resource, then what makes tiles and buildings cheaper
	economy: ['builders', 'thrift', 'overseer', 'mastery', 'startgold', 'provisions', 'buildtime', 'tithe', 'steward'],
	// the maximized run: everything that pays, in the order it pays back, the end-game caps last
	maximized: [
		'builders',
		'thrift',
		'mastery',
		'provisions',
		'overseer',
		'startgold',
		'buildtime',
		'idoltime',
		'tithe',
		'haggler',
		'skinner',
		'steward',
		'nightwatch',
		'charter',
		'extrabuilder',
		'miningpower',
		'buildcap',
		'vigil',
		'castlecap',
		'decree',
		'deeppockets',
		'idolcap',
	],
	// everything that shortens or feeds the next run, cheapest first, then the one-time purchases and the caps
	full: [
		'builders',
		'thrift',
		'mastery',
		'provisions',
		'overseer',
		'startgold',
		'buildtime',
		'idoltime',
		'steward',
		'nightwatch',
		'tithe',
		'charter',
		'extrabuilder',
		'vigil',
		'miningpower',
		'castlecap',
		'buildcap',
	],
};

export interface Profile {
	/** Tiles come before the castle: the bot buys the next tile (trading gold for whatever resource is short) even when it eats what the next castle level needs */
	tilesFirst?: boolean;
	/** Rebirth when the castle reaches the highest level the Ember shop allows right now (10, then up to 15 with Castle Expansion) instead of a fixed level: the maximized run */
	rebirthAtMaxCastle?: boolean;
	/** Intended clicks per second while active */
	cps: number;
	/** Hours of the day the player is actively playing */
	windows: [number, number][];
	/** Rebirth as soon as the castle reaches this level (and keep playing the next run) */
	rebirthAtCastle?: number;
	/** How many rebirths to simulate (default 1 when `rebirthAtCastle` is set) */
	rebirths?: number;
	/** Rebirth at the castle level of this list, one entry per rebirth (the last entry repeats) instead of the fixed `rebirthAtCastle` (which still has to be set, to the first entry) */
	rebirthSchedule?: number[];
	/** Spend gold on the merchant's economy upgrades as soon as the gold on hand is twice the price (an optimiser; the other bots never buy them) */
	buyMerchant?: boolean;
	/** The Ember shop plan (default `starter`) */
	emberPlan?: EmberPlan;
	/** The Gem shop: `none` (no gems, one builder), `day0` (Builder #2 bought before the run starts), `daily` (the daily bonus pays gems, Builder #2 is bought at its price) */
	gems?: 'none' | 'day0' | 'daily';
	/** Mine the rocks that appear (one per 15 minutes, room for one per 50 tiles) with the clicks that would otherwise earn gold */
	rocks?: boolean;
	/** After the last rebirth keep playing the final run until the castle reaches its top level (the `max-*` probes) */
	endAtCastle10?: boolean;
	/** A local probe: not in the default run, not in `--list`, the CI shards or the docs; run it by name; it never writes docs/generated */
	localOnly?: boolean;
	/** A person, not a script: decides only this often while playing, buys at most `tilesPerVisit` tiles per visit, keeps `hoard` x what it might need */
	human?: { decisionSec: number; hoard: number; tilesPerVisit: number };
	/** Fight a normal monster and the boss the way the server's auto-battle does (see `GEAR_SCHEDULE` in `scripts/pace/run.ts`) */
	combat?: boolean;
	/**
	 * Play by the away rules of the server: outside the playing hours the kingdom pays `offlineEfficiency` (50 %, more with the Steward) of its income for at most `offlineCapHours` (8 h, more with Night Watch)
	 * and the player buys nothing. The reference bots leave it off (the game is open all day, as when the baseline was set); the `human*` profiles turn it on.
	 */
	away?: boolean;
	/** Hour of the day the game starts at (a new player starts playing at once; the bots start at midnight) */
	startHour?: number;
}

export const HARDCORE_WINDOWS: [number, number][] = [
	[7, 9],
	[12, 13],
	[18, 23],
];
export const HUMAN_WINDOWS: [number, number][] = [
	[8, 9],
	[12, 13],
	[18, 23],
];

// PACE_DECISION / PACE_HOARD / PACE_TILES: calibration knobs (docs/reference/pacing.md: a person who checks in hourly while playing, buys a few tiles per visit and never sells surplus; calibrated to the owner)
const HUMAN = {
	decisionSec: Number(process.env.PACE_DECISION ?? 3600),
	hoard: Number(process.env.PACE_HOARD ?? 1e9),
	tilesPerVisit: Number(process.env.PACE_TILES ?? 8),
};

const HUMAN_PLAYER = { cps: 1, windows: HUMAN_WINDOWS, human: HUMAN, combat: true, away: true, startHour: 18 } satisfies Profile;
/** The super-hardcore optimiser every `max-*` profile starts from: the hardcore schedule, merchant gold upgrades, the time-first Ember plan and the last run played on to castle 10 */
const MAX_PLAYER = { cps: 4, windows: HARDCORE_WINDOWS, buyMerchant: true, emberPlan: 'time', endAtCastle10: true, localOnly: true } satisfies Profile;

export const PROFILES: Record<string, Profile> = {
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
	human: { ...HUMAN_PLAYER },
	'human-rebirth6': { ...HUMAN_PLAYER, rebirthAtCastle: 6, rebirths: 5 },
	'human-rebirth8': { ...HUMAN_PLAYER, rebirthAtCastle: 8, rebirths: 4 },
	// the clicker: 300 clicks a minute (the limiter's sustained maximum, 5 a second) for 10 h a day, click power and Click Mastery first, gold traded for every missing resource to buy tiles ahead of the castle, rebirth at castle 6
	'hardcore-clicker': {
		cps: 5,
		windows: [
			[7, 9],
			[12, 13],
			[17, 24],
		],
		emberPlan: 'clicker',
		buyMerchant: true,
		tilesFirst: true,
		rebirthAtCastle: 6,
		rebirths: 10,
	},
	// the shop: what Builder #2 (two upgrades at once) and each Ember plan do to the pace of a person who rebirths at castle 6
	'human-rebirth6-builder2': { ...HUMAN_PLAYER, rebirthAtCastle: 6, rebirths: 5, gems: 'day0' },
	'human-rebirth6-gems': { ...HUMAN_PLAYER, rebirthAtCastle: 6, rebirths: 5, gems: 'daily' },
	'human-rebirth6-economy': { ...HUMAN_PLAYER, rebirthAtCastle: 6, rebirths: 5, emberPlan: 'economy', buyMerchant: true },
	'human-rebirth6-full': { ...HUMAN_PLAYER, rebirthAtCastle: 6, rebirths: 5, emberPlan: 'full', buyMerchant: true, gems: 'day0', rocks: true },
	// the same hardcore player with rocks mined: what the rock clicks cost the gold clicks, and what the stone and coal pay back
	'hardcore-rebirth6-rocks': { cps: 4, windows: HARDCORE_WINDOWS, rebirthAtCastle: 6, rebirths: 3, rocks: true },
	// the maximized run (`npm run pace:local`): a dedicated player who buys everything that pays (merchant gold upgrades, the whole Ember shop in the `maximized` order, Builder #2, rocks, every building level the castle allows),
	// rebirths at the highest castle level the shop allows and keeps going for 15 rebirths: how fast the numbers run away, how many tiles and how much income the map holds, and what each rebirth pays
	maximized: {
		cps: 4,
		windows: HARDCORE_WINDOWS,
		buyMerchant: true,
		emberPlan: 'maximized',
		gems: 'day0',
		rocks: true,
		rebirthAtMaxCastle: true,
		rebirthAtCastle: 10,
		rebirths: 15,
		localOnly: true,
	},
	// the long-game probes: twenty rebirths at castle 6 (what an optimiser does past rebirth 10), and ten at castle 8 (is a later rebirth worth more Embers per day than an early one, run after run)
	'hardcore-rebirth6-x20': { cps: 4, windows: HARDCORE_WINDOWS, rebirthAtCastle: 6, rebirths: 20, localOnly: true },
	'hardcore-rebirth8-x10': { cps: 4, windows: HARDCORE_WINDOWS, rebirthAtCastle: 8, rebirths: 10, localOnly: true },
	// the super-hardcore optimisers (`npm run pace:local`): how many Embers a day the best plan can make and when rebirth 10 and a castle 10 on it come
	'max-r6': { ...MAX_PLAYER, rebirthAtCastle: 6, rebirths: 10 },
	'max-r8': { ...MAX_PLAYER, rebirthAtCastle: 8, rebirths: 10 },
	'max-r10': { ...MAX_PLAYER, rebirthAtCastle: 10, rebirths: 10 },
	'max-r6-then-r8': { ...MAX_PLAYER, rebirthAtCastle: 6, rebirthSchedule: [6, 8], rebirths: 10 },
	'max-r8-then-r10': { ...MAX_PLAYER, rebirthAtCastle: 8, rebirthSchedule: [8, 10], rebirths: 10 },
	'max-ramp': { ...MAX_PLAYER, rebirthAtCastle: 6, rebirthSchedule: [6, 6, 8, 8, 10], rebirths: 10 },
};

/** The profiles the default run, the CI shards and the docs cover */
export const sharedProfiles = (): string[] => Object.keys(PROFILES).filter((n) => !PROFILES[n].localOnly);
/** The local-only probes */
export const localProfiles = (): string[] => Object.keys(PROFILES).filter((n) => PROFILES[n].localOnly);
