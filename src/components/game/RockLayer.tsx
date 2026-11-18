import React, { useEffect } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { useRockStore, type RockBurst } from '@/stores/rockStore';
import '@/styles/Rocks.css';

// The break effect of a rock (IDL-376): a flash, a spray of chips in the colour of the stone, and a few pieces (stone, coal and what else came out) that are thrown out of the rock and fall. Purely a picture of what the server already paid.

const LIFE_MS = 1500;
const STONE = '/pixel/icons/stone.png';
const COAL = '/pixel/icons/coal.png';
const CHIP_COLOURS: Record<RockBurst['tier'], string[]> = {
	common: ['#8b867a', '#a8a293', '#6f6a60'],
	uncommon: ['#b9c4cf', '#8f9aa8', '#e6edf3'],
	rare: ['#e3b64a', '#b87333', '#f2d98d'],
	epic: ['#9ad8ff', '#c9a4ff', '#e9f6ff'],
};

/** A small repeatable pseudo-random number from a seed, so a burst looks the same on every render. */
const rand = (seed: number): number => {
	const s = Math.sin(seed * 12.9898) * 43758.5453;
	return s - Math.floor(s);
};

/** The picture of an ingredient from the crafting bag key (`ing_ember_coal` -> the junk art of the same name) */
const stashArt = (key: string): string => `/pixel/items/junk/junk_${key.replace(/^ing_/, '')}.png`;

const piecesOf = (burst: RockBurst): string[] =>
	[STONE, STONE, ...(burst.stone > 0 ? [STONE] : []), COAL, ...(burst.coal > 0 ? [COAL] : []), ...Object.keys(burst.stash).map(stashArt)].slice(0, 8);

const Burst: React.FC<{ burst: RockBurst }> = ({ burst }) => {
	const drop = useRockStore((s) => s.dropBurst);
	useEffect(() => {
		const id = setTimeout(() => drop(burst.id), LIFE_MS);
		return () => clearTimeout(id);
	}, [burst.id, drop]);
	const colours = CHIP_COLOURS[burst.tier];
	const thrown = piecesOf(burst);
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
			{thrown.map((src, i) => {
				const dir = thrown.length === 1 ? 0 : (i / (thrown.length - 1)) * 2 - 1;
				const style = {
					'--dx': `${dir * 34 + (rand(burst.id + i) - 0.5) * 10}px`,
					'--up': `${-26 - rand(burst.id * 3 + i) * 12}px`,
					'--down': `${14 + rand(burst.id * 5 + i) * 6}px`,
					'--t': `${850 + rand(i + burst.id) * 250}ms`,
					'--delay': `${i * 35}ms`,
				} as React.CSSProperties;
				return (
					<span key={`p${i}`} className='rock-fx-x' style={style}>
						<span className='rock-fx-y' style={style}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img className='rock-fx-piece' src={src} alt='' />
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
