import React from 'react';
import Minimap from './Minimap';

/** The bottom right corner: the map overview. Outside the map's click area, so using it never pays gold. */
const BottomRightStack: React.FC = () => (
	<div data-bottom-right-stack className='fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2'>
		<Minimap />
	</div>
);

export default BottomRightStack;
