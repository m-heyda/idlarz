// The words and art on the landing page (`/`): the five feature cards. Pure config; the page (components/landing) only lays them out.
// Wording is the owner's to tune (decision D10); the two-line length is what the card layout is built for.
import type { PixelIconName } from './pixelIcons';

export interface LandingFeature {
	id: string;
	title: string;
	/** Two short lines. */
	text: string;
	icon: PixelIconName;
}

/** The five feature cards, in reading order (left column first). */
export const LANDING_FEATURES: readonly LandingFeature[] = [
	{ id: 'land', title: 'Grow your land', text: 'Buy tiles, raise farms and mines, and watch a quiet meadow become a kingdom.', icon: 'building_farm' },
	{ id: 'rebirth', title: 'Rebirth', text: 'Start anew with the legacy you earned and open worlds no first life ever reaches.', icon: 'castle_6' },
	{ id: 'fight', title: 'Fight and loot', text: 'Send your hero against the things in the wild and come home with spoils.', icon: 'equip_mainHand' },
	{ id: 'craft', title: 'Craft legendary gear', text: 'Gather, smith and enchant until your armour has a story of its own.', icon: 'building_blacksmith' },
	{ id: 'rank', title: 'Climb the rankings', text: 'Your realm keeps growing while you are away. See how it stacks up.', icon: 'building_tower' },
];

/** The biomes of the landing backdrop from the top of the screen down: the hills end up at the bottom, under the title. */
export const LANDING_BIOMES: readonly string[] = ['tundra', 'swamp', 'coast', 'lake', 'forest', 'plains', 'hills'];
