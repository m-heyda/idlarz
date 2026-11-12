import React, { useRef, useState } from 'react';
import { gemStates, type Rarity } from '../logic';

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
}
/** Plate button. `gold` is the primary action, `stone` the default, `dark` for the disabled "need more" state. */
export const Button: React.FC<ButtonProps> = ({ tone = 'stone', className, ...rest }) => (
	<button type='button' className={cx('ds-btn', tone !== 'stone' && `ds-btn-${tone}`, className)} {...rest} />
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
				onClick={() => onChange?.(t.id)}
			>
				{t.label}
				{t.badge ? <Badge count={t.badge} /> : null}
			</button>
		))}
	</div>
);

/** A resource in the top bar: icon, amount, optional income per second. */
export const ResourceChip: React.FC<{ icon: string; value: string; rate?: string; title?: string }> = ({ icon, value, rate, title }) => (
	<span className='ds-chip' title={title}>
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
export const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
	<div className='ds-stat'>
		<span className='ds-stat-label'>{label}</span>
		<span className='ds-stat-value'>{value}</span>
	</div>
);

export interface SlotProps {
	icon?: string;
	rarity?: Rarity;
	count?: number;
	/** Show a faded placeholder icon for an empty equipment slot */
	empty?: boolean;
	locked?: boolean;
	large?: boolean;
	/** Marks the slot as the selected one (recipe picker) */
	active?: boolean;
	title?: string;
	onClick?: () => void;
}
/** An item or equipment slot. Rarity draws a coloured glowing rim; `empty` dims the slot's silhouette. */
export const Slot: React.FC<SlotProps> = ({ icon, rarity, count, empty, locked, large, active, title, onClick }) => {
	const glow = rarity && rarity !== 'common';
	return (
		<button
			type='button'
			className={cx('ds-slot', large && 'ds-slot-lg')}
			data-rarity={glow ? rarity : undefined}
			style={glow ? ({ '--ds-rarity': `var(--ds-r-${rarity})` } as React.CSSProperties) : undefined}
			data-empty={empty}
			data-locked={locked}
			data-active={active}
			title={title}
			onClick={onClick}
		>
			{icon ? <img src={icon} alt='' /> : null}
			{count && count > 1 ? <span className='ds-slot-count'>{count}</span> : null}
		</button>
	);
};

/** A stone menu icon with a caption (the middle bar of the HUD). */
export const IconButton: React.FC<{ icon: string; label: string; badge?: number; small?: boolean; onClick?: () => void }> = ({
	icon,
	label,
	badge,
	small,
	onClick,
}) => (
	<button type='button' className={cx('ds-iconbtn', small && 'ds-iconbtn-sm')} onClick={onClick}>
		<img src={icon} alt='' />
		{badge ? <Badge count={badge} floating /> : null}
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
	title: string;
	/** Starting size in px; the user can resize from the bottom-right corner when `resizable` */
	width?: number;
	height?: number;
	minWidth?: number;
	minHeight?: number;
	draggable?: boolean;
	resizable?: boolean;
	bar?: React.ReactNode;
	barRight?: React.ReactNode;
	onClose?: () => void;
	children: React.ReactNode;
}
/**
 * The window: frame, flanked title (drag handle), close button, a tab/head bar and a scrolling body, resizable from its corner. It is a size container (`container-name: ds-win`),
 * so anything inside can adapt with `@container ds-win (max-width: ...)`: the Hero window scales its slots and stacks its columns that way. Only presentational: the caller owns open/close
 * and tab state; size and position are kept here because they are pure UI.
 */
export const WindowShell: React.FC<WindowShellProps> = ({
	title,
	width = 1100,
	height = 640,
	minWidth = 380,
	minHeight = 300,
	draggable = true,
	resizable = true,
	bar,
	barRight,
	onClose,
	children,
}) => {
	const [size, setSize] = useState({ w: width, h: height });
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
	const rs = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);
	return (
		<div className='ds-root ds-winroot' style={{ width: size.w, height: size.h, transform: `translate(${pos.x}px, ${pos.y}px)` }}>
			<div
				className='ds-window-title'
				data-draggable={draggable}
				onPointerDown={(e) => {
					if (!draggable) return;
					e.currentTarget.setPointerCapture(e.pointerId);
					drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
				}}
				onPointerMove={(e) => drag.current && setPos({ x: drag.current.x + e.clientX - drag.current.sx, y: drag.current.y + e.clientY - drag.current.sy })}
				onPointerUp={() => (drag.current = null)}
			>
				{title}
			</div>
			<CloseButton onClick={onClose} />
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
					<div className='ds-window-body'>{children}</div>
				</div>
			</Frame>
			{resizable ? (
				<div
					className='ds-resize'
					role='separator'
					aria-label='Resize window'
					onPointerDown={(e) => {
						e.currentTarget.setPointerCapture(e.pointerId);
						rs.current = { sx: e.clientX, sy: e.clientY, w: size.w, h: size.h };
					}}
					onPointerMove={(e) =>
						rs.current &&
						setSize({ w: Math.max(minWidth, rs.current.w + e.clientX - rs.current.sx), h: Math.max(minHeight, rs.current.h + e.clientY - rs.current.sy) })
					}
					onPointerUp={() => (rs.current = null)}
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
/** A small square button with one engraved character (Deeds, Settings). Tones: `gold` (the default plate), `wood`, `stone`. */
export const GlyphButton: React.FC<{ glyph: string; label: string; tone?: GlyphTone; onClick?: () => void }> = ({ glyph, label, tone = 'gold', onClick }) => (
	<button type='button' className='ds-glyphbtn' data-tone={tone} aria-label={label} title={label} onClick={onClick}>
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

/** The stone bar of menu icons along the bottom of the game screen, framed in gold. Children are IconButtons. */
export const Dock: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className='ds-dock'>{children}</div>;

/** Shows `tip` under (or above) the wrapped element while it is hovered or focused. Purely presentational; the tip is any node, usually a Tooltip. */
export const HoverTip: React.FC<{ tip: React.ReactNode; placement?: 'below' | 'above'; align?: 'start' | 'center'; children: React.ReactNode }> = ({
	tip,
	placement = 'below',
	align = 'start',
	children,
}) => (
	<span className='ds-hovertip' data-placement={placement} data-align={align}>
		{children}
		<span className='ds-hovertip-pop' role='presentation'>
			{tip}
		</span>
	</span>
);

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
