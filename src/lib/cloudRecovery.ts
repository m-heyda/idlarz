import type { CloudLink } from '@/lib/startPlan';

/** The numbers of a game that say how far along it is. Both the local game and the account's cloud save are reduced to these. */
export interface Progress {
	playSeconds: number;
	level: number;
	tilesOwned: number;
	rebirths: number;
}

/** How long the account's save must have been untouched before a browser that is behind may replace it: longer than one upload heartbeat (`SYNC.heartbeatMs`, 5 min) plus a minute. */
export const QUIET_MS = 6 * 60_000;

/**
 * Whether a refused upload (409, "the account has a newer save") may be resolved without asking the player, and how. Decided from numbers both
 * sides hold, never from anything the server could be asked to trust. The server's own revision check stays as it was: the browser only
 * re-bases on the revision it is told about.
 *
 *   - `ahead`: this browser's game is the same game and at least as far along (cloud revision above the link's; cloud not ahead in play time, level
 *     or tiles; same rebirth). Uploading over it loses nothing.
 *   - `overwrite`: the account's save continued from this browser's link (revision above the link's) but holds more than this browser's game, and
 *     nobody has saved it for `QUIET_MS`: the other session is gone, so this browser's game replaces it (owner decision). The server pins
 *     the replaced save in the history first (`losesProgress`), and the player is told. While the other session is still saving, the browser waits
 *     (`wait`), so two live sessions never trade overwrites.
 *   - `never`: the revision is not above the link's (a New Game elsewhere starts the revisions again): another game, the player chooses in the hub.
 *
 * @category Saves & Server/Uploading
 * @order 2
 * @formula continued = cloud.rev > link.rev; ahead = continued && cloud.playSeconds <= local.playSeconds && cloud.level <= local.level && cloud.tilesOwned <= local.tilesOwned && cloud.rebirths == local.rebirths; overwrite = continued && !ahead && now - cloud.serverSavedAt >= QUIET_MS
 */
export const judgeRebase = (
	link: Pick<CloudLink, 'rev'>,
	local: Progress,
	cloud: Progress,
	cloudRev: number,
	cloudSavedAt: number,
	now: number,
): 'ahead' | 'overwrite' | 'wait' | 'never' => {
	if (cloudRev <= link.rev) return 'never';
	const ahead =
		cloud.playSeconds <= local.playSeconds && cloud.level <= local.level && cloud.tilesOwned <= local.tilesOwned && cloud.rebirths === local.rebirths;
	if (ahead) return 'ahead';
	return now - cloudSavedAt >= QUIET_MS ? 'overwrite' : 'wait';
};
