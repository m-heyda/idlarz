import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { maxHp } from '@/lib/combat';
import { CharacterStats } from '@/types/game';
import LevelDetails from '../LevelDetails';
import CollapsibleSection from '../CollapsibleSection';
import { countOwnedTiles, getStatDescription } from '@/utils/gameUtils';
import { formatNumber, formatRate } from '@/utils/formatters';
import audioManager from '@/utils/audioManager';
import { CASTLE_BASE_RATES, REBIRTH } from '@/config/gameConfig';

const StatisticsOverlay: React.FC = () => {
	const {
		addStatPoint,
		resourceRates,
		tiles,
		level,
		resources,
		characterStats,
		prestige,
		playerHp,
		equipment,
	} = useGameStore();

	// Custom stat point allocation with sound
	const handleAddStatPoint = (stat: keyof CharacterStats) => {
		if (characterStats.availablePoints > 0) {
			addStatPoint(stat);
			audioManager.playSound('click');
		}
	};

	const totalOwnedTiles = countOwnedTiles(tiles);

	// Calculate XP needed for next level using the exponential formula
	const calculateResourceStats = (rate: number) => {
		return {
			perSecond: rate,
			perMinute: rate * 60,
			perHour: rate * 3600,
		};
	};

	// Format percentage values
	const formatPercentage = (value: number) => {
		return `${value.toFixed(2)}%`;
	};

	return (
				<div className='grid grid-cols-6 gap-6 h-full'>
					<div className='col-span-2 px-panel min-w-[200px]'>
						<LevelDetails />

						<div className='px-panel mt-4'>
							{/* Available Points */}
							{characterStats.availablePoints > 0 && (
								<div className='flex justify-between mb-4 px-card text-sm'>
									<span className='text-yellow-300 font-semibold'>
										Available points
									</span>
									<span className='text-yellow-300 font-semibold'>
										{characterStats.availablePoints}
									</span>
								</div>
							)}

							{/* Base Stats with Add Buttons */}
							<CollapsibleSection id='base-stats' title='Base Stats' className='mb-6'>
								{Object.entries(characterStats)
									.filter(([statKey]) =>
										[
											'strength',
											'dexterity',
											'intelligence',
											'vitality',
											'charisma',
											'availablePoints',
										].includes(statKey)
									)
									.map(([statKey, value]) => {
										if (statKey === 'availablePoints') return null;

										const stat = statKey as keyof Omit<
											CharacterStats,
											'availablePoints'
										>;

										return (
											<div
												key={stat}
												className='flex items-center text-xs mb-1.5'>
												<div className='group relative flex-1 flex justify-between items-center cursor-help'>
													<span className='text-[#d8c8a0] capitalize'>
														{stat}:
													</span>
													<span className='text-blue-400 font-medium'>
														{value}
													</span>
													<div className='absolute -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full w-max opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200'>
														<div className='px-tooltip min-w-[240px]'>
															<div className='space-y-2'>
																<div className='px-tip-title'>
																	{stat.charAt(0).toUpperCase() + stat.slice(1)}
																</div>
																<div className='space-y-0'>
																	{getStatDescription(stat)
																		.split('/')
																		.map((bonus, index) => (
																			<div
																				key={index}
																				className='text-xs text-[#a89878]'>
																				{bonus.trim()}
																			</div>
																		))}
																</div>
															</div>
														</div>
													</div>
												</div>
												<button
													onClick={() => handleAddStatPoint(stat)}
													disabled={characterStats.availablePoints <= 0}
													className={`ml-2 w-6 h-6 !p-0 flex items-center justify-center px-btn px-btn-sm ${
													characterStats.availablePoints > 0 ? '' : 'opacity-60'
												}`}
													aria-label={`Add point to ${stat}`}>
													+
												</button>
											</div>
										);
									})}
							</CollapsibleSection>

							{/* Combat Stats */}
							<CollapsibleSection id='combat-stats' title='Combat Stats' className='mb-6'>
								<div className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs'>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>HP:</span>
										<span className='text-green-400 font-medium'>
											{Math.floor(playerHp)} / {maxHp(characterStats, equipment)}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>MP:</span>
										<span className='text-blue-400 font-medium'>
											{characterStats.mp}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Physical ATK:</span>
										<span className='text-amber-400 font-medium'>
											{characterStats.physicalAtk}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Magic ATK:</span>
										<span className='text-purple-400 font-medium'>
											{characterStats.magicAtk}
										</span>
									</div>

									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>DEF:</span>
										<span className='text-amber-200 font-medium'>
											{characterStats.def}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Magic DEF:</span>
										<span className='text-indigo-400 font-medium'>
											{characterStats.magicDef}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Luck:</span>
										<span className='text-purple-500 font-medium'>
											{characterStats.luck}
										</span>
									</div>
								</div>
							</CollapsibleSection>

							{/* Bonus Stats */}
							<CollapsibleSection id='bonus-stats' title='Bonus Stats'>
								<div className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs'>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Crit Chance:</span>
										<span className='text-yellow-300 font-medium'>
											{formatPercentage(characterStats.critChance)}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Crit DMG:</span>
										<span className='text-orange-400 font-medium'>
											{formatPercentage(characterStats.critDmgMultiplier)}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>ATK Speed:</span>
										<span className='text-blue-300 font-medium'>
											{formatPercentage(characterStats.atkSpeedIncrease)}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>XP Gain:</span>
										<span className='text-green-400 font-medium'>
											{formatPercentage(characterStats.xpGainMultiplier)}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Tile Discount:</span>
										<span className='text-blue-400 font-medium'>
											{formatPercentage(characterStats.tileCostDiscount)}
										</span>
									</div>
									<div className='flex justify-between items-center'>
										<span className='text-[#d8c8a0]'>Reputation:</span>
										<span
											className={`font-medium ${
												characterStats.reputation >= 0
													? 'text-green-400'
													: 'text-red-400'
											}`}>
											{characterStats.reputation}
										</span>
									</div>
								</div>
							</CollapsibleSection>
						</div>
					</div>

					<div className='col-span-4 px-panel flex flex-col'>
						<div className='px-panel text-xs mb-6'>
							<div className='grid grid-cols-3 gap-x-6 gap-y-2'>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>Level:</span>
									<span className='text-yellow-400'>{level.level}</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>XP:</span>
									<span className='text-green-400'>
										{formatNumber(resources.xp)}
									</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>XP Rate:</span>
									<span className='text-green-400'>
										{formatRate(resourceRates.total.xp)}
									</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>Gold:</span>
									<span className='text-yellow-400'>
										{formatNumber(resources.gold)}
									</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>Rebirths:</span>
									<span className='text-purple-300'>
										{prestige.rebirths} (+{(prestige.legacyEarned * REBIRTH.incomePerPoint * 100).toFixed(0)}% income)
									</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>Total Tiles:</span>
									<span className='text-blue-400'>{totalOwnedTiles}</span>
								</div>
								<div className='flex justify-between'>
									<span className='text-[#d8c8a0]'>Level Progress:</span>
									<span className='text-purple-400'>
										{(level.progress * 100).toFixed(1)}%
									</span>
								</div>
							</div>
						</div>

						<div className='px-panel text-sm mb-8'>
							<h2 className='px-h text-center'>
								Resource Generation
							</h2>

							<div className='grid grid-cols-2 gap-6 text-xs'>
								{Object.entries(resourceRates.total).map(([resource, rate]) => {
									const timeStats = calculateResourceStats(rate);

									return (
										<div key={resource} className=''>
											<div className='flex justify-between items-center border-b px-rule pb-1 mb-2'>
												<span className='text-[#d8c8a0] capitalize font-medium'>
													{resource}
												</span>
												<span
													className={
														rate > 0 ? 'text-green-400' : 'text-red-400'
													}>
													{formatRate(rate)}
												</span>
											</div>

											<div className='pl-4 space-y-1 text-xs'>
												<div className='flex justify-between'>
													<span className='text-[#a89878]'>Per minute:</span>
													<span
														className={
															timeStats.perMinute > 0
																? 'text-green-300'
																: 'text-red-300'
														}>
														{formatNumber(timeStats.perMinute)}
													</span>
												</div>
												<div className='flex justify-between'>
													<span className='text-[#a89878]'>Per hour:</span>
													<span
														className={
															timeStats.perHour > 0
																? 'text-green-300'
																: 'text-red-300'
														}>
														{formatNumber(timeStats.perHour)}
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div className='px-panel text-xs'>
							<h2 className='px-h text-center'>
								Resource Modifiers
							</h2>

							<div className='space-y-4'>
								{Object.entries(resourceRates.modifiers).map(
									([resource, modifier]) => {
										const baseValue =
											resourceRates.base[
												resource as keyof typeof resourceRates.base
											];
										const totalValue =
											resourceRates.total[
												resource as keyof typeof resourceRates.total
											];
										const modifierPercent = modifier * 100;

										// Skip XP for modifiers section as it doesn't follow the same rules
										if (resource === 'xp') return null;

										return (
											<div key={`modifier-${resource}`} className=''>
												<div className='flex justify-between items-center border-b px-rule pb-1 mb-2'>
													<span className='text-[#d8c8a0] capitalize font-medium'>
														{resource} Modifiers
													</span>
													<span
														className={
															modifierPercent > 0
																? 'text-green-400'
																: 'text-[#a89878]'
														}>
														+{modifierPercent.toFixed(0)}%
													</span>
												</div>

												<div className='pl-4 space-y-1'>
													<div className='flex justify-between'>
														<span className='text-[#a89878]'>Base value:</span>
														<span className='text-blue-300'>
															{formatRate(baseValue)}
														</span>
													</div>

													<div className='flex justify-between text-xs'>
														<span className='text-[#7a6a52]'>
															From castle base:
														</span>
														<span className='text-blue-200'>
															{formatRate(
																CASTLE_BASE_RATES[
																	resource as keyof typeof CASTLE_BASE_RATES
																] || 0
															)}
														</span>
													</div>

													<div className='flex justify-between text-xs'>
														<span className='text-[#7a6a52]'>
															From biome tiles:
														</span>
														<span className='text-blue-200'>
															{formatRate(
																baseValue -
																	(CASTLE_BASE_RATES[
																		resource as keyof typeof CASTLE_BASE_RATES
																	] || 0)
															)}
														</span>
													</div>

													<div className='mt-1 pt-1 border-t px-rule text-xs'>
														<div className='flex justify-between'>
															<span className='text-[#a89878]'>
																Modifier value:
															</span>
															<span className='text-green-300'>
																{(baseValue * modifier).toFixed(2)}/s
															</span>
														</div>

														<div className='flex justify-between'>
															<span className='text-[#a89878]'>
																Total with modifiers:
															</span>
															<span className='text-yellow-300'>
																{formatRate(totalValue)}
															</span>
														</div>
													</div>

													<div className='flex justify-between text-xs text-[#7a6a52] border-t px-rule pt-1 mt-1'>
														<span>Formula:</span>
														<span>
															{baseValue.toFixed(2)} (base) +{' '}
															{modifier.toFixed(2)} (% mod) ={' '}
															{totalValue.toFixed(2)}{' '}
														</span>
													</div>
												</div>
											</div>
										);
									}
								)}

								<div className='mt-4 border-t px-rule pt-3'>
									<h3 className='text-[#d8c8a0] font-medium mb-2'>
										Castle Modifier Details
									</h3>
									<div className='pl-2 space-y-1 text-xs'>
										<div className='flex justify-between'>
											<span className='text-[#a89878]'>Level 1 base bonus:</span>
											<span className='text-green-300'>+20%</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-[#a89878]'>
												Current castle level:
											</span>
											<span className='text-yellow-300'>
												{(() => {
													// Find castle level
													for (let y = 0; y < tiles.length; y++) {
														for (let x = 0; x < tiles[y].length; x++) {
															const tile = tiles[y][x];
															if (
																tile.isOwned &&
																tile.biome === 'castle' &&
																tile.level
															) {
																return tile.level;
															}
														}
													}
													return 0;
												})()}
											</span>
										</div>
									</div>
								</div>

								<div className='mt-4 border-t px-rule pt-3'>
									<h3 className='text-[#d8c8a0] font-medium mb-2'>
										Adjacency Bonuses
									</h3>
									<div className='pl-2 space-y-1 text-xs'>
										<div className='flex justify-between'>
											<span className='text-[#a89878]'>
												Bonus per adjacent same biome:
											</span>
											<span className='text-green-300'>+25%</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-[#a89878]'>Applied to:</span>
											<span className='text-green-300'>
												Base resource value
											</span>
										</div>
										<div className='flex text-[#7a6a52] text-xs italic mt-1'>
											<span>
												Adjacency bonuses apply directly to base generation
												before modifiers
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
	);
};

export default StatisticsOverlay;
