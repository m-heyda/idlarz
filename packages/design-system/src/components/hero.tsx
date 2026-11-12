import React from 'react';
import { Frame } from './primitives';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/** A dialog on a dimmed backdrop: the stone frame, a centred flanked title and a close button. Presentational; the caller owns open/close. */
export const Modal: React.FC<{ title: string; width?: number; onClose?: () => void; children: React.ReactNode }> = ({
	title,
	width = 640,
	onClose,
	children,
}) => (
	<div className='ds-backdrop' onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
		<div className='ds-root ds-modal' style={{ width }} role='dialog' aria-label={title}>
			<Frame>
				<div className='ds-modal-title'>{title}</div>
				<button type='button' className='ds-close ds-modal-close' aria-label='Close' onClick={onClose}>
					✕
				</button>
				<div className='ds-modal-body'>{children}</div>
			</Frame>
		</div>
	</div>
);

/** A hero face in a gold frame; the whole thing is a button with a small pencil, so it reads as "click to change". */
export const AvatarFrame: React.FC<{ src: string; size?: number; onClick?: () => void; title?: string }> = ({
	src,
	size = 64,
	onClick,
	title = 'Change avatar',
}) => (
	<button type='button' className='ds-avatar' style={{ width: size, height: size }} title={title} onClick={onClick}>
		<img src={src} alt='' />
		<span className='ds-avatar-edit' aria-hidden='true'>
			✎
		</span>
	</button>
);

/** Name line of a hero: avatar (click to change), name, the chosen badge, the chosen title and the class. Badge and title are buttons too (they open the badge and title picker). */
export const HeroIdentity: React.FC<{
	avatar: string;
	name: string;
	classLabel: string;
	badge?: string;
	title?: string | null;
	onAvatar?: () => void;
	onBadge?: () => void;
}> = ({ avatar, name, classLabel, badge, title, onAvatar, onBadge }) => (
	<div className='ds-identity'>
		<AvatarFrame src={avatar} size={68} onClick={onAvatar} />
		<div className='ds-identity-text'>
			<div className='ds-identity-name'>
				<span>{name}</span>
				<button type='button' className='ds-identity-badge' title='Change badge and title' onClick={onBadge}>
					{badge ? <img src={badge} alt='' /> : <span className='ds-dim'>＋</span>}
				</button>
			</div>
			<button type='button' className='ds-identity-title' title='Change badge and title' onClick={onBadge}>
				{title ?? 'No title'}
			</button>
			<div className='ds-caps ds-dim' style={{ fontSize: 11 }}>
				{classLabel}
			</div>
		</div>
	</div>
);

export interface AvatarCard {
	id: string;
	name: string;
	portrait: string;
	/** open: pickable; class: a starter of another class (dimmed, "Needs the X class"); locked: a reward not earned (silhouette, how to earn); soon: an empty slot */
	state: 'open' | 'class' | 'locked' | 'soon';
	note?: string;
}
/** The avatar grid of the picker: the hero's starters and earned rewards are pickable, other classes' starters are dimmed with a lock line, unearned rewards are silhouettes with how to earn them. */
export const AvatarGrid: React.FC<{ cards: AvatarCard[]; value: string | null; onPick?: (id: string) => void }> = ({ cards, value, onPick }) => (
	<div className='ds-avatar-grid' role='radiogroup' aria-label='Avatar'>
		{cards.map((c, i) =>
			c.state === 'soon' ? (
				<div key={`soon-${i}`} className='ds-acard' data-state='soon' aria-hidden='true'>
					<span className='ds-acard-art'>?</span>
					<span className='ds-acard-name'>Soon</span>
					<span className='ds-acard-note'>New faces in later updates</span>
				</div>
			) : (
				<button
					key={c.id}
					type='button'
					role='radio'
					aria-checked={c.id === value}
					className='ds-acard'
					data-state={c.state}
					data-selected={c.state === 'open' && c.id === value}
					title={c.state === 'open' ? c.name : c.note}
					onClick={() => c.state === 'open' && onPick?.(c.id)}
				>
					<span className='ds-acard-art'>
						<img src={c.portrait} alt='' />
					</span>
					<span className='ds-acard-name'>{c.state === 'locked' ? '???' : c.name}</span>
					{c.note ? <span className='ds-acard-note'>{c.state === 'class' ? `🔒 ${c.note}` : c.note}</span> : null}
				</button>
			),
		)}
	</div>
);

export interface BadgeOption {
	id: string;
	title: string;
	img: string;
}
export interface TitleChoice {
	id: string;
	name: string;
}
/** The badge and title picker: earned badges (plus Hide badge) and earned titles (plus No title). */
export const BadgeTitlePicker: React.FC<{
	badges: BadgeOption[];
	titles: TitleChoice[];
	badgeId: string | null;
	titleId: string | null;
	onChange?: (next: { badgeId: string | null; titleId: string | null }) => void;
}> = ({ badges, titles, badgeId, titleId, onChange }) => (
	<div>
		<h4 className='ds-section-label'>Badge</h4>
		<div className='ds-avatar-grid' style={{ marginTop: 8 }}>
			{badges.map((b) => (
				<button
					key={b.id}
					type='button'
					className='ds-acard'
					data-state='open'
					data-selected={badgeId === b.id}
					onClick={() => onChange?.({ badgeId: b.id, titleId })}
				>
					<span className='ds-acard-art' style={{ height: 44 }}>
						<img src={b.img} alt='' style={{ width: 40, height: 40 }} />
					</span>
					<span className='ds-acard-name'>{b.title}</span>
				</button>
			))}
			<button type='button' className='ds-acard' data-state='open' data-selected={badgeId === 'none'} onClick={() => onChange?.({ badgeId: 'none', titleId })}>
				<span className='ds-acard-art' style={{ height: 44 }}>
					✕
				</span>
				<span className='ds-acard-name'>Hide badge</span>
			</button>
		</div>
		<h4 className='ds-section-label' style={{ marginTop: 16 }}>
			Title
		</h4>
		<div className='ds-avatar-grid' style={{ marginTop: 8 }}>
			<button
				type='button'
				className='ds-acard ds-acard-flat'
				data-state='open'
				data-selected={titleId === null}
				onClick={() => onChange?.({ badgeId, titleId: null })}
			>
				<span className='ds-acard-name'>No title</span>
			</button>
			{titles.map((t) => (
				<button
					key={t.id}
					type='button'
					className='ds-acard ds-acard-flat'
					data-state='open'
					data-selected={titleId === t.id}
					onClick={() => onChange?.({ badgeId, titleId: t.id })}
				>
					<span className='ds-acard-name'>{t.name}</span>
				</button>
			))}
		</div>
	</div>
);

/** The XP bar as in the game: a purple level box, then a segmented green bar with `label` over it. `compact` drops the level box (crafting level bar). */
export const XpBar: React.FC<{ level: number; value: number; max: number; label?: string; compact?: boolean }> = ({ level, value, max, label, compact }) => (
	<div className={cx('ds-xp', compact && 'ds-xp-compact')}>
		{compact ? null : <span className='ds-xp-level'>{level}</span>}
		<div className='ds-xp-track'>
			<div className='ds-xp-fill' style={{ width: `${Math.max(0, Math.min(1, value / (max || 1))) * 100}%` }} />
			{label ? <span className='ds-xp-label'>{label}</span> : null}
		</div>
	</div>
);
