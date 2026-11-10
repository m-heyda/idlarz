/**
 * Clears the game data of the ONE account the end-to-end tests use (docs/reference/ops.md), so a test run starts from a new game.
 *
 *   npm run reset-test-account             DRY RUN: shows what would be cleared
 *   npm run reset-test-account -- --yes    really clear it
 *   npm run reset-test-account -- --yes --new-character   also delete the profile (character name, class, avatar) and the earned achievements, so the next login
 *                                          goes through character creation like a brand-new player (the login itself stays)
 *
 * It only ever touches TEST_ACCOUNT_EMAIL (hard-coded below; there is no flag to point it elsewhere). The account is looked up by e-mail with the
 * service role, then scripts/reset-players.ts runs for that user id with --hard --reset-gems --purge-history --no-backup:
 *   cleared: the save (map, buildings, castle, level, XP, rebirths and Embers), worlds, stats, the whole ledger (bag, gear, fight, spawn timers,
 *            tickets, rebirths), the rebirth history, the save_history rollback copies, and the gems (back to the starting amount).
 *   kept:    the login itself and the profile (character name and class), so the next test run only has to sign in (unless --new-character: then the profile goes too).
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or .env.local); check which project they point at first, the same rule as reset-players.
 * A browser that still holds the old game locally must choose "New game" in the start hub (the server cannot clear a browser).
 */
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { TEST_ACCOUNT_EMAIL } from '../e2e/account';

for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(resolve(process.cwd(), file));
	} catch {
		/* missing file: the environment may already have the variables */
	}
}

const run = async () => {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (environment or .env.local).');
		process.exit(1);
	}
	const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

	// find the account by e-mail (page through the users: the admin API has no lookup by e-mail)
	let id: string | null = null;
	for (let page = 1; !id; page++) {
		const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
		if (error) {
			console.error(`could not list users: ${error.message}`);
			process.exit(1);
		}
		id = data.users.find((u) => u.email?.toLowerCase() === TEST_ACCOUNT_EMAIL)?.id ?? null;
		if (data.users.length < 200) break;
	}
	if (!id) {
		console.error(`No account with the e-mail ${TEST_ACCOUNT_EMAIL} in ${url}. Is this the right project?`);
		process.exit(1);
	}
	console.log(`Test account ${TEST_ACCOUNT_EMAIL} = ${id}`);

	// --new-character: the profile row is what makes the account "have a character"; without it the next login asks for a name and a class again
	if (process.argv.includes('--new-character')) {
		if (!process.argv.includes('--yes')) {
			console.log('--new-character: the profile (character name, class, avatar) and the earned achievements would be deleted too.');
		} else {
			for (const [table, column] of [
				['player_achievements', 'user_id'],
				['profiles', 'id'],
			] as const) {
				const { error } = await db.from(table).delete().eq(column, id);
				if (error) {
					console.error(`could not clear ${table}: ${error.message}`);
					process.exit(1);
				}
			}
			console.log('--new-character: profile and achievements deleted. The next login creates a new character.');
		}
	}

	// hand over to reset-players, narrowed to this one user (it reads its options from process.argv when it loads)
	const execute = process.argv.includes('--yes');
	process.argv = [process.argv[0], process.argv[1], '--user', id, '--hard', '--reset-gems', '--purge-history', '--no-backup', ...(execute ? ['--yes'] : [])];
	await import('./reset-players');
};

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
