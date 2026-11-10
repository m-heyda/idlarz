/**
 * The way back for a false-positive flag (IDL-209): `npm run restore-trust -- --user <uuid>` is a DRY RUN that shows what the account's save carries;
 * add `--yes` to really give the account its trust back ({@link restoreTrust}: flags cleared, ranking eligibility back, the income paid from the
 * stored game's own rates again). The save it replaces is pinned in `save_history` first, and one JSON audit line is printed (`event: 'trust_restored'`);
 * keep it with the ticket. Running it twice is safe (the second run says `already_trusted`).
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or the git-ignored .env.local); check which project they point at first (same rule as
 * reset-players). One account per run, on purpose. Judge the account BEFORE you restore it: if its claimed land is still worth more than the game could
 * have paid, the next save flags it again.
 *
 * @title Giving a flagged account its trust back (restore-trust)
 * @category Ops/Operator guides
 * @order 3
 * @see restoreTrust
 */
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { supabaseSaveRepo } from '../src/lib/cloudSave/supabaseRepo';
import { restoreTrust } from '../src/lib/cloudSave/restoreTrust';

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(resolve(process.cwd(), file));
	} catch {
		/* file missing: fine, the environment may already have the variables */
	}
}

const args = process.argv.slice(2);
const userAt = args.indexOf('--user');
const userId = userAt >= 0 ? args[userAt + 1] : undefined;
const apply = args.includes('--yes');
if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
	console.error('Usage: npm run restore-trust -- --user <uuid> [--yes]   (without --yes: dry run)');
	process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
	console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (environment or .env.local).');
	process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const saves = supabaseSaveRepo(db);

const run = async () => {
	const { data: profile } = await db.from('profiles').select('character_name').eq('id', userId).maybeSingle();
	const displayName = (profile as { character_name?: string } | null)?.character_name ?? '';
	const stored = await saves.load(userId);
	if (!stored) return console.log('No save for this account. Nothing to do.');
	console.log(
		`Save rev ${stored.rev}: flags [${stored.flags.join(', ') || 'none'}], ever flagged (unranked): ${stored.everFlagged}, net-worth ratio ${stored.auditRatio.toFixed(2)}, test account: ${stored.testAccount}`,
	);
	if (!apply) return console.log('DRY RUN: nothing changed. Add --yes to restore this account.');
	const outcome = await restoreTrust(saves, userId, displayName);
	if (outcome.kind === 'restored') console.log(JSON.stringify({ event: 'trust_restored', userId, at: new Date().toISOString(), ...outcome }));
	else console.log(`Not restored: ${outcome.kind}${'reason' in outcome ? ` (${outcome.reason})` : ''}`);
};

run().catch(() => {
	console.error('restore-trust failed (nothing was changed unless a restored line was printed above).');
	process.exit(1);
});
