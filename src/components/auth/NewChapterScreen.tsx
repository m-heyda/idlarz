'use client';

import React, { useEffect, useState } from 'react';
import type { PlayerClassId } from '@/config/playerClasses';
import { GAME_TITLE } from '@/config/branding';
import { startChapter, fetchAvatars, type Profile } from '@/lib/authClient';
import { STARTER_AVATAR_IDS } from '@/catalog/avatars';
import PixelModal from '@/components/game/PixelModal';
import HeroCreator from './HeroCreator';
import { creatorAvatar } from '@/catalog/avatars';

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
	const [avatarPick, setAvatarPick] = useState<string | null>(profile.avatarId ?? null);
	const [unlocked, setUnlocked] = useState<readonly string[]>(STARTER_AVATAR_IDS);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// the avatars an account has earned beyond the starters are extra choices next to the class's two
	const earned = unlocked.filter((id) => !STARTER_AVATAR_IDS.includes(id));
	// the kept avatar stays while it is one of the class's two or an earned one; otherwise the class's default
	const avatarId = creatorAvatar(playerClass, avatarPick, earned) as string;
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
					<HeroCreator
						name={name}
						onName={setName}
						playerClass={playerClass}
						onClass={(id) => {
							setPlayerClass(id);
							setAvatarPick(null);
						}}
						avatarId={avatarId}
						onAvatar={setAvatarPick}
						earned={earned}
						disabled={busy}
					/>
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
