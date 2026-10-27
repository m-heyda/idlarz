import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import audioManager from '@/utils/audioManager';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/ContextMenu.css';

/**
 * The one right-click / dropdown menu. Whoever opens it (a tile, a bag slot, the header button, empty space) hands the store a
 * position and its entries. Kept on screen; closes on Escape, a click or press outside, a scroll, a resize or losing focus.
 */
const ContextMenu: React.FC = () => {
	const menu = useUiStore((state) => state.contextMenu);
	const close = useUiStore((state) => state.closeContextMenu);
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

	// measure, then keep inside the viewport (hidden until placed so it never flashes in the wrong spot)
	useLayoutEffect(() => {
		const el = ref.current;
		if (!menu || !el) {
			setPos(null);
			return;
		}
		const margin = 8;
		setPos({
			left: Math.max(margin, Math.min(menu.x, window.innerWidth - el.offsetWidth - margin)),
			top: Math.max(margin, Math.min(menu.y, window.innerHeight - el.offsetHeight - margin)),
		});
	}, [menu]);

	useEffect(() => {
		if (!menu) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
		const onDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement;
			// the header button that opened the menu closes it itself on its click
			if (ref.current && !ref.current.contains(target) && !target.closest?.('[data-ctx-anchor]')) close();
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('pointerdown', onDown, true);
		window.addEventListener('wheel', close, { passive: true });
		window.addEventListener('resize', close);
		window.addEventListener('blur', close);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('pointerdown', onDown, true);
			window.removeEventListener('wheel', close);
			window.removeEventListener('resize', close);
			window.removeEventListener('blur', close);
		};
	}, [menu, close]);

	// entries with a live hint (a countdown) are redrawn once a second while the menu is open
	const [, setTick] = useState(0);
	const hasLive = !!menu?.items.some((item) => item.liveHint);
	useEffect(() => {
		if (!hasLive) return;
		const timer = setInterval(() => setTick((n) => n + 1), 1000);
		return () => clearInterval(timer);
	}, [hasLive, menu]);

	if (!menu || typeof document === 'undefined') return null;

	return createPortal(
		<div
			ref={ref}
			className='px-tooltip ctx-menu'
			style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
			role='menu'
			aria-label={menu.title ?? 'Menu'}
			onContextMenu={(e) => e.preventDefault()}>
			{menu.title && <div className='ctx-title'>{menu.title}</div>}
			{menu.items.map((item) => (
				<React.Fragment key={item.id}>
					{item.separator && <div className='ctx-sep' role='separator' />}
					<button
						role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
						aria-checked={item.checked}
						className='ctx-item'
						data-danger={!!item.danger}
						disabled={item.disabled}
						title={item.disabled ? item.hint : undefined}
						onClick={() => {
							audioManager.playSound('click');
							close();
							item.onSelect();
						}}>
						{item.checked !== undefined && <span className='ctx-check' data-on={item.checked} aria-hidden />}
						<span>{item.label}</span>
						{(item.liveHint?.() ?? item.hint) && <span className='ctx-hint'>{item.liveHint?.() ?? item.hint}</span>}
					</button>
				</React.Fragment>
			))}
		</div>,
		document.body
	);
};

export default ContextMenu;
