import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { GRID_SIZE, GRID_HEIGHT, TILE_SIZE } from '@/config/gameConfig';
import { allPads, buildGroundGrid, builtSet, terrainKey } from '@/utils/terrain';
import { drawTerrain, loadTerrainAssets, type TerrainAssets } from '@/lib/terrainRenderer';

/**
 * The map's ground: one canvas behind the tiles (see terrainRenderer.ts). It is redrawn only when the terrain itself
 * changes (a purchase, a yard upgrade, rebirth, load), never on pan / zoom or when a chest toggles.
 */
const TerrainLayer: React.FC = () => {
	const tiles = useGameStore((state) => state.tiles);
	const key = useMemo(() => terrainKey(tiles), [tiles]);
	const tilesRef = useRef(tiles);
	tilesRef.current = tiles;
	const canvasRef = useRef<HTMLCanvasElement>(null);
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

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !tilesRef.current) return;
		const raf = requestAnimationFrame(() => drawTerrain(canvas, assets, buildGroundGrid(tilesRef.current), allPads(tilesRef.current), builtSet(tilesRef.current)));
		return () => cancelAnimationFrame(raf);
	}, [key, assets]);

	return (
		<canvas
			ref={canvasRef}
			className={`terrain-canvas${assets ? ' terrain-ready' : ''}`}
			width={GRID_SIZE * TILE_SIZE}
			height={GRID_HEIGHT * TILE_SIZE}
			aria-hidden
		/>
	);
};

export default TerrainLayer;
