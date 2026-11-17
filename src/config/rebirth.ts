// Rebirth and the Ember shop.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { Resources } from '@/types/game';

// Rebirth: restart with a permanent bonus paid in Embers. Available once the castle reaches `minCastleLevel`.
/**
 * Rebirth: restart with a permanent bonus paid in Embers. The rules live in `REBIRTH` and are checked by {@link rebirthStatus}, the one function the button, the dialog, the store and the server share.
 *
 * - **Requirements**: castle level >= 6 (`minCastleLevel`), economy tile count >= `400 + 50 x rebirths already done` (`minTiles`, `tilesPerRebirth`), no castle upgrade running, and at least 1 Ember of gain.
 * - **Embers gained**: see {@link emberGain}. **Income bonus**: see {@link emberIncomeBonus}.
 * - **What resets** (`rebirth` in `src/stores/game/rebirthSlice.ts`): map (new start ring), resources, castle, animals, buildings, chests, monsters and any open fight, click level, farm upgrades, all merchant upgrades except Pack Rat,
 *   the bag and worn gear (back to the starter kit; the Pack Rat bag size is kept) except the legendary pieces the player chooses to keep (`keepSlots`: rebirth N keeps up to min(N, 15), they land in the new bag), loot pity, attributes (all points are handed back to spend again), HP and mana refilled.
 * - **What is kept**: name, class, play time, gems, all Embers and shop levels, lifetime XP and level, the auto-sell setting, the merchant's shelf with its rotation clock and the refresh count (a rebirth is no free reshuffle).
 * - The server runs the rebirth first (`POST /api/rebirth`): it checks the stored save, wipes the ledger's inventory to the starter kit and pays at most its own computed gain; the browser takes the lower number.
 * - Auto-battle unlocks after the first rebirth (`COMBAT.auto.minRebirths`).
 *
 * @category Progression/Rebirth
 * @order 1
 * @see rebirthStatus, emberGain
 * @knownissue IDL-223 the gear wipe on rebirth is live without a crafting sink (RELEASE-PLAN P11); needs an owner decision.
 */
export const REBIRTH = {
	minCastleLevel: 6,
	minTiles: 400, // the first rebirth also needs this much territory (300+ tiles come before castle level 6, so it has to be more than that)
	tilesPerRebirth: 50, // every rebirth done so far raises the territory the next one needs by this much (was 25: the medium-map decision, IDL-181)
	tileExponent: 0.65, // the tile term of the Embers is (tiles / 10) ^ tileExponent: more territory pays clearly more than the old square root (0.5)
	surplusPerTile: 0.03, // every tile above the requirement adds this to the tile term of the Embers (times the castle term)
	castleExponent: 1.3, // the castle term is (castle level - 5) ^ castleExponent: castle 10 pays about 1.6 x what a linear term did (IDL-183, decision IDL-132)
	gainScale: 3, // Embers = gainScale x (castle level - 5) ^ castleExponent x ((tiles / 10) ^ tileExponent + surplusPerTile x tiles over the requirement), rounded down
	/** Tiles the next rebirth needs, after `rebirths` of them */
	tilesNeeded: (rebirths: number) => REBIRTH.minTiles + REBIRTH.tilesPerRebirth * Math.max(0, rebirths),
	// income bonus = incomePerPoint x (Embers ever earned) ^ incomeExponent (spending points never lowers it). It was linear, +6 % per Ember,
	// which made the first rebirth worth about +130-200 % and every later one snowball. Now about +77 % after 22 Embers, +120 % after 47,
	// +160 % after 76, +264 % after 170 (a +20 % raise of the old curve; tests/economy/rebirth.test.ts pins it)
	incomePerPoint: 0.12,
	incomeExponent: 0.6,
	keepSlotsMax: 15, // the most legendary pieces one rebirth can carry over (rebirth number N keeps min(N, this); see lib/rebirthKeep.ts)
	discountCapPercent: 45, // Charisma + Thrift together can never take more than this off a tile
	// Embers granted for a rebirth with this castle level and territory
	gain: (castleLevel: number, tiles: number, rebirths = 0) => {
		const surplus = Math.max(0, tiles - REBIRTH.tilesNeeded(rebirths));
		return Math.floor(
			REBIRTH.gainScale *
				Math.pow(Math.max(0, castleLevel - 5), REBIRTH.castleExponent) *
				(Math.pow(Math.max(0, tiles) / 10, REBIRTH.tileExponent) + REBIRTH.surplusPerTile * surplus),
		);
	},
};

// The Ember shop: permanent upgrades bought with unspent Embers. The N+1-th level costs
// ceil(baseCost x costGrowth^N) points.
/**
 * The Ember shop: level N+1 costs `ceil(baseCost x costGrowth^N)` Embers ({@link emberUpgradeCost}). Shop levels are permanent: nothing refunds Embers on a rebirth.
 * The save is valid only if `unspent + spent = earned` and `rebirths = 0` implies `earned = 0` (checked in `src/lib/sanitizeSave.ts`).
 *
 * - **Permanent twins of the merchant's gold upgrades** (about 3 x the step, kept through every rebirth): Master Haggler, Fortune, Overseer, Master Skinner, Click Mastery, the seven battle upgrades and Eternal Tithe (+50% Embers per level, 5 levels).
 * - **Caps**: Treasury Charter (+5 points on the 45% tile-discount cap per level), Castle Expansion (castle level 10 to 15), Master Masonry (building level 5 to 10) and Idol Mastery (Idol level 5 up to 15, priced as an end-game goal). They read through `limitOf` (`castleMaxLevel`, `buildingMaxLevel`, `idolMaxLevel`).
 * - **Build time**: Master Builders (castle), Mason's Guild (buildings) and Shrine Keepers (Idols), each -5% per level; together with the Dwarf Statue the cut never passes 60%.
 * - **One-time purchases** (one level): Potion Reflex (auto-potion, was a free unlock after the first rebirth; players who already rebirthed keep it), Eternal Vigil (away income 100% and 72 h away time) and Imperial Decree (the castle bonus counts double).
 * - **Start of a run**: Starting Treasury (base gold per second at the start of every run: 1, 5, 10, 20, 35) and Provisions (a starting bundle per level).
 * - **Disabled** (`EMBER_DISABLED`): Quest Rarity and Quest Slots wait for the quest system; they show greyed and cannot be bought.
 * Thrift shares the tile-discount cap with Charisma and Bulk Discount; buildings take Thrift only.
 *
 * @category Progression/Ember shop
 * @order 1
 * @table ember-shop
 */
export const EMBER_UPGRADES = {
	thrift: {
		label: 'Thrift',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 0.02, // -2% tile and building cost per level
	},
	charter: {
		label: 'Treasury Charter',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 5, // +5 points on the tile-discount cap per level (base 45%), so Charisma, Thrift and Bulk Discount are never wasted
	},
	builders: {
		label: 'Master Builders',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // -5% castle build time per level
	},
	buildtime: {
		label: "Mason's Guild",
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // -5% build time of Producers and Extractors per level
	},
	idoltime: {
		label: 'Shrine Keepers',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // -5% build time of Idols per level
	},
	mastery: {
		label: 'Click Mastery',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 0.5, // +50% gold per click per level (merchant Click Power is the cheaper, weaker twin)
	},
	startgold: {
		label: 'Starting Treasury',
		maxLevel: 5,
		baseCost: 6,
		costGrowth: 1.9,
		effectPerLevel: 1, // the level picks a step: base gold per second at the start of every run, see `steps`
		steps: [0, 1, 5, 10, 20, 35] as readonly number[], // gold per second by level (index = level); it replaces the 0.1 base and every multiplier counts from there
	},
	provisions: {
		label: 'Provisions',
		maxLevel: 15,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 1, // levels of the starting bundle below
		bundle: { gold: 1500, wood: 400, stone: 400, food: 200, coal: 100 } as Partial<Resources>, // per level, given at the start of every run
	},
	nightwatch: {
		label: 'Night Watch',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 1, // +1 hour of away time the kingdom works for you, per level (base: LIMITS.offlineCapHours)
	},
	steward: {
		label: 'Steward',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // +5% of the normal income while you are away, per level (base: LIMITS.offlineEfficiency)
	},
	vigil: {
		label: 'Eternal Vigil',
		maxLevel: 1,
		baseCost: 120,
		costGrowth: 1,
		effectPerLevel: 1, // one-time: away income 100% and the away time up to the hard limit (72 h)
	},
	deeppockets: {
		label: 'Deep Pockets',
		maxLevel: 5,
		baseCost: 30,
		costGrowth: 1.8, // 30 / 54 / 98 / 175 / 315 Embers
		effectPerLevel: 8, // +8 bag slots per level (base: LIMITS.bagSize), kept through every rebirth
	},
	haggler: {
		label: 'Master Haggler',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.1, // +10% gold from everything you sell, per level (merchant Haggler: +3%)
	},
	fortune: {
		label: 'Fortune',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 6, // +6 Luck per level (merchant Lucky Charm: +2)
	},
	artisan: {
		label: "Artisan's Eye",
		maxLevel: 10,
		baseCost: 4,
		costGrowth: 1.4,
		effectPerLevel: 3, // +3 Luck on crafted gear only (a better chance of the higher rarities), per level
	},
	overseer: {
		label: 'Overseer',
		maxLevel: 10,
		baseCost: 4,
		costGrowth: 1.4,
		effectPerLevel: 0.03, // +3% income from every resource but XP per level (merchant Foreman: +1%)
	},
	skinner: {
		label: 'Master Skinner',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.15, // +15% meat and hide from the animals per level (merchant Skinner: +5%)
	},
	tithe: {
		label: 'Eternal Tithe',
		maxLevel: 5,
		baseCost: 5,
		costGrowth: 2, // 5 / 10 / 20 / 40 / 80 Embers
		effectPerLevel: 0.5, // +50% Embers from every rebirth per level (merchant Ancestral Tithe: +5%)
	},
	tempo: {
		label: 'Battle Tempo',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 3, // +3% attack speed per level
	},
	precision: {
		label: 'Precision',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 1.5, // +1.5 points of crit chance per level (COMBAT.crit.maxCritChance still caps it)
	},
	execution: {
		label: 'Execution',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 1.5, // +1.5 points of super-crit chance per level (COMBAT.crit.maxSuperChance still caps it)
	},
	brawn: {
		label: 'Brawn',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 4, // +4% damage with physical weapons per level
	},
	sorcery: {
		label: 'Sorcery',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 4, // +4% damage with staves and wands per level
	},
	bloodthirst: {
		label: 'Bloodthirst',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.75, // +0.75% life leech per level (STAT_RULES.lifeLeechCap still caps the total)
	},
	vigor: {
		label: 'Vigor',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.5, // +0.5 HP regenerated per second per level
	},
	potion: {
		label: 'Potion Reflex',
		maxLevel: 1,
		baseCost: 15,
		costGrowth: 1,
		effectPerLevel: 1, // one-time: the hero drinks potions on their own in fights (auto-potion); saves with a rebirth already done have it
	},
	castlecap: {
		label: 'Castle Expansion',
		maxLevel: 5,
		baseCost: 60,
		costGrowth: 2.2, // 60 / 132 / 290 / 639 / 1405 Embers
		effectPerLevel: 1, // +1 castle level of cap per level (10 up to 15)
	},
	buildcap: {
		label: 'Master Masonry',
		maxLevel: 5,
		baseCost: 40,
		costGrowth: 2.2,
		effectPerLevel: 1, // +1 level of cap for Producers and Extractors per level (5 up to 10); the castle level still gates each level
	},
	idolcap: {
		label: 'Idol Mastery',
		maxLevel: 10,
		baseCost: 100,
		costGrowth: 2.5, // the end-game goal: 100 Embers for the first level, about 380,000 for the last
		effectPerLevel: 1, // +1 Idol level of cap per level (5 up to 15)
	},
	decree: {
		label: 'Imperial Decree',
		maxLevel: 1,
		baseCost: 150,
		costGrowth: 1,
		effectPerLevel: 1, // one-time: the castle bonus counts double
	},
	extrabuilder: {
		label: 'Extra Builder',
		maxLevel: 2,
		baseCost: 40,
		costGrowth: 3,
		effectPerLevel: 1, // +1 builder per level (the gem shop sells the second one)
	},
	questrarity: {
		label: 'Quest Rarity',
		maxLevel: 10,
		baseCost: 5,
		costGrowth: 1.4,
		effectPerLevel: 2, // disabled until quests exist: a better chance of a higher quest rarity, per level
	},
	questslots: {
		label: 'Quest Slots',
		maxLevel: 5,
		baseCost: 25,
		costGrowth: 2,
		effectPerLevel: 1, // disabled until quests exist: +1 active quest per level
	},
} as const;

/**
 * Shop upgrades that cannot be bought yet: the two quest upgrades (the quest system is not built) and Extra Builder (until the second builder exists in the game; the gem shop sells it first). Shown greyed, refused by `buyEmberUpgrade`, and
 * `emberEffect` counts them as 0.
 */
export const EMBER_DISABLED: ReadonlySet<string> = new Set(['questrarity', 'questslots']);

/** The generation of the Ember shop. New accounts start at it; an account from before the rework has none until the shop migration moves it (refunds its Embers and grants what it had for free). */
export const SHOP_VERSION = 2;

export type EmberUpgradeId = keyof typeof EMBER_UPGRADES;
