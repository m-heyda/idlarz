import React, { useEffect, useRef } from 'react';
import '@/styles/Rocks.css';

// The pickaxe over a rock (IDL-376). A browser cursor is a still picture, so the real cursor is hidden over a rock (`.tile-has-rock`, see Rocks.css) and this small picture follows the pointer instead: it swings down on every click, like a hit.
// It moves straight in the DOM (no React render per mouse move) and shows only while the pointer is on a rock tile.

/** Where the tip of the pick is in the 36 px picture: the point that sits on the pointer */
const HOT = { x: 25, y: 9 };

const PickaxeCursor: React.FC = () => {
	const ref = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	useEffect(() => {
		const box = ref.current;
		const img = imgRef.current;
		if (!box || !img) return;
		let over = false;
		const show = (on: boolean) => {
			if (on === over) return;
			over = on;
			box.style.display = on ? 'block' : 'none';
		};
		const onMove = (e: MouseEvent) => {
			const on = e.target instanceof Element && !!e.target.closest('.tile-has-rock');
			show(on);
			if (on) box.style.transform = `translate(${e.clientX - HOT.x}px, ${e.clientY - HOT.y}px)`;
		};
		// a press on a rock: restart the swing (removing the class and reading a layout value makes the animation start again, even for clicks 80 ms apart)
		const onDown = (e: MouseEvent) => {
			if (!over || e.button !== 0) return;
			img.classList.remove('swing');
			void img.offsetWidth;
			img.classList.add('swing');
		};
		const hide = () => show(false);
		window.addEventListener('mousemove', onMove, { passive: true });
		window.addEventListener('mousedown', onDown, { capture: true, passive: true });
		document.addEventListener('mouseleave', hide);
		window.addEventListener('blur', hide);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mousedown', onDown, { capture: true });
			document.removeEventListener('mouseleave', hide);
			window.removeEventListener('blur', hide);
		};
	}, []);

	return (
		<div ref={ref} className='pickaxe-cursor' aria-hidden>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img ref={imgRef} src='/pixel/ui/cursor_pickaxe.png' alt='' draggable={false} width={36} height={36} />
		</div>
	);
};

export default PickaxeCursor;
