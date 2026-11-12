import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dockMagnification, gemStates, type Point, type Rarity, type Size } from '../logic';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/** Wrap anything in this once so the design-system styles and tokens apply. */
export const DsRoot: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => <div className={cx('ds-root', className)} {...rest} />;

/** The big window frame: stone rim, gold line, corner studs, slate fill. */
export const Frame: React.FC<{ variant?: 'a' | 'b'; className?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({
	variant = 'a',
	className,
	style,
	children,
}) => (
	<div className={cx('ds-frame', variant === 'b' && 'ds-frame-b', className)} style={style}>
		<div className='ds-frame-body'>{children}</div>
	</div>
);

/** An inner panel with a thinner gold frame. `parchment` swaps the slate fill for paper (ledgers, tickets). */
export const Panel: React.FC<{ parchment?: boolean; className?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({
	parchment,
	className,
	style,
	children,
}) => (
	<div className={cx('ds-panel', parchment && 'ds-parch', className)} style={style}>
		{children}
	</div>
);

/** A dark recessed area (grids, lists) with a faint gold hairline. */
export const Inset: React.FC<{ className?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ className, style, children }) => (
	<div className={cx('ds-inset', className)} style={style}>
		{children}
	</div>
);

/** Small gold section heading ("ECONOMY", "AMOUNT"). */
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <h4 className='ds-section-label'>{children}</h4>;

/** Gold rule between groups; `flourish` adds the scrolled centre. */
export const Divider: React.FC<{ flourish?: boolean }> = ({ flourish }) => <div className={cx('ds-divider', flourish && 'ds-divider-flourish')} />;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	tone?: 'stone' | 'gold' | 'wood' | 'dark' | 'danger';
	/** `sm` is the compact button used in rows and queues */
	size?: 'md' | 'sm';
}
/** Plate button. `gold` is the primary action, `stone` the default, `dark` for the disabled "need more" state. */
export const Button: React.FC<ButtonProps> = ({ tone = 'stone', size = 'md', className, ...rest }) => (
	<button type='button' className={cx('ds-btn', tone !== 'stone' && `ds-btn-${tone}`, size === 'sm' && 'ds-btn-sm', className)} {...rest} />
);

/** The red X in a window corner. */
export const CloseButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
	<button type='button' className='ds-close' aria-label='Close' onClick={onClick}>
		✕
	</button>
);

/** The orange glowing counter for something new here (unseen items, claimable deeds); `floating` pins it to the top-right of an icon button. Was: little red counter ("1 new"). */
export const NotifyBadge: React.FC<{ count: number; floating?: boolean }> = ({ count, floating }) => (
	<span className={cx('ds-badge', floating && 'ds-badge-float')}>{count}</span>
);

export interface TabItem {
	id: string;
	label: string;
	badge?: number;
	disabled?: boolean;
	/** Hover text (why a tab is locked) */
	title?: string;
}
/** A row of wooden tabs, the active one in gold. */
export const Tabs: React.FC<{ items: TabItem[]; active: string; onChange?: (id: string) => void }> = ({ items, active, onChange }) => (
	<div className='ds-tabs' role='tablist'>
		{items.map((t) => (
			<button
				key={t.id}
				type='button'
				role='tab'
				aria-selected={t.id === active}
				data-active={t.id === active}
				className='ds-tab'
				disabled={t.disabled}
				title={t.title}
				onClick={() => !t.disabled && onChange?.(t.id)}
			>
				{t.label}
				{t.badge ? <Badge count={t.badge} /> : null}
			</button>
		))}
	</div>
);

/** A resource in the top bar: icon, amount, optional income per second. With `onClick` it is a button (a resource that opens something); extra attributes (a tutorial anchor) go to the chip itself. */
export const ResourceChip: React.FC<
	{ icon: string; value: string; rate?: string; title?: string; onClick?: () => void } & Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick' | 'title'>
> = ({ icon, value, rate, title, onClick, ...rest }) => (
	<span
		className={cx('ds-chip', onClick && 'ds-chip-link')}
		title={title}
		role={onClick ? 'button' : undefined}
		tabIndex={onClick ? 0 : undefined}
		onClick={onClick}
		onKeyDown={
			onClick
				? (e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onClick();
						}
					}
				: undefined
		}
		{...rest}
	>
		<img src={icon} alt='' />
		<span>{value}</span>
		{rate ? <span className='ds-chip-rate'>{rate}</span> : null}
	</span>
);

/** HP / MP / XP bar with an optional centred label. */
export const ProgressBar: React.FC<{ value: number; max: number; tone?: 'hp' | 'mana' | 'xp' | 'gold'; label?: string; height?: number }> = ({
	value,
	max,
	tone = 'hp',
	label,
	height,
}) => (
	<div className='ds-bar' style={height ? { height } : undefined}>
		<div className='ds-bar-fill' data-tone={tone} style={{ width: `${Math.max(0, Math.min(1, value / (max || 1))) * 100}%` }} />
		{label ? <span className='ds-bar-label'>{label}</span> : null}
	</div>
);

/** A label with a big number under it (Damage 106.6). */
export const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'damage' | 'armor' | 'crit' | 'plain' }> = ({ label, value, tone = 'plain' }) => (
	<div className='ds-stat'>
		<span className='ds-stat-label'>{label}</span>
		<span className='ds-stat-value' data-tone={tone}>
			{value}
		</span>
	</div>
);

export interface SlotProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
	icon?: string;
	rarity?: Rarity;
	count?: number;
	/** Show a faded placeholder icon for an empty equipment slot */
	empty?: boolean;
	locked?: boolean;
	/** The item is worn (drawn with a gold corner mark) */
	equipped?: boolean;
	large?: boolean;
	/** Marks the slot as the selected one (recipe picker) */
	active?: boolean;
	/** Text inside an icon-less slot (a skill name) */
	label?: string;
	sub?: string;
	className?: string;
}
/**
 * An item or equipment slot. Rarity draws a coloured glowing rim; `empty` dims the slot's silhouette. It is a plain button: every native attribute and handler (onClick, onDoubleClick,
 * onContextMenu, draggable, onDragStart, onDrop, aria-*, data-*) passes through, so the game keeps its own click, drag and drop logic.
 */
export const Slot: React.FC<SlotProps> = ({ icon, rarity, count, empty, locked, equipped, large, active, label, sub, className, style, ...rest }) => {
	const glow = rarity && rarity !== 'common';
	return (
		<button
			type='button'
			{...rest}
			className={cx('ds-slot', large && 'ds-slot-lg', className)}
			data-rarity={glow ? rarity : undefined}
			style={glow ? ({ '--ds-rarity': `var(--ds-r-${rarity})`, ...style } as React.CSSProperties) : style}
			data-empty={empty}
			data-locked={locked}
			data-active={active}
			data-equipped={equipped}
		>
			{icon ? <img src={icon} alt='' /> : null}
			{label ? (
				<span className='ds-slot-text'>
					{label}
					{sub ? <small>{sub}</small> : null}
				</span>
			) : null}
			{count && count > 1 ? <span className='ds-slot-count'>{count}</span> : null}
		</button>
	);
};

/**
 * A stone menu icon with a caption (the dock). `art` draws any node (a portrait) in place of the picture. `active` marks an open window, `disabled` dims it (not available yet); the badge is the count of things waiting. Any other button attribute
 * (a tutorial anchor, aria-label) goes to the button.
 */
export const IconButton: React.FC<
	{ icon: string; label: string; badge?: number; small?: boolean; active?: boolean; art?: React.ReactNode } & Omit<
		React.ButtonHTMLAttributes<HTMLButtonElement>,
		'children'
	>
> = ({ icon, label, badge, small, active, art, className, ...rest }) => (
	<button type='button' className={cx('ds-iconbtn', small && 'ds-iconbtn-sm', className)} data-active={active ? 'true' : undefined} {...rest}>
		<span className='ds-iconbtn-pic'>
			{art ? <span className='ds-iconbtn-art'>{art}</span> : <img src={icon} alt='' />}
			{badge ? <Badge count={badge} floating /> : null}
		</span>
		<span>{label}</span>
	</button>
);

/** Diamond-shaped level gems: yellow for levels bought, dim for the rest, purple once the upgrade is maxed. */
export const DiamondLevel: React.FC<{ level: number; max: number }> = ({ level, max }) => (
	<span className='ds-gems' role='img' aria-label={`Level ${level} of ${max}`}>
		{gemStates(level, max).map((s, i) => (
			<i key={i} className='ds-gem' data-state={s} />
		))}
	</span>
);

export interface WindowShellProps {
	title: React.ReactNode;
	/** Icon drawn before the title */
	icon?: React.ReactNode;
	/** Starting size in px when the size is not controlled */
	width?: number;
	height?: number;
	minWidth?: number;
	minHeight?: number;
	/**
	 * Controlled position (px from the page's top-left, the window becomes `position: fixed`). Leave undefined and the window stays where it is in the layout and drags by itself.
	 * With it, the shell only reports moves through `onPositionChange` and the game's window store decides (clamping, persisting, z-order).
	 */
	position?: Point;
	onPositionChange?: (pos: Point) => void;
	/** Controlled size; same idea as `position` */
	size?: Size;
	onSizeChange?: (size: Size) => void;
	/** A drag or resize finished (the moment to persist the new geometry) */
	onGeometryCommit?: () => void;
	/** A press anywhere inside the window (bring it to the front) */
	onFocus?: () => void;
	zIndex?: number;
	/** The front window of several; dims the others slightly when false */
	active?: boolean;
	/** Small screens: no dragging or resizing, the window just fills its slot */
	fixed?: boolean;
	draggable?: boolean;
	resizable?: boolean;
	/** No body padding or scrolling: the content fills the window */
	flush?: boolean;
	bar?: React.ReactNode;
	barRight?: React.ReactNode;
	closeLabel?: string;
	className?: string;
	onClose?: () => void;
	children: React.ReactNode;
}
/**
 * The window: frame, flanked title (drag handle), close button, a tab/head bar and a scrolling body, resizable from its corner. It is a size container (`container-name: ds-win`),
 * so anything inside can adapt with `@container ds-win (max-width: ...)`: the Hero window scales its slots and stacks its columns that way.
 *
 * Presentational with two modes. Uncontrolled (stories, simple uses): it keeps its own size and drag offset. Controlled (the game): pass `position` / `size` and the `on...Change` callbacks and the
 * shell keeps no geometry of its own; `clampWindowPosition` and `clampWindowSize` in `logic.ts` hold the screen-edge rules. Focus, z-index and open/close always belong to the caller.
 */
export const WindowShell: React.FC<WindowShellProps> = ({
	title,
	icon,
	width = 1100,
	height = 640,
	minWidth = 380,
	minHeight = 300,
	position,
	onPositionChange,
	size,
	onSizeChange,
	onGeometryCommit,
	onFocus,
	zIndex,
	active = true,
	fixed = false,
	draggable = true,
	resizable = true,
	flush = false,
	bar,
	barRight,
	closeLabel = 'Close',
	className,
	onClose,
	children,
}) => {
	const [ownSize, setOwnSize] = useState<Size>({ w: width, h: height });
	const [ownPos, setOwnPos] = useState<Point>({ x: 0, y: 0 });
	const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
	const rs = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);
	const sz = size ?? ownSize;
	const controlledPos = position !== undefined;
	const pos = position ?? ownPos;
	const canDrag = draggable && !fixed;
	const canResize = resizable && !fixed;
	const style: React.CSSProperties = {
		width: fixed ? undefined : sz.w,
		height: fixed ? undefined : sz.h,
		...(controlledPos ? { position: 'fixed', left: pos.x, top: pos.y } : { transform: `translate(${pos.x}px, ${pos.y}px)` }),
		...(zIndex !== undefined ? { zIndex } : {}),
	};
	const move = (p: Point) => (controlledPos ? onPositionChange?.(p) : (setOwnPos(p), onPositionChange?.(p)));
	const resize = (n: Size) => (size ? onSizeChange?.(n) : (setOwnSize(n), onSizeChange?.(n)));
	return (
		<div
			className={cx('ds-root ds-winroot', className)}
			style={style}
			data-active={active}
			data-flush={flush}
			onPointerDownCapture={onFocus}
			role='dialog'
			aria-label={typeof title === 'string' ? title : undefined}
		>
			<div
				className='ds-window-title'
				data-draggable={canDrag}
				onPointerDown={(e) => {
					if (!canDrag || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
					e.currentTarget.setPointerCapture(e.pointerId);
					drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
				}}
				onPointerMove={(e) => drag.current && move({ x: drag.current.x + e.clientX - drag.current.sx, y: drag.current.y + e.clientY - drag.current.sy })}
				onPointerUp={() => {
					if (!drag.current) return;
					drag.current = null;
					onGeometryCommit?.();
				}}
				onPointerCancel={() => (drag.current = null)}
			>
				{icon}
				{title}
			</div>
			<button type='button' className='ds-close' aria-label={closeLabel} onClick={onClose}>
				✕
			</button>
			<Frame style={{ width: '100%', height: '100%' }}>
				<div className='ds-window'>
					{bar ? (
						<div className='ds-window-head'>
							<div className='ds-window-bar'>
								{bar}
								<span style={{ marginLeft: 'auto' }}>{barRight}</span>
							</div>
						</div>
					) : null}
					<div className='ds-window-body' data-flush={flush}>
						{children}
					</div>
				</div>
			</Frame>
			{canResize ? (
				<div
					className='ds-resize'
					role='separator'
					aria-label='Resize window'
					onPointerDown={(e) => {
						if (e.button !== 0) return;
						e.stopPropagation();
						e.currentTarget.setPointerCapture(e.pointerId);
						rs.current = { sx: e.clientX, sy: e.clientY, w: sz.w, h: sz.h };
					}}
					onPointerMove={(e) =>
						rs.current &&
						resize({ w: Math.max(minWidth, rs.current.w + e.clientX - rs.current.sx), h: Math.max(minHeight, rs.current.h + e.clientY - rs.current.sy) })
					}
					onPointerUp={() => {
						if (!rs.current) return;
						rs.current = null;
						onGeometryCommit?.();
					}}
					onPointerCancel={() => (rs.current = null)}
				/>
			) : null}
		</div>
	);
};

/** The free-slot shortcut at the end of the bag: a dashed "+" slot that shows `tip` (what more space costs) and runs `onClick` (open the merchant upgrade). */
export const AddSlot: React.FC<{ tip: React.ReactNode; onClick?: () => void }> = ({ tip, onClick }) => (
	<HoverTip tip={tip} placement='above' align='center'>
		<button type='button' className='ds-slot ds-slot-add' aria-label='Buy more bag slots' onClick={onClick}>
			+
		</button>
	</HoverTip>
);

export type GlyphTone = 'gold' | 'wood' | 'stone';
/** A small square button with one engraved character (Deeds, Settings). Tones: `gold` (the default plate), `wood`, `stone`. `active` marks an open window; extra button attributes pass through. */
export const GlyphButton: React.FC<
	{ glyph: string; label: string; tone?: GlyphTone; active?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>
> = ({ glyph, label, tone = 'gold', active, ...rest }) => (
	<button type='button' className='ds-glyphbtn' data-tone={tone} data-active={active ? 'true' : undefined} aria-label={label} title={label} {...rest}>
		<span>{glyph}</span>
	</button>
);

/** The wooden bar across the top of the game screen; `right` is pushed to the far edge (buttons). Children are usually ChipGroups. */
export const TopBar: React.FC<{ right?: React.ReactNode; children: React.ReactNode }> = ({ right, children }) => (
	<div className='ds-topbar'>
		{children}
		{right ? <span className='ds-topbar-right'>{right}</span> : null}
	</div>
);

/**
 * The stone bar of menu icons along the bottom of the game screen, framed in gold. Children are IconButtons. The icons swell towards the pointer like a macOS dock: the one under it the most, its neighbours a little
 * (`--ds-mag` on each button, set from the pointer's distance; `magnify` switches it off).
 */
export const Dock: React.FC<{ children: React.ReactNode; magnify?: boolean }> = ({ children, magnify = true }) => {
	const ref = useRef<HTMLDivElement>(null);
	const set = (x: number | null) => {
		ref.current?.querySelectorAll<HTMLElement>('.ds-iconbtn').forEach((el) => {
			const box = el.getBoundingClientRect();
			el.style.setProperty('--ds-mag', x === null ? '1' : String(dockMagnification(Math.abs(x - (box.left + box.width / 2)))));
		});
	};
	return (
		<div ref={ref} className='ds-dock' onPointerMove={magnify ? (e) => set(e.clientX) : undefined} onPointerLeave={magnify ? () => set(null) : undefined}>
			{children}
		</div>
	);
};

export interface TipBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}
export interface HoverTipProps {
	tip: React.ReactNode;
	placement?: 'below' | 'above';
	align?: 'start' | 'center';
	/** Controlled visibility (the caller's own hover logic); leave undefined for built-in hover and focus */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** No tip at all (a locked or empty slot) */
	disabled?: boolean;
	/** ms the tip lingers after the pointer leaves; with `interactive` it can then be entered and its text copied */
	closeDelayMs?: number;
	interactive?: boolean;
	/** Replace the built-in placement: gets the anchor's box, the tip's size and the viewport, returns the tip's top-left (the game's `placeTip` fits here) */
	place?: (anchor: TipBox, tip: Size, viewport: Size) => Point;
	children: React.ReactNode;
}
/**
 * Shows `tip` next to the wrapped element while it is hovered or focused. The tip is drawn in a portal on `document.body` with fixed positioning, so no scrolling list, clipped panel
 * or window can hide it, it always sits on top, and it is kept inside the screen. Purely presentational: the tip is any node (usually a Tooltip); visibility can be driven from outside.
 */
export const HoverTip: React.FC<HoverTipProps> = ({
	tip,
	placement = 'below',
	align = 'start',
	open: openProp,
	onOpenChange,
	disabled,
	closeDelayMs = 0,
	interactive,
	place,
	children,
}) => {
	const host = useRef<HTMLSpanElement>(null);
	const pop = useRef<HTMLDivElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [openOwn, setOpenOwn] = useState(false);
	const [at, setAt] = useState<Point | null>(null);
	const open = !disabled && (openProp ?? openOwn);
	const setOpen = (v: boolean) => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		if (v || closeDelayMs <= 0) {
			setOpenOwn(v);
			onOpenChange?.(v);
			if (!v) setAt(null);
			return;
		}
		timer.current = setTimeout(() => {
			setOpenOwn(false);
			onOpenChange?.(false);
			setAt(null);
		}, closeDelayMs);
	};
	useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
	useLayoutEffect(() => {
		if (!open || !host.current || !pop.current) return;
		const r = host.current.getBoundingClientRect();
		const w = pop.current.offsetWidth;
		const h = pop.current.offsetHeight;
		const viewport = { w: window.innerWidth, h: window.innerHeight };
		if (place) {
			setAt(place({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }, { w, h }, viewport));
			return;
		}
		let left = align === 'center' ? r.left + r.width / 2 - w / 2 : r.left;
		let top = placement === 'above' ? r.top - h - 8 : r.bottom + 8;
		if (top < 4) top = r.bottom + 8;
		if (top + h > viewport.h - 4) top = Math.max(4, r.top - h - 8);
		left = Math.max(4, Math.min(left, viewport.w - w - 4));
		setAt({ x: left, y: top });
	}, [open, placement, align, place]);
	return (
		<span
			ref={host}
			className='ds-hovertip'
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			onFocus={() => setOpen(true)}
			onBlur={() => setOpen(false)}
			onPointerDown={() => setOpen(false)}
			onContextMenu={() => setOpen(false)}
		>
			{children}
			{open && typeof document !== 'undefined'
				? createPortal(
						<div
							ref={pop}
							className='ds-root ds-hovertip-pop'
							role='presentation'
							data-interactive={!!interactive}
							style={{ left: at?.x ?? -9999, top: at?.y ?? -9999 }}
							onMouseEnter={interactive ? () => setOpen(true) : undefined}
							onMouseLeave={interactive ? () => setOpen(false) : undefined}
						>
							{tip}
						</div>,
						document.body,
					)
				: null}
		</span>
	);
};

/** A map preview with its event counters and tile count laid over the bottom of the map itself (saves the strip underneath). */
export const MiniMap: React.FC<{ stats: { tone: 'bad' | 'gold' | 'dim'; text: string }[]; width?: number; height?: number; children?: React.ReactNode }> = ({
	stats,
	width = 190,
	height = 120,
	children,
}) => (
	<div className='ds-minimap' style={{ width, height }}>
		{children}
		<div className='ds-minimap-stats'>
			{stats.map((st, i) => (
				<span key={i} className={st.tone === 'bad' ? 'ds-bad' : st.tone === 'gold' ? 'ds-gold-text' : 'ds-dim'}>
					{st.text}
				</span>
			))}
		</div>
	</div>
);

/** Alias of NotifyBadge. */
export const Badge = NotifyBadge;

/** A group of resource chips sharing one dark tray, so tiers (money, base materials, farm goods) read as sets. */
export const ChipGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className='ds-chipgroup'>{children}</span>;
