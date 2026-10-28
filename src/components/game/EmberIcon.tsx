import React from 'react';
import PixelIcon from './PixelIcon';

interface EmberIconProps {
	/** 0.5 = 20px inline icon (default), 1 = the full 40px sprite */
	scale?: number;
	/** Hover a pixel or two (for hero spots, not for inline text) */
	float?: boolean;
}

/** The green gem: the rebirth currency (Embers), twinkling. Not the Gems currency, which has the diamond. */
const EmberIcon: React.FC<EmberIconProps> = ({ scale = 0.5, float = false }) => (
	<span className={float ? 'inline-block align-middle px-float' : 'inline-block align-middle'}>
		<PixelIcon name='legacy' alt='Embers' scale={scale} shine />
	</span>
);

export default EmberIcon;
