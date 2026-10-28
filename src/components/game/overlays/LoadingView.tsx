import React from 'react';
import '@/styles/LoadingScreen.css';

// 12 rune ticks around the outer ring
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * Hydration splash: a rune circle drawn as smooth SVG and pushed through an SVG "block" filter
 * so it renders as chunky pixels (it keeps rotating, so the pixels re-form every frame), with the
 * castle growing through its six levels in the middle, fog drifting behind and a stone bar below.
 */
const LoadingView: React.FC = () => {
	return (
		<div className='loading-screen' role='status' aria-label='Loading'>
			<div className='fog-layer fog-a' />
			<div className='fog-layer fog-b' />

			<div className='loading-stage'>
				<svg className='loading-runes' viewBox='0 0 400 400' width='400' height='400' aria-hidden>
					<defs>
						{/* one-sample-per-6px tile + dilate = a 6px pixel grid over whatever it filters */}
						<filter id='px-block' x='0' y='0' width='400' height='400' filterUnits='userSpaceOnUse'>
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
								<rect
									key={deg}
									x='196'
									y='6'
									width='8'
									height='14'
									fill='#ffe27a'
									transform={`rotate(${deg} 200 200)`}
								/>
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
				Building your kingdom<span className='loading-dots' />
			</h1>

			<div className='loading-bar'>
				<div className='loading-bar-fill' />
			</div>

			<div className='loading-tips'>
				<span>Click the map to earn a little gold</span>
				<span>Neighbouring tiles of one biome boost each other</span>
				<span>Upgrade your castle for a bonus on every resource</span>
			</div>
		</div>
	);
};

export default LoadingView;
