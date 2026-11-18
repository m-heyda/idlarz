import React from 'react';
import Minimap from './Minimap';
import MapHighlightBar from './MapHighlightBar';
import CombatWidget from './overlays/CombatWidget';

/**
 * The corners of the screen outside the map's click area (using them never pays gold): the combat panel (or its icon) bottom right and the map overview top right, just under the header.
 * `combat` replaces the real combat panel (the map lab shows a mock one in the same spot).
 */
const BottomRightStack: React.FC<{ combat?: React.ReactNode }> = ({ combat }) => (
	<>
		<div data-top-right-stack className='fixed right-4 z-40 flex flex-col items-end' style={{ top: 'calc(var(--header-h, 76px) + 8px)' }}>
			<Minimap />
			<MapHighlightBar />
		</div>
		<div data-bottom-right-stack className='fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2'>
			{combat !== undefined ? combat : <CombatWidget />}
		</div>
	</>
);

export default BottomRightStack;
