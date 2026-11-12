import React from 'react';
import { ACHIEVEMENTS, LOCKED_LABEL, type AchievementDef } from '@/catalog/achievements';
import { achievementRowState, claimableIds, type AchievementRowState, type AchievementViewInput } from '@/lib/achievementView';
import { useAchievementStore } from '@/stores/achievementStore';
import GemIcon from '../GemIcon';

/**
 * One row: an earned achievement shows its title, text, what it gives and a gold Claim button until it is claimed (then a muted 'Claimed' tag); a locked one shows '???' but still the gems it pays,
 * so the player knows what is out there. The log line under the text says when it was earned and claimed.
 */
export const AchievementRow: React.FC<{ def: AchievementDef; state: AchievementRowState; busy?: boolean; onClaim?: () => void }> = ({
	def,
	state,
	busy = false,
	onClaim,
}) => {
	const { earned } = state;
	const log = [state.earnedText, state.claimedText].filter(Boolean).join(' · ');
	return (
		<li
			className={`flex items-center justify-between gap-3 px-3 py-2 border border-[#4a3a26] ${earned ? 'bg-[#2a2012] text-[#ecdcb4]' : 'bg-[#1a140c] text-[#7a6a52]'}`}
			data-earned={earned}
			data-claimed={state.claimed}
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
				{log && <div className='text-xs text-[#9a8a6e]'>{log}</div>}
				{earned && (def.rewards.avatarId || def.rewards.titleId) && (
					<div className='text-xs text-[#9ac4ff]'>
						{[def.rewards.avatarId && 'Avatar unlocked', def.rewards.titleId && 'Title unlocked'].filter(Boolean).join(' · ')}
					</div>
				)}
			</div>
			<div className='flex flex-col items-end gap-1 shrink-0'>
				<div className={`flex items-center gap-1 tabular-nums ${earned && !state.claimed ? 'text-[#ffe27a]' : ''}`}>
					<span>
						{earned ? '' : '+'}
						{def.rewards.gems}
					</span>
					<GemIcon />
				</div>
				{state.canClaim && (
					<button type='button' className='px-btn px-btn-gold' disabled={busy || !onClaim} onClick={onClaim}>
						Claim
					</button>
				)}
				{state.claimed && <span className='text-xs text-[#7a6a52]'>Claimed</span>}
			</div>
		</li>
	);
};

/** The Achievements window: the launch list, what the server says is earned and claimed, and what is still to find. */
export const AchievementList: React.FC<{ report: AchievementViewInput; busy?: string | null; onClaim?: (id: string) => void }> = ({
	report,
	busy = null,
	onClaim,
}) => {
	const states = ACHIEVEMENTS.map((def) => ({ def, state: achievementRowState(report, def.id) }));
	const count = states.filter((s) => s.state.earned).length;
	const claimable = claimableIds(
		report,
		ACHIEVEMENTS.map((a) => a.id),
	);
	// one request for every waiting tier (all or nothing); the store has toasted why when the server refuses
	const claimAll = () => useAchievementStore.getState().claimAll();
	return (
		<div className='text-sm space-y-2'>
			<div className='flex items-center justify-between gap-2 text-[#d8c8a0]'>
				<span>
					{count} of {ACHIEVEMENTS.length} earned · {claimable.length} to claim
				</span>
				{claimable.length >= 2 && onClaim && (
					<button type='button' className='px-btn px-btn-gold' disabled={busy !== null} onClick={() => void claimAll()}>
						Claim all
					</button>
				)}
			</div>
			<ul className='space-y-1'>
				{states.map(({ def, state }) => (
					<AchievementRow key={def.id} def={def} state={state} busy={busy !== null} onClaim={onClaim ? () => onClaim(def.id) : undefined} />
				))}
			</ul>
		</div>
	);
};

const AchievementsOverlay: React.FC = () => {
	const earned = useAchievementStore((state) => state.earned);
	const claimed = useAchievementStore((state) => state.claimed);
	const earnedAt = useAchievementStore((state) => state.earnedAt);
	const claimedAt = useAchievementStore((state) => state.claimedAt);
	const busy = useAchievementStore((state) => state.busy);
	const claim = useAchievementStore((state) => state.claim);
	return <AchievementList report={{ earned, claimed, earnedAt, claimedAt }} busy={busy} onClaim={(id) => void claim(id)} />;
};

export default AchievementsOverlay;
