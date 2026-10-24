import React from 'react';
import { TILE_SIZE, CASTLE_RANGE, GRID_CENTER_X, GRID_CENTER_Y } from '@/config/gameConfig';
import { fortressWallTier } from '@/lib/castleWard';
import '@/styles/CastleFortress.css';

const icon = (name: string) => `url('/pixel/icons/${name}.png')`;

/**
 * The castle's fortress (castle level 7+): walls along the four edges of the 3x3 bonus area, a gatehouse in the middle of
 * the south wall and a tower on every corner (a different one per level). Replaces the violet CastleRange overlay; the
 * keep itself is drawn by CastleSprite on the castle tile. Pure decoration: it never takes clicks.
 */
const CastleFortress: React.FC<{ level: number }> = ({ level }) => {
	const r = CASTLE_RANGE.radius;
	const side = (r * 2 + 1) * TILE_SIZE;
	const tier = fortressWallTier(level);
	return (
		<div
			className='castle-fortress'
			style={
				{
					left: (GRID_CENTER_X - r) * TILE_SIZE,
					top: (GRID_CENTER_Y - r) * TILE_SIZE,
					width: side,
					height: side,
					'--wall-h': icon(`castle_wall_h_${tier}`),
					'--wall-v': icon(`castle_wall_v_${tier}`),
					'--gate': icon(`castle_gate_${tier}`),
					'--tower': icon(`castle_tower_${Math.max(7, Math.min(10, level))}`),
				} as React.CSSProperties
			}
			aria-hidden>
			<i className='fort-wall n' />
			<i className='fort-wall s' />
			<i className='fort-wall w' />
			<i className='fort-wall e' />
			<i className='fort-gate' />
			<i className='fort-tower nw' />
			<i className='fort-tower ne' />
			<i className='fort-tower sw' />
			<i className='fort-tower se' />
		</div>
	);
};

export default CastleFortress;
