import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { EQUIPMENT_SLOT_LABEL, ITEM_CATALOG, RATTATUI_SET } from '@/config/itemCatalog';
import { aggregateStats } from '@/lib/inventory';
import ResourceIcon from './ResourceIcon';
import { RARITY_COLOR } from './itemUi';

const STAT_LABEL: Record<string, string> = { damage: 'Damage', armor: 'Armor', maxHp: 'Max HP' };

/** The body of an item hover card (name, slot, stats, set progress, description, sell value). */
const ItemTooltipBody: React.FC<{ itemId: string }> = ({ itemId }) => {
	const equipment = useGameStore((state) => state.equipment);
	const def = ITEM_CATALOG[itemId];
	if (!def) return null;

	const slotLabel = def.slot === 'ring' ? 'Ring' : def.slot ? EQUIPMENT_SLOT_LABEL[def.slot] : 'Consumable';
	const equippedIds = Object.values(equipment);
	const setCount = aggregateStats(equipment).setCount;

	return (
		<div className='text-sm' style={{ minWidth: 200 }}>
			<div className='px-tip-title' style={{ color: RARITY_COLOR[def.rarity] }}>
				{def.name}
			</div>
			<div className='px-tip-muted text-xs mb-1 capitalize'>
				{def.rarity} - {slotLabel}
			</div>
			{def.stats &&
				Object.entries(def.stats).map(([stat, value]) => (
					<div key={stat} className='text-green-400 text-xs'>
						+{value} {STAT_LABEL[stat] ?? stat}
					</div>
				))}
			{def.consumable && <div className='text-green-400 text-xs'>Restores {def.consumable.healHp} HP</div>}

			{def.set === RATTATUI_SET.id && (
				<div className='mt-2 text-xs'>
					<div className='px-tip-title'>
						{RATTATUI_SET.label} ({setCount}/{RATTATUI_SET.size})
					</div>
					{RATTATUI_SET.pieces.map((id) => (
						<div key={id} style={{ color: equippedIds.includes(id) ? '#f0d27a' : '#6a5a48' }}>
							{ITEM_CATALOG[id].name}
						</div>
					))}
					{Object.entries(RATTATUI_SET.bonuses).map(([count, bonus]) => (
						<div key={count} style={{ color: setCount >= Number(count) ? '#4ade80' : '#6a5a48' }}>
							({count}) {Object.entries(bonus).map(([stat, v]) => `+${v} ${STAT_LABEL[stat] ?? stat}`).join(', ')}
						</div>
					))}
				</div>
			)}

			{def.description && <div className='px-tip-muted text-xs mt-2 italic'>{def.description}</div>}
			<div className='text-xs mt-2 flex items-center gap-1 text-[#d8c8a0]'>
				Sells for {def.sellValue} <ResourceIcon resource='gold' />
			</div>
		</div>
	);
};

export default ItemTooltipBody;
