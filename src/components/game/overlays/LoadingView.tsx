import React, { useEffect, useState } from 'react';
import '@/styles/LoadingScreen.css';

/** The monsters that take turns on the loading card (art under public/pixel/enemies) */
const MONSTERS: { name: string; src: string }[] = [
	{ name: 'Burrow Badger', src: '/pixel/enemies/plains/burrow-badger.png' },
	{ name: 'Thistle Boar', src: '/pixel/enemies/plains/thistle-boar.png' },
	{ name: 'Dust Strider', src: '/pixel/enemies/plains/dust-strider.png' },
	{ name: 'Mossback Wolf', src: '/pixel/enemies/forest/mossback-wolf.png' },
	{ name: 'Bramble Imp', src: '/pixel/enemies/forest/bramble-imp.png' },
	{ name: 'Rotcap Stag', src: '/pixel/enemies/forest/rotcap-stag.png' },
	{ name: 'Wreck Crab', src: '/pixel/enemies/coast/wreck-crab.png' },
	{ name: 'Net Gull', src: '/pixel/enemies/coast/net-gull.png' },
	{ name: 'Moss Snapper', src: '/pixel/enemies/lake/moss-snapper.png' },
	{ name: 'Rot Heron', src: '/pixel/enemies/swamp/rot-heron.png' },
	{ name: 'Frost Hare', src: '/pixel/enemies/tundra/frost-hare.png' },
];

/** Hints shown on the card, one with each monster */
const TIPS = [
	'Click the map to earn a little gold.',
	'Neighbouring tiles of one biome boost each other.',
	'Upgrade your castle for a bonus on every resource.',
	'Right-click a tile, a monster or a bag item to see what you can do with it.',
	'Double-click a bag item to equip or drink it; Shift + click sells it.',
	'Golden monsters pay much better rewards.',
	'Bosses come with a time limit: bring your best gear.',
	'Idols keep their level when you rebirth.',
	'Claim finished deeds in the Deeds window for gems.',
	'Merchant upgrades are permanent: they stay through a rebirth.',
	'The farm needs food: keep it fed and it pays you back.',
];

const SWAP_MS = 4200;

// 12 rune ticks around the outer ring
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * Hydration splash: a rune circle drawn as smooth SVG and pushed through an SVG "block" filter
 * so it renders as chunky pixels (it keeps rotating, so the pixels re-form every frame), with the
 * castle growing through its ten levels in the middle, fog drifting behind and a stone bar below.
 */
const LoadingView: React.FC = () => {
	// the first card is fixed (the server render and the first client render agree); after that the monsters come in random order, never the same one twice in a row
	const [card, setCard] = useState({ monster: 0, tip: 0 });
	useEffect(() => {
		setCard({ monster: Math.floor(Math.random() * MONSTERS.length), tip: Math.floor(Math.random() * TIPS.length) });
		const id = setInterval(() => {
			setCard((c) => {
				const monster = (c.monster + 1 + Math.floor(Math.random() * (MONSTERS.length - 1))) % MONSTERS.length;
				const tip = (c.tip + 1 + Math.floor(Math.random() * (TIPS.length - 1))) % TIPS.length;
				return { monster, tip };
			});
		}, SWAP_MS);
		return () => clearInterval(id);
	}, []);
	const monster = MONSTERS[card.monster];
	return (
		<div className='loading-screen' role='status' aria-label='Loading'>
			<div className='fog-layer fog-a' />
			<div className='fog-layer fog-b' />

			<div className='loading-stage'>
				<svg className='loading-runes' viewBox='0 0 400 400' width='320' height='320' aria-hidden>
					<defs>
						{/* one-sample-per-6px tile + dilate = a 6px pixel grid over whatever it filters */}
						<filter id='px-block' x='0' y='0' width='320' height='320' filterUnits='userSpaceOnUse'>
							<feFlood x='3' y='3' width='1' height='1' />
							<feComposite width='6' height='6' />
							<feTile result='grid' />
							<feComposite in='SourceGraphic' in2='grid' operator='in' />
							<feMorphology operator='dilate' radius='3' />
						</filter>
						<radialGradient id='loading-glow' cx='50%' cy='50%' r='50%'>
							<stop offset='0%' stopColor='#ffe9a0' stopOpacity='0.9' />
							<stop offset='40%' stopColor='#c8882a' stopOpacity='0.4' />
							<stop offset='100%' stopColor='#2a1a40' stopOpacity='0' />
						</radialGradient>
					</defs>
					<g filter='url(#px-block)'>
						<circle cx='200' cy='200' r='196' fill='url(#loading-glow)' />
						<g className='rune-ring rune-a'>
							<circle cx='200' cy='200' r='176' fill='none' stroke='#f0d27a' strokeWidth='7' strokeDasharray='3 11 40 11' />
							<circle cx='200' cy='200' r='154' fill='none' stroke='#a070f0' strokeWidth='6' strokeDasharray='70 16 8 16' />
							{TICKS.map((deg) => (
								<rect key={deg} x='196' y='6' width='8' height='14' fill='#ffe27a' transform={`rotate(${deg} 200 200)`} />
							))}
						</g>
						<g className='rune-ring rune-b'>
							<circle cx='200' cy='200' r='124' fill='none' stroke='#f0d27a' strokeWidth='5' strokeDasharray='12 9' />
							<polygon points='200,86 299,257 101,257' fill='none' stroke='#b890ff' strokeWidth='5' />
							<polygon points='200,314 101,143 299,143' fill='none' stroke='#b890ff' strokeWidth='5' />
						</g>
					</g>
				</svg>

				<div className='loading-castle' />

				<div className='loading-sparks' aria-hidden>
					{[8, 22, 38, 54, 70, 86].map((x, i) => (
						<i key={x} style={{ left: `${x}%`, animationDelay: `${i * 0.45}s` }} />
					))}
				</div>
			</div>

			<h1 className='loading-title'>
				<i className='loading-rule' aria-hidden />
				<span>
					Building your kingdom
					<span className='loading-dots' />
				</span>
				<i className='loading-rule flip' aria-hidden />
			</h1>

			<div className='loading-bar'>
				<div className='loading-bar-fill' />
			</div>

			<div className='loading-card' aria-live='off'>
				<div className='loading-card-art' key={`art-${card.monster}`}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={monster.src} alt='' width={72} height={72} draggable={false} />
				</div>
				<div className='loading-card-text' key={`tip-${card.tip}`}>
					<span className='loading-card-kicker'>Tip · {monster.name}</span>
					<span>{TIPS[card.tip]}</span>
				</div>
			</div>
		</div>
	);
};

export default LoadingView;
