/**
 * Gives ONE throwaway development account a fresh mid-game world (land, a castle upgrade, a few producer and extractor buildings, a little progress), so the windows can be tried by hand. Unlike `seed-rehearsal` it does not need the
 * pre-flip state: the profile is never touched, so an account that has been through a new chapter works too.
 *
 *   npm run seed-dev-world -- --user <uuid> --expect-email <address>          DRY RUN: checks the account, builds the world, prints counts, writes nothing
 *   npm run seed-dev-world -- --user <uuid> --expect-email <address> --yes    backs the account up (`backups/seed-dev-world-<time>.json`), wipes its game data, writes the new world through the server's own save path
 *
 * Undo with `npm run seed-rehearsal -- --restore <backup file> --user <uuid> --expect-email <address> --yes` (the backup format is the same). Output is counts and words only. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: they decide which project is touched.
 * Operator tooling: run by hand, never by the app or CI.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { BUILDINGS } from '../src/catalog/buildings';
import { MONSTER_CATALOG } from '../src/catalog/monsters';
import { TUTORIAL_PATH } from '../src/catalog/tutorial';
import { CASTLE_X, CASTLE_Y } from '../src/config/castle';
import { supabaseSaveRepo } from '../src/lib/cloudSave/supabaseRepo';
import { summarize } from '../src/lib/cloudSave/summary';
import { newLedger, type Ledger } from '../src/lib/offline/ledger';
import { writePlayerReset } from '../src/lib/offline/season';
import { emptyStats, recordEncounter, recordKill } from '../src/lib/offline/stats';
import { supabaseAchievementRepo, supabaseLedgerRepo } from '../src/lib/offline/supabaseLedger';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { encodeSave } from '../src/lib/saveFormat';
import { withDone } from '../src/lib/tutorial/engine';
import { forEachOwned, ownedCount } from '../src/utils/world';
import { BACKUP_TABLES, applySeed, dumpCounts, type AccountDump, type SeedPlan } from './lib/rehearsalSeed';
import { api, growTo, patchTileAt, setResources } from '../tests/helpers';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const execute = args.includes('--yes');
const userId = option('--user');
const expectEmail = option('--expect-email');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(resolve(process.cwd(), file));
	} catch {
		/* the environment may already have the variables */
	}
}

const stop = (message: string): never => {
	console.error(message);
	process.exit(1);
};
if (!userId || !UUID.test(userId)) stop('--user <uuid> is required: refusing to run.');
if (!expectEmail) stop('--expect-email <address> is required: refusing to run.');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) stop('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (environment or .env.local).');
const db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
const id = userId!;

/** The world: a new game grown to a mid-size territory, the castle upgraded, one producer and one extractor of each home biome that the land has (up to 7 buildings), a modest purse. */
const buildWorld = (nowMs: number): SeedPlan & { built: string[] } => {
	api().resetGame();
	growTo(70);
	patchTileAt(CASTLE_X, CASTLE_Y, { level: 3 });
	const built: string[] = [];
	const free = (biome: string): [number, number] | null => {
		let found: [number, number] | null = null;
		forEachOwned(api().tiles, (tile, x, y) => {
			if (!found && tile.biome === biome && !tile.building && !(x === CASTLE_X && y === CASTLE_Y)) found = [x, y];
		});
		return found;
	};
	for (const def of BUILDINGS.filter((b) => b.kind !== 'idol')) {
		if (built.length >= 7) break;
		const at = free(def.biome);
		if (!at) continue;
		setResources({ gold: 1e9, wood: 1e9, stone: 1e9, coal: 1e9, food: 1e9, hide: 1e9, xp: api().resources.xp });
		if (api().buildBuilding(at[0], at[1], def.id)) built.push(def.id);
	}
	if (built.length < 3) throw new Error('the land has fewer than three buildable biomes: run again (the map is random)');
	setResources({ gold: 25_000, wood: 4000, stone: 3000, coal: 800, food: 5000, hide: 300, xp: api().resources.xp });
	api().tick(1000);
	const persisted = pickPersisted(api());
	const after = summarize(structuredClone(persisted));

	let stats = emptyStats();
	MONSTER_CATALOG.filter((m) => !m.placeholder)
		.slice(0, 4)
		.forEach((m, i) => {
			stats = recordEncounter(stats, m.id, nowMs - (i + 1) * 3_600_000);
			for (let n = 0; n < 3 + i; n++) stats = recordKill(stats, { type: m.id, lucky: false, boss: false });
		});
	let tutorial = stats.tutorial;
	for (const step of TUTORIAL_PATH.slice(0, 3)) tutorial = withDone(tutorial, step.id);
	stats = { ...stats, tutorial, achievements: ['first_tile', 'first_fight'], chests: 2 };
	const ledger: Ledger = { ...newLedger(nowMs, 0), gems: 500, stats };
	return { saveText: encodeSave(persisted, nowMs), ledger, achievements: ['first_tile', 'first_fight'], before: after, after, built };
};

const dumpAccount = async (): Promise<AccountDump> => {
	const dump: AccountDump = {};
	for (const { table, column } of BACKUP_TABLES) {
		const { data, error } = await db.from(table).select('*').eq(column, id);
		if (error) stop(`read ${table}: the database refused (details withheld)`);
		dump[table] = (data ?? []) as Record<string, unknown>[];
	}
	return dump;
};

const run = async (): Promise<void> => {
	const { data: user, error } = await db.auth.admin.getUserById(id);
	if (error || !user?.user) stop('no such account in this project.');
	if ((user.user!.email ?? '').toLowerCase() !== expectEmail!.toLowerCase()) stop('refused: the account e-mail is not the one given with --expect-email.');
	const dump = await dumpAccount();
	if (!dump.profiles[0]) stop('refused: the account has no profile (it never signed in).');
	console.log(`${execute ? 'SEEDING' : 'DRY RUN (nothing is written)'}: account matches. Rows now: ${dumpCounts(dump)}.`);

	const now = Date.now();
	const plan = buildWorld(now);
	console.log(
		`Would write: 1 save (${ownedCount(api().tiles)} tiles, castle 3, ${plan.built.length} buildings: ${plan.built.join(', ')}), 1 ledger (gems 500, discovered monsters, tutorial started), ${plan.achievements.length} achievements.`,
	);
	if (!execute) return void console.log('\nNothing changed. Re-run with --yes to apply.');

	mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
	const file = resolve(process.cwd(), 'backups', `seed-dev-world-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	writeFileSync(file, JSON.stringify({ kind: 'seed-rehearsal-backup', userId: id, at: new Date().toISOString(), tables: dump }));
	console.log(`\nBackup written: ${file}`);

	const wipe = spawnSync(
		process.execPath,
		['--import', 'tsx', 'scripts/reset-players.ts', '--user', id, '--hard', '--reset-gems', '--reset-stats', '--purge-history', '--no-backup', '--yes'],
		{ stdio: 'pipe', env: process.env },
	);
	if (wipe.status !== 0) stop('the wipe failed (details withheld). The backup is intact; nothing was seeded.');
	console.log("Wiped the account's game data.");

	const repos = { saves: supabaseSaveRepo(db), ledgers: supabaseLedgerRepo(db), achievements: supabaseAchievementRepo(db) };
	const result = await applySeed(repos, id, String(dump.profiles[0].character_name ?? 'Dev'), plan, now).catch(() =>
		stop('the world was not written (details withheld). Restore with seed-rehearsal --restore <backup file>.'),
	);
	if (result.outcome.kind !== 'ok')
		stop(`the server did not accept the saved world (${result.outcome.kind}). Restore with seed-rehearsal --restore <backup file>.`);
	await writePlayerReset(db, id, now);
	console.log(`Done. Rows now: ${dumpCounts(await dumpAccount())}. Sign in: the browser loads the seeded world.`);
};

run().catch(() => {
	console.error('seed-dev-world stopped (details withheld).');
	process.exit(1);
});
