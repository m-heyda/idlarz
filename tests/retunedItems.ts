// Items whose stats were retuned ON PURPOSE after the loot rework (the stats rework gave the mage gear mana and spell power and
// brought the magic weapons up to melee damage per second). The golden tests (itemInstance.test.ts, saves.test.ts)
// compare every legacy item with the snapshot of what it was before the rework (fixtures/legacy-items.json), which proves a
// SAVE converts without changing anything; these nine are the only ones allowed to differ from that snapshot, and must equal this.
export const RETUNED_STATS: Record<string, Record<string, number>> = {
	oak_staff: { damage: 8, regen: 0.5, luck: 2, maxMana: 8, spellPower: 8 },
	apprentice_wand: { damage: 5, critChance: 4, luck: 2, spellPower: 4 },
	apprentice_tome: { maxHp: 6, regen: 0.3, maxMana: 8, manaRegen: 0.3 },
	cloth_hat: { maxHp: 4, luck: 1, maxMana: 4 },
	cloth_robe: { armor: 1, maxHp: 8, regen: 0.3, manaRegen: 0.2 },
	cloth_amulet: { maxHp: 4, luck: 1, goldFind: 2, spellPower: 4 },
	cloth_ring: { maxHp: 2, critChance: 1, maxMana: 4 },
	cloth_charm: { maxHp: 3, regen: 0.2, luck: 1, manaRegen: 0.1 },
	obsidian_staff: { damage: 17, regen: 1.5, luck: 5, maxMana: 18, manaRegen: 0.45, spellPower: 20 },
};
