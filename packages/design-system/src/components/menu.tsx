import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
	id: string;
	label: string;
	/** Right-aligned grey hint: a price, a key, a reason it is disabled */
	hint?: string;
	disabled?: boolean;
	/** Red entry (Discard) */
	danger?: boolean;
	/** A rule above this entry */
	separator?: boolean;
	/** Draws a check box (toggle entries); undefined = a plain entry */
	checked?: boolean;
	/** Hover text (why an entry is disabled, what it does) */
	tooltip?: string;
	/** A hint that changes while the menu is open (a countdown); redrawn once a second */
	liveHint?: () => string;
	/** A submenu: choosing the entry opens these in place, with a Back entry that returns */
	children?: MenuItem[];
	onSelect: () => void;
}
export interface MenuState {
	x: number;
	y: number;
	title?: string;
	items: MenuItem[];
}

/**
 * The right-click menu, shaped like the game's (title, entries with hints, a rule before the destructive one). The caller owns `menu` (null = closed): set it from a slot's `onContextMenu` with
 * the pointer position and the entries. It sits in a portal on top of everything, stays inside the screen and closes on Escape, an outside press, a scroll, a resize or losing focus.
 */
export const ContextMenu: React.FC<{ menu: MenuState | null; onClose: () => void }> = ({ menu: opened, onClose }) => {
	const ref = useRef<HTMLDivElement>(null);
	// a submenu replaces the entries in place; opening another menu starts from its own entries again
	const [sub, setSub] = useState<MenuState | null>(null);
	useEffect(() => setSub(null), [opened]);
	const menu = sub ?? opened;
	// entries with a live hint (a countdown) are redrawn once a second while the menu is open
	const [, setTick] = useState(0);
	const hasLive = !!menu?.items.some((it) => it.liveHint);
	useEffect(() => {
		if (!hasLive) return;
		const t = setInterval(() => setTick((n) => n + 1), 1000);
		return () => clearInterval(t);
	}, [hasLive]);
	const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!menu || !el) return setPos(null);
		const m = 8;
		setPos({
			left: Math.max(m, Math.min(menu.x, window.innerWidth - el.offsetWidth - m)),
			top: Math.max(m, Math.min(menu.y, window.innerHeight - el.offsetHeight - m)),
		});
	}, [menu]);
	useEffect(() => {
		if (!menu) return;
		const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		const down = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
		window.addEventListener('keydown', key);
		window.addEventListener('pointerdown', down, true);
		window.addEventListener('wheel', onClose, { passive: true });
		window.addEventListener('resize', onClose);
		window.addEventListener('blur', onClose);
		return () => {
			window.removeEventListener('keydown', key);
			window.removeEventListener('pointerdown', down, true);
			window.removeEventListener('wheel', onClose);
			window.removeEventListener('resize', onClose);
			window.removeEventListener('blur', onClose);
		};
	}, [menu, onClose]);
	if (!menu || typeof document === 'undefined') return null;
	return createPortal(
		<div
			ref={ref}
			className='ds-root ds-menu'
			role='menu'
			aria-label={menu.title ?? 'Menu'}
			style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
			onContextMenu={(e) => e.preventDefault()}
		>
			{menu.title ? <div className='ds-menu-title'>{menu.title}</div> : null}
			{menu.items.map((it) => (
				<React.Fragment key={it.id}>
					{it.separator ? <div className='ds-menu-sep' role='separator' /> : null}
					<button
						type='button'
						role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
						aria-checked={it.checked}
						className='ds-menu-item'
						data-danger={!!it.danger}
						disabled={it.disabled}
						title={it.tooltip ?? (it.disabled ? it.hint : undefined)}
						onClick={() => {
							if (it.children) {
								const parent = menu;
								setSub({
									x: menu.x,
									y: menu.y,
									title: it.label.replace(/\.\.\.$/, ''),
									items: [...it.children, { id: 'ds-back', label: 'Back', separator: true, onSelect: () => setSub(parent === opened ? null : parent) }],
								});
								return;
							}
							onClose();
							it.onSelect();
						}}
					>
						{it.checked !== undefined ? <span className='ds-menu-check' data-on={it.checked} aria-hidden /> : null}
						<span>{it.label}</span>
						{(it.liveHint?.() ?? it.hint) ? <span className='ds-menu-hint'>{it.liveHint?.() ?? it.hint}</span> : null}
					</button>
				</React.Fragment>
			))}
		</div>,
		document.body,
	);
};
