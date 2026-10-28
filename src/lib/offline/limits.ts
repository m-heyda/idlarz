import { HARD_LIMITS } from '@/config/limits';
import { limitOf, type LimitContext } from '@/lib/limits';

// The three numbers that decide what an absence pays. Read through `limitOf`, so an upgrade only has to register a bonus in lib/limits.ts.

/** Hours of absence the kingdom works for the player (base 8, plus Night Watch), never above the hard ceiling. */
export const offlineCapHours = (ctx: LimitContext = {}): number => Math.min(HARD_LIMITS.offlineCapHours, limitOf('offlineCapHours', ctx));

export const offlineCapSec = (ctx: LimitContext = {}): number => offlineCapHours(ctx) * 3600;

/** Share (0-1) of the normal income an away second pays (base 50 %, plus Steward). */
export const offlineEfficiency = (ctx: LimitContext = {}): number => Math.min(HARD_LIMITS.offlineEfficiency, limitOf('offlineEfficiency', ctx));

/** Absences shorter than this pay nothing. */
export const offlineMinGapSec = (ctx: LimitContext = {}): number => limitOf('offlineMinGapSec', ctx);
