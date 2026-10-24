import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { EQUIPMENT_SLOT_LABEL, ITEM_CATALOG, SETS, RARITIES, formatStat, formatStats, setCounts } from '@/catalog';
import ResourceIcon from './ResourceIcon';
import { RARITY_COLOR } from './itemUi';

/** The body of an item hover card (name, slot, stats, set progress, description, sell value). */
const ItemTooltipBody: React.FC<{ itemId: string }> = ({ itemId }) => {
	const equipment = useGameStore((state) => state.equipment);
	const def = ITEM_CATALOG[itemId];
	if (!def) return null;

	const slotLabel = def.slot === 'ring' ? 'Ring' : def.slot ? EQUIPMENT_SLOT_LABEL[def.slot] : 'Consumable';
	const equippedIds = Object.values(equipment);
	const set = def.set ? SETS[def.set] : undefined;
	const setCount = set ? (setCounts(equipment)[set.id] ?? 0) : 0;

	return (
		<div className='text-sm' style={{ minWidth: 200 }}>
			<div className='px-tip-title' style={{ color: RARITY_COLOR[def.rarity] }}>
				{def.name}
			</div>
			<div className='px-tip-muted text-xs mb-1 capitalize'>
				{RARITIES[def.rarity].label}
				{def.weaponType ? ` ${def.weaponType}` : ''} - {slotLabel}
			</div>
			{def.stats &&
				Object.entries(def.stats).map(([stat, value]) => (
					<div key={stat} className='text-green-400 text-xs'>
						{formatStat(stat, value as number)}
					</div>
				))}
			{def.consumable && <div className='text-green-400 text-xs'>Restores {def.consumable.healHp} HP</div>}

			{set && (
				<div className='mt-2 text-xs'>
					<div className='px-tip-title'>
						{set.label} ({setCount}/{set.size})
					</div>
					{set.pieces.map((id) => (
						<div key={id} style={{ color: equippedIds.includes(id) ? '#f0d27a' : '#6a5a48' }}>
							{ITEM_CATALOG[id].name}
						</div>
					))}
					{Object.entries(set.bonuses).map(([count, bonus]) => (
						<div key={count} style={{ color: setCount >= Number(count) ? '#4ade80' : '#6a5a48' }}>
							({count}) {formatStats(bonus)}
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
