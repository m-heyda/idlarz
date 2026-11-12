import React, { useMemo, useState } from 'react';
import { Panel } from '../../../../packages/design-system/src/components/primitives';
import {
	AttributeStrip,
	PAPER_INK,
	PaperRows,
	PaperSection,
	type AttributeCard,
	type PaperRowData,
} from '../../../../packages/design-system/src/components/composites';
import { Tooltip } from '../../../../packages/design-system/src/components/tooltips';
import { RESOURCES } from '@/catalog';
import { PLAYER_CLASSES } from '@/config/playerClasses';
import { RESOURCE_PIXEL_ICONS, pixelIconSrc, type PixelIconName } from '@/config/pixelIcons';
import { describeClassPassives } from '@/lib/classPassives';
import { craftLevelOf } from '@/lib/crafting';
import { effectiveStats } from '@/lib/effectiveStats';
import { gearIncomePct } from '@/lib/gearEconomy';
import { idolEconomy } from '@/lib/idolEconomy';
import { useRememberedOpen } from '@/hooks/useRememberedOpen';
import { useCraftStore } from '@/stores/craftStore';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { CharacterStats, Resources } from '@/types/game';
import audioManager from '@/utils/audioManager';
import { formatCompact, formatNumber, formatPercent, formatRate, tidy } from '@/utils/formatters';
import { getStatDescriptionGroups } from '@/utils/game/character';
import { calculateResourceBreakdown, type ResourceBreakdownEntry } from '@/utils/game/income';
import RebirthsPanel from '../overlays/RebirthsPanel';
import { emberIncomeBonus } from '@/utils/game/rebirth';
import { countOwnedTiles } from '@/utils/game/tiles';

const BASE_STATS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;
/** The ink each attribute is written in on the paper */
const ATTR_INK: Record<(typeof BASE_STATS)[number], string> = {
	strength: PAPER_INK.red,
	dexterity: PAPER_INK.green,
	intelligence: PAPER_INK.blue,
	vitality: PAPER_INK.gold,
	charisma: PAPER_INK.purple,
};

type IncomeCol = 'name' | 'sec' | 'min' | 'hour';
/** The columns of the income table: the first click sorts a number column from the biggest down (a name from A to Z), the next one flips it. */
const INCOME_COLS: { id: IncomeCol; label: string }[] = [
	{ id: 'name', label: 'Resource' },
	{ id: 'sec', label: 'Per second' },
	{ id: 'min', label: 'Per minute' },
	{ id: 'hour', label: 'Per hour' },
];

const pct = (value: number, digits = 0) => (Math.abs(value) >= 5000 ? formatPercent(value) : `${tidy(value.toFixed(digits))}%`);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const I = PAPER_INK;

/** The hover card of an attribute: what each point gives, grouped by what it is for (the lines the game always showed, in the new card). */
const AttributeTip: React.FC<{ stat: (typeof BASE_STATS)[number] }> = ({ stat }) => (
	<Tooltip title={capital(stat)}>
		{getStatDescriptionGroups(stat).map(({ category, lines }) => (
			<div key={category.id} className='ds-tip-group' style={{ ['--cat' as string]: category.color }}>
				<div className='ds-tip-group-head'>{category.label}</div>
				{lines.map((line) => (
					<div key={line} className='ds-tip-line' data-tone='muted'>
						{line}
					</div>
				))}
			</div>
		))}
	</Tooltip>
);

/** One folding block of the ledger whose open or shut state is remembered. */
const Block: React.FC<{
	id: string;
	title: React.ReactNode;
	defaultOpen?: boolean;
	summary?: React.ReactNode;
	compact?: boolean;
	children: React.ReactNode;
}> = ({ id, title, defaultOpen = true, summary, compact, children }) => {
	const [open, toggle] = useRememberedOpen(id, defaultOpen);
	return (
		<PaperSection title={title} open={open} onToggle={toggle} summary={summary} compact={compact}>
			{children}
		</PaperSection>
	);
};

/** What one resource's income is made of: the base pieces, the bonuses on top, and the total. */
const breakdownRows = (entry: ResourceBreakdownEntry): PaperRowData[] => {
	const pieces: [string, number][] = [
		['Realm start', entry.start],
		['Farm animals', entry.farm],
		['Biome tiles', entry.biome],
		['Castle area', entry.castleArea],
		['Castle levels', entry.castleXp],
	];
	const bonuses: [string, string][] = [];
	if (entry.castleMod) bonuses.push(['Castle', `+${pct(entry.castleMod * 100)}`]);
	if (entry.plainsMod) bonuses.push(['Plains tiles', `+${pct(entry.plainsMod * 100)}`]);
	if (entry.statMod) bonuses.push(['Attributes', `+${pct(entry.statMod * 100)}`]);
	if (entry.emberMult !== 1) bonuses.push(['Rebirth (Embers)', `x${formatCompact(entry.emberMult, 2)}`]);
	if (entry.merchantMult !== 1) bonuses.push(['Foreman (merchant)', `x${formatCompact(entry.merchantMult, 2)}`]);
	if (entry.gearMult !== 1) bonuses.push(['Set bonus (gear)', `x${formatCompact(entry.gearMult, 2)}`]);
	return [
		{ label: 'Base income', value: formatRate(entry.base), color: I.blue },
		...pieces.filter(([, value]) => value > 0).map(([label, value]) => ({ label, value: formatRate(value), muted: true })),
		...(bonuses.length > 0 ? [{ label: 'Bonuses', value: `${entry.modifier >= 0 ? '+' : ''}${pct(entry.modifier * 100)} in all`, color: I.green }] : []),
		...bonuses.map(([label, value]) => ({ label, value, muted: true })),
		{ label: 'Total', value: formatRate(entry.total), color: I.gold },
	];
};

const resourceIcon = (key: string): string | undefined => {
	const name = RESOURCE_PIXEL_ICONS[key] as PixelIconName | undefined;
	return name ? pixelIconSrc(name) : undefined;
};

/**
 * The Stats tab of the Hero window, on the paper ledger: the attribute strip stays in place on top (hover a number for what a point gives, + spends a point, Respec at 0 points opens the Gem shop), and under it the folding blocks scroll: Overview, Combat,
 * Bonuses, Resource income, Where the income comes from, and the Rebirth history. Every figure of the old Character window is here; a new block only needs another `Block`.
 */
const HeroStats: React.FC = () => {
	const craftXp = useCraftStore((state) => state.craft?.xp ?? 0);
	const addStatPoint = useGameStore((state) => state.addStatPoint);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const tiles = useGameStore((state) => state.tiles);
	const level = useGameStore((state) => state.level);
	const resources = useGameStore((state) => state.resources);
	const characterStats = useGameStore((state) => state.characterStats);
	const prestige = useGameStore((state) => state.prestige);
	const playerHp = useGameStore((state) => state.playerHp);
	const playerMp = useGameStore((state) => state.playerMp);
	const equipment = useGameStore((state) => state.equipment);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const farmUpgrades = useGameStore((state) => state.farmUpgrades);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const playerClass = useGameStore((state) => state.playerClass);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const toggleGemShop = useUiStore((state) => state.toggleGemShop);
	const [sort, setSort] = useState<{ col: IncomeCol; dir: 1 | -1 } | null>(null);

	const idol = idolEconomy(tiles, idolLevels);
	const classLines = describeClassPassives(playerClass);
	const fx = effectiveStats({ characterStats, equipment, prestige, merchantUpgrades, playerClass, idol });
	const points = characterStats.availablePoints;
	const breakdown = useMemo(
		() => calculateResourceBreakdown(tiles, characterStats, farmLevels, prestige, farmUpgrades, merchantUpgrades, gearIncomePct(equipment)),
		[tiles, characterStats, farmLevels, prestige, farmUpgrades, merchantUpgrades, equipment],
	);

	const attrs: AttributeCard[] = BASE_STATS.map((stat) => ({
		id: stat,
		label: capital(stat),
		value: formatCompact(characterStats[stat]),
		color: ATTR_INK[stat],
		tip: <AttributeTip stat={stat} />,
		anchor: stat === 'strength' ? 'stat-add' : undefined,
	}));
	const spend = (stat: string) => {
		if (points > 0) {
			addStatPoint(stat as keyof CharacterStats);
			audioManager.playSound('click');
		}
	};

	const overview: PaperRowData[] = [
		{ label: 'Level', value: formatCompact(level.level), color: I.gold },
		{ label: 'Next level', value: pct(level.progress * 100, 1), color: I.purple },
		{ label: 'XP', value: `${formatNumber(resources.xp)} (${formatRate(resourceRates.total.xp)})`, color: I.green },
		{ label: 'Gold', value: formatNumber(resources.gold), color: I.gold },
		{ label: 'Crafting level', value: craftLevelOf(craftXp).level, color: I.gold },
		{ label: 'Tiles', value: formatCompact(countOwnedTiles(tiles)), color: I.blue },
		{ label: 'Rebirths', value: `${formatNumber(prestige.rebirths)} (+${formatPercent(emberIncomeBonus(prestige.legacyEarned) * 100)})`, color: I.purple },
	];

	const combat: PaperRowData[] = [
		{ label: 'HP', value: `${formatCompact(Math.floor(playerHp))} / ${formatCompact(fx.maxHp)}`, color: I.green },
		{ label: 'MP', value: `${formatCompact(Math.floor(playerMp))} / ${formatCompact(fx.maxMana)}`, color: I.blue },
		{ label: 'Damage', value: `${formatCompact(fx.damage)} per hit`, color: I.gold },
		{ label: 'Physical ATK', value: `+${pct(characterStats.physicalAtk, 1)}`, color: I.gold },
		{ label: 'Magic ATK', value: `+${pct(characterStats.magicAtk, 1)}`, color: I.purple },
		{ label: 'Crit chance', value: pct(fx.critChance, 1), color: I.gold },
		{ label: 'Crit damage', value: `x${formatCompact(fx.critMultiplier, 2)}`, color: I.gold },
		{ label: 'Super crit chance', value: `${pct(fx.superCritChance, 1)} of crits`, color: I.purple },
		{ label: 'Super crit damage', value: `x${formatCompact(fx.superCritMultiplier, 2)}`, color: I.purple },
		{ label: 'DEF (armor)', value: `${formatCompact(fx.armor)} (-${pct(fx.armorReduction, 0)} damage taken)`, color: I.plain },
		{ label: 'Dodge', value: pct(fx.dodge, 1), color: I.blue },
		{ label: 'HP regen', value: `${formatCompact(fx.hpRegen)}/s`, color: I.green },
		{ label: 'ATK speed', value: `${formatCompact(fx.attacksPerSecond, 2)}/s (+${pct(characterStats.atkSpeedIncrease, 2)})`, color: I.blue },
		{ label: 'Life leech', value: pct(fx.lifeLeech, 1), color: I.red },
	];

	const bonuses: PaperRowData[] = [
		{ label: 'Luck', value: formatCompact(fx.luck), color: I.purple },
		{ label: 'Chest rate (Luck)', value: `+${pct(fx.chestRateBonus, 1)}`, color: I.green },
		{ label: 'Rare drop odds (Luck)', value: `+${pct(fx.rarityLuckBonus, 1)}`, color: I.purple },
		{ label: 'Gem find in chests', value: pct(fx.gemChance, 1), color: I.blue },
		{ label: 'Golden monster chance', value: pct(fx.goldenMonsterChance, 1), color: I.gold },
		{ label: 'Gold find', value: pct(fx.goldFind, 1), color: I.gold },
		{ label: `Class (${PLAYER_CLASSES[playerClass]?.label ?? 'Hero'})`, value: [...classLines.combat, ...classLines.economy].join(', '), color: I.gold },
		{ label: 'Mana regen', value: `${formatCompact(fx.manaRegen, 2)}/s`, color: I.blue },
		{ label: 'Spell power', value: pct(fx.spellPower, 1), color: I.purple },
		{ label: 'XP gain', value: pct(fx.xpGain, 2), color: I.green },
		{ label: 'Tile discount', value: pct(fx.tileDiscount, 2), color: I.blue },
		...(fx.gearIncome > 0 ? [{ label: 'Income (set bonus)', value: `+${pct(fx.gearIncome, 0)}`, color: I.green }] : []),
		...(fx.killRewards > 0 ? [{ label: 'Kill rewards (set bonus)', value: `+${pct(fx.killRewards, 0)} gold and XP`, color: I.green }] : []),
		...(fx.gearClick > 0 ? [{ label: 'Click gold (set bonus)', value: `+${pct(fx.gearClick, 0)}`, color: I.green }] : []),
		...(fx.clickMastery > 0 ? [{ label: 'Click mastery (rebirth)', value: `+${pct(fx.clickMastery, 0)} gold per click`, color: I.purple }] : []),
		...(fx.buildTimeReduction > 0
			? [{ label: 'Master builders (rebirth)', value: `-${pct(fx.buildTimeReduction, 0)} castle build time`, color: I.purple }]
			: []),
		{ label: 'Offline progress', value: `up to ${formatCompact(fx.offlineCapHours, 1)} h at ${pct(fx.offlineEfficiency, 0)} income`, color: I.purple },
	];

	const resourceKeys = Object.keys(resourceRates.total) as (keyof Resources)[];
	const labelOf = (key: string) => (RESOURCES as Record<string, { label: string } | undefined>)[key]?.label ?? capital(key);
	const half = Math.ceil(combat.length / 2);

	return (
		<Panel parchment className='ds-ledger ds-stats'>
			<AttributeStrip
				attrs={attrs}
				points={points}
				onAdd={spend}
				onRespec={toggleGemShop}
				respecTitle='Give every attribute point back (the first respec is free, a rebirth does it for free)'
			/>
			<div className='ds-stats-scroll'>
				<Block id='overview' title='Overview'>
					<div className='ds-paper-cols-flow'>
						<div>
							<PaperRows rows={overview.slice(0, 4)} />
						</div>
						<div>
							<PaperRows rows={overview.slice(4)} />
						</div>
					</div>
				</Block>

				<Block id='combat-stats' title='Combat'>
					<div className='ds-paper-cols-flow'>
						<div>
							<PaperRows rows={combat.slice(0, half)} />
						</div>
						<div>
							<PaperRows rows={combat.slice(half)} />
						</div>
					</div>
				</Block>

				<Block id='bonus-stats' title='Bonuses'>
					<PaperRows rows={bonuses} />
				</Block>

				<Block id='resource-income' title='Resource income'>
					<div className='ds-income-table' role='table'>
						{INCOME_COLS.map(({ id, label }) => (
							<button
								key={id}
								type='button'
								role='columnheader'
								className={`ds-income-head${id === 'name' ? ' ds-income-name' : ''}`}
								aria-sort={sort?.col === id ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
								title={`Sort by ${label.toLowerCase()}`}
								onClick={() => setSort((now) => (now?.col === id ? { col: id, dir: now.dir === 1 ? -1 : 1 } : { col: id, dir: id === 'name' ? 1 : -1 }))}
							>
								{label}
								{sort?.col === id ? <i className='ds-sort-mark'>{sort.dir === 1 ? '▲' : '▼'}</i> : null}
							</button>
						))}
						{[...resourceKeys]
							.sort((x, y) => {
								if (!sort) return 0;
								const byName = labelOf(x).localeCompare(labelOf(y));
								return sort.col === 'name' ? sort.dir * byName : sort.dir * (resourceRates.total[x] - resourceRates.total[y]) || byName;
							})
							.map((key) => {
								const rate = resourceRates.total[key];
								const color = rate > 0 ? I.green : I.muted;
								const icon = resourceIcon(key);
								return (
									<React.Fragment key={key}>
										<span className='ds-income-name'>
											{icon ? <img src={icon} alt='' /> : null}
											{labelOf(key)}
										</span>
										<span style={{ color }}>{formatRate(rate)}</span>
										<span style={{ color }}>{formatNumber(rate * 60)}</span>
										<span style={{ color }}>{formatNumber(rate * 3600)}</span>
									</React.Fragment>
								);
							})}
					</div>
				</Block>

				<Block id='resource-breakdown' title='Where the income comes from' defaultOpen={false}>
					<p className='ds-paper-note'>
						Each tile adds 25% for every neighbour of the same biome, and tile and building output is scaled up by the yield scale. The castle bonus, the plains
						bonus (meat), your attributes and your rebirths then raise the total.
					</p>
					{classLines.economy.length > 0 && (
						<p className='ds-paper-note'>
							Your class ({PLAYER_CLASSES[playerClass]?.label}) adds: {classLines.economy.join(', ')}. It counts inside the same caps as gear and attributes.
						</p>
					)}
					{(Object.keys(breakdown) as (keyof Resources)[]).map((key) => {
						const entry = breakdown[key];
						const icon = resourceIcon(key);
						return (
							<Block
								key={key}
								id={`income-${key}`}
								compact
								defaultOpen={false}
								title={
									<>
										{icon ? <img src={icon} alt='' style={{ width: 16, height: 16 }} /> : null}
										{labelOf(key)}
									</>
								}
								summary={<span style={{ color: entry.total > 0 ? I.green : I.muted }}>{formatRate(entry.total)}</span>}
							>
								<PaperRows rows={breakdownRows(entry)} />
							</Block>
						);
					})}
				</Block>

				{prestige.rebirths >= 1 && (
					<Block id='rebirth-history' title='Rebirths' defaultOpen={false}>
						<div className='ds-paper-dark'>
							<RebirthsPanel />
						</div>
					</Block>
				)}
			</div>
		</Panel>
	);
};

export default HeroStats;
