/**
 * Puts ONE throwaway account into a rebirthed mid-game state, fast, for the new chapter reset rehearsal (`docs/plan/new-chapter-release-runbook.md`, "Rehearsal seeding"). The dev console is gone and a real rebirth takes hours, so this writes the
 * state through the server's own save path instead (`scripts/lib/rehearsalSeed.ts` says what the account ends up holding). It reads and writes exactly one account and nothing else.
 *
 *   npm run seed-rehearsal -- --user <uuid> --expect-email <address>                 DRY RUN (the default): checks the account, prints what it would do as counts, writes nothing
 *   npm run seed-rehearsal -- --user <uuid> --expect-email <address> --yes           backs the account up to `backups/seed-rehearsal-<time>.json`, then seeds it
 *   npm run seed-rehearsal -- ... --yes --force-fresh                                 first wipes the account's game data (backup first, then the `reset-players` path with --hard), then seeds it
 *   npm run seed-rehearsal -- --restore <file> --user <uuid> --expect-email <address> [--yes]   puts the rows of a backup back (the account's current rows are backed up first)
 *
 * **Safety.** `--user` and `--expect-email` are both required. The run refuses unless the account's auth e-mail equals `--expect-email` (never printed) and its profile epoch is null (the pre-flip state the rehearsal needs; neither can be forced).
 * An account that already holds game data (a save, a leaderboard row, ledger progress, history, rebirth records, achievements), or looks like a real player (more than one rebirth, more than 400 tiles or 120 levels), is refused unless `--force-fresh` wipes it first.
 * Output is counts and words only: no e-mail, name, id or number out of a game, and no database error text. The profile is never written (the epoch stays null). The browser of the account is told to drop its local copy of an older game (`player_reset` marker),
 * so it loads the seeded one.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or the git-ignored `.env.local`): they decide which project is touched, so check them first. This is operator tooling: it is run by hand, never by the app or CI.
 *
 * @title Rehearsal seeding (seed-rehearsal)
 * @category Ops/Operator guides
 * @order 5
 * @see applySeed, judgeAccount
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { supabaseSaveRepo } from '../src/lib/cloudSave/supabaseRepo';
import { supabaseAchievementRepo, supabaseLedgerRepo } from '../src/lib/offline/supabaseLedger';
import { writePlayerReset } from '../src/lib/offline/season';
import { BACKUP_TABLES, REHEARSAL_SEED, applySeed, buildSeedGame, dumpCounts, judgeAccount, type AccountDump, type AccountFacts } from './lib/rehearsalSeed';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string): string | undefined => {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const value = args[i + 1];
	if (!value || value.startsWith('--')) {
		console.error(`${name} needs a value: refusing to run.`);
		process.exit(1);
	}
	return value;
};

const execute = flag('--yes');
const forceFresh = flag('--force-fresh');
const userId = option('--user');
const expectEmail = option('--expect-email');
const restoreFile = option('--restore');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(resolve(process.cwd(), file));
	} catch {
		/* file missing: fine, the environment may already have the variables */
	}
}

/** Stops the run with a reason made of words only (a database error text could name a row or an address). */
const stop = (message: string): never => {
	console.error(message);
	process.exit(1);
};
const fail = (what: string, error: { message: string } | null): void => {
	if (error) stop(`${what}: the database refused (details withheld)`);
};

if (!userId || !UUID.test(userId)) stop('--user <uuid> is required (the one throwaway account): refusing to run.');
if (!expectEmail) stop("--expect-email <address> is required (the throwaway account's e-mail): refusing to run.");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) stop('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (environment or .env.local).');
const db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
const id = userId!;

/** Reads every row the account has in `table` (`*`). */
const dumpTable = async (table: string, column: string): Promise<Record<string, unknown>[]> => {
	const { data, error } = await db.from(table).select('*').eq(column, id);
	fail(`read ${table}`, error);
	return (data ?? []) as Record<string, unknown>[];
};

const dumpAccount = async (): Promise<AccountDump> => {
	const dump: AccountDump = {};
	for (const { table, column } of BACKUP_TABLES) dump[table] = await dumpTable(table, column);
	return dump;
};

/** Writes the backup file (gitignored: it holds the account's data) and returns its path. */
const writeBackup = (dump: AccountDump, label: string): string => {
	mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
	const file = resolve(process.cwd(), 'backups', `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	writeFileSync(file, JSON.stringify({ kind: 'seed-rehearsal-backup', userId: id, at: new Date().toISOString(), tables: dump }));
	return file;
};

/** The throwaway check's facts, read with the service role (counts and flags: nothing is kept or printed). */
const readFacts = async (dump: AccountDump): Promise<AccountFacts> => {
	const { data: user, error } = await db.auth.admin.getUserById(id);
	if (error || !user?.user) stop('no such account in this project. Is SUPABASE_URL the right project?');
	const profile = dump.profiles[0];
	const save = dump.player_saves[0];
	const rank = dump.player_stats[0];
	const ledger = dump.player_ledger[0];
	const used = !!ledger && (Number(ledger.run_id) > 1 || ledger.stats != null || ledger.legacy != null || ledger.inv != null || ledger.combat != null);
	const headline = (row: Record<string, unknown> | undefined) =>
		row ? { rebirths: Number(row.rebirths) || 0, tilesOwned: Number(row.tiles_owned) || 0, level: Number(row.level) || 0 } : null;
	return {
		emailMatches: (user?.user?.email ?? '').toLowerCase() === expectEmail!.toLowerCase(),
		hasProfile: !!profile,
		profileEpoch: profile && typeof profile.epoch === 'number' ? profile.epoch : null,
		save: headline(save),
		rank: rank ? { ...(headline(rank) ?? { rebirths: 0, tilesOwned: 0, level: 0 }), trusted: rank.trusted === true } : null,
		ledgerUsed: used,
		historyRows: dump.save_history.length,
		rebirthRows: dump.rebirth_history.length,
		achievementRows: dump.player_achievements.length,
	};
};

/** Deletes the account's game rows (the order keeps the references happy: a save takes its map and leaderboard row with it). */
const clearRows = async (): Promise<void> => {
	for (const { table, column, restore } of [...BACKUP_TABLES].reverse()) {
		if (!restore) continue;
		const { error } = await db.from(table).delete().eq(column, id);
		fail(`clear ${table}`, error);
	}
};

const restoreFrom = async (file: string): Promise<void> => {
	let parsed: { kind?: string; userId?: string; tables?: AccountDump };
	try {
		parsed = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8'));
	} catch {
		return stop('the backup file could not be read.');
	}
	if (parsed.kind !== 'seed-rehearsal-backup' || !parsed.tables) stop('that file is not a seed-rehearsal backup.');
	if (parsed.userId !== id) stop('the backup belongs to a different account than --user: refusing.');
	const tables = parsed.tables!;
	const current = await dumpAccount();
	const verdict = judgeAccount(await readFacts(current), true);
	if (!verdict.ok) stop(`refused: ${verdict.reasons.join('; ')}`);
	console.log(`${execute ? 'RESTORE' : 'DRY RUN (nothing is written)'}: the account holds ${dumpCounts(current)}; the backup holds ${dumpCounts(tables)}.`);
	if (!execute) {
		console.log('Nothing changed. Re-run with --yes to put the backup back (the current rows are backed up first).');
		return;
	}
	console.log(`Current rows backed up: ${writeBackup(current, 'seed-rehearsal-before-restore')}`);
	await clearRows();
	for (const { table, restore } of BACKUP_TABLES) {
		if (!restore) continue;
		// `save_history.id` is generated by the database: a restored copy gets a new one
		const rows = (tables[table] ?? []).map((row) => (table === 'save_history' ? Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'id')) : row));
		if (!rows.length) continue;
		const { error } = await db.from(table).insert(rows);
		fail(`restore ${table}`, error);
	}
	await writePlayerReset(db, id, Date.now()); // the browser drops a local copy older than this, so it loads the restored game
	console.log(`Restored: ${dumpCounts(await dumpAccount())}.`);
};

/** The existing `reset-players` path for this one account (backed up already). Its own output names the account, so it is not shown. */
const wipe = (): void => {
	const result = spawnSync(
		process.execPath,
		['--import', 'tsx', 'scripts/reset-players.ts', '--user', id, '--hard', '--reset-gems', '--reset-stats', '--purge-history', '--no-backup', '--yes'],
		{ stdio: 'pipe', env: process.env },
	);
	if (result.status !== 0) stop('the wipe (reset-players for this account) failed, details withheld. The backup file is intact; nothing was seeded.');
};

const seed = async (): Promise<void> => {
	const dump = await dumpAccount();
	const facts = await readFacts(dump);
	const verdict = judgeAccount(facts, forceFresh);
	console.log(
		`${execute ? 'SEEDING' : 'DRY RUN (nothing is written)'}: account found, e-mail ${facts.emailMatches ? 'matches' : 'does NOT match'}, profile epoch ${facts.profileEpoch === null ? 'null' : 'set'}.`,
	);
	console.log(`Rows now: ${dumpCounts(dump)}.`);
	if (!verdict.ok) stop(`refused: ${verdict.reasons.join('; ')}`);
	if (verdict.needsWipe) console.log("--force-fresh: the account's game data is wiped first (backup, then the reset-players path for this account only).");

	const now = Date.now();
	const plan = buildSeedGame(now);
	console.log(
		`Would write: 1 save (${plan.after.tilesOwned} tiles, ${plan.after.rebirths} rebirth, level ${plan.after.level}) + its map and leaderboard row, 1 ledger (gems ${REHEARSAL_SEED.gems}, ${Object.keys(REHEARSAL_SEED.idols).length} Idol levels, ` +
			`${Object.keys(plan.ledger.stats.seen).length} discovered monster types, tutorial started), 1 rebirth record, ${plan.achievements.length} achievements. The profile is not touched.`,
	);
	if (!execute) {
		console.log('\nNothing changed. Re-run with --yes to apply.');
		return;
	}

	console.log(`\nBackup written: ${writeBackup(dump, 'seed-rehearsal')}`);
	if (verdict.needsWipe) {
		wipe();
		console.log("Wiped the account's game data.");
	}
	const { data: profile, error } = await db.from('profiles').select('character_name').eq('id', id).maybeSingle();
	fail('read the profile', error);
	const repos = { saves: supabaseSaveRepo(db), ledgers: supabaseLedgerRepo(db), achievements: supabaseAchievementRepo(db) };
	const result = await applySeed(repos, id, String(profile?.character_name ?? 'Rehearsal'), plan, now).catch(() =>
		stop('the seed was not written (details withheld). Restore with --restore <backup file> if the account looks half written.'),
	);
	if (result.outcome.kind !== 'ok') stop(`the server did not accept the seeded save (${result.outcome.kind}). Restore with --restore <backup file>.`);
	await writePlayerReset(db, id, now);

	const after = await dumpAccount();
	const saved = after.player_saves[0];
	console.log(
		`\nDone: revision ${String(saved?.rev)}, flags ${result.outcome.kind === 'ok' ? result.outcome.flags.length : '?'}, rebirth logged ${result.rebirthLogged ? 'yes' : 'no'}.`,
	);
	console.log(`Rows now: ${dumpCounts(after)}.`);
	console.log('Sign in as that account: the browser loads the seeded game from the account. Undo with --restore <the backup file above>.');
};

(restoreFile ? restoreFrom(restoreFile) : seed()).catch(() => {
	console.error('seed-rehearsal stopped (details withheld). Nothing is half-written that --restore <backup file> cannot undo.');
	process.exit(1);
});
