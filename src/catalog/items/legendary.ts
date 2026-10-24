import type { ItemDef } from '@/types/game';
import { gear } from './define';

// Legendary weapons: chase drops. Rare from chests, and a small chance from the Rat King.
export const LEGENDARY_ITEMS: ItemDef[] = [
	gear('emberbrand', 'Emberbrand', 'mainHand', 'legendary', { damage: 11, critChance: 10, superCrit: 8 }, { tier: 5, weaponType: 'sword', art: true, description: 'Forged in a dying star. Still warm.' }),
	gear('starfall_bow', 'Starfall Bow', 'mainHand', 'legendary', { damage: 8, critChance: 20, superCrit: 10 }, { tier: 5, weaponType: 'bow', art: true, description: 'Every arrow is a wish that landed.' }),
	gear('titan_maul', 'Titan Maul', 'mainHand', 'legendary', { damage: 15, critChance: 4, superCrit: 6 }, { tier: 5, weaponType: 'maul', art: true, description: 'It takes two hands and no excuses.' }),
];
