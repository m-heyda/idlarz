/**
 * Dry run of today's save rules against the REAL rows (IDL-12), before a release that tightens them (the epoch reset IDL-76, the enforcement IDL-208).
 *
 *   npm run check-live-saves
 *
 * For every player_saves row it runs the CURRENT code's `acceptSave` (decode, `sanitizeSave`, the XP / Ember / net-worth / `verify.ts` checks) in memory,
 * with the account's real player_ledger row, and for every pair of consecutive save_history copies it runs `verifyTransition`. It prints COUNTS and the
 * fixed reason texts of the code only: no names, no ids, no numbers out of a game. Read-only: it only SELECTs, nothing is written anywhere.
 *
 * Dev machine only. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or the git-ignored .env.local); neither is ever printed.
 * Check which project they point at first (the same rule as reset-players). See docs/plan/14-server-audit-and-data-plan.md section 6 and docs/ops/reset-players-cli.md.
 */
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { supabaseSaveRepo } from '../src/lib/cloudSave/supabaseRepo';
import { summarize, type SaveSummary } from '../src/lib/cloudSave/summary';
import type { Ledger } from '../src/lib/offline/ledger';
import { supabaseLedgerRepo } from '../src/lib/offline/supabaseLedger';
import { decodeSave, sealWire } from '../src/lib/saveFormat';
import { addLedger, addSave, addTransition, formatReport, judgeSave, judgeTransition, newReport } from './liveSavesReport';

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
const saves = supabaseSaveRepo(db);
const ledgers = supabaseLedgerRepo(db);

/** A failure is reported without the text of the database error, which could name a row. */
const die = (what: string): never => {
	console.error(`${what} failed (read-only run, nothing was changed).`);
	return process.exit(1);
};

/** Every user_id of a table (PostgREST caps a response at 1000 rows). */
const userIds = async (table: string): Promise<string[]> => {
	const out: string[] = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await db
			.from(table)
			.select('user_id')
			.order('user_id')
			.range(from, from + 999);
		if (error) die(`read ${table}`);
		out.push(...(data ?? []).map((row: { user_id: string }) => row.user_id));
		if (!data || data.length < 1000) break;
	}
	return out;
};

const run = async () => {
	const report = newReport();
	const saveIds = await userIds('player_saves');
	const saveSet = new Set(saveIds);

	for (const id of saveIds) {
		let stored;
		let ledger: Ledger | null = null;
		try {
			stored = await saves.load(id, { world: true });
			ledger = await ledgers.load(id);
		} catch {
			report.saves++;
			report.unreadable['the row could not be read'] = (report.unreadable['the row could not be read'] ?? 0) + 1;
			continue;
		}
		if (!stored) continue; // deleted while the script ran
		addSave(report, await judgeSave(stored, ledger));

		// consecutive history copies of this account, oldest first: the transition check on pairs that really happened
		const { data: history, error } = await db.from('save_history').select('schema, state, server_saved_at').eq('user_id', id).order('rev', { ascending: true });
		if (error) die('read save_history');
		let before: { summary: SaveSummary; serverSavedAt: number } | null = null;
		for (const row of history ?? []) {
			const at = Date.parse(row.server_saved_at as string);
			const decoded = decodeSave(sealWire({ v: row.schema as number, t: at, s: row.state }));
			if (!decoded.ok) {
				before = null;
				continue;
			}
			const snapshot = { summary: summarize(decoded.state), serverSavedAt: at };
			if (before) addTransition(report, judgeTransition(before, snapshot));
			before = snapshot;
		}
	}

	for (const id of await userIds('player_ledger')) {
		const ledger = await ledgers.load(id).catch(() => null);
		addLedger(report, saveSet.has(id), ledger?.inv != null);
	}
	console.log(formatReport(report));
};

run().catch(() => die('the check'));
