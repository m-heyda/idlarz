import React, { useEffect } from 'react';
import { ITEM_CATALOG } from '@/catalog';
import { COMPONENTS } from '@/catalog/recipes';
import { selectStock, useCraftStore } from '@/stores/craftStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber } from '@/utils/formatters';
import PixelIcon from './PixelIcon';
import { itemIconName } from './itemUi';
import './overlays/CraftingOverlay.css';

/**
 * The bag's Crafting tab: what crafting made, kept on the server (components for recipes, potions and trade goods). No slots, no limit but
 * the stash cap, and a rebirth does not touch it. Potions and goods are taken into the bag to drink or sell; components stay for recipes.
 */
const CraftStash: React.FC = () => {
	const stock = useCraftStore(selectStock);
	const busy = useCraftStore((state) => state.busy);
	const withdraw = useCraftStore((state) => state.withdraw);
	const refresh = useCraftStore((state) => state.refresh);
	const showToast = useUiStore((state) => state.showToast);
	useEffect(() => void refresh(), [refresh]);

	const entries = Object.entries(stock)
		.filter(([, qty]) => qty > 0)
		.map(([id, qty]) => {
			const item = ITEM_CATALOG[id];
			return {
				id,
				qty,
				name: item?.name ?? COMPONENTS[id]?.name ?? id,
				icon: item ? itemIconName(item) : ('comp_glass_vial' as const),
				takeable: !!item,
				stack: item?.stackMax ?? 1,
			};
		});
	if (entries.length === 0) return <p className='px-tip-muted'>Nothing crafted yet. Finished potions, goods and components collect here.</p>;

	return (
		<div className='cr-stash'>
			{entries.map((entry) => (
				<div key={entry.id} className='cr-stash-row'>
					<PixelIcon name={entry.icon} alt='' />
					<span className='cr-stash-name'>{entry.name}</span>
					<span className='cr-stash-qty'>{formatNumber(entry.qty)}</span>
					{entry.takeable && (
						<>
							<button
								className='px-btn px-btn-sm'
								disabled={busy}
								aria-label={`Take one ${entry.name} into the bag`}
								onClick={() => void withdraw(entry.id, 1).then(showToast)}
							>
								1
							</button>
							<button
								className='px-btn px-btn-sm'
								disabled={busy}
								aria-label={`Take a stack of ${entry.name} into the bag`}
								onClick={() => void withdraw(entry.id, Math.min(entry.qty, entry.stack)).then(showToast)}
							>
								Stack
							</button>
							<button
								className='px-btn px-btn-sm'
								disabled={busy}
								aria-label={`Take all ${entry.name} that fit into the bag`}
								onClick={() => void withdraw(entry.id, entry.qty).then(showToast)}
							>
								All
							</button>
						</>
					)}
				</div>
			))}
		</div>
	);
};

export default CraftStash;
