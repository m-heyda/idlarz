import React, { useEffect } from 'react';
import { Button, Frame } from './primitives';
import { compact, parseAmountText } from '../logic';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/**
 * A dialog on a dimmed backdrop: the stone frame, a centred flanked title and a close button. Presentational; the caller owns open/close (and the Escape key: pass `onClose` to your own key
 * handler, or set `closeOnEscape` to let the dialog listen itself). `size` follows the game's modal sizes (sm 440, md 640, lg 1080) unless `width` is given.
 */
export const Modal: React.FC<{
	title: React.ReactNode;
	icon?: React.ReactNode;
	size?: 'sm' | 'md' | 'lg';
	width?: number;
	onClose?: () => void;
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
	hideClose?: boolean;
	closeLabel?: string;
	className?: string;
	children: React.ReactNode;
}> = ({
	title,
	icon,
	size = 'md',
	width,
	onClose,
	closeOnBackdrop = true,
	closeOnEscape = false,
	hideClose = false,
	closeLabel = 'Close',
	className,
	children,
}) => {
	useEffect(() => {
		if (!closeOnEscape) return;
		const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
		window.addEventListener('keydown', key);
		return () => window.removeEventListener('keydown', key);
	}, [closeOnEscape, onClose]);
	const w = width ?? { sm: 440, md: 640, lg: 1080 }[size];
	return (
		<div className='ds-backdrop' onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose?.()}>
			<div
				className={cx('ds-root ds-modal', className)}
				style={{ width: w }}
				role='dialog'
				aria-modal='true'
				aria-label={typeof title === 'string' ? title : undefined}
			>
				<Frame>
					<div className='ds-modal-title'>
						{icon}
						{title}
					</div>
					{hideClose ? null : (
						<button type='button' className='ds-close ds-modal-close' aria-label={closeLabel} onClick={onClose}>
							✕
						</button>
					)}
					<div className='ds-modal-body'>{children}</div>
				</Frame>
			</div>
		</div>
	);
};

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
	noTitleLabel?: string;
	avatarTitle?: string;
	badgeTitle?: string;
	/** Makes the class line a button (the class picker) and says what it gives on hover */
	onClass?: () => void;
	classTitle?: string;
}> = ({
	avatar,
	name,
	classLabel,
	badge,
	title,
	onAvatar,
	onBadge,
	onClass,
	classTitle,
	noTitleLabel = 'No title',
	avatarTitle,
	badgeTitle = 'Change badge and title',
}) => (
	<div className='ds-identity'>
		<AvatarFrame src={avatar} size={61} onClick={onAvatar} title={avatarTitle} />
		<div className='ds-identity-text'>
			<div className='ds-identity-name'>
				<span>{name}</span>
				<button type='button' className='ds-identity-title' title={badgeTitle} onClick={onBadge}>
					({title ?? noTitleLabel})
				</button>
				<button type='button' className='ds-identity-badge' title={badgeTitle} onClick={onBadge}>
					{badge ? <img src={badge} alt='' /> : <span className='ds-dim'>＋</span>}
				</button>
			</div>
			{onClass ? (
				<button type='button' className='ds-caps ds-dim ds-identity-class' title={classTitle} onClick={onClass}>
					{classLabel}
				</button>
			) : (
				<div className='ds-caps ds-dim' style={{ fontSize: 11 }} title={classTitle}>
					{classLabel}
				</div>
			)}
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
export const AvatarGrid: React.FC<{
	cards: AvatarCard[];
	value: string | null;
	onPick?: (id: string) => void;
	/** Texts of the empty cards */
	labels?: { soon?: string; soonNote?: string; locked?: string };
}> = ({ cards, value, onPick, labels }) => (
	<div className='ds-avatar-grid' role='radiogroup' aria-label='Avatar'>
		{cards.map((c, i) =>
			c.state === 'soon' ? (
				<div key={`soon-${i}`} className='ds-acard' data-state='soon' aria-hidden='true'>
					<span className='ds-acard-art'>?</span>
					<span className='ds-acard-name'>{labels?.soon ?? 'Soon'}</span>
					<span className='ds-acard-note'>{labels?.soonNote ?? 'New faces in later updates'}</span>
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
					<span className='ds-acard-name'>{c.state === 'locked' ? (labels?.locked ?? '???') : c.name}</span>
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
	labels?: { badge?: string; title?: string; hideBadge?: string; noTitle?: string };
}> = ({ badges, titles, badgeId, titleId, onChange, labels }) => (
	<div>
		<h4 className='ds-section-label'>{labels?.badge ?? 'Badge'}</h4>
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
				<span className='ds-acard-name'>{labels?.hideBadge ?? 'Hide badge'}</span>
			</button>
		</div>
		<h4 className='ds-section-label' style={{ marginTop: 16 }}>
			{labels?.title ?? 'Title'}
		</h4>
		<div className='ds-avatar-grid' style={{ marginTop: 8 }}>
			<button
				type='button'
				className='ds-acard ds-acard-flat'
				data-state='open'
				data-selected={titleId === null}
				onClick={() => onChange?.({ badgeId, titleId: null })}
			>
				<span className='ds-acard-name'>{labels?.noTitle ?? 'No title'}</span>
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

/** A pixel slider: dark notched track, gold fill up to the value, gold thumb, and a readout. `tone="paper"` is for use on parchment. */
export const Slider: React.FC<{
	value: number;
	min?: number;
	max: number;
	onChange: (n: number) => void;
	id?: string;
	readout?: React.ReactNode;
	tone?: 'dark' | 'paper';
	disabled?: boolean;
}> = ({ value, min = 0, max, onChange, id, readout, tone = 'dark', disabled }) => (
	<div className={cx('ds-slider', tone === 'paper' && 'ds-slider-paper')}>
		<input
			id={id}
			className='ds-range'
			type='range'
			min={min}
			max={max}
			value={value}
			disabled={disabled}
			style={{ '--p': `${((value - min) / Math.max(1, max - min)) * 100}%` } as React.CSSProperties}
			onChange={(e) => onChange(Number(e.target.value))}
		/>
		<span className='ds-slider-out'>{readout ?? `${value} / ${max}`}</span>
	</div>
);

export interface AmountPreset {
	id: string | number;
	label: string;
}

/**
 * The amount of a trade or craft: preset buttons (1K, 1M, 1B, Max), a typed field ("250", "1.5k", "2m") and a slider. **A typed amount wins over a preset** (no preset is shown active while text is typed), and text the
 * parser does not understand marks the field invalid. Props only: the caller holds `text`, the active preset and the resolved `value`, and persists them (the game keeps them across visits).
 *
 * - `value`: the amount the trade will move now (already resolved from the typed text or the preset and held to `max`); it drives the slider and the readout.
 * - `max`: the most that can be moved (the stock, or what the gold can buy).
 * - `parse` / `format`: how text becomes a number and back for the readout (defaults: `parseAmountText` and `compact`).
 */
export const AmountInput: React.FC<{
	value: number;
	max: number;
	text: string;
	onTextChange: (text: string) => void;
	presets?: AmountPreset[];
	activePreset?: string | number | null;
	onPreset?: (id: string | number) => void;
	/** Moving the slider sets an exact amount (the caller usually writes it into the typed field) */
	onSlider?: (amount: number) => void;
	parse?: (text: string) => number | null;
	format?: (n: number) => string;
	placeholder?: string;
	hint?: string;
	maxLength?: number;
	disabled?: boolean;
	label?: string;
}> = ({
	value,
	max,
	text,
	onTextChange,
	presets = [],
	activePreset = null,
	onPreset,
	onSlider,
	parse = parseAmountText,
	format = compact,
	placeholder = 'Custom',
	hint = 'Type your own amount: 250, 1.5k, 2m, 3b',
	maxLength = 12,
	disabled,
	label = 'Amount',
}) => {
	const typed = text.trim() === '' ? null : parse(text);
	const invalid = text.trim() !== '' && typed === null;
	return (
		<div className='ds-amount' data-invalid={invalid}>
			<div className='ds-amount-row' role='group' aria-label={label}>
				<span className='ds-amount-label'>{label}</span>
				{presets.map((p) => (
					<button
						key={String(p.id)}
						type='button'
						className='ds-btn ds-btn-sm ds-amount-chip'
						data-active={typed === null && activePreset === p.id}
						aria-pressed={typed === null && activePreset === p.id}
						disabled={disabled}
						onClick={() => onPreset?.(p.id)}
					>
						{p.label}
					</button>
				))}
				<input
					className='ds-amount-field'
					type='text'
					autoComplete='off'
					spellCheck={false}
					placeholder={placeholder}
					title={hint}
					aria-label={hint}
					aria-invalid={invalid}
					data-active={typed !== null}
					value={text}
					maxLength={maxLength}
					disabled={disabled}
					onChange={(e) => onTextChange(e.target.value)}
				/>
			</div>
			{onSlider ? (
				<Slider
					value={Math.min(value, max)}
					max={Math.max(1, max)}
					onChange={onSlider}
					disabled={disabled || max < 1}
					readout={`${format(value)} / ${format(max)}`}
				/>
			) : null}
			{invalid ? <div className='ds-amount-error'>{hint}</div> : null}
		</div>
	);
};

/** A header row that opens and closes its content (recipe groups, settings sections): chevron, title, count. Presentational; the caller owns `open`. */
export const CollapsibleGroup: React.FC<{ title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({
	title,
	count,
	open,
	onToggle,
	children,
}) => (
	<section className='ds-acc'>
		<button type='button' className='ds-acc-head' aria-expanded={open} onClick={onToggle}>
			<span className='ds-acc-chev'>{open ? '▾' : '▸'}</span>
			<span className='ds-acc-title'>{title}</span>
			{count !== undefined ? <span className='ds-acc-count'>{count}</span> : null}
		</button>
		{open ? <div className='ds-acc-body'>{children}</div> : null}
	</section>
);

export interface CraftQueueEntry {
	id: string | number;
	name: string;
	icon: string;
	count: number;
	done: number;
	/** "40s left", "done", "waiting for you" */
	status: string;
}
/**
 * The crafting queue: "Queue 2 / 3" with a Collect all button at the top that lights up as soon as anything has finished, then one row per batch (icon, name, progress, Cancel, Collect N).
 * Idle line when empty. Mirrors the game's queue panel; only props, the caller does the collecting.
 */
export const CraftQueue: React.FC<{
	entries: CraftQueueEntry[];
	slots: number;
	onCollect?: (id: string | number) => void;
	onCancel?: (id: string | number) => void;
	onCollectAll?: () => void;
	labels?: { queue?: string; idle?: string; collectAll?: string; cancel?: string; collect?: string };
}> = ({ entries, slots, onCollect, onCancel, onCollectAll, labels }) => {
	const L = { queue: 'Queue', idle: 'idle', collectAll: 'Collect all', cancel: 'Cancel', collect: 'Collect', ...labels };
	const ready = entries.reduce((n, e) => n + (e.done >= 1 ? 1 : 0), 0);
	if (entries.length === 0)
		return (
			<div className='ds-queue' data-ready='false'>
				<span className='ds-dim' style={{ fontSize: 12 }}>
					{L.queue} 0 / {slots} · {L.idle}
				</span>
			</div>
		);
	return (
		<div className='ds-queue' data-ready={ready > 0}>
			<div className='ds-queue-head'>
				<span className='ds-dim' style={{ fontSize: 12 }}>
					{L.queue} {entries.length} / {slots}
				</span>
				<Button tone={ready > 0 ? 'gold' : 'stone'} className={ready > 0 ? 'ds-collect-glow' : undefined} disabled={ready === 0} onClick={onCollectAll}>
					{ready > 0 ? `${L.collectAll} (${ready})` : L.collectAll}
				</Button>
			</div>
			{entries.map((e) => (
				<div className='ds-queue-row' key={e.id}>
					<img src={e.icon} alt='' className='ds-queue-icon' />
					<span className='ds-queue-name'>{e.name}</span>
					<div className='ds-xp ds-xp-compact ds-queue-bar'>
						<div className='ds-xp-track'>
							<div className='ds-xp-fill' style={{ width: `${(e.done / Math.max(1, e.count)) * 100}%` }} />
							<span className='ds-xp-label'>
								{e.done} / {e.count} · {e.status}
							</span>
						</div>
					</div>
					<Button onClick={() => onCancel?.(e.id)}>{L.cancel}</Button>
					<Button tone={e.done >= 1 ? 'gold' : 'stone'} disabled={e.done < 1} onClick={() => onCollect?.(e.id)}>
						{L.collect}
						{e.done > 0 ? ` ${e.done}` : ''}
					</Button>
				</div>
			))}
		</div>
	);
};

/** One labelled group of equipment slots in a fixed number of columns (Armor, Jewelry, Hands, Skills), as in the game's character window. */
export const EquipGroup: React.FC<{ title: string; cols: number; gap?: number; children: React.ReactNode }> = ({ title, cols, gap = 4, children }) => (
	<div className='ds-eqgroup'>
		<div className='ds-section-label'>{title}</div>
		<div className='ds-eqgrid' style={{ gridTemplateColumns: `repeat(${cols}, var(--ds-slot-size))`, gap }}>
			{children}
		</div>
	</div>
);

export interface StashEntry {
	id: string;
	name: string;
	icon: string;
	qty: number;
	/** component: only for recipes; potion / good: can be taken into the bag; special: quest and event items */
	kind: 'component' | 'potion' | 'good' | 'special';
	/** biggest stack the bag holds (the "Stack" button takes this many) */
	stack?: number;
}
const STASH_TITLES: Record<StashEntry['kind'], string> = { component: 'Components', potion: 'Potions', good: 'Trade goods', special: 'Special items' };
/**
 * The bag's Crafting tab: what crafting made and the ingredients, kept outside the bag's slots (no slots, only a cap). Components and special items stay for recipes; potions and trade goods can
 * be taken into the bag with "1" or "Stack". Rows are grouped by kind. Props only: the caller moves the items.
 */
export const CraftStash: React.FC<{
	entries: StashEntry[];
	onTake?: (id: string, n: number) => void;
	labels?: { empty?: string; stack?: string; forRecipes?: string; keptSafe?: string; groups?: Partial<Record<StashEntry['kind'], string>> };
}> = ({ entries, onTake, labels }) => {
	const shown = entries.filter((e) => e.qty > 0);
	if (shown.length === 0)
		return (
			<p className='ds-dim' style={{ fontSize: 13 }}>
				{labels?.empty ?? 'Nothing crafted yet. Finished potions, goods and components collect here.'}
			</p>
		);
	const kinds = (Object.keys(STASH_TITLES) as StashEntry['kind'][]).filter((k) => shown.some((e) => e.kind === k));
	return (
		<div className='ds-stash'>
			{kinds.map((k) => (
				<div key={k}>
					<div className='ds-section-label'>{labels?.groups?.[k] ?? STASH_TITLES[k]}</div>
					{shown
						.filter((e) => e.kind === k)
						.map((e) => (
							<div className='ds-stash-row' key={e.id}>
								<img src={e.icon} alt='' />
								<span className='ds-stash-name'>{e.name}</span>
								<span className='ds-stash-qty'>{e.qty.toLocaleString('en-US')}</span>
								{e.kind === 'potion' || e.kind === 'good' ? (
									<>
										<Button onClick={() => onTake?.(e.id, 1)}>1</Button>
										<Button onClick={() => onTake?.(e.id, Math.min(e.qty, e.stack ?? 20))}>{labels?.stack ?? 'Stack'}</Button>
									</>
								) : (
									<span className='ds-dim ds-stash-note'>
										{e.kind === 'component' ? (labels?.forRecipes ?? 'for recipes') : (labels?.keptSafe ?? 'kept safe')}
									</span>
								)}
							</div>
						))}
				</div>
			))}
		</div>
	);
};

/** A dark pixel-styled dropdown (native select underneath, so it is keyboard and screen reader friendly). `options` are [value, label] pairs. */
export const SelectBox: React.FC<{ value: string; onChange: (v: string) => void; options: [string, string][]; id?: string }> = ({
	value,
	onChange,
	options,
	id,
}) => (
	<select id={id} className='ds-select' value={value} onChange={(e) => onChange(e.target.value)}>
		{options.map(([v, l]) => (
			<option key={v} value={v}>
				{l}
			</option>
		))}
	</select>
);

/** A placeholder page for a tab that is not built yet: icon, title, a line of text and a "Coming soon" tag. */
export const ComingSoon: React.FC<{ title: string; text: string; icon?: string; tag?: string }> = ({ title, text, icon, tag = 'Coming soon' }) => (
	<div className='ds-soon'>
		{icon ? <img src={icon} alt='' /> : null}
		<div className='ds-soon-title'>{title}</div>
		<span className='ds-soon-tag'>{tag}</span>
		<p>{text}</p>
	</div>
);
