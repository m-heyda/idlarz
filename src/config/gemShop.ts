// The gem shop's price book (IDL-189, IDL-190, IDL-194). A leaf module: pure data and two tiny helpers, imported by the server (`lib/offline/gemShop.ts`) and the shop window alike.

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
	| 'name_void';

export interface GemItem {
	id: GemItemId;
	tab: GemShopTab;
	/** Defaults to `service` */
	kind?: GemItemKind;
	name: string;
	/** One line: what the player gets. */
	blurb: string;
	/** Gems charged per purchase. */
	price: number;
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
 * - **Name colours** (1000, once): unlocks the nickname colour picker (twelve colours, `config/nickColors.ts`) for the account for good; an admin account has it without buying. Bought once, a second purchase is refused and costs nothing.
 *
 * - **Name effects** (500 each, once; One-time tab): Rainbow, Aurora, Ember, Frost and Void, the animated nicknames (`NICK_EFFECTS`). Each is its own purchase, separate from the plain colours; they are also bought from the name window.
 *
 * Nothing here is a ladder: the later shop tabs (limits, time, gear, cosmetics) are IDL-191..193 and appear when they have items.
 *
 * @category Economy/Gems
 * @order 1
 * @table gem-price-book
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
		price: 1000,
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
];

/** A purchase above this many gems asks for a confirmation in the shop window. */
export const GEM_CONFIRM_ABOVE = 300;

/**
 * The daily first-login bonus: gems per day of the streak. A claim is once per **UTC day** (the server clock); claiming on the day after the last claim moves one step up the ladder, missing a day starts again at day 1, and after day 7 it starts again at day 1.
 *
 * @category Economy/Gems
 * @order 2
 * @table gem-daily-ladder
 */
export const DAILY_BONUS_GEMS: readonly number[] = [20, 25, 30, 35, 40, 45, 50];

export const gemItemById = (id: unknown): GemItem | null => GEM_SHOP.find((item) => item.id === id) ?? null;
