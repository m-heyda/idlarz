import React from 'react';
import { BadgePic } from '../../../packages/design-system/src/components/composites';
import { badgePicSrc, type BadgeInfo } from '@/catalog/badges';

/** One badge picture, shown next to a name (the Character window) and in the badge picker: an achievement's medal, or the admin's animated octopus. */
const AchievementBadge: React.FC<{ achievement: BadgeInfo; size?: number }> = ({ achievement, size = 24 }) => (
	<BadgePic src={badgePicSrc(achievement.badge)} size={size} label={achievement.title} className='early-tester-badge pixelated' />
);

export default AchievementBadge;
