// The words and art on the landing page (`/`): the five feature cards and the monsters that sit on the edges of the boxes. Pure config; the page (components/landing) only lays them out.
// Wording is the owner's to tune (decision D10); the two-line length is what the card layout is built for.
import { buildingDef } from '../catalog/buildings';
import type { PixelIconName } from './pixelIcons';

export interface LandingFeature {
	id: string;
	title: string;
	/** Two short lines. */
	text: string;
	/** The card's picture: a pixel icon, or `art`, the URL of a building picture (the building catalog's, so a swap of that file shows here too). One of the two is set. */
	icon?: PixelIconName;
	art?: string;
	/** A monster from `public/pixel/enemies` that perches on the card's top edge. */
	critter: string;
}

/** The picture of a building in the catalog (`catalog/buildings.ts`) */
const buildingArt = (id: string): string => buildingDef(id)!.art;

/** The five feature cards, in reading order. */
export const LANDING_FEATURES: readonly LandingFeature[] = [
	{
		id: 'land',
		title: 'Grow your land',
		text: 'Buy tiles, raise farms and mines, and watch a quiet meadow become a kingdom.',
		art: buildingArt('granary'),
		critter: 'plains/thistle-boar',
	},
	{
		id: 'rebirth',
		title: 'Rebirth',
		text: 'Start anew with the legacy you earned and open worlds no first life ever reaches.',
		icon: 'castle_6',
		critter: 'tundra/rime-wraith',
	},
	{
		id: 'fight',
		title: 'Fight and loot',
		text: 'Send your hero against the things in the wild and come home with spoils.',
		icon: 'equip_mainHand',
		critter: 'forest/mossback-wolf',
	},
	{
		id: 'craft',
		title: 'Craft legendary gear',
		text: 'Gather, smith and enchant until your armour has a story of its own.',
		art: buildingArt('coalpit'),
		critter: 'forest/bramble-imp',
	},
	{
		id: 'rank',
		title: 'Climb the rankings',
		text: 'Your realm keeps growing while you are away. See how it stacks up.',
		art: buildingArt('sporecellar'),
		critter: 'tundra/frost-hare',
	},
];

/** The baked picture behind the page (`/map-lab/landing-bake`, `lib/landingWorld`) and its size in px; it is shown at `scale` of that size (the CSS positions of the title block in Landing.css follow it). */
export const LANDING_MAP = { src: '/landing/map.png', width: 3456, height: 1728, scale: 0.75 } as const;

/** The size the landing is laid out for (css px: content width, and the height from the top of the map to the bottom of the feature cards). The page is scaled to fit the screen (`fitZoom`). */
export const LANDING_DESIGN = { width: 1300, height: 1030 } as const;

/** The scale that fits the design into a screen: a big screen gets the page bigger, a small one smaller (0.5 to 1.5). */
export const fitZoom = (screenWidth: number, screenHeight: number): number =>
	Math.min(1.5, Math.max(0.5, Math.min(screenWidth / LANDING_DESIGN.width, screenHeight / LANDING_DESIGN.height)));
