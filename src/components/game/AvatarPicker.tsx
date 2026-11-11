import React from 'react';
import { AVATARS, avatarFitsClass } from '@/catalog/avatars';
import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import AvatarArt from './AvatarArt';
import '@/styles/Heroes.css';

interface AvatarPickerProps {
	/** The chosen avatar id (null = none yet) */
	value: string | null;
	/** The hero's class: its own starters are enabled, the other classes' starters are shown disabled ("Needs the <Class> class") */
	playerClass: PlayerClassId;
	/** Ids the account may pick with this class (its starters plus earned rewards); every other card is disabled */
	unlocked: readonly string[];
	onChange: (id: string) => void;
	disabled?: boolean;
}

/**
 * The avatar grid (IDL-71, class lock IDL-269): the 8 starters first, then the rewards. The hero's own two starters and the earned rewards are enabled. Another class's starter stays visible but disabled (dimmed, a small
 * lock, "Needs the <Class> class"); a reward that is not earned keeps its silhouette, "???" and how to earn it. The server decides again on every save, so this only keeps honest players from trying (`checkAvatar`).
 */
const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, playerClass, unlocked, onChange, disabled = false }) => (
	<div className='avatar-grid' role='radiogroup' aria-label='Avatar'>
		{AVATARS.map((avatar) => {
			const open = unlocked.includes(avatar.id);
			const selected = open && avatar.id === value;
			// another class's starter: a real face, just not yours; a reward not earned yet: a silhouette with its how-to
			const otherClass = !open && !avatarFitsClass(avatar, playerClass);
			const needs = avatar.classId ? `Needs the ${PLAYER_CLASSES[avatar.classId].label} class` : '';
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
					data-class-locked={otherClass}
					title={open ? avatar.name : otherClass ? needs : `Locked: ${avatar.how ?? 'earn it in the game'}`}
					onClick={() => open && onChange(avatar.id)}
				>
					<AvatarArt id={avatar.id} locked={!open && !otherClass} scale={1.5} />
					<span className='avatar-card-name'>{open || otherClass ? avatar.name : '???'}</span>
					{otherClass && (
						<span className='avatar-card-how'>
							<svg className='avatar-card-lock' viewBox='0 0 8 8' width='10' height='10' aria-hidden='true' shapeRendering='crispEdges'>
								<path d='M2 3V2a2 2 0 014 0v1h1v5H1V3zm1 0h2V2a1 1 0 00-2 0z' fill='currentColor' />
							</svg>
							{needs}
						</span>
					)}
					{!open && !otherClass && <span className='avatar-card-how'>{avatar.how}</span>}
				</button>
			);
		})}
	</div>
);

export default AvatarPicker;
