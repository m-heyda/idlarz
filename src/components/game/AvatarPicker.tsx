import React, { useState } from 'react';
import { AVATARS, avatarFitsClass } from '@/catalog/avatars';
import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import { AVATAR_TABS, avatarProgress, visibleAvatars, type AvatarTab } from '@/lib/avatarPick';
import AvatarArt from './AvatarArt';
import '@/styles/Heroes.css';

/** The loading grid draws this many skeleton cards (four rows of four). The real grid grows with the catalog and scrolls inside the window. */
export const AVATAR_SKELETON_CARDS = 16;

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
 * The avatar window (IDL-71, class lock IDL-269): a tab per set (class starters, the three expansion sets, special rewards) with an `x/y` count each, an "Unlocked only" switch and a grid that grows with the catalog and scrolls inside the window.
 * The hero's own two starters and the earned rewards are enabled. Another class's starter stays visible but disabled (dimmed, a small lock, "Needs the <Class> class"); a reward that is not earned keeps its silhouette, "???" and how to earn it.
 * The server decides again on every save, so this only keeps honest players from trying (`checkAvatar`).
 *
 * @category Progression/Avatars
 * @order 8
 */
const AvatarGrid: React.FC<AvatarPickerProps> = ({ value, playerClass, unlocked, onChange, disabled = false }) => {
	const [tab, setTab] = useState<AvatarTab>('all');
	const [unlockedOnly, setUnlockedOnly] = useState(false);
	// the Admin avatar is for the game admin only: nobody else sees it, not even as a locked card
	const faces = visibleAvatars(AVATARS, unlocked, tab, unlockedOnly);
	const overall = avatarProgress(AVATARS, unlocked);
	return (
		<div className='avatar-window'>
			<div className='avatar-toolbar'>
				<div className='avatar-tabs' role='tablist' aria-label='Avatar sets'>
					{AVATAR_TABS.map(({ id, label }) => {
						const { have, total } = avatarProgress(AVATARS, unlocked, id);
						return total === 0 ? null : (
							<button key={id} type='button' role='tab' aria-selected={tab === id} className='avatar-tab' data-active={tab === id} onClick={() => setTab(id)}>
								{label}{' '}
								<span className='avatar-tab-count'>
									{have}/{total}
								</span>
							</button>
						);
					})}
				</div>
				<label className='avatar-only'>
					<input type='checkbox' checked={unlockedOnly} onChange={(e) => setUnlockedOnly(e.target.checked)} /> Unlocked only
				</label>
			</div>
			<p className='avatar-progress ds-dim' data-testid='avatar-progress'>
				{overall.have} of {overall.total} faces unlocked
			</p>
			<div className='avatar-grid' role='radiogroup' aria-label='Avatar'>
				{faces.map((avatar) => {
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
							title={open ? `${avatar.name}: ${avatar.bio}` : otherClass ? needs : `Locked: ${avatar.how ?? 'earn it in the game'}`}
							onClick={() => open && onChange(avatar.id)}
						>
							{/* the card's own class: without it the picture of another class's starter would resolve to the viewer's class default */}
							<AvatarArt id={avatar.id} playerClass={avatar.classId ?? playerClass} locked={!open && !otherClass} scale={1.5} />
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
				{faces.length === 0 && <p className='avatar-empty ds-dim'>Nothing here yet.</p>}
			</div>
		</div>
	);
};

/** The loading grid: the same card size as a loaded one (picture, name line, one "how" line). */
const AvatarSkeleton: React.FC = () => (
	<div className='avatar-grid' aria-busy='true' aria-label='Loading avatars' data-testid='avatar-skeleton'>
		{Array.from({ length: AVATAR_SKELETON_CARDS }, (_, i) => (
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
