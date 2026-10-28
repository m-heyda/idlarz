import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AMBIENT_LIFE } from '@/config/gameConfig';
import { nextSpawnDelay, pickAmbientCritter, type AmbientCritter, type Viewport } from '@/lib/ambientLife';
import '@/styles/Ambient.css';

/** Sprite sheets of every ambient critter (2 frames each: flap / hop / swing), frame size in native px. */
const AMBIENT_SHEETS: Record<AmbientCritter['type'], { name: string; w: number; h: number; ms: number }> = {
	butterfly: { name: 'bonus_butterfly', w: 28, h: 28, ms: 320 },
	bee: { name: 'bonus_bee', w: 28, h: 26, ms: 140 },
	ladybug: { name: 'bonus_ladybug', w: 24, h: 22, ms: 500 },
	rabbit: { name: 'bonus_rabbit', w: 34, h: 34, ms: 520 },
	fish: { name: 'bonus_fish', w: 32, h: 22, ms: 260 },
	frog: { name: 'bonus_frog', w: 26, h: 22, ms: 600 },
	crab: { name: 'bonus_crab', w: 30, h: 20, ms: 420 },
	goat: { name: 'bonus_goat', w: 36, h: 32, ms: 460 },
	wolf: { name: 'bonus_wolf', w: 38, h: 30, ms: 380 },
};

/**
 * Little animals wandering over your land. Purely decorative: they take no clicks and give nothing. Switched off in
 * Settings, while the tab is hidden and for people who prefer reduced motion.
 */
const AmbientLife: React.FC<{ getViewport: () => Viewport }> = ({ getViewport }) => {
	const enabled = useSettingsStore((state) => state.ambientLife);
	const tiles = useGameStore((state) => state.tiles);
	const [critters, setCritters] = useState<AmbientCritter[]>([]);
	const tilesRef = useRef(tiles);
	tilesRef.current = tiles;

	const remove = useCallback((id: number) => setCritters((prev) => prev.filter((c) => c.id !== id)), []);

	useEffect(() => {
		if (!enabled || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			setCritters([]);
			return;
		}
		let timer: ReturnType<typeof setTimeout>;
		const spawn = () => {
			if (!document.hidden) {
				setCritters((prev) => {
					if (prev.length >= AMBIENT_LIFE.maxAlive) return prev;
					const critter = pickAmbientCritter(tilesRef.current, getViewport());
					if (!critter) return prev;
					setTimeout(() => remove(critter.id), critter.lifeMs);
					return [...prev, critter];
				});
			}
			timer = setTimeout(spawn, nextSpawnDelay());
		};
		timer = setTimeout(spawn, AMBIENT_LIFE.firstSpawnMs);
		return () => clearTimeout(timer);
	}, [enabled, getViewport, remove]);

	if (!enabled || critters.length === 0) return null;

	return (
		<>
			{critters.map((c) => {
				const sheet = AMBIENT_SHEETS[c.type];
				return (
					<div
						key={c.id}
						className='amb-critter'
						data-type={c.type}
						style={
							{
								left: c.x,
								top: c.y,
								'--dx': `${c.dx}px`,
								'--dy': `${c.dy}px`,
								'--f': c.flip ? -1 : 1,
								'--life': `${c.lifeMs}ms`,
							} as React.CSSProperties
						}>
						<div className='amb-move'>
							<span
								className='amb-sprite'
								style={
									{
										width: sheet.w,
										height: sheet.h,
										backgroundImage: `url('/pixel/icons/${sheet.name}.png')`,
										backgroundSize: `${sheet.w * 2}px ${sheet.h}px`,
										'--sheet-w': `${sheet.w * 2}px`,
										'--frame-ms': `${sheet.ms}ms`,
									} as React.CSSProperties
								}
							/>
						</div>
					</div>
				);
			})}
		</>
	);
};

export default AmbientLife;
