import type { SavePeek } from '@/lib/saveStorage';
import { countOwnedTiles } from '@/utils/game/tiles';

/** Headline numbers of the account's cloud save (what GET /api/save sends next to the text). */
export interface CloudInfo {
	rev: number;
	serverSavedAt: number;
	text: string;
	summary: { level: number; tilesOwned: number; playSeconds: number; gold: number };
}

/** Which account (and which revision of its cloud save) this browser's save continues. Kept per browser. */
export interface CloudLink {
	userId: string;
	rev: number;
}

/**
 * What the start screen should do for a signed-in player.
 *   enter: no save anywhere, straight into a fresh game
 *   hub:   show the hub. `local`: Continue this browser's save; `cloud`: Continue the account's save (this browser has
 *          none, or an unreadable one); `choose`: both exist and they are not the same game, the player picks
 * `cloud: 'unavailable'` (outage, no service key) never blocks play: the local save carries on without syncing.
 */
export type StartPlan = { kind: 'enter' } | { kind: 'hub'; mode: 'local' | 'cloud' | 'choose' };

/**
 * Whether a tab that is already playing may skip the start check on a refresh. It may only while this browser still holds the link to this
 * account's cloud save: without it (cleared when a pre-reset local game was put aside) nothing would ever upload, so the start check runs again
 * and writes a fresh link.
 */
export const canResumeTab = (link: CloudLink | null, userId: string): boolean => link !== null && link.userId === userId;

/**
 * True when a refused upload (409) means "the account has no cloud save at all" rather than "another browser saved": the server answers revision 0
 * only when no row exists (a season reset or a New Game removed it). The link this browser holds is stale then and the start check has to run again.
 */
export const cloudSaveGone = (conflictRev: number): boolean => conflictRev === 0;

export const planStart = (local: SavePeek, cloud: CloudInfo | null | 'unavailable', link: CloudLink | null, userId: string): StartPlan => {
	if (cloud === 'unavailable' || cloud === null) {
		return local.kind === 'none' ? { kind: 'enter' } : { kind: 'hub', mode: 'local' };
	}
	if (local.kind !== 'ok') return { kind: 'hub', mode: 'cloud' };
	const linked = link !== null && link.userId === userId && link.rev === cloud.rev;
	// the same game on both sides (e.g. the link was lost): nothing to choose
	const same = local.state.playSeconds === cloud.summary.playSeconds;
	return { kind: 'hub', mode: linked || same ? 'local' : 'choose' };
};

/**
 * True when the start hub has nothing to ask: no save anywhere, or the one game in this browser that is the account's game too (`mode: 'local'` with a readable, current save).
 * Then the landing's Continue / Enter goes straight into the game. The hub stays for what needs a decision or a word: restoring the account's save (`cloud`), two different
 * games (`choose`), an unreadable save and a save that is only the previous backup.
 */
export const skipsHub = (plan: StartPlan, local: SavePeek): boolean =>
	plan.kind === 'enter' || (plan.mode === 'local' && local.kind === 'ok' && !local.fromBackup);

/** The numbers of the game a player continues, as the landing's Continue card shows them. */
export interface GameSummary {
	level: number;
	tiles: number;
	playSeconds: number;
}

/** The more played of the browser's save and the account's save (the one a start would continue); null when there is none. */
export const savedGameSummary = (local: SavePeek, cloud: CloudInfo | null | 'unavailable'): GameSummary | null => {
	const here: GameSummary | null =
		local.kind === 'ok' ? { level: local.state.level.level, tiles: countOwnedTiles(local.state.tiles), playSeconds: local.state.playSeconds } : null;
	const there: GameSummary | null =
		cloud && cloud !== 'unavailable' ? { level: cloud.summary.level, tiles: cloud.summary.tilesOwned, playSeconds: cloud.summary.playSeconds } : null;
	if (here && there) return there.playSeconds > here.playSeconds ? there : here;
	return here ?? there;
};
