import React, { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { chooseBadge, fetchBadges } from '@/lib/authClient';
import { BADGE_NONE, badgeOptions, shownBadge, titleOptions } from '@/catalog/badges';
import audioManager from '@/utils/audioManager';
import PixelModal from './PixelModal';
import AchievementBadge from './AchievementBadge';

/** Loads the badge choice into the store once per session (the Character window and this dialog both call it). */
export const useBadgeChoice = (): void => {
	const loaded = useUiStore((state) => state.badge.loaded);
	useEffect(() => {
		if (loaded) return;
		void fetchBadges().then((state) => {
			if (state) useUiStore.getState().setBadge(state);
		});
	}, [loaded]);
};

/**
 * The badge and title picker (Equipment window, "Badge" button). The badge is any achievement badge the account has earned, or none at all ("Hide badge"); the title is one of the earned titles. A pick shows at once and is saved on the profile
 * (`POST /api/auth/badge`), which is what the landing and the rankings read; a refusal puts the previous choice back and shows why.
 */
const BadgeDialog: React.FC = () => {
	const open = useUiStore((state) => state.badgeDialogOpen);
	const close = useUiStore((state) => state.closeBadgeDialog);
	const badge = useUiStore((state) => state.badge);
	const setBadge = useUiStore((state) => state.setBadge);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setError(null);
		void fetchBadges().then((state) => state && useUiStore.getState().setBadge(state));
	}, [open]);

	if (!open) return null;

	const save = async (next: { badgeId: string | null; titleId: string | null }) => {
		const before = badge;
		audioManager.playSound('click');
		setError(null);
		setBadge({ ...next, earned: before.earned });
		const result = await chooseBadge(next.badgeId, next.titleId);
		if (!result.ok) {
			setBadge(before);
			setError(result.message);
		}
	};

	const badges = badgeOptions(badge.earned);
	const titles = titleOptions(badge.earned);
	const shown = shownBadge(badge.badgeId, badge.earned);

	return (
		<PixelModal title='Badge and title' size='md' onClose={close}>
			<p className='text-[#a89878] text-sm mb-4 text-center'>Shown next to your name in the game and in the rankings. You can hide the badge completely.</p>

			<div className='px-h text-center mb-2'>Badge</div>
			<div className='avatar-grid' data-testid='badge-grid'>
				{badges.map((a) => (
					<button
						key={a.id}
						type='button'
						className='avatar-card'
						data-selected={shown?.id === a.id}
						onClick={() => void save({ badgeId: a.id, titleId: badge.titleId })}
					>
						<AchievementBadge achievement={a} size={40} />
						<span className='avatar-card-name'>{a.title}</span>
					</button>
				))}
				<button
					type='button'
					className='avatar-card'
					data-selected={badge.badgeId === BADGE_NONE}
					onClick={() => void save({ badgeId: BADGE_NONE, titleId: badge.titleId })}
				>
					<span className='avatar-card-soon-art'>✕</span>
					<span className='avatar-card-name'>Hide badge</span>
				</button>
			</div>
			{badges.length === 0 && <p className='text-xs text-[#a89878] text-center mt-2'>Earn achievements to unlock badges.</p>}

			<div className='px-h text-center mt-5 mb-2'>Title</div>
			<div className='avatar-grid' data-testid='title-grid'>
				<button
					type='button'
					className='avatar-card'
					data-selected={badge.titleId === null}
					onClick={() => void save({ badgeId: badge.badgeId, titleId: null })}
				>
					<span className='avatar-card-name'>No title</span>
				</button>
				{titles.map((t) => (
					<button
						key={t.id}
						type='button'
						className='avatar-card'
						data-selected={badge.titleId === t.id}
						onClick={() => void save({ badgeId: badge.badgeId, titleId: t.id })}
					>
						<span className='avatar-card-name'>{t.name}</span>
					</button>
				))}
			</div>

			{error && (
				<p role='alert' className='text-sm text-center text-[#e07a6a] mt-3'>
					{error}
				</p>
			)}
		</PixelModal>
	);
};

export default BadgeDialog;
