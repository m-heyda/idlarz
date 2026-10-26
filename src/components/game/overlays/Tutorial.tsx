import React from 'react';
import {
	ANIMALS,
	BASE_XP_PER_LEVEL,
	BASE_TILE_COST,
	BIOME_YIELD,
	BIOMES,
	BUILDINGS,
	BUILDING_COST,
	CASTLE_FORTRESS,
	CASTLE_RANGE,
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
	TILE_PRICE,
	TILE_RESOURCE_COST,
	TILE_TAP,
	XP_GROWTH_FACTOR,
} from '@/config/gameConfig';
import { COMBAT, MONSTERS } from '@/config/combatConfig';
import { RARITIES, RARITY_ORDER, SETS } from '@/catalog';
import { BIOME_PIXEL_ICONS } from '@/config/pixelIcons';
import { formatNumber, formatTime } from '@/utils/formatters';
import { buildingCostFactor, castleModifier } from '@/utils/gameUtils';
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
	// Grounds, the old building lot, is no longer part of a new map (buildings go on any tile)
	const biomes = Object.values(BIOMES).filter((b) => b.name !== 'castle' && b.name !== 'empty' && b.name !== 'grounds');
	const buildingBase = BUILDING_COST.base;
	const buildingExamples = [0, 1, 2, 3, 4, 8, 16, 32].map((n) => ({ n, gold: Math.floor((buildingBase.gold ?? 0) * buildingCostFactor(n)) }));
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
					merchant and spend stat points. The journal button in the top bar opens the Menu: Character, Stats, Merchant and Farm are its tabs. Everything produces resources every second, even while you are
					away from the keyboard (the tab must stay open). Progress is saved automatically in this browser.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Menus &amp; Saving</h3>
				<p className='text-[#d8c8a0] mb-2'>
					The browser&apos;s own right-click menu is switched off in the game; the <b>right click</b> opens the game&apos;s menu instead.
					Right-click a tile, a monster, a chest or a bag item for what you can do with it (the entries are listed in their sections),
					and the same menu ends with the global entries. The gear button in the top bar opens the same global menu as a dropdown.
				</p>
				<ul className='list-disc pl-5 text-[#d8c8a0] text-xs space-y-1'>
					<li><b>Settings</b> and <b>Guide</b>: sound and ambient life, and this page.</li>
					<li>
						<b>Save game</b> writes the save right now. The game also saves itself a couple of seconds after every change and when you
						close or hide the tab.
					</li>
					<li>
						<b>Export game save</b> copies your whole game as one line of text to the clipboard; <b>Import / backup</b> pastes one back
						(or saves it as a file).
					</li>
					<li><b>Show statistics</b> puts a small panel in the bottom right corner: FPS, slowest frame, tiles owned, monsters and time played.</li>
					<li>Development builds also have <b>Show admin mode</b>, the cheat panel, which can be folded into an icon.</li>
				</ul>
			</section>

			<section>
				<h3 className='px-h'>Tiles &amp; Biomes</h3>
				<p className='text-[#d8c8a0] mb-2'>
					You start with the castle and its eight neighbours already yours. Every tile you buy becomes a biome and
					produces resources per second. Same-biome neighbours boost each other by +{pct(SCALING_CONFIG.adjacencyBonus)} per
					neighbour (up to four). New land tends to continue the biome next to it, so areas grow into forests, lakes and ridges.
					The biome is rolled when you buy the tile, and some biomes are blocked by their neighbours (Tundra never touches Swamp
					or Coast, Hills never touch Coast, Coast needs water) or unlock later (Swamp, Tundra). Right-click any explored tile to
					build on it (see Buildings).
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
						</div>
					))}
				</div>
			</section>

			<section>
				<h3 className='px-h'>Buildings</h3>
				<p className='text-[#d8c8a0] mb-2'>
					<b>Right-click</b> any explored tile (not the castle, not a lake, and not while a chest or a monster is on it) and choose{' '}
					<b>Build here</b> to open the build window (<b>Highlight this area</b> in the same menu tints the connected area of that biome around the tile for a moment).
					Pick one of {Object.keys(BUILDINGS).length} buildings: {Object.values(BUILDINGS).map((b) => b.label).join(', ')}. The tile
					keeps its biome and its output and the building adds its own on top, with the same neighbour bonus; a patch in the
					style of the biome (packed earth, trampled snow, a plank landing ...) is laid under it. One building per tile, and it is permanent.
				</p>
				<p className='text-[#d8c8a0] mb-1'>
					Every building costs more than the last. The first {BUILDING_COST.starter.length} are cheap (
					{BUILDING_COST.starter.map((f) => `x${f}`).join(', ')} of the base price of{' '}
					{Object.entries(buildingBase).map(([r, v]) => `${short(v as number)} ${r}`).join(', ')}), then the price grows x
					{BUILDING_COST.growthEarly} per building for {BUILDING_COST.earlyCount} buildings, x{BUILDING_COST.growthMid} for the next{' '}
					{BUILDING_COST.midCount} and x{BUILDING_COST.growthLate} after that (the same three-stage shape as tile prices).
				</p>
				<p className='text-[#a89878] text-xs px-card font-mono'>
					gold for building number: {buildingExamples.map((e) => `${e.n + 1}: ${short(e.gold)}`).join(' - ')} (wood and stone
					scale the same way; Legacy Thrift lowers it)
				</p>
			</section>

			<section>
				<h3 className='px-h'>Tile Cost</h3>
				<p className='text-[#d8c8a0] mb-1'>
					Each new tile costs more than the last: about x{SCALING_CONFIG.growthEarly} per tile you own up to{' '}
					{SCALING_CONFIG.earlyTiles} tiles, then x{SCALING_CONFIG.growthLate} per tile up to {SCALING_CONFIG.lateTiles}, and
					x{SCALING_CONFIG.growthEndgame} up to {TILE_PRICE.tailFrom}. After that the price keeps rising, but slowly, so there is no limit
					to how far the map can grow.
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
					auto-clickers, and clicks on menus or buttons do not pay. Fight clicks have no such limit (see Monsters &amp; Fighting).
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
					{CASTLE_UPGRADE.xpBonus} XP/s per level above 1. The violet area around it is the castle&apos;s range: 3x3 at first, growing by a
						tile on every side with each level from {CASTLE_RANGE.growFromLevel} (9x9 at level {CASTLE_UPGRADE.maxLevel}); from level{' '}
						{CASTLE_FORTRESS.fromLevel} walls surround the inner 3x3 and no monsters or chests appear there. If you lose the castle while
						exploring, an arrow at the edge of the screen points to it and <b>Back to castle</b> brings you home. Once the castle is at its maximum level, clicking it opens the Legacy
					window, where you can rebirth.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Monsters &amp; Fighting</h3>
				<p className='text-[#d8c8a0] mb-2'>
					Once you own {COMBAT.spawn.minOwnedTiles} tiles, a <b>rat</b> appears on one of them after{' '}
					{formatTime(COMBAT.spawn.firstSec)}, then another every {formatTime(COMBAT.spawn.intervalSec)} (up to{' '}
					{COMBAT.maxMonsters} on the map). A rat grows a tier every {formatTime(COMBAT.tierIntervalSec)} on the map (up to tier{' '}
					{COMBAT.maxTier}): more HP ({MONSTERS.rat.hp} at tier 1, x{MONSTERS.rat.hpGrowth} per tier), harder hits and better rewards. A tier-{COMBAT.maxTier} rat
					can grow into the <b>Rat King</b> ({pct(MONSTERS.ratKing.evolveChance)} every {formatTime(MONSTERS.ratKing.evolveCheckSec)}; only one at a time).
					Click a monster to fight it. Right-click it for <b>Dismiss</b>: after a confirmation the monster is removed from the map with
					no reward, which frees a place when one is too strong for you and the map is full.
				</p>
				<ul className='list-disc pl-5 text-[#d8c8a0] text-xs space-y-1'>
					<li>
						Every click in the fight hits for your gear&apos;s Damage. <b>There is no click-speed limit</b> in fights: fast clicking is a
						skill (only real clicks count). A click can <b>crit</b> (x{COMBAT.crit.mult}) with your Crit chance - Dexterity and Charisma
						plus gear - and a crit can become a <b>super crit</b> (x{COMBAT.crit.superMult}) with {COMBAT.crit.superBase}% plus the gear&apos;s Super Crit.
					</li>
					<li>
						The monster hits back on a timer; Armor reduces every hit (armor / (armor + {COMBAT.armorK})). Your HP is about{' '}
						{COMBAT.baseHp + 16} at the start, regenerates {COMBAT.regenPerSec} HP/s outside fights (gear Regen adds to that and also heals in
						fights) and at 0 you are knocked out with {pct(COMBAT.knockoutHpFraction)} HP back; nothing is lost. Fleeing resets the monster.
					</li>
					<li>
						Potions (hotkeys 1-3 in a fight, a shared {COMBAT.potionCooldownSec}s cooldown) heal 35 or 90 HP and work outside fights too.
					</li>
					<li>
						Winning pays gold and XP worth some seconds of your income, plus a chance of gear and potions. Rats drop wood, cloth and, from
						older rats, steel and obsidian gear. The <b>Rat King</b> ({MONSTERS.ratKing.hp} HP, a {MONSTERS.ratKing.timeLimitSec}s time limit) is hard: he needs real
						gear and quick clicking. He always drops a piece of the epic Rattatui set (the only place to get it), sometimes a second one or a legendary weapon, and potions.
					</li>
				</ul>
			</section>

			<section>
				<h3 className='px-h'>Gear &amp; Items</h3>
				<p className='text-[#d8c8a0] mb-2'>
					The Character window has 13 gear slots (head, shoulder, chest, hands, legs, feet, neck, cape, two rings, charm, weapon, shield)
					and a 36-slot bag. Double-click a bag item to equip it (or drink a potion); right-click it for Equip / Drink, Sell one and{' '}
					<b>Discard</b> (destroys it for good, after a confirmation, no gold). Click gear to take it off, drag to
					rearrange. Gear cannot be changed during a fight. Items give Damage (weapons), Armor, Max HP, Crit, Super Crit, HP Regen and Luck;
					hover for a tooltip.
				</p>
				<div className='flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs'>
					{RARITY_ORDER.map((r) => (
						<span key={r} style={{ color: RARITIES[r].color }}>
							{RARITIES[r].label}
						</span>
					))}
				</div>
				<ul className='list-disc pl-5 text-[#d8c8a0] text-xs space-y-1'>
					<li>
						<b>Sets</b>: wear several pieces of one set for bonuses (both rings count):{' '}
						{Object.values(SETS).map((set) => `${set.label} (${Object.keys(set.bonuses).join(' / ')} pieces)`).join(', ')}.
					</li>
					<li>
						Wood and leather (common) and Apprentice cloth (common, more HP, regen and luck) drop from rats and chests; Knight&apos;s steel
						(uncommon) comes from older rats and chests, and the merchant sells some pieces; Obsidian (rare) needs tier-5 rats or a good
						chest; the Rattatui set (epic) is the Rat King&apos;s; legendary weapons are very rare finds.
					</li>
					<li>
						Weapons come in many types - swords, maces, mauls, axes, daggers, spears, bows, crossbows, staves and wands. Maces and mauls hit
						hardest, bows and daggers crit more, staves and wands trade damage for regen and luck.
					</li>
					<li>Chests, rats and the Rat King drop items; the merchant buys spare gear for gold.</li>
				</ul>
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
					While the Farm tab of the Menu is open, a critter wanders by now and then: click it for a gift worth about{' '}
					{FARM_BONUS.critters.butterfly.seconds} seconds of that resource&apos;s income.
				</p>
			</section>

			<section>
				<h3 className='px-h'>Merchant</h3>
				<p className='text-[#d8c8a0] mb-2'>
					Sell resources, farm products and spare gear from your bag for gold; buying resources costs{' '}
					{MERCHANT_BUY_MULTIPLIER}x the selling price, so trading back and forth never gains anything. Buy Goods has
					click power, permanent bonuses (Haggler, Bulk Discount, Lucky Charm, Pack Rat), potions and some leather and steel gear.
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
					XP comes from time (more with the castle and some buildings) and from every tile you buy.
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
					<li>Right-click tiles to build: early buildings are cheap, so put the first few where neighbours already boost the tile.</li>
					<li>Wear a full set for its bonus, and keep a few potions for the Rat King.</li>
				</ul>
			</section>
		</div>
	);
};

export default Tutorial;
