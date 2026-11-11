import React from 'react';
import { cn } from '@/lib/utils';

interface LevelBadgeProps {
	level: number | string;
	/** Side of the square in px (the number scales with it) */
	size?: number;
	className?: string;
}

/**
 * The hero's level as a plain purple square with a thin border and a minimal shadow, the number inside. It sits on the corner of the avatar (the hero card and the header); the glass level orb is kept for the Equipment tab and the level-up popup.
 */
const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 28, className }) => (
	<span className={cn('level-badge', className)} style={{ '--lb': `${size}px` } as React.CSSProperties} role='img' aria-label={`Level ${level}`}>
		{level}
	</span>
);

export default LevelBadge;
