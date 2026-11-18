import React, { useEffect } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { useRockStore, type RockBurst } from '@/stores/rockStore';
import { formatCompact } from '@/utils/formatters';
import '@/styles/Rocks.css';

// The break effect of a rock (IDL-376): a flash and a spray of chips in the colour of the stone, and the things the rock really gave: each one (stone, coal, every ingredient found) is thrown out of the rock, lands in a row on the ground with
// its amount under it, stays there for about a second and fades away. So the player sees exactly what dropped. Purely a picture of what the server already paid.

/** How long the whole effect lives: the throw, a second on the ground, the fade */
const LIFE_MS = 2200;
const STONE = '/pixel/icons/stone.png';
const COAL = '/pixel/icons/coal.png';
const CHIP_COLOURS: Record<RockBurst['tier'], string[]> = {
	common: ['#8b867a', '#a8a293', '#6f6a60'],
	uncommon: ['#b9c4cf', '#8f9aa8', '#e6edf3'],
	rare: ['#e3b64a', '#b87333', '#f2d98d'],
	epic: ['#9ad8ff', '#c9a4ff', '#e9f6ff'],
	legendary: ['#3b2f36', '#ff7a2a', '#ffb347'],
};

/** A small repeatable pseudo-random number from a seed, so a burst looks the same on every render. */
const rand = (seed: number): number => {
	const s = Math.sin(seed * 12.9898) * 43758.5453;
	return s - Math.floor(s);
};

/** The picture of an ingredient from the crafting bag key (`ing_ember_coal` -> the junk art of the same name) */
const stashArt = (key: string): string => `/pixel/items/junk/junk_${key.replace(/^ing_/, '')}.png`;

/** What the rock gave, as pictures with their amounts: the same things the notice lists. */
export const dropsOf = (burst: Pick<RockBurst, 'stone' | 'coal' | 'stash'>): { src: string; label: string }[] => [
	...(burst.stone > 0 ? [{ src: STONE, label: `+${formatCompact(burst.stone)}` }] : []),
	...(burst.coal > 0 ? [{ src: COAL, label: `+${formatCompact(burst.coal)}` }] : []),
	...Object.entries(burst.stash).map(([key, amount]) => ({ src: stashArt(key), label: `+${formatCompact(amount)}` })),
];

const Burst: React.FC<{ burst: RockBurst }> = ({ burst }) => {
	const drop = useRockStore((s) => s.dropBurst);
	useEffect(() => {
		const id = setTimeout(() => drop(burst.id), LIFE_MS);
		return () => clearTimeout(id);
	}, [burst.id, drop]);
	const colours = CHIP_COLOURS[burst.tier];
	const given = dropsOf(burst);
	return (
		<div className='rock-fx' style={{ left: burst.x * TILE_SIZE + TILE_SIZE / 2, top: burst.y * TILE_SIZE + TILE_SIZE * 0.6 }} aria-hidden>
			<i className='rock-fx-puff' />
			{Array.from({ length: 12 }, (_, i) => {
				const a = rand(burst.id * 31 + i) * Math.PI * 2;
				const d = 14 + rand(burst.id * 17 + i) * 22;
				const style = {
					'--dx': `${Math.cos(a) * d}px`,
					'--up': `${-8 - rand(burst.id + i * 5) * 16}px`,
					'--down': `${6 + Math.abs(Math.sin(a)) * 10}px`,
					'--t': `${520 + rand(i + burst.id) * 260}ms`,
					'--sz': `${3 + Math.floor(rand(i * 3 + burst.id) * 3)}px`,
					'--c': colours[i % colours.length],
					'--rot': `${rand(i + 7) * 360}deg`,
				} as React.CSSProperties;
				return (
					<span key={`c${i}`} className='rock-fx-x' style={style}>
						<span className='rock-fx-y' style={style}>
							<i className='rock-fx-chip' style={style} />
						</span>
					</span>
				);
			})}
			{given.map((item, i) => {
				// loose on the ground below the rock, each thrown out of it and landing in its own place: rows of three, 54 px apart, so neither the pictures nor their amounts touch
				const perRow = 3;
				const row = Math.floor(i / perRow);
				const inRow = Math.min(perRow, given.length - row * perRow);
				const dx = (i - row * perRow - (inRow - 1) / 2) * 54 + (rand(burst.id + i * 7) - 0.5) * 8;
				const style = {
					'--dx': `${dx}px`,
					'--up': `${-30 - rand(burst.id * 3 + i) * 10}px`,
					'--down': `${22 + row * 40}px`,
					'--t': `${LIFE_MS - 100}ms`,
					'--delay': `${i * 50}ms`,
				} as React.CSSProperties;
				return (
					<span key={`p${i}`} className='rock-drop-x' style={style}>
						<span className='rock-drop-y' style={style}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img className='rock-fx-piece' src={item.src} alt='' />
							<b className='rock-drop-label'>{item.label}</b>
						</span>
					</span>
				);
			})}
		</div>
	);
};

/** All the break effects playing now, in world pixels (mounted inside the map's world). */
const RockLayer: React.FC = () => {
	const bursts = useRockStore((s) => s.bursts);
	return (
		<>
			{bursts.map((burst) => (
				<Burst key={burst.id} burst={burst} />
			))}
		</>
	);
};

export default RockLayer;
