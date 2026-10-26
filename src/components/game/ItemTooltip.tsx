import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import {
	EQUIPMENT_SLOT_LABEL,
	ITEM_CATALOG,
	SETS,
	RARITIES,
	STAT_KEYS,
	formatStat,
	formatStatChange,
	formatStatDelta,
	formatStatValue,
	formatStats,
	setCounts,
	statLabel,
} from '@/catalog';
import { compareDetailed, type DetailedComparison, type StatRow } from '@/lib/inventory';
import type { Equipment } from '@/types/game';
import ResourceIcon from './ResourceIcon';
import { RARITY_COLOR } from './itemUi';

const STATUS_TAG: Record<StatRow['status'], string> = { new: 'NEW', lost: 'LOST', up: '▲', down: '▼', same: '=' };

/** One line of the stat table: the stat, the value this piece gives, and how it differs from the worn piece (NEW / LOST / ▲ / ▼). */
const StatCompareRow: React.FC<{ row: StatRow; withTag: boolean }> = ({ row, withTag }) => {
	const status = withTag ? row.status : 'up'; // an empty slot: everything is a plain gain, no tags
	const shownValue = row.status === 'lost' ? row.was : row.now; // a lost stat shows what you would give up, struck through
	const change =
		row.status === 'new' || row.status === 'lost'
			? STATUS_TAG[row.status]
			: row.status === 'same'
				? STATUS_TAG.same
				: `${STATUS_TAG[row.status]} ${formatStatChange(row.key, row.delta)}`;
	return (
		<div className='px-stat-row' data-status={status}>
			<span className='px-stat-name'>{statLabel(row.key)}</span>
			<span className='px-stat-value'>{formatStatValue(row.key, shownValue)}</span>
			<span className='px-stat-change'>
				{withTag ? change : ''}
				{withTag && row.status === 'lost' ? ` ${formatStatChange(row.key, row.delta)}` : ''}
			</span>
		</div>
	);
};

interface BodyProps {
	itemId: string;
	/** The comparison with the piece worn in this item's slot (the hovered bag item) */
	comparison?: DetailedComparison | null;
	/** Marks the card of the piece currently worn, shown beside the hovered one */
	wornLabel?: boolean;
}

/**
 * The body of an item hover card (name, slot, stats, set progress, description, sell value). With a `comparison` the stats
 * become a table against the worn piece (NEW / LOST / up / down) and the set block shows the state after the swap.
 */
export const ItemTooltipBody: React.FC<BodyProps> = ({ itemId, comparison, wornLabel }) => {
	const equipment = useGameStore((state) => state.equipment);
	const def = ITEM_CATALOG[itemId];
	if (!def) return null;

	const slotLabel = def.slot === 'ring' ? 'Ring' : def.slot ? EQUIPMENT_SLOT_LABEL[def.slot] : 'Consumable';
	// With a comparison the set block previews the swap, so the hovered piece already counts as worn
	const shown: Equipment = comparison ? comparison.after : equipment;
	const equippedIds = Object.values(shown);
	const set = def.set ? SETS[def.set] : undefined;
	const setCount = set ? (setCounts(shown)[set.id] ?? 0) : 0;
	const emptySlot = !!comparison && !comparison.equippedId;
	// Only sets whose bonus tiers switch on or off matter here; plain progress is already in the set block below
	const tierChanges = comparison ? comparison.setChanges.filter((change) => change.gained.length || change.lost.length) : [];
	const netChanged = comparison ? STAT_KEYS.filter((key) => comparison.net[key]) : [];

	return (
		<div className='text-sm' style={{ minWidth: 200 }}>
			{wornLabel && <div className='px-tip-worn'>Equipped</div>}
			<div className='px-tip-title' style={{ color: RARITY_COLOR[def.rarity] }}>
				{def.name}
			</div>
			<div className='px-tip-muted text-xs mb-1 capitalize'>
				{RARITIES[def.rarity].label}
				{def.weaponType ? ` ${def.weaponType}` : ''} - {slotLabel}
			</div>
			{comparison ? (
				<div className='px-stat-table'>
					{emptySlot && <div className='px-tip-muted text-xs mb-1'>Empty {EQUIPMENT_SLOT_LABEL[comparison.slot]} slot</div>}
					{comparison.rows.map((row) => (
						<StatCompareRow key={row.key} row={row} withTag={!emptySlot} />
					))}
					{comparison.rows.length === 0 && <div className='px-tip-muted text-xs'>No stats</div>}
				</div>
			) : (
				def.stats &&
				Object.entries(def.stats).map(([stat, value]) => (
					<div key={stat} className='text-green-400 text-xs'>
						{formatStat(stat, value as number)}
					</div>
				))
			)}
			{def.consumable && <div className='text-green-400 text-xs'>Restores {def.consumable.healHp} HP</div>}

			{comparison && tierChanges.length > 0 && (
				<div className='mt-2 pt-1 border-t px-rule text-xs'>
					<div className='px-tip-title'>Set changes</div>
					{tierChanges.map((change) => (
						<div key={change.setId} className='mb-1'>
							<div className='px-tip-muted'>
								{change.label} {change.from} → {change.to}/{change.size}
							</div>
							{change.gained.map((tier) => (
								<div key={`g${tier.count}`} className='text-green-400'>
									+ ({tier.count}) {formatStats(tier.stats)}
								</div>
							))}
							{change.lost.map((tier) => (
								<div key={`l${tier.count}`} className='text-red-400'>
									− ({tier.count}) {formatStats(tier.stats)}
								</div>
							))}
						</div>
					))}
					{netChanged.length > 0 && (
						<>
							<div className='px-tip-title'>Net change</div>
							{netChanged.map((key) => {
								const delta = comparison.net[key] as number;
								return (
									<div key={key} className={delta > 0 ? 'text-green-400' : 'text-red-400'}>
										{formatStatDelta(key, delta)}
									</div>
								);
							})}
						</>
					)}
				</div>
			)}

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

/**
 * The hover card of an item. With `compare` (the bag) and a piece worn in the same slot it becomes two cards side by side:
 * the hovered item with its stat table against the worn piece, and the worn piece itself.
 */
const ItemTooltipStack: React.FC<{ itemId: string; compare?: boolean }> = ({ itemId, compare }) => {
	const equipment = useGameStore((state) => state.equipment);
	const comparison = compare ? compareDetailed(itemId, equipment) : null;
	return (
		<div className='flex items-start gap-2'>
			<div className='px-tooltip'>
				<ItemTooltipBody itemId={itemId} comparison={comparison} />
			</div>
			{comparison?.equippedId && (
				<div className='px-tooltip px-tooltip-worn'>
					<ItemTooltipBody itemId={comparison.equippedId} wornLabel />
				</div>
			)}
		</div>
	);
};

export default ItemTooltipStack;
