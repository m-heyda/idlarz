import React from 'react';
import PixelIcon from './PixelIcon';

interface GemIconProps {
	/** 0.5 = 20px inline icon (default), 1 = the full 40px sprite */
	scale?: number;
	/** Hover a pixel or two (for hero spots, not for inline text) */
	float?: boolean;
}

/** The blue diamond: the Gems currency, twinkling. (The Legacy currency has the green gem, see LegacyIcon.) */
const GemIcon: React.FC<GemIconProps> = ({ scale = 0.5, float = false }) => (
	<span className={float ? 'inline-block align-middle px-float' : 'inline-block align-middle'}>
		<PixelIcon name='diamond' alt='Gems' scale={scale} shine />
	</span>
);

export default GemIcon;
