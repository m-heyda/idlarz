/**
 * How big a roster monster's picture is drawn on the map, in px (a tile is TILE_SIZE = 48 wide). The supplied art is about 64 px and
 * fills its frame, so a creature looks small or large by what it is, not by the file: tune the odd ones here, client side only.
 * Used by the map lab's work-in-progress monsters; the rats keep their own sheet size.
 */
export const MONSTER_ART_SIZE = {
	normal: 48,
	boss: 66,
	/** Per monster id (catalog/monsters.ts); wins over the grade default */
	byId: {
		// small creatures that disappear at the default size
		frostHare: 54,
		burrowBadger: 54,
		dustStrider: 52,
		wreckCrab: 52,
		netGull: 52,
		brambleImp: 52,
		mossSnapper: 52,
		reedNymph: 52,
		// already big or tall: the default is plenty
		garbageOgre: 50,
		thistleBoar: 49,
		mossbackWolf: 49,
		icetuskCalf: 50,
	} as Record<string, number>,
} as const;

export const monsterArtSize = (id: string, grade: 'normal' | 'boss'): number => MONSTER_ART_SIZE.byId[id] ?? MONSTER_ART_SIZE[grade];
