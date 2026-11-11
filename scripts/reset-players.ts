/**
 * Season restart: `npm run reset-players` gives every player a fresh game while keeping who they are. It talks to Supabase with the service role, so it is run by hand from a trusted machine, never from the app. The usage and flags are in the header
 * of the script. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (environment or `.env.local`); they decide which project is wiped: check them first, and try one account with `--user` before running it for everyone.
 *
 * | Data | Result |
 * | --- | --- |
 * | Auth account, `profiles` (`character_name`, `player_class`) | **kept** |
 * | `player_ledger.gems` | **kept** (a player with a save but no ledger row keeps the save's gems) |
 * | `player_saves` | **deleted**: level, XP, gold, castle, tiles, buildings, rebirths, everything in `core` |
 * | `player_worlds`, `player_stats` | deleted by cascade; the leaderboard row returns after the player's first new save |
 * | `player_ledger` (all but `gems`) | **reset** to new-game values: spawn timers and tickets, granted totals, combat, inventory (bag and gear), rebirths. `run_id` and `ver` are bumped, so sealed rolls never repeat across the restart |
 * | `rebirth_history` | **deleted** (the log of the season that ended; it is in the JSON backup). Needs the `rebirth_history` migration |
 * | `save_history` | kept by default (rollback copies); deleted with `--purge-history` |
 *
 * Before a real reset the tool writes `backups/reset-<timestamp>.json` (gitignored: it holds player data). Procedure: run the dry run and check the player list and the project URL; do it while few people are online (a player with the game open must reload:
 * their old save no longer matches the server and is rejected, then they start a new game); run with `--yes`.
 *
 * **Local copies in browsers.** The server side is fully reset, but a browser may still hold its own local save. The tool cannot touch browsers, so the client does it: the reset ships together with a `SAVE_SCHEMA` bump ({@link SAVE_SCHEMA}).
 * A local save of any older schema is refused ("from an older season, start a new game"). Gems stay the server's. After a later restart, bump `SAVE_SCHEMA` again in the same release.
 *
 * **Undoing it**: restore from the JSON backup, or from `save_history` when it was kept (the latest copy per player is at most about 30 minutes older than their last save). There is no automated restore tool yet.
 *
 * @title Season restart (reset-players)
 * @category Ops/Operator guides
 * @order 1
 * @see ensureSeasonReset
 */
/**
 * Season restart: wipes every player's game progress but keeps their account, character name/class and gem balance.
 *
 *   npm run reset-players                      DRY RUN: lists what would happen, changes nothing
 *   npm run reset-players -- --yes             really do it (a JSON backup is written first)
 *   npm run reset-players -- --yes --user <uuid> [--user <uuid> ...]   only these players
 *   npm run reset-players -- --yes --hard      also delete save_history (the rollback copies) and every leftover row; nothing but names, classes and gems stays
 *   npm run reset-players -- --yes --purge-history   only delete save_history; default keeps it
 *   npm run reset-players -- --yes --no-backup       skip the JSON backup (not recommended)
 *   npm run reset-players -- --yes --reset-gems      the gems go back to the starting amount too (the test account uses this, see scripts/reset-test-account.ts)
 *   npm run reset-players -- --yes --reset-stats     also clears the lifetime counters (`player_ledger.stats`: kills, discovered monsters, tutorial progress, earned achievements) and `player_achievements`; the test account uses this
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from the environment or from .env.local).
 *
 * KEPT:  auth account, profiles (character_name, player_class), player_ledger.gems.
 * RESET: player_saves (and, by cascade, player_worlds + player_stats = the leaderboard row, back after the first new save),
 *        player_ledger except gems (away-time anchor and spawn timers/tickets at the moment of the reset, granted totals, combat, inventory/bag/gear,
 *        rebirths, the claim key; run_id is bumped so sealed rolls never repeat), rebirth_history (the season's rebirth log; backed up first),
 *        save_history only with --purge-history / --hard.
 * A full run (no --user) also writes the app_settings 'last_reset' marker and every ledger's reset_at; a player whose reset_at is older than the marker
 * (or missing) is reset at their next login, and a browser save older than it is put aside (needs migration supabase/migrations/season_reset.sql).
 * The first save of the new game re-anchors the timers again (cloudSave/pipeline.ts), so the time between the reset and the player's return is never paid.
 * A player with the game open must reload: their old save no longer matches and is rejected, then they start a new game.
 * A browser that still holds the old game in its local storage keeps showing it in the start hub: that player must choose "New game" there
 * (the server cannot clear a browser).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { newLedger, resetLedger } from '../src/lib/offline/ledger';
import { writeLastReset, writePlayerReset } from '../src/lib/offline/season';
import { STARTING_GEMS } from '../src/config/economy';
import { statsWithoutTutorial } from '../src/lib/offline/statsReset';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const users: string[] = [];
args.forEach((a, i) => {
	if (a === '--user' && args[i + 1]) users.push(args[i + 1]);
});
const execute = flag('--yes');
const hard = flag('--hard');
const purgeHistory = flag('--purge-history') || hard;
const backup = !flag('--no-backup');
const resetGems = flag('--reset-gems');
const resetStats = flag('--reset-stats');

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

const fail = (what: string, error: { message: string } | null) => {
	if (error) {
		console.error(`${what}: ${error.message}`);
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
			.range(from, from + 999);
		if (users.length) query = query.in(table === 'profiles' ? 'id' : 'user_id', users);
		const { data, error } = await query;
		fail(`read ${table}`, error);
		out.push(...((data ?? []) as T[]));
		if (!data || data.length < 1000) break;
	}
	return out;
};

interface LedgerInfo {
	stats?: unknown;
	user_id: string;
	gems: number;
	run_id: number;
	ver: number;
	anchor_at: string;
}

const main = async () => {
	const saves = await fetchAll<{ user_id: string; gems: number; level: number; rebirths: number }>('player_saves', 'user_id, gems, level, rebirths');
	const ledgers = await fetchAll<LedgerInfo>('player_ledger', 'user_id, gems, run_id, ver, anchor_at, stats');
	const profiles = await fetchAll<{ id: string; character_name: string }>('profiles', 'id, character_name');

	const names = new Map(profiles.map((p) => [p.id, p.character_name]));
	const ledgerOf = new Map(ledgers.map((l) => [l.user_id, l]));
	const ids = [...new Set([...saves.map((s) => s.user_id), ...ledgers.map((l) => l.user_id)])];

	console.log(`${execute ? 'RESET' : 'DRY RUN'}${hard ? ' (hard)' : ''} against ${url}`);
	console.log(`${ids.length} player(s) with game data${users.length ? ` (filtered to ${users.length} id(s))` : ''}:\n`);
	for (const id of ids) {
		const save = saves.find((s) => s.user_id === id);
		const gems = ledgerOf.get(id)?.gems ?? save?.gems ?? 0;
		console.log(
			`  ${(names.get(id) ?? '?').padEnd(10)} ${id}  level ${save?.level ?? '-'}  rebirths ${save?.rebirths ?? '-'}  ${resetGems ? `gems reset to ${STARTING_GEMS} (were ${gems})` : `gems kept: ${gems}`}  ledger anchor ${ledgerOf.get(id)?.anchor_at ?? '-'}`,
		);
	}
	if (!execute) {
		console.log('\nNothing changed. Re-run with --yes to apply.');
		return;
	}
	if (ids.length === 0) return;

	if (backup) {
		const tables = ['player_saves', 'player_worlds', 'player_stats', 'player_ledger', 'rebirth_history'];
		const dump: Record<string, unknown[]> = {};
		for (const t of tables) dump[t] = await fetchAll<unknown>(t, '*');
		mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
		const file = resolve(process.cwd(), 'backups', `reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
		writeFileSync(file, JSON.stringify(dump));
		console.log(`\nBackup written: ${file}`);
	}

	const now = Date.now();
	let done = 0;
	for (const id of ids) {
		const old = ledgerOf.get(id);
		const gems = resetGems ? STARTING_GEMS : (old?.gems ?? saves.find((s) => s.user_id === id)?.gems ?? 0);

		// 1. the ledger: everything back to a new game's values (timers at now, nothing granted, no bag, no fight), except the gems (and a bumped run_id / ver)
		const fresh = resetLedger({ ...newLedger(now, 0), ver: old?.ver ?? 0, runId: old?.run_id ?? 0, gems }, now);
		const row = {
			ver: fresh.ver + 1,
			run_id: fresh.runId,
			rebirths: 0,
			anchor_at: new Date(fresh.anchorAt).toISOString(),
			reset_at: new Date(now).toISOString(),
			bank: fresh.bank,
			ord_chest: 0,
			ord_kill: 0,
			granted: fresh.granted,
			granted_seen: fresh.grantedSeen,
			gems,
			last_key: null,
			last_result: null,
			combat: null,
			inv: null,
			// the Idol levels that survive a rebirth (`legacy.idols`) belong to the game that ended: a restart clears them too
			legacy: null,
			// every restart wipes the tutorial progress (the whole counter column with --reset-stats); kills, glossary and achievements stay otherwise
			stats: resetStats ? null : statsWithoutTutorial(old?.stats),
			updated_at: new Date(now).toISOString(),
		};
		const ledgerWrite = old ? await db.from('player_ledger').update(row).eq('user_id', id) : await db.from('player_ledger').insert({ user_id: id, ...row });
		fail(`ledger ${id}`, ledgerWrite.error);

		if (resetStats) {
			// the achievements table mirrors `stats.achievements`: a player with fresh counters has earned nothing
			const achievementsDelete = await db.from('player_achievements').delete().eq('user_id', id);
			fail(`achievements ${id}`, achievementsDelete.error);
		}

		// 2. the save: deleting it cascades to player_worlds and player_stats; the next login starts a new game. --hard deletes those rows explicitly as well
		const saveDelete = await db.from('player_saves').delete().eq('user_id', id);
		fail(`save ${id}`, saveDelete.error);
		if (hard) {
			for (const table of ['player_worlds', 'player_stats']) {
				const result = await db.from(table).delete().eq('user_id', id);
				fail(`${table} ${id}`, result.error);
			}
		}

		// 3. the rebirth history belongs to the season that ended: the new one counts its rebirths from 1 again (and the history keeps one row per number), so it goes too; the backup above has it
		const rebirthDelete = await db.from('rebirth_history').delete().eq('user_id', id);
		fail(`rebirth history ${id}`, rebirthDelete.error);

		if (purgeHistory) {
			const historyDelete = await db.from('save_history').delete().eq('user_id', id);
			fail(`history ${id}`, historyDelete.error);
		}
		// a reset of named players (not the whole season) leaves no global marker: this one tells the player's browser to drop its copy of the old game
		if (users.length) await writePlayerReset(db, id, now);
		done++;
	}

	// the global marker: a player the run did not reach (no ledger yet, or one that appears later with an old game) is reset at their next login
	if (!users.length) {
		await writeLastReset(db, now);
		console.log(`last_reset marker set to ${new Date(now).toISOString()} (players not reset above are reset at their next login).`);
	}

	// check what is left: no save, a fresh anchor, the gems as they were
	const leftSaves = await fetchAll<{ user_id: string }>('player_saves', 'user_id');
	const after = await fetchAll<LedgerInfo>('player_ledger', 'user_id, gems, run_id, ver, anchor_at');
	const stale = after.filter(
		(l) =>
			ids.includes(l.user_id) && (Date.parse(l.anchor_at) < now - 1000 || l.gems !== (resetGems ? STARTING_GEMS : (ledgerOf.get(l.user_id)?.gems ?? l.gems))),
	);
	if (leftSaves.length > 0 || stale.length > 0) {
		console.error(`CHECK FAILED: ${leftSaves.length} save(s) left, ${stale.length} ledger(s) not fresh.`);
		process.exit(1);
	}
	console.log(
		`Reset ${done} player(s). Names and classes kept, gems ${resetGems ? `reset to ${STARTING_GEMS}` : 'kept'}.${purgeHistory ? ' save_history purged.' : ' save_history kept (rollback copies).'} Check passed: no saves left, ledgers anchored at the reset.`,
	);
	console.log(
		users.length
			? 'The browser of each reset player drops its copy of the old game at the next sign-in (a per-player marker was written).'
			: 'A browser that still holds the old game locally drops it at the next sign-in (the season marker).',
	);
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
