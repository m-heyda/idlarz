import React from 'react';
import { HoverTip } from '../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../packages/design-system/src/components/tooltips';
import { useUiStore } from '@/stores/uiStore';
import type { UiPrefKey } from '@/lib/uiPrefs';
import '@/styles/MapMarkers.css';

// The three small buttons under the minimap (IDL-376): highlight the chests, the ores or the monsters on the map (`MapMarkers`). It is one choice: pressing one switches the others off, pressing the lit one switches it off. The choice is remembered
// in this browser (a view option, not game state). They live in the top right stack, outside the map's click area (a press on them pays no click gold).

type Pref = Extract<UiPrefKey, 'markChests' | 'markOres' | 'markMonsters'>;
const PREFS: Pref[] = ['markChests', 'markOres', 'markMonsters'];

/** `size`: the picture's width in px, so the three read as the same size; `shift`: px that centre the artwork inside its picture (measured from the opaque pixels: the rock sits low and to the left in its file) */
const BUTTONS: { pref: Pref; label: string; icon: string; text: string; size: number; shift: [number, number] }[] = [
	{
		pref: 'markChests',
		label: 'Highlight chests',
		icon: '/pixel/icons/bonus_chest.png',
		size: 20,
		shift: [0, 0],
		text: 'Rings the treasure chests on the map and points to the nearest one out of view.',
	},
	{
		pref: 'markOres',
		label: 'Highlight ores',
		icon: '/pixel/rocks/rock_silver.png',
		size: 26,
		shift: [2, -1.5],
		text: 'Rings the rocks and ores you can mine and points to the nearest one out of view.',
	},
	{
		pref: 'markMonsters',
		label: 'Highlight monsters',
		icon: '/pixel/items/junk/junk_claw.png',
		size: 22,
		shift: [0.5, 0.5],
		text: 'Rings the monsters on the map and points to the nearest one out of view.',
	},
];

const MapHighlightBar: React.FC = () => {
	const markChests = useUiStore((state) => state.markChests);
	const markOres = useUiStore((state) => state.markOres);
	const markMonsters = useUiStore((state) => state.markMonsters);
	const setPref = useUiStore((state) => state.setPref);
	const on: Record<Pref, boolean> = { markChests, markOres, markMonsters };

	const choose = (pref: Pref) => {
		const turnOn = !on[pref];
		// a choice, not a set: at most one kind is marked
		for (const other of PREFS) setPref(other, other === pref && turnOn);
	};

	return (
		<div data-map-highlight-bar className='ds-root map-mark-bar'>
			{BUTTONS.map(({ pref, label, icon, text, size, shift }) => (
				<HoverTip key={pref} placement='below' align='center' tip={<HintTooltip title={label} text={text} />}>
					<button
						type='button'
						className='map-mark-btn'
						data-active={on[pref] ? 'true' : undefined}
						aria-pressed={on[pref]}
						aria-label={label}
						onClick={() => choose(pref)}
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={icon} alt='' draggable={false} style={{ width: size, height: size, transform: `translate(${shift[0]}px, ${shift[1]}px)` }} />
					</button>
				</HoverTip>
			))}
		</div>
	);
};

export default MapHighlightBar;
