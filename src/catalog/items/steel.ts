import type { ItemDef } from '@/types/game';
import { baseStat } from '../stats';
import { gear } from './define';

// Steel: honest armour, the first tier worth wearing in a real fight.
const steel = { tier: 2, family: 'knight', art: true } as const;

export const STEEL_ITEMS: ItemDef[] = [
	gear('iron_sword', 'Iron Sword', 'mainHand', 'uncommon', { damage: 12 }, { tier: 2, weaponType: 'sword', art: true, description: 'A plain blade that holds an edge.' }),
	gear('steel_mace', 'Steel Mace', 'mainHand', 'uncommon', { damage: 18 }, { tier: 2, weaponType: 'mace', art: true, description: 'Dents helmets and opinions alike.' }),
	gear('battle_axe', 'Battle Axe', 'mainHand', 'uncommon', { damage: 15, critChance: 3 }, { tier: 2, weaponType: 'axe', art: true, description: 'Wide edge, wicked bite.' }),
	gear('steel_dagger', 'Steel Dagger', 'mainHand', 'uncommon', { damage: 9, critChance: 10 }, { tier: 2, weaponType: 'dagger', art: true, description: 'Quick. Finds the gap in anything.' }),
	gear('steel_spear', 'Steel Spear', 'mainHand', 'uncommon', { damage: 12, armor: 2 }, { tier: 2, weaponType: 'spear', art: true, description: 'Keeps trouble at arm and a half length.' }),
	gear('recurve_bow', 'Recurve Bow', 'mainHand', 'uncommon', { damage: 9, critChance: 12 }, { tier: 2, weaponType: 'bow', art: true, description: 'Steel-backed limbs for sharp shooting.' }),
	gear('steel_shield', 'Steel Shield', 'offHand', 'uncommon', { armor: 8, maxHp: 2 }, { ...steel, weaponType: 'shield', description: 'Studded and round.' }),
	gear('steel_helm', 'Steel Helm', 'head', 'uncommon', { armor: 4, maxHp: 3 }, { ...steel, description: 'A kettle helm with a blue band.' }),
	gear('steel_pauldrons', 'Steel Pauldrons', 'shoulder', 'uncommon', { armor: 3, maxHp: 3 }, { ...steel, description: 'Shrugs off glancing blows.' }),
	gear('steel_cuirass', 'Steel Cuirass', 'chest', 'uncommon', { armor: 7, maxHp: 6 }, { ...steel, description: 'A breastplate over a blue tabard.' }),
	gear('steel_gauntlets', 'Steel Gauntlets', 'hands', 'uncommon', { armor: 2, maxHp: 2 }, { ...steel, description: 'Hinged and heavy.' }),
	gear('steel_greaves', 'Steel Greaves', 'legs', 'uncommon', { armor: 5, maxHp: 4 }, { ...steel, description: 'Knee cops that have met a few rats.' }),
	gear('steel_sabatons', 'Steel Sabatons', 'feet', 'uncommon', { armor: 3, maxHp: 2 }, { ...steel, description: 'Loud in the corridors.' }),
	gear('steel_gorget', 'Steel Gorget', 'neck', 'uncommon', { armor: 1, maxHp: 5, goldFind: baseStat('goldFind', 2) }, { ...steel, description: 'A collar of steel with a sky-blue stone.' }),
	gear('steel_cloak', "Knight's Cloak", 'cape', 'uncommon', { armor: 2, maxHp: 3, dodge: baseStat('dodge', 2) }, { ...steel, description: 'Blue wool and a silver clasp.' }),
	gear('steel_ring', 'Steel Ring', 'ring', 'uncommon', { maxHp: 4 }, { ...steel, description: 'A plain silver band. Fits either hand.' }),
	gear('steel_charm', 'Steel Charm', 'charm', 'uncommon', { armor: 1, maxHp: 4 }, { ...steel, description: 'A bead of cold blue glass.' }),
];
