import { isRecord } from '@/lib/isRecord';
import type { PrestigeState } from '@/types/game';

/** The Embers (shop levels) a stored save holds, as the shared rules read them (`undefined` when the save has none): the server reads every shop effect from the last accepted save, never from the upload. */
export const prestigeOfCore = (core: Record<string, unknown>): PrestigeState | undefined =>
	isRecord(core.prestige) ? (core.prestige as unknown as PrestigeState) : undefined;
