import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import {
	EQUIPMENT_SLOT_LABEL,
	ITEM_CATALOG,
	SETS,
	RARITIES,
	STAT_KEYS,
	formatStatChange,
	formatStatDelta,
	formatStatValue,
	formatStats,
	setCounts,
	statLabel,
	weaponDps,
} from '@/catalog';
import { compareDetailed, primaryKeyOf, type DetailedComparison, type StatRow } from '@/lib/inventory';
import type { Equipment } from '@/types/game';
import ResourceIcon from './ResourceIcon';
import { RARITY_COLOR } from './itemUi';

/** A signed change in parentheses, green for a gain and red for a loss: "(+12%)", "(-16)". Nothing when it did not change. */
const Diff: React.FC<{ delta: number; text: string }> = ({ delta, text }) =>
	delta ? <span className={delta > 0 ? 'px-diff-up' : 'px-diff-down'}> ({text})</span> : null;

const signed = (delta: number, digits = 0) => `${delta < 0 ? '-' : '+'}${+Math.abs(delta).toFixed(digits)}`;

/** One secondary stat line: a bullet, "+12% Crit Chance", and how it differs from the worn piece. */
const StatLine: React.FC<{ row: StatRow; withDiff: boolean }> = ({ row, withDiff }) => {
	const change = row.status === 'new' ? row.now : row.delta; // a stat the worn piece lacks is all gain
	return (
		<div className='px-tip-bullet'>
			<span>{formatStatValue(row.key, row.now).replace(/^/, '+')} </span>
			<span>{statLabel(row.key)}</span>
			{withDiff && row.status !== 'same' && <Diff delta={change} text={formatStatChange(row.key, change)} />}
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
 * The body of an item hover card, laid out like an action-RPG card: name, rarity and slot, item level, the headline stat
 * (damage with attack speed and DPS for a weapon, armor for armor) and the other stats as a bullet list. With a
 * `comparison` every number carries its change against the worn piece, stats the worn piece has and this one lacks are
 * listed as lost, and the set block shows the state after the swap.
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
	const withDiff = !!comparison && !emptySlot;
	// Only sets whose bonus tiers switch on or off matter here; plain progress is already in the set block below
	const tierChanges = comparison ? comparison.setChanges.filter((change) => change.gained.length || change.lost.length) : [];
	const netChanged = comparison ? STAT_KEYS.filter((key) => comparison.net[key]) : [];

	const primaryKey = primaryKeyOf(def);
	const primary = primaryKey ? { key: primaryKey, value: def.stats?.[primaryKey] ?? 0 } : null;
	const primaryDelta = comparison?.primary?.delta ?? 0;
	// Own stats except the headline one (it has its own line); the plain card lists them from the definition
	const rows: StatRow[] = comparison
		? comparison.rows.filter((row) => row.status !== 'lost' && row.key !== primaryKey)
		: STAT_KEYS.filter((key) => def.stats?.[key] && key !== primaryKey).map((key) => ({ key, was: 0, now: def.stats![key]!, delta: 0, status: 'same' as const }));
	const lost = comparison ? comparison.rows.filter((row) => row.status === 'lost' && row.key !== primaryKey) : [];
	const swing = comparison?.swing;

	return (
		<div className='px-tip-body'>
			{wornLabel && <div className='px-tip-worn'>Equipped</div>}
			<div className='px-tip-title' style={{ color: RARITY_COLOR[def.rarity] }}>
				{def.name}
			</div>
			<div className='px-tip-kind' style={{ color: RARITY_COLOR[def.rarity] }}>
				{RARITIES[def.rarity].label}
				{def.weaponType ? ` ${def.weaponType}` : ''} - {slotLabel}
			</div>
			{!def.consumable && <div className='px-tip-level'>Item Level {def.itemLevel}</div>}
			<div className='px-tip-sep' />

			{primary && (
				<div className='px-tip-primary'>
					<span className='px-tip-big'>{primary.value}</span> {statLabel(primary.key)}
					{withDiff && <Diff delta={primaryDelta} text={signed(primaryDelta)} />}
				</div>
			)}
			{def.kind === 'weapon' && def.attackSpeed && (
				<div className='px-tip-swing'>
					<div>
						<b>{def.attackSpeed}</b> Attacks per Second
						{withDiff && swing && <Diff delta={swing.speed.delta} text={signed(swing.speed.delta, 2)} />}
					</div>
					<div>
						<b>{weaponDps(def)}</b> Damage per Second
						{withDiff && swing && <Diff delta={swing.dps.delta} text={signed(swing.dps.delta, 2)} />}
					</div>
				</div>
			)}
			{emptySlot && <div className='px-tip-muted text-xs mt-1'>Empty {EQUIPMENT_SLOT_LABEL[comparison!.slot]} slot</div>}

			{def.consumable && <div className='px-tip-bullet px-diff-up'>Restores {def.consumable.healHp} HP</div>}
			{rows.length > 0 && (
				<div className='px-tip-list'>
					{rows.map((row) => (
						<StatLine key={row.key} row={row} withDiff={withDiff} />
					))}
				</div>
			)}
			{!primary && rows.length === 0 && !def.consumable && <div className='px-tip-muted text-xs'>No stats</div>}

			{lost.length > 0 && (
				<div className='px-tip-lost'>
					<div className='px-tip-lost-title'>Properties lost when equipped:</div>
					{lost.map((row) => (
						<div key={row.key} className='px-tip-lost-line'>
							{formatStatValue(row.key, row.was).replace(/^/, '+')} {statLabel(row.key)}
						</div>
					))}
				</div>
			)}

			{comparison && tierChanges.length > 0 && (
				<div className='px-tip-section'>
					<div className='px-tip-title'>Set changes</div>
					{tierChanges.map((change) => (
						<div key={change.setId} className='mb-1'>
							<div className='px-tip-muted'>
								{change.label} {change.from} → {change.to}/{change.size}
							</div>
							{change.gained.map((tier) => (
								<div key={`g${tier.count}`} className='px-diff-up'>
									+ ({tier.count}) {formatStats(tier.stats)}
								</div>
							))}
							{change.lost.map((tier) => (
								<div key={`l${tier.count}`} className='px-diff-down'>
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
									<div key={key} className={delta > 0 ? 'px-diff-up' : 'px-diff-down'}>
										{formatStatDelta(key, delta)}
									</div>
								);
							})}
						</>
					)}
				</div>
			)}

			{set && (
				<div className='px-tip-section'>
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

			{def.description && <div className='px-tip-flavor'>{def.description}</div>}
			<div className='px-tip-sell'>
				Sells for {def.sellValue} <ResourceIcon resource='gold' />
			</div>
		</div>
	);
};

/**
 * The hover card of an item. With `compare` (the bag) and a piece worn in the same slot it becomes two cards side by side:
 * the worn piece (marked Equipped) and the hovered one with every number set against it.
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
