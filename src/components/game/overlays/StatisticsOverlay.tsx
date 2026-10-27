import React, { useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { armorOf, attacksPerSecond, damagePerClick, lifeLeechPercent, maxHp, maxMana } from '@/lib/combat';
import type { CharacterStats, Resources } from '@/types/game';
import LevelDetails from '../LevelDetails';
import CollapsibleSection from '../CollapsibleSection';
import ResourceIcon from '../ResourceIcon';
import { calculateResourceBreakdown, countOwnedTiles, getStatDescription, type ResourceBreakdownEntry } from '@/utils/gameUtils';
import { formatNumber, formatRate } from '@/utils/formatters';
import audioManager from '@/utils/audioManager';
import { REBIRTH } from '@/config/gameConfig';

const BASE_STATS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

const pct = (value: number, digits = 0) => `${value.toFixed(digits)}%`;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One label / value line; `muted` for the small print inside a breakdown. */
const Line: React.FC<{ label: React.ReactNode; value: React.ReactNode; valueClass?: string; muted?: boolean; indent?: boolean }> = ({
	label,
	value,
	valueClass = 'text-[#ecdcb4]',
	muted,
	indent,
}) => (
	<div className={`flex justify-between gap-3 ${indent ? 'pl-4' : ''} ${muted ? 'text-[#7a6a52]' : ''}`}>
		<span className={muted ? '' : 'text-[#d8c8a0]'}>{label}</span>
		<span className={`tabular-nums ${valueClass}`}>{value}</span>
	</div>
);

/** What one resource's income is made of: the base pieces, the bonuses on top, and the total. */
const BreakdownBody: React.FC<{ entry: ResourceBreakdownEntry }> = ({ entry }) => {
	const pieces: [string, number][] = [
		['Realm start', entry.start],
		['Farm animals', entry.farm],
		['Biome tiles', entry.biome],
		['Buildings', entry.building],
		['Castle area', entry.castleArea],
		['Castle levels', entry.castleXp],
	];
	const bonuses: [string, string][] = [];
	if (entry.castleMod) bonuses.push(['Castle', `+${pct(entry.castleMod * 100)}`]);
	if (entry.plainsMod) bonuses.push(['Plains tiles', `+${pct(entry.plainsMod * 100)}`]);
	if (entry.statMod) bonuses.push(['Attributes', `+${pct(entry.statMod * 100)}`]);
	if (entry.legacyMult !== 1) bonuses.push(['Rebirth (Legacy)', `x${entry.legacyMult.toFixed(2)}`]);

	return (
		<div className='text-xs space-y-1'>
			<Line label='Base income' value={formatRate(entry.base)} valueClass='text-blue-300' />
			{pieces
				.filter(([, value]) => value > 0)
				.map(([label, value]) => (
					<Line key={label} label={label} value={formatRate(value)} muted indent />
				))}
			{bonuses.length > 0 && <Line label='Bonuses' value={`${entry.modifier >= 0 ? '+' : ''}${pct(entry.modifier * 100)} in all`} valueClass='text-green-300' />}
			{bonuses.map(([label, value]) => (
				<Line key={label} label={label} value={value} muted indent />
			))}
			<Line label='Total' value={formatRate(entry.total)} valueClass='text-yellow-300' />
		</div>
	);
};

const StatisticsOverlay: React.FC = () => {
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

	const points = characterStats.availablePoints;
	const breakdown = useMemo(
		() => calculateResourceBreakdown(tiles, characterStats, farmLevels, prestige, farmUpgrades),
		[tiles, characterStats, farmLevels, prestige, farmUpgrades]
	);

	const handleAddStatPoint = (stat: keyof CharacterStats) => {
		if (points > 0) {
			addStatPoint(stat);
			audioManager.playSound('click');
		}
	};

	return (
		<div className='flex flex-col gap-5'>
			{/* The hero on the left; attributes and the overview to the right of him */}
			<div className='flex flex-wrap items-start gap-6'>
				<div className='relative shrink-0'>
					<LevelDetails />
					{/* Absolutely placed on the portrait, so spending points never moves anything */}
					{points > 0 && (
						<div
							className='absolute top-2 right-2 z-10 px-2 py-0.5 text-xs font-semibold text-[#2a1e10] bg-[#f0d27a] border border-[#8a6a2a] pointer-events-none'
							title='Unspent attribute points'>
							{points} {points === 1 ? 'point' : 'points'}
						</div>
					)}
				</div>

				<div className='flex-1 min-w-[300px] grid grid-cols-2 gap-x-8 gap-y-4 text-sm'>
					<div>
						<h3 className='px-h'>Attributes</h3>
						<div className='space-y-1.5'>
							{BASE_STATS.map((stat) => (
								<div key={stat} className='flex items-center text-xs'>
									<div className='group relative flex-1 flex justify-between items-center cursor-help'>
										<span className='text-[#d8c8a0] capitalize'>{stat}</span>
										<span className='text-blue-400 font-medium tabular-nums'>{characterStats[stat]}</span>
										<div className='absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full w-max opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200'>
											<div className='px-tooltip min-w-[240px]'>
												<div className='px-tip-title'>{capital(stat)}</div>
												{getStatDescription(stat)
													.split('/')
													.map((bonus, index) => (
														<div key={index} className='text-xs text-[#a89878]'>
															{bonus.trim()}
														</div>
													))}
											</div>
										</div>
									</div>
									<button
										onClick={() => handleAddStatPoint(stat)}
										disabled={points <= 0}
										className={`ml-2 w-6 h-6 !p-0 flex items-center justify-center px-btn px-btn-sm ${points > 0 ? '' : 'opacity-40'}`}
										aria-label={`Add point to ${stat}`}>
										+
									</button>
								</div>
							))}
						</div>
					</div>

					<div>
						<h3 className='px-h'>Overview</h3>
						<div className='space-y-1.5 text-xs'>
							<Line label='Level' value={level.level} valueClass='text-yellow-400' />
							<Line label='Next level' value={pct(level.progress * 100, 1)} valueClass='text-purple-400' />
							<Line label='XP' value={`${formatNumber(resources.xp)} (${formatRate(resourceRates.total.xp)})`} valueClass='text-green-400' />
							<Line label='Gold' value={formatNumber(resources.gold)} valueClass='text-yellow-400' />
							<Line label='Tiles' value={countOwnedTiles(tiles)} valueClass='text-blue-400' />
							<Line
								label='Rebirths'
								value={`${prestige.rebirths} (+${(prestige.legacyEarned * REBIRTH.incomePerPoint * 100).toFixed(0)}%)`}
								valueClass='text-purple-300'
							/>
						</div>
					</div>
				</div>
			</div>

			<div className='grid grid-cols-2 gap-x-8 gap-y-4 max-[760px]:grid-cols-1'>
				<CollapsibleSection id='combat-stats' title='Combat'>
					<div className='space-y-1 text-xs'>
						<Line label='HP' value={`${Math.floor(playerHp)} / ${maxHp(characterStats, equipment)}`} valueClass='text-green-400' />
						<Line label='MP' value={`${Math.floor(playerMp)} / ${maxMana(characterStats, equipment)}`} valueClass='text-blue-400' />
						<Line label='Damage' value={`${damagePerClick(equipment, characterStats)} per hit`} valueClass='text-orange-300' />
						<Line label='Physical ATK' value={`+${pct(characterStats.physicalAtk, 1)}`} valueClass='text-amber-400' />
						<Line label='Magic ATK' value={`+${pct(characterStats.magicAtk, 1)}`} valueClass='text-purple-400' />
						<Line label='DEF (armor)' value={Math.round(armorOf(equipment, characterStats) * 10) / 10} valueClass='text-amber-200' />
						<Line label='Luck' value={characterStats.luck} valueClass='text-purple-500' />
					</div>
				</CollapsibleSection>

				<CollapsibleSection id='bonus-stats' title='Bonuses' defaultOpen={false}>
					<div className='space-y-1 text-xs'>
						<Line label='Crit chance' value={pct(characterStats.critChance, 2)} valueClass='text-yellow-300' />
						<Line label='Crit damage' value={pct(characterStats.critDmgMultiplier, 2)} valueClass='text-orange-400' />
						<Line label='ATK speed' value={`${attacksPerSecond(equipment, characterStats)}/s (+${pct(characterStats.atkSpeedIncrease, 2)})`} valueClass='text-blue-300' />
						<Line label='Life leech' value={pct(lifeLeechPercent(equipment), 1)} valueClass='text-red-300' />
						<Line label='XP gain' value={pct(characterStats.xpGainMultiplier, 2)} valueClass='text-green-400' />
						<Line label='Tile discount' value={pct(characterStats.tileCostDiscount, 2)} valueClass='text-blue-400' />
						<Line
							label='Reputation'
							value={characterStats.reputation}
							valueClass={characterStats.reputation >= 0 ? 'text-green-400' : 'text-red-400'}
						/>
					</div>
				</CollapsibleSection>
			</div>

			<CollapsibleSection id='resource-income' title='Resource income'>
				<div className='text-xs max-w-[560px]'>
					<div className='grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-x-4 gap-y-1 text-[#a89878] border-b px-rule pb-1 mb-1'>
						<span>Resource</span>
						<span className='text-right'>Per second</span>
						<span className='text-right'>Per minute</span>
						<span className='text-right'>Per hour</span>
					</div>
					{(Object.keys(resourceRates.total) as (keyof Resources)[]).map((resource) => {
						const rate = resourceRates.total[resource];
						const tone = rate > 0 ? 'text-green-300' : 'text-[#7a6a52]';
						return (
							<div key={resource} className='grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-x-4 py-0.5 items-center'>
								<span className='flex items-center gap-1 text-[#d8c8a0]'>
									<ResourceIcon resource={resource} />
									{capital(resource)}
								</span>
								<span className={`text-right tabular-nums ${tone}`}>{formatRate(rate)}</span>
								<span className={`text-right tabular-nums ${tone}`}>{formatNumber(rate * 60)}</span>
								<span className={`text-right tabular-nums ${tone}`}>{formatNumber(rate * 3600)}</span>
							</div>
						);
					})}
				</div>
			</CollapsibleSection>

			<CollapsibleSection id='resource-breakdown' title='Where the income comes from' defaultOpen={false}>
				<p className='text-xs text-[#a89878]'>
					Each tile adds 25% for every neighbour of the same biome, and tile and building output is scaled up by the yield scale.
					The castle bonus, the plains bonus (meat), your attributes and your rebirths then raise the total.
				</p>
				{(Object.keys(breakdown) as (keyof Resources)[]).map((resource) => {
					const entry = breakdown[resource];
					return (
						<CollapsibleSection
							key={resource}
							id={`income-${resource}`}
							compact
							defaultOpen={false}
							title={
								<span className='flex items-center gap-1'>
									<ResourceIcon resource={resource} />
									{capital(resource)}
								</span>
							}
							summary={
								<span className={entry.total > 0 ? 'text-green-300' : 'text-[#7a6a52]'}>
									{formatRate(entry.total)}
								</span>
							}>
							<BreakdownBody entry={entry} />
						</CollapsibleSection>
					);
				})}
			</CollapsibleSection>
		</div>
	);
};

export default StatisticsOverlay;
