import React from 'react';
import { achievementById } from '@/catalog/achievements';

export const BETA_TESTER_ID = 'beta_tester';
export const EARLY_TESTER_ID = 'early_tester';

/** Who wears the tester medal: the Beta tester achievement, or the Early tester one (everyone who holds Early tester also gets Beta tester, an older answer may carry only the early id). */
export const holdsTesterBadge = (earned: readonly string[]): boolean => earned.includes(BETA_TESTER_ID) || earned.includes(EARLY_TESTER_ID);

/** The Beta tester medal shown next to a name (the Character window and the landing's Continue card); the caller decides who has earned it (`holdsTesterBadge`). */
const BetaTesterBadge: React.FC<{ size?: number }> = ({ size = 24 }) => (
	// eslint-disable-next-line @next/next/no-img-element
	<img
		className='early-tester-badge pixelated'
		src={`/pixel/new_assets/achievements/${achievementById(BETA_TESTER_ID)?.badge ?? 'badge_early_tester_wireframe'}.png`}
		alt='Beta tester'
		title='Beta tester'
		width={size}
		height={size}
		draggable={false}
	/>
);

export default BetaTesterBadge;
