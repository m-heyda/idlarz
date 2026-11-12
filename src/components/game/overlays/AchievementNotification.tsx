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
		<div className='relative px-toast achv-toast text-[#ffe27a] py-2 px-4 flex items-center gap-3 cursor-pointer' role='status' onClick={onClose}>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`/pixel/new_assets/achievements/${def.badge}.png`}
				alt=''
				width={56}
				height={56}
				className='shrink-0 achv-badge'
				style={{ imageRendering: 'pixelated' }}
			/>
			<div className='flex flex-col'>
				<span className='achv-congrats'>Congratulations!</span>
				<span className='text-lg font-semibold whitespace-nowrap'>{def.title}</span>
				<span className='text-xs text-[#d8c8a0]'>{def.description}</span>
				<span className='text-xs text-[#a89878]'>
					{deed && deed.tiers.length > 1 ? `${deed.title} · ` : ''}
					{gives.length > 0 ? `Claim ${gives.join(' and ')} in the Hall of Deeds` : 'Claim it in the Hall of Deeds'}
				</span>
			</div>
		</div>
	);
};

export default AchievementNotification;
