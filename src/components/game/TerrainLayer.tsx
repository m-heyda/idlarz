import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CHUNK_TILES, chunkOf, chunkSignature } from '@/utils/terrain';
import { ownedBounds, type World } from '@/utils/world';
import { CHUNK_CANVAS_PX, CHUNK_PX, drawChunk, drawChunkFlat, loadTerrainAssets, scheduleDraw, type TerrainAssets } from '@/lib/terrainRenderer';
import { useMapGame } from './mapSource';

/**
 * The map's ground: one canvas per chunk of CHUNK_TILES x CHUNK_TILES tiles, behind the tiles (see terrainRenderer.ts), and
 * only for the chunks on or just off the screen, so the map can be any size. A chunk is redrawn only when its own picture
 * changes (a purchase next to it, a yard upgrade, rebirth, load), never on pan / zoom or when a chest toggles.
 */
interface TerrainLayerProps {
	/** Visible tile range (inclusive-exclusive) */
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/** A chunk shows terrain when explored land (plus its one-tile mist ring) is within reach of its tiles. */
const chunkHasLand = (world: World, cx: number, cy: number): boolean => {
	const b = ownedBounds(world);
	if (!b) return false;
	return (
		b.maxX + 1 >= cx * CHUNK_TILES &&
		b.minX - 1 < (cx + 1) * CHUNK_TILES &&
		b.maxY + 1 >= cy * CHUNK_TILES &&
		b.minY - 1 < (cy + 1) * CHUNK_TILES
	);
};

interface ChunkProps {
	cx: number;
	cy: number;
	tiles: World;
	assets: TerrainAssets | null;
}

const TerrainChunk: React.FC<ChunkProps> = React.memo(({ cx, cy, tiles, assets }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const tilesRef = useRef(tiles);
	tilesRef.current = tiles;
	const fullyDrawn = useRef(false);
	const signature = useMemo(() => chunkSignature(tiles, cx, cy), [tiles, cx, cy]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		// flat colours first, but never over a finished picture (that would flash on every purchase)
		if (!fullyDrawn.current) drawChunkFlat(canvas, tilesRef.current, cx, cy);
		if (!assets) return;
		return scheduleDraw(() => {
			drawChunk(canvas, assets, tilesRef.current, cx, cy);
			fullyDrawn.current = true;
		});
	}, [signature, assets, cx, cy]);

	return (
		<canvas
			ref={canvasRef}
			className={`terrain-canvas${assets ? ' terrain-ready' : ''}`}
			style={{ left: cx * CHUNK_PX, top: cy * CHUNK_PX }}
			width={CHUNK_CANVAS_PX}
			height={CHUNK_CANVAS_PX}
			aria-hidden
		/>
	);
});
TerrainChunk.displayName = 'TerrainChunk';

const TerrainLayer: React.FC<TerrainLayerProps> = React.memo(({ minX, maxX, minY, maxY }) => {
	const game = useMapGame();
	const tiles = game((state) => state.tiles);
	const [assets, setAssets] = useState<TerrainAssets | null>(null);

	useEffect(() => {
		let alive = true;
		loadTerrainAssets()
			.then((a) => alive && setAssets(a))
			.catch(() => undefined); // the flat fallback colours stay
		return () => {
			alive = false;
		};
	}, []);

	// the chunks on screen plus a ring around them, so a drag never shows an undrawn edge
	const c0x = chunkOf(minX) - 1;
	const c1x = chunkOf(maxX - 1) + 1;
	const c0y = chunkOf(minY) - 1;
	const c1y = chunkOf(maxY - 1) + 1;
	const chunks: { cx: number; cy: number }[] = [];
	for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) if (chunkHasLand(tiles, cx, cy)) chunks.push({ cx, cy });

	return (
		<>
			{chunks.map(({ cx, cy }) => (
				<TerrainChunk key={`${cx},${cy}`} cx={cx} cy={cy} tiles={tiles} assets={assets} />
			))}
		</>
	);
});
TerrainLayer.displayName = 'TerrainLayer';

export default TerrainLayer;
