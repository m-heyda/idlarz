import React from 'react';
import type { AchievementDef } from '@/catalog/achievements';

/** One achievement's badge picture, shown next to a name (the Character window) and in the badge picker. */
const AchievementBadge: React.FC<{ achievement: AchievementDef; size?: number }> = ({ achievement, size = 24 }) => (
	// eslint-disable-next-line @next/next/no-img-element
	<img
		className='early-tester-badge pixelated'
		src={`/pixel/new_assets/achievements/${achievement.badge}.png`}
		alt={achievement.title}
		title={achievement.title}
		width={size}
		height={size}
		draggable={false}
	/>
);

export default AchievementBadge;
