import React from 'react';
import Minimap from './Minimap';
import CombatWidget from './overlays/CombatWidget';

/** The bottom right corner: the combat panel (or its icon) and the map overview. Outside the map's click area, so using it never pays gold. */
const BottomRightStack: React.FC = () => (
	<div data-bottom-right-stack className='fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2'>
		<CombatWidget />
		<Minimap />
	</div>
);

export default BottomRightStack;
