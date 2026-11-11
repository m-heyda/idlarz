import React, { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { chooseAvatar, fetchAvatars } from '@/lib/authClient';
import { CLASS_AVATARS } from '@/catalog/avatars';
import { DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';
import { createAvatarPicker } from '@/lib/avatarPick';
import audioManager from '@/utils/audioManager';
import PixelModal from './PixelModal';
import PixelIcon from './PixelIcon';
import AvatarPicker from './AvatarPicker';

/** The avatar picker of the character window: fetches the hero's class and what the account has unlocked each time it opens, and a pick shows at once and is saved on the server in the background (the server refuses a locked or other-class id; then the previous face comes back with the reason). */
const AvatarDialog: React.FC = () => {
	const open = useUiStore((state) => state.avatarDialogOpen);
	const close = useUiStore((state) => state.closeAvatarDialog);
	const avatarId = useUiStore((state) => state.avatarId);
	const setAvatarId = useUiStore((state) => state.setAvatarId);
	const [playerClass, setPlayerClass] = useState<PlayerClassId>(DEFAULT_PLAYER_CLASS);
	const [unlocked, setUnlocked] = useState<readonly string[]>(CLASS_AVATARS[DEFAULT_PLAYER_CLASS]);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const picker = useRef(
		createAvatarPicker({ get: () => useUiStore.getState().avatarId, set: (id) => useUiStore.getState().setAvatarId(id), send: chooseAvatar }),
	);

	useEffect(() => {
		if (!open) return;
		let alive = true;
		setError(null);
		setLoaded(false);
		void fetchAvatars().then((state) => {
			if (!alive || !state) return;
			setLoaded(true);
			setPlayerClass(state.playerClass);
			setUnlocked(state.unlocked);
			setAvatarId(state.avatarId);
		});
		return () => {
			alive = false;
		};
	}, [open, setAvatarId]);

	if (!open) return null;

	const pick = async (id: string) => {
		setError(null);
		if (id !== avatarId) audioManager.playSound('click');
		const outcome = await picker.current.pick(id);
		if (outcome.status === 'reverted') setError(outcome.message);
	};

	return (
		<PixelModal title='Choose your avatar' icon={<PixelIcon name='menu_character' alt='' />} size='md' onClose={close}>
			<p className='text-[#a89878] text-sm mb-4 text-center'>
				Your face in the header and the rankings. Your hero wears its own two faces; faces of other classes stay disabled, and the locked rewards are earned in
				the game.
			</p>
			<AvatarPicker value={avatarId} playerClass={playerClass} unlocked={unlocked} onChange={pick} loading={!loaded} />
			{error && (
				<p role='alert' className='text-sm text-center text-[#e07a6a] mt-3'>
					{error}
				</p>
			)}
		</PixelModal>
	);
};

export default AvatarDialog;
