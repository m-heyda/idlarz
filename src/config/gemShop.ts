// The gem shop's price book (IDL-189, IDL-190, IDL-194). A leaf module: pure data and two tiny helpers, imported by the server (`lib/offline/gemShop.ts`) and the shop window alike.
import { CASTLE_SKINS, CASTLE_SKIN_PRICE, castleSkinItemId } from '@/config/castleSkins';

/** The tabs of the Gem shop window: services (identity), leveled upgrades and one-time purchases. A tab with no item shows a "coming soon" note. */
export type GemShopTab = 'identity' | 'upgrades' | 'once';

/** How an item is sold: a `service` can be bought again and again, a `leveled` upgrade has levels (each costs more), a `once` purchase is bought one time and kept. Today every item is a service. */
export type GemItemKind = 'service' | 'leveled' | 'once';

export type GemItemId =
	| 'class_change'
	| 'name_change'
	| 'attr_respec'
	| 'name_colors'
	| 'name_rainbow'
	| 'name_aurora'
	| 'name_ember'
	| 'name_frost'
	| 'name_void'
	| 'name_galaxy'
	| 'builder_2'
	| 'master_workbench'
	| 'overnight_orders'
	| 'bulk_discount'
	| 'building_slot'
	| `castle_skin_${number}`;

export interface GemItem {
	id: GemItemId;
	tab: GemShopTab;
	/** Defaults to `service` */
	kind?: GemItemKind;
	/** The Cosmetics tab groups its items: nicknames (the default) or castle skins */
	category?: 'nicknames' | 'skins';
	name: string;
	/** One line: what the player gets. */
	blurb: string;
	/** Gems charged per purchase (for an item with `tiers`: the price of the first level). */
	price: number;
	/** A `once` item bought in levels (Additional builder): the price of each level, in order; the purchase count in `bought` is the level. Absent: one purchase. */
	tiers?: readonly number[];
	/** Seconds that must pass between two purchases of this item (0 = none). */
	cooldownSec: number;
}

/** One day on the server clock: the unit of the daily bonus and of the name-change cooldown. */
export const DAY_SEC = 86_400;

/**
 * The gem shop's price book: what each service costs and how often it can be bought.
 *
 * - **Class change** (500): never during a fight; writes the profile's class (server only); the passives of the new class apply at once. An avatar that does not fit the new class is swapped for its starter.
 * - **Name change** (200): once per 30 days, counted on the profile (it survives a game reset); a name another account holds, or one that breaks the name rules, is refused and costs nothing.
 * - **Attribute respec** (300): gives back every attribute point outside a rebirth (a rebirth does it free). **The first respec of an account is free** (a mistake with the new server-held allocation is forgiven once).
 *
 * - **Name colours** (750, once; lowered from 1000 so no single item takes the whole 1,000-gem start purse, IDL-229): unlocks the nickname colour picker (twelve colours, `config/nickColors.ts`) for the account for good; an admin account has it without buying. Bought once, a second purchase is refused and costs nothing.
 *
 * - **Name effects** (500 each, once; One-time tab): Rainbow, Aurora, Ember, Frost, Void and Galaxy, the animated nicknames (`NICK_EFFECTS`). Each is its own purchase, separate from the plain colours; they are also bought from the name window.
 *
 * - **Additional builder** (id `builder_2`, three levels of 2,000 / 6,000 / 12,000 = 20,000 gems; Upgrades tab): each level is one more builder, so up to three more castle or building upgrades run at once (`builderCount`). Permanent, kept over a rebirth; the purchase count in the ledger is the level and the server's save check allows that many timers. An account that bought the old one-time Builder #2 owns level 1.
 *
 * - **Castle skins** (2,500 each, once; Cosmetics tab, Skins): `CASTLE_SKINS`, a premium castle picture drawn in place of the level castle once bought and picked. Cosmetic only; each is its own purchase and the ledger's `bought` record is the ownership.
 *
 * - **Overnight Orders** (750, once): lowered from 1000 for the same reason as Name colours. No single item may cost 80 % or more of the start purse (`gemSim` check `purse-day1`).
 *
 * Nothing here is a ladder: the later shop tabs (limits, time, gear, cosmetics) are IDL-191..193 and appear when they have items.
 *
 * @category Economy/Gems
 * @order 1
 */
export const GEM_SHOP: readonly GemItem[] = [
	{
		id: 'class_change',
		tab: 'identity',
		name: 'Change class',
		blurb: 'Take another hero class and its passives. Not during a fight.',
		price: 500,
		cooldownSec: 0,
	},
	{ id: 'name_change', tab: 'identity', name: 'Change name', blurb: 'Pick a new hero name. Once every 30 days.', price: 200, cooldownSec: 30 * DAY_SEC },
	{
		id: 'attr_respec',
		tab: 'identity',
		name: 'Respec attributes',
		blurb: 'Get every attribute point back to spend again. The first one is free.',
		price: 300,
		cooldownSec: 0,
	},
	{
		id: 'name_colors',
		tab: 'identity',
		kind: 'once',
		name: 'Name colours',
		blurb: 'Unlock the colour picker: fourteen colours for your nickname in the game, the landing page and the rankings.',
		price: 750,
		cooldownSec: 0,
	},
	{
		id: 'name_rainbow',
		tab: 'once',
		kind: 'once',
		name: 'Rainbow name',
		blurb: 'An animated nickname that shifts slowly through every colour.',
		price: 500,
		cooldownSec: 0,
	},
	{
		id: 'name_aurora',
		tab: 'once',
		kind: 'once',
		name: 'Aurora name',
		blurb: 'An animated nickname like northern lights: green, blue and violet drifting.',
		price: 500,
		cooldownSec: 0,
	},
	{
		id: 'name_ember',
		tab: 'once',
		kind: 'once',
		name: 'Ember name',
		blurb: 'An animated nickname like a glowing coal, flickering from yellow to red.',
		price: 500,
		cooldownSec: 0,
	},
	{
		id: 'name_frost',
		tab: 'once',
		kind: 'once',
		name: 'Frost name',
		blurb: 'An animated icy nickname with a glint that sweeps across it.',
		price: 500,
		cooldownSec: 0,
	},
	{
		id: 'name_void',
		tab: 'once',
		kind: 'once',
		name: 'Void name',
		blurb: 'A pale violet nickname that breathes out a dark purple glow.',
		price: 500,
		cooldownSec: 0,
	},
	{
		id: 'name_galaxy',
		tab: 'once',
		kind: 'once',
		name: 'Galaxy name',
		blurb: 'An animated nickname with a starry purple and blue sky drifting inside the letters.',
		price: 500,
		cooldownSec: 0,
	},
	...CASTLE_SKINS.map(
		(skin): GemItem => ({
			id: castleSkinItemId(skin.n),
			tab: 'once',
			kind: 'once',
			category: 'skins',
			name: skin.name,
			blurb: 'A castle skin.',
			price: CASTLE_SKIN_PRICE,
			cooldownSec: 0,
		}),
	),
	{
		id: 'builder_2',
		tab: 'upgrades',
		kind: 'once',
		name: 'Additional builder',
		blurb: 'One more builder: another castle or building upgrade can run at the same time. Three levels, each dearer. Permanent, it survives a rebirth.',
		price: 2000,
		tiers: [2000, 6000, 12000],
		cooldownSec: 0,
	},
	{
		id: 'master_workbench',
		tab: 'upgrades',
		kind: 'once',
		name: 'Master Workbench',
		blurb: 'Crafting batches finish 50% faster. Permanent, it survives a rebirth.',
		price: 1500,
		cooldownSec: 0,
	},
	{
		id: 'overnight_orders',
		tab: 'upgrades',
		kind: 'once',
		name: 'Overnight Orders',
		blurb: 'A crafting batch may run 24 hours longer without a claim. Permanent, it survives a rebirth.',
		price: 750,
		cooldownSec: 0,
	},
	{
		id: 'building_slot',
		tab: 'upgrades',
		kind: 'once',
		name: 'Building Slot',
		blurb: 'Build one more copy of every Producer and Extractor on the map. Permanent, it survives a rebirth.',
		price: 6000,
		cooldownSec: 0,
	},
	{
		id: 'bulk_discount',
		tab: 'upgrades',
		kind: 'once',
		name: 'Bulk Discount',
		blurb: 'Every craft takes 10% fewer resources. Permanent, it survives a rebirth.',
		price: 1500,
		cooldownSec: 0,
	},
];

/** The id of the Builder #2 purchase (`ledger.gemShop.bought`). */
export const BUILDER_ITEM: GemItemId = 'builder_2';

/** The most builders the Gem shop adds: one per level of the Additional builder. */
export const GEM_BUILDERS_MAX = 3;

/** Builders the Gem shop gave an account: the level of the Additional builder in `bought`, 0 to 3 (the server's ledger is the record; the game mirrors it as `gemBuilders`). */
export const gemBuildersOf = (bought: Record<string, number> | undefined): number =>
	Math.min(GEM_BUILDERS_MAX, Math.max(0, Math.floor(bought?.[BUILDER_ITEM] ?? 0)));

/** How many times an item has been bought (its level, for one with `tiers`). */
export const gemLevelOf = (item: GemItem, bought: Record<string, number> | undefined): number => Math.max(0, Math.floor(bought?.[item.id] ?? 0));

/** True when nothing more of a `once` item can be bought: owned, or every level of a tiered one. */
export const gemMaxedOf = (item: GemItem, bought: Record<string, number> | undefined): boolean =>
	item.kind === 'once' && gemLevelOf(item, bought) >= (item.tiers?.length ?? 1);

/** What the next purchase of an item costs: the price of its next level for a tiered item, else its price. */
export const gemNextPrice = (item: GemItem, bought: Record<string, number> | undefined): number =>
	item.tiers ? item.tiers[Math.min(gemLevelOf(item, bought), item.tiers.length - 1)] : item.price;

/** What the Gem shop's crafting items give an account (the ledger's `bought` record is the truth; the game mirrors it as `gemCraft`): extra craft speed, extra hours a batch may run, and the share of the resources a craft saves. */
export interface GemCraft {
	speed: number;
	hours: number;
	discount: number;
	/** The Building Slot item: one more copy of every Producer and Extractor (0 or 1). It lives here with the other Gem shop items the game mirrors from the ledger. */
	slots: number;
}
export const NO_GEM_CRAFT: GemCraft = { speed: 0, hours: 0, discount: 0, slots: 0 };

/**
 * The crafting bonuses of the Gem shop's one-time items: Master Workbench +0.5 craft speed, Overnight Orders +24 hours of batch run, Bulk Discount -10% resources (read by `limitOf` and `craftCostFactor`).
 *
 * @category Economy/Gems
 * @order 3
 */
export const gemCraftOf = (bought: Record<string, number> | undefined): GemCraft => ({
	speed: (bought?.master_workbench ?? 0) > 0 ? 0.5 : 0,
	hours: (bought?.overnight_orders ?? 0) > 0 ? 24 : 0,
	discount: (bought?.bulk_discount ?? 0) > 0 ? 0.1 : 0,
	slots: (bought?.building_slot ?? 0) > 0 ? 1 : 0,
});

/** A purchase above this many gems asks for a confirmation in the shop window. */
export const GEM_CONFIRM_ABOVE = 300;

/**
 * The daily first-login bonus: gems per day of the streak. A claim is once per **UTC day** (the server clock); claiming on the day after the last claim moves one step up the ladder, missing a day starts again at day 1, and after day 7 it starts again at day 1.
 *
 * @category Economy/Gems
 * @order 2
 */
export const DAILY_BONUS_GEMS: readonly number[] = [20, 25, 30, 35, 40, 45, 50];

/**
 * The treasure chest of the last day (day 7) of the daily bonus, on top of its gems: `count` kinds of material picked at random from `resources`, each worth `minutes` of the player's own income of that kind (a random number in the range, so it grows with the kingdom),
 * never less than `floor`. It is rolled by the server when day 7 is claimed ({@link rollDailyChest}), from a sealed random number, and recorded as granted like any chest.
 *
 * @category Economy/Gems
 * @order 3
 */
export const DAILY_CHEST = {
	resources: ['gold', 'wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide', 'wool'] as const,
	count: [3, 5] as [number, number],
	minutes: [30, 90] as [number, number],
	floor: 500,
};

export type DailyChestResource = (typeof DAILY_CHEST.resources)[number];

export const gemItemById = (id: unknown): GemItem | null => GEM_SHOP.find((item) => item.id === id) ?? null;
