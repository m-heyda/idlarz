import type { SavePeek } from '@/lib/saveStorage';

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
