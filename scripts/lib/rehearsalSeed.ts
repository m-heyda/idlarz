/**
 * The pure part of `npm run seed-rehearsal` (`scripts/seed-rehearsal-account.ts`): builds the game, the ledger and the achievements that put ONE throwaway account into a rebirthed mid-game state, writes them through the
 * server's own save path, and decides whether an account may be seeded at all. No database client lives here: the storage is passed in (`SeedRepos`), so the unit test runs the whole thing against in-memory repos.
 *
 * **What the seeded account looks like**
 *
 * | Part | Where it lives | Value |
 * | --- | --- | --- |
 * | Rebirthed once | save (`prestige`), ledger (`rebirths`, `runId`), `rebirth_history` | the store's own `rebirth()` ran on a 400-tile castle-6 game, so Embers, the kit and the point conservation are the real ones |
 * | Mid-game map | save + world | `REHEARSAL_SEED.tiles` owned tiles after the rebirth, an Idol standing on a forest and a plains tile |
 * | Idols | ledger `legacy.idols` and the save's `idolLevels` | forest 3, plains 2 (the server's record and the claim agree, so nothing is cut back) |
 * | Gems | ledger `gems` (the server's balance) | 250, not the 1000 gift |
 * | Tutorial | ledger `stats.tutorial` | started, unfinished: the first two path steps and the intro done |
 * | Monsters | ledger `stats.kills`, `stats.seen` | three discovered types, a few kills each |
 * | Achievements | ledger `stats.achievements` and `player_achievements` | two (no gems are paid: the rows are written, not earned) |
 * | Profile epoch | `profiles.epoch` | **untouched** (null before the release flips `GAME_EPOCH`) |
 *
 * **Why it is accepted as a normal save.** The ledger row is written first (run 2, rebirths 1, the Idol record, the counters, the gems), then the save goes through {@link acceptSave} exactly as `POST /api/save` does it (revision 1 from base 0,
 * world hash, summary, leaderboard row, history copy), so the stored rows are the ones the server itself would have written, and the rebirth is logged with the server's own `rebirthRecordOf`. The game is long enough (`playSeconds`) that
 * the first-save Ember and XP bounds hold, so no flag is raised.
 *
 * @title Rehearsal seeding (the pure part)
 * @category Ops/Operator guides
 * @order 6
 * @see acceptSave, startNewChapter
 */
import { ACHIEVEMENTS } from '../../src/catalog/achievements';
import { MONSTER_CATALOG } from '../../src/catalog/monsters';
import { TUTORIAL_PATH } from '../../src/catalog/tutorial';
import { acceptSave, type SaveOutcome, type SaveRepo } from '../../src/lib/cloudSave/pipeline';
import { rebirthRecordOf } from '../../src/lib/cloudSave/rebirthHistory';
import { summarize } from '../../src/lib/cloudSave/summary';
import { newLedger, type Ledger, type LedgerRepo } from '../../src/lib/offline/ledger';
import type { AchievementRepo } from '../../src/lib/offline/achievements';
import { emptyStats, recordEncounter, recordKill } from '../../src/lib/offline/stats';
import { withDone } from '../../src/lib/tutorial/engine';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { REBIRTH } from '../../src/config/rebirth';
import { settleXp } from '../../src/lib/cloudSave/xpModel';
import { calculateLevel, reconcileCharacter } from '../../src/utils/game/character';
import { forEachOwned, ownedCount } from '../../src/utils/world';
import { api, growTo, patchTileAt, rebirthReadyGame, setResources, store } from '../../tests/helpers';

/** The numbers of the seeded state: one place, so the report, the test and the runbook say the same. */
export const REHEARSAL_SEED = {
	/** Idol levels by biome: also the ledger's trusted record (`legacy.idols`) */
	idols: { forest: 3, plains: 2 } as Record<string, number>,
	/** The gem balance (the starting gift is 1000, so a reset that "sets the gems to the gift" is visible) */
	gems: 250,
	/** Tiles owned after the rebirth (the game before it had 400) */
	tiles: 90,
	/** Total play time (s): above 4 hours per rebirth, which is what the server's first-save Ember bound asks for */
	playSeconds: 60_000,
	/** Rebirths done */
	rebirths: 1,
	/** Kills per monster type: the first catalog types, discovered then fought */
	kills: [4, 2, 1],
	/** The tutorial steps (of the starter path) that are done: it is started and not finished */
	tutorialSteps: 2,
	/** The achievements written (ids of the catalog) */
	achievements: ['first_tile', 'first_fight'],
};

/** Everything needed to write the account: the save text, the ledger that goes in before it, the achievements and the figures the report prints. */
export interface SeedPlan {
	saveText: string;
	ledger: Ledger;
	achievements: string[];
	/** The summaries of the run that ended and of the seeded game: the rebirth record is worked out from them */
	before: ReturnType<typeof summarize>;
	after: ReturnType<typeof summarize>;
}

/**
 * Builds the seeded game through the real store: a game that could rebirth (castle 6, 400 tiles), its play time raised, then the store's own `rebirth()`, then land bought until `REHEARSAL_SEED.tiles`
 * are owned and both Idols stand (placed through `buildBuilding`, so the cost and the rules are the game's), then their levels set. The map's biomes are random per run; the build keeps buying land until a forest and a plains tile exist.
 */
export const buildSeedGame = (nowMs: number, tutorialStepIds: readonly string[] = TUTORIAL_PATH.map((s) => s.id)): SeedPlan => {
	rebirthReadyGame();
	growTo(REBIRTH.minTiles + 10); // the starting ring is free land and does not count towards the 400 a rebirth asks for
	store.setState({ playSeconds: REHEARSAL_SEED.playSeconds } as never);
	const before = summarize(structuredClone(pickPersisted(api())));
	if (!api().rebirth()) throw new Error('the seed game could not rebirth');
	growTo(REHEARSAL_SEED.tiles);

	// both Idol biomes must be on the map: keep buying while one is missing
	const biomeTile = (biome: string): [number, number] | null => {
		let found: [number, number] | null = null;
		forEachOwned(api().tiles, (tile, x, y) => {
			if (!found && tile.biome === biome && !tile.building) found = [x, y];
		});
		return found;
	};
	let guard = 0;
	while (Object.keys(REHEARSAL_SEED.idols).some((b) => !biomeTile(b)) && guard++ < 300) growTo(ownedCount(api().tiles) + 8);
	for (const biome of Object.keys(REHEARSAL_SEED.idols)) {
		const at = biomeTile(biome);
		if (!at) throw new Error(`no ${biome} tile on the seed map`);
		setResources({ gold: 1e9, wood: 1e9, stone: 1e9, coal: 1e9, food: 1e9, hide: 1e9, xp: api().resources.xp });
		if (!api().buildBuilding(at[0], at[1], `idol_${biome}`)) throw new Error(`the ${biome} Idol could not be built`);
		patchTileAt(at[0], at[1], { buildingLevel: REHEARSAL_SEED.idols[biome] });
	}
	// the building money was a cheat: the save holds a modest purse, and the gem balance the ledger will hold (a save can never raise it)
	setResources({ gold: 5000, wood: 0, stone: 0, coal: 0, food: 0, hide: 0, xp: api().resources.xp });
	store.setState({ idolLevels: { ...REHEARSAL_SEED.idols }, gems: REHEARSAL_SEED.gems } as never);
	api().tick(1000); // derived values (rates) follow the finished map
	// the XP of the 410-tile game before the rebirth is more than 90 tiles and the play time explain to a server that has no earlier save to judge by: keep what it can explain (the same bound `acceptSave` applies to a first save)
	const verdict = settleXp(null, summarize(structuredClone(pickPersisted(api()))), nowMs);
	if (verdict.clamped) {
		const s = api();
		store.setState({
			resources: { ...s.resources, xp: verdict.xp },
			level: calculateLevel(verdict.xp),
			characterStats: reconcileCharacter(s.characterStats, verdict.xp),
		} as never);
	}

	const persisted = pickPersisted(api());
	const saveText = encodeSave(persisted, nowMs);
	const after = summarize(structuredClone(persisted));

	let stats = emptyStats();
	const monsters = MONSTER_CATALOG.filter((m) => !m.placeholder).slice(0, REHEARSAL_SEED.kills.length);
	monsters.forEach((m, i) => {
		stats = recordEncounter(stats, m.id, nowMs - (i + 1) * 3_600_000);
		for (let n = 0; n < REHEARSAL_SEED.kills[i]; n++) stats = recordKill(stats, { type: m.id, lucky: false, boss: false });
	});
	let tutorial = stats.tutorial;
	for (const id of tutorialStepIds.slice(0, REHEARSAL_SEED.tutorialSteps)) tutorial = withDone(tutorial, id);
	stats = { ...stats, tutorial, achievements: [...REHEARSAL_SEED.achievements], chests: 3 };

	const ledger: Ledger = {
		...newLedger(nowMs, REHEARSAL_SEED.rebirths),
		runId: 1 + REHEARSAL_SEED.rebirths,
		gems: REHEARSAL_SEED.gems,
		stats,
		legacy: { idols: { ...REHEARSAL_SEED.idols } },
	};
	for (const id of REHEARSAL_SEED.achievements) if (!ACHIEVEMENTS.some((a) => a.id === id)) throw new Error(`unknown achievement ${id}`);
	return { saveText, ledger, achievements: [...REHEARSAL_SEED.achievements], before, after };
};

/** The storage the seed writes to: the server's own repos (Supabase in the script, Maps in the test). */
export interface SeedRepos {
	saves: SaveRepo;
	ledgers: LedgerRepo;
	achievements: AchievementRepo;
}

export interface SeedResult {
	outcome: SaveOutcome;
	rebirthLogged: boolean;
}

/**
 * Writes the plan: the ledger first (compare-and-swap on the version it has now: 0 = no row yet), then the save through {@link acceptSave} as a first save (base revision 0), then the rebirth record and the achievement rows.
 * Refuses (throws) when the account already has a save: this tool only ever seeds an empty game; a wipe is the caller's job (`--force-fresh`).
 */
export const applySeed = async (repos: SeedRepos, userId: string, displayName: string, plan: SeedPlan, nowMs: number): Promise<SeedResult> => {
	if (await repos.saves.load(userId)) throw new Error('the account already has a save: wipe it first');
	const existing = await repos.ledgers.load(userId);
	const ledger: Ledger = {
		...plan.ledger,
		ver: (existing?.ver ?? 0) + 1,
		runId: Math.max(plan.ledger.runId, (existing?.runId ?? 0) + 1),
		// the season marker compares this with `last_reset`: a ledger "reset now" is never reset again at the next login
		resetAt: nowMs,
		anchorAt: nowMs,
	};
	if (!(await repos.ledgers.commit(userId, existing?.ver ?? 0, ledger))) throw new Error('the ledger changed while seeding: run again');

	const outcome = await acceptSave(repos.saves, userId, displayName, plan.saveText, 0, nowMs, false, repos.ledgers);
	if (outcome.kind !== 'ok') return { outcome, rebirthLogged: false };

	let rebirthLogged = false;
	const record = rebirthRecordOf(plan.before, plan.after, nowMs);
	if (record && repos.saves.recordRebirth) {
		await repos.saves.recordRebirth(userId, record);
		rebirthLogged = true;
	}
	await repos.achievements.record(userId, plan.achievements, nowMs);
	return { outcome, rebirthLogged };
};

/** What the throwaway check needs to know about an account (counts and flags only: no name, no e-mail, no number out of a game). */
export interface AccountFacts {
	/** The account's auth e-mail equals `--expect-email` (case-insensitive), compared by the caller */
	emailMatches: boolean;
	hasProfile: boolean;
	profileEpoch: number | null;
	/** The stored save's headline numbers, when there is one */
	save: { rebirths: number; tilesOwned: number; level: number } | null;
	/** The leaderboard row, when there is one */
	rank: { rebirths: number; tilesOwned: number; level: number; trusted: boolean } | null;
	/** Rows that hold game data apart from the save: any of them makes the account "not empty" */
	ledgerUsed: boolean;
	historyRows: number;
	rebirthRows: number;
	achievementRows: number;
}

/** The most a throwaway account may hold before it is taken for a real player: the seeded state itself fits well under it. */
export const REAL_PLAYER_BAR = { rebirths: 1, tiles: 400, level: 120 };

export interface Verdict {
	/** The account may be seeded (after a wipe, when `needsWipe`) */
	ok: boolean;
	/** Needs `--force-fresh`: it holds game data that would be in the way */
	needsWipe: boolean;
	/** Why not (or why a wipe is needed), in words with no personal data */
	reasons: string[];
}

/**
 * The throwaway check. Two things refuse the account for good, with or without `--force-fresh`: the e-mail is not the one given and the profile's epoch is not null (it is the PRE-flip state the rehearsal needs; an account on an epoch has been through the new chapter).
 * An account with game data in the way needs `--force-fresh` (a wipe through `reset-players`, backed up first); one that also LOOKS like a real player (more than one rebirth, more than `REAL_PLAYER_BAR` tiles or levels, in the save or on the leaderboard) is called out as such in the reasons.
 */
export const judgeAccount = (facts: AccountFacts, forceFresh: boolean): Verdict => {
	const reasons: string[] = [];
	if (!facts.emailMatches) reasons.push('the account e-mail is not the one given with --expect-email');
	if (!facts.hasProfile) reasons.push('the account has no profile (it never signed in)');
	else if (facts.profileEpoch !== null)
		reasons.push('the profile epoch is not null: this account has been through a new chapter, it is not the pre-flip state');
	if (reasons.length) return { ok: false, needsWipe: false, reasons };

	const dirty: string[] = [];
	if (facts.save) dirty.push('it has a save');
	if (facts.rank) dirty.push('it has a leaderboard row');
	if (facts.ledgerUsed) dirty.push('its ledger holds progress');
	if (facts.historyRows) dirty.push(`${facts.historyRows} history copy/copies`);
	if (facts.rebirthRows) dirty.push(`${facts.rebirthRows} rebirth record(s)`);
	if (facts.achievementRows) dirty.push(`${facts.achievementRows} achievement(s)`);
	const real = [facts.save, facts.rank].some(
		(s) => s && (s.rebirths > REAL_PLAYER_BAR.rebirths || s.tilesOwned > REAL_PLAYER_BAR.tiles || s.level > REAL_PLAYER_BAR.level),
	);
	if (real) dirty.push('it looks like a real player (more than the seeded state)');
	if (!dirty.length) return { ok: true, needsWipe: false, reasons: [] };
	return {
		ok: forceFresh,
		needsWipe: true,
		reasons: [`not an empty account: ${dirty.join(', ')}${forceFresh ? '' : ' (add --force-fresh to wipe it first)'}`],
	};
};

/** The rows of one account as a backup holds them: table name to rows. */
export type AccountDump = Record<string, Record<string, unknown>[]>;

/** The tables a backup covers, in the order a restore writes them (a save before its map and leaderboard row: they reference it) and the column that holds the account id. */
export const BACKUP_TABLES: readonly { table: string; column: string; restore: boolean }[] = [
	{ table: 'player_saves', column: 'user_id', restore: true },
	{ table: 'player_worlds', column: 'user_id', restore: true },
	{ table: 'player_stats', column: 'user_id', restore: true },
	{ table: 'player_ledger', column: 'user_id', restore: true },
	{ table: 'rebirth_history', column: 'user_id', restore: true },
	{ table: 'save_history', column: 'user_id', restore: true },
	{ table: 'player_achievements', column: 'user_id', restore: true },
	// the profile is never written by the seed (the epoch stays null): it is in the backup for the record and left alone by a restore
	{ table: 'profiles', column: 'id', restore: false },
];

/** What the dry run prints: row counts per table, never a value. */
export const dumpCounts = (dump: AccountDump): string => BACKUP_TABLES.map(({ table }) => `${table} ${dump[table]?.length ?? 0}`).join(', ');
