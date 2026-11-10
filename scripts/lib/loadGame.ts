// The game's config and maths as one merged object each, for the scripts that read and override them by name (scripts/sim.ts).
// Loaded late (dynamic import): the store needs a localStorage mock first, which the caller installs before calling these.

/** The config and the game maths as one object each (the sim reads and overrides them by name; they are loaded late because the store needs a localStorage mock first). */
export type GameConfig = typeof import('../../src/config/economy') &
	typeof import('../../src/config/resources') &
	typeof import('../../src/config/character') &
	typeof import('../../src/config/castle') &
	typeof import('../../src/config/biomes') &
	typeof import('../../src/config/merchant') &
	typeof import('../../src/config/farm') &
	typeof import('../../src/config/rebirth') &
	typeof import('../../src/config/spawns');
export type GameUtils = typeof import('../../src/utils/game/castle') &
	typeof import('../../src/utils/game/character') &
	typeof import('../../src/utils/game/costs') &
	typeof import('../../src/utils/game/farm') &
	typeof import('../../src/utils/game/income') &
	typeof import('../../src/utils/game/merchant') &
	typeof import('../../src/utils/game/rebirth') &
	typeof import('../../src/utils/game/tiles');
export const loadConfig = async (): Promise<GameConfig> =>
	Object.assign(
		{},
		await import('../../src/config/economy'),
		await import('../../src/config/resources'),
		await import('../../src/config/character'),
		await import('../../src/config/castle'),
		await import('../../src/config/biomes'),
		await import('../../src/config/merchant'),
		await import('../../src/config/farm'),
		await import('../../src/config/rebirth'),
		await import('../../src/config/spawns'),
	) as GameConfig;
export const loadUtils = async (): Promise<GameUtils> =>
	Object.assign(
		{},
		await import('../../src/utils/game/castle'),
		await import('../../src/utils/game/character'),
		await import('../../src/utils/game/costs'),
		await import('../../src/utils/game/farm'),
		await import('../../src/utils/game/income'),
		await import('../../src/utils/game/merchant'),
		await import('../../src/utils/game/rebirth'),
		await import('../../src/utils/game/tiles'),
	) as GameUtils;
