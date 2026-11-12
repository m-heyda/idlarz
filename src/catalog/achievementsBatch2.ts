import type { AchievementDef, DeedDef } from './achievements';

// Deeds batch 2 (IDL-305, owner list of 2026-11-12): new biomes, adjacency clusters, full kits, item level, login streaks, the first respec, attribute thresholds, farm animals, buildings, bosses and one secret. Every id is new and appended after
// the first batch (never reordered). Gems and points are placeholders for the balance pass (IDL-310); badges are stand-ins from the existing set (`badgePlaceholder`) until real art exists. Each tier is an ordinary achievement; a deed groups them.

const badge = (name: string) => `badge_${name}`;

interface Built {
	achievements: AchievementDef[];
	deeds: DeedDef[];
}

const out: Built = { achievements: [], deeds: [] };

/** Adds a deed whose tiers are `[goal, when, title suffix, gems, points, bonus?]`. */
const deed = (
	id: string,
	title: string,
	description: string,
	category: DeedDef['category'],
	tags: string[],
	art: string,
	lore: string,
	how: string,
	tiers: { suffix: string; id: string; when: AchievementDef['when']; text: string; gems: number; points: number }[],
) => {
	out.deeds.push({ id, title, description, category, tags, badge: badge(art), lore, how, tiers: tiers.map((t) => t.id) });
	for (const t of tiers)
		out.achievements.push({
			id: t.id,
			title: tiers.length > 1 ? `${title} ${t.suffix}` : title,
			description: t.text,
			when: t.when,
			badge: badge(art),
			badgePlaceholder: true,
			rewards: { gems: t.gems, points: t.points },
		});
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- Explorer: the first tile of each rebirth biome
const NEW_BIOMES: [string, string][] = [
	['jungle', 'Jungle'],
	['fields', 'Fields'],
	['orchard', 'Blossom Orchard'],
	['blight', 'Blight'],
	['battlefield', 'Battlefield'],
];
for (const [biome, name] of NEW_BIOMES)
	deed(
		`explorer_${biome}`,
		`New land: ${name}`,
		`Unlock your first ${name} tile.`,
		'explorer',
		['biome', 'rebirth'],
		'map_flag_bronze',
		'A realm grows at its edges.',
		`${name} tiles appear after a rebirth. Buy one from the map.`,
		[{ suffix: '', id: `biome_${biome}`, when: { kind: 'biome', biome }, text: `Unlock your first ${name} tile.`, gems: 50, points: 10 }],
	);

// ---- Explorer: the largest connected group of one biome
const CLUSTER_BIOMES = ['forest', 'plains', 'hills', 'swamp', 'tundra', 'lake', 'coast'];
for (const biome of CLUSTER_BIOMES)
	deed(
		`cluster_${biome}`,
		`${cap(biome)} stretch`,
		`Own a connected group of ${cap(biome)} tiles.`,
		'explorer',
		['biome', 'adjacency'],
		'map_flag_bronze',
		'Neighbours help each other grow.',
		`Tiles of the same biome that touch on a side count as one group. Buy ${biome} tiles next to each other.`,
		[5, 12, 20].map((min, i) => ({
			suffix: ROMAN[i],
			id: `cluster_${biome}_${min}`,
			when: { kind: 'cluster', biome, min },
			text: `Own ${min} connected ${cap(biome)} tiles.`,
			gems: 20 + i * 30,
			points: 5 + i * 10,
		})),
	);

// ---- Gear
deed(
	'kit',
	'Fully kitted',
	'Wear gear of one rarity or better in every slot.',
	'gear',
	['gear'],
	'shield_silver',
	'Dressed for the occasion, every occasion.',
	'Every one of the 14 equipment slots must hold a piece of that rarity or better.',
	[
		{ suffix: 'I', id: 'kit_uncommon', when: { kind: 'kit', rarity: 'uncommon' }, text: 'Wear uncommon or better gear in every slot.', gems: 40, points: 10 },
		{ suffix: 'II', id: 'kit_epic', when: { kind: 'kit', rarity: 'epic' }, text: 'Wear epic or better gear in every slot.', gems: 120, points: 40 },
		{ suffix: 'III', id: 'kit_legendary', when: { kind: 'kit', rarity: 'legendary' }, text: 'Wear legendary gear in every slot.', gems: 400, points: 150 },
	],
);
deed(
	'ilvl',
	'Well equipped',
	'Raise the average item level of your worn gear.',
	'gear',
	['gear', 'stat'],
	'shield_silver',
	'Numbers go up. That is the whole joke.',
	'The average item level of everything you wear counts.',
	[15, 35, 60].map((min, i) => ({
		suffix: ROMAN[i],
		id: `ilvl_${min}`,
		when: { kind: 'wornLevel', min },
		text: `Average worn item level ${min}.`,
		gems: 30 + i * 40,
		points: 10 + i * 20,
	})),
);

// ---- Hero
deed(
	'streak',
	'Regular',
	'Claim the daily bonus on consecutive days.',
	'hero',
	['streak'],
	'star_silver',
	'Showing up is most of it.',
	'Claim the daily gem bonus every day without missing one.',
	[3, 7].map((min, i) => ({
		suffix: ROMAN[i],
		id: `streak_${min}`,
		when: { kind: 'streak', min },
		text: `Claim the daily bonus ${min} days in a row.`,
		gems: 20 + i * 40,
		points: 5 + i * 15,
	})),
);
deed(
	'respec',
	'Second thoughts',
	'Take your attribute points back for the first time.',
	'hero',
	['stat'],
	'scroll_check_silver',
	'Everyone has a build they regret.',
	'Your first respec is free.',
	[{ suffix: '', id: 'first_respec', when: { kind: 'respecs', min: 1 }, text: 'Respec your attributes once.', gems: 20, points: 5 }],
);
for (const stat of ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'])
	deed(
		`attr_${stat}`,
		`${cap(stat)} focus`,
		`Put points into ${cap(stat)}.`,
		'hero',
		['stat'],
		'skull_bronze',
		'Specialists make the best stories.',
		`Spend attribute points on ${cap(stat)}.`,
		[50, 100, 200].map((min, i) => ({
			suffix: ROMAN[i],
			id: `attr_${stat}_${min}`,
			when: { kind: 'attribute', stat, min },
			text: `Reach ${min} ${cap(stat)}.`,
			gems: 30 + i * 50,
			points: 10 + i * 20,
		})),
	);

// ---- Farm
deed(
	'farmer',
	'Farmer',
	'Own farm animals.',
	'farm',
	['farm'],
	'chest_bronze',
	'Every acre needs something that clucks.',
	'Animals of every kind count.',
	[10, 50, 200].map((min, i) => ({
		suffix: ROMAN[i],
		id: `farm_${min}`,
		when: { kind: 'animals', min },
		text: `Own ${min} farm animals.`,
		gems: 20 + i * 40,
		points: 5 + i * 15,
	})),
);
for (const animal of ['chicken', 'sheep', 'pig', 'cow'])
	deed(
		`farm_${animal}`,
		`${cap(animal)} keeper`,
		`Own ${animal}s.`,
		'farm',
		['farm'],
		'chest_bronze',
		'They know your name. Mostly.',
		`Buy ${animal}s on the farm.`,
		[10, 50].map((min, i) => ({
			suffix: ROMAN[i],
			id: `farm_${animal}_${min}`,
			when: { kind: 'animals', animal, min },
			text: `Own ${min} ${animal}s.`,
			gems: 20 + i * 40,
			points: 5 + i * 15,
		})),
	);

// ---- Realm: buildings (dormant until the building system is on: nothing stands, so the counters read 0)
for (const biome of CLUSTER_BIOMES)
	deed(
		`build_${biome}`,
		`${cap(biome)} builder`,
		`Build on ${cap(biome)} tiles.`,
		'realm',
		['buildings', 'biome'],
		'hammer_bronze',
		'A roof is the first form of ambition.',
		`Put buildings on ${biome} tiles.`,
		[3, 10].map((min, i) => ({
			suffix: ROMAN[i],
			id: `build_${biome}_${min}`,
			when: { kind: 'buildingsIn', biome, min },
			text: `Have ${min} buildings on ${cap(biome)} tiles.`,
			gems: 25 + i * 40,
			points: 5 + i * 15,
		})),
	);
deed(
	'build_max',
	'Master builder',
	'Upgrade buildings to the top level.',
	'realm',
	['buildings'],
	'hammer_bronze',
	'Done is better than perfect. Perfect is better than done.',
	'Upgrade a building to its highest level.',
	[1, 5, 20].map((min, i) => ({
		suffix: ROMAN[i],
		id: `build_max_${min}`,
		when: { kind: 'buildingsMaxed', min },
		text: `Have ${min} buildings at the top level.`,
		gems: 40 + i * 60,
		points: 10 + i * 25,
	})),
);

// ---- Combat: bosses (the counter exists)
deed(
	'bossbane',
	'Bossbane',
	'Defeat bosses.',
	'combat',
	['boss', 'kills'],
	'great_auroch_boss',
	'The big ones fall the same way, only slower.',
	'Every boss kill counts.',
	[5, 25, 100].map((min, i) => ({
		suffix: ROMAN[i],
		id: `boss_kills_${min}`,
		when: { kind: 'bosses', min },
		text: `Defeat ${min} bosses.`,
		gems: 40 + i * 60,
		points: 10 + i * 25,
	})),
);

// ---- Fun (secret)
deed(
	'curious',
	'Just looking',
	'Peek into the Gambling tab while there is nothing in it.',
	'fun',
	['secret'],
	'star_silver',
	'Some tabs are only there to be opened.',
	'Open the merchant and look at Gambling.',
	[{ suffix: '', id: 'curious_gambler', when: { kind: 'curiosity', id: 'gambling_empty' }, text: 'Open the empty Gambling tab.', gems: 25, points: 5 }],
);

export const BATCH2_ACHIEVEMENTS: readonly AchievementDef[] = out.achievements;
export const BATCH2_DEEDS: readonly DeedDef[] = out.deeds;
