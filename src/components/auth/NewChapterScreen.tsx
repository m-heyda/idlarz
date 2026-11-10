'use client';

import React, { useEffect, useState } from 'react';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { GAME_TITLE } from '@/config/branding';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { startChapter, fetchAvatars, type Profile } from '@/lib/authClient';
import { STARTER_AVATAR_IDS } from '@/catalog/avatars';
import AvatarPicker from '@/components/game/AvatarPicker';
import PixelModal from '@/components/game/PixelModal';
import PixelIcon from '@/components/game/PixelIcon';
import '@/styles/Heroes.css';

interface Props {
	/** The account's current hero: the name and class start as they are, the player may change both (free, once, here) */
	profile: Profile;
	/** The reset is done (the old game is archived): the page reloads into a new game */
	onDone: () => void;
	onLogout: () => void;
}

const NOOP = () => {};

/**
 * The "A new chapter" screen (IDL-76): shown before the save hub to an account whose game is on an older data epoch (`needsReset` from /api/auth/me). It says what
 * happens (the old game is archived and the game starts over; account, name and gems stay), lets the player pick a hero and fix the name, and confirms with
 * `POST /api/auth/epoch`. It also carries the avatar picker (IDL-71): what the account has unlocked comes from `GET /api/auth/avatar`, the server checks the pick again. The tutorial joins with IDL-74. Nobody sees it while `GAME_EPOCH` is the baseline (config/epoch.ts).
 */
const NewChapterScreen: React.FC<Props> = ({ profile, onDone, onLogout }) => {
	const [name, setName] = useState(profile.characterName);
	const [playerClass, setPlayerClass] = useState<PlayerClassId>(profile.playerClass);
	const [avatarId, setAvatarId] = useState<string | null>(profile.avatarId ?? null);
	const [unlocked, setUnlocked] = useState<readonly string[]>(STARTER_AVATAR_IDS);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const ready = name.trim() !== '' && !busy;

	useEffect(() => {
		let alive = true;
		void fetchAvatars().then((state) => alive && state && setUnlocked(state.unlocked));
		return () => {
			alive = false;
		};
	}, []);

	const confirm = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!ready) return;
		setBusy(true);
		setError(null);
		const result = await startChapter(name.trim(), playerClass, avatarId);
		setBusy(false);
		if (result.status === 'ok') return onDone();
		setError(result.status === 'unavailable' ? 'The server could not be reached. Nothing was changed; try again in a moment.' : result.message);
	};

	return (
		<div className='fixed inset-0 bg-[#14100c]'>
			<PixelModal title='A new chapter' size='md' hideClose closeOnBackdrop={false} onClose={NOOP}>
				<form onSubmit={confirm} className='flex flex-col gap-3'>
					<p className='text-[#d8c8a0] text-sm text-center'>
						{GAME_TITLE} starts a new chapter. Your old game is archived and kept safe, and your realm begins again. Your account, your name and your gems stay
						with you.
					</p>
					<input
						type='text'
						className='px-input'
						placeholder={`Character name (${CHARACTER_NAME_MAX} chars max)`}
						maxLength={CHARACTER_NAME_MAX}
						value={name}
						onChange={(e) => setName(e.target.value)}
						aria-label='Character name'
					/>
					<p className='text-[#a89878] text-sm text-center'>Choose your hero.</p>
					<div className='class-grid' role='radiogroup' aria-label='Hero'>
						{PLAYER_CLASS_ORDER.map((id) => {
							const info = PLAYER_CLASSES[id];
							const selected = id === playerClass;
							return (
								<button
									key={id}
									type='button'
									role='radio'
									aria-checked={selected}
									className='class-card'
									data-selected={selected}
									style={{ '--accent': info.accent } as React.CSSProperties}
									onClick={() => setPlayerClass(id)}
								>
									<span className='class-card-stage'>
										<PixelIcon name={info.full} scale={2} alt={`${info.race} ${info.label}`} />
									</span>
									<span className='class-card-name'>{info.label}</span>
									<span className='class-card-race'>{info.race}</span>
									<span className='class-card-tag'>{selected ? 'Chosen' : 'Choose'}</span>
								</button>
							);
						})}
					</div>
					<p className='text-[#a89878] text-sm text-center'>Choose your avatar.</p>
					<AvatarPicker value={avatarId} unlocked={unlocked} onChange={setAvatarId} />
					{error && (
						<p role='alert' className='text-sm text-center text-[#e07a6a]'>
							{error}
						</p>
					)}
					<div className='flex justify-center'>
						<button type='submit' className='px-btn' disabled={!ready}>
							{busy ? 'Archiving your old game...' : 'Begin the new chapter'}
						</button>
					</div>
					<button type='button' className='text-xs text-[#a89878] underline self-center' onClick={onLogout}>
						Log out
					</button>
				</form>
			</PixelModal>
		</div>
	);
};

export default NewChapterScreen;
