import React, { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { chooseBadge, chooseNameColor, fetchBadges } from '@/lib/authClient';
import { BADGE_NONE, badgeOptions, shownBadge, shownTitle, titleOptions } from '@/catalog/badges';
import { NICK_COLORS, NICK_GOLD, NICK_RAINBOW, NICK_RAINBOW_ITEM, inkOn, nickColorValue } from '@/config/nickColors';
import { gemItemById } from '@/config/gemShop';
import { useGemStore } from '@/stores/gemStore';
import GemIcon from './GemIcon';
import audioManager from '@/utils/audioManager';
import GameModal from './GameModal';
import { Button, SectionLabel } from '../../../packages/design-system/src/components/primitives';
import { NickName } from '../../../packages/design-system/src/components/composites';
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
 * The name, badge and title window (click the name, the title or the badge in the Character window). Two columns: on the left the nickname colour (fourteen colours, locked until "Name colours" is bought in the Gem shop; the animated Rainbow is bought right here; the admin account, and every development build, has all of them plus the gold nickname with glowing stars),
 * on the right the title and the badge (earned ones only; the badge can be hidden). A pick shows at once and is saved on the profile (`POST /api/auth/badge`), which is what the landing page and the rankings read; a refusal puts the previous choice back and shows why.
 */
const BadgeDialog: React.FC = () => {
	const open = useUiStore((state) => state.badgeDialogOpen);
	const close = useUiStore((state) => state.closeBadgeDialog);
	const toggleGemShop = useUiStore((state) => state.toggleGemShop);
	const badge = useUiStore((state) => state.badge);
	const setBadge = useUiStore((state) => state.setBadge);
	const playerName = useGameStore((state) => state.playerName);
	const [error, setError] = useState<string | null>(null);
	/** A colour tried on the preview while the picker is locked (hover or click): never saved */
	const [tried, setTried] = useState<string | null | undefined>(undefined);
	const [hovered, setHovered] = useState<string | null | undefined>(undefined);

	useEffect(() => {
		if (!open) return;
		setError(null);
		setTried(undefined);
		setHovered(undefined);
		void fetchBadges().then((state) => state && useUiStore.getState().setBadge(state));
	}, [open]);

	if (!open) return null;

	const save = async (next: { badgeId?: string | null; titleId?: string | null }) => {
		const before = badge;
		audioManager.playSound('click');
		setError(null);
		setBadge({
			...before,
			badgeId: next.badgeId === undefined ? before.badgeId : next.badgeId,
			titleId: next.titleId === undefined ? before.titleId : next.titleId,
		});
		// only the part that changed is sent: the other keeps what the server has stored
		const result = await chooseBadge(next.badgeId, next.titleId);
		if (!result.ok) {
			setBadge(before);
			setError(result.message);
		}
	};

	/** Whether a colour is still locked for this account (it can only be tried on the preview) */
	const lockedColor = (id: string | null): boolean =>
		id === null || id === NICK_GOLD ? false : id === NICK_RAINBOW ? !badge.rainbowUnlocked : !badge.colorsUnlocked;

	/** A locked colour only previews (the name above changes, nothing is stored or sent) */
	const pickColor = async (nameColor: string | null) => {
		if (lockedColor(nameColor)) {
			audioManager.playSound('click');
			setTried(nameColor);
			return;
		}
		setTried(undefined);
		await saveColor(nameColor);
	};

	/** Buys the Rainbow name from here (the server charges and refuses a short balance), then reads the unlocks again */
	const buyRainbow = async () => {
		setError(null);
		const reply = await useGemStore.getState().buy(NICK_RAINBOW_ITEM);
		if (!reply?.ok) {
			setError(reply?.message ?? 'The purchase did not go through.');
			return;
		}
		const state = await fetchBadges();
		if (state) setBadge(state);
		setTried(undefined);
	};

	const saveColor = async (nameColor: string | null) => {
		const before = badge;
		audioManager.playSound('click');
		setError(null);
		setBadge({ ...before, nameColor });
		const result = await chooseNameColor(nameColor);
		if (!result.ok) {
			setBadge(before);
			setError(result.message);
		}
	};

	const goToShop = () => {
		close();
		toggleGemShop();
	};

	const badges = badgeOptions(badge.earned);
	const titles = titleOptions(badge.earned);
	const shown = shownBadge(badge.badgeId, badge.earned);
	const title = shownTitle(badge.titleId, badge.earned);
	const locked = !badge.colorsUnlocked;
	const rainbowPrice = gemItemById(NICK_RAINBOW_ITEM)?.price ?? 0;
	const previewColor = hovered !== undefined ? hovered : tried !== undefined && lockedColor(tried) ? tried : badge.nameColor;

	return (
		<GameModal title='Name, badge and title' width={1080} onClose={close}>
			<div className='ds-nick-preview' data-testid='nick-preview'>
				<NickName color={nickColorValue(previewColor)}>{playerName}</NickName>
				{title && <span className='ds-nick-preview-title'>({title})</span>}
				{shown && (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={`/pixel/new_assets/achievements/${shown.badge}.png`} alt={shown.title} width={28} height={28} className='pixelated' />
				)}
			</div>
			<p className='ds-dim' style={{ textAlign: 'center', margin: '0 0 12px' }}>
				Shown next to your name in the game, on the landing page and in the rankings.
			</p>

			<div className='ds-badge-cols'>
				<section data-testid='color-section'>
					<SectionLabel>Name colour</SectionLabel>
					{locked && (
						<div className='ds-lock-banner' data-testid='color-locked'>
							<span>🔒 Name colours are locked. Click a colour to try it on, unlock all fourteen for good in the Gem shop.</span>
							<Button tone='gold' onClick={goToShop}>
								Open Gem shop
							</Button>
						</div>
					)}
					<div className='ds-swatch-grid' data-testid='color-grid' onMouseLeave={() => setHovered(undefined)}>
						{NICK_COLORS.map((color) => (
							<button
								key={color.id}
								type='button'
								className='ds-swatch'
								style={{ ['--swatch' as string]: color.hex, ['--ink' as string]: inkOn(color.hex) }}
								data-selected={previewColor === color.id}
								aria-disabled={locked}
								onMouseEnter={() => setHovered(color.id)}
								onClick={() => void pickColor(color.id)}
								title={color.name}
							>
								{color.name}
							</button>
						))}
						<button
							type='button'
							className='ds-swatch ds-swatch-default'
							data-selected={previewColor === null}
							onMouseEnter={() => setHovered(null)}
							onClick={() => void pickColor(null)}
							title='No colour: the normal text colour'
						>
							No colour
						</button>
						<button
							type='button'
							className='ds-swatch ds-swatch-rainbow'
							data-selected={previewColor === NICK_RAINBOW}
							aria-disabled={!badge.rainbowUnlocked}
							onMouseEnter={() => setHovered(NICK_RAINBOW)}
							onClick={() => void pickColor(NICK_RAINBOW)}
							title='Animated rainbow'
						>
							Rainbow
						</button>
						{badge.admin && (
							<button
								type='button'
								className='ds-swatch ds-swatch-gold'
								data-selected={previewColor === NICK_GOLD}
								onMouseEnter={() => setHovered(NICK_GOLD)}
								onClick={() => void saveColor(NICK_GOLD)}
								title='Gold with glowing stars (admin)'
							>
								Gold
							</button>
						)}
					</div>
					{!badge.rainbowUnlocked && (
						<div className='ds-lock-banner' data-testid='rainbow-locked'>
							<span>🌈 Rainbow name: an animated nickname that shifts through every colour.</span>
							<Button tone='gold' onClick={() => void buyRainbow()}>
								Unlock {rainbowPrice} <GemIcon />
							</Button>
						</div>
					)}
				</section>

				<section>
					<SectionLabel>Title</SectionLabel>
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

					<div style={{ marginTop: 14 }}>
						<SectionLabel>Badge</SectionLabel>
					</div>
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
				</section>
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
