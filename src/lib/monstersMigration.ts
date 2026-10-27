// Schema 4 -> 5: monsters have a level instead of a tier. A rat of tier t was level 2t - 1 in the loot tables (1, 3, 5, 7, 9) and
// becomes a level 2t - 1 rat that appeared at that level; the Rat King becomes a level 15 boss. The age restarts at 0, so a
// monster grows again from where it stands. Anything that is not a plain old monster is left as it is (sanitizeSave refuses it).
//
// FROZEN like every migration: the numbers below are the old tiers' levels, not the live config.

type Body = Record<string, unknown>;

const isRecord = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v);

const KING_LEVEL = 15;

const convertMonster = (m: unknown): unknown => {
	if (!isRecord(m) || !('tier' in m) || 'level' in m) return m;
	const { tier, ...rest } = m;
	const level = m.type === 'ratKing' ? KING_LEVEL : typeof tier === 'number' && Number.isInteger(tier) && tier >= 1 && tier <= 5 ? 2 * tier - 1 : null;
	if (level === null) return m;
	return { ...rest, level, spawnLevel: level, ageSec: 0 };
};

export const convertMonstersBody = (body: Body): Body => (Array.isArray(body.monsters) ? { ...body, monsters: body.monsters.map(convertMonster) } : body);
