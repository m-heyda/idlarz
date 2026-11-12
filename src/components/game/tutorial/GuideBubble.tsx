import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@/styles/Tutorial.css';
import { GUIDE_NAME, GUIDE_TALK_SHEET } from '@/catalog/tutorial';
import { TYPE_CPS, TYPE_TICK_MS, glyphs, mouthOpen, visibleLength } from '@/lib/tutorial/typewriter';
import { Button } from '../../../../packages/design-system/src/components/primitives';

/**
 * The text of a bubble typed out letter by letter. A click on the bubble or any key shows the rest at once; with `prefers-reduced-motion` (or `instant`) the whole text is there from the start.
 * Returns how many characters show, whether the text is complete, and a `skip` that completes it.
 */
export const useTypewriter = (text: string, instant = false): { typed: number; done: boolean; skip: () => void } => {
	const total = glyphs(text).length;
	const [typed, setTyped] = useState(0);
	const skipped = useRef(false);
	const skip = useCallback(() => {
		skipped.current = true;
		setTyped(total);
	}, [total]);
	useEffect(() => {
		if (instant || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) {
			setTyped(total);
			return;
		}
		skipped.current = false;
		setTyped(0);
		const started = performance.now();
		const timer = setInterval(() => {
			if (skipped.current) return clearInterval(timer);
			const n = visibleLength(total, performance.now() - started, TYPE_CPS);
			setTyped(n);
			if (n >= total) clearInterval(timer);
		}, TYPE_TICK_MS);
		return () => clearInterval(timer);
	}, [text, total, instant]);
	const done = typed >= total;
	useEffect(() => {
		if (done) return;
		const onKey = (e: KeyboardEvent) => {
			if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) skip();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [done, skip]);
	return { typed, done, skip };
};

export interface GuideBubbleProps {
	text: string;
	/** "2 / 3" under the text (the intro's pages) */
	progress?: string;
	/** The main button: "Next", "Got it"; left out when the player has to do the task to go on */
	actionLabel?: string;
	onAction?: () => void;
	onSkip: () => void;
	skipLabel?: string;
	/** Show the whole text at once (what `prefers-reduced-motion` does by itself) */
	instant?: boolean;
}

/**
 * Brother Alder on the left of the screen with his speech bubble. The text is typed out (`useTypewriter`); the bubble keeps the final height from the first frame (the whole text is laid out
 * invisibly under the typed part) and a screen reader gets the whole text at once. While he types, Alder alternates between his two frames (`scripts/guide-sprite.ts`) and rests on the closed mouth
 * when the text is complete. The Skip button is on every bubble.
 */
const GuideBubble: React.FC<GuideBubbleProps> = ({ text, progress, actionLabel, onAction, onSkip, skipLabel = 'Skip', instant = false }) => {
	const { typed, done, skip } = useTypewriter(text, instant);
	const chars = glyphs(text);
	const frame = !done && mouthOpen(text, typed) ? 1 : 0;
	return (
		<div className='guide' role='dialog' aria-label={GUIDE_NAME} data-tutorial-guide>
			<div className='guide-sprite' data-frame={frame} style={{ backgroundImage: `url(${GUIDE_TALK_SHEET})` }} role='img' aria-label={GUIDE_NAME} />
			<div className='guide-bubble'>
				<div className='guide-name'>{GUIDE_NAME}</div>
				{/* announced as a whole, once; the visible copy below is hidden from assistive technology */}
				<span className='sr-only' role='status'>
					{text}
				</span>
				<div className='guide-text' aria-hidden onClick={skip} data-done={done}>
					<span className='guide-text-full'>{text}</span>
					<span className='guide-text-typed'>{chars.slice(0, typed).join('')}</span>
				</div>
				<div className='guide-actions'>
					<span className='guide-dots'>{progress}</span>
					<span className='flex gap-2'>
						<Button tone='dark' size='sm' onClick={onSkip}>
							{skipLabel}
						</Button>
						{actionLabel && onAction && (
							<Button size='sm' onClick={onAction} autoFocus>
								{actionLabel}
							</Button>
						)}
					</span>
				</div>
			</div>
		</div>
	);
};

export default GuideBubble;
