import React, { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { chooseBadge, fetchBadges } from '@/lib/authClient';
import { BADGE_NONE, badgeOptions, shownBadge, titleOptions } from '@/catalog/badges';
import audioManager from '@/utils/audioManager';
import GameModal from './GameModal';
import { SectionLabel } from '../../../packages/design-system/src/components/primitives';
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
 * The badge and title picker (Equipment window, "Badge" button). The badge is one of a few badges the account has earned (the tester medals and some milestones), or none at all ("Hide badge"); the title is one of the earned titles. A pick shows at once and is saved on the profile
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

	const save = async (next: { badgeId?: string | null; titleId?: string | null }) => {
		const before = badge;
		audioManager.playSound('click');
		setError(null);
		setBadge({
			badgeId: next.badgeId === undefined ? before.badgeId : next.badgeId,
			titleId: next.titleId === undefined ? before.titleId : next.titleId,
			earned: before.earned,
		});
		// only the part that changed is sent: the other keeps what the server has stored
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
		<GameModal title='Badge and title' size='md' onClose={close}>
			<p className='ds-dim' style={{ textAlign: 'center', margin: '0 0 10px' }}>
				Shown next to your name in the game and in the rankings. You can hide the badge completely.
			</p>

			<SectionLabel>Badge</SectionLabel>
			<div className='ds-pick-grid' data-testid='badge-grid'>
				{badges.map((a) => (
					<button key={a.id} type='button' className='ds-pick' data-selected={shown?.id === a.id} onClick={() => void save({ badgeId: a.id })}>
						<AchievementBadge achievement={a} size={40} />
						<span>{a.title}</span>
					</button>
				))}
				<button type='button' className='ds-pick' data-selected={badge.badgeId === BADGE_NONE} onClick={() => void save({ badgeId: BADGE_NONE })}>
					<span className='ds-pick-none'>✕</span>
					<span>Hide badge</span>
				</button>
			</div>
			{badges.length === 0 && (
				<p className='ds-dim' style={{ fontSize: 12, textAlign: 'center' }}>
					Earn achievements to unlock badges.
				</p>
			)}

			<div style={{ marginTop: 14 }}>
				<SectionLabel>Title</SectionLabel>
			</div>
			<div className='ds-pick-grid' data-testid='title-grid'>
				<button type='button' className='ds-pick' data-selected={badge.titleId === null} onClick={() => void save({ titleId: null })}>
					<span>No title</span>
				</button>
				{titles.map((t) => (
					<button key={t.id} type='button' className='ds-pick' data-selected={badge.titleId === t.id} onClick={() => void save({ titleId: t.id })}>
						<span>{t.name}</span>
					</button>
				))}
			</div>

			{error && (
				<p role='alert' style={{ textAlign: 'center', color: '#ff7a6a', margin: '10px 0 0' }}>
					{error}
				</p>
			)}
		</GameModal>
	);
};

export default BadgeDialog;
