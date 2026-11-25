import { slotlessItemLabel } from '@/lib/itemCategory';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ItemTooltip, TipLine, TipSection } from '../../../../packages/design-system/src/components/tooltips';
import type { TipRow } from '../../../../packages/design-system/src/components/tooltips';
import { toRarity } from '../../../../packages/design-system/src/logic';
import {
	COMBAT_NAMES,
	EQUIPMENT_SLOT_LABEL,
	ITEM_CATALOG,
	RARITIES,
	SETS,
	STAT_CATEGORIES,
	STAT_CATEGORY,
	STAT_KEYS,
	type StatKey,
	formatStat,
	formatStatChange,
	formatStatDelta,
	formatStatValue,
	formatStats,
	qualityMultiplier,
	setCounts,
	statLabel,
	weaponDps,
} from '@/catalog';
import { describeEffect, hasEffects } from '@/catalog/buffs';
import { pixelIconSrc } from '@/config/pixelIcons';
import { compareDetailed, primaryKeyOf, type DetailedComparison, type StatRow } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import { useGameStore } from '@/stores/gameStore';
import type { Equipment, ItemInstance } from '@/types/game';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { sellPayout } from '@/utils/game/merchant';
import { itemIconName } from '../itemUi';

const slotName = (slot: string): string => (slot === 'ring' ? 'Ring' : ((EQUIPMENT_SLOT_LABEL as Record<string, string>)[slot] ?? slot));

/** A stat value with its change against the worn piece in the design system's green / red brackets. */
const WithChange: React.FC<{ text: string; delta: number; change: string }> = ({ text, delta, change }) => (
	<>
		{text}
		{delta ? (
			<span className='ds-tip-diff' data-tone={delta > 0 ? 'green' : 'red'}>
				{' '}
				({change})
			</span>
		) : null}
	</>
);

interface TipProps {
	/** A piece of gear (an instance) ... */
	item?: ItemInstance;
	/** ... or a consumable by its catalog id */
	itemId?: string;
	/** The comparison with the piece worn in this item's slot (the hovered bag item) */
	comparison?: DetailedComparison | null;
	/** Marks the card of the piece currently worn */
	wornLabel?: boolean;
	/** On the merchant's shelf: the card says what it costs */
	buyPrice?: number;
	hints?: 'bag' | 'merchant';
	/** The band over the card: Equipped (the worn piece) or Comparing (the hovered one next to it) */
	banner?: 'equipped' | 'comparing';
	/** The heading of the changes list: "Difference", or "Difference: replacing Ring 2" for a ring (IDL-343) */
	compareLabel?: string;
	/** A ring card: the hint line says Ctrl compares with the other ring */
	ringHint?: boolean;
}

/**
 * One item card drawn by the design system's `ItemTooltip` from the game's own data: the same lines the game's card always had (kind line, item level and quality, the headline stat with its change, attack speed and DPS, stats by
 * colour group with their changes, affixes, lost properties, set changes and the set block, effects, Drink button, flavour and lore, price, key hints), only drawn in the new style.
 */
const GameItemCard: React.FC<TipProps> = ({ item, itemId, comparison, wornLabel, buyPrice, hints, banner, compareLabel, ringHint }) => {
	const equipment = useGameStore((state) => state.equipment);
	// what the merchant really pays: the same inputs a sale uses (Haggler, Idols, the Lighthouse)
	const sellCtx = useGameStore(
		useShallow((state) => ({ merchantUpgrades: state.merchantUpgrades, prestige: state.prestige, tiles: state.tiles, idolLevels: state.idolLevels })),
	);
	const fighting = useGameStore((state) => !!state.combat.fight);
	const resolved = item ? resolveItem(item) : null;
	const def = resolved?.def ?? (itemId ? ITEM_CATALOG[itemId] : undefined);
	if (!def) return null;
	const stats = resolved?.stats ?? def.stats ?? {};
	const rarity = RARITIES[(resolved?.instance.rarity ?? def.rarity) as keyof typeof RARITIES];
	const baseSell = item ? sellValueOf(item) : def.sellValue;
	const sellPrice = sellPayout(baseSell, 1, sellCtx);

	const slotLabel = def.slot ? slotName(def.slot) : slotlessItemLabel(def);
	// With a comparison the set block previews the swap, so the hovered piece already counts as worn
	const shown: Equipment = comparison ? comparison.after : equipment;
	const equippedIds = Object.values(shown).map((worn) => worn?.base);
	const set = def.set ? SETS[def.set] : undefined;
	const setCount = set ? (setCounts(shown)[set.id] ?? 0) : 0;
	const emptySlot = !!comparison && !comparison.equipped;
	const withDiff = !!comparison && !emptySlot;
	const tierChanges = comparison ? comparison.setChanges.filter((change) => change.gained.length || change.lost.length) : [];
	const netChanged = comparison ? STAT_KEYS.filter((key) => comparison.net[key]) : [];

	const primaryKey = primaryKeyOf({ kind: def.kind, stats });
	const primaryDelta = comparison?.primary?.delta ?? 0;
	const rows: StatRow[] = comparison
		? comparison.rows.filter((row) => row.status !== 'lost' && row.key !== primaryKey)
		: STAT_KEYS.filter((key) => stats[key] && key !== primaryKey).map((key) => ({ key, was: 0, now: stats[key]!, delta: 0, status: 'same' as const }));
	const lost = comparison ? comparison.rows.filter((row) => row.status === 'lost' && row.key !== primaryKey) : [];
	const swing = comparison?.swing;

	const groups = STAT_CATEGORIES.flatMap((category) => {
		const catRows = rows.filter((row) => STAT_CATEGORY[row.key] === category.id);
		if (catRows.length === 0) return [];
		const tipRows: TipRow[] = catRows.map((row) => {
			const change = row.status === 'new' ? row.now : row.delta; // a stat the worn piece lacks is all gain
			return {
				label: statLabel(row.key),
				value: <WithChange text={formatStatValue(row.key, row.now).replace(/^/, '+')} delta={0} change={formatStatChange(row.key, change)} />,
			};
		});
		return [{ heading: category.label, rows: tipRows }];
	});
	const affixes = [...(resolved?.affixes ?? []).map((affix) => ({ text: formatStat(affix.stat as StatKey, affix.value), name: affix.name }))];
	// a legendary's fixed perks (IDL-143) in their own gold block under the affixes (IDL-147)
	const perks = Object.entries(resolved?.perks ?? {}).map(([stat, value]) => ({ text: formatStat(stat as StatKey, value as number) }));

	// what changes against the worn piece, one line each: green for a gain, red for a loss
	const gain = (n: number) => (n > 0 ? ('green' as const) : ('red' as const));
	const differences: TipRow[] = !withDiff
		? []
		: [
				...(primaryKey && primaryDelta
					? [{ label: statLabel(primaryKey), value: `${primaryDelta > 0 ? '+' : '-'}${formatCompact(Math.abs(primaryDelta), 2)}`, tone: gain(primaryDelta) }]
					: []),
				...(swing && swing.speed.delta
					? [
							{
								label: COMBAT_NAMES.attackSpeed,
								value: `${swing.speed.delta > 0 ? '+' : '-'}${formatCompact(Math.abs(swing.speed.delta), 2)}`,
								tone: gain(swing.speed.delta),
							},
						]
					: []),
				...(swing && swing.dps.delta
					? [
							{
								label: COMBAT_NAMES.dps,
								value: `${swing.dps.delta > 0 ? '+' : '-'}${formatCompact(Math.abs(swing.dps.delta), 2)}`,
								tone: gain(swing.dps.delta),
							},
						]
					: []),
				...rows
					.filter((row) => row.status !== 'same')
					.map((row) => {
						const change = row.status === 'new' ? row.now : row.delta;
						return { label: statLabel(row.key), value: formatStatChange(row.key, change), tone: gain(change) };
					}),
				...lost.map((row) => ({ label: statLabel(row.key), value: formatStatChange(row.key, -row.was), tone: 'red' as const })),
			]
				// gains first, then losses (a stable sort keeps the stat order inside each group), IDL-340
				.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'green' ? -1 : 1));

	const effectRows: TipRow[] = (def.effects ?? []).map((effect) => ({ label: describeEffect(effect), value: '', tone: 'green' as const }));
	const hintText: { key: string; text: string }[] =
		hints === 'bag'
			? [
					...(item ? [{ key: 'Dbl-click', text: 'equip' }] : hasEffects(def) ? [{ key: 'Dbl-click', text: 'drink' }] : []),
					...(fighting ? [] : [{ key: 'Shift', text: '+click sell' }]),
				]
			: hints === 'merchant' && !fighting
				? [
						{ key: 'Click', text: 'sell one' },
						{ key: 'Shift', text: '+click sell all' },
					]
				: [];

	if (ringHint) hintText.push({ key: 'Ctrl', text: 'compare with other slot' });
	const showHints = buyPrice === undefined && !wornLabel;

	return (
		<ItemTooltip
			rarity={toRarity(String(resolved?.instance.rarity ?? def.rarity ?? 'common'))}
			icon={pixelIconSrc(itemIconName(def))}
			name={resolved?.name ?? def.name}
			type={`${rarity?.label ?? ''}${def.weaponType ? ` ${def.weaponType}` : ''} · ${slotLabel}`}
			levelLine={
				resolved
					? `Item Level ${formatCompact(resolved.instance.level)} · Quality ${Math.round(qualityMultiplier(resolved.instance.quality) * 100)}%${resolved.instance.crafted ? ' · Crafted' : ''}`
					: undefined
			}
			banner={banner ? { text: banner === 'equipped' ? 'Equipped' : 'Comparing', tone: banner } : undefined}
			primary={primaryKey ? { label: statLabel(primaryKey), value: formatCompact(stats[primaryKey] ?? 0, 2), diff: undefined } : undefined}
			speed={
				def.kind === 'weapon' && def.attackSpeed
					? [
							{ label: COMBAT_NAMES.attackSpeed, value: String(def.attackSpeed), diff: undefined },
							{
								label: COMBAT_NAMES.dps,
								value: formatCompact(weaponDps({ stats, attackSpeed: def.attackSpeed }), 2),
								diff: undefined,
							},
						]
					: undefined
			}
			rows={[...(emptySlot ? [{ label: `Empty ${EQUIPMENT_SLOT_LABEL[comparison!.slot]} slot`, value: '', tone: 'muted' as const }] : []), ...effectRows]}
			groups={groups}
			affixes={affixes}
			perks={perks}
			extra={
				comparison && tierChanges.length > 0 ? (
					<>
						<TipSection>Set changes</TipSection>
						{tierChanges.map((change) => (
							<div key={change.setId}>
								<TipLine tone='muted'>
									{change.label} {change.from} → {change.to}/{change.size}
								</TipLine>
								{change.gained.map((tier) => (
									<TipLine key={`g${tier.count}`} tone='green'>
										+ ({tier.count}) {formatStats(tier.stats)}
									</TipLine>
								))}
								{change.lost.map((tier) => (
									<TipLine key={`l${tier.count}`} tone='red'>
										− ({tier.count}) {formatStats(tier.stats)}
									</TipLine>
								))}
							</div>
						))}
						{netChanged.length > 0 ? <TipSection>Net change</TipSection> : null}
						{netChanged.map((key) => {
							const delta = comparison.net[key] as number;
							return (
								<TipLine key={key} tone={delta > 0 ? 'green' : 'red'}>
									{formatStatDelta(key, delta)}
								</TipLine>
							);
						})}
					</>
				) : undefined
			}
			set={
				set
					? {
							title: `${set.label} (${setCount}/${set.size})`,
							pieces: set.pieces.map((id) => ({
								name: `${ITEM_CATALOG[id].name}${ITEM_CATALOG[id].slot ? ` (${slotName(ITEM_CATALOG[id].slot)})` : ''}`,
								worn: equippedIds.includes(id),
							})),
							bonuses: Object.entries(set.bonuses).map(([count, bonus]) => ({
								count: Number(count),
								text: formatStats(bonus),
								active: setCount >= Number(count),
							})),
						}
					: undefined
			}
			compare={differences.length > 0 ? differences : undefined}
			compareWith={compareLabel ?? 'Difference'}
			flavor={def.description}
			lore={def.lore}
			hints={showHints && hintText.length > 1 ? hintText : undefined}
			footer={[
				`${buyPrice !== undefined ? 'Costs' : 'Sells for'} ${formatNumber(buyPrice ?? sellPrice)} gold${buyPrice === undefined && sellPrice !== baseSell ? ` (base ${formatNumber(baseSell)})` : ''}`,
				// a single action sits on the price row, at the right
				showHints && hintText.length === 1 ? (
					<>
						<span className='ds-kbd'>{hintText[0].key}</span>
						{hintText[0].text}
					</>
				) : (
					''
				),
			]}
		/>
	);
};

/**
 * The hover card of an item. With `compare` (the bag) and a piece worn in the same slot it becomes two cards side by side: the hovered one with every number set against the worn piece, and the worn piece marked Equipped.
 */
export const GameItemTip: React.FC<Omit<TipProps, 'comparison' | 'wornLabel'> & { compare?: boolean }> = ({ compare, ...rest }) => {
	const equipment = useGameStore((state) => state.equipment);
	// a ring can replace either worn ring: the card compares with the first free (else the first) ring slot, and holding Ctrl compares with the other one (IDL-343)
	const [ctrl, setCtrl] = React.useState(false);
	React.useEffect(() => {
		const sync = (event: KeyboardEvent) => setCtrl(event.ctrlKey);
		const off = () => setCtrl(false);
		window.addEventListener('keydown', sync);
		window.addEventListener('keyup', sync);
		window.addEventListener('blur', off);
		return () => {
			window.removeEventListener('keydown', sync);
			window.removeEventListener('keyup', sync);
			window.removeEventListener('blur', off);
		};
	}, []);
	const isRing = !!rest.item && ITEM_CATALOG[rest.item.base]?.slot === 'ring';
	const first = compare && rest.item ? compareDetailed(rest.item, equipment) : null;
	const other = first?.slot === 'ring1' ? 'ring2' : 'ring1';
	const comparison = isRing && ctrl && first && rest.item ? compareDetailed(rest.item, equipment, other) : first;
	const ringLabel = isRing && comparison ? `Difference: replacing Ring ${comparison.slot === 'ring1' ? 1 : 2}` : undefined;
	return (
		<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
			<GameItemCard
				{...rest}
				comparison={comparison}
				banner={comparison?.equipped ? 'comparing' : undefined}
				compareLabel={ringLabel}
				ringHint={isRing && !!comparison}
			/>
			{comparison?.equipped ? <GameItemCard item={comparison.equipped} wornLabel banner='equipped' /> : null}
		</div>
	);
};

export default GameItemTip;
