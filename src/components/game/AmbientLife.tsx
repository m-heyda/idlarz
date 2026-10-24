import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AMBIENT_LIFE } from '@/config/gameConfig';
import { nextSpawnDelay, pickAmbientCritter, type AmbientCritter, type Viewport } from '@/lib/ambientLife';
import { queueTileTap } from '@/lib/floatText';
import audioManager from '@/utils/audioManager';
import { CRITTER_SHEETS } from './overlays/MeadowLayer';
import type { FarmCritterType } from '@/config/gameConfig';
import '@/styles/Ambient.css';

/** Sprite sheets of every ambient critter: the four farm critters plus the decorative fish, frog, crab, goat and wolf (2 frames each). */
const AMBIENT_SHEETS: Record<AmbientCritter['type'], { name: string; w: number; h: number; ms: number }> = {
	...CRITTER_SHEETS,
	fish: { name: 'bonus_fish', w: 32, h: 22, ms: 260 },
	frog: { name: 'bonus_frog', w: 26, h: 22, ms: 600 },
	crab: { name: 'bonus_crab', w: 30, h: 20, ms: 420 },
	goat: { name: 'bonus_goat', w: 36, h: 32, ms: 460 },
	wolf: { name: 'bonus_wolf', w: 38, h: 30, ms: 380 },
};

/**
 * Little animals wandering over your land. Decorative, except the rare golden one which can be clicked for a
 * small gift (the store decides the amount and enforces a cooldown). Switched off in Settings, while the tab is
 * hidden and for people who prefer reduced motion.
 */
const AmbientLife: React.FC<{ getViewport: () => Viewport }> = ({ getViewport }) => {
	const enabled = useSettingsStore((state) => state.ambientLife);
	const tiles = useGameStore((state) => state.tiles);
	const claimCritterGift = useGameStore((state) => state.claimCritterGift);
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
		timer = setTimeout(spawn, 1500);
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
						data-gift={c.golden}
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
						<div
							className='amb-move'
							role={c.golden ? 'button' : undefined}
							aria-label={c.golden ? 'Golden critter - click for a gift' : undefined}
							onClick={(e) => {
								if (!c.golden || !e.isTrusted) return;
								const gift = claimCritterGift(
									{ source: 'map', type: c.type as FarmCritterType, golden: true },
									{ eventId: e.nativeEvent.timeStamp, now: performance.now(), trusted: e.nativeEvent.isTrusted }
								);
								if (gift) {
									queueTileTap([{ resource: gift.resource, amount: gift.amount }], true);
									audioManager.playSound('click');
									remove(c.id);
								}
							}}>
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
