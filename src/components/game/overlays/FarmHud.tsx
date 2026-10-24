import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import { FARM_PRODUCT_KEYS } from '@/config/gameConfig';
import { countOwnedBiomeTypes } from '@/utils/gameUtils';
import ResourceIcon from '../ResourceIcon';

const KEYS = ['meat', ...FARM_PRODUCT_KEYS] as const;

/** Corner readout over the farm scene: what the farm makes per second, what you hold, and the Plains bonus. */
const FarmHud: React.FC = () => {
	const rates = useGameStore((state) => state.resourceRates.total);
	const resources = useGameStore((state) => state.resources);
	const tiles = useGameStore((state) => state.tiles);
	const plains = countOwnedBiomeTypes(tiles, 'plains');

	return (
		<div className='farm-hud' aria-label='Farm statistics'>
			<div className='farm-hud-title'>Farm</div>
			<table>
				<thead>
					<tr>
						<th />
						<th>per s</th>
						<th>per min</th>
						<th>stock</th>
					</tr>
				</thead>
				<tbody>
					{KEYS.map((key) => (
						<tr key={key}>
							<td>
								<ResourceIcon resource={key} />
							</td>
							<td>{formatNumber(rates[key])}</td>
							<td>{formatNumber(rates[key] * 60)}</td>
							<td className='text-[#f1e6c8]'>{formatNumber(resources[key])}</td>
						</tr>
					))}
					<tr>
						<td>
							<ResourceIcon resource='food' />
						</td>
						<td colSpan={2} className='text-[#a89878]'>
							food to spend
						</td>
						<td className='text-green-400'>{formatNumber(resources.food)}</td>
					</tr>
				</tbody>
			</table>
			{plains > 0 && <div className='farm-hud-note'>Plains bonus +{plains * 5}% meat</div>}
		</div>
	);
};

export default FarmHud;
