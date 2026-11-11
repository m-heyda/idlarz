import { useEffect, useRef } from 'react';

/**
 * Keeps a hover tooltip from outliving its reason: while `active`, `dismiss` runs on a scroll or wheel, a click or key press (Escape), a window blur, the pointer leaving the page, and on the first pointer move that
 * lands outside the anchor (a window opened over it, or the element under the cursor was replaced or removed, where the browser sends no `mouseleave`). `isInside(target)` says whether a pointer target still belongs to the anchor; a press inside it also dismisses unless `closeOnInsideClick` is false (a card whose text can be selected).
 */
export const useTipDismiss = (active: boolean, dismiss: () => void, isInside: (target: Element) => boolean, closeOnInsideClick = true) => {
	// the latest callbacks, so the listeners are only bound when `active` flips
	const latest = useRef({ dismiss, isInside });
	latest.current = { dismiss, isInside };
	useEffect(() => {
		if (!active) return;
		const close = () => latest.current.dismiss();
		const onMove = (e: PointerEvent) => {
			if (!(e.target instanceof Element) || !latest.current.isInside(e.target)) close();
		};
		const onDown = (e: PointerEvent) => {
			if (closeOnInsideClick || !(e.target instanceof Element) || !latest.current.isInside(e.target)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('scroll', close, true);
		window.addEventListener('wheel', close, { capture: true, passive: true });
		window.addEventListener('pointerdown', onDown, true);
		window.addEventListener('pointermove', onMove, true);
		window.addEventListener('keydown', onKey);
		window.addEventListener('blur', close);
		document.documentElement.addEventListener('mouseleave', close);
		return () => {
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('wheel', close, true);
			window.removeEventListener('pointerdown', onDown, true);
			window.removeEventListener('pointermove', onMove, true);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('blur', close);
			document.documentElement.removeEventListener('mouseleave', close);
		};
	}, [active, closeOnInsideClick]);
};
