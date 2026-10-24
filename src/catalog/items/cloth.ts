import type { ItemDef } from '@/types/game';
import { gear } from './define';

// Cloth: little armour, a lot of health, and the small stats (regen, luck, a touch of crit) the heavier families lack.
const cloth = { tier: 1, set: 'apprentice', art: true } as const;

export const CLOTH_ITEMS: ItemDef[] = [
	gear('oak_staff', 'Oak Staff', 'mainHand', 'common', { damage: 1, regen: 0.5, luck: 2 }, { tier: 1, weaponType: 'staff', art: true, description: 'A walking staff with a green gem. It hums when you rest.' }),
	gear('apprentice_wand', 'Apprentice Wand', 'mainHand', 'common', { damage: 1, critChance: 4, luck: 2 }, { tier: 1, weaponType: 'wand', art: true, description: 'Sparks wherever it points.' }),
	gear('apprentice_tome', 'Apprentice Tome', 'offHand', 'common', { maxHp: 6, regen: 0.3 }, { ...cloth, weaponType: 'tome', description: 'Half the pages are doodles.' }),
	gear('cloth_hat', 'Apprentice Hat', 'head', 'common', { maxHp: 4, luck: 1 }, { ...cloth, description: 'Pointy, purple and slightly too big.' }),
	gear('cloth_mantle', 'Linen Mantle', 'shoulder', 'common', { armor: 1, maxHp: 3 }, { ...cloth, description: 'Soft linen with gold piping.' }),
	gear('cloth_robe', 'Apprentice Robe', 'chest', 'common', { armor: 1, maxHp: 8, regen: 0.3 }, { ...cloth, description: 'Woven with a little patience.' }),
	gear('cloth_gloves', 'Linen Gloves', 'hands', 'common', { maxHp: 2, critChance: 1 }, { ...cloth, description: 'Nimble fingers, steady aim.' }),
	gear('cloth_trousers', 'Apprentice Trousers', 'legs', 'common', { armor: 1, maxHp: 4 }, { ...cloth, description: 'Easy to run in.' }),
	gear('cloth_slippers', 'Apprentice Slippers', 'feet', 'common', { maxHp: 3, regen: 0.2 }, { ...cloth, description: 'Light as a whisper.' }),
	gear('cloth_amulet', 'Apprentice Amulet', 'neck', 'common', { maxHp: 4, luck: 1 }, { ...cloth, description: 'A violet stone on a gold chain.' }),
	gear('cloth_cape', 'Apprentice Cape', 'cape', 'common', { armor: 1, maxHp: 3 }, { ...cloth, description: 'Flutters dramatically.' }),
	gear('cloth_ring', 'Apprentice Ring', 'ring', 'common', { maxHp: 2, critChance: 1 }, { ...cloth, description: 'A gold band with a violet gem. Fits either hand.' }),
	gear('cloth_charm', 'Apprentice Charm', 'charm', 'common', { maxHp: 3, luck: 1, regen: 0.2 }, { ...cloth, description: 'A bead that glows when you lose hope.' }),
];
