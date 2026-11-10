import React from 'react';
import '@/styles/Tutorial.css';
import { GUIDE_NAME, GUIDE_SPRITE } from '@/catalog/tutorial';

export interface GuideBubbleProps {
	text: string;
	/** "2 / 3" under the text (the intro's pages) */
	progress?: string;
	/** The main button: "Next", "Got it"; left out when the player has to do the task to go on */
	actionLabel?: string;
	onAction?: () => void;
	onSkip: () => void;
	skipLabel?: string;
}

/** Brother Alder on the left of the screen with his speech bubble. The Skip button is on every bubble. */
const GuideBubble: React.FC<GuideBubbleProps> = ({ text, progress, actionLabel, onAction, onSkip, skipLabel = 'Skip' }) => (
	<div className='guide' role='dialog' aria-label={GUIDE_NAME} data-tutorial-guide>
		<div className='guide-sprite' style={{ backgroundImage: `url(${GUIDE_SPRITE})` }} role='img' aria-label={GUIDE_NAME} />
		<div className='guide-bubble'>
			<div className='guide-name'>{GUIDE_NAME}</div>
			<div>{text}</div>
			<div className='guide-actions'>
				<span className='guide-dots'>{progress}</span>
				<span className='flex gap-2'>
					<button type='button' className='px-btn px-btn-sm px-btn-gray' onClick={onSkip}>
						{skipLabel}
					</button>
					{actionLabel && onAction && (
						<button type='button' className='px-btn px-btn-sm' onClick={onAction} autoFocus>
							{actionLabel}
						</button>
					)}
				</span>
			</div>
		</div>
	</div>
);

export default GuideBubble;
