import React, { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { chooseAvatar } from '@/lib/authClient';
import { useAvatarState } from '@/lib/avatarQuery';
import { CLASS_AVATARS } from '@/catalog/avatars';
import { DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import { createAvatarPicker } from '@/lib/avatarPick';
import audioManager from '@/utils/audioManager';
import GameModal from './GameModal';
import AvatarPicker from './AvatarPicker';

/**
 * The avatar picker of the character window. The hero's class and what the account has unlocked come from the shared read cache (`useAvatarState`): the first time the window opens it shows skeleton cards while that loads, and every later
 * open shows the cached answer at once (a new unlock or a class change refreshes it). A pick shows at once and is saved on the server in the background (the server refuses a locked or other-class id; then the previous face comes back with the reason).
 */
const AvatarDialog: React.FC = () => {
	const open = useUiStore((state) => state.avatarDialogOpen);
	const close = useUiStore((state) => state.closeAvatarDialog);
	const avatarId = useUiStore((state) => state.avatarId);
	const setAvatarId = useUiStore((state) => state.setAvatarId);
	const [error, setError] = useState<string | null>(null);
	const { data, isPending } = useAvatarState(open);
	const picker = useRef(
		createAvatarPicker({ get: () => useUiStore.getState().avatarId, set: (id) => useUiStore.getState().setAvatarId(id), send: chooseAvatar }),
	);

	useEffect(() => {
		if (open) setError(null);
	}, [open]);

	// the profile's own choice is the truth: a fresh answer puts the chosen face right (another tab may have changed it)
	useEffect(() => {
		if (data) setAvatarId(data.avatarId);
	}, [data, setAvatarId]);

	if (!open) return null;

	const pick = async (id: string) => {
		setError(null);
		if (id !== avatarId) audioManager.playSound('click');
		const outcome = await picker.current.pick(id);
		if (outcome.status === 'reverted') setError(outcome.message);
	};

	return (
		<GameModal title='Choose your avatar' size='md' onClose={close}>
			<p className='ds-dim' style={{ textAlign: 'center', margin: '0 0 12px' }}>
				Your face in the header and the rankings.
			</p>
			<AvatarPicker
				value={avatarId}
				playerClass={data?.playerClass ?? DEFAULT_PLAYER_CLASS}
				unlocked={data?.unlocked ?? CLASS_AVATARS[DEFAULT_PLAYER_CLASS]}
				onChange={pick}
				loading={isPending}
			/>
			{error && (
				<p role='alert' style={{ textAlign: 'center', color: '#ff7a6a', marginTop: 10 }}>
					{error}
				</p>
			)}
		</GameModal>
	);
};

export default AvatarDialog;
