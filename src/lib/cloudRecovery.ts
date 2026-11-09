import type { CloudLink } from '@/lib/startPlan';

/** The numbers of a game that say how far along it is. Both the local game and the account's cloud save are reduced to these. */
export interface Progress {
	playSeconds: number;
	level: number;
	tilesOwned: number;
	rebirths: number;
}

/**
 * Whether a refused upload (409, "the account has a newer save") may be resolved without asking the player: this browser's game is the same
 * game as the account's save and is at least as far along, so uploading it on top of the cloud revision loses nothing. Decided from numbers
 * both sides hold, never from anything the server could be asked to trust:
 *
 *   - the cloud revision is above the one this browser's link holds (the account's save continued from the one this browser knew; a New Game
 *     on another device starts the revisions again and is never "continued"), and
 *   - the cloud save is not ahead in play time, level or tiles, and is in the same rebirth (a higher rebirth count is another run).
 *
 * Anything else (the cloud is ahead in any of them, or the rebirths differ) is a real divergence: the player chooses in the hub and nothing is
 * overwritten. The server's own revision check stays as it was; this only lets the browser re-base on the revision it is told about.
 *
 * @category Saves & Server/Uploading
 * @order 2
 * @formula recover = cloud.rev > link.rev && cloud.playSeconds <= local.playSeconds && cloud.level <= local.level && cloud.tilesOwned <= local.tilesOwned && cloud.rebirths == local.rebirths
 */
export const canRebase = (link: Pick<CloudLink, 'rev'>, local: Progress, cloud: Progress, cloudRev: number): boolean =>
	cloudRev > link.rev &&
	cloud.playSeconds <= local.playSeconds &&
	cloud.level <= local.level &&
	cloud.tilesOwned <= local.tilesOwned &&
	cloud.rebirths === local.rebirths;
