import React, { useEffect, useLayoutEffect, useState } from 'react';
import { WindowShell } from '../../../packages/design-system/src/components/primitives';
import { clampWindowPosition, clampWindowSize } from '../../../packages/design-system/src/logic';
import { useWindowStore, type WinId } from '@/stores/windowStore';
import { hasOpenModal } from './PixelModal';

/** Below this screen width windows are laid out one at a time (no room to drag them side by side) */
const NARROW_PX = 900;
/** Keep at least this much of a dragged window on screen */
const KEEP_VISIBLE_PX = 80;
/** The smallest a window can be dragged to */
const MIN_SIZE = { w: 420, h: 260 };
/** The z-index of the back-most window; the front one is this plus the number of open windows (modal backdrops are above, at 45) */
const BASE_Z = 40;
/** The height of a window that gives none (the old windows were as tall as their content; the design-system shell has a fixed height) */
const DEFAULT_HEIGHT = 640;

export interface GameWindowProps {
	id: WinId;
	title: React.ReactNode;
	icon?: React.ReactNode;
	/** Width in px (shrinks to fit a small screen) */
	width?: number;
	/** Height in px when the player has not resized the window */
	height?: number;
	/** No body padding or scrolling: the content fills the whole window (the farm scene) */
	flush?: boolean;
	/** A tab or head bar drawn under the title */
	bar?: React.ReactNode;
	barRight?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}

/** The header the windows must not slide under (`--header-h` on the page root) */
const headerHeight = (): number => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 76;

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

/**
 * A game window drawn with the design system's `WindowShell`, driven by `windowStore` (IDL-324). It takes the same props as `PixelWindow`, so a window moves over by swapping the component.
 * The store owns everything the shell leaves to the caller: where the window is, how big, who is in front (z-index from the open order), closing, Esc and remembering the geometry.
 * A press anywhere in the window brings it to the front; Esc closes the front one unless a real modal is open (that one takes the key first).
 */
const GameWindow: React.FC<GameWindowProps> = ({ id, title, icon, width = 820, height, flush, bar, barRight, className, children }) => {
	const pos = useWindowStore((state) => state.positions[id]);
	const stored = useWindowStore((state) => state.sizes[id]);
	const rank = useWindowStore((state) => state.order.indexOf(id));
	const isFront = useWindowStore((state) => state.order[state.order.length - 1] === id);
	const { focusWindow, closeWindow, moveWindow, savePositions, resizeWindow, saveSizes } = useWindowStore.getState();
	const [narrow, setNarrow] = useState(false);

	useEffect(() => {
		const update = () => setNarrow(window.innerWidth < NARROW_PX);
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	useEffect(() => {
		if (!isFront) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !hasOpenModal()) closeWindow(id);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [isFront, closeWindow, id]);

	const wanted = stored ?? { w: width, h: height ?? DEFAULT_HEIGHT };
	// a window never reaches past the screen edges from where it sits (a tall window on a short screen shrinks to the room it has)
	const size =
		typeof window === 'undefined'
			? wanted
			: {
					w: Math.max(MIN_SIZE.w, Math.min(wanted.w, window.innerWidth - pos.x - 8)),
					h: Math.max(MIN_SIZE.h, Math.min(wanted.h, window.innerHeight - pos.y - 8)),
				};

	// a window left near an edge of a bigger screen is pulled back in when the screen got smaller
	useLayoutEffect(() => {
		if (narrow) return;
		const next = clampWindowPosition(pos, size, viewport(), { keepVisible: KEEP_VISIBLE_PX, minY: headerHeight() });
		if (next.x !== pos.x || next.y !== pos.y) moveWindow(id, next.x, next.y);
	}, [pos, size.w, size.h, narrow, id, moveWindow]); // eslint-disable-line react-hooks/exhaustive-deps

	if (rank < 0) return null;

	return (
		<WindowShell
			title={title}
			icon={icon}
			className={className}
			position={narrow ? { x: 0, y: headerHeight() + 8 } : pos}
			onPositionChange={(p) => {
				const next = clampWindowPosition(p, size, viewport(), { keepVisible: KEEP_VISIBLE_PX, minY: headerHeight() });
				moveWindow(id, next.x, next.y);
			}}
			size={narrow ? { w: Math.min(size.w, window.innerWidth - 16), h: size.h } : size}
			onSizeChange={(s) => {
				const next = clampWindowSize(size, { x: s.w - size.w, y: s.h - size.h }, MIN_SIZE, { w: window.innerWidth - pos.x, h: window.innerHeight - pos.y });
				resizeWindow(id, next.w, next.h);
			}}
			minWidth={MIN_SIZE.w}
			minHeight={MIN_SIZE.h}
			onGeometryCommit={() => {
				savePositions();
				saveSizes();
			}}
			onFocus={() => focusWindow(id)}
			zIndex={BASE_Z + rank}
			active={isFront}
			fixed={narrow}
			flush={flush}
			bar={bar}
			barRight={barRight}
			onClose={() => closeWindow(id)}
		>
			{children}
		</WindowShell>
	);
};

export default GameWindow;
