import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber, formatPercent } from '@/utils/formatters';
import { FARM_PRODUCT_KEYS } from '@/config/gameConfig';
import { countOwnedBiomeTypes } from '@/utils/gameUtils';
import ResourceIcon from '../ResourceIcon';
import StableNumber from '../StableNumber';

const KEYS = ['meat', ...FARM_PRODUCT_KEYS] as const;

interface FarmHudProps {
	open: boolean;
	onToggle: () => void;
}

/**
 * Corner readout over the farm scene: what the farm makes per second, what you hold, and the Plains bonus. Every digit sits in
 * a fixed-width cell and the columns have a fixed width, so ticking numbers never move the panel. It folds up to its title.
 */
const FarmHud: React.FC<FarmHudProps> = ({ open, onToggle }) => {
	const rates = useGameStore((state) => state.resourceRates.total);
	const resources = useGameStore((state) => state.resources);
	const tiles = useGameStore((state) => state.tiles);
	const plains = countOwnedBiomeTypes(tiles, 'plains');

	return (
		<div className='farm-hud' data-open={open} aria-label='Farm statistics'>
			<button className='farm-hud-title' onClick={onToggle} aria-expanded={open}>
				Farm <span aria-hidden>{open ? '▲' : '▼'}</span>
			</button>
			{open && (
				<>
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
									<td>
										<StableNumber value={formatNumber(rates[key])} />
									</td>
									<td>
										<StableNumber value={formatNumber(rates[key] * 60)} />
									</td>
									<td className='text-[#f1e6c8]'>
										<StableNumber value={formatNumber(resources[key])} />
									</td>
								</tr>
							))}
							<tr>
								<td>
									<ResourceIcon resource='food' />
								</td>
								<td colSpan={2} className='farm-hud-label'>
									food to spend
								</td>
								<td className='text-green-400'>
									<StableNumber value={formatNumber(resources.food)} />
								</td>
							</tr>
						</tbody>
					</table>
					{plains > 0 && <div className='farm-hud-note'>Plains bonus +{formatPercent(plains * 5)} meat</div>}
				</>
			)}
		</div>
	);
};

export default FarmHud;
