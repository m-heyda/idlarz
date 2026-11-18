/**
 * Puts mineable rocks of every tier on the map of ONE development account, so the mining can be tried by hand (cursor, tooltip, chop and break effects, the sound, the drops). Operator tooling: run by hand, never by the app or CI.
 *
 *   npm run grant-test-rocks -- --email <address>                  DRY RUN: finds the account, reads its map and ledger, says what it would add, writes nothing
 *   npm run grant-test-rocks -- --email <address> --yes            backs the ledger row up (`backups/grant-test-rocks-<time>.json`) and writes the change
 *   options: --count <1..5>   how many rocks of each tier (default 1; 4 tiers, so 4 rocks by default)
 *            --tier <name>     only rocks of this tier (common, uncommon, rare, epic or legendary), e.g. `--tier legendary` adds just the legendary ore
 *            --chests <0..20>  how many treasure chests to put on the map as well (default 0)
 *            --clear-rocks     first takes only the rocks off the map (new ones are added with the current rules, fresh at 0 clicks)
 *            --clear           first takes every monster, the boss, every chest and every rock off the map (their tickets are dropped from the bank), so only what this run adds is there
 *
 * What it changes (only the `player_ledger` row, through the same compare-and-swap the server uses, so a browser saving at the same moment makes it refuse instead of overwrite): the bank gets `--count` rocks of each tier and `--chests` chests, each already on a free tile
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
import { pickChestSpot } from '../src/lib/chests';
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
// npm (and PowerShell) can swallow flags: `npm run grant-test-rocks -- --email a@b --tier legendary --yes` may reach this script as the bare words `a@b legendary` (npm takes `--yes`, `--email` ... for itself). So every option also works as a bare word:
// an address, a tier name, `yes` (apply), `clear`, `clear-rocks`, and a number (how many of each tier). The `grant-test-legendary` npm script has them all baked in.
const bare = args.filter((a) => !a.startsWith('--'));
const tierNames = ROCK_TIER_ORDER as readonly string[];
const execute = args.includes('--yes') || bare.includes('yes');
const email = (option('--email') ?? bare.find((a) => a.includes('@')))?.toLowerCase();
const countText = option('--count') ?? bare.find((a) => /^\d+$/.test(a));
const count = Math.min(5, Math.max(1, Math.floor(Number(countText ?? 1)) || 1));
const chestCount = Math.min(20, Math.max(0, Math.floor(Number(option('--chests') ?? 0)) || 0));
const onlyTier = option('--tier') ?? bare.find((a) => tierNames.includes(a));
const clear = args.includes('--clear') || bare.includes('clear');
const clearRocks = args.includes('--clear-rocks') || bare.includes('clear-rocks');

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
	if (onlyTier && !(ROCK_TIER_ORDER as readonly string[]).includes(onlyTier))
		stop(`--tier ${onlyTier} is not a rock tier (${ROCK_TIER_ORDER.join(', ')}): refusing to run.`);
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
	// with --clear the map starts empty: no monster (the boss too), no chest, no rock
	const bank =
		clearRocks && !clear
			? { ...ledger.bank, rocks: [], rockAcc: 0 }
			: clear
				? { ...ledger.bank, monsters: [], chests: [], rocks: [], monsterAcc: 0, bossAcc: 0, chestAcc: 0, rockAcc: 0 }
				: ledger.bank;
	const taken = new Set<string>();
	for (const t of [...bank.monsters, ...bank.chests, ...rocksOf(bank)]) if (t.x !== undefined && t.y !== undefined) taken.add(`${t.x},${t.y}`);
	const rng = mulberry32(Date.now() & 0x7fffffff);
	const added: RockTicket[] = [];
	let n = bank.nextRockN ?? 1;
	for (let round = 0; round < count; round++) {
		for (const tier of onlyTier ? [onlyTier as (typeof ROCK_TIER_ORDER)[number]] : ROCK_TIER_ORDER) {
			const spot = pickRockSpot(world, taken, castleLevel, rng);
			if (!spot) return stop(`The land has no more free tiles for rocks (${added.length} placed so far). Nothing was changed.`);
			taken.add(`${spot.x},${spot.y}`);
			added.push({ n: n++, at: nowSec, tier, hits: 0, x: spot.x, y: spot.y });
		}
	}
	const chestTickets: { n: number; at: number; x: number; y: number }[] = [];
	let nextN = bank.nextN;
	for (let i = 0; i < chestCount; i++) {
		const spot = pickChestSpot(world, taken, castleLevel, rng);
		if (!spot) return stop(`The land has no more free tiles for chests (${chestTickets.length} placed so far). Nothing was changed.`);
		taken.add(`${spot.x},${spot.y}`);
		chestTickets.push({ n: nextN++, at: nowSec, x: spot.x, y: spot.y });
	}
	const next: Ledger = {
		...ledger,
		ver: ledger.ver + 1,
		bank: { ...bank, rocks: [...rocksOf(bank), ...added], nextRockN: n, chests: [...bank.chests, ...chestTickets], nextN },
	};

	console.log(`${execute ? 'GRANTING' : 'DRY RUN (nothing is written)'} on ${new URL(url!).host}, account ${email}.`);
	if (clearRocks && !clear) console.log(`Would clear ${rocksOf(ledger.bank).length} rock(s) first.`);
	if (clear)
		console.log(
			`Would clear ${ledger.bank.monsters.length} monster ticket(s), ${ledger.bank.chests.length} chest(s) and ${rocksOf(ledger.bank).length} rock(s) first.`,
		);
	for (const rock of added) console.log(`  ${rock.tier.padEnd(9)} rock #${rock.n} on tile ${rock.x},${rock.y}`);
	for (const chest of chestTickets) console.log(`  chest #${chest.n} on tile ${chest.x},${chest.y}`);
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
