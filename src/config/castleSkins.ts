// The premium castle skins of the Gem shop: one picture each (`public/pixel/castles/castle_skin_<n>.png`, 64 px), drawn in place of the level castle once bought and picked. A leaf module (pure data), read by the price book, the shop window and the sprite.

/** Gems one castle skin costs */
export const CASTLE_SKIN_PRICE = 2500;

export interface CastleSkin {
	/** 1-based; the picture is `castle_skin_<n>` */
	n: number;
	name: string;
}

/** The skins in shop order (number 11 is not sold: its picture was the same as the Jewel Palace's and was removed). Append new ones at the end: a purchase is recorded under `castle_skin_<n>` in the ledger for good. */
export const CASTLE_SKINS: readonly CastleSkin[] = [
	{ n: 1, name: 'Ice Lotus' },
	{ n: 2, name: 'Ring Fortress' },
	{ n: 3, name: 'Crimson Gothic' },
	{ n: 4, name: 'Red Pagoda' },
	{ n: 5, name: 'Stone Keep' },
	{ n: 6, name: 'Golden Palace' },
	{ n: 7, name: 'Crystal Citadel' },
	{ n: 8, name: 'Jewel Palace' },
	{ n: 9, name: 'Ember Fortress' },
	{ n: 10, name: 'Prism Spire' },
	{ n: 12, name: 'Emerald Keep' },
	{ n: 13, name: 'Tidal Keep' },
	{ n: 14, name: 'Moonlit Cathedral' },
];

/** The id of a skin's purchase (`ledger.gemShop.bought`, the gem item id) */
export const castleSkinItemId = (n: number): `castle_skin_${number}` => `castle_skin_${n}`;

/** The skins an account owns, from the ledger's `bought` record (the server is the record; the shop and the sprite mirror it) */
export const ownedSkinsOf = (bought: Record<string, number> | undefined): number[] =>
	CASTLE_SKINS.filter((skin) => (bought?.[castleSkinItemId(skin.n)] ?? 0) > 0).map((skin) => skin.n);
