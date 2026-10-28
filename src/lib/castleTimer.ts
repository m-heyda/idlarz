import { formatTime } from '@/utils/formatters';
import type { CastleUpgradeState } from '@/types/game';

/** The short text of the castle upgrade timer ("2h 5m", "4m 10s"), or null when no upgrade is running. A started upgrade never shows less than 1 s. */
export const castleTimerLabel = (upgrade: Pick<CastleUpgradeState, 'remainingSec'> | null): string | null =>
	upgrade ? formatTime(Math.max(1, Math.ceil(upgrade.remainingSec))) : null;
