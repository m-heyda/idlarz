/**
 * Puts mineable rocks of every tier on the map of ONE development account, so the mining can be tried by hand (cursor, tooltip, chop and break effects, the sound, the drops). Operator tooling: run by hand, never by the app or CI.
 *
 *   npm run grant-test-rocks -- --email <address>                  DRY RUN: finds the account, reads its map and ledger, says what it would add, writes nothing
 *   npm run grant-test-rocks -- --email <address> --yes            backs the ledger row up (`backups/grant-test-rocks-<time>.json`) and writes the change
 *   options: --count <1..5>   how many rocks of each tier (default 1; 4 tiers, so 4 rocks by default)
 *
 * What it changes (only the `player_ledger` row, through the same compare-and-swap the server uses, so a browser saving at the same moment makes it refuse instead of overwrite): the bank gets `--count` rocks of each tier, each already on a free tile
 * (owned land that is not water, the castle, its ward, a building, a chest, a monster or another rock). They count like rocks the server made: mine them from the browser and the server pays them. It refuses when the account has no ledger or no map yet
 * (sign in and play for a moment first) or when the land has too few free tiles.
 * Undo: put the old `bank` of the backup file back into the row, or reset the account with `npm run reset-test-account` (only for the documented test account).
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or .env.local): they decide which project is touched; check that first.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ROCK_TIER_ORDER } from '../src/config/rocks';
import { castleLevelOf } from '../src/lib/castleWard';
import { mulberry32 } from '../src/lib/rng';
import { pickRockSpot } from '../src/lib/rocks';
import { supabaseLedgerRepo } from '../src/lib/offline/supabaseLedger';
import { worldFromPart } from '../src/lib/offline/placement';
import type { Ledger } from '../src/lib/offline/ledger';
import { rocksOf, type RockTicket } from '../src/lib/offline/tickets';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const execute = args.includes('--yes');
// the e-mail is `--email <address>` or just the first bare word (PowerShell and npm can swallow the `--` that npm needs, so the plain form works too)
const email = (option('--email') ?? args.find((a) => a.includes('@')))?.toLowerCase();
const count = Math.min(5, Math.max(1, Math.floor(Number(option('--count') ?? 1)) || 1));

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

const run = async (): Promise<void> => {
	if (!email) stop('an e-mail address is required (npm run grant-test-rocks -- --email <address>): refusing to run.');
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) stop('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (environment or .env.local).');
	const db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

	// the account, found by e-mail (the admin API has no lookup by e-mail: page through the users)
	let userId: string | null = null;
	for (let page = 1; !userId; page++) {
		const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
		if (error) stop('could not list the users (details withheld).');
		userId = data!.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
		if (data!.users.length < 200) break;
	}
	if (!userId) return stop(`No account with the e-mail ${email} in ${new URL(url!).host}. Is this the right project?`);

	const repo = supabaseLedgerRepo(db);
	const ledger = await repo.load(userId);
	if (!ledger) return stop('The account has no ledger yet: sign in and play for a moment first.');
	const { data: worldRow } = await db.from('player_worlds').select('land, extra').eq('user_id', userId).maybeSingle();
	const world = worldRow ? worldFromPart(worldRow as { land: unknown; extra: unknown }) : null;
	if (!world) return stop('Could not read the map of this account (it has no stored world yet). Nothing was changed.');

	const nowSec = Math.floor(Date.now() / 1000);
	const castleLevel = castleLevelOf(world);
	const taken = new Set<string>();
	for (const t of [...ledger.bank.monsters, ...ledger.bank.chests, ...rocksOf(ledger.bank)])
		if (t.x !== undefined && t.y !== undefined) taken.add(`${t.x},${t.y}`);
	const rng = mulberry32(Date.now() & 0x7fffffff);
	const added: RockTicket[] = [];
	let n = ledger.bank.nextRockN ?? 1;
	for (let round = 0; round < count; round++) {
		for (const tier of ROCK_TIER_ORDER) {
			const spot = pickRockSpot(world, taken, castleLevel, rng);
			if (!spot) return stop(`The land has no more free tiles for rocks (${added.length} placed so far). Nothing was changed.`);
			taken.add(`${spot.x},${spot.y}`);
			added.push({ n: n++, at: nowSec, tier, hits: 0, x: spot.x, y: spot.y });
		}
	}
	const next: Ledger = { ...ledger, ver: ledger.ver + 1, bank: { ...ledger.bank, rocks: [...rocksOf(ledger.bank), ...added], nextRockN: n } };

	console.log(`${execute ? 'GRANTING' : 'DRY RUN (nothing is written)'} on ${new URL(url!).host}, account ${email}.`);
	for (const rock of added) console.log(`  ${rock.tier.padEnd(9)} rock #${rock.n} on tile ${rock.x},${rock.y}`);
	if (!execute) return void console.log('\nNothing changed. Re-run with --yes to apply.');

	mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
	const file = resolve(process.cwd(), 'backups', `grant-test-rocks-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	writeFileSync(file, JSON.stringify({ kind: 'grant-test-rocks-backup', userId, at: new Date().toISOString(), ver: ledger.ver, bank: ledger.bank }));
	console.log(`Backup written: ${file}`);

	if (!(await repo.commit(userId, ledger.ver, next)))
		return stop('Refused: the ledger changed while this ran (a browser was saving). Close the game, wait a few seconds and run it again. Nothing was written.');
	console.log('Done. Reload the game: the rocks stand on the map (the next poll of the server shows them).');
};

run().catch(() => {
	console.error('grant-test-rocks stopped (details withheld).');
	process.exit(1);
});
