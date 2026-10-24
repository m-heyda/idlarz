import type { ItemDef } from '@/types/game';
import { gear } from './define';

// Obsidian: glassy black armour with violet light in it. Rare drops from old rats and good chests; never sold.
const obs = { tier: 3, set: 'obsidian', art: true } as const;

export const OBSIDIAN_ITEMS: ItemDef[] = [
	gear('obsidian_blade', 'Obsidian Blade', 'mainHand', 'rare', { damage: 6, critChance: 5 }, { tier: 3, weaponType: 'sword', art: true, description: 'Cuts so cleanly the wound forgets itself.' }),
	gear('obsidian_maul', 'Obsidian Maul', 'mainHand', 'rare', { damage: 9 }, { tier: 3, weaponType: 'maul', art: true, description: 'A glass-black block on an iron haft.' }),
	gear('obsidian_longbow', 'Obsidian Longbow', 'mainHand', 'rare', { damage: 5, critChance: 15, superCrit: 3 }, { tier: 3, weaponType: 'bow', art: true, description: 'The string sings in violet.' }),
	gear('obsidian_crossbow', 'Obsidian Crossbow', 'mainHand', 'rare', { damage: 6, critChance: 12, superCrit: 5 }, { tier: 3, weaponType: 'crossbow', art: true, description: 'Hits hard where it matters.' }),
	gear('obsidian_kris', 'Obsidian Kris', 'mainHand', 'rare', { damage: 4, critChance: 14, superCrit: 4, luck: 3 }, { tier: 3, weaponType: 'dagger', art: true, description: 'A wavy blade that always finds a way.' }),
	gear('obsidian_staff', 'Obsidian Staff', 'mainHand', 'rare', { damage: 3, regen: 1.5, luck: 5 }, { tier: 3, weaponType: 'staff', art: true, description: 'Cold light pools in its orb.' }),
	gear('obsidian_aegis', 'Obsidian Aegis', 'offHand', 'rare', { armor: 11, maxHp: 12 }, { ...obs, weaponType: 'shield', description: 'A spiked disc of black glass.' }),
	gear('obsidian_helm', 'Obsidian Helm', 'head', 'rare', { armor: 6, maxHp: 6 }, { ...obs, description: 'Crowned with two cold horns.' }),
	gear('obsidian_pauldrons', 'Obsidian Pauldrons', 'shoulder', 'rare', { armor: 5, maxHp: 5 }, { ...obs, description: 'Spiked and shining.' }),
	gear('obsidian_cuirass', 'Obsidian Cuirass', 'chest', 'rare', { armor: 10, maxHp: 12 }, { ...obs, description: 'A violet core pulses behind the glass.' }),
	gear('obsidian_gauntlets', 'Obsidian Gauntlets', 'hands', 'rare', { armor: 3, maxHp: 3, critChance: 1.5 }, { ...obs, description: 'Fingertips like knives.' }),
	gear('obsidian_greaves', 'Obsidian Greaves', 'legs', 'rare', { armor: 7, maxHp: 8 }, { ...obs, description: 'Knee spikes for emphasis.' }),
	gear('obsidian_sabatons', 'Obsidian Sabatons', 'feet', 'rare', { armor: 4, maxHp: 4 }, { ...obs, description: 'Sharp toes. Mind the furniture.' }),
	gear('obsidian_pendant', 'Obsidian Pendant', 'neck', 'rare', { armor: 2, maxHp: 8, critChance: 1.5 }, { ...obs, description: 'An amethyst in a ring of dark glass.' }),
	gear('obsidian_cloak', 'Obsidian Cloak', 'cape', 'rare', { armor: 3, maxHp: 5 }, { ...obs, description: 'Stitched from midnight.' }),
	gear('obsidian_ring', 'Obsidian Ring', 'ring', 'rare', { maxHp: 6, critChance: 1.5 }, { ...obs, description: 'A twist of black glass. Fits either hand.' }),
	gear('obsidian_charm', 'Obsidian Charm', 'charm', 'rare', { armor: 1, maxHp: 7, superCrit: 1 }, { ...obs, description: 'A violet bead in black glass.' }),
];
