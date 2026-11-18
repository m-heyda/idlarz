import React, { useMemo } from 'react';
import { DeedsPanel } from '../../../packages/design-system/src/views/deeds';
import { bonusLine, deedViewsOf, DEED_CATEGORIES, milestoneViewsOf, TOTAL_DEED_POINTS, waitingCount, type DeedsInput } from '@/lib/deedsView';
import { useAchievementStore } from '@/stores/achievementStore';
import GameWindow from './GameWindow';

/**
 * The Hall of Deeds (IDL-321, replaces the flat Achievements list): categories, tags and sorting, tier crystals, progress, Claim per tier and Claim all (one request, also for a single waiting reward), the deed point milestones and the
 * bonus they give. Everything shown is the server's report (`useAchievementStore`); a claim is one request the server judges, and the points and milestones count only after the claim.
 */
const DeedsWindow: React.FC = () => {
	const earned = useAchievementStore((s) => s.earned);
	const claimed = useAchievementStore((s) => s.claimed);
	const earnedAt = useAchievementStore((s) => s.earnedAt);
	const claimedAt = useAchievementStore((s) => s.claimedAt);
	const milestonesClaimed = useAchievementStore((s) => s.milestonesClaimed);
	const progress = useAchievementStore((s) => s.progress);
	const points = useAchievementStore((s) => s.points);
	const busy = useAchievementStore((s) => s.busy !== null);
	const claim = useAchievementStore((s) => s.claim);
	const claimAll = useAchievementStore((s) => s.claimAll);
	const input: DeedsInput = useMemo(
		() => ({ earned, claimed, earnedAt, claimedAt, milestonesClaimed, progress, points }),
		[earned, claimed, earnedAt, claimedAt, milestonesClaimed, progress, points],
	);
	const deeds = useMemo(() => deedViewsOf(input), [input]);
	const milestones = useMemo(() => milestoneViewsOf(input), [input]);
	return (
		<GameWindow id='achievements' title='Hall of Deeds' width={1120} height={700}>
			<DeedsPanel
				deeds={deeds}
				milestones={milestones}
				points={points}
				totalPoints={TOTAL_DEED_POINTS}
				bonusText={bonusLine(input)}
				categories={DEED_CATEGORIES}
				claimable={waitingCount(input)}
				busy={busy}
				onClaim={(id) => void claim(id)}
				onClaimAll={() => void claimAll()}
			/>
		</GameWindow>
	);
};

export default DeedsWindow;
