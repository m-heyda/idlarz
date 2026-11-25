import React from 'react';
import { HoverTip } from '../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../packages/design-system/src/components/tooltips';
import { MARK_BUTTONS } from '@/config/mapMarks';
import { useMapMarks } from './useMapMarks';
import '@/styles/MapMarkers.css';

// The three small buttons under the minimap (IDL-376): highlight the chests, the ores or the monsters on the map (`MapMarkers`). It is one choice: pressing one switches the others off, pressing the lit one switches it off (`chooseMark`). The choice is remembered
// in this browser (a view option, not game state); the Kingdom overview's "Find on the map" cards press the same marks. They live in the top right stack, outside the map's click area (a press on them pays no click gold).

const MapHighlightBar: React.FC = () => {
	const { on, choose } = useMapMarks();

	return (
		<div data-map-highlight-bar className='ds-root map-mark-bar'>
			{MARK_BUTTONS.map(({ pref, label, icon, text, size, shift }) => (
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
