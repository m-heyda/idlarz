import React from 'react';
import { achievementById } from '@/catalog/achievements';

export const EARLY_TESTER_ID = 'early_tester';

/** The Early tester medal shown next to a name (the Character window and the landing's Continue card); the caller decides who has earned it. */
const EarlyTesterBadge: React.FC<{ size?: number }> = ({ size = 24 }) => (
	// eslint-disable-next-line @next/next/no-img-element
	<img
		className='early-tester-badge pixelated'
		src={`/pixel/new_assets/achievements/${achievementById(EARLY_TESTER_ID)?.badge ?? 'badge_early_tester_wireframe'}.png`}
		alt='Early tester'
		title='Early tester'
		width={size}
		height={size}
		draggable={false}
	/>
);

export default EarlyTesterBadge;
