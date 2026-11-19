import type { AchievementDef, DeedDef } from './achievements';
import { createDeedBuilder, ROMAN } from './deedBuilder';

// Deeds batch 4 (IDL-321): lifetime income of every resource, crafting, gear, Embers, lost fights, the podium of the Rankings and a handful of secret ones (a window dragged to its smallest, the map at its largest zoom, ...).
// Every id is new and appended after the earlier batches (never reordered). Points are placeholders for the balance pass (IDL-310), gems follow the tier position; badges are stand-ins (`badgePlaceholder`) until the art exists.

const { out, deed } = createDeedBuilder();

const n = (value: number): string => value.toLocaleString('en-US');
const pts = (i: number, base = 10, step = 20): number => base + i * step;

/** A ladder over one condition: `goals` ascending, the id is `<prefix>_<goal>`, the sentence and the condition come from the callbacks. */
const ladder = (
	prefix: string,
	goals: readonly number[],
	when: (min: number) => AchievementDef['when'],
	text: (min: number) => string,
	base = 10,
	step = 20,
	title?: { id: string; name: string },
) =>
	goals.map((min, i) => ({
		suffix: ROMAN[i],
		id: `${prefix}_${min}`,
		when: when(min),
		text: text(min),
		points: pts(i, base, step),
		...(title && i === goals.length - 1 ? { title } : {}),
	}));

// ---- Economy: lifetime income of gold and of every resource the land and the farm give (counted while you play)
deed(
	'income_gold',
	'Gold rush',
	'Earn gold while you play.',
	'economy',
	['gold', 'income'],
	'chest_bronze',
	'The coin does not sleep, and neither do you.',
	'Gold your kingdom earns while you are playing counts, over every rebirth.',
	ladder(
		'income_gold',
		[100_000, 10_000_000, 1_000_000_000, 100_000_000_000, 10_000_000_000_000],
		(min) => ({ kind: 'income', resource: 'gold', min }),
		(min) => `Earn ${n(min)} gold while playing.`,
		10,
		20,
		{
			id: 'gold-baron',
			name: 'Gold Baron',
		},
	),
);

const BASE_RESOURCES: [string, string, string, string, string][] = [
	['wood', 'Woodcutter', 'Timber!', 'Wood', 'hammer_bronze'],
	['stone', 'Quarryman', 'Everything is a rock if you look at it long enough.', 'Stone', 'tower_silver'],
	['coal', 'Coal baron', 'Black gold, and plenty of it.', 'Coal', 'shield_silver'],
	['food', 'Harvest king', 'Nobody starves on your watch.', 'Food', 'potion_bronze'],
	['meat', 'Butcher', 'Waste nothing, remember everything.', 'Meat', 'sword_silver'],
];
for (const [key, title, lore, label, art] of BASE_RESOURCES)
	deed(
		`income_${key}`,
		title,
		`Collect ${label.toLowerCase()} while you play.`,
		'economy',
		['income', 'materials'],
		art,
		lore,
		`${label} your land and farm produce while you are playing counts, over every rebirth.`,
		ladder(
			`income_${key}`,
			[10_000, 1_000_000, 100_000_000, 10_000_000_000, 1_000_000_000_000],
			(min) => ({ kind: 'income', resource: key, min }),
			(min) => `Collect ${n(min)} ${label.toLowerCase()} while playing.`,
			5,
			15,
		),
	);

const FARM_GOODS: [string, string, string, string][] = [
	['eggs', 'Egg collector', 'Do not count them before they hatch. Do count them after.', 'Eggs'],
	['milk', 'Dairy baron', 'A cow, a bucket and a dream.', 'Milk'],
	['hide', 'Tanner', 'Leather has a way of finding a use.', 'Hide'],
	['wool', 'Shearer', 'The sheep were consulted. They did not mind.', 'Wool'],
];
for (const [key, title, lore, label] of FARM_GOODS)
	deed(
		`income_${key}`,
		title,
		`Collect ${label.toLowerCase()} while you play.`,
		'farm',
		['income', 'farm'],
		'star_silver',
		lore,
		`${label} your farm produces while you are playing counts, over every rebirth.`,
		ladder(
			`income_${key}`,
			[1_000, 100_000, 10_000_000, 1_000_000_000],
			(min) => ({ kind: 'income', resource: key, min }),
			(min) => `Collect ${n(min)} ${label.toLowerCase()} while playing.`,
			5,
			15,
		),
	);

const EXTRACTS: [string, string, string, string][] = [
	['herbs', 'Herbalist', 'Some of it is medicine. Some of it is salad.', 'Herbs'],
	['sap', 'Sap tapper', 'Slow, sticky and surprisingly profitable.', 'Sap'],
	['ironOre', 'Prospector', 'There is iron in them hills.', 'Iron Ore'],
	['spores', 'Sporeling', 'Do not breathe in.', 'Spores'],
	['frostshard', 'Frost miner', 'Cold to the touch, warm to the purse.', 'Frostshards'],
	['pearls', 'Pearl diver', 'One in a million, a million times.', 'Pearls'],
	['salt', 'Salt of the earth', 'Take it with a pinch of itself.', 'Salt'],
];
for (const [key, title, lore, label] of EXTRACTS)
	deed(
		`income_${key}`,
		title,
		`Extract ${label.toLowerCase()} while you play.`,
		'economy',
		['income', 'extracts'],
		'star_bronze',
		lore,
		`${label} your extractors produce while you are playing counts, over every rebirth.`,
		ladder(
			`income_${key}`,
			[100, 10_000, 1_000_000, 100_000_000],
			(min) => ({ kind: 'income', resource: key, min }),
			(min) => `Extract ${n(min)} ${label.toLowerCase()} while playing.`,
			10,
			20,
		),
	);

// ---- Crafting
deed(
	'craft_level',
	'Crafting mastery',
	'Raise your crafting level.',
	'craft',
	['crafting', 'level'],
	'hammer_bronze',
	'Practice makes permanent. Perfect practice makes legends.',
	'Crafting gives crafting XP; the level counts as soon as you reach it.',
	ladder(
		'craft_level',
		[5, 10, 20, 35, 50, 65, 80],
		(min) => ({ kind: 'craftLevel', min }),
		(min) => `Reach crafting level ${min}.`,
		10,
		20,
		{ id: 'artisan', name: 'Artisan' },
	),
);
deed(
	'craft_epic',
	'Epic forger',
	'Craft epic gear.',
	'craft',
	['crafting', 'gear'],
	'hammer_bronze',
	'Purple is the colour of effort.',
	'Gear you craft yourself that comes out epic or better counts.',
	ladder(
		'craft_epic',
		[1, 10, 50, 250],
		(min) => ({ kind: 'craftedRarity', rarity: 'epic', min }),
		(min) => `Craft ${n(min)} epic or better ${min === 1 ? 'piece' : 'pieces'} of gear.`,
		15,
		25,
	),
);
deed(
	'craft_legendary',
	'Legendary forger',
	'Craft legendary gear.',
	'craft',
	['crafting', 'gear'],
	'hammer_bronze',
	'The anvil remembers every strike.',
	'Gear you craft yourself that comes out legendary counts.',
	ladder(
		'craft_legendary',
		[1, 5, 25, 100],
		(min) => ({ kind: 'craftedRarity', rarity: 'legendary', min }),
		(min) => `Craft ${n(min)} legendary ${min === 1 ? 'piece' : 'pieces'} of gear.`,
		30,
		50,
		{
			id: 'legend-smith',
			name: 'Legend Smith',
		},
	),
);

// ---- Gear
deed(
	'worn_epic',
	'Epic wardrobe',
	'Wear epic gear.',
	'gear',
	['gear'],
	'shield_silver',
	'Dressed to be noticed.',
	'Count the pieces of epic or better gear you wear at the same time (of 14 slots).',
	ladder(
		'worn_epic',
		[1, 4, 8, 14],
		(min) => ({ kind: 'wornRarity', rarity: 'epic', min }),
		(min) => `Wear ${min} epic or better ${min === 1 ? 'piece' : 'pieces'} at once.`,
		10,
		20,
	),
);
deed(
	'worn_legendary',
	'Legendary wardrobe',
	'Wear legendary gear.',
	'gear',
	['gear'],
	'shield_silver',
	'Some of it is even comfortable.',
	'Count the pieces of legendary gear you wear at the same time (of 14 slots).',
	ladder(
		'worn_legendary',
		[1, 3, 7, 14],
		(min) => ({ kind: 'wornRarity', rarity: 'legendary', min }),
		(min) => `Wear ${min} legendary ${min === 1 ? 'piece' : 'pieces'} at once.`,
		20,
		40,
	),
);

// ---- Rebirth
deed(
	'embers_total',
	'Ember keeper',
	'Earn Embers over all your rebirths.',
	'rebirth',
	['embers', 'rebirth'],
	'first_rebirth_fire',
	'Every ending is a small fire for the next beginning.',
	'Every Ember you earn from a rebirth counts, spent or not.',
	ladder(
		'embers',
		[50, 500, 5_000, 50_000, 500_000, 5_000_000, 50_000_000],
		(min) => ({ kind: 'embers', min }),
		(min) => `Earn ${n(min)} Embers in total.`,
		10,
		20,
		{ id: 'ember-lord', name: 'Ember Lord' },
	),
);

// ---- Combat: lost fights
deed(
	'losses',
	'Sore loser',
	'Lose fights.',
	'combat',
	['kills', 'fun'],
	'skull_bronze',
	'Failure is only a lesson with a worse outcome.',
	'Every fight a monster wins against you counts. Do not take it personally.',
	ladder(
		'losses',
		[10, 50, 250, 1000],
		(min) => ({ kind: 'deaths', min }),
		(min) => `Lose ${n(min)} fights.`,
		10,
		20,
		{ id: 'sore-loser', name: 'Sore Loser' },
	),
);

// ---- Special: the podium of the Rankings (any board)
deed(
	'podium',
	'On the podium',
	'Reach the top three of a Ranking.',
	'special',
	['rankings'],
	'star_silver',
	'The crowd goes quiet for a moment, and then it does not.',
	'Hold third, second or first place on any Ranking board. The game notices when you look at the Rankings.',
	[
		{ suffix: 'Bronze', id: 'podium_3', when: { kind: 'curiosity', id: 'rank_3' }, text: 'Hold third place on any Ranking.', points: 100 },
		{ suffix: 'Silver', id: 'podium_2', when: { kind: 'curiosity', id: 'rank_2' }, text: 'Hold second place on any Ranking.', points: 200 },
		{
			suffix: 'Gold',
			id: 'podium_1',
			when: { kind: 'curiosity', id: 'rank_1' },
			text: 'Hold first place on any Ranking.',
			points: 400,
			title: { id: 'champion', name: 'Champion' },
		},
	],
);

// ---- Secrets: one-off events (the browser reports them, the server keeps a short allowlist)
const secret = (id: string, title: string, text: string, lore: string, how: string, event: string, points: number, art = 'star_silver') =>
	deed(id, title, text, 'fun', ['secret'], art, lore, how, [{ suffix: '', id: event, when: { kind: 'curiosity', id: event }, text, points }]);

secret(
	'are_you_insane',
	'Are you insane?',
	'Drag a window down to its smallest size.',
	'Some windows are meant to be small. Not that small.',
	'Resize any window by its corner until it cannot shrink.',
	'window_min',
	10,
);
secret(
	'nose_on_glass',
	'Nose on the glass',
	'Zoom the map in as far as it goes.',
	'Yes, those are individual pixels. Congratulations.',
	'Scroll the mouse wheel up over the map.',
	'map_zoom_max',
	10,
);
secret(
	'where_did_it_go',
	'Where did everything go?',
	'Zoom the map out as far as it goes.',
	'It is all still there. Probably.',
	'Scroll the mouse wheel down over the map.',
	'map_zoom_min',
	10,
);
secret(
	'boss_peek',
	'Not yet, big guy',
	'Peek into the World boss window.',
	'It is not ready for you. You are not ready for it.',
	'Open the Boss window from the dock.',
	'boss_window',
	15,
);
secret(
	'fashion_victim',
	'Fashion victim',
	'Put a skin on your castle.',
	'Stone is so last season.',
	'Buy a castle skin in the Gem shop and press Use.',
	'castle_skin',
	15,
);
secret(
	'window_shopper',
	'Window shopper',
	'Open every window in the dock in one visit.',
	'Just browsing. Thank you.',
	'Open Hero, Merchant, Farm, Bestiary, Gems, Deeds, Rankings, Rebirth and Boss without reloading the page.',
	'dock_shuffle',
	10,
);
secret(
	'night_owl',
	'Night owl',
	'Play between 3 and 4 AM.',
	'The monsters sleep. You, apparently, do not.',
	'Have the game open any time from 3:00 to 3:59 AM on your own clock.',
	'night_owl',
	10,
);
secret(
	'old_school',
	'Old school',
	'Enter a famous code.',
	'Up, up, down, down, and you know the rest.',
	'Type the classic cheat code on your keyboard while in the game: arrows, then B and A.',
	'konami',
	10,
);

// ---- Mining: rocks broken on the map (counted by the server when a rock's loot is paid)
deed(
	'rock_breaker',
	'Rock breaker',
	'Break rocks on the map.',
	'economy',
	['mining', 'rocks'],
	'hammer_bronze',
	'Every mountain is only a lot of small rocks.',
	'Every rock or ore you break on the map counts, of any kind, over every rebirth.',
	ladder(
		'rocks',
		[10, 100, 500, 2_500, 10_000],
		(min) => ({ kind: 'rocks', min }),
		(min) => `Break ${n(min)} ${min === 1 ? 'rock' : 'rocks'}.`,
		10,
		20,
		{ id: 'rock-breaker', name: 'Rock Breaker' },
	),
);
deed(
	'ore_hoarder',
	'Ore hoarder',
	'Break rich ores and crystals.',
	'economy',
	['mining', 'rocks'],
	'star_silver',
	'Shiny, heavy and worth the swing.',
	'Rocks of the Rich ore and Crystal kinds count.',
	ladder(
		'rocks_rich',
		[1, 10, 50, 250, 1_000],
		(min) => ({ kind: 'rocksTier', tier: 'rare', min }),
		(min) => `Break ${n(min)} rich ${min === 1 ? 'ore or crystal' : 'ores or crystals'}.`,
		10,
		20,
	),
);
deed(
	'silver_miner',
	'Silver miner',
	'Break silver ore or better.',
	'economy',
	['mining', 'rocks'],
	'tower_silver',
	'The pale ones ring when they fall.',
	'Rocks of the Silver ore kind and every better kind count.',
	ladder(
		'rocks_silver',
		[5, 25, 100, 500, 2_000],
		(min) => ({ kind: 'rocksTier', tier: 'uncommon', min }),
		(min) => `Break ${n(min)} silver ores or better.`,
		10,
		20,
	),
);
deed(
	'crystal_cracker',
	'Crystal cracker',
	'Break crystals.',
	'economy',
	['mining', 'rocks'],
	'star_silver',
	'Five hundred clicks, and it sings when it lets go.',
	'Crystal rocks and the legendary ore count.',
	ladder(
		'rocks_crystal',
		[1, 5, 25, 100, 500],
		(min) => ({ kind: 'rocksTier', tier: 'epic', min }),
		(min) => `Break ${n(min)} ${min === 1 ? 'crystal' : 'crystals'}.`,
		15,
		25,
		{ id: 'crystal-cracker', name: 'Crystal Cracker' },
	),
);
deed(
	'legendary_miner',
	'Legend of the mine',
	'Break legendary ore.',
	'economy',
	['mining', 'rocks'],
	'star_silver',
	'A thousand clicks, and the mountain remembers your name.',
	'Only the legendary ore counts, the rarest rock of all.',
	ladder(
		'rocks_legend',
		[1, 3, 10, 25, 50],
		(min) => ({ kind: 'rocksTier', tier: 'legendary', min }),
		(min) => `Break ${n(min)} legendary ${min === 1 ? 'ore' : 'ores'}.`,
		20,
		30,
		{ id: 'mountain-legend', name: 'Mountain Legend' },
	),
);
deed(
	'ember_finder',
	'Ember Coal finder',
	'Find Ember Coal in rocks.',
	'economy',
	['mining', 'ingredients'],
	'tower_silver',
	'Still warm, still thinking about being a fire.',
	'Ember Coal that drops from rocks counts, from any kind of rock.',
	ladder(
		'ember_coal',
		[1, 10, 50, 250, 1_000],
		(min) => ({ kind: 'emberCoal', min }),
		(min) => `Find ${n(min)} Ember Coal in rocks.`,
		10,
		20,
	),
);

export const BATCH4_ACHIEVEMENTS: readonly AchievementDef[] = out.achievements;
export const BATCH4_DEEDS: readonly DeedDef[] = out.deeds;
