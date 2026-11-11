import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerClassId } from '@/config/playerClasses';
import { GAME_EPOCH, needsResetFor } from '@/config/epoch';
import { STARTING_GEMS } from '@/config/economy';
import { startNewGame, type ServiceDeps } from '@/lib/offline/service';

// SERVER ONLY. The "A new chapter" reset (IDL-76): what happens when an account on an older data epoch confirms the new chapter screen. See `config/epoch.ts` for the epoch itself.

/** The account's profile as the reset needs it: which epoch its game is on (null = before epochs existed). */
export interface ChapterProfile {
	epoch: number | null;
}

/** The storage the reset needs besides the save and ledger repos (Supabase in the app, a map in tests). */
export interface ChapterRepo {
	loadProfile(userId: string): Promise<ChapterProfile | null>;
	/** Sets name and class (and the avatar, when the player chose one: an id already checked by `checkAvatar`). `name_taken` when another account already holds that name (case-insensitive: the unique index). */
	setIdentity(userId: string, name: string, playerClass: PlayerClassId, avatarId?: string | null): Promise<'ok' | 'name_taken'>;
	/** Puts the profile on `epoch`, only when it is on an older one (so a retry or a race never moves it back). */
	setEpoch(userId: string, epoch: number): Promise<void>;
	/** Deletes every achievement the account has earned (the reset is complete: unlocks go with them). */
	clearAchievements(userId: string): Promise<void>;
	/** Records an achievement once (a second call for the same id changes nothing). */
	grantAchievement(userId: string, achievementId: string): Promise<void>;
}

export const EARLY_TESTER = 'early_tester';
/** Granted with the Early tester (catalog `withAchievement`) */
export const BETA_TESTER = 'beta_tester';

/**
 * The achievements an account will hold once its new chapter has started: none, except `early_tester` for an account that predates epochs (profile epoch null). The avatar picker and its server check use this
 * instead of the stored rows for an account that still has to reset, so the tester avatar can be picked on the chapter screen and no old unlock can.
 */
export const earnedAfterReset = (epoch: number | null): string[] => (epoch === null ? [EARLY_TESTER, BETA_TESTER] : []);

export type ChapterOutcome = { kind: 'ok'; already: boolean } | { kind: 'name_taken' } | { kind: 'no_profile' } | { kind: 'archive_failed' };

/**
 * Starts the new chapter for one account, once: the answer to `POST /api/auth/epoch`.
 *
 * - An account already on the server's epoch gets `{ ok, already: true }` and nothing is touched, so a repeated request, a second tab or a lost response is harmless.
 * - Otherwise: the name, class and avatar (already checked against the account's achievements by the route) are saved first (a name another account holds ends it here with nothing reset), then the game is replaced exactly like a New Game
 *   (the old save is first archived into a **pinned** `save_history` row flagged `epoch_archive` that is never trimmed, and only if that worked `startNewGame` runs: the save, its map, the leaderboard row and the rebirth log are
 *   deleted and the ledger starts a new run with its counters and stats zeroed (kills, glossary, tutorial, achievements); account and reserved name stay, the gems are set to the starting gift (`STARTING_GEMS`, flat), every earned achievement and its unlocks are deleted), an account that predates epochs then gets the early-tester
 *   grant (the tester avatar), and the profile moves to the new epoch **last**: a failure in between leaves the account on the old epoch, and the retry is the same request again.
 * - A stale tab cannot overwrite the fresh start: its requests carry the old epoch and are refused (`isStaleEpoch`), and a save for a row that no longer exists is a conflict
 *   (`acceptSave`), never a silent re-creation.
 *
 * @category Saves & Server/Epoch
 * @order 2
 */
export const startNewChapter = async (
	deps: Pick<ServiceDeps, 'ledgers' | 'saves'>,
	repo: ChapterRepo,
	userId: string,
	input: { characterName: string; playerClass: PlayerClassId; avatarId?: string | null },
	nowMs: number,
	serverEpoch: number = GAME_EPOCH,
): Promise<ChapterOutcome> => {
	const profile = await repo.loadProfile(userId);
	if (!profile) return { kind: 'no_profile' };
	if (!needsResetFor(profile.epoch, serverEpoch)) return { kind: 'ok', already: true };
	if ((await repo.setIdentity(userId, input.characterName, input.playerClass, input.avatarId)) === 'name_taken') return { kind: 'name_taken' };
	// the old game is archived for good BEFORE anything is deleted: if the copy cannot be stored (or the save cannot be read) the reset stops here, nothing deleted
	try {
		const old = await deps.saves.load(userId, { world: true });
		if (old) {
			if (!deps.saves.pinChapter || !old.world) return { kind: 'archive_failed' };
			await deps.saves.pinChapter(userId, old);
		}
	} catch {
		return { kind: 'archive_failed' };
	}
	await startNewGame(deps, userId, nowMs, { gems: STARTING_GEMS });
	await repo.clearAchievements(userId);
	if (profile.epoch === null) {
		await repo.grantAchievement(userId, EARLY_TESTER);
		await repo.grantAchievement(userId, BETA_TESTER);
	}
	await repo.setEpoch(userId, serverEpoch);
	return { kind: 'ok', already: false };
};

/** The reset's storage in Supabase, through the service-role client (the profile's epoch and achievements are never writable by the player). */
export const supabaseChapterRepo = (db: SupabaseClient): ChapterRepo => ({
	async loadProfile(userId) {
		const { data, error } = await db.from('profiles').select('epoch').eq('id', userId).maybeSingle();
		if (error) throw new Error(error.message);
		return data ? { epoch: typeof data.epoch === 'number' ? data.epoch : null } : null;
	},
	async setIdentity(userId, name, playerClass, avatarId) {
		const { error } = await db
			.from('profiles')
			.update({ character_name: name, player_class: playerClass, ...(avatarId ? { avatar_id: avatarId } : {}) })
			.eq('id', userId);
		if (error?.code === '23505') return 'name_taken';
		if (error) throw new Error(error.message);
		return 'ok';
	},
	async setEpoch(userId, epoch) {
		const { error } = await db.from('profiles').update({ epoch }).eq('id', userId).or(`epoch.is.null,epoch.lt.${epoch}`);
		if (error) throw new Error(error.message);
	},
	async clearAchievements(userId) {
		const { error } = await db.from('player_achievements').delete().eq('user_id', userId);
		if (error) throw new Error(error.message);
	},
	async grantAchievement(userId, achievementId) {
		const { error } = await db
			.from('player_achievements')
			.upsert({ user_id: userId, achievement_id: achievementId }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
		if (error) throw new Error(error.message);
	},
});
