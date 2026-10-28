// Schema 5 -> 6: the character level curve changed (levels are much slower, see LEVELING in the config) and level, XP and attributes carry
// over a rebirth. A save keeps its XP, so its level is re-derived on the new curve (it drops), and the attribute points follow the new
// level: the five attributes go back to their start value and every point the new level has earned is left to spend again (a refund of the
// ones spent). Anything that is not a plain character record is left as it is (sanitizeSave refuses it).
//
// Not frozen like the older migrations: it reads the live curve (calculateLevel, totalStatPoints), because the point of it is to put the
// save on the curve the game runs on. sanitizeSave derives the level from the XP in the same way, so the two always agree.

import { INITIAL_CHARACTER_STATS } from '@/config/gameConfig';
import { calculateLevel, totalStatPoints } from '@/utils/gameUtils';

type Body = Record<string, unknown>;

const isRecord = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v);

const ATTRIBUTES = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

export const convertLevelsBody = (body: Body): Body => {
	if (!isRecord(body.resources) || typeof body.resources.xp !== 'number' || !Number.isFinite(body.resources.xp) || !isRecord(body.characterStats)) return body;
	const { level } = calculateLevel(body.resources.xp);
	const characterStats: Body = { ...body.characterStats };
	for (const key of ATTRIBUTES) characterStats[key] = INITIAL_CHARACTER_STATS[key];
	characterStats.availablePoints = totalStatPoints(level);
	return { ...body, characterStats };
};
