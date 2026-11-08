/** The slash effects drawn over the fight stage (public/fx/slash, built by scripts/fx/build_slash_sheets.py): one-row sprite sheets of equal frames. */
export const SLASH_FRAME = { w: 240, h: 180 } as const;

export const SLASH_SHEETS = {
	ultimate: { frames: 20, ms: 520 },
	wind: { frames: 18, ms: 480 },
	fire: { frames: 12, ms: 420 },
	lightning: { frames: 12, ms: 420 },
	water: { frames: 12, ms: 420 },
	poison: { frames: 24, ms: 560 },
} as const;

export type SlashName = keyof typeof SLASH_SHEETS;

/** One effect playing on the stage; `onHero` is a bite or swing of the monster (drawn low, mirrored), else a blow on the monster */
export interface SlashFx {
	id: number;
	name: SlashName;
	onHero: boolean;
	/** Mirror the swing, so blows come from alternating sides */
	mirror: boolean;
}

/** Which effect a hit gets: plain blows alternate between the two light slashes, a crit burns, a super crit strikes with lightning, a stun splashes */
export const slashFor = (kind: 'hit' | 'crit' | 'super' | 'hurt' | 'stun', n: number): SlashName =>
	kind === 'crit' ? 'fire' : kind === 'super' ? 'lightning' : kind === 'hurt' ? 'poison' : kind === 'stun' ? 'water' : n % 2 ? 'wind' : 'ultimate';
