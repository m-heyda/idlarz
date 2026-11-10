'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CELL, CHUNK_TILES } from '@/utils/terrain';
import { CHUNK_CANVAS_PX, CHUNK_PX, drawChunk, loadTerrainAssets } from '@/lib/terrainRenderer';
import { LANDING_WORLD, buildLandingWorld } from '@/lib/landingWorld';

/**
 * /map-lab/landing-bake: draws the landing world (`lib/landingWorld`) with the real terrain renderer into one big canvas, one tile inside the world on every side, and offers it as a PNG.
 * Save the picture as `public/landing/map.png` (the landing page shows it). Dev tool only: nothing is sent anywhere.
 */
const LandingBake: React.FC = () => {
	const ref = useRef<HTMLCanvasElement>(null);
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		let live = true;
		(async () => {
			const assets = await loadTerrainAssets();
			const world = buildLandingWorld();
			const { width, height } = LANDING_WORLD;
			const out = ref.current;
			if (!out || !live) return;
			// the picture: tiles 1 .. width-2 / height-2 (the outer ring is only there so the sea has no edge)
			out.width = (width - 2) * CELL;
			out.height = (height - 2) * CELL;
			const ctx = out.getContext('2d');
			if (!ctx) return;
			ctx.imageSmoothingEnabled = false;
			const tmp = document.createElement('canvas');
			tmp.width = CHUNK_CANVAS_PX;
			tmp.height = CHUNK_CANVAS_PX;
			for (let cy = 0; cy <= Math.floor(height / CHUNK_TILES); cy++)
				for (let cx = 0; cx <= Math.floor(width / CHUNK_TILES); cx++) {
					drawChunk(tmp, assets, world, cx, cy);
					ctx.drawImage(tmp, cx * CHUNK_PX - CELL, cy * CHUNK_PX - CELL);
				}
			if (live) setUrl(out.toDataURL('image/png'));
		})();
		return () => {
			live = false;
		};
	}, []);

	return (
		<div style={{ padding: 16, background: '#111', color: '#eee', minHeight: '100vh' }}>
			<p>
				Landing map {LANDING_WORLD.width - 2} x {LANDING_WORLD.height - 2} tiles.{' '}
				{url ? (
					<a id='bake-download' href={url} download='map.png' style={{ color: '#f0d27a' }}>
						Download map.png
					</a>
				) : (
					'Drawing...'
				)}
			</p>
			<canvas ref={ref} style={{ width: '100%', imageRendering: 'pixelated' }} />
		</div>
	);
};

export default LandingBake;
