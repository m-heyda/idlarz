import React from 'react';
import { AVATARS } from '@/catalog/avatars';
import AvatarArt from './AvatarArt';
import '@/styles/Heroes.css';

interface AvatarPickerProps {
	/** The chosen avatar id (null = none yet) */
	value: string | null;
	/** Ids the account may pick (starters plus earned unlockables); every other card is a locked silhouette */
	unlocked: readonly string[];
	onChange: (id: string) => void;
	disabled?: boolean;
}

/**
 * The avatar grid (IDL-71): the 8 starters first, then the unlockables. A locked one shows a silhouette and how to earn it, and cannot be chosen. The server decides again
 * on every save, so this only keeps honest players from trying (`checkAvatar`).
 */
const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, unlocked, onChange, disabled = false }) => (
	<div className='avatar-grid' role='radiogroup' aria-label='Avatar'>
		{AVATARS.map((avatar) => {
			const open = unlocked.includes(avatar.id);
			const selected = open && avatar.id === value;
			return (
				<button
					key={avatar.id}
					type='button'
					role='radio'
					aria-checked={selected}
					aria-disabled={!open}
					disabled={disabled}
					className='avatar-card'
					data-selected={selected}
					data-locked={!open}
					title={open ? avatar.name : `Locked: ${avatar.how ?? 'earn it in the game'}`}
					onClick={() => open && onChange(avatar.id)}
				>
					<AvatarArt id={avatar.id} locked={!open} scale={1.5} />
					<span className='avatar-card-name'>{open ? avatar.name : '???'}</span>
					{!open && <span className='avatar-card-how'>{avatar.how}</span>}
				</button>
			);
		})}
	</div>
);

export default AvatarPicker;
