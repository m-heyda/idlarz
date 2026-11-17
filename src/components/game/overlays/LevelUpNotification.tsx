import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useHydration } from '@/hooks/useHydration';
import audioManager from '@/utils/audioManager';
import '@/styles/LevelUpNotification.css';

const AUTO_CLOSE_MS = 9000;
const RAYS = Array.from({ length: 16 }, (_, i) => i * 22.5);
const TITLE = 'LEVEL UP!'.split('');

// Sparks that burst out of the orb: angle, distance, size and a small stagger
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
	a: (i / 30) * 360 + (i % 3) * 7,
	d: 150 + ((i * 53) % 190),
	s: i % 4 === 0 ? 10 : 6,
	t: (i % 7) * 0.06,
	violet: i % 3 === 0,
}));

/**
 * Level-up celebration: a white flash, pixelated god-rays turning behind a big purple number that pops in with the
 * new level, shockwave rings, a crimson banner whose letters drop in, a burst of sparks and the points earned.
 */
const LevelUpNotification: React.FC = () => {
	const level = useGameStore((state) => state.level.level);
	const isHydrated = useHydration();
	const [shown, setShown] = useState<{ level: number; gained: number } | null>(null);
	const prevLevel = useRef<number | null>(null);

	useEffect(() => {
		if (!isHydrated) return;
		if (prevLevel.current === null) {
			prevLevel.current = level; // first look after hydration: never celebrate a loaded save
			return;
		}
		if (level > prevLevel.current) {
			setShown({ level, gained: level - prevLevel.current });
			audioManager.playSound('purchase');
		}
		prevLevel.current = level;
	}, [level, isHydrated]);

	useEffect(() => {
		if (!shown) return;
		const t = setTimeout(() => setShown(null), AUTO_CLOSE_MS);
		return () => clearTimeout(t);
	}, [shown]);

	if (!shown) return null;

	return (
		<div className='lu-root' onClick={() => setShown(null)} role='alertdialog' aria-label='Level up'>
			<div className='lu-shade' />

			<svg className='lu-rays' viewBox='0 0 800 800' aria-hidden>
				<defs>
					{/* one sample per 6px + dilate = chunky pixels over the smooth rays (same trick as the loading screen) */}
					<filter id='lu-block' x='0' y='0' width='800' height='800' filterUnits='userSpaceOnUse'>
						<feFlood x='3' y='3' width='1' height='1' />
						<feComposite width='6' height='6' />
						<feTile result='grid' />
						<feComposite in='SourceGraphic' in2='grid' operator='in' />
						<feMorphology operator='dilate' radius='3' />
					</filter>
					<radialGradient id='lu-ray-gold' cx='400' cy='400' r='400' gradientUnits='userSpaceOnUse'>
						<stop offset='0' stopColor='#fff2a0' stopOpacity='0.95' />
						<stop offset='0.55' stopColor='#ffcf4a' stopOpacity='0.45' />
						<stop offset='1' stopColor='#ffb020' stopOpacity='0' />
					</radialGradient>
					<radialGradient id='lu-ray-violet' cx='400' cy='400' r='400' gradientUnits='userSpaceOnUse'>
						<stop offset='0' stopColor='#e2c4ff' stopOpacity='0.8' />
						<stop offset='0.55' stopColor='#9a56e8' stopOpacity='0.4' />
						<stop offset='1' stopColor='#6a2cc8' stopOpacity='0' />
					</radialGradient>
				</defs>
				<g filter='url(#lu-block)'>
					<g className='lu-spin'>
						{RAYS.map((deg, i) => (
							<polygon key={deg} points='400,400 372,0 428,0' fill={i % 2 ? 'url(#lu-ray-violet)' : 'url(#lu-ray-gold)'} transform={`rotate(${deg} 400 400)`} />
						))}
					</g>
				</g>
			</svg>

			<div className='lu-rings' aria-hidden>
				<i />
				<i />
				<i />
			</div>

			<div className='lu-particles' aria-hidden>
				{PARTICLES.map((p, i) => (
					<i
						key={i}
						className={p.violet ? 'lu-p violet' : 'lu-p'}
						style={
							{
								'--a': `${p.a}deg`,
								'--d': `${p.d}px`,
								'--sz': `${p.s}px`,
								animationDelay: `${0.25 + p.t}s`,
							} as React.CSSProperties
						}
					/>
				))}
			</div>

			<div className='lu-flash' />

			<div className='lu-stage'>
				<div className='lu-orb'>
					<span className='lu-num'>{shown.level}</span>
				</div>

				<div className='lu-banner'>
					<span className='lu-cap left' />
					<span className='lu-mid'>
						<span className='lu-title'>
							{TITLE.map((ch, i) => (
								<span key={i} style={{ animationDelay: `${0.55 + i * 0.06}s` }}>
									{ch === ' ' ? ' ' : ch}
								</span>
							))}
						</span>
					</span>
					<span className='lu-cap right' />
				</div>

				<div className='lu-sub'>
					You reached <em>level {shown.level}</em>
				</div>
				<div className='lu-reward'>
					+{shown.gained} character point{shown.gained > 1 ? 's' : ''} to spend
				</div>
				<div className='lu-hint'>click anywhere to continue</div>
			</div>
		</div>
	);
};

export default LevelUpNotification;
