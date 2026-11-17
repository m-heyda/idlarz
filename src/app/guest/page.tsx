'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import LoadingView from '@/components/game/overlays/LoadingView';
import PixelModal from '@/components/game/PixelModal';
import HeroCreator from '@/components/auth/HeroCreator';
import QueryProvider from '@/components/QueryProvider';
import { Button } from '../../../packages/design-system/src/components/primitives';
import { creatorAvatar } from '@/catalog/avatars';
import type { PlayerClassId } from '@/config/playerClasses';
import { checkCharacterName, checkPlayerClass } from '@/lib/authValidation';
import { readGuestHero, writeGuestHero } from '@/lib/guestMode';
import type { Profile } from '@/lib/authClient';
import '@/styles/Guest.css';

// The game (and the guest engine) are only loaded once the guest is in: a signed-in player's pages never contain them.
const GameApp = dynamic(() => import('../GameApp'), { ssr: false, loading: () => <LoadingView /> });

/** The guest engine answers the game's /api calls in the browser (`src/lib/guest`); it is installed before the game mounts, so no call ever finds it missing. */
const installEngine = async (): Promise<void> => {
	const { installGuest } = await import('@/lib/guest');
	installGuest();
};

/**
 * `/guest`: the game without an account. A new guest picks a hero (the same creator as sign-up, no email or password), then plays the real game against the guest engine, in this browser only (see `src/lib/guest`). This page is always reached by a full
 * page load (a plain link from the landing), so every storage key is the guest's (`storageScope`) from the first line of code. A guest who comes back finds their game where they left it.
 *
 * @title Guest game (/guest)
 * @category Architecture/Guest mode
 * @order 2
 */
export default function GuestPage() {
	const [phase, setPhase] = useState<'checking' | 'hero' | 'game'>('checking');
	const [hero, setHero] = useState<Profile | null>(null);
	const [name, setName] = useState('');
	const [playerClass, setPlayerClass] = useState<PlayerClassId | null>(null);
	const [avatarPick, setAvatarPick] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const avatarId = creatorAvatar(playerClass, avatarPick);

	useEffect(() => {
		const saved = readGuestHero();
		if (!saved) return setPhase('hero');
		void installEngine().then(() => {
			setHero(saved);
			setPhase('game');
		});
	}, []);

	const begin = async () => {
		const checkedName = checkCharacterName(name);
		const checkedClass = checkPlayerClass(playerClass);
		if (!checkedName.ok) return setError(checkedName.error);
		if (!checkedClass.ok) return setError(checkedClass.error);
		const profile: Profile = { characterName: checkedName.value, playerClass: checkedClass.value, avatarId };
		writeGuestHero(profile);
		await installEngine();
		setHero(profile);
		setPhase('game');
	};

	if (phase === 'checking') return <LoadingView />;
	if (phase === 'game' && hero)
		return (
			<QueryProvider>
				<GameApp profile={hero} userId='guest' guest />
			</QueryProvider>
		);
	return (
		<div className='guest-start'>
			<PixelModal title='Play as guest' size='md' hideClose closeOnBackdrop={false} onClose={() => undefined}>
				<div className='guest-start-body'>
					<p className='guest-start-note'>
						Pick a hero and play right away. Your game is saved in this browser only; register any time to start a real account.
					</p>
					<HeroCreator name={name} onName={setName} playerClass={playerClass} onClass={setPlayerClass} avatarId={avatarId} onAvatar={setAvatarPick} />
					{error && <p className='guest-start-error'>{error}</p>}
					<Button tone='gold' disabled={name.trim() === '' || playerClass === null} onClick={() => void begin()}>
						Start playing
					</Button>
				</div>
			</PixelModal>
		</div>
	);
}
