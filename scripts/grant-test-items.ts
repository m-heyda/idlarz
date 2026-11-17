/**
 * Gives ONE development account a legendary item in its bag and a boss waiting on its map, so tooltips, the boss fight and the new windows can be tried by hand. Operator tooling: run by hand, never by the app or CI.
 *
 *   npm run grant-test-items -- --email <address>                  DRY RUN: finds the account, reads its ledger, says what it would add, writes nothing
 *   npm run grant-test-items -- --email <address> --yes            backs the ledger row up (`backups/grant-test-items-<time>.json`) and writes the change
 *   options: --item <id>   the legendary item (default `emberbrand`; any id in LEGENDARY_ITEMS)    --level <1..100>   its item level (default 20)
 *
 * What it changes (only the `player_ledger` row, through the same compare-and-swap the server uses, so a browser saving at the same moment makes it refuse instead of overwrite):
 *  - the bag: one `ItemInstance` (rarity legendary, quality 50, no affixes) in the first empty slot;
 *  - the ticket bank: one boss ticket exactly as the server mints it (`{ n, at, kind: 'boss', lucky: false }`). It has no tile yet: the server places it on a free tile of the map at the player's next request
 *    (placement.ts), so open the game and wait a moment. If the map has no free boss tile yet the ticket waits until it has one.
 * It refuses when no boss could be placed on the account's map (a boss needs an owned tile of its biome 8+ tiles from the castle), when the account has no ledger or no bag yet (sign in once and open the bag first), when the bag is full, or when a boss already waits (there is at most one).
 * `--near-castle` (a test shortcut that bypasses the 8-tile rule): places the boss on a free land tile 2 or more tiles from the castle instead, in the ledger itself (type, tile and level set; the item is not added again, and an existing unplaced
 *    boss ticket is the one that is placed). The server's rules would not allow that tile, so the next time the map is looked at again (you buy a tile, upgrade the castle, or a normal monster waits for its tile) the server takes the boss off it and it waits hidden
 *    again. Fight it before that, or run the script again.
 * Undo: put the old `bank` and `inv` of the backup file back into the row, or reset the account with `npm run reset-test-account` (only for the documented test account).
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or .env.local): they decide which project is touched; check that first.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { LEGENDARY_ITEMS } from '../src/catalog/items/legendary';
import { supabaseLedgerRepo } from '../src/lib/offline/supabaseLedger';
import { bossOf } from '../src/lib/offline/tickets';
import { MONSTERS } from '../src/config/combatConfig';
import { castleDistance } from '../src/lib/distance';
import { spawnTiles } from '../src/lib/monsters';
import { worldFromPart } from '../src/lib/offline/placement';
import { ownedRowMajor } from '../src/utils/world';
import { castleLevelOf, isInWard } from '../src/lib/castleWard';
import { rollSpawnLevel } from '../src/lib/monsters';
import type { MonsterType } from '../src/types/game';
import type { Ledger } from '../src/lib/offline/ledger';
import type { ItemInstance } from '../src/types/game';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const execute = args.includes('--yes');
const nearCastle = args.includes('--near-castle');
// the e-mail is `--email <address>` or just the first bare word (PowerShell and npm can swallow the `--` that npm needs, so the plain form works too)
const email = (option('--email') ?? args.find((a) => a.includes('@')))?.toLowerCase();
const itemId = option('--item') ?? 'emberbrand';
const level = Math.min(100, Math.max(1, Math.floor(Number(option('--level') ?? 20)) || 20));

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
	if (!email) stop('an e-mail address is required (npm run grant-test-items -- --email <address>): refusing to run.');
	if (!LEGENDARY_ITEMS.some((def) => def.id === itemId))
		stop(`--item ${itemId} is not a legendary item. Known: ${LEGENDARY_ITEMS.map((def) => def.id).join(', ')}.`);
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
	if (!ledger.inv) return stop('The account has no server bag yet: sign in and open the bag once first.');
	const existingBoss = bossOf(ledger.bank);
	if (existingBoss && !nearCastle)
		return stop(
			'A boss already waits for this account (there is at most one). Defeat it or wait; nothing was changed. (--near-castle places it near the castle.)',
		);
	const slot = nearCastle ? -1 : ledger.inv.bag.findIndex((s) => s === null);
	if (!nearCastle && slot < 0) return stop('The bag is full: free a slot first. Nothing was changed.');

	const { data: worldRow } = await db.from('player_worlds').select('land, extra').eq('user_id', userId).maybeSingle();
	const world = worldRow ? worldFromPart(worldRow as { land: unknown; extra: unknown }) : null;
	if (!world) return stop('Could not read the map of this account (it has no stored world yet). Nothing was changed.');
	const nowSec = Math.floor(Date.now() / 1000);

	if (nearCastle) {
		// the nearest free land tile (not the castle, not water, no chest, nobody standing there) whose biome some boss lives in
		const taken = new Set<string>();
		for (const t of [...ledger.bank.monsters, ...ledger.bank.chests]) if (t.x !== undefined && t.y !== undefined) taken.add(`${t.x},${t.y}`);
		const castleLevel = castleLevelOf(world);
		const bossTypes = (Object.keys(MONSTERS) as MonsterType[]).filter(
			(type) => MONSTERS[type].grade === 'boss' && ledger.rebirths >= (MONSTERS[type].spawn.minRebirths ?? 0),
		);
		const candidates = [...ownedRowMajor(world)]
			.filter(
				({ x, y, tile }) =>
					castleDistance({ x, y }) >= 2 &&
					tile.biome !== 'castle' &&
					tile.biome !== 'lake' &&
					!tile.hasChest &&
					!taken.has(`${x},${y}`) &&
					!isInWard(x, y, castleLevel),
			)
			.sort((a, b) => castleDistance(a) - castleDistance(b));
		const pick = candidates
			.map((c) => ({ c, type: bossTypes.find((type) => (MONSTERS[type].spawn.biomes as readonly string[]).includes(c.tile.biome)) }))
			.find((e) => e.type);
		if (!pick) return stop('No free tile near the castle suits any boss. Nothing was changed.');
		const { c, type } = { c: pick.c, type: pick.type! };
		const n = existingBoss?.n ?? ledger.bank.nextN;
		const spawnLevel = rollSpawnLevel(type, castleLevel, n, castleDistance(c));
		const ticket = { ...(existingBoss ?? { n, at: nowSec, kind: 'boss' as const, lucky: false }), type, x: c.x, y: c.y, spawnLevel };
		const monsters = existingBoss ? ledger.bank.monsters.map((m) => (m.n === existingBoss.n ? ticket : m)) : [...ledger.bank.monsters, ticket];
		const nextNear: Ledger = {
			...ledger,
			ver: ledger.ver + 1,
			bank: { ...ledger.bank, monsters, nextN: existingBoss ? ledger.bank.nextN : ledger.bank.nextN + 1 },
		};
		console.log(`${execute ? 'PLACING' : 'DRY RUN (nothing is written)'} on ${new URL(url!).host}, account ${email}.`);
		console.log(`Would place boss ${type} (level ${spawnLevel}) on tile ${c.x},${c.y} (${castleDistance(c)} from the castle, ${c.tile.biome}).`);
		if (!execute) return void console.log('Nothing changed. Re-run with --yes to apply.');
		mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
		const nearFile = resolve(process.cwd(), 'backups', `grant-test-items-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
		writeFileSync(
			nearFile,
			JSON.stringify({ kind: 'grant-test-items-backup', userId, at: new Date().toISOString(), ver: ledger.ver, bank: ledger.bank, inv: ledger.inv }),
		);
		console.log(`Backup written: ${nearFile}`);
		if (!(await repo.commit(userId, ledger.ver, nextNear)))
			return stop('Refused: the ledger changed while this ran. Close the game, wait a few seconds and run it again. Nothing was written.');
		return void console.log('Done. Reload the game: the boss stands near the castle.');
	}

	// a boss can only be placed on an owned tile of its biome at least 8 tiles from the castle (`BOSS_MIN_DISTANCE`): without one the ticket waits, unseen, until the land reaches that far
	const bossTypes = (Object.keys(MONSTERS) as MonsterType[]).filter((type) => MONSTERS[type].grade === 'boss');
	const sites = new Set(bossTypes.flatMap((type) => spawnTiles(type, world, new Set(), ledger.rebirths).map((spot) => `${spot.x},${spot.y}`)));
	let reach = 0;
	for (const { x, y } of ownedRowMajor(world)) reach = Math.max(reach, castleDistance({ x, y }));
	if (sites.size === 0)
		return stop(
			`No boss can stand on this map yet: bosses need an owned tile of their own biome 8 or more tiles from the castle, and this land reaches only ${reach} tiles out. ` +
				'Buy tiles further out (towards 8+ tiles from the castle), then run this again. Nothing was changed.',
		);

	const item: ItemInstance = { base: itemId, level, rarity: 'legendary', quality: 50, affixes: [] };
	const next: Ledger = {
		...ledger,
		ver: ledger.ver + 1,
		inv: { ...ledger.inv, ver: ledger.inv.ver + 1, bag: ledger.inv.bag.map((s, i) => (i === slot ? { item } : s)) },
		bank: {
			...ledger.bank,
			monsters: [...ledger.bank.monsters, { n: ledger.bank.nextN, at: nowSec, kind: 'boss', lucky: false }],
			nextN: ledger.bank.nextN + 1,
		},
	};

	console.log(`${execute ? 'GRANTING' : 'DRY RUN (nothing is written)'} on ${new URL(url!).host}, account ${email}.`);
	console.log(
		`Would add: ${itemId} (legendary, level ${level}) to bag slot ${slot + 1}, and boss ticket #${ledger.bank.nextN} (placed on the map by the server at the next request).`,
	);
	if (!execute) return void console.log('\nNothing changed. Re-run with --yes to apply.');

	mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
	const file = resolve(process.cwd(), 'backups', `grant-test-items-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	writeFileSync(
		file,
		JSON.stringify({ kind: 'grant-test-items-backup', userId, at: new Date().toISOString(), ver: ledger.ver, bank: ledger.bank, inv: ledger.inv }),
	);
	console.log(`Backup written: ${file}`);

	const ok = await repo.commit(userId, ledger.ver, next);
	if (!ok)
		return stop('Refused: the ledger changed while this ran (a browser was saving). Close the game, wait a few seconds and run it again. Nothing was written.');
	console.log('Done. Reload the game: the item is in the bag; the boss appears on the map within a few seconds.');
};

run().catch(() => {
	console.error('grant-test-items stopped (details withheld).');
	process.exit(1);
});
