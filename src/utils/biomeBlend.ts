import { CASTLE_FORTRESS } from '@/config/gameConfig';
import type { Tile } from '@/types/game';

/**
 * Soft biome transitions. A tile that borders a different ground draws a strip of the NEIGHBOUR's ground
 * texture through a dithered mask (public/pixel/bg/blend_<piece>_<variant>.png, built by scripts/pixel/blend_art.py).
 *   n/e/s/w   : the neighbour on that side differs
 *   ne/se/sw/nw: only the diagonal neighbour differs (inner corner)
 * Special seams use coloured trims instead (scripts/pixel/trim_art.py): water <-> land get a foam + beach shoreline
 * ('shore-land' / 'shore-water'), and yard / castle tiles get a stone kerb ('curb-yard' / 'curb-castle') on every side
 * facing a different ground. Unexplored neighbours blend in the cloud texture ('mystery').
 */
export type BlendPiece = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw';

export interface BlendSpec {
	piece: BlendPiece;
	/** ground key of the source texture: a biome, 'yard' or 'mystery' */
	ground: string;
	variant: number;
}

export const BLEND_VARIANTS = 3;
const UNEXPLORED = 'mystery';

const SIDES: [BlendPiece, number, number][] = [
	['n', 0, -1],
	['e', 1, 0],
	['s', 0, 1],
	['w', -1, 0],
];
const DIAGONALS: [BlendPiece, number, number, BlendPiece, BlendPiece][] = [
	['ne', 1, -1, 'n', 'e'],
	['se', 1, 1, 's', 'e'],
	['sw', -1, 1, 's', 'w'],
	['nw', -1, -1, 'n', 'w'],
];

/** One jitter variant per SEAM, so both tiles that share it pick the same one (keyed on the lower/right tile). */
function variantFor(x: number, y: number, piece: BlendPiece): number {
	switch (piece) {
		case 'n':
			return (x * 7 + y * 13) % BLEND_VARIANTS;
		case 's':
			return (x * 7 + (y + 1) * 13) % BLEND_VARIANTS;
		case 'w':
			return (x * 11 + y * 5) % BLEND_VARIANTS;
		case 'e':
			return ((x + 1) * 11 + y * 5) % BLEND_VARIANTS;
		default:
			return (x * 3 + y * 5) % BLEND_VARIANTS;
	}
}

/** The ground an owned tile is drawn with; null when it is not owned. */
export function groundOf(tile: Tile | undefined): string | null {
	if (!tile || !tile.isOwned) return null;
	if (tile.biome === 'castle' && (tile.level ?? 1) >= CASTLE_FORTRESS.fromLevel) return 'yard'; // the fortress stands on cobbles
	return tile.biome === 'grounds' && tile.building && (tile.level ?? 1) > 1 ? 'yard' : tile.biome;
}

const CURBED = ['yard', 'castle'];

/** What a tile of ground `me` draws toward a differing owned neighbour of ground `nb`. */
function pairGround(me: string, nb: string): string {
	if ((me === 'lake') !== (nb === 'lake')) return me === 'lake' ? 'shore-water' : 'shore-land';
	return nb;
}

export function getBlendPieces(tiles: Tile[][] | undefined, x: number, y: number): BlendSpec[] {
	const me = groundOf(tiles?.[y]?.[x]);
	if (!tiles || !me) return [];

	const inGrid = (cx: number, cy: number) => !!tiles[cy]?.[cx];
	const ground = (cx: number, cy: number) => groundOf(tiles[cy]?.[cx]);
	const curbed = CURBED.includes(me);
	const spec = (piece: BlendPiece, g: string): BlendSpec => ({
		piece,
		ground: g,
		// kerbs are straight: a single variant
		variant: g.startsWith('curb-') ? 0 : variantFor(x, y, piece),
	});

	const out: BlendSpec[] = [];
	for (const [piece, dx, dy] of SIDES) {
		if (!inGrid(x + dx, y + dy)) continue;
		const nb = ground(x + dx, y + dy);
		if (curbed) {
			if (nb !== me) out.push(spec(piece, `curb-${me}`));
		} else if (nb === null) {
			out.push(spec(piece, UNEXPLORED));
		} else if (nb !== me && !CURBED.includes(nb)) {
			out.push(spec(piece, pairGround(me, nb)));
		}
	}
	for (const [piece, dx, dy, a, b] of DIAGONALS) {
		const [, ax, ay] = SIDES.find(([p]) => p === a)!;
		const [, bx, by] = SIDES.find(([p]) => p === b)!;
		if (ground(x + ax, y + ay) !== me || ground(x + bx, y + by) !== me) continue;
		const nb = ground(x + dx, y + dy);
		if (!nb || nb === me) continue;
		if (curbed) out.push(spec(piece, `curb-${me}`));
		else if (!CURBED.includes(nb)) out.push(spec(piece, pairGround(me, nb)));
	}
	return out;
}

/**
 * Compact string form of getBlendPieces. Tile subscribes to this instead of the whole tiles array, so it
 * re-renders only when its own transitions change (strings compare by value in zustand's default equality).
 */
export function blendKey(tiles: Tile[][] | undefined, x: number, y: number): string {
	return getBlendPieces(tiles, x, y)
		.map((p) => `${p.piece}:${p.ground}:${p.variant}`)
		.join(',');
}

export function parseBlendKey(key: string): BlendSpec[] {
	if (!key) return [];
	return key.split(',').map((part) => {
		const [piece, ground, variant] = part.split(':');
		return { piece: piece as BlendPiece, ground, variant: Number(variant) };
	});
}

/** Sides of an owned tile that face land we don't own (or the map edge): only those keep the pixel bevel. */
export function openSides(tiles: Tile[][] | undefined, x: number, y: number): string {
	if (!tiles?.[y]?.[x]?.isOwned) return '';
	return SIDES.filter(([, dx, dy]) => !tiles[y + dy]?.[x + dx]?.isOwned)
		.map(([p]) => p)
		.join('');
}
