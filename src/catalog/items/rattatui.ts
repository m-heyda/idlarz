import type { ItemDef } from '@/types/game';
import { baseStat, type ItemStats } from '../stats';
import { gear } from './define';

// The Rattatui set: the best gear in the game, dropped only by the Rat King (see the `ratKing` drop rule). Epic (violet).
const rattatui = (
	suffix: string,
	name: string,
	slot: NonNullable<ItemDef['slot']>,
	stats: ItemStats,
	description: string,
	weaponType?: ItemDef['weaponType']
): ItemDef =>
	gear(`rattatui_${suffix}`, `Rattatui ${name}`, slot, 'epic', stats, {
		tier: 4,
		set: 'rattatui',
		description,
		art: true,
		weaponType,
		named: true,
		pools: ['rattatui_set'],
	});

export const RATTATUI_ITEMS: ItemDef[] = [
	rattatui('cap', 'Cap', 'head', { armor: 6, maxHp: 8 }, 'Stitched from the fur of a very brave rat.'),
	rattatui('shoulderpads', 'Shoulderpads', 'shoulder', { armor: 5, maxHp: 7 }, 'Surprisingly bite-proof.'),
	rattatui('tunic', 'Tunic', 'chest', { armor: 11, maxHp: 14 }, 'Beta testers wear it with pride.'),
	rattatui('gloves', 'Gloves', 'hands', { armor: 4, maxHp: 5, critChance: 1 }, 'Good for gripping cheese.'),
	rattatui('trousers', 'Trousers', 'legs', { armor: 8, maxHp: 10 }, 'Tailored by a rat tailor.'),
	rattatui('boots', 'Boots', 'feet', { armor: 5, maxHp: 6, regen: 0.3 }, 'Quiet on stone floors.'),
	rattatui('amulet', 'Amulet', 'neck', { armor: 2, maxHp: 14, critChance: 2, goldFind: baseStat('goldFind', 4) }, 'A gnawed coin on a string.'),
	rattatui('cloak', 'Cloak', 'cape', { armor: 4, maxHp: 6, regen: 0.5, dodge: baseStat('dodge', 4) }, 'Smells faintly of sewer.'),
	rattatui('ring', 'Ring', 'ring', { maxHp: 10, critChance: 2 }, 'Fits either hand.'),
	rattatui('charm', 'Charm', 'charm', { armor: 3, maxHp: 16, superCrit: 2, luck: 2 }, 'A lucky whisker in a glass bead.'),
	rattatui('fang_blade', 'Fang Blade', 'mainHand', { damage: 24, critChance: 8, superCrit: 4 }, 'A rat fang, polished and sharp.', 'sword'),
	rattatui('buckler', 'Buckler', 'offHand', { armor: 12, maxHp: 20 }, 'A cheese-wheel shield with a metal rim.', 'shield'),
];
