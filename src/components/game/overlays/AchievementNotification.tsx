import React, { useEffect } from 'react';
import { achievementById, deedOfAchievement } from '@/catalog/achievements';
import { playAchievementFanfare } from '@/utils/fanfare';
import '@/styles/ContextMenu.css';

interface Props {
	achievementId: string;
	onClose: () => void;
}

/**
 * The reward moment for an earned achievement (IDL-332): "Congratulations!", its badge, its title and what it gives, with a fanfare. It sits in the notice stack under the header and goes away by itself (a click closes it at once).
 * The rewards themselves wait for the Claim button in the Hall of Deeds, so the card says so.
 */
const AchievementNotification: React.FC<Props> = ({ achievementId, onClose }) => {
	const def = achievementById(achievementId);
	useEffect(() => {
		if (def) playAchievementFanfare();
	}, [def]);
	if (!def) return null;
	const deed = deedOfAchievement(achievementId);
	const gives = [def.rewards.gems ? `${def.rewards.gems} gems` : '', def.rewards.avatarId ? 'an avatar' : '', def.rewards.titleId ? 'a title' : ''].filter(
		Boolean,
	);
	return (
		<div className='ds-root ds-toast ds-toast-row achv-toast' role='status' style={{ cursor: 'pointer' }} onClick={onClose}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`/pixel/new_assets/achievements/${def.badge}.png`}
				alt=''
				width={44}
				height={44}
				className='achv-badge'
				style={{ imageRendering: 'pixelated', flexShrink: 0 }}
			/>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
				<span className='ds-toast-kicker'>Congratulations!</span>
				<span className='ds-toast-title'>{def.title}</span>
				<span>{def.description}</span>
				<span className='ds-toast-hint'>
					{deed && deed.tiers.length > 1 ? `${deed.title} · ` : ''}
					{gives.length > 0 ? `Claim ${gives.join(' and ')} in the Hall of Deeds` : 'Claim it in the Hall of Deeds'}
				</span>
			</div>
		</div>
	);
};

export default AchievementNotification;
