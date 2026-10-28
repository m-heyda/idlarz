import React from 'react';
import { cn } from '@/lib/utils';
import { CASTLE_FORTRESS, CASTLE_UPGRADE } from '@/config/gameConfig';
import { castleIconName } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';

interface CastleSpriteProps {
	level: number;
	/** `tile`: absolutely centred on its map tile and free to overflow onto neighbours.
	 *  `inline`: normal flow (dialogs). */
	variant?: 'tile' | 'inline';
	className?: string;
}

// Sparkles that drift up around a glowing castle (more of them the higher the level)
const SPARKS = [
	{ x: '18%', d: '0s' },
	{ x: '46%', d: '0.9s' },
	{ x: '74%', d: '1.7s' },
	{ x: '32%', d: '2.3s' },
	{ x: '60%', d: '0.4s' },
	{ x: '10%', d: '1.3s' },
	{ x: '84%', d: '2.1s' },
];

/** 0 for the first glowing level, +1 for every level above it. */
const castleTier = (level: number) => Math.max(0, level - CASTLE_UPGRADE.glowFromLevel);

/**
 * The castle for a given upgrade level. Levels 1-5 are ever bigger sprites; from `glowFromLevel` on it is the
 * 72px animated sheet (waving flags, pulsing crystal) whose glow, size and sparkles grow with each further level.
 */
const CastleSprite: React.FC<CastleSpriteProps> = ({ level, variant = 'tile', className }) => {
	const glowing = level >= CASTLE_UPGRADE.glowFromLevel;
	const inline = variant === 'inline';

	// Fortress levels: the castle is a keep on its own tile (the walls and towers are drawn by CastleFortress around the area)
	if (level >= CASTLE_FORTRESS.fromLevel) {
		return (
			<span
				role='img'
				aria-label={`Castle level ${level}`}
				className={cn('castle-sprite castle-keep', inline && 'castle-inline', className)}
			/>
		);
	}

	if (glowing) {
		const tier = castleTier(level);
		return (
			<span
				className={cn('castle-sprite castle-max', inline && 'castle-inline', className)}
				style={{ '--tier': tier } as React.CSSProperties}>
				{!inline &&
					SPARKS.slice(0, Math.min(SPARKS.length, 4 + Math.ceil(tier / 2))).map((s) => (
						<i key={s.x} className='castle-spark' style={{ '--x': s.x, '--d': s.d } as React.CSSProperties} />
					))}
			</span>
		);
	}

	return (
		<PixelIcon
			name={castleIconName(level)}
			alt={`Castle level ${level}`}
			className={cn('castle-sprite', inline && 'castle-inline', className)}
		/>
	);
};

export default CastleSprite;
