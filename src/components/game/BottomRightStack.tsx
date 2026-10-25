import React from 'react';
import Minimap from './Minimap';
import StatsOverlay from './StatsOverlay';

/** The bottom right corner: the map overview on top of the statistics panel. Outside the map's click area, so using it never pays gold. */
const BottomRightStack: React.FC = () => (
	<div className='fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2'>
		<Minimap />
		<StatsOverlay />
	</div>
);

export default BottomRightStack;
