import type { LimitContext } from '@/lib/limits';
import { isRecord } from '@/lib/isRecord';
import type { PrestigeState } from '@/types/game';

/** The Embers (shop levels) a stored save holds, as the shared rules read them (`undefined` when the save has none): the server reads every shop effect from the last accepted save, never from the upload. */
export const prestigeOfCore = (core: Record<string, unknown>): PrestigeState | undefined =>
	isRecord(core.prestige) ? (core.prestige as unknown as PrestigeState) : undefined;

/** The limit context the monster growth interval is read with on the server (Wild Growth, an Ember shop level): the stored save's Embers. Every server `levelAtAge` call passes it, so the queue, the fight and the payout use the level the browser shows. */
export const growthLimits = (stored: { core: Record<string, unknown> }): LimitContext => ({ prestige: prestigeOfCore(stored.core) });
