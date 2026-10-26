import React from 'react';
import { TILE_SIZE, CASTLE_RANGE, CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import '@/styles/CastleRange.css';

/** Violet patch drawn over the tiles the castle's range bonus covers (the bonus itself comes later): 3x3, growing with the castle from level 8. */
const CastleRange: React.FC<{ radius?: number }> = ({ radius = CASTLE_RANGE.radius }) => {
	const r = radius;
	const side = (r * 2 + 1) * TILE_SIZE;
	return (
		<div
			className='castle-range'
			style={{
				left: (CASTLE_X - r) * TILE_SIZE,
				top: (CASTLE_Y - r) * TILE_SIZE,
				width: side,
				height: side,
			}}
			aria-hidden>
			<i className='range-edge top' />
			<i className='range-edge right' />
			<i className='range-edge bottom' />
			<i className='range-edge left' />
			<i className='range-corner tl' />
			<i className='range-corner tr' />
			<i className='range-corner bl' />
			<i className='range-corner br' />
		</div>
	);
};

export default CastleRange;
