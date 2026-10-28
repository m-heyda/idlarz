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
	formatStat,
	formatStats,
	qualityMultiplier,
	setCounts,
	statLabel,
	weaponDps,
} from '@/catalog';
import { compareDetailed, primaryKeyOf, type DetailedComparison, type StatRow } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import type { Equipment, ItemInstance } from '@/types/game';
import { formatCompact, formatNumber } from '@/utils/formatters';
import ResourceIcon from './ResourceIcon';
import { RARITY_COLOR } from './itemUi';

/** A signed change in parentheses, green for a gain and red for a loss: "(+12%)", "(-16)". Nothing when it did not change. */
const Diff: React.FC<{ delta: number; text: string }> = ({ delta, text }) =>
	delta ? <span className={delta > 0 ? 'px-diff-up' : 'px-diff-down'}> ({text})</span> : null;

const signed = (delta: number, digits = 0) => `${delta < 0 ? '-' : '+'}${formatCompact(Math.abs(delta), digits)}`;

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
	/** A piece of gear (an instance) ... */
	item?: ItemInstance;
	/** ... or a consumable by its catalog id */
	itemId?: string;
	/** The comparison with the piece worn in this item's slot (the hovered bag item) */
	comparison?: DetailedComparison | null;
	/** Marks the card of the piece currently worn, shown beside the hovered one */
	wornLabel?: boolean;
	/** The item is on the merchant's shelf: the card shows what it costs instead of what it sells for */
	buyPrice?: number;
}

/**
 * The body of an item hover card, laid out like an action-RPG card: name, rarity and slot, item level, the headline stat
 * (damage with attack speed and DPS for a weapon, armor for armor) and the other stats as a bullet list. With a
 * `comparison` every number carries its change against the worn piece, stats the worn piece has and this one lacks are
 * listed as lost, and the set block shows the state after the swap.
 */
export const ItemTooltipBody: React.FC<BodyProps> = ({ item, itemId, comparison, wornLabel, buyPrice }) => {
	const equipment = useGameStore((state) => state.equipment);
	const resolved = item ? resolveItem(item) : null;
	const def = resolved?.def ?? (itemId ? ITEM_CATALOG[itemId] : undefined);
	if (!def) return null;
	const stats = resolved?.stats ?? def.stats ?? {};
	const rarity = RARITIES[(resolved?.instance.rarity ?? def.rarity) as keyof typeof RARITIES];
	const color = rarity?.color ?? RARITY_COLOR.common;
	const title = resolved?.name ?? def.name;
	const sellPrice = item ? sellValueOf(item) : def.sellValue;

	const slotLabel = def.slot === 'ring' ? 'Ring' : def.slot ? EQUIPMENT_SLOT_LABEL[def.slot] : 'Consumable';
	// With a comparison the set block previews the swap, so the hovered piece already counts as worn
	const shown: Equipment = comparison ? comparison.after : equipment;
	const equippedIds = Object.values(shown).map((worn) => worn?.base);
	const set = def.set ? SETS[def.set] : undefined;
	const setCount = set ? (setCounts(shown)[set.id] ?? 0) : 0;
	const emptySlot = !!comparison && !comparison.equipped;
	const withDiff = !!comparison && !emptySlot;
	// Only sets whose bonus tiers switch on or off matter here; plain progress is already in the set block below
	const tierChanges = comparison ? comparison.setChanges.filter((change) => change.gained.length || change.lost.length) : [];
	const netChanged = comparison ? STAT_KEYS.filter((key) => comparison.net[key]) : [];

	const primaryKey = primaryKeyOf({ kind: def.kind, stats });
	const primary = primaryKey ? { key: primaryKey, value: stats[primaryKey] ?? 0 } : null;
	const primaryDelta = comparison?.primary?.delta ?? 0;
	// Own stats except the headline one (it has its own line); the plain card lists them from the definition
	const rows: StatRow[] = comparison
		? comparison.rows.filter((row) => row.status !== 'lost' && row.key !== primaryKey)
		: STAT_KEYS.filter((key) => stats[key] && key !== primaryKey).map((key) => ({ key, was: 0, now: stats[key]!, delta: 0, status: 'same' as const }));
	const lost = comparison ? comparison.rows.filter((row) => row.status === 'lost' && row.key !== primaryKey) : [];
	const swing = comparison?.swing;

	return (
		<div className='px-tip-body'>
			{wornLabel && <div className='px-tip-worn'>Equipped</div>}
			<div className='px-tip-title' style={{ color }}>
				{title}
			</div>
			<div className='px-tip-kind' style={{ color }}>
				{rarity?.label}
				{def.weaponType ? ` ${def.weaponType}` : ''} - {slotLabel}
			</div>
			{resolved && (
				<div className='px-tip-level'>
					Item Level {formatCompact(resolved.instance.level)}
					<span className='px-tip-muted'> · Quality {Math.round(qualityMultiplier(resolved.instance.quality) * 100)}%</span>
				</div>
			)}
			<div className='px-tip-sep' />

			{primary && (
				<div className='px-tip-primary'>
					<span className='px-tip-big'>{formatCompact(primary.value, 2)}</span> {statLabel(primary.key)}
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
						<b>{formatCompact(weaponDps({ stats, attackSpeed: def.attackSpeed }), 2)}</b> Damage per Second
						{withDiff && swing && <Diff delta={swing.dps.delta} text={signed(swing.dps.delta, 2)} />}
					</div>
				</div>
			)}
			{emptySlot && <div className='px-tip-muted text-xs mt-1'>Empty {EQUIPMENT_SLOT_LABEL[comparison!.slot]} slot</div>}

			{def.consumable && <div className='px-tip-bullet px-diff-up'>Restores {formatCompact(def.consumable.healHp)} HP</div>}
			{rows.length > 0 && (
				<div className='px-tip-list'>
					{rows.map((row) => (
						<StatLine key={row.key} row={row} withDiff={withDiff} />
					))}
				</div>
			)}
			{!primary && rows.length === 0 && !def.consumable && <div className='px-tip-muted text-xs'>No stats</div>}

			{resolved && resolved.affixes.length > 0 && (
				<div className='px-tip-list px-tip-affixes' style={{ color: '#7aa7ff' }}>
					{resolved.affixes.map((affix) => (
						<div key={affix.id} className='px-tip-bullet'>
							{formatStat(affix.stat, affix.value)} <span className='px-tip-muted'>({affix.name})</span>
						</div>
					))}
				</div>
			)}

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
				{buyPrice !== undefined ? 'Costs' : 'Sells for'} {formatNumber(buyPrice ?? sellPrice)} <ResourceIcon resource='gold' />
			</div>
		</div>
	);
};

/**
 * The hover card of an item. With `compare` (the bag) and a piece worn in the same slot it becomes two cards side by side:
 * the worn piece (marked Equipped) and the hovered one with every number set against it.
 */
const ItemTooltipStack: React.FC<{ item?: ItemInstance; itemId?: string; compare?: boolean; buyPrice?: number }> = ({ item, itemId, compare, buyPrice }) => {
	const equipment = useGameStore((state) => state.equipment);
	const comparison = compare && item ? compareDetailed(item, equipment) : null;
	return (
		<div className='flex items-start gap-2'>
			<div className='px-tooltip'>
				<ItemTooltipBody item={item} itemId={itemId} comparison={comparison} buyPrice={buyPrice} />
			</div>
			{comparison?.equipped && (
				<div className='px-tooltip px-tooltip-worn'>
					<ItemTooltipBody item={comparison.equipped} wornLabel />
				</div>
			)}
		</div>
	);
};

export default ItemTooltipStack;
