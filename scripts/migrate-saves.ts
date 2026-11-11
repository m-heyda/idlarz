/**
 * The tool for a release that cannot be additive: `npm run migrate-saves` runs the upgrade chain (`src/lib/saveUpgrade.ts` for saves, `src/lib/offline/ledgerUpgrade.ts` and the tolerant readers for ledger rows) over every
 * stored row and, with `--yes`, writes the result back. It is a TEMPLATE: it does nothing today because both chains are empty (every row is `current`); a release that bumps `SAVE_SCHEMA` or adds a ledger row step makes it do real work
 * with no change to this file. Run the dry run before and after the deploy; see the recipe in `docs/plan/save-compatibility.md`.
 *
 *   npm run migrate-saves                         DRY RUN (the default): reads everything, writes nothing, prints counts
 *   npm run migrate-saves -- --yes                really write the rows that need it (a backup comes first)
 *   npm run migrate-saves -- --user <uuid>        only this account (repeat for more): try it on one account before running it for everyone
 *   npm run migrate-saves -- --yes --no-backup    skip the backups (not recommended)
 *
 * **Safe to repeat (idempotent):** a row already in the current shape is `current` and is not touched, so a second run (or a run that stopped half way) finishes the job and then reports zero writes.
 * **Backups:** before a save row is rewritten its OLD body goes into `save_history` as a pinned copy flagged `migration_backup` (never trimmed; the same table and mechanism as the chapter archive), and everything that will be
 * rewritten is also dumped to `backups/migrate-<time>.json` (gitignored: it holds player data). To undo a row, put the history copy's `state` back (`schema`, `core`, and the map) by hand or with `restore-trust`'s approach.
 * **Writes are compare-and-swap:** a save row is updated only `where rev` is still the rev that was read, a ledger row only `where ver` is; a player who saved in between is skipped (and picked up by the next run). The map and the core are two tables,
 * so run this while few people are online; only a step that changes `land`/`extra` touches the map at all.
 * **Prints counts only**, never a name, an id or a number out of a game; a database error text is not printed either (it could name a row).
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or the git-ignored .env.local), the same as `check-live-saves` and `reset-players`: they decide which project is touched, so check them first.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { splitBody } from '../src/lib/cloudSave/pipeline';
import { MIGRATION_BACKUP_FLAG } from '../src/lib/cloudSave/supabaseRepo';
import { SAVE_SCHEMA } from '../src/lib/saveFormat';
import type { LedgerRow } from '../src/lib/offline/supabaseLedger';
import { countLedger, countSave, formatCounts, migrateLedger, migrateSave, newCounts, writes, type LedgerMigration, type SaveMigration } from './migrateSaves';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const users: string[] = [];
args.forEach((a, i) => {
	if (a === '--user' && args[i + 1]) users.push(args[i + 1]);
});
const execute = flag('--yes');
const backup = !flag('--no-backup');

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(resolve(process.cwd(), file));
	} catch {
		/* file missing: fine, the environment may already have the variables */
	}
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
	console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (environment or .env.local).');
	process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** A failure is reported without the text of the database error, which could name a row. */
const fail = (what: string, error: { message: string } | null): void => {
	if (error) {
		console.error(`${what}: the database refused (details withheld)`);
		process.exit(1);
	}
};

/** Pages through a table (PostgREST caps a response at 1000 rows). */
const fetchAll = async <T>(table: string, columns: string): Promise<T[]> => {
	const out: T[] = [];
	for (let from = 0; ; from += 1000) {
		let query = db
			.from(table)
			.select(columns)
			.order('user_id')
			.range(from, from + 999);
		if (users.length) query = query.in('user_id', users);
		const { data, error } = await query;
		fail(`read ${table}`, error);
		out.push(...((data ?? []) as T[]));
		if (!data || data.length < 1000) break;
	}
	return out;
};

interface SaveRow {
	user_id: string;
	rev: number;
	schema: number;
	core: Record<string, unknown>;
	world_hash: string;
	tiles_owned: number;
	flags: string[] | null;
	server_saved_at: string;
}
interface WorldRow {
	user_id: string;
	hash: string;
	land: unknown;
	extra: unknown;
	tiles: number;
}
type LedgerDbRow = LedgerRow & { user_id: string };

const LEDGER_COLUMNS =
	'user_id, ver, run_id, rebirths, anchor_at, reset_at, bank, ord_chest, ord_kill, granted, granted_seen, gems, last_key, last_result, combat, inv, craft, buffs, stats, legacy';

const run = async () => {
	console.log(
		`${execute ? 'WRITING' : 'DRY RUN (nothing is written)'}: schema ${SAVE_SCHEMA}${users.length ? `, ${users.length} account(s)` : ', every account'}\n`,
	);
	const counts = newCounts();
	const saveRows = await fetchAll<SaveRow>('player_saves', 'user_id, rev, schema, core, world_hash, tiles_owned, flags, server_saved_at');
	const worlds = new Map((await fetchAll<WorldRow>('player_worlds', 'user_id, hash, land, extra, tiles')).map((w) => [w.user_id, w]));
	const ledgerRows = await fetchAll<LedgerDbRow>('player_ledger', LEDGER_COLUMNS);

	const saveWork: { row: SaveRow; world: WorldRow; result: SaveMigration }[] = [];
	for (const row of saveRows) {
		const world = worlds.get(row.user_id);
		if (!world || world.hash !== row.world_hash) {
			countSave(counts, { outcome: 'unreadable', reason: 'the map does not match the save' });
			continue;
		}
		const result = migrateSave(row, world);
		countSave(counts, result);
		if (result.outcome === 'upgraded') saveWork.push({ row, world, result });
	}
	const ledgerWork: { row: LedgerDbRow; result: LedgerMigration }[] = [];
	for (const row of ledgerRows) {
		try {
			const result = migrateLedger(row);
			countLedger(counts, result);
			if (result.outcome !== 'current') ledgerWork.push({ row, result });
		} catch {
			countLedger(counts, 'unreadable');
		}
	}

	console.log(formatCounts(counts, execute));
	if (!execute) {
		console.log(writes(counts) ? '\nNothing changed. Re-run with --yes to apply.' : '\nNothing to do.');
		return;
	}
	if (!writes(counts)) {
		console.log('\nNothing to do.');
		return;
	}

	if (backup) {
		mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
		const file = resolve(process.cwd(), 'backups', `migrate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
		writeFileSync(file, JSON.stringify({ saves: saveWork.map((w) => ({ save: w.row, world: w.world })), ledgers: ledgerWork.map((w) => w.row) }));
		console.log(`\nBackup written: ${file}`);
	}

	let wrote = 0;
	let skipped = 0;
	for (const { row, world, result } of saveWork) {
		if (backup) {
			// the old body goes into the history first, pinned and flagged so no trimming ever drops it (the same row the chapter archive uses)
			const flags = [...new Set<string>([...(row.flags ?? []), MIGRATION_BACKUP_FLAG])];
			const state = { ...row.core, land: world.land, extra: world.extra };
			const updated = await db.from('save_history').update({ pinned: true, flags, state }).eq('user_id', row.user_id).eq('rev', row.rev).select('id');
			fail('backup', updated.error);
			if (!updated.data?.length) {
				const inserted = await db
					.from('save_history')
					.insert({ user_id: row.user_id, rev: row.rev, schema: row.schema, state, flags, server_saved_at: row.server_saved_at, pinned: true });
				fail('backup', inserted.error);
			}
		}
		const { core, world: nextWorld } = splitBody(result.body ?? {}, row.tiles_owned);
		if (nextWorld.hash !== world.hash) {
			const w = await db
				.from('player_worlds')
				.update({ hash: nextWorld.hash, land: nextWorld.land, extra: nextWorld.extra })
				.eq('user_id', row.user_id)
				.eq('hash', world.hash);
			fail('write the map', w.error);
		}
		// compare-and-swap on rev: a player who saved in between keeps their newer save and is picked up by the next run
		const saved = await db
			.from('player_saves')
			.update({ schema: result.schema, core, world_hash: nextWorld.hash })
			.eq('user_id', row.user_id)
			.eq('rev', row.rev)
			.select('rev');
		fail('write a save', saved.error);
		if (saved.data?.length) wrote++;
		else skipped++;
	}
	for (const { row, result } of ledgerWork) {
		if (!result.row) continue;
		const saved = await db
			.from('player_ledger')
			.update({ ...result.row, ver: row.ver + 1, updated_at: new Date().toISOString() })
			.eq('user_id', row.user_id)
			.eq('ver', row.ver)
			.select('ver');
		fail('write a ledger', saved.error);
		if (saved.data?.length) wrote++;
		else skipped++;
	}
	console.log(`\nDone: ${wrote} row(s) written, ${skipped} skipped because the player saved in between (run again to catch them).`);
};

run().catch(() => {
	console.error('migrate-saves stopped (details withheld). Nothing is half-written that a second run cannot finish.');
	process.exit(1);
});
