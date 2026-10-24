import React from 'react';
import {
	ANIMALS,
	BASE_XP_PER_LEVEL,
	BASE_TILE_COST,
	BIOME_YIELD,
	BIOMES,
	BUILDINGS,
	BUILDING_COST,
	CASTLE_UPGRADE,
	CHARACTER_STAT_CONFIG,
	CHEST,
	LEGACY_UPGRADES,
	REBIRTH,
	CLICK_LADDER,
	CLICK_LIMIT,
	FARM_BONUS,
	MERCHANT_BUY_MULTIPLIER,
	MERCHANT_RESOURCE_PRICES,
	SCALING_CONFIG,
	TILE_RESOURCE_COST,
	TILE_TAP,
	XP_GROWTH_FACTOR,
} from '@/config/gameConfig';
import { BIOME_PIXEL_ICONS } from '@/config/pixelIcons';
import { formatNumber, formatTime } from '@/utils/formatters';
import { castleModifier } from '@/utils/gameUtils';
import PixelIcon from '../PixelIcon';
import ResourceIcon from '../ResourceIcon';

/**
 * The in-game guide. Every number is read from the game config (or the stat config), so this text can
 * never drift away from the rules again: change a constant and the tutorial changes with it.
 */
const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
const rate = (n: number) => (Math.round(n * 100) / 100).toString();
// 500.0 -> 500, 10.00K -> 10K
const short = (n: number) => formatNumber(n).replace(/[.]0+(?=[KMBT]?$)/, '');

const Res: React.FC<{ r: string; children?: React.ReactNode }> = ({ r, children }) => (
	<span className='inline-flex items-center gap-1 whitespace-nowrap'>
		<ResourceIcon resource={r} />
		{children}
	</span>
);

const Tutorial: React.FC = () => {
	const biomes = Object.values(BIOMES).filter((b) => b.name !== 'castle' && b.name !== 'empty');
	const castleStart = castleModifier(1);
	const castleAtDoublingEnd = castleModifier(CASTLE_UPGRADE.doublingUntil);
	const castleMax = castleModifier(CASTLE_UPGRADE.maxLevel);
	const stat = CHARACTER_STAT_CONFIG;
	const resourceTargets = (s: keyof typeof stat.resourceTargets) =>
		stat.resourceTargets[s].map((r) => r[0].toUpperCase() + r.slice(1)).join(' & ');
	const firstTileResources = TILE_RESOURCE_COST.map((c) => `${c.resource} from tile ${c.from}`).join(', ');
	const totalCastleTime = CASTLE_UPGRADE.durationsSec
		.slice(0, CASTLE_UPGRADE.maxLevel - 1)
		.reduce((a, b) => a + b, 0);

	return (
		<div className='space-y-5 text-sm'>
			<section>
				<h3 className='px-h'>Game Basics</h3>
				<p className='text-[#d8c8a0]'>
					Grow your realm: buy tiles next to your territory, upgrade the castle, farm animals, trade with the
					merchant and spend stat points. Everything produces resources every second, even while you are
					away from the keyboard (the tab must stay open). Progress is saved automatically in this browser.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Tiles &amp; Biomes</h3>
				<p className='text-[#d8c8a0] mb-2'>
					You start with the castle and its eight neighbours already yours. Every tile you buy becomes a biome and
					produces resources per second. Same-biome neighbours boost each other by +{pct(SCALING_CONFIG.adjacencyBonus)} per
					neighbour (up to four). New land tends to continue the biome next to it, so areas grow into forests, lakes and ridges.
					Every 4th purchase lets you choose the biome instead of rolling one - but some biomes are blocked by their neighbours
					(Tundra never touches Swamp or Coast, Hills never touch Coast, Coast needs water) or unlock later (Swamp, Tundra).
				</p>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
					{biomes.map((b) => (
						<div key={b.name} className='px-card'>
							<h4 className='text-[#f0d27a] font-medium mb-1 flex items-center gap-1'>
								{BIOME_PIXEL_ICONS[b.name] && (
									<PixelIcon name={BIOME_PIXEL_ICONS[b.name]!} alt='' scale={0.5} className='inline-block align-middle' />
								)}
								{b.label}
							</h4>
							<p className='text-[#d8c8a0] text-xs flex flex-wrap gap-x-3'>
								{Object.entries(b.resourceGeneration).map(([r, v]) => (
									<Res key={r} r={r}>
										+{rate((v as number) * BIOME_YIELD.scale)}/s
									</Res>
								))}
							</p>
							{b.name === 'plains' && (
								<p className='text-[#a89878] text-xs mt-1'>
									Each Plains tile also adds +{pct(stat.plainsMeatModifier)} to meat production.
								</p>
							)}
							{b.name === 'grounds' && (
								<p className='text-[#a89878] text-xs mt-1'>
									Click it once to build one permanent building (they cost resources, and each one costs
									more than the last: from {Object.entries(BUILDING_COST.base).map(([r, v]) => `${short(v as number)} ${r}`).join(', ')}, x
									{BUILDING_COST.growth} each).
								</p>
							)}
						</div>
					))}
				</div>
				<p className='text-[#a89878] text-xs mt-2'>
					Buildings: {Object.values(BUILDINGS).map((b) => b.label).join(', ')}.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Tile Cost</h3>
				<p className='text-[#d8c8a0] mb-1'>
					Each new tile costs more than the last: about x{SCALING_CONFIG.growthEarly} per tile you own up to{' '}
					{SCALING_CONFIG.earlyTiles} tiles, then x{SCALING_CONFIG.growthLate} per tile up to {SCALING_CONFIG.lateTiles}, and
					x{SCALING_CONFIG.growthEndgame} beyond that.
				</p>
				<p className='text-[#d8c8a0] text-xs px-card font-mono'>
					gold = {BASE_TILE_COST} x {SCALING_CONFIG.growthEarly}^min(tiles, {SCALING_CONFIG.earlyTiles}) x{' '}
					{SCALING_CONFIG.growthLate}^(min(tiles, {SCALING_CONFIG.lateTiles}) - {SCALING_CONFIG.earlyTiles}) x{' '}
					{SCALING_CONFIG.growthEndgame}^max(tiles - {SCALING_CONFIG.lateTiles}, 0)
				</p>
				<p className='text-[#a89878] mt-1'>
					Bigger territories also need materials ({firstTileResources}). Each Charisma point removes{' '}
					{stat.tileDiscountPercentPerCharisma}% of the cost (max {stat.tileDiscountCapPercent}%).
				</p>
			</section>

			<section>
				<h3 className='px-h'>Clicking</h3>
				<p className='text-[#d8c8a0]'>
					Clicking the <b>map</b> pays <Res r='gold'>{pct(CLICK_LADDER[0].power)}</Res> of your gold per second per
					click, upgradeable in the merchant to {pct(CLICK_LADDER[CLICK_LADDER.length - 1].power)}. Clicking an
					owned tile also taps it for {TILE_TAP.seconds}s of its own output (each tile recharges for{' '}
					{TILE_TAP.cooldownMs / 1000}s).
				</p>
				<p className='text-[#a89878] mt-1'>
					Fast clicking is fine: you can click up to {CLICK_LIMIT.capacity} times in a burst and about{' '}
					{CLICK_LIMIT.refillPerSec} times per second sustained. Faster than that, clicks made by scripts or
					auto-clickers, and clicks on menus or buttons do not pay.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Castle</h3>
				<p className='text-[#d8c8a0]'>
					The castle gives a bonus to <b>all</b> resources: +{pct(castleStart)} at level 1, doubling with every level
					up to +{pct(castleAtDoublingEnd)} at level {CASTLE_UPGRADE.doublingUntil}, then +
					{pct(CASTLE_UPGRADE.lateLevelStep)} more per level up to +{pct(castleMax)} at level{' '}
					{CASTLE_UPGRADE.maxLevel}. Upgrades cost resources and take real time (
					{formatTime(CASTLE_UPGRADE.durationsSec[0])} for the first, {formatTime(totalCastleTime)} in total); the
					castle keeps its current bonus while it is being built. From level 2 it also produces +
					{CASTLE_UPGRADE.xpBonus} XP/s per level above 1.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Rebirth &amp; Legacy</h3>
				<p className='text-[#d8c8a0]'>
					When your castle reaches level {REBIRTH.minCastleLevel} and you own at least {REBIRTH.minTiles} tiles you can
					Rebirth from the Legacy window: the map, resources, castle, farm and level start again, and you keep your name,
					hero and Gems. Every Gem is worth +{pct(REBIRTH.incomePerPoint)} income for ever and can be spent in
					the shop ({Object.values(LEGACY_UPGRADES).map((u) => u.label).join(', ')}). A higher castle level and more tiles
					at the moment of rebirth give more points, so pushing on to level {CASTLE_UPGRADE.maxLevel} first pays.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Farm</h3>
				<p className='text-[#d8c8a0] mb-2'>
					Buy animals with <Res r='food'>food</Res>: hover an animal for its card (Buy, x10 or Max). Each animal
					produces meat every second plus a farm product (<Res r='eggs'>eggs</Res>, <Res r='milk'>milk</Res> or{' '}
					<Res r='hide'>hide</Res>) you can sell or spend on the upgrades along the bottom; the next one of the same
					kind costs more, and the pen holds a limited number of each kind.
				</p>
				<div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
					{ANIMALS.map((a) => (
						<div key={a.id} className='px-card'>
							<h4 className='text-yellow-300 font-medium mb-1 flex items-center gap-1'>
								{a.name}
								<PixelIcon name={`animal_${a.id}` as never} alt='' scale={0.5} className='inline-block align-middle' />
							</h4>
							<p className='text-[#d8c8a0] text-xs'>First: {short(a.baseCost)} food</p>
							<p className='text-[#d8c8a0] text-xs'>+{rate(a.baseProduction)} meat/s each</p>
							<p className='text-[#a89878] text-xs'>Each next one costs x{a.costScaling}</p>
						</div>
					))}
				</div>
				<p className='text-[#a89878] text-xs mt-2'>
					While the Farm window is open, a critter wanders by now and then: click it for a gift worth about{' '}
					{FARM_BONUS.critters.butterfly.seconds} seconds of that resource&apos;s income.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Merchant</h3>
				<p className='text-[#d8c8a0] mb-2'>
					Sell resources, farm products and spare gear from your bag for gold; buying resources costs{' '}
					{MERCHANT_BUY_MULTIPLIER}x the selling price, so trading back and forth never gains anything. Buy Goods has
					click power, permanent bonuses (Haggler, Bulk Discount, Lucky Charm, Pack Rat) and plain gear and potions.
					Rattatui gear is not for sale: the Rat King drops it.
				</p>
				<div className='grid grid-cols-2 md:grid-cols-5 gap-2'>
					{Object.entries(MERCHANT_RESOURCE_PRICES).map(([r, price]) => (
						<div key={r} className='px-card'>
							<h4 className='font-medium mb-1 capitalize'>
								<Res r={r}>{r}</Res>
							</h4>
							<p className='text-[#d8c8a0] text-xs'>sells for {price} gold</p>
							<p className='text-[#a89878] text-xs'>costs {price * MERCHANT_BUY_MULTIPLIER} gold</p>
						</div>
					))}
				</div>
			</section>

			<section>
				<h3 className='px-h'>Chests</h3>
				<p className='text-[#d8c8a0]'>
					A chest appears on one of your tiles every {formatTime(CHEST.intervalSec)} (up to {CHEST.max} wait for you).
					Click it to open it: usually {CHEST.minMinutes}-{CHEST.maxMinutes} minutes&apos; worth of your passive gold
					income, sometimes a lucky x{CHEST.boostMultiplier} chest, a bundle of wood, stone, coal or food, a burst of XP, or
					even a piece of gear. Chests like the edge of your land. Each point of Luck (from Charisma) adds
					+{pct(CHEST.luckBonusPerPoint, 1)} gold and makes the lucky chest and gear likelier.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Character Stats</h3>
				<p className='text-[#d8c8a0] mb-2'>You gain one stat point per level. Each point gives:</p>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
					{(Object.keys(stat.resourceTargets) as (keyof typeof stat.resourceTargets)[]).map((s) => (
						<div key={s} className='px-card'>
							<h4 className='text-[#f0d27a] font-medium mb-1 capitalize'>{s}</h4>
							<p className='text-[#d8c8a0] text-xs'>
								+{pct(stat.resourceModifierPerPoint, 1)} {resourceTargets(s)} production
								{s in stat.xpGainPercentPerPoint &&
									`, +${stat.xpModifierPerPoint[s as 'intelligence' | 'charisma'] * 100}% XP production, +${
										stat.xpGainPercentPerPoint[s as 'intelligence' | 'charisma']
									}% XP gained`}
								{s === 'charisma' && `, -${stat.tileDiscountPercentPerCharisma}% tile cost`}
							</p>
						</div>
					))}
				</div>
			</section>

			<section>
				<h3 className='px-h'>Leveling</h3>
				<p className='text-[#d8c8a0] text-xs px-card font-mono'>
					XP to leave level N = {BASE_XP_PER_LEVEL} x {XP_GROWTH_FACTOR}^(N-1)
				</p>
				<p className='text-[#a89878] mt-1'>
					XP comes from time (more with the castle and Grounds tiles) and from every tile you buy.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Tips</h3>
				<ul className='list-disc pl-5 text-[#d8c8a0] text-xs space-y-1'>
					<li>Group the same biomes together for the neighbour bonus.</li>
					<li>Start the castle upgrade as soon as you can: it runs while you do other things.</li>
					<li>Check what the next castle level needs before spending wood, stone and coal on tiles.</li>
					<li>Surplus resources can be sold, and missing ones bought, at the merchant.</li>
					<li>Plains boost meat; a farm is the main way to turn food into gold.</li>
				</ul>
			</section>
		</div>
	);
};

export default Tutorial;
