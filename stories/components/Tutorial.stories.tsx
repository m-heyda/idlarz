import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import GuideBubble from '@/components/game/tutorial/GuideBubble';
import FocusLayer, { useTargetRects } from '@/components/game/tutorial/FocusLayer';
import { INTRO, TUTORIAL_PATH } from '@/catalog/tutorial';
import { buildNumbers } from '@/lib/tutorial/numbers';
import type { FocusMode } from '@/catalog/tutorial';

// The real tutorial components: Brother Alder with his bubble, and the focus layer around a target. Texts come from the catalog and the live config.
const numbers = buildNumbers();

const meta = {
	title: 'Components/Tutorial',
	component: GuideBubble,
	args: {
		text: INTRO[0].text(numbers),
		progress: '1 / 3',
		actionLabel: 'Next',
		onAction: () => undefined,
		onSkip: () => undefined,
		skipLabel: 'Skip tutorial',
	},
} satisfies Meta<typeof GuideBubble>;
export default meta;

/** Typing: the text appears letter by letter (about 30 characters a second) while Alder's mouth opens and closes; a click on the bubble or any key shows the rest. Reload the story to see it again. */
export const Typing: StoryObj<typeof meta> = {};

/** The finished bubble: the whole text, the mouth closed. The bubble has this height from the first letter, so nothing jumps. */
export const Complete: StoryObj<typeof meta> = { args: { instant: true } };

/** What `prefers-reduced-motion: reduce` does by itself: the whole text at once, no typing, no talking (shown here with `instant`). */
export const ReducedMotion: StoryObj<typeof meta> = { args: { instant: true, text: INTRO[2].text(numbers), progress: '3 / 3', actionLabel: 'Let us go' } };

/** The first intro page; the real intro also dims the whole screen (see IntroDim). */
export const Bubble: StoryObj<typeof meta> = {};

export const StepBubble: StoryObj<typeof meta> = {
	args: { text: TUTORIAL_PATH[1].text(numbers), progress: 'Step 2 of 8', actionLabel: undefined, onAction: undefined },
};

const Stage: React.FC<{ mode: FocusMode; intro?: boolean }> = ({ mode, intro = false }) => {
	const rects = useTargetRects(intro ? undefined : 'story-target');
	const [clicks, setClicks] = React.useState(0);
	const [view, setView] = React.useState({ width: 1000, height: 600 });
	React.useEffect(() => {
		const update = () => setView({ width: window.innerWidth, height: window.innerHeight });
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return (
		<div style={{ height: '100vh', padding: 24, color: '#f1e6c8' }}>
			<p>Clicks that reached the page: {clicks}. In strict mode only the highlighted button counts; in soft mode every click does.</p>
			<div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
				<button className='px-btn' onClick={() => setClicks((n) => n + 1)}>
					Elsewhere
				</button>
				<button className='px-btn' data-tutorial='story-target' onClick={() => setClicks((n) => n + 1)}>
					The target
				</button>
			</div>
			<FocusLayer holes={rects} mode={mode} view={view} intro={intro} />
			<GuideBubble text={intro ? INTRO[0].text(numbers) : TUTORIAL_PATH[0].text(numbers)} onSkip={() => undefined} skipLabel='Skip tutorial' />
		</div>
	);
};

/** Strict: dimmed and blurred, a cut-out and a pulsing ring around the target; clicks anywhere else are blocked. */
export const FocusStrict: StoryObj<typeof meta> = { render: () => <Stage mode='strict' /> };

/** Soft: dimmed with the same cut-out, but the game stays usable. */
export const FocusSoft: StoryObj<typeof meta> = { render: () => <Stage mode='soft' /> };

/** The intro: the whole screen dimmed, no cut-out. */
export const IntroDim: StoryObj<typeof meta> = { render: () => <Stage mode='strict' intro /> };
