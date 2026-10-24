import React from 'react';
import { cn } from '@/lib/utils';
import { MONSTER_SHEETS } from '@/config/pixelIcons';
import type { MonsterType } from '@/types/game';
import '@/styles/Monsters.css';

/** A monster's 2-frame idle sheet at an integer scale (frame 1 / frame 2 swap every half second). */
const MonsterArt: React.FC<{ type: MonsterType; scale?: number; label?: string; className?: string }> = ({
	type,
	scale = 1,
	label,
	className,
}) => {
	const { name, w, h } = MONSTER_SHEETS[type];
	return (
		<span
			className={cn('monster-art', className)}
			role={label ? 'img' : undefined}
			aria-label={label}
			style={
				{
					width: w * scale,
					height: h * scale,
					backgroundImage: `url('/pixel/icons/${name}.png')`,
					backgroundSize: `${w * 2 * scale}px ${h * scale}px`,
					'--sheet-w': `${w * 2 * scale}px`,
					'--frame-ms': '520ms',
				} as React.CSSProperties
			}
		/>
	);
};

export default MonsterArt;
