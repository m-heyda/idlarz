import React from 'react';
import { AVATARS, avatarFitsClass } from '@/catalog/avatars';
import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import AvatarArt from './AvatarArt';
import '@/styles/Heroes.css';

/** The grid is four rows of four: faces still to come show as empty "Coming soon" cards until the catalog fills them (one row more than the faces there are today leaves room for the next updates). */
export const AVATAR_GRID_SLOTS = 16;

interface AvatarPickerProps {
	/** The chosen avatar id (null = none yet) */
	value: string | null;
	/** The hero's class: its own starters are enabled, the other classes' starters are shown disabled ("Needs the <Class> class") */
	playerClass: PlayerClassId;
	/** Ids the account may pick with this class (its starters plus earned rewards); every other card is disabled */
	unlocked: readonly string[];
	onChange: (id: string) => void;
	disabled?: boolean;
	/** The unlocked set is still being fetched (the first time the window opens): the grid is drawn as skeleton cards of the real size, so nothing flashes as open and then locks and nothing jumps when the answer arrives */
	loading?: boolean;
}

/**
 * The avatar grid (IDL-71, class lock IDL-269): the 8 starters first, then the rewards, then empty "Soon" cards up to 16 slots. The hero's own two starters and the earned rewards are enabled. Another class's starter stays visible but disabled (dimmed, a small
 * lock, "Needs the <Class> class"); a reward that is not earned keeps its silhouette, "???" and how to earn it. The server decides again on every save, so this only keeps honest players from trying (`checkAvatar`).
 */
const AvatarGrid: React.FC<AvatarPickerProps> = ({ value, playerClass, unlocked, onChange, disabled = false, loading = false }) => {
	// the Admin avatar is for the game admin only: nobody else sees it, not even as a locked card
	const faces = AVATARS.filter((avatar) => !avatar.adminOnly || unlocked.includes(avatar.id));
	return (
		<div className='avatar-grid' role='radiogroup' aria-label='Avatar'>
			{faces.map((avatar) => {
				const open = !loading && unlocked.includes(avatar.id);
				const selected = open && avatar.id === value;
				// another class's starter: a real face, just not yours; a reward not earned yet: a silhouette with its how-to
				const otherClass = !loading && !open && !avatarFitsClass(avatar, playerClass);
				const needs = avatar.classId ? `Needs the ${PLAYER_CLASSES[avatar.classId].label} class` : '';
				return (
					<button
						key={avatar.id}
						type='button'
						role='radio'
						aria-checked={selected}
						aria-disabled={!open}
						disabled={disabled || loading}
						className='avatar-card'
						data-selected={selected}
						data-locked={!open}
						data-loading={loading}
						data-class-locked={otherClass}
						title={open ? avatar.name : otherClass ? needs : `Locked: ${avatar.how ?? 'earn it in the game'}`}
						onClick={() => open && onChange(avatar.id)}
					>
						{/* the card's own class: without it the picture of another class's starter would resolve to the viewer's class default */}
						<AvatarArt id={avatar.id} playerClass={avatar.classId ?? playerClass} locked={!loading && !open && !otherClass} scale={1.5} />
						<span className='avatar-card-name'>{loading || open || otherClass ? avatar.name : '???'}</span>
						{otherClass && (
							<span className='avatar-card-how'>
								<svg className='avatar-card-lock' viewBox='0 0 8 8' width='10' height='10' aria-hidden='true' shapeRendering='crispEdges'>
									<path d='M2 3V2a2 2 0 014 0v1h1v5H1V3zm1 0h2V2a1 1 0 00-2 0z' fill='currentColor' />
								</svg>
								{needs}
							</span>
						)}
						{!loading && !open && !otherClass && <span className='avatar-card-how'>{avatar.how}</span>}
					</button>
				);
			})}
			{Array.from({ length: Math.max(0, AVATAR_GRID_SLOTS - faces.length) }, (_, i) => (
				<div key={`soon-${i}`} className='avatar-card avatar-card-soon' aria-hidden='true' data-testid='avatar-soon'>
					<span className='avatar-card-soon-art'>?</span>
					<span className='avatar-card-name'>Soon</span>
					<span className='avatar-card-soon-note'>New faces in later updates</span>
				</div>
			))}
		</div>
	);
};

/** The loading grid: the same card size as a loaded one (picture, name line, one "how" line). */
const AvatarSkeleton: React.FC = () => (
	<div className='avatar-grid' aria-busy='true' aria-label='Loading avatars' data-testid='avatar-skeleton'>
		{Array.from({ length: AVATAR_GRID_SLOTS }, (_, i) => (
			<div key={i} className='avatar-card avatar-card-skeleton' aria-hidden='true'>
				<span className='sk sk-art' />
				<span className='sk sk-name' />
				<span className='sk sk-how' />
			</div>
		))}
	</div>
);

const AvatarPicker: React.FC<AvatarPickerProps> = (props) => (props.loading ? <AvatarSkeleton /> : <AvatarGrid {...props} />);

export default AvatarPicker;
