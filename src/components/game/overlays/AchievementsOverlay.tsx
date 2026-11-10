import React from 'react';
import { ACHIEVEMENTS, LOCKED_LABEL, type AchievementDef } from '@/catalog/achievements';
import { useAchievementStore } from '@/stores/achievementStore';
import GemIcon from '../GemIcon';

/** One row: an earned achievement shows its title, text and reward; a locked one shows '???' but still the gems it pays, so the player knows what is out there. */
export const AchievementRow: React.FC<{ def: AchievementDef; earned: boolean }> = ({ def, earned }) => (
	<li
		className={`flex items-center justify-between gap-3 px-3 py-2 border border-[#4a3a26] ${earned ? 'bg-[#2a2012] text-[#ecdcb4]' : 'bg-[#1a140c] text-[#7a6a52]'}`}
		data-earned={earned}
	>
		{/* eslint-disable-next-line @next/next/no-img-element */}
		<img
			src={`/pixel/new_assets/achievements/${def.badge}.png`}
			alt=''
			width={40}
			height={40}
			className='shrink-0'
			style={{ imageRendering: 'pixelated', ...(earned ? {} : { filter: 'brightness(0) opacity(0.35)' }) }}
		/>
		<div className='min-w-0 flex-1'>
			<div className='font-semibold'>{earned ? def.title : LOCKED_LABEL}</div>
			<div className='text-xs'>{earned ? def.description : LOCKED_LABEL}</div>
			{earned && (def.rewards.avatarId || def.rewards.titleId) && (
				<div className='text-xs text-[#9ac4ff]'>
					{[def.rewards.avatarId && 'Avatar unlocked', def.rewards.titleId && 'Title unlocked'].filter(Boolean).join(' · ')}
				</div>
			)}
		</div>
		<div className={`flex items-center gap-1 tabular-nums shrink-0 ${earned ? 'text-[#ffe27a]' : ''}`}>
			<span>
				{earned ? '' : '+'}
				{def.rewards.gems}
			</span>
			<GemIcon />
		</div>
	</li>
);

/** The Achievements window: the launch list, what the server has paid so far and what is still to find. */
export const AchievementList: React.FC<{ earned: readonly string[] }> = ({ earned }) => {
	const count = ACHIEVEMENTS.filter((a) => earned.includes(a.id)).length;
	return (
		<div className='text-sm space-y-2'>
			<div className='text-[#d8c8a0]'>
				{count} of {ACHIEVEMENTS.length} earned
			</div>
			<ul className='space-y-1'>
				{ACHIEVEMENTS.map((def) => (
					<AchievementRow key={def.id} def={def} earned={earned.includes(def.id)} />
				))}
			</ul>
		</div>
	);
};

const AchievementsOverlay: React.FC = () => {
	const earned = useAchievementStore((state) => state.earned);
	return <AchievementList earned={earned} />;
};

export default AchievementsOverlay;
